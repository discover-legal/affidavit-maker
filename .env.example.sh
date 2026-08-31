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
# Production fails closed unless one of these out-of-band trust anchors is
# configured. Prefer the CA PEM; use a SHA-256 leaf fingerprint only for a
# private/self-signed database whose CA is unavailable.
# DATABASE_CA_CERT=-----BEGIN CERTIFICATE-----\n...\n-----END CERTIFICATE-----
# DATABASE_CERT_SHA256=64_HEX_CHARACTERS_WITH_OR_WITHOUT_COLONS

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
# AUTH0 CONFIGURATION (@auth0/nextjs-auth0 v4)
# ===========================
# 32 random bytes hex: openssl rand -hex 32
AUTH0_SECRET=
AUTH0_BASE_URL=http://localhost:3000
AUTH0_ISSUER_BASE_URL=https://your-tenant.auth0.com
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=
AUTH0_AUDIENCE=
AUTH0_WEBHOOK_SECRET=

# v4-native names (optional — lib/auth0.ts falls back to the v3 names above)
# AUTH0_DOMAIN=your-tenant.auth0.com
# APP_BASE_URL=http://localhost:3000

# Cookie hardening. NOTE: the SDK reads AUTH0_COOKIE_* (not
# AUTH0_SESSION_COOKIE_*); session durations are wired via lib/auth0.ts.
AUTH0_COOKIE_SAME_SITE=lax
AUTH0_COOKIE_SECURE=true
AUTH0_COOKIE_HTTP_ONLY=true
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
# Must be "test" with sk_test_/pk_test_ and "live" with sk_live_/pk_live_.
PAYMENTS_MODE=test

# ===========================
# FILE STORAGE
# ===========================
DOCUMENTS_PATH=./documents
MAX_FILE_SIZE=10485760
# Production sets this to true. Startup and readiness then require
# DOCUMENTS_PATH to be an actual mount point, not an ephemeral directory.
REQUIRE_PERSISTENT_STORAGE=false

# Optional operational integration. Do not claim it is active until its
# dead-man-switch receives a real test run.
CLEANUP_HEARTBEAT_URL=

# ===========================
# FEATURE FLAGS
# ===========================
ENABLE_INTERNATIONAL=false
# Narrow launch: comma-separated jurisdiction allowlist. When set, ONLY these
# codes surface (overrides ENABLE_INTERNATIONAL). Leave unset for the full
# NA (US 51 + CA 13) default. Currently launching ON + UT only.
JURISDICTION_ALLOWLIST=ON,UT
# The app is FREE (donation-supported) by default. Set to true to re-arm
# Stripe charging — the payment + webhook infra stays intact and dormant.
PAYMENTS_ENABLED=false
# "Buy us a coffee" link — coffee links render only when this is set.
NEXT_PUBLIC_DONATION_URL=
ENABLE_WEBHOOKS=true
ENABLE_ANALYTICS=true
ENABLE_EMAIL_NOTIFICATIONS=false
MAINTENANCE_MODE=false

# ===========================
# FIRM MODE (BigLaw integration)
# ===========================
# Set BOTH to turn this deployment into a law-firm client-intake portal
# (drafts route to the firm's BigLaw platform; clients get a "My Legal
# Profile" CRM surface). Leave unset for the pure self-rep product.
# Contract: docs/BIGLAW_INTEGRATION.md
BIGLAW_API_URL=
BIGLAW_INTAKE_SECRET=
BIGLAW_FIRM_NAME=
