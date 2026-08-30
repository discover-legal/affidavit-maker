
// services/ResilientOpenAIService.js 

const winston = require('winston');
const {
  DEFAULT_LLM_MODEL,
  normalizeChatParams,
  isResponsesOnlyModel,
} = require('./llmConfig');

// ---------------------------------------------------------------------------
// Responses API adapter (Luna-family models: gpt-5.6-*)
//
// Luna only supports function tools via POST /v1/responses. The wrapper below
// converts a Chat Completions-shaped request into a Responses-shaped request,
// invokes it, and converts the Responses envelope back to Chat Completions so
// every caller (BaseDivorceOrchestrator, affidavitService, ingest, fix-my-
// story, ...) keeps reading choices[0].message.tool_calls[0].function.arguments
// with no changes.
//
// Shapes verified by live probe against gpt-5.6-luna on 2026-08-28:
//   request:  { model, input:[{role, content:[{type:'input_text', text}]}],
//               tools:[{type:'function', name, description, parameters}],
//               tool_choice:{type:'function', name},
//               max_output_tokens }
//   response: { output:[{type:'function_call', id, call_id, name, arguments}],
//               output_text?: string, usage:{input_tokens, output_tokens, ...} }
// ---------------------------------------------------------------------------

function _contentToText(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map(part => (typeof part === 'string' ? part : part?.text || ''))
      .join('');
  }
  return '';
}

function _messageRoleForResponses(role) {
  // The Responses API uses 'developer' where Chat Completions uses 'system'.
  // Tool result messages are folded into 'user' text (Luna extraction turns
  // do not currently round-trip tool results — no orchestrator relies on it).
  if (role === 'system') return 'developer';
  if (role === 'tool' || role === 'function') return 'user';
  return role; // user / assistant / developer pass through
}

function chatToResponsesRequest(chatParams) {
  const messages = Array.isArray(chatParams.messages) ? chatParams.messages : [];
  const input = messages.map(m => {
    const role = _messageRoleForResponses(m.role);
    // Content-part type is role-dependent: user/developer send 'input_text',
    // assistant sends 'output_text' (the Responses API rejects input_text on
    // assistant messages — real error: "Invalid value: 'input_text'. Supported
    // values are: 'output_text' and 'refusal'"). Chat-Completions tool/function
    // role messages fold into 'user' text, so use input_text for those.
    const partType = role === 'assistant' ? 'output_text' : 'input_text';
    return {
      role,
      content: [{ type: partType, text: _contentToText(m.content) }],
    };
  });

  const req = { model: chatParams.model, input };

  // Chat Completions tools:      [{type:'function', function:{name, description, parameters}}]
  // Responses tools (flat):      [{type:'function', name, description, parameters}]
  if (Array.isArray(chatParams.tools) && chatParams.tools.length > 0) {
    req.tools = chatParams.tools.map(t => {
      if (t && t.type === 'function' && t.function) {
        const f = t.function;
        return {
          type: 'function',
          name: f.name,
          description: f.description,
          parameters: f.parameters,
        };
      }
      // Already Responses-shaped or a non-function tool — pass through.
      return t;
    });
  }

  // Chat Completions tool_choice: {type:'function', function:{name}} | 'auto' | 'none' | 'required'
  // Responses tool_choice:        {type:'function', name}            | 'auto' | 'none' | 'required'
  if (chatParams.tool_choice !== undefined) {
    const tc = chatParams.tool_choice;
    if (tc && typeof tc === 'object' && tc.type === 'function' && tc.function?.name) {
      req.tool_choice = { type: 'function', name: tc.function.name };
    } else {
      req.tool_choice = tc;
    }
  }

  if (chatParams.parallel_tool_calls !== undefined) {
    req.parallel_tool_calls = chatParams.parallel_tool_calls;
  }

  // Token budget: Chat uses max_tokens / max_completion_tokens; Responses uses
  // max_output_tokens. Prefer max_completion_tokens (already normalized), then
  // max_tokens.
  const budget = chatParams.max_output_tokens
    ?? chatParams.max_completion_tokens
    ?? chatParams.max_tokens;
  if (budget !== undefined) req.max_output_tokens = budget;

  if (chatParams.user !== undefined) req.user = chatParams.user;
  if (chatParams.metadata !== undefined) req.metadata = chatParams.metadata;

  // NOTE: Responses (Luna) rejects sampling params for reasoning models the
  // same way Chat Completions does; normalizeChatParams already stripped them.

  return req;
}

