# .env.example - Complete environment variables template

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
# Backend needs the domain with https:// prefix
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your_client_id
AUTH0_CLIENT_SECRET=your_client_secret
AUTH0_AUDIENCE=https://your-api-identifier

# ===========================
# OPENAI CONFIGURATION
# ===========================
OPENAI_API_KEY=sk-your-api-key
OPENAI_MODEL=gpt-4-turbo
OPENAI_MAX_TOKENS=2000
OPENAI_TEMPERATURE=0.3

# ===========================
# STRIPE CONFIGURATION
# ===========================
STRIPE_SECRET_KEY=sk_test_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# ===========================
# EMAIL CONFIGURATION (Optional)
# ===========================
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@affidavit-maker.com

# ===========================
# FRONTEND CONFIGURATION
# ===========================
FRONTEND_URL=http://localhost:3000

# ===========================
# SECURITY CONFIGURATION
# ===========================
SESSION_SECRET=your-session-secret-change-this-in-production
BCRYPT_ROUNDS=10
JWT_EXPIRES_IN=24h
TRUSTED_PROXIES=1

# ===========================
# RATE LIMITING
# ===========================
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_AUTH_ATTEMPTS=5

# ===========================
# FILE STORAGE
# ===========================
DOCUMENTS_PATH=./documents
MAX_FILE_SIZE=10485760

# ===========================
# FEATURE FLAGS
# ===========================
ENABLE_WEBHOOKS=true
ENABLE_EMAIL_NOTIFICATIONS=false
ENABLE_ANALYTICS=true
ENABLE_INTERNATIONAL=false
MAINTENANCE_MODE=false