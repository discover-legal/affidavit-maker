/**
 * All-jurisdictions render sweep — the machine-scale answer to "who QAs
 * 110 jurisdictions?". No browser, no LLM: for every jurisdiction the
 * server advertises, render a divorce-petition preview from canned facts
 * and assert it is a real document with locally-correct caption language.
 *
 * Run against a dev server started from the e2e worktree (E2E auth bypass
 * + CSRF allow-list for localhost:3100). With ENABLE_INTERNATIONAL=true
 * the sweep covers all ~110; otherwise the 64 NA jurisdictions.
 *
 *   node sweep-jurisdictions.mjs
 *
 * Caption lint:
 *  - US states + DC: "STATE OF"/"COUNTY OF" style is correct; no lint.
 *  - Everything else: must NOT say "STATE OF <name>" or "COUNTY OF" /
 *    "<x> County" — provinces and international jurisdictions have their
 *    own court terminology.
 */

const BASE = process.env.BASE || 'http://localhost:3100';

const US = new Set([
  'AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM',
  'NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA',
  'WV','WI','WY',
]);

const CANNED = {
  documentType: 'divorce_package',
  affiantName: 'Sam Matrix',
  firstName: 'Sam',
  lastName: 'Matrix',
  petitionerName: 'Sam Matrix',
  petitionerFirstName: 'Sam',
  petitionerLastName: 'Matrix',
  respondentName: 'Riley Matrix',
  respondentFirstName: 'Riley',
  respondentLastName: 'Matrix',
  spouseName: 'Riley Matrix',
  marriageDate: '2012-06-10',
  separationDate: '2024-01-15',
  residencyStateMonths: 60,
  groundsForDivorce: 'irreconcilable_differences',
  hasMinorChildren: false,
  facts: [
    { id: '1', content: 'My full legal name is Sam Matrix.', category: 'general' },
    { id: '2', content: 'My spouse is Riley Matrix.', category: 'general' },
    { id: '3', content: 'We were married on June 10, 2012.', category: 'marriage' },
  ],
};

const results = [];
const fails = [];

async function main() {
  const states = await fetch(`${BASE}/api/templates/states`).then((r) => r.json());
  if (!Array.isArray(states) || states.length === 0) {
    console.error('FATAL: /api/templates/states returned no jurisdictions');
    process.exit(1);
  }
  console.log(`Sweeping ${states.length} jurisdictions…`);

  for (const s of states) {
    const code = s.stateCode;
    const problems = [];
    try {
      // The preview endpoint allows 100 requests per 15-minute sliding
      // window — structurally fewer than the 110 jurisdictions, so the
      // sweep MUST wait out the window on 429 (the window frees ~1 slot
      // every 9s once saturated). 60s waits × up to 12 tries rides that
      // out; a limiter response is never recorded as a template failure.
      let res;
      for (let attempt = 0; attempt < 12; attempt++) {
        res = await fetch(`${BASE}/api/documents/preview`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Origin: BASE },
          body: JSON.stringify({ affidavitData: { ...CANNED, state: code } }),
        });
        if (res.status !== 429) break;
        await new Promise((r) => setTimeout(r, 60000));
      }
      if (res.status !== 200) problems.push(`status ${res.status}`);
      const json = await res.json().catch(() => null);
      if (!json?.success) problems.push('success=false');
      const p = json?.preview ?? {};
      const sections = p.sections && typeof p.sections === 'object' ? p.sections : {};
      const sectionCount = Array.isArray(sections) ? sections.length : Object.keys(sections).length;
      if (sectionCount === 0) problems.push('no sections');
      const text = `${JSON.stringify(sections)} ${p.htmlContent ?? ''}`;
      if (text.length < 300) problems.push(`thin render (${text.length} chars)`);
      if (!US.has(code)) {
        if (/\bSTATE OF\b/i.test(text)) problems.push('US-ism: "STATE OF" in a non-US caption');
        if (/\bCOUNTY OF\b/i.test(text)) problems.push('US-ism: "COUNTY OF" in a non-US caption');
        if (/\b[A-Z][a-z]+ County\b/.test(text)) problems.push('US-ism: "<x> County" in non-US body');
      }
    } catch (err) {
      problems.push(`threw: ${err.message}`);
    }
    results.push({ code, ok: problems.length === 0 });
    if (problems.length > 0) {
      fails.push(`${code}: ${problems.join('; ')}`);
      console.log(`FAIL ${code} — ${problems.join('; ')}`);
    }
  }

  const passed = results.filter((r) => r.ok).length;
  console.log(`\nSweep: ${passed} passed / ${results.length}`);
  if (fails.length > 0) {
    console.log(`${fails.length} failing jurisdictions.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
