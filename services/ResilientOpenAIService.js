
// services/ResilientOpenAIService.js 

const winston = require('winston');

// Configure logger if not already available
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/openai-service.log' })
  ]
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
      'model', 'messages', 'max_tokens', 'temperature', 'top_p', 'n', 
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
        model: options.model || 'gpt-4o-mini',
        object: 'chat.completion'
      };
    };
    
    // ✅ FIXED: Operation with proper parameter filtering
    const operation = async () => {
      return await this.retryPolicy.execute(async () => {
        // Filter out ALL invalid parameters before sending to OpenAI
        const cleanOptions = this.filterOpenAIOptions({
          model: options.model || "gpt-4o-mini",
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
        });
        
        logger.debug('Sending to OpenAI:', {
          model: cleanOptions.model,
          messageCount: cleanOptions.messages.length,
          maxTokens: cleanOptions.max_tokens,
          stream: cleanOptions.stream,
          filteredParams: Object.keys(cleanOptions)
        });
        
        const response = await this.openai.chat.completions.create(cleanOptions);
        
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
      const cleanOptions = this.filterOpenAIOptions({
        model: options.model || "gpt-4o-mini",
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
      });
      
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
        const words = fallbackContent.split(' ');
        for (let i = 0; i < words.length; i += 2) {
          const chunk = words.slice(i, i + 2).join(' ') + ' ';
          yield {
            choices: [{
              delta: {
                content: chunk
              }
            }]
          };
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        
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

module.exports = { ResilientOpenAIService, CircuitBreaker, RetryPolicy };