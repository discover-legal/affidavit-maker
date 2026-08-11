import { chromium } from 'playwright-core';

/**
 * REAL-MODEL release-gate pass. Same interview as drive.mjs but against the
 * actual LLM (worktree built with REAL_LLM=1 OPENAI_API_KEY=...), so
 * assertions allow natural response variance: they check what must be TRUE
 * about the data (all three children survive, marriage extracted, facts
 * carry provenance, PDF generates), never exact model wording.
 */

const BASE = 'http://localhost:3100';
const SHOTS = '/tmp/e2e-app/e2e/shots';
const results = [];
const ok = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ` (${detail})` : ''}`);
};

const executablePath = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ executablePath, args: ['--no-proxy-server'] });

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => {
    localStorage.setItem('tos_accepted_auth0|e2etester', 'true');
    sessionStorage.setItem('tos_accepted_auth0|e2etester', 'true');
  });
  const page = await ctx.newPage();
  page.setDefaultTimeout(45000);

  // Reset the test user so the run is repeatable.
  await page.goto(`${BASE}/profile`);
  await page.waitForLoadState('networkidle');
  await page.evaluate(async () => {
    await fetch('/api/profile', { method: 'DELETE' });
    const docs = await fetch('/api/documents').then((r) => r.json());
    for (const d of docs?.data?.documents ?? []) {
      await fetch(`/api/documents/${d.id}`, { method: 'DELETE' });
    }
  });

  // Interview — real model, so generous per-turn timeout.
  await page.goto(`${BASE}/editor/new?type=divorce_package&caseType=family`);
  await page.waitForLoadState('networkidle');
  for (let i = 0; i < 10; i++) {
    await page.getByRole('button', { name: /Utah/ }).first().click().catch(() => {});
    const appeared = await page
      .waitForSelector('input[placeholder="Type your message..."]', { timeout: 2000 })
      .then(() => true)
      .catch(() => false);
    if (appeared) break;
  }

  const sendChat = async (text) => {
    const input = page.getByPlaceholder('Type your message...');
    await input.fill(text);
    await input.press('Enter');
    await page.waitForFunction(
      () => !document.querySelector('input[placeholder="Type your message..."]')?.disabled,
      null,
      { timeout: 120000 },
    );
  };

  await sendChat('Hi, my name is Jordan Example. My spouse is Alex Example.');
  await sendChat('We live in Salt Lake County, Utah and have for six years.');
  await sendChat('We were married on May 1, 2010 in Salt Lake City, and separated November 15, 2024.');
  await sendChat('We have three kids. Our oldest is Emma, born April 2, 2015.');
  await sendChat('Then Liam, born June 15, 2017.');
  await sendChat('Wait — you forgot our youngest, Ava, born September 9, 2019.');
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SHOTS}/real-1-interview.png`, fullPage: true });

  const docState = await page.evaluate(async () => {
    const json = await fetch('/api/documents').then((r) => r.json());
    const doc = json.data.documents[0];
    return {
      children: doc.content?.children ?? [],
      facts: doc.facts ?? [],
      marriageDate: doc.content?.marriageDate ?? null,
      petitioner: doc.content?.petitionerName ?? doc.content?.affiantName ?? null,
    };
  });
  const names = docState.children.map((c) => String(c.name || '').toLowerCase());
  ok(
    'REAL MODEL: all three children survive the reminder turn',
    ['emma', 'liam', 'ava'].every((n) => names.some((x) => x.includes(n))),
    docState.children.map((c) => c.name).join(' | ') || 'none',
  );
  ok('REAL MODEL: marriage date extracted', Boolean(docState.marriageDate), String(docState.marriageDate));
  ok(
    'REAL MODEL: petitioner identified',
    /jordan/i.test(String(docState.petitioner)),
    String(docState.petitioner),
  );
  ok(
    'REAL MODEL: facts extracted with provenance quotes',
    docState.facts.length > 0 && docState.facts.some((f) => f.sourceQuote),
    `${docState.facts.length} facts`,
  );

  // Profile memory in a fresh context.
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx2.addInitScript(() => {
    localStorage.setItem('tos_accepted_auth0|e2etester', 'true');
  });
  const page2 = await ctx2.newPage();
  await page2.goto(`${BASE}/profile`);
  await page2.waitForLoadState('networkidle');
  await page2.waitForTimeout(1500);
  const story = await page2.textContent('main');
  ok(
    'REAL MODEL: re-login profile shows the family',
    ['Emma', 'Liam', 'Ava'].every((n) => story.includes(n)),
  );
  await page2.screenshot({ path: `${SHOTS}/real-2-profile.png`, fullPage: true });

  // Real-model ingest of a court paper.
  const ingest = await page2.evaluate(async () => {
    const res = await fetch('/api/profile/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: 'Case No. 260900001. Petition for Divorce filed June 20, 2026 in Salt Lake County, Utah. The Petition and Summons were served on Respondent on June 28, 2026. Petitioner asks the court to divide the marital estate.',
        label: 'Papers I was served',
      }),
    });
    return res.json();
  });
  ok(
    'REAL MODEL: court paper ingested into events + facts',
    Boolean(ingest?.success) && (ingest.data?.eventsAdded ?? 0) >= 1,
    JSON.stringify(ingest?.data ?? ingest?.error ?? ''),
  );

  // PDF still generates (payments off in this env).
  const gen = await page2.evaluate(async () => {
    const docs = (await fetch('/api/documents').then((r) => r.json())).data.documents;
    const doc = docs[0];
    const res = await fetch('/api/documents/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ affidavitData: { ...doc.content, documentId: doc.id }, documentId: doc.id }),
    });
    return { status: res.status, type: res.headers.get('content-type') };
  });
  ok(
    'REAL MODEL: PDF generates from the interview data',
    gen.status === 200 && String(gen.type).includes('pdf'),
    `status=${gen.status}`,
  );
} catch (err) {
  ok('driver completed without exception', false, err.message);
} finally {
  console.log('\nSummary:', results.filter((r) => r.pass).length, 'passed /', results.length);
  await browser.close();
  process.exit(results.every((r) => r.pass) ? 0 : 1);
}
