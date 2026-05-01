// services/MultiProviderLLM.js
// Multi-provider LLM wrapper with OpenAI-compatible interface.
// Supports: OpenAI, Anthropic, Gemini, and Chinese models
// (DeepSeek, Qwen, Moonshot/Kimi, Zhipu/GLM, Yi/Lingyiwanwu, Baichuan).
//
// Chinese models all expose OpenAI-compatible /v1/chat/completions endpoints,
// so they reuse the OpenAI SDK with a custom baseURL.

const logger = require('../utils/logger');

/**
 * Registry of OpenAI-compatible providers with their default config.
 * Each entry maps a provider name to { baseURL, envKey, defaultModel }.
 *
 * To add a new provider, just add a row here — no other code changes needed.
 */
const OPENAI_COMPATIBLE_PROVIDERS = {
  // ── Western / Global Labs ─────────────────────────────────────────────
  openai: {
    baseURL: undefined, // SDK default (https://api.openai.com/v1)
    envKey: 'OPENAI_API_KEY',
    defaultModel: 'gpt-4o-2024-08-06',
  },
  mistral: {
    baseURL: 'https://api.mistral.ai/v1',
    envKey: 'MISTRAL_API_KEY',
    defaultModel: 'mistral-large-latest',
  },
  groq: {
    baseURL: 'https://api.groq.com/openai/v1',
    envKey: 'GROQ_API_KEY',
    defaultModel: 'llama-3.3-70b-versatile',
  },
  together: {
    baseURL: 'https://api.together.xyz/v1',
    envKey: 'TOGETHER_API_KEY',
    defaultModel: 'meta-llama/Llama-3.3-70B-Instruct-Turbo',
  },
  perplexity: {
    baseURL: 'https://api.perplexity.ai',
    envKey: 'PERPLEXITY_API_KEY',
    defaultModel: 'sonar-pro',
  },
  fireworks: {
    baseURL: 'https://api.fireworks.ai/inference/v1',
    envKey: 'FIREWORKS_API_KEY',
    defaultModel: 'accounts/fireworks/models/llama-v3p3-70b-instruct',
  },
  xai: {
    baseURL: 'https://api.x.ai/v1',
    envKey: 'XAI_API_KEY',
    defaultModel: 'grok-3',
  },
  cohere: {
    baseURL: 'https://api.cohere.com/compatibility/v1',
    envKey: 'COHERE_API_KEY',
    defaultModel: 'command-a-03-2025',
  },
  cerebras: {
    baseURL: 'https://api.cerebras.ai/v1',
    envKey: 'CEREBRAS_API_KEY',
    defaultModel: 'llama-3.3-70b',
  },
  sambanova: {
    baseURL: 'https://api.sambanova.ai/v1',
    envKey: 'SAMBANOVA_API_KEY',
    defaultModel: 'Meta-Llama-3.3-70B-Instruct',
  },

  // ── Chinese Labs ──────────────────────────────────────────────────────
  deepseek: {
    baseURL: 'https://api.deepseek.com',
    envKey: 'DEEPSEEK_API_KEY',
    defaultModel: 'deepseek-chat',
  },
  qwen: {
    baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    envKey: 'QWEN_API_KEY',
    defaultModel: 'qwen-plus',
  },
  moonshot: {
    baseURL: 'https://api.moonshot.cn/v1',
    envKey: 'MOONSHOT_API_KEY',
    defaultModel: 'moonshot-v1-8k',
  },
  zhipu: {
    baseURL: 'https://open.bigmodel.cn/api/paas/v4/',
    envKey: 'ZHIPU_API_KEY',
    defaultModel: 'glm-4',
  },
  yi: {
    baseURL: 'https://api.lingyiwanwu.com/v1',
    envKey: 'YI_API_KEY',
    defaultModel: 'yi-large',
  },
  baichuan: {
    baseURL: 'https://api.baichuan-ai.com/v1',
    envKey: 'BAICHUAN_API_KEY',
    defaultModel: 'Baichuan4',
  },
};

/**
 * Multi-Provider LLM Wrapper
 *
 * Usage:
 *   LLM_PROVIDER=deepseek LLM_MODEL=deepseek-chat DEEPSEEK_API_KEY=sk-... node server.js
 *   LLM_PROVIDER=qwen     LLM_MODEL=qwen-max     QWEN_API_KEY=sk-...     node server.js
 *   LLM_PROVIDER=openai    (default, uses OPENAI_API_KEY)
 *
 * You can also pass a custom base URL directly:
 *   LLM_PROVIDER=custom LLM_BASE_URL=https://my-api.example.com/v1 LLM_API_KEY=sk-...
 */
// Providers whose servers are in jurisdictions without GDPR adequacy.
// Using these with EU/UK user data requires explicit safeguards.
const CHINA_PROVIDERS = new Set(['deepseek', 'qwen', 'moonshot', 'zhipu', 'yi', 'baichuan']);

class MultiProviderLLM {
  constructor() {
    this.provider = (process.env.LLM_PROVIDER || 'openai').toLowerCase();
    this.model = process.env.LLM_MODEL || this.getDefaultModel();

    // COMPLIANCE: Warn if a China-based provider is used in production
    if (CHINA_PROVIDERS.has(this.provider) && process.env.NODE_ENV === 'production') {
      logger.warn(
        `LLM provider "${this.provider}" routes data to servers outside GDPR-adequate jurisdictions. ` +
        `Ensure appropriate safeguards (DPA, SCCs) are in place, or restrict to non-EU users.`
      );
    }

    this.client = this.initializeProvider();
    logger.info(`LLM Provider initialized: ${this.provider} with model ${this.model}`);
  }

