#!/usr/bin/env bash
# Build a throwaway git worktree with the E2E-only patches applied.
# The patches (auth bypass, fake LLM, dev CSP) exist ONLY in the worktree —
# never commit them. See .claude/skills/run-e2e/SKILL.md for the full recipe.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
W="${1:-/tmp/e2e-app}"

git worktree remove --force "$W" 2>/dev/null || true
git worktree add "$W" HEAD
# Hardlink copy, NOT a symlink: turbopack refuses a node_modules symlink
# that points outside its project root ("points out of the filesystem
# root"), which broke the CI e2e job. cp -al is near-free (hardlinks).
rm -rf "$W/node_modules"
cp -al "$REPO_ROOT/node_modules" "$W/node_modules"
mkdir -p "$W/e2e" /tmp/e2e-docs
cp "$REPO_ROOT/e2e/fakeLLM.js" "$W/e2e/fakeLLM.js"
cp "$REPO_ROOT/e2e/drive.mjs" "$W/e2e/drive.mjs"
cp "$REPO_ROOT/e2e/drive-real.mjs" "$W/e2e/drive-real.mjs" 2>/dev/null || true
cp "$REPO_ROOT/e2e/drive-real-matrix.mjs" "$W/e2e/drive-real-matrix.mjs" 2>/dev/null || true
cp "$REPO_ROOT/e2e/drive-real-messy.mjs" "$W/e2e/drive-real-messy.mjs" 2>/dev/null || true
cp "$REPO_ROOT/e2e/sweep-jurisdictions.mjs" "$W/e2e/sweep-jurisdictions.mjs" 2>/dev/null || true

python3 - "$W" <<'EOF'
import sys
W = sys.argv[1]

def patch(path, old, new, count=1):
    p = f'{W}/{path}'
    s = open(p).read()
    assert s.count(old) == count, f'{path}: anchor not found'
    open(p, 'w').write(s.replace(old, new))
    print('patched', path)

# Patches 1-3 and 5 from earlier revisions are gone: the platform now has
# native, production-gated E2E support (lib/auth.ts getE2ETestSession +
# proxy.ts /auth/profile stub, both behind E2E_AUTH_BYPASS=1 and
# NODE_ENV!==production), and next dev adds 'unsafe-eval' to the CSP itself.
# Only the deterministic scripted LLM still needs a worktree-only patch.

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

# E2E_INTERNATIONAL=1 activates the ~110 international jurisdictions
# (required by e2e/drive-real-matrix.mjs's SG leg). Default unchanged: false.
if [ "${E2E_INTERNATIONAL:-0}" = "1" ]; then
  INTL=true
else
  INTL=false
fi

cat > "$W/.env.local" <<ENV
DATABASE_URL=postgresql://affidavit:affidavit@127.0.0.1:5433/affidavit_e2e
AUTH0_SECRET=e2e0000000000000000000000000000000000000000000000000000000000000
AUTH0_BASE_URL=http://localhost:3100
AUTH0_ISSUER_BASE_URL=https://e2e.invalid
AUTH0_CLIENT_ID=e2e
AUTH0_CLIENT_SECRET=e2e
E2E_AUTH_BYPASS=1
E2E_FAKE_LLM=$FAKE
PAYMENTS_ENABLED=false
ENABLE_INTERNATIONAL=$INTL
# No jurisdiction picker in the UI: the single active jurisdiction is set
# automatically. E2E_JURISDICTIONS overrides (empty = full default set).
JURISDICTION_ALLOWLIST=${E2E_JURISDICTIONS-UT}
DOCUMENTS_PATH=/tmp/e2e-docs
$KEY_LINES
ENV

echo "Worktree ready at $W"
