# .env.example - Environment variables template for Affidavit Maker
# Copy this file to .env and fill in real values.

# ===========================
# SERVER CONFIGURATION
# ===========================
NODE_ENV=development
PORT=3001
LOG_LEVEL=info

# ===========================
# DATABASE CONFIGURATION
# ===========================
DATABASE_URL=postgresql://username:password@localhost:5432/affidavit_db
DATABASE_POOL_MAX=20

# ===========================
# AUTH0 CONFIGURATION
# ===========================
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_ISSUER_BASE_URL=https://your-tenant.auth0.com
AUTH0_CLIENT_ID=your_client_id
AUTH0_CLIENT_SECRET=your_client_secret
AUTH0_AUDIENCE=https://your-api-identifier
AUTH0_WEBHOOK_SECRET=whsec_your_auth0_webhook_secret

# ===========================
# LLM PROVIDER CONFIGURATION
# ===========================
# Supported providers: openai, anthropic, gemini, mistral, groq, together,
#   perplexity, fireworks, xai, cohere, cerebras, sambanova,
#   deepseek, qwen, moonshot, zhipu, yi, baichuan, custom
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-2024-08-06

# Set the API key for your chosen provider:
OPENAI_API_KEY=sk-your-openai-key
# ANTHROPIC_API_KEY=sk-ant-your-key
# GEMINI_API_KEY=your-gemini-key
# MISTRAL_API_KEY=your-mistral-key
# GROQ_API_KEY=your-groq-key
# TOGETHER_API_KEY=your-together-key
# PERPLEXITY_API_KEY=your-perplexity-key
# FIREWORKS_API_KEY=your-fireworks-key
# XAI_API_KEY=your-xai-key
# COHERE_API_KEY=your-cohere-key
# CEREBRAS_API_KEY=your-cerebras-key
# SAMBANOVA_API_KEY=your-sambanova-key
# DEEPSEEK_API_KEY=your-deepseek-key
# QWEN_API_KEY=your-qwen-key
# MOONSHOT_API_KEY=your-moonshot-key
# ZHIPU_API_KEY=your-zhipu-key
# YI_API_KEY=your-yi-key
# BAICHUAN_API_KEY=your-baichuan-key

# For custom/self-hosted providers (LLM_PROVIDER=custom):
# LLM_BASE_URL=https://my-api.example.com/v1
# LLM_API_KEY=your-custom-key

# ===========================
# STRIPE CONFIGURATION
# ===========================
STRIPE_SECRET_KEY=sk_test_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# ===========================
# FRONTEND CONFIGURATION
# ===========================
FRONTEND_URL=http://localhost:3000

# ===========================
# FILE STORAGE
# ===========================
# Override the default evidence storage directory (default: ./documents/evidence)
# EVIDENCE_STORAGE_PATH=./documents/evidence

# ===========================
# FEATURE FLAGS
# ===========================
# Set to true to activate ~110 international jurisdictions (default: US + Canada only)
ENABLE_INTERNATIONAL=false
