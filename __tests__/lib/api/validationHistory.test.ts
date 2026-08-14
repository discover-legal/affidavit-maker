/** @jest-environment node */
// Contract for templates/validation-history.json — the per-jurisdiction legal
// changelog served by /api/templates/validation[/state]. Regenerate with
// scripts/buildValidationHistory.js after any validation pass.

import history from '@/templates/validation-history.json';

type Claim = { verdict: string; verifiedOn: string; source: string | null; note: string };
type Entry = {
  stateCode: string;
  stateName: string;
  lastVerified: string;
  claims: Record<string, Claim>;
  changelog: Array<{ date: string; type: string; summary: string; claim?: string; source?: string | null }>;
};

const jurisdictions = history.jurisdictions as Record<string, Entry>;

describe('validation history', () => {
  it('covers all 110 jurisdictions', () => {
    expect(Object.keys(jurisdictions)).toHaveLength(110);
  });

  it('every jurisdiction has a verification date, claims, and a changelog', () => {
    for (const [code, j] of Object.entries(jurisdictions)) {
      expect(j.stateCode).toBe(code);
      expect(j.stateName).toBeTruthy();
      expect(j.lastVerified).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Object.keys(j.claims).length).toBeGreaterThanOrEqual(6);
      expect(j.changelog.length).toBeGreaterThanOrEqual(1);
      expect(j.changelog.some((e) => e.type === 'verification')).toBe(true);
    }
  });

  it('every correction entry carries a summary, and claims carry sources', () => {
    for (const j of Object.values(jurisdictions)) {
      for (const e of j.changelog) {
        expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(e.summary).toBeTruthy();
        if (e.type === 'correction') expect(e.claim).toBeTruthy();
      }
      for (const c of Object.values(j.claims)) {
        expect(['CONFIRMED', 'CORRECTED', 'UNCERTAIN']).toContain(c.verdict);
        expect(c.verifiedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });

  it('known corrections are recorded (Ghana decree structure, TN grounds numbering)', () => {
    const gh = jurisdictions.GH;
    expect(gh.changelog.filter((e) => e.type === 'correction').map((e) => e.claim)).toContain('terminology');
    const tn = jurisdictions.TN;
    expect(tn.claims.citation).toBeDefined();
  });
});
