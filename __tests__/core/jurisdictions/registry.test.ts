/**
 * @jest-environment node
 *
 * Jurisdiction registry — built from the REAL templates/states directory.
 * Every expectation below is read off the metadata files it is built from
 * (templates/states/<dir>/metadata.json + divorce-metadata.json),
 * lib/officialForms.ts and the gating rule in config/jurisdictions.js.
 */
import { createJurisdictionRegistry } from '@/core/jurisdictions';
import type { JurisdictionRegistry } from '@/core/jurisdictions';

const ENV_KEYS = ['JURISDICTION_ALLOWLIST', 'ENABLE_INTERNATIONAL'] as const;

describe('core/jurisdictions registry', () => {
  const saved: Partial<Record<(typeof ENV_KEYS)[number], string | undefined>> = {};

  beforeEach(() => {
    for (const k of ENV_KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of ENV_KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  let registry: JurisdictionRegistry;
  beforeAll(() => {
    registry = createJurisdictionRegistry();
  });

  // ─── Ontario ────────────────────────────────────────────────────────────

  describe('get("ON")', () => {
    it('is a Canadian, letter-paper profile built from templates/states/ontario', () => {
      const on = registry.get('ON');
      expect(on).not.toBeNull();
      expect(on!.code).toBe('ON');
      expect(on!.country).toBe('CA');
      expect(on!.paper).toBe('letter');
      expect(on!.directory).toBe('ontario');
      expect(on!.name).toBe('Ontario');
    });

    it('carries the Ontario lexicon (Applicant, Court File No., AND BETWEEN, family property, IT IS ORDERED)', () => {
      const lex = registry.get('ON')!.lexicon;
      expect(lex.petitioner).toBe('Applicant'); // metadata.divorceTerminology.parties[0]
      expect(lex.respondent).toBe('Respondent'); // metadata.divorceTerminology.parties[1]
      expect(lex.fileNumberLabel).toBe('Court File No.'); // metadata.features.caseNumberLabel
      // The metadata does not carry a versus form; the registry's documented Canadian default.
      expect(lex.versus).toBe('AND BETWEEN');
      expect(lex.maritalProperty).toBe('family property');
      expect(lex.orderIntro).toBe('IT IS ORDERED');
      expect(lex.counterClaimTitle).toBe('Answer with Claim');
      expect(lex.selfRepresented).toBe('self-represented');
    });

    it('swears before a commissioner for oaths (metadata.features.commissionerForOaths)', () => {
      const jurat = registry.get('ON')!.jurat;
      expect(['commissioner_for_oaths', 'either']).toContain(jurat.officer);
      expect(jurat.citations.length).toBeGreaterThan(0);
    });

    it('has a divorce profile with a one-year separation ground and a 12-month separation gate', () => {
      const divorce = registry.get('ON')!.divorce;
      expect(divorce).toBeDefined();
      const codes = divorce!.grounds.map((g) => g.code);
      // divorce-metadata.json spells the ground "separation"; the contract's
      // canonical example is "one_year_separation". Either spelling is the same ground.
      expect(codes.some((c) => c === 'one_year_separation' || c === 'separation')).toBe(true);
      const separation = divorce!.grounds.find((g) => g.code === 'one_year_separation' || g.code === 'separation')!;
      expect(separation.noFault).toBe(true);
      expect(codes).toContain('adultery');
      expect(codes).toContain('cruelty');
      expect(divorce!.separationMonthsRequired).toBe(12);
      expect(divorce!.residency.months).toBe(12); // residencyRequirements.stateMonths
    });

    it('names the court from metadata.courtSystem', () => {
      const court = registry.get('ON')!.court;
      expect(court.name).toBe('Superior Court of Justice');
      expect(court.venueLines.length).toBeGreaterThan(0);
    });
  });

  // ─── Texas ──────────────────────────────────────────────────────────────

  describe('get("TX")', () => {
    it('is a US, letter-paper profile with Petitioner / Respondent and CAUSE NO.', () => {
      const tx = registry.get('TX');
      expect(tx).not.toBeNull();
      expect(tx!.country).toBe('US');
      expect(tx!.paper).toBe('letter');
      expect(tx!.directory).toBe('texas');
      expect(tx!.lexicon.petitioner).toBe('Petitioner');
      expect(tx!.lexicon.respondent).toBe('Respondent');
      expect(tx!.lexicon.fileNumberLabel).toBe('CAUSE NO.'); // metadata.features.caseNumberLabel
      expect(tx!.lexicon.versus).toBe('v.');
      expect(tx!.lexicon.maritalProperty).toBe('community property'); // divorce-metadata.propertyDivision.type
      expect(tx!.lexicon.counterClaimTitle).toBe('Counter-Petition');
      expect(tx!.jurat.officer).toBe('notary');
    });

    it('pleads cruelty with insupportability in the alternative and six months residency', () => {
      const divorce = registry.get('TX')!.divorce!;
      const codes = divorce.grounds.map((g) => g.code);
      expect(codes).toContain('insupportability');
      expect(codes).toContain('cruelty');
      const insupportability = divorce.grounds.find((g) => g.code === 'insupportability')!;
      expect(insupportability.noFault).toBe(true);
      const cruelty = divorce.grounds.find((g) => g.code === 'cruelty')!;
      expect(cruelty.noFault).toBe(false);
      expect(cruelty.alternative).toBe('insupportability');
      expect(divorce.residency.months).toBe(6); // residencyRequirements.stateMonths
      expect(divorce.separationMonthsRequired).toBeUndefined();
    });

    it('has a waiting period (divorce-metadata.waitingPeriod, 60 days)', () => {
      expect(registry.get('TX')!.divorce!.waitingPeriod).toBeDefined();
    });
  });

  // ─── New York ───────────────────────────────────────────────────────────

  describe('get("NY")', () => {
    it('uses Plaintiff / Defendant and INDEX NO.', () => {
      const ny = registry.get('NY')!;
      expect(ny.country).toBe('US');
      expect(ny.lexicon.petitioner).toBe('Plaintiff');
      expect(ny.lexicon.respondent).toBe('Defendant');
      expect(ny.lexicon.fileNumberLabel).toBe('INDEX NO.'); // metadata.features.caseNumberLabel
      expect(ny.lexicon.maritalProperty).toBe('marital property');
    });
  });

  // ─── International ──────────────────────────────────────────────────────

  describe('get("ENG")', () => {
    it('is UK, A4 paper, Applicant / Respondent', () => {
      const eng = registry.get('ENG');
      expect(eng).not.toBeNull();
      expect(eng!.country).toBe('UK');
      expect(eng!.paper).toBe('a4'); // metadata.paperSize "A4"
      expect(eng!.directory).toBe('england');
      expect(eng!.lexicon.petitioner).toBe('Applicant');
    });
  });

  // ─── Lookup semantics ───────────────────────────────────────────────────

  describe('lookup', () => {
    it('returns null for an unknown code', () => {
      expect(registry.get('ZZ')).toBeNull();
      expect(registry.get('')).toBeNull();
    });

    it('is case-insensitive and trims', () => {
      expect(registry.get('on')!.code).toBe('ON');
      expect(registry.get('tx')!.code).toBe('TX');
      expect(registry.get('eng')!.code).toBe('ENG');
      expect(registry.get(' on ')!.code).toBe('ON');
    });

    it('countryOf resolves CA / US and null for unknown', () => {
      expect(registry.countryOf('AB')).toBe('CA');
      expect(registry.countryOf('TX')).toBe('US');
      expect(registry.countryOf('ab')).toBe('CA');
      expect(registry.countryOf('ZZ')).toBeNull();
    });

    it('defaultFor(country) is ON for Canada and TX for the US', () => {
      expect(registry.defaultFor('CA')!.code).toBe('ON');
      expect(registry.defaultFor('US')!.code).toBe('TX');
    });

    it('all() has every profile on disk (110 directories) with unique codes', () => {
      const all = registry.all();
      expect(all).toHaveLength(110);
      const codes = all.map((p) => p.code);
      expect(new Set(codes).size).toBe(110);
      for (const p of all) {
        expect(p.code).toBe(p.code.toUpperCase());
        expect(['letter', 'a4']).toContain(p.paper);
        expect(typeof p.directory).toBe('string');
        expect(p.lexicon.petitioner.length).toBeGreaterThan(0);
        expect(p.lexicon.fileNumberLabel.length).toBeGreaterThan(0);
      }
    });

    it('all() is not affected by gating', () => {
      process.env.JURISDICTION_ALLOWLIST = 'ON';
      expect(createJurisdictionRegistry().all()).toHaveLength(110);
    });
  });

  // ─── Gating (config/jurisdictions.js rule) ──────────────────────────────

  describe('active()', () => {
    it('surfaces only the allowlist when JURISDICTION_ALLOWLIST is set, case-insensitively', () => {
      process.env.JURISDICTION_ALLOWLIST = 'on,ut';
      const codes = createJurisdictionRegistry()
        .active()
        .map((p) => p.code)
        .sort();
      expect(codes).toEqual(['ON', 'UT']);
    });

    it('lets the allowlist override ENABLE_INTERNATIONAL', () => {
      process.env.JURISDICTION_ALLOWLIST = 'ENG';
      process.env.ENABLE_INTERNATIONAL = 'true';
      const codes = createJurisdictionRegistry()
        .active()
        .map((p) => p.code);
      expect(codes).toEqual(['ENG']);
    });

    it('treats a blank allowlist as unset', () => {
      process.env.JURISDICTION_ALLOWLIST = ' , ';
      expect(createJurisdictionRegistry().active()).toHaveLength(64);
    });

    it('defaults to the 64 North American jurisdictions (51 US + 13 CA)', () => {
      const active = createJurisdictionRegistry().active();
      expect(active).toHaveLength(64);
      expect(active.filter((p) => p.country === 'US')).toHaveLength(51);
      expect(active.filter((p) => p.country === 'CA')).toHaveLength(13);
      expect(active.some((p) => p.code === 'ENG')).toBe(false);
    });

    it('surfaces all 110 when ENABLE_INTERNATIONAL=true', () => {
      process.env.ENABLE_INTERNATIONAL = 'true';
      expect(createJurisdictionRegistry().active()).toHaveLength(110);
    });

    it('does not enable international for any value other than the string "true"', () => {
      process.env.ENABLE_INTERNATIONAL = '1';
      expect(createJurisdictionRegistry().active()).toHaveLength(64);
    });

    it('get() still resolves gated-off profiles (gating is for surfacing, not lookup)', () => {
      process.env.JURISDICTION_ALLOWLIST = 'ON,UT';
      expect(createJurisdictionRegistry().get('TX')).not.toBeNull();
    });
  });

  // ─── Official forms (lib/officialForms.ts) ──────────────────────────────

  describe('official forms', () => {
    it('are present for ON and TX', () => {
      const on = registry.get('ON')!.divorce!;
      expect(on.officialFormsUrl).toBe('https://ontariocourtforms.on.ca/en/');
      expect(on.officialFormsName).toBe('Ontario Court Forms');
      const tx = registry.get('TX')!.divorce!;
      expect(tx.officialFormsUrl).toBe('https://www.txcourts.gov/rules-forms/forms/');
      expect(tx.officialFormsName).toBe('Texas Judicial Branch — Forms');
    });

    it('are absent for LA (forms are per judicial district) and NU', () => {
      const la = registry.get('LA')!;
      expect(la.divorce?.officialFormsUrl).toBeUndefined();
      expect(la.divorce?.officialFormsName).toBeUndefined();
      const nu = registry.get('NU')!;
      expect(nu.divorce?.officialFormsUrl).toBeUndefined();
    });
  });

  describe('templatesDir option', () => {
    it('reads from an explicit directory', () => {
      const path = require('path') as typeof import('path');
      const reg = createJurisdictionRegistry({ templatesDir: path.join(process.cwd(), 'templates', 'states') });
      expect(reg.all()).toHaveLength(110);
      expect(reg.get('ON')!.lexicon.petitioner).toBe('Applicant');
    });
  });
});
