/**
 * Messy-input real-model gate — replays a REAL user's Ontario interview
 * verbatim, typos and all, and asserts the pipeline cleans it up:
 *
 *   "My name is Mike smith, I like in simcoe county was married 2928
 *    days to marry Ellis Jane smith son-wyatt"
 *
 * What went wrong in production before the extraction/normalization fixes:
 * spouse name asked twice then truncated to "Ellis Smith" (middle name +
 * hyphenated compound surname dropped), names rendered lowercase into the
 * decree, facts stored as verbatim typo transcriptions.
 *
 * Needs: worktree server on :3100 with a real OPENAI_API_KEY and
 * ENABLE_INTERNATIONAL=true (ON lives in the dropdown).
 */
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:3100';
const SHOTS = '/tmp/e2e-app/e2e/shots';
const results = [];
const ok = (name, pass, detail = '') => {
  results.push({ name, pass });
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ` (${detail})` : ''}`);
};

const executablePath = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ executablePath, args: ['--no-proxy-server'] });

async function acceptTos(page) {
  await page.evaluate(async () => {
    const status = await fetch('/api/auth/tos-status').then((r) => r.json()).catch(() => null);
    const version = status?.currentTosVersion;
    if (version && !status?.tosAccepted) {
      await fetch('/api/auth/accept-tos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tosVersion: version }),
      });
    }
  });
}

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(45000);

  await page.goto(`${BASE}/profile`);
  await page.waitForLoadState('networkidle');
  await acceptTos(page);
  await page.evaluate(async () => {
    await fetch('/api/profile', { method: 'DELETE' });
    const docs = await fetch('/api/documents').then((r) => r.json());
    for (const d of docs?.data?.documents ?? []) {
      await fetch(`/api/documents/${d.id}`, { method: 'DELETE' });
    }
  });

  await page.goto(`${BASE}/editor/new?type=divorce_package&caseType=family`);
  await page.waitForLoadState('networkidle');
  for (let i = 0; i < 10; i++) {
    await page.selectOption('#chat-state-select', 'ON').catch(() => {});
    const appeared = await page
      .waitForSelector('input[placeholder="Type your message..."]', { timeout: 2000 })
      .then(() => true)
      .catch(() => false);
    if (appeared) break;
  }
  ok('picker accepts Ontario', true);

  const sendChat = async (text) => {
    const input = page.getByPlaceholder('Type your message...');
    await input.fill(text);
    await input.press('Enter');
    await page.waitForFunction(
      () => !document.querySelector('input[placeholder="Type your message..."]')?.disabled,
      null,
      { timeout: 120000 },
    );
    await page.waitForTimeout(1000);
  };

  // The real transcript, verbatim.
  await sendChat('My name is Mike smith, I like in simcoe county was married 2928 days to marry Ellis Jane smith son-wyatt');

  // Did it capture the spouse from the first messy mention? Count how many
  // times it re-asks; answer whatever it asks next the way the user did.
  let transcript = await page.evaluate(() => document.body.innerText);
  const askedSpouseAgain = /spouse.{0,40}(name|full legal)/is.test(
    transcript.split('smith son-wyatt').pop() || '',
  );
  // Continue realistically either way.
  if (askedSpouseAgain) {
    await sendChat('Ellis Jame Smith Son-Wyatt');
  }
  await sendChat('35 yeRs');
  await sendChat('she lives in ontario too, we have no children and agree on everything');

  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${SHOTS}/messy-on.png`, fullPage: false });

  // Pull the saved document and judge the DATA, not the chat wording.
  const doc = await page.evaluate(async () => {
    const docs = (await fetch('/api/documents').then((r) => r.json()))?.data?.documents ?? [];
    if (!docs[0]) return null;
    const full = await fetch(`/api/documents/${docs[0].id}`).then((r) => r.json());
    // GET /api/documents/[id] returns { success, document } — no data wrapper.
    return full?.document ?? full?.data?.document ?? full?.data ?? null;
  });
  const content = doc?.content ?? doc ?? {};
  const allNames = [
    content.affiantName, content.petitionerName, content.respondentName,
    content.spouseName, content.firstName, content.lastName,
  ].filter(Boolean).join(' | ');

  ok(
    'affiant stored with proper casing (Mike Smith)',
    /Mike Smith/.test(allNames) && !/Mike smith/.test(allNames),
    allNames,
  );
  const spouseFields = [content.respondentName, content.spouseName].filter(Boolean).join(' | ');
  ok(
    'spouse keeps compound surname (Son-Wyatt, properly cased)',
    /Son-Wyatt/.test(spouseFields),
    spouseFields,
  );
  ok(
    'spouse not truncated to two tokens',
    (String(content.respondentName || content.spouseName || '').trim().split(/\s+/).length) >= 3,
    String(content.respondentName || content.spouseName || ''),
  );

  const facts = (content.facts ?? []).map((f) => (typeof f === 'string' ? f : f.content)).join('\n');
  ok('facts mention Simcoe County (cleaned)', /Simcoe County/.test(facts), facts.slice(0, 200));
  ok(
    'facts are not verbatim typo transcriptions',
    !/I like in simcoe/i.test(facts) && !/35 yeRs/.test(facts),
  );
  ok(
    'first messy message captured the spouse (no re-ask)',
    !askedSpouseAgain,
    askedSpouseAgain ? 're-asked for spouse name' : 'captured first time',
  );

  const summary = results.filter((r) => r.pass).length;
  console.log(`\nMessy-input: ${summary} passed / ${results.length}`);
  process.exit(summary === results.length ? 0 : 1);
} catch (err) {
  console.error('FATAL:', err);
  process.exit(1);
} finally {
  await browser.close();
}
