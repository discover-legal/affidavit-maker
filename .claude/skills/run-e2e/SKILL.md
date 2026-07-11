---
name: run-e2e
description: Spin up the app locally (local Postgres, no Auth0/OpenAI credentials) and drive it end-to-end with Playwright — the divorce interview, life-story profile, court-paper ingestion, and PDF generation. Use when asked to run the app, verify a change live, or reproduce an interview flow.
---

# Run the app locally and drive it with Playwright

Verified cold-start recipe from a Linux container (root, Postgres 16 and
Playwright's Chromium preinstalled at `/opt/pw-browsers/chromium`). No
Auth0 tenant, OpenAI key, or Stripe key needed: an isolated git worktree
carries E2E-only patches (auth bypass, deterministic scripted LLM, dev
CSP) that are **never committed**.

## 1. Local Postgres (once per container)

```bash
export PATH=$PATH:/usr/lib/postgresql/16/bin
id postgres >/dev/null 2>&1 || useradd -m postgres
mkdir -p /tmp/pgdata /tmp/pgsock && chown -R postgres:postgres /tmp/pgdata /tmp/pgsock
su postgres -c "initdb -D /tmp/pgdata -A trust"
su postgres -c "pg_ctl -D /tmp/pgdata -o '-k /tmp/pgsock -p 5433 -c listen_addresses=127.0.0.1' -l /tmp/pgdata/log start"
su postgres -c "psql -h 127.0.0.1 -p 5433 -c \"CREATE USER affidavit WITH PASSWORD 'affidavit';\" -c 'CREATE DATABASE affidavit_e2e OWNER affidavit;'"
```

Note: the data dir must NOT be under a root-only path — the postgres user
must be able to traverse it (`/tmp/pgdata` works; deep scratchpad paths
often don't).

## 2. Patched worktree + migrations

```bash
bash e2e/setup-worktree.sh /tmp/e2e-app
cd /tmp/e2e-app
DATABASE_URL=postgresql://affidavit:affidavit@127.0.0.1:5433/affidavit_e2e node scripts/migrate.js
```

`setup-worktree.sh` creates the worktree, symlinks `node_modules`, applies
the five patches (API auth bypass via `E2E_TEST_USER`, page-guard bypass,
client-shim fake user, unconditional fake LLM from `e2e/fakeLLM.js`,
dev-only `'unsafe-eval'` in CSP), and writes `.env.local`.

## 3. Start the app

```bash
cd /tmp/e2e-app && npm run dev -- -p 3100   # background it; wait for /api/health = 200
```

**Gotcha:** `global.__chatOrchestratorsPromise` and the services singleton
survive HMR by design — after editing anything the chat route wires up
(services, orchestrators, the fake LLM), RESTART the dev server; hot
reload is not enough.

## 4. Drive it

```bash
mkdir -p /tmp/e2e-app/e2e/shots
cd /tmp/e2e-app/e2e && npm init -y >/dev/null && npm i playwright-core >/dev/null
node drive.mjs
```

`e2e/drive.mjs` (copied into the worktree by setup) resets the test
user's data, then asserts 11 checks: empty profile → scripted divorce
interview (including the "you forgot Ava" children-merge repro) → fresh
browser context re-login memory → Fix-my-story PATCH → court-paper
ingestion onto the timeline (TX 60-day earliest-decree note) → PDF
generation under `PAYMENTS_ENABLED=false`. Screenshots land in
`e2e/shots/`. Exit code 0 = all pass. **Look at the screenshots.**

The scripted turns live in `e2e/fakeLLM.js` — keyed on message text, one
child per turn on purpose. Extend both files together when covering new
flows.

Driver gotchas already handled in `drive.mjs`: launch Chromium with
`--no-proxy-server` (the container proxy breaks localhost), seed
`localStorage['tos_accepted_auth0|e2etester']` to skip the TOS modal, and
retry the Texas click until the chat input appears (hydration race).

## 5. Cleanup

```bash
pkill -f next-server; git worktree remove --force /tmp/e2e-app
su postgres -c "pg_ctl -D /tmp/pgdata stop"   # optional; data persists for reruns
```
