# Multi-stage build for Next.js standalone output. Slim runtime image, no
# Chromium / Puppeteer (react-snap is gone) — Next handles SSG natively.

# ─── Stage 1: deps + build ────────────────────────────────────────────────────
FROM node:22-bullseye-slim AS builder

WORKDIR /app

# Build-time React/Next env vars baked into the client bundle.
ARG NEXT_PUBLIC_AUTH0_DOMAIN
ARG NEXT_PUBLIC_AUTH0_CLIENT_ID
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
ARG NEXT_PUBLIC_DONATION_URL
ARG NEXT_PUBLIC_BOOKING_URL
ENV NEXT_PUBLIC_AUTH0_DOMAIN=$NEXT_PUBLIC_AUTH0_DOMAIN \
    NEXT_PUBLIC_AUTH0_CLIENT_ID=$NEXT_PUBLIC_AUTH0_CLIENT_ID \
    NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY \
    NEXT_PUBLIC_DONATION_URL=$NEXT_PUBLIC_DONATION_URL \
    NEXT_PUBLIC_BOOKING_URL=$NEXT_PUBLIC_BOOKING_URL \
    NEXT_TELEMETRY_DISABLED=1

# Install deps from a clean lockfile.
COPY package*.json ./
RUN npm ci

# Copy the source and build the Next standalone bundle.
COPY . .
RUN npm run build

# ─── Stage 2: minimal runtime ─────────────────────────────────────────────────
FROM node:22-bullseye-slim AS runner

WORKDIR /app

ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Create non-root user. The entrypoint starts as root only long enough to
# validate/chown Render's runtime-mounted disk, then permanently drops to this
# account before starting application code.
RUN groupadd --system --gid 1001 nodejs \
 && useradd  --system --uid 1001 --gid nodejs nextjs

# Copy the standalone server output. The standalone bundle includes its own
# minimal node_modules — no need to install anything in the runtime image.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# The migration script runs as a Render preDeployCommand, so we copy it in too.
COPY --from=builder --chown=nextjs:nodejs /app/scripts ./scripts
COPY --from=builder --chown=nextjs:nodejs /app/migrations ./migrations

RUN chmod 0755 /app/scripts/docker-entrypoint.sh

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:' + (process.env.PORT || 3000) + '/api/ready', (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

ENTRYPOINT ["/app/scripts/docker-entrypoint.sh"]
CMD ["node", "server.js"]
