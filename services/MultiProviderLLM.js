// services/MultiProviderLLM.js
// Simple wrapper to use different LLM providers with OpenAI-compatible interface
// No external dependencies needed beyond provider SDKs!

const logger = require('../utils/logger');

/**
 * Multi-Provider LLM Wrapper
 * Provides OpenAI-compatible interface for multiple providers
 */
class MultiProviderLLM {
  constructor() {
    this.provider = (process.env.LLM_PROVIDER || 'openai').toLowerCase();
    this.model = require('./llmConfig').DEFAULT_LLM_MODEL;
    this.client = this.initializeProvider();
    
    logger.info(`LLM Provider initialized: ${this.provider} with model ${this.model}`);
  }

  initializeProvider() {
    switch (this.provider) {
      case 'openai':
        return this.initializeOpenAI();
      
      case 'gemini':
        return this.initializeGemini();
      
      case 'anthropic':
        return this.initializeAnthropic();
      
      default:
        logger.warn(`Unknown provider: ${this.provider}, falling back to OpenAI`);
        this.provider = 'openai';
        return this.initializeOpenAI();
    }
  }

  initializeOpenAI() {
    const OpenAI = require('openai');
    return new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: 45000,
      maxRetries: 0
    });
  }

  initializeGemini() {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    
    // Return wrapper with OpenAI-compatible interface
    const modelName = this.model.replace('gemini/', '') || 'gemini-pro';
    const model = genAI.getGenerativeModel({ model: modelName });
    
    return {
      chat: {
        completions: {
          create: async (params) => {
            try {
              // Convert OpenAI format to Gemini format
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

              // Return OpenAI-compatible format
              return {
                choices: [{
                  message: {
                    role: 'assistant',
                    content: text
                  },
                  finish_reason: 'stop'
                }],
                usage: {
                  prompt_tokens: 0,
                  completion_tokens: 0,
                  total_tokens: 0
                },
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
              // Convert OpenAI format to Anthropic format
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

              // Return OpenAI-compatible format
              return {
                choices: [{
                  message: {
                    role: 'assistant',
                    content: response.content[0].text
                  },
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

  // OpenAI-compatible interface
  get chat() {
    return this.client.chat;
  }

  // Helper to get current provider info
  getProviderInfo() {
    return {
      provider: this.provider,
      model: this.model
    };
  }
}

module.exports = MultiProviderLLM;
