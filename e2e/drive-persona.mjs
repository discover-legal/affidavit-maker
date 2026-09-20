/**
 * Persona-driven real-model run of the v2 engine through the real UI.
 * Priya Nair, Toronto — filing an Ontario divorce. Every reply, extraction,
 * judgment and document below comes from the live model; nothing scripted.
 */
import { chromium } from 'playwright-core';
import fs from 'node:fs';

const BASE = 'http://localhost:3100';
const SHOTS = process.env.SHOTS || new URL('./shots', import.meta.url).pathname;
const results = [];
const ok = (n, p, d = '') => { results.push({ n, p }); console.log(`${p ? 'PASS' : 'FAIL'} — ${n}${d ? ` (${d})` : ''}`); };
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ['--no-proxy-server'] });
const transcript = [];

async function acceptTos(page) {
  await page.evaluate(async () => {
    const s = await fetch('/api/auth/tos-status').then((r) => r.json()).catch(() => null);
    if (s?.currentTosVersion && !s?.tosAccepted) await fetch('/api/auth/accept-tos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tosVersion: s.currentTosVersion }) });
  });
}
async function say(page, text) {
  const input = page.getByPlaceholder('Type your message...');
  await input.fill(text); await input.press('Enter');
  await page.waitForFunction(() => !document.querySelector('input[placeholder="Type your message..."]')?.disabled, null, { timeout: 180000 });
  // Read the assistant's last reply from the saved document's conversation
  // history (the UI's bubbles carry no stable role attribute).
  const last = await page.evaluate(async () => {
    const j = await fetch('/api/documents').then((r) => r.json()).catch(() => null);
    const h = j?.data?.documents?.[0]?.conversation_history ?? j?.data?.documents?.[0]?.content?.conversationHistory ?? [];
    const a = [...h].reverse().find((m) => (m.role ?? m.type) === 'assistant');
    return a?.content ?? '';
  }).catch(() => '');
  transcript.push({ user: text, assistant: last });
  console.log(`\nPRIYA: ${text}\nASSISTANT: ${last.slice(0, 400)}`);
}
const latestDoc = (page) => page.evaluate(async () => (await (await fetch('/api/documents')).json()).data.documents[0]);

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage(); page.setDefaultTimeout(60000);
  await page.goto(`${BASE}/dashboard`); await acceptTos(page);
  await page.evaluate(async () => { const d = await fetch('/api/documents').then((r) => r.json()).catch(() => ({ data: { documents: [] } })); for (const x of d.data?.documents ?? []) await fetch(`/api/documents/${x.id}`, { method: 'DELETE' }); await fetch('/api/profile', { method: 'DELETE' }).catch(() => {}); });
  await page.screenshot({ path: `${SHOTS}/p0-dashboard-empty.png`, fullPage: true });

  await page.goto(`${BASE}/editor/new?type=divorce_package&caseType=family`);
  await page.waitForLoadState('networkidle');
  // Ontario is in the "All jurisdictions" dropdown, not a quick-pick button.
  for (let i = 0; i < 10; i++) {
    await page.locator('select').first().selectOption({ value: 'ON' }).catch(() => {});
    if (await page.waitForSelector('input[placeholder="Type your message..."]:not([disabled])', { timeout: 2000 }).then(() => true).catch(() => false)) break;
  }
  await page.screenshot({ path: `${SHOTS}/p1-editor-start.png`, fullPage: true });

  const turns = [
    "Hi. I'm Priya Nair. My husband Daniel Okafor and I have been separated since March 2024 and I want to file for divorce in Ontario.",
    "I've lived in Toronto my whole life, so well over a year. We were married on June 14, 2014 at Toronto City Hall.",
    "We separated on March 3, 2024. He moved out to his brother's place in Mississauga; I'm still in the condo.",
    "We have two kids: Anika, born September 2, 2016, and Rohan, born January 20, 2019. They live with me during the week and see Daniel every other weekend.",
    "We own the condo at 88 Harbour Street together and a 2021 Toyota RAV4. We don't have any debts, we paid off the car.",
    "I'm not asking for spousal support and neither is he. We both work full time.",
    "Daniel will accept the papers, he's cooperative about this.",
    "Yes, that's all correct.",
  ];
  for (let i = 0; i < turns.length; i++) { await say(page, turns[i]); await page.screenshot({ path: `${SHOTS}/p2-turn${i + 1}.png`, fullPage: true }); }
  await page.waitForTimeout(2000);
  await page.screenshot({ path: `${SHOTS}/p3-interview-done.png`, fullPage: true });

  const doc = await latestDoc(page); const c = doc?.content ?? {};
  fs.writeFileSync(`${SHOTS}/document-state.json`, JSON.stringify(c, null, 2));
  ok('v2 engine handled every turn', c.orchestratorState?.engine === 'v2', JSON.stringify(c.orchestratorState));
  ok('party names extracted', c.petitionerFirstName === 'Priya' && c.respondentFirstName === 'Daniel', `${c.petitionerName} / ${c.respondentName}`);
  ok('ON jurisdiction', c.state === 'ON', c.state);
  ok('marriage date extracted', c.marriageDate === '2014-06-14', String(c.marriageDate));
  ok('separation date extracted', c.separationDate === '2024-03-03', String(c.separationDate));
  ok('two children', (c.children ?? []).length === 2, JSON.stringify(c.children));
  ok('property items captured', Array.isArray(c.propertyItems) && c.propertyItems.length >= 2, JSON.stringify(c.propertyItems));
  ok('no_debts confirmed only because she said so', c.noDebtsConfirmed === true, String(c.noDebtsConfirmed));
  ok('support_waived NOT set from "not asking" (silence ≠ waiver)', c.spousalSupportWaived !== true);
  ok('every fact carries her own words', (c.facts ?? []).length > 0 && c.facts.every((f) => f.sourceQuote));

  // Preview + PDF through v2
  const prev = await page.evaluate(async (d) => { const r = await fetch('/api/documents/preview', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ affidavitData: { ...d, documentType: 'divorce_package', activeSubDocument: 'divorce_petition' } }) }); return { status: r.status, body: await r.json() }; }, c);
  ok('preview served by v2', prev.body?.metadata?.engine === 'v2', `status=${prev.status}`);
  fs.writeFileSync(`${SHOTS}/preview.html`, prev.body?.preview?.htmlContent ?? '');
  fs.writeFileSync(`${SHOTS}/preview-sections.json`, JSON.stringify(prev.body?.preview, null, 2));
  ok('blanks listed', Array.isArray(prev.body?.preview?.metadata?.blanks), `${prev.body?.preview?.metadata?.blanks?.length} blanks: ${(prev.body?.preview?.metadata?.blanks ?? []).map((b) => b.field).join(', ')}`);

  const pdf = await page.evaluate(async (id) => { const d = (await (await fetch('/api/documents')).json()).data.documents.find((x) => x.id === id); const r = await fetch('/api/documents/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ affidavitData: { ...d.content, documentType: 'divorce_package', activeSubDocument: 'divorce_petition', documentId: d.id }, documentId: d.id }) }); const b = new Uint8Array(await r.arrayBuffer()); return { status: r.status, bytes: Array.from(b), disp: r.headers.get('content-disposition') }; }, doc.id);
  fs.writeFileSync(`${SHOTS}/priya-application.pdf`, Buffer.from(pdf.bytes));
  ok('v2 PDF generated', pdf.status === 200 && pdf.bytes.length > 1000, `${pdf.bytes.length} bytes ${pdf.disp}`);

  // Re-login memory
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } }); const p2 = await ctx2.newPage();
  await p2.goto(`${BASE}/profile`); await acceptTos(p2); await p2.reload(); await p2.waitForLoadState('networkidle');
  await p2.screenshot({ path: `${SHOTS}/p4-profile-relogin.png`, fullPage: true });
  await p2.goto(`${BASE}/dashboard`); await p2.waitForLoadState('networkidle');
  await p2.screenshot({ path: `${SHOTS}/p5-dashboard.png`, fullPage: true });
} catch (e) { ok('driver completed', false, e.message); } finally { fs.writeFileSync(`${SHOTS}/transcript.json`, JSON.stringify(transcript, null, 2)); await browser.close(); }
const failed = results.filter((r) => !r.p); console.log(`\n${results.length - failed.length}/${results.length} checks passed`); process.exit(failed.length ? 1 : 0);
