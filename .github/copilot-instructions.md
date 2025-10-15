## Copilot instructions (concise)

This project is a Node.js (CommonJS) Express backend with a React client in `client/`. Node >=18 is required. The server entrypoint is `server.js`.

Essential quick-read files:
- `server.js` — middleware order, service initialization, `safeImportRouter` and dev debug endpoints (`/api/debug/*`).
- `config/index.js` — required env vars (process exits if missing); do not bypass this.
- `services/DatabaseService.js` — singleton `dbService` (use `.query`, `.getClient`, `.transaction`).
- `templates/StateTemplateManager.js` — state templates and validation used in tests.

Key patterns to preserve:
- CommonJS modules (use `require`/`module.exports`).
- Attach shared services to `app.locals` (e.g., `app.locals.openAIService`, `app.locals.pool`).
- Route modules must export an Express Router or function — `safeImportRouter` will skip invalid exports and fall back to 503 handlers.
- Webhook routes rely on `req.rawBody` set by the JSON body parser `verify` option; keep that behavior.

Developer commands you will use:
- Start backend (dev): `npm run dev`
- Start frontend (dev): `npm run client`; run both: `npm run dev:full`
- Tests: `npm test` (Jest)
- Lint: `npm run lint`; Format: `npm run format`
- DB scripts: `npm run db:migrate` | `npm run db:seed` | `npm run db:cleanup`

LLM / OpenAI notes:
- LLM logic lives in `services/MultiProviderLLM.js` + `services/ResilientOpenAIService.js`. These implement retries, circuit-breakers and caching. Dev debug endpoints to inspect/reset breakers are mounted only in development.

When adding code:
- Add route files under `routes/` as Express routers. Keep them idempotent and avoid re-creating service singletons — use `app.locals`.
- New services belong in `services/` and should be initialized in `server.js` (or lazy required by routes) and added to `app.locals`.

Quick checks before PR:
- Run `npm test` — many template tests exist; ensure `templates/StateTemplateManager.js` exports match what tests expect.
- Don't alter `config/index.js` required-env behavior unless instructed.

If you want, I can expand this with small code examples (router template, service registration snippet) or diagnose the failing `StateTemplateManager` tests next.
