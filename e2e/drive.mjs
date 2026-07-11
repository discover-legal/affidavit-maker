import { chromium } from 'playwright-core';

const BASE = 'http://localhost:3100';
const SHOTS = '/tmp/e2e-app/e2e/shots';
const results = [];
const ok = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ` (${detail})` : ''}`);
};

// Chromium binary: CHROMIUM_PATH (set by CI from `npx playwright install`),
// falling back to the local container's preinstalled build.
const executablePath = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ executablePath, args: ['--no-proxy-server'] });

async function newPage(context) {
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  return page;
}
function seededContext() {
  return browser.newContext({ viewport: { width: 1280, height: 900 } }).then(async (ctx) => {
    await ctx.addInitScript(() => {
      // TOSGuard trusts these keys (user.sub is undefined in the E2E shim).
      localStorage.setItem('tos_accepted_auth0|e2etester', 'true');
      sessionStorage.setItem('tos_accepted_auth0|e2etester', 'true');
    });
    return ctx;
  });
}

async function sendChat(page, text) {
  const input = page.getByPlaceholder('Type your message...');
  await input.fill(text);
  await input.press('Enter');
  // Wait for the request to complete: input re-enables when isLoading clears.
  await page.waitForFunction(
    () => !document.querySelector('input[placeholder="Type your message..."]')?.disabled,
    null,
    { timeout: 45000 },
  );
}

try {
  // ── 1. Empty profile ─────────────────────────────────────────────────────
  const ctx1 = await seededContext();
  let page = await newPage(ctx1);
  await page.goto(`${BASE}/profile`);
  await page.waitForLoadState('networkidle');
  // Reset: erase the test user's story + documents so the run is repeatable.
  await page.evaluate(async () => {
    await fetch('/api/profile', { method: 'DELETE' });
    const docs = await fetch('/api/documents').then((r) => r.json());
    for (const d of docs?.data?.documents ?? []) {
      await fetch(`/api/documents/${d.id}`, { method: 'DELETE' });
    }
  });
  await page.reload();
  await page.waitForLoadState('networkidle');
  const emptyVisible = await page.getByText("Your story hasn't started yet").isVisible().catch(() => false);
  ok('profile shows empty state before any conversation', emptyVisible);
  await page.screenshot({ path: `${SHOTS}/1-profile-empty.png`, fullPage: true });

  // ── 2. Divorce interview — the children-merge repro, live ────────────────
  await page.goto(`${BASE}/editor/new?type=divorce_package&caseType=family`);
  await page.waitForLoadState('networkidle');
  // Hydration race: keep clicking Texas until the chat input materializes.
  for (let i = 0; i < 10; i++) {
    await page.getByRole('button', { name: /Texas/ }).first().click().catch(() => {});
    const appeared = await page
      .waitForSelector('input[placeholder="Type your message..."]', { timeout: 2000 })
      .then(() => true)
      .catch(() => false);
    if (appeared) break;
  }
  await page.waitForSelector('input[placeholder="Type your message..."]');

  await sendChat(page, 'Hi, my name is Brandon Pritchard.');
  await sendChat(page, 'My spouse is Alex Pritchard.');
  await sendChat(page, 'We live in Travis County and have for six years.');
  await sendChat(page, 'We were married on May 1, 2010 in Austin, and separated November 15, 2024.');
  await sendChat(page, 'Our oldest is Emma, born April 2, 2015.');
  await sendChat(page, 'Then Liam, born June 15, 2017.');
  await sendChat(page, 'Wait — you forgot our youngest, Ava, born September 9, 2019.');
  await page.waitForTimeout(1500); // let autosave settle
  await page.screenshot({ path: `${SHOTS}/2-interview.png`, fullPage: true });

  // The regression assertion: after the "you forgot Ava" turn, ALL THREE
  // children must be in the document state (pre-fix this collapsed to 1).
  const docState = await page.evaluate(async () => {
    const res = await fetch('/api/documents');
    const json = await res.json();
    const doc = json.data.documents[0];
    return { children: doc.content?.children ?? [], facts: doc.facts ?? [] };
  });
  const childNames = docState.children.map((c) => c.name).sort();
  ok(
    'reminder turn keeps all 3 children (original bug repro)',
    childNames.length === 3 && childNames.join(',').includes('Ava') && childNames.join(',').includes('Emma'),
    childNames.join(' | '),
  );
  ok('facts accumulated with provenance', docState.facts.some((f) => f.sourceQuote));

  // ── 3. Fresh context = "log back in" — profile must remember ────────────
  const ctx2 = await seededContext();
  page = await newPage(ctx2);
  await page.goto(`${BASE}/profile`);
  await page.waitForLoadState('networkidle');
  const storyText = await page.textContent('main');
  ok('re-login: profile knows the marriage', storyText.includes('May 1, 2010'));
  ok('re-login: all three children on the portrait', ['Emma', 'Liam', 'Ava'].every((n) => storyText.includes(n)));
  ok('re-login: custody on the ledger', /Joint/i.test(storyText));
  await page.screenshot({ path: `${SHOTS}/3-profile-story.png`, fullPage: true });

  // ── 4. Fix my story ──────────────────────────────────────────────────────
  await page.getByRole('button', { name: 'Fix my story' }).click();
  const nameInput = page.locator('label:has-text("Your name") input');
  await nameInput.fill('Brandon S. Pritchard');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);
  const afterEdit = await page.textContent('main');
  ok('fix-my-story edit persists via PATCH', afterEdit.includes('Brandon S. Pritchard'));

  // ── 5. Ingest a court paper → timeline events ────────────────────────────
  await page.getByRole('button', { name: 'Add a court paper' }).click();
  await page
    .getByPlaceholder("Paste the document's text here…")
    .fill(
      'CAUSE NO 26-1234. Original Petition for Divorce, filed June 20, 2026 in Travis County. Citation served on Respondent June 28, 2026. Petitioner asks the court to divide the marital estate.',
    );
  await page.getByRole('button', { name: 'Read this document' }).click();
  await page.waitForSelector('text=/added .* to your timeline/', { timeout: 30000 });
  await page.waitForTimeout(800);
  const afterIngest = await page.textContent('main');
  ok('ingested events land on the timeline', afterIngest.includes('Filed') && afterIngest.includes('Served'));
  ok('waiting-period note appears (TX 60 days)', /60-day waiting period/.test(afterIngest));
  await page.screenshot({ path: `${SHOTS}/4-profile-ingested.png`, fullPage: true });

  // ── 6. Payments kill-switch: generation is free ──────────────────────────
  const gen = await page.evaluate(async () => {
    const docsRes = await fetch('/api/documents');
    const docs = (await docsRes.json()).data.documents;
    const doc = docs[0];
    const res = await fetch('/api/documents/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ affidavitData: { ...doc.content, documentId: doc.id }, documentId: doc.id }),
    });
    return { status: res.status, type: res.headers.get('content-type') };
  });
  ok(
    'PAYMENTS_ENABLED=false: unpaid document generates a PDF',
    gen.status === 200 && String(gen.type).includes('pdf'),
    `status=${gen.status} type=${gen.type}`,
  );

  // ── 7. Missing documentId is rejected when payments are ON ───────────────
  // (kill-switch is off in this env, so expect the free path; assert the
  //  validation shape instead by omitting documentId — should still 200 here
  //  because payments are disabled, which is the documented behavior.)
  const noId = await page.evaluate(async () => {
    const docsRes = await fetch('/api/documents');
    const doc = (await docsRes.json()).data.documents[0];
    const res = await fetch('/api/documents/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ affidavitData: { ...doc.content } }),
    });
    return res.status;
  });
  ok('no-documentId behavior matches kill-switch spec (200 when payments off)', noId === 200, `status=${noId}`);
} catch (err) {
  ok('driver completed without exception', false, err.message);
} finally {
  console.log('\nSummary:', results.filter((r) => r.pass).length, 'passed /', results.length);
  await browser.close();
  process.exit(results.every((r) => r.pass) ? 0 : 1);
}