function responsesToChatCompletion(resp, model) {
  const output = Array.isArray(resp?.output) ? resp.output : [];

  const toolCalls = output
    .filter(item => item && item.type === 'function_call')
    .map((item, idx) => ({
      id: item.call_id || item.id || `call_${idx}`,
      type: 'function',
      function: {
        name: item.name,
        // Responses returns `arguments` already as a JSON string, matching
        // Chat Completions' shape. Guard against non-string just in case.
        arguments:
          typeof item.arguments === 'string'
            ? item.arguments
            : JSON.stringify(item.arguments ?? {}),
      },
    }));

  // Text output: prefer resp.output_text if present, else concatenate any
  // 'message'/'output_text' content parts from the output array.
  let content = null;
  if (typeof resp?.output_text === 'string' && resp.output_text.length > 0) {
    content = resp.output_text;
  } else {
    const texts = [];
    for (const item of output) {
      if (!item) continue;
      if (item.type === 'output_text' && typeof item.text === 'string') {
        texts.push(item.text);
      } else if (item.type === 'message' && Array.isArray(item.content)) {
        for (const part of item.content) {
          if (part?.type === 'output_text' && typeof part.text === 'string') {
            texts.push(part.text);
          }
        }
      }
    }
    if (texts.length > 0) content = texts.join('');
  }

  const message = { role: 'assistant', content };
  if (toolCalls.length > 0) message.tool_calls = toolCalls;

  const finish_reason = toolCalls.length > 0 ? 'tool_calls' : (resp?.status === 'incomplete' ? 'length' : 'stop');

  const usage = resp?.usage
    ? {
        prompt_tokens: resp.usage.input_tokens ?? 0,
        completion_tokens: resp.usage.output_tokens ?? 0,
        total_tokens:
          resp.usage.total_tokens
          ?? ((resp.usage.input_tokens ?? 0) + (resp.usage.output_tokens ?? 0)),
      }
    : { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

  return {
    id: resp?.id,
    object: 'chat.completion',
    model: resp?.model || model,
    choices: [{ index: 0, message, finish_reason }],
    usage,
    // Preserve raw Responses envelope for anything that wants it.
    _responsesRaw: resp,
  };
}

// Configure logger if not already available.
// Console always; file transport is best-effort. In containerized/read-only
// deployments (e.g. Render running as non-root) the working dir isn't writable,
// and a failed File transport would throw EACCES here at module load — which
// previously took down the whole LLM service ("LLM service not available").
const transports = [new winston.transports.Console()];
try {
  const fs = require('fs');
  const path = require('path');
  const logsDir = path.join(process.cwd(), 'logs');
  fs.mkdirSync(logsDir, { recursive: true });
  transports.push(
    new winston.transports.File({ filename: path.join(logsDir, 'openai-service.log') })
  );
} catch {
  // logs dir not writable (read-only container FS) — console-only is fine;
  // the platform (Render) already captures stdout.
}

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports
});

class CircuitBreaker {
  constructor(options = {}) {
    this.threshold = options.threshold || 5;
    this.timeout = options.timeout || 60000;
    this.resetTimeout = options.resetTimeout || 120000;
    this.name = options.name || 'CircuitBreaker';
    
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
    this.lastFailureTime = null;
    this.metrics = {
      totalCalls: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      circuitOpens: 0
    };
  }
  
