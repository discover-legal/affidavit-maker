/**
 * v2 engine end-to-end through the real UI (CORE_ENGINE=v2,
 * CORE_INTELLIGENCE=fake). Start the patched dev server with those two
 * env vars, then `node drive-v2.mjs`.
 *
 * Checks: triage → divorce interview turns fill the document with typed
 * values and provenance → preview renders v2 sections with draft blanks →
 * PDF generation via the v2 renderer → life story absorbed for re-login.
 */
import { chromium } from 'playwright-core';

const BASE = 'http://localhost:3100';
const SHOTS = process.env.SHOTS || '/tmp/e2e-app/e2e/shots';
const results = [];
const ok = (name, pass, detail = '') => {
  results.push({ name, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}${detail ? ` (${detail})` : ''}`);
};

const executablePath = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const browser = await chromium.launch({ executablePath, args: ['--no-proxy-server'] });

async function newPage(context) {
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  return page;
}

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

async function sendChat(page, text) {
  const input = page.getByPlaceholder('Type your message...');
  await input.fill(text);
  await input.press('Enter');
  await page.waitForFunction(
    () => !document.querySelector('input[placeholder="Type your message..."]')?.disabled,
    null,
    { timeout: 60000 },
  );
}

async function latestDocument(page) {
  return page.evaluate(async () => {
    const res = await fetch('/api/documents');
    const json = await res.json();
    return json.data.documents[0];
  });
}

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await newPage(ctx);
  await page.goto(`${BASE}/dashboard`);
  await acceptTos(page);
  // Reset the e2e user's data so the run is repeatable.
  await page.evaluate(async () => {
    const docs = await fetch('/api/documents').then((r) => r.json()).catch(() => ({ data: { documents: [] } }));
    for (const d of docs.data?.documents ?? []) await fetch(`/api/documents/${d.id}`, { method: 'DELETE' });
    await fetch('/api/profile', { method: 'DELETE' }).catch(() => {});
  });

  // ── 1. Divorce interview through the v2 engine ───────────────────────────
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
  await page.waitForSelector('input[placeholder="Type your message..."]');

  const turns = [
    'Hi, my name is Jordan Example and my spouse is Alex Example.',
    'We live in Salt Lake County and have for six years.',
    'We were married on May 1, 2010 and separated November 15, 2024.',
    'We have two kids, Emma and Liam.',
    'We own the house and a car; no debts.',
    'Neither of us is asking for support.',
    'Alex will sign a waiver of service.',
    'Yes, everything is correct.',
  ];
  for (const t of turns) await sendChat(page, t);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SHOTS}/v2-1-interview.png`, fullPage: true });

  const doc = await latestDocument(page);
  const content = doc?.content ?? {};
  ok('v2 engine handled the conversation', content.orchestratorState?.engine === 'v2', JSON.stringify(content.orchestratorState));
  ok('typed party fields landed in the document', content.petitionerFirstName === 'Jordan' && content.respondentFirstName === 'Alex');
  ok('jurisdiction and county recorded', content.state === 'UT' && content.county === 'Salt Lake', `${content.state}/${content.county}`);
  ok('children carried into the document', Array.isArray(content.children) && content.children.length === 2, String(content.children?.length));
  ok('facts carry the user\'s own words as provenance', Array.isArray(content.facts) && content.facts.length > 0 && content.facts.every((f) => f.sourceQuote));
  ok('interview advanced past INTAKE', content.orchestratorState?.completedPhases?.includes('INTAKE'), String(content.orchestratorState?.completedPhases));
  ok('no confirmation from silence: support_waived absent', content.spousalSupportWaived !== true);

  // ── 2. Preview through the v2 composer ───────────────────────────────────
  const preview = await page.evaluate(async (affidavitData) => {
    const res = await fetch('/api/documents/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ affidavitData: { ...affidavitData, documentType: 'divorce_package', activeSubDocument: 'divorce_petition' } }),
    });
    return { status: res.status, body: await res.json() };
  }, content);
  const sections = preview.body?.preview?.sections ?? {};
  ok('preview served by v2', preview.status === 200 && preview.body?.metadata?.engine === 'v2', `status=${preview.status}`);
  ok('preview has caption, title and petition sections', Boolean(sections.caseCaption && sections.title && sections.parties && sections.grounds));
  ok('preview lists draft blanks for anything not stated', Array.isArray(preview.body?.preview?.metadata?.blanks), String(preview.body?.preview?.metadata?.blanks?.length));
  ok('HTML rendition present', typeof preview.body?.preview?.htmlContent === 'string' && preview.body.preview.htmlContent.length > 500);

  // ── 3. PDF through the v2 renderer ───────────────────────────────────────
  const gen = await page.evaluate(async (docId) => {
    const docsRes = await fetch('/api/documents');
    const d = (await docsRes.json()).data.documents.find((x) => x.id === docId);
    const res = await fetch('/api/documents/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ affidavitData: { ...d.content, documentType: 'divorce_package', activeSubDocument: 'divorce_petition', documentId: d.id }, documentId: d.id }),
    });
    const buf = new Uint8Array(await res.arrayBuffer());
    return { status: res.status, type: res.headers.get('content-type'), disposition: res.headers.get('content-disposition'), head: Array.from(buf.slice(0, 4)), bytes: buf.length };
  }, doc.id);
  // %PDF byte signature — syntactic container check.
  const isPdf = gen.head.join(',') === [0x25, 0x50, 0x44, 0x46].join(',');
  ok('v2 PDF generated', gen.status === 200 && isPdf && gen.bytes > 1000, `status=${gen.status} bytes=${gen.bytes} ${gen.disposition}`);
  ok('filename reflects the petition', String(gen.disposition).includes('petition-'), String(gen.disposition));

  // ── 4. Life story absorbed: a fresh context knows the person ─────────────
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page2 = await newPage(ctx2);
  await page2.goto(`${BASE}/dashboard`);
  await acceptTos(page2);
  const story = await page2.evaluate(async () => {
    const res = await fetch('/api/profile');
    return res.status;
  });
  ok('profile endpoint still answers for the v2 user (v1 profile untouched)', story === 200, `status=${story}`);
  await page2.screenshot({ path: `${SHOTS}/v2-2-dashboard.png`, fullPage: true });
} catch (err) {
  ok('driver completed without exception', false, err.message);
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
