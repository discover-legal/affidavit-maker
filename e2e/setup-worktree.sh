#!/usr/bin/env bash
# Build a throwaway git worktree with the E2E-only patches applied.
# The patches (auth bypass, fake LLM, dev CSP) exist ONLY in the worktree —
# never commit them. See .claude/skills/run-e2e/SKILL.md for the full recipe.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
W="${1:-/tmp/e2e-app}"

git worktree remove --force "$W" 2>/dev/null || true
git worktree add "$W" HEAD
ln -sfn "$REPO_ROOT/node_modules" "$W/node_modules"
mkdir -p "$W/e2e" /tmp/e2e-docs
cp "$REPO_ROOT/e2e/fakeLLM.js" "$W/e2e/fakeLLM.js"
cp "$REPO_ROOT/e2e/drive.mjs" "$W/e2e/drive.mjs"
cp "$REPO_ROOT/e2e/drive-real.mjs" "$W/e2e/drive-real.mjs" 2>/dev/null || true

python3 - "$W" <<'EOF'
import sys
W = sys.argv[1]

def patch(path, old, new, count=1):
    p = f'{W}/{path}'
    s = open(p).read()
    assert s.count(old) == count, f'{path}: anchor not found'
    open(p, 'w').write(s.replace(old, new))
    print('patched', path)

# 1. API auth: fixed test identity instead of the Auth0 session.
patch('lib/auth.ts',
"""export async function getCurrentUser(): Promise<AppUser | null> {
  const session = await getSession();""",
"""export async function getCurrentUser(): Promise<AppUser | null> {
  // E2E-ONLY (local worktree, never committed): fixed test identity.
  if (process.env.E2E_TEST_USER === '1') {
    return withRLSBypass(async () => {
      const inserted = await query<UserRow>(
        `INSERT INTO users (auth0_id, email, name, email_verified, created_at, updated_at, last_login)
         VALUES ('auth0|e2etester', 'e2e@test.local', 'E2E Tester', true, NOW(), NOW(), NOW())
         ON CONFLICT (auth0_id) DO UPDATE SET last_login = NOW()
         RETURNING id, auth0_id, email, name`,
      );
      const row = inserted.rows[0];
      return { id: row.id, auth0Id: row.auth0_id, email: row.email, name: row.name };
    });
  }
  const session = await getSession();""")

patch('lib/api/auth.ts',
"""  return async (req: NextRequest, ctx: RouteContext<P>) => {
    const session = await getSession();
    if (!session?.user?.sub) {""",
"""  return async (req: NextRequest, ctx: RouteContext<P>) => {
    // E2E-ONLY (worktree): skip the Auth0 session check.
    const session = process.env.E2E_TEST_USER === '1'
      ? ({ user: { sub: 'auth0|e2etester' } } as Awaited<ReturnType<typeof getSession>>)
      : await getSession();
    if (!session?.user?.sub) {""")

# 2. Page guards: withPageAuthRequired becomes identity in E2E.
import glob
for p in glob.glob(f'{W}/app/(app)/**/page.tsx', recursive=True):
    s = open(p).read()
    if 'withPageAuthRequired' not in s:
        continue
    s = s.replace(
        "import { withPageAuthRequired } from '@auth0/nextjs-auth0';",
        "import { withPageAuthRequired as realGuard } from '@auth0/nextjs-auth0';\n"
        "// E2E-ONLY guard bypass\n"
        "const withPageAuthRequired: typeof realGuard =\n"
        "  process.env.E2E_BYPASS_AUTH === '1' ? ((fn: never) => fn) as unknown as typeof realGuard : realGuard;",
    )
    open(p, 'w').write(s)
    print('patched', p.replace(W + '/', ''))

# 3. Client shim: fake authenticated user (TOSGuard requires user.sub).
patch('lib/auth0-client.ts',
"""export function useAuth0() {
  const { user, error, isLoading } = useUser();
  const isAuthenticated = Boolean(user) && !isLoading;""",
"""export function useAuth0() {
  const { user: realUser, error, isLoading: realLoading } = useUser();
  // E2E-ONLY: full fake user so TOSGuard and the chat gate proceed.
  const e2e = process.env.NEXT_PUBLIC_E2E === '1';
  const user = e2e
    ? { sub: 'auth0|e2etester', email: 'e2e@test.local', name: 'E2E Tester' }
    : realUser;
  const isLoading = e2e ? false : realLoading;
  const isAuthenticated = e2e || (Boolean(user) && !isLoading);""")

# 4. Deterministic scripted LLM (must be unconditional — no API key means
#    the resilient-client branch never runs).
patch('lib/api/services.ts',
"""  if (resilientLLM) {
    (global as unknown as { openAIService?: unknown }).openAIService = resilientLLM;
    logger.info('llm_service_wired');
  }""",
"""  if (resilientLLM) {
    (global as unknown as { openAIService?: unknown }).openAIService = resilientLLM;
    logger.info('llm_service_wired');
  }
  // E2E-ONLY: deterministic scripted LLM (see e2e/fakeLLM.js).
  if (process.env.E2E_FAKE_LLM === '1') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const fake = require('@/e2e/fakeLLM');
    (global as unknown as { openAIService?: unknown }).openAIService = fake;
    logger.info('llm_service_wired_fake_e2e');
  }""")

# 5. CSP: next dev needs eval for source maps.
patch('next.config.mjs',
"""  'script-src': [
    "'self'",""",
"""  'script-src': [
    "'self'",
    // E2E-ONLY (worktree): next dev needs eval for source maps
    ...(process.env.E2E_BYPASS_AUTH === '1' ? ["'unsafe-eval'"] : []),""")
EOF

# REAL_LLM=1 (with OPENAI_API_KEY set) switches the worktree to the real
# model instead of the scripted fake — used for the release-gate pass
# driven by e2e/drive-real.mjs.
if [ "${REAL_LLM:-0}" = "1" ] && [ -n "${OPENAI_API_KEY:-}" ]; then
  FAKE=0
  KEY_LINES="OPENAI_API_KEY=${OPENAI_API_KEY}
LLM_PROVIDER=${LLM_PROVIDER:-openai}
LLM_MODEL=${LLM_MODEL:-gpt-5.5}"
else
  FAKE=1
  KEY_LINES=""
fi

cat > "$W/.env.local" <<ENV
DATABASE_URL=postgresql://affidavit:affidavit@127.0.0.1:5433/affidavit_e2e
AUTH0_SECRET=e2e0000000000000000000000000000000000000000000000000000000000000
AUTH0_BASE_URL=http://localhost:3100
AUTH0_ISSUER_BASE_URL=https://e2e.invalid
AUTH0_CLIENT_ID=e2e
AUTH0_CLIENT_SECRET=e2e
E2E_TEST_USER=1
E2E_BYPASS_AUTH=1
E2E_FAKE_LLM=$FAKE
NEXT_PUBLIC_E2E=1
PAYMENTS_ENABLED=false
ENABLE_INTERNATIONAL=false
DOCUMENTS_PATH=/tmp/e2e-docs
$KEY_LINES
ENV

echo "Worktree ready at $W"