  async execute(operation, fallback = null) {
    this.metrics.totalCalls++;
    
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        logger.warn(`Circuit breaker ${this.name} is OPEN, using fallback`);
        if (fallback) {
          return await fallback();
        }
        throw new Error(`Circuit breaker ${this.name} is OPEN. Service temporarily unavailable.`);
      }
      this.state = 'HALF_OPEN';
      logger.info(`Circuit breaker ${this.name} attempting recovery (HALF_OPEN)`);
    }
    
    try {
      const result = await this.executeWithTimeout(operation, this.timeout);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure(error);
      if (fallback) {
        logger.info(`Using fallback for ${this.name}`);
        return await fallback();
      }
      throw error;
    }
  }
  
  async executeWithTimeout(operation, timeout) {
    return Promise.race([
      operation(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Operation timeout')), timeout)
      )
    ]);
  }
  
  onSuccess() {
    this.failureCount = 0;
    this.successCount++;
    this.metrics.totalSuccesses++;
    
    if (this.state === 'HALF_OPEN') {
      logger.info(`Circuit breaker ${this.name} recovered (CLOSED)`);
    }
    this.state = 'CLOSED';
  }
  
  onFailure(error) {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    this.metrics.totalFailures++;
    
    logger.error(`Circuit breaker ${this.name} failure #${this.failureCount}:`, error.message);
    
    if (this.failureCount >= this.threshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
      this.metrics.circuitOpens++;
      logger.error(`Circuit breaker ${this.name} opened after ${this.failureCount} failures`);
    }
  }
  
  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    logger.info(`Circuit breaker ${this.name} manually reset`);
  }
  
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      metrics: this.metrics
    };
  }
}

class RetryPolicy {
  constructor(options = {}) {
    this.maxRetries = options.maxRetries || 3;
    this.initialDelay = options.initialDelay || 1000;
    this.maxDelay = options.maxDelay || 10000;
    this.backoffMultiplier = options.backoffMultiplier || 2;
  }
  
