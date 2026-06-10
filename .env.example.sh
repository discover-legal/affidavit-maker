# .env.example — complete environment variables template (development)
#
# Copy to `.env.local` and fill in the values; `.env.local` is git-ignored.
# Production values live in the Render dashboard (or render.yaml for
# non-sensitive ones).

# ===========================
# SERVER CONFIGURATION
# ===========================
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug

# ===========================
# DATABASE CONFIGURATION
# ===========================
DATABASE_URL=postgresql://username:password@localhost:5432/affidavit_db
DATABASE_POOL_MAX=20
# Statement-level cap (ms). Defense-in-depth DoS bound.
DATABASE_STATEMENT_TIMEOUT_MS=30000
# Paste the Render-supplied CA PEM here (BEGIN CERTIFICATE…END CERTIFICATE)
# to enable certificate verification on the Postgres TLS connection.
# Without it: in production we still require TLS but fall back to the
# container's system trust store. NEVER set DATABASE_SSL_INSECURE=true
# in production unless you understand the MITM risk.
# DATABASE_CA_CERT=-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----
# DATABASE_SSL_INSECURE=false

# ===========================
# EDGE / PROXY CONFIGURATION
# ===========================
# Number of trusted hops in front of the app. Render = 1. Cloudflare in
# front of Render = 2. Used by lib/util/clientIp.ts to pick the trusted
# X-Forwarded-For entry from the right.
TRUSTED_PROXY_HOPS=1
# Hard ceiling on /api/* request bodies (bytes). Larger than the 10 MB
# evidence upload limit so multipart framing fits.
API_MAX_BODY_BYTES=26214400

# ===========================
# AUTH0 CONFIGURATION (@auth0/nextjs-auth0 v3)
# ===========================
# 32 random bytes hex: openssl rand -hex 32
AUTH0_SECRET=
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://your-tenant.auth0.com
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=
AUTH0_AUDIENCE=
AUTH0_WEBHOOK_SECRET=

# Cookie hardening (v3 SDK reads these env vars directly)
AUTH0_SESSION_COOKIE_SAME_SITE=lax
AUTH0_SESSION_COOKIE_SECURE=true
AUTH0_SESSION_COOKIE_HTTP_ONLY=true
AUTH0_SESSION_ABSOLUTE_DURATION=86400
AUTH0_SESSION_ROLLING_DURATION=3600

# Exposed to the client bundle
NEXT_PUBLIC_AUTH0_DOMAIN=your-tenant.auth0.com
NEXT_PUBLIC_AUTH0_CLIENT_ID=

# ===========================
# OPENAI / LLM
# ===========================
OPENAI_API_KEY=sk-your-api-key
LLM_PROVIDER=openai
LLM_MODEL=gpt-5.5
OPENAI_MAX_TOKENS=2000
OPENAI_TEMPERATURE=0.3

# ===========================
# STRIPE
# ===========================
STRIPE_SECRET_KEY=sk_test_your_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_key

# ===========================
# FILE STORAGE
# ===========================
DOCUMENTS_PATH=./documents
MAX_FILE_SIZE=10485760

# ===========================
# FEATURE FLAGS
# ===========================
ENABLE_INTERNATIONAL=false
ENABLE_WEBHOOKS=true
ENABLE_ANALYTICS=true
ENABLE_EMAIL_NOTIFICATIONS=false
MAINTENANCE_MODE=false
