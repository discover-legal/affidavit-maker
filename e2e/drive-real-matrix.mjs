import { chromium } from 'playwright-core';

/**
 * REAL-MODEL multi-jurisdiction release gate. Runs a short live-LLM divorce
 * interview in three jurisdictions — TX (quick-pick button), ON (Ontario,
 * dropdown) and SG (Singapore, international dropdown) — with a full profile
 * + document reset and a FRESH browser context between each, so no client
 * state leaks across jurisdictions.
 *
 * REQUIREMENTS:
 *   - Worktree built with REAL_LLM=1 OPENAI_API_KEY=... (real model, not the
 *     scripted fake) — same as drive-real.mjs.
 *   - The server must run with ENABLE_INTERNATIONAL=true in .env.local or the
 *     SG (Singapore) jurisdiction will not exist in the picker. Build the
 *     worktree with E2E_INTERNATIONAL=1 (see e2e/setup-worktree.sh) to get it.
 *
 * Assertion philosophy (same as drive-real.mjs): the real model varies, so
 * CONTENT checks are loose (never exact wording), but PLUMBING checks are
 * strict (HTTP status codes, the saved state code, PDF magic bytes + size).
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

// Accept the current Terms of Service for the E2E user. withAuth 403s every
// authed endpoint (except the two TOS routes) until this has happened —
// server-verified, so it persists across contexts (same helper as drive-real.mjs).
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

// Erase the test user's story + documents so each jurisdiction starts clean.
async function resetUser(page) {
  await page.evaluate(async () => {
    await fetch('/api/profile', { method: 'DELETE' });
    const docs = await fetch('/api/documents').then((r) => r.json()).catch(() => null);
    for (const d of docs?.data?.documents ?? []) {
      await fetch(`/api/documents/${d.id}`, { method: 'DELETE' });
    }
  });
}

async function sendChat(page, text) {
  const input = page.getByPlaceholder('Type your message...');
  await input.fill(text);
  await input.press('Enter');
  // Real model: generous per-turn timeout. Input re-enables when isLoading clears.
  await page.waitForFunction(
    () => !document.querySelector('input[placeholder="Type your message..."]')?.disabled,
    null,
    { timeout: 120000 },
  );
}

// Pick a jurisdiction, retrying through the hydration race (drive.mjs
// pattern: keep interacting until the chat input materializes). Quick-pick
// buttons render as "TX - Texas"; every other jurisdiction lives in
// <select id="chat-state-select"> with the state CODE as the option value.
async function pickJurisdiction(page, j) {
  let appeared = false;
  for (let i = 0; i < 10 && !appeared; i++) {
    if (j.pick === 'button') {
      await page.getByRole('button', { name: j.buttonName }).first().click().catch(() => {});
    } else {
      // selectOption fires the change event React listens for.
      await page.selectOption('#chat-state-select', j.code, { timeout: 2000 }).catch(() => {});
    }
    appeared = await page
      .waitForSelector('input[placeholder="Type your message..."]', { timeout: 2000 })
      .then(() => true)
      .catch(() => false);
  }
  return appeared;
}

// Poll for the autosaved document (autosave is debounced; the real model is slow).
async function fetchDocument(page) {
  for (let i = 0; i < 15; i++) {
    const doc = await page.evaluate(async () => {
      const json = await fetch('/api/documents').then((r) => r.json()).catch(() => null);
      const d = json?.data?.documents?.[0];
      return d ? { id: d.id, state: d.content?.state ?? null, facts: d.facts ?? [], content: d.content ?? {} } : null;
    });
    if (doc) return doc;
    await page.waitForTimeout(2000);
  }
  return null;
}

const JURISDICTIONS = [
  {
    code: 'TX',
    label: 'Texas',
    pick: 'button',
    buttonName: /Texas/,
    locality: 'We live in Travis County, Texas.',
    marriage: 'We were married on June 10, 2012 in Austin, Texas.',
  },
  {
    code: 'ON',
    label: 'Ontario',
    pick: 'select',
    locality: 'We live in Toronto.',
    marriage: 'We were married on June 10, 2012 in Toronto.',
  },
  {
    code: 'SG',
    label: 'Singapore',
    pick: 'select',
    locality: 'We live in Singapore.',
    marriage: 'We were married on June 10, 2012 in Singapore.',
  },
];

try {
  for (const j of JURISDICTIONS) {
    console.log(`\n=== ${j.code} — ${j.label} ===`);
    // Fresh browser context per jurisdiction: no client state leaks.
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    page.setDefaultTimeout(45000);

    try {
      // 1. TOS + reset.
      await page.goto(`${BASE}/profile`);
      await page.waitForLoadState('networkidle');
      await acceptTos(page);
      await resetUser(page);

      // 2. Open the editor and select the jurisdiction.
      await page.goto(`${BASE}/editor/new?type=divorce_package&caseType=family`);
      await page.waitForLoadState('networkidle');
      const picked = await pickJurisdiction(page, j);
      ok(`${j.code}: jurisdiction picker accepts ${j.label}`, picked);
      if (!picked) {
        await page.screenshot({ path: `${SHOTS}/matrix-${j.code.toLowerCase()}.png`, fullPage: true });
        continue;
      }

      // 3. Short real-model interview (6 turns), neutral phrasing that works
      //    in any jurisdiction. Each sendChat asserts the input re-enables.
      const turns = [
        'My name is Sam Matrix. My spouse is Riley Matrix.',
        'We have lived here for five years.',
        j.locality,
        j.marriage,
        'We have no children.',
        'We agree on everything; irreconcilable differences.',
      ];
      let turnsCompleted = 0;
      for (const t of turns) {
        await sendChat(page, t);
        turnsCompleted += 1;
      }
      ok(`${j.code}: chat kept responding for all ${turns.length} turns`, turnsCompleted === turns.length, `${turnsCompleted}/${turns.length}`);
      await page.waitForTimeout(2500); // let autosave settle

      // 4a. Document state + facts (plumbing-strict).
      const doc = await fetchDocument(page);
      ok(`${j.code}: document autosaved`, Boolean(doc), doc ? doc.id : 'no document');
      if (!doc) {
        await page.screenshot({ path: `${SHOTS}/matrix-${j.code.toLowerCase()}.png`, fullPage: true });
        continue;
      }
      ok(
        `${j.code}: saved document state code is ${j.code}`,
        String(doc.state).toUpperCase() === j.code,
        String(doc.state),
      );
      ok(`${j.code}: at least 3 facts accumulated`, doc.facts.length >= 3, `${doc.facts.length} facts`);

      // 4b. Preview renders non-empty petition-ish content (content-loose:
      //     any petition/divorce vocabulary, never exact wording).
      const preview = await page.evaluate(async (payload) => {
        const res = await fetch('/api/documents/preview', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ affidavitData: payload }),
        });
        const json = await res.json().catch(() => null);
        const p = json?.preview ?? {};
        const text = [
          typeof p.htmlContent === 'string' ? p.htmlContent : '',
          JSON.stringify(p.sections ?? ''),
        ].join(' ');
        const paneText = document.querySelector('#editor-panel-preview')?.textContent ?? '';
        return {
          status: res.status,
          success: Boolean(json?.success),
          sectionCount: Array.isArray(p.sections)
            ? p.sections.length
            : p.sections && typeof p.sections === 'object'
              ? Object.keys(p.sections).length
              : 0,
          textLength: text.length,
          petitionish: /petition|divorce|dissolution|marriage|application|decree|writ/i.test(text + ' ' + paneText),
        };
      }, { ...doc.content, documentId: doc.id });
      ok(
        `${j.code}: preview renders non-empty petition-ish content`,
        preview.status === 200 && preview.success && preview.sectionCount > 0 &&
          preview.textLength > 200 && preview.petitionish,
        `status=${preview.status} sections=${preview.sectionCount} len=${preview.textLength}`,
      );

      // 4c. PDF generation (payments off ⇒ free). Same fetch shape as
      //     drive.mjs / drive-real.mjs, strict on status, type and size.
      const gen = await page.evaluate(async () => {
        const docs = (await fetch('/api/documents').then((r) => r.json())).data.documents;
        const d = docs[0];
        const res = await fetch('/api/documents/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ affidavitData: { ...d.content, documentId: d.id }, documentId: d.id }),
        });
        const buf = new Uint8Array(await res.arrayBuffer());
        return {
          status: res.status,
          type: res.headers.get('content-type'),
          bytes: buf.length,
          magic: String.fromCharCode(...buf.slice(0, 5)),
        };
      });
      ok(
        `${j.code}: generate returns a real PDF over 1500 bytes`,
        gen.status === 200 && String(gen.type).includes('pdf') && gen.bytes > 1500 && gen.magic === '%PDF-',
        `status=${gen.status} type=${gen.type} bytes=${gen.bytes}`,
      );

      // 5. Screenshot.
      await page.screenshot({ path: `${SHOTS}/matrix-${j.code.toLowerCase()}.png`, fullPage: true });
    } catch (err) {
      ok(`${j.code}: jurisdiction run completed without exception`, false, err.message);
      await page.screenshot({ path: `${SHOTS}/matrix-${j.code.toLowerCase()}.png`, fullPage: true }).catch(() => {});
    } finally {
      await ctx.close();
    }
  }
} catch (err) {
  ok('driver completed without exception', false, err.message);
} finally {
  console.log(`\nMatrix: ${results.filter((r) => r.pass).length} passed / ${results.length}`);
  await browser.close();
  process.exit(results.every((r) => r.pass) ? 0 : 1);
}