  async execute(operation) {
    let lastError;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        if (attempt < this.maxRetries) {
          const delay = Math.min(
            this.initialDelay * Math.pow(this.backoffMultiplier, attempt),
            this.maxDelay
          );
          
          logger.info(`Retry attempt ${attempt + 1}/${this.maxRetries} after ${delay}ms`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }
}

class ResilientOpenAIService {
  constructor(openaiClient, options = {}) {
    this.openai = openaiClient;
    
    // Circuit breakers for different operations
    this.circuitBreakers = {
      chat: new CircuitBreaker({
        name: 'OpenAI-Chat',
        threshold: options.chatThreshold || 5,
        timeout: options.chatTimeout || 30000,
        resetTimeout: options.resetTimeout || 120000
      }),
      embedding: new CircuitBreaker({
        name: 'OpenAI-Embedding',
        threshold: options.embeddingThreshold || 10,
        timeout: options.embeddingTimeout || 10000,
        resetTimeout: options.resetTimeout || 60000
      })
    };
    
    // Retry policy
    this.retryPolicy = new RetryPolicy({
      maxRetries: options.maxRetries || 3,
      initialDelay: options.initialRetryDelay || 1000,
      maxDelay: options.maxRetryDelay || 10000
    });
    
    // Cache for successful responses
    this.responseCache = new Map();
    this.cacheMaxSize = options.cacheMaxSize || 100;
    this.cacheTTL = options.cacheTTL || 300000; // 5 minutes
    
    // ✅ FIXED: Fallback responses return proper structure
    this.fallbackResponses = {
      chat: "I apologize, but I'm temporarily unable to process your request. Please try again in a moment.",
      embedding: null
    };
    
    // Metrics
    this.metrics = {
      totalRequests: 0,
      cacheHits: 0,
      cacheMisses: 0,
      fallbacksUsed: 0
    };
  }
  
  getCacheKey(operation, params) {
    return `${operation}_${JSON.stringify(params)}`;
  }
  
  getFromCache(key) {
    const cached = this.responseCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      this.metrics.cacheHits++;
      return cached.data;
    }
    this.metrics.cacheMisses++;
    return null;
  }
  
  setCache(key, data) {
    if (this.responseCache.size >= this.cacheMaxSize) {
      const firstKey = this.responseCache.keys().next().value;
      this.responseCache.delete(firstKey);
    }
    
    this.responseCache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  
  // ✅ FIXED: Complete list of valid OpenAI parameters
  filterOpenAIOptions(options) {
    // Complete list of valid OpenAI Chat Completion parameters
    const validParams = [
      'model', 'messages', 'max_tokens', 'max_completion_tokens', 'temperature', 'top_p', 'n',
      'stream', 'stop', 'presence_penalty', 'frequency_penalty', 'logit_bias',
      'user', 'response_format', 'seed', 'tools', 'tool_choice', 'parallel_tool_calls'
    ];


    
    const filtered = {};
    for (const [key, value] of Object.entries(options)) {

      if (validParams.includes(key) && value !== undefined) {
        filtered[key] = value;
      } else if (!validParams.includes(key)) {
        // Log filtered params for debugging
        logger.debug(`Filtered invalid OpenAI param: ${key}=${value}`);

      }
    }
    
    return filtered;
  }
  
  // ✅ FIXED: Chat method with proper error handling and streaming support
  async chat(messages, options = {}) {
    this.metrics.totalRequests++;
    
    // Check cache first (only for non-streaming)
    if (!options.stream) {
      const cacheKey = this.getCacheKey('chat', { messages, options });
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        logger.info('Returning cached chat response');
        return cached;
      }
    }
    
    // ✅ FIXED: Fallback returns proper OpenAI-compatible structure
    const fallback = async () => {
      this.metrics.fallbacksUsed++;
      logger.warn('Using fallback response for chat');
      

      return {
        choices: [{
          message: {
            role: 'assistant',
            content: this.fallbackResponses.chat
          },
          finish_reason: 'stop'
        }],
        usage: { 
          prompt_tokens: 0, 
          completion_tokens: 0, 
          total_tokens: 0 
        },
        model: options.model || DEFAULT_LLM_MODEL,
        object: 'chat.completion'
      };
    };
    
    // ✅ FIXED: Operation with proper parameter filtering
    const operation = async () => {
      return await this.retryPolicy.execute(async () => {
        // Filter out ALL invalid parameters before sending to OpenAI, then
        // normalize for the target model family (GPT-5 models reject
        // max_tokens and sampling params — see services/llmConfig.js).
        const cleanOptions = normalizeChatParams(this.filterOpenAIOptions({
          model: options.model || DEFAULT_LLM_MODEL,
          messages,
          temperature: options.temperature || 0.7,
          max_tokens: options.max_tokens || 1000,

          stream: options.stream || false,
          response_format: options.response_format,
          user: options.user,
          top_p: options.top_p,
          presence_penalty: options.presence_penalty,
          frequency_penalty: options.frequency_penalty,
          stop: options.stop,
          tools: options.tools,
          tool_choice: options.tool_choice,
          parallel_tool_calls: options.parallel_tool_calls
        }));

        logger.debug('Sending to OpenAI:', {
          model: cleanOptions.model,
          messageCount: cleanOptions.messages.length,
          maxTokens: cleanOptions.max_tokens ?? cleanOptions.max_completion_tokens,
          stream: cleanOptions.stream,
          filteredParams: Object.keys(cleanOptions)
        });

        let response;
        if (isResponsesOnlyModel(cleanOptions.model)) {
          // Luna-family: convert to Responses API, invoke, convert back.
          const responsesReq = chatToResponsesRequest(cleanOptions);
          logger.debug('Routing via Responses API (Luna):', {
            model: responsesReq.model,
            hasTools: Array.isArray(responsesReq.tools),
            toolChoice: responsesReq.tool_choice,
          });
          if (!this.openai || !this.openai.responses || typeof this.openai.responses.create !== 'function') {
            throw new Error(
              'OpenAI client does not expose .responses.create — upgrade the openai SDK to use Luna-family models.'
            );
          }
          const raw = await this.openai.responses.create(responsesReq);
          response = responsesToChatCompletion(raw, cleanOptions.model);
        } else {
          response = await this.openai.chat.completions.create(cleanOptions);
        }
        
        // Cache successful response (only non-streaming)
        if (!options.stream) {
          this.setCache(this.getCacheKey('chat', { messages, options }), response);
        }
        return response;
      });
    };
    
    return await this.circuitBreakers.chat.execute(operation, fallback);
  }

  // ✅ NEW: Streaming method
  async chatStream(messages, options = {}) {
    this.metrics.totalRequests++;
    
    const operation = async () => {
      const cleanOptions = normalizeChatParams(this.filterOpenAIOptions({
        model: options.model || DEFAULT_LLM_MODEL,
        messages,
        temperature: options.temperature || 0.7,
        max_tokens: options.max_tokens || 1000,
        stream: true, // Force streaming
        user: options.user,
        top_p: options.top_p,
        presence_penalty: options.presence_penalty,
        frequency_penalty: options.frequency_penalty,
        stop: options.stop,
        tools: options.tools,
        tool_choice: options.tool_choice,
        parallel_tool_calls: options.parallel_tool_calls
      }));
      
      logger.debug('Starting OpenAI stream with params:', Object.keys(cleanOptions));
      
      return await this.openai.chat.completions.create(cleanOptions);
    };
    
    try {
      return await operation();
    } catch (error) {
      logger.error('Streaming failed:', error.message);
      return this.createFallbackStream();
    }
  }

  // ✅ NEW: Create fallback stream when streaming fails
  createFallbackStream() {
    const fallbackContent = this.fallbackResponses.chat;
    
    return {
      [Symbol.asyncIterator]: async function* () {
        // Split into sentences for natural streaming
        // Match sentences ending with . ! ? or newlines
        const sentences = fallbackContent.match(/[^.!?\n]+[.!?\n]+/g) || [fallbackContent];
        
        for (const sentence of sentences) {
          yield {
            choices: [{
              delta: {
                content: sentence
              }
            }]
          };
          // Slight delay between sentences for realistic streaming
          await new Promise(resolve => setTimeout(resolve, 150));
        }
        
        // Send finish signal
        yield {
          choices: [{
            delta: {},
            finish_reason: 'stop'
          }]
        };
      }
    };
  }
  
  async createEmbedding(input, options = {}) {
    this.metrics.totalRequests++;
    
    const cacheKey = this.getCacheKey('embedding', { input, options });
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      logger.info('Returning cached embedding');
      return cached;
    }
    
    const fallback = async () => {
      this.metrics.fallbacksUsed++;
      logger.warn('Using fallback for embedding');
      
      const hash = input.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
      const embedding = new Array(1536).fill(0).map((_, i) => 
        Math.sin(hash * (i + 1)) * 0.1
      );
      
      return {
        data: [{
          embedding,
          index: 0
        }],
        usage: { prompt_tokens: 0, total_tokens: 0 }
      };
    };
    
    const operation = async () => {
      return await this.retryPolicy.execute(async () => {

        const cleanOptions = {
          model: options.model || "text-embedding-ada-002",
          input
        };
        
        const response = await this.openai.embeddings.create(cleanOptions);

        this.setCache(cacheKey, response);
        return response;
      });
    };
    
    return await this.circuitBreakers.embedding.execute(operation, fallback);
  }
  
