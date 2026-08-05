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
  // TOS state is server-verified now — acceptTos() below establishes it via
  // the real endpoints; no client-storage seeding is possible or needed.
  return browser.newContext({ viewport: { width: 1280, height: 900 } });
}

// Accept the current Terms of Service for the E2E user. withAuth 403s every
// authed endpoint (except the two TOS routes) until this has happened.
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
  await acceptTos(page);
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
  const emptyVisible = await page
    .getByText(/story hasn.t started yet/)
    .waitFor({ timeout: 15000 })
    .then(() => true)
    .catch(() => false);
  ok('profile shows empty state before any conversation', emptyVisible);
  await page.screenshot({ path: `${SHOTS}/1-profile-empty.png`, fullPage: true });

  // ── 2. Divorce interview — the children-merge repro, live ────────────────
  await page.goto(`${BASE}/editor/new?type=divorce_package&caseType=family`);
  await page.waitForLoadState('networkidle');
  // Hydration race: keep clicking Utah (our primary launch jurisdiction)
  // until the chat input materializes.
  for (let i = 0; i < 10; i++) {
    await page.getByRole('button', { name: /Utah/ }).first().click().catch(() => {});
    const appeared = await page
      .waitForSelector('input[placeholder="Type your message..."]', { timeout: 2000 })
      .then(() => true)
      .catch(() => false);
    if (appeared) break;
  }
  await page.waitForSelector('input[placeholder="Type your message..."]');

  await sendChat(page, 'Hi, my name is Brandon Pritchard.');
  await sendChat(page, 'My spouse is Alex Pritchard.');
  await sendChat(page, 'We live in Salt Lake County and have for six years.');
  await sendChat(page, 'We were married on May 1, 2010 in Salt Lake City, and separated November 15, 2024.');
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
    .getByPlaceholder(/Paste the document/)
    .fill(
      'Case No. 260900001. Petition for Divorce filed June 20, 2026 in Salt Lake County, Utah. The Petition and Summons were served on Respondent June 28, 2026. Petitioner asks the court to divide the marital estate.',
    );
  await page.getByRole('button', { name: 'Read this document' }).click();
  await page.waitForSelector('text=/added .* to your timeline/', { timeout: 30000 });
  await page.waitForTimeout(800);
  const afterIngest = await page.textContent('main');
  ok('ingested events land on the timeline', afterIngest.includes('Filed') && afterIngest.includes('Served'));
  ok('waiting-period note appears (UT 30 days)', /30-day waiting period/.test(afterIngest));
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

  // ── 8. Serve-the-papers walkthrough page ─────────────────────────────────
  await page.goto(`${BASE}/serve?state=UT`);
  await page.waitForLoadState('networkidle');
  const serveText = await page.textContent('main');
  ok(
    'serve page renders the walkthrough',
    serveText.includes('Serving the papers') && serveText.includes('Ways to serve'),
  );
  await page.screenshot({ path: `${SHOTS}/5-serve.png`, fullPage: true });

  // ── 9. Utah supporting documents: list + PDF render ─────────────────────
  const support = await page.evaluate(async () => {
    const listRes = await fetch('/api/documents/support?state=UT');
    const list = await listRes.json();
    const pdfRes = await fetch('/api/documents/support', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind: 'financial_declaration', state: 'UT' }),
    });
    const buf = new Uint8Array(await pdfRes.arrayBuffer());
    return {
      kinds: (list?.data?.kinds ?? []).map((k) => k.key),
      status: pdfRes.status,
      type: pdfRes.headers.get('content-type'),
      bytes: buf.length,
      magic: String.fromCharCode(...buf.slice(0, 5)),
    };
  });
  ok(
    'support-doc catalog lists all 9 Utah kinds',
    support.kinds.length >= 9 &&
      ['financial_declaration', 'answer', 'fee_waiver_motion', 'lawyer_handoff', 'child_support_worksheet'].every(
        (k) => support.kinds.includes(k),
      ),
    support.kinds.join(','),
  );
  ok(
    'financial declaration renders as a real PDF from the profile',
    support.status === 200 && String(support.type).includes('pdf') && support.magic === '%PDF-',
    `status=${support.status} bytes=${support.bytes}`,
  );

  // ── 10. Respondent flow: /respond page + Answer PDF with positions ──────
  await page.goto(`${BASE}/respond`);
  await page.waitForLoadState('networkidle');
  const respondText = await page.textContent('main');
  ok(
    'respond page renders (advisor note + position builder)',
    /you were served/i.test(respondText) && /admit/i.test(respondText),
  );
  await page.screenshot({ path: `${SHOTS}/6-respond.png`, fullPage: true });

  const answer = await page.evaluate(async () => {
    const res = await fetch('/api/documents/support', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        kind: 'answer',
        state: 'UT',
        signatureStyle: 'unsworn',
        extra: {
          role: 'respondent',
          answerPositions: [
            { paragraph: 1, position: 'admit' },
            { paragraph: 2, position: 'deny' },
            { paragraph: 3, position: 'lack_knowledge' },
          ],
          answerRequests: ['that the court divide the property fairly'],
          includeCounterclaim: false,
        },
      }),
    });
    const buf = new Uint8Array(await res.arrayBuffer());
    return { status: res.status, magic: String.fromCharCode(...buf.slice(0, 5)), bytes: buf.length };
  });
  ok(
    'answer PDF renders from admit/deny positions',
    answer.status === 200 && answer.magic === '%PDF-',
    `status=${answer.status} bytes=${answer.bytes}`,
  );

  // ── 11. Lawyer handoff (state-agnostic) + fee waiver (UT) ────────────────
  const extraDocs = await page.evaluate(async () => {
    const out = {};
    for (const [name, body] of [
      ['handoff', { kind: 'lawyer_handoff', state: 'UT' }],
      ['feeWaiver', { kind: 'fee_waiver_motion', state: 'UT' }],
      ['worksheet', { kind: 'child_support_worksheet', state: 'UT' }],
    ]) {
      const res = await fetch('/api/documents/support', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const buf = new Uint8Array(await res.arrayBuffer());
      out[name] = { status: res.status, magic: String.fromCharCode(...buf.slice(0, 5)) };
    }
    return out;
  });
  ok(
    'lawyer handoff (any state), fee waiver + support worksheet (UT) all render',
    ['handoff', 'feeWaiver', 'worksheet'].every(
      (k) => extraDocs[k].status === 200 && extraDocs[k].magic === '%PDF-',
    ),
    `handoff=${extraDocs.handoff.status} feeWaiver=${extraDocs.feeWaiver.status} worksheet=${extraDocs.worksheet.status}`,
  );

  // ── 12. Hearing prep page ────────────────────────────────────────────────
  await page.goto(`${BASE}/hearing`);
  await page.waitForLoadState('networkidle');
  const hearingText = await page.textContent('main');
  ok(
    'hearing page renders (day in court + practice questions)',
    /day in court/i.test(hearingText) && /practice/i.test(hearingText),
  );
  await page.screenshot({ path: `${SHOTS}/7-hearing.png`, fullPage: true });

  // ── 13. Filing packet: merged PDF for the saved document ────────────────
  const packet = await page.evaluate(async () => {
    const docs = (await fetch('/api/documents').then((r) => r.json())).data.documents;
    const res = await fetch('/api/documents/packet', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentId: docs[0].id }),
    });
    const buf = new Uint8Array(await res.arrayBuffer());
    return { status: res.status, magic: String.fromCharCode(...buf.slice(0, 5)), bytes: buf.length };
  });
  ok(
    'filing packet assembles as a real PDF',
    packet.status === 200 && packet.magic === '%PDF-',
    `status=${packet.status} bytes=${packet.bytes}`,
  );

  // ── 14. Profile: papers panel + dashboard entry points ──────────────────
  await page.goto(`${BASE}/profile`);
  await page.waitForLoadState('networkidle');
  const profileText2 = await page.textContent('main');
  ok('papers panel lists creatable documents on the profile', /Papers you can create/i.test(profileText2));
  await page.goto(`${BASE}/dashboard`);
  await page.waitForLoadState('networkidle');
  const dashText = await page.textContent('main');
  ok('dashboard links the hearing-prep page', /day in court/i.test(dashText));
  await page.screenshot({ path: `${SHOTS}/8-dashboard.png`, fullPage: true });
} catch (err) {
  ok('driver completed without exception', false, err.message);
} finally {
  console.log('\nSummary:', results.filter((r) => r.pass).length, 'passed /', results.length);
  await browser.close();
  process.exit(results.every((r) => r.pass) ? 0 : 1);
}