  /** Look up the default model for the configured provider. */
  getDefaultModel() {
    const config = OPENAI_COMPATIBLE_PROVIDERS[this.provider];
    return config?.defaultModel || 'gpt-4o-2024-08-06';
  }

  initializeProvider() {
    // Check if this is an OpenAI-compatible provider (includes Chinese models)
    if (OPENAI_COMPATIBLE_PROVIDERS[this.provider]) {
      return this.initializeOpenAICompatible(this.provider);
    }

    // Custom provider with explicit base URL
    if (this.provider === 'custom') {
      return this.initializeCustom();
    }

    // Non-OpenAI-compatible providers with their own SDKs
    switch (this.provider) {
      case 'gemini':
        return this.initializeGemini();
      case 'anthropic':
        return this.initializeAnthropic();
      default:
        logger.warn(`Unknown provider: ${this.provider}, falling back to OpenAI`);
        this.provider = 'openai';
        return this.initializeOpenAICompatible('openai');
    }
  }

  /**
   * Initialize any OpenAI-compatible provider (OpenAI, DeepSeek, Qwen, etc.).
   * They all use the same SDK — only the baseURL and API key differ.
   */
  initializeOpenAICompatible(providerName) {
    const OpenAI = require('openai');
    const config = OPENAI_COMPATIBLE_PROVIDERS[providerName];

    const apiKey = process.env[config.envKey];
    if (!apiKey) {
      logger.warn(`${config.envKey} not set for provider "${providerName}". LLM calls will fail.`);
    }

    const options = {
      apiKey,
      timeout: 45000,
      maxRetries: 0,
    };

    // Only set baseURL if non-default (OpenAI SDK uses its own default)
    if (config.baseURL) {
      options.baseURL = config.baseURL;
    }

    // Allow env override for any provider's base URL
    if (process.env.LLM_BASE_URL) {
      options.baseURL = process.env.LLM_BASE_URL;
    }

    return new OpenAI(options);
  }

  /**
   * Fully custom provider: user supplies LLM_BASE_URL + LLM_API_KEY.
   * Useful for self-hosted models (vLLM, Ollama, LocalAI, etc.).
   */
  initializeCustom() {
    const OpenAI = require('openai');
    const baseURL = process.env.LLM_BASE_URL;
    const apiKey = process.env.LLM_API_KEY || 'not-needed';

    if (!baseURL) {
      throw new Error('LLM_PROVIDER=custom requires LLM_BASE_URL to be set');
    }

    logger.info(`Custom LLM provider: ${baseURL}`);
    return new OpenAI({ apiKey, baseURL, timeout: 45000, maxRetries: 0 });
  }

  initializeGemini() {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

    const modelName = this.model.replace('gemini/', '') || 'gemini-pro';
    const model = genAI.getGenerativeModel({ model: modelName });

    // Return wrapper with OpenAI-compatible interface
    return {
      chat: {
        completions: {
          create: async (params) => {
            try {
              const messages = params.messages || [];
              const systemMessage = messages.find(m => m.role === 'system');
              const userMessages = messages.filter(m => m.role !== 'system');

              const prompt = userMessages.map(m => m.content).join('\n\n');
              const fullPrompt = systemMessage
                ? `${systemMessage.content}\n\n${prompt}`
                : prompt;

              const result = await model.generateContent(fullPrompt);
              const response = await result.response;
              const text = response.text();

              return {
                choices: [{
                  message: { role: 'assistant', content: text },
                  finish_reason: 'stop'
                }],
                usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
                model: modelName,
                provider: 'gemini'
              };
            } catch (error) {
              logger.error('Gemini API error:', error);
              throw error;
            }
          }
        }
      }
    };
  }

  initializeAnthropic() {
    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    const modelName = this.model.replace('anthropic/', '') || 'claude-3-sonnet-20240229';

    return {
      chat: {
        completions: {
          create: async (params) => {
            try {
              const messages = params.messages || [];
              const systemMessage = messages.find(m => m.role === 'system');
              const userMessages = messages.filter(m => m.role !== 'system');

              const response = await anthropic.messages.create({
                model: modelName,
                max_tokens: params.max_tokens || 1000,
                system: systemMessage?.content || '',
                messages: userMessages,
                temperature: params.temperature || 0.7
              });

              return {
                choices: [{
                  message: { role: 'assistant', content: response.content[0].text },
                  finish_reason: response.stop_reason
                }],
                usage: {
                  prompt_tokens: response.usage.input_tokens,
                  completion_tokens: response.usage.output_tokens,
                  total_tokens: response.usage.input_tokens + response.usage.output_tokens
                },
                model: modelName,
                provider: 'anthropic'
              };
            } catch (error) {
              logger.error('Anthropic API error:', error);
              throw error;
            }
          }
        }
      }
    };
  }

  // OpenAI-compatible interface — all callers use this
  get chat() {
    return this.client.chat;
  }

  /** Current provider metadata. */
  getProviderInfo() {
    return {
      provider: this.provider,
      model: this.model,
      supportedProviders: [
        ...Object.keys(OPENAI_COMPATIBLE_PROVIDERS),
        'gemini', 'anthropic', 'custom'
      ]
    };
  }
}

module.exports = MultiProviderLLM;