  async processMessage(message, conversationHistory = [], context = {}) {
    try {
      const messages = [
        {
          role: "system",
          content: "You are a helpful legal assistant specializing in affidavit preparation. Be professional, accurate, and helpful."
        },
        ...conversationHistory,
        {
          role: "user",
          content: message
        }
      ];
      
      const response = await this.chat(messages, {
        temperature: 0.7,
        max_tokens: 1000
        // ✅ REMOVED: timeout and other invalid params
      });
      
      return {
        success: true,
        response: response.choices[0].message.content,
        usage: response.usage
      };
    } catch (error) {
      logger.error('Error processing message:', error);
      return {
        success: false,
        response: "I apologize, but I'm having trouble processing your request. Please try rephrasing your question or try again later.",
        error: error.message
      };
    }
  }
  
  getStatus() {
    return {
      circuitBreakers: Object.entries(this.circuitBreakers).reduce((acc, [name, cb]) => {
        acc[name] = cb.getStatus();
        return acc;
      }, {}),
      cache: {
        size: this.responseCache.size,
        maxSize: this.cacheMaxSize,
        ttl: this.cacheTTL
      },
      metrics: this.metrics
    };
  }
  
  resetCircuitBreakers() {
    Object.values(this.circuitBreakers).forEach(cb => cb.reset());
    logger.info('All circuit breakers reset');
  }
  
  clearCache() {
    this.responseCache.clear();
    logger.info('Response cache cleared');
  }
}

module.exports = {
  ResilientOpenAIService,
  CircuitBreaker,
  RetryPolicy,
  // Exported for tests; not part of the public runtime surface.
  chatToResponsesRequest,
  responsesToChatCompletion,
};