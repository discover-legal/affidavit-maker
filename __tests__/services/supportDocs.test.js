/** @jest-environment node */
// Tests for the Utah supporting-document builders + registry.
// Builders are pure (data, opts) => documentStructure functions, so no mocks.

const utah = require('../../services/supportDocs/utah');
const { SUPPORT_DOC_KINDS, getSupportDoc, list } = require('../../services/supportDocs');

const UNSWORN_WORDING =
  'I declare under criminal penalty of the State of Utah that the foregoing is true and correct.';

const sampleData = {
  petitionerName: 'Jane Q. Example',
  respondentName: 'John R. Example',
  state: 'UT',
  county: 'Salt Lake',
  caseNumber: '244900123',
  children: [
    { name: 'Emma Example', dob: '2015-04-02' },
    { name: 'Liam Example', dob: '2018-09-10' },
  ],
  incomeBreakdown: [
    { label: 'Wages', amount: 3200, person: 'petitioner' },
    { label: 'Side business', amount: 800 },
  ],
  expenseBreakdown: [
    { label: 'Rent', amount: 1500 },
    { label: 'Utilities', amount: 250 },
  ],
  monthlyIncome: 9999, // must be ignored when a breakdown exists
  assetsDescription: '2014 Honda Civic; joint checking account',
  serviceMethod: 'personal service by sheriff',
  groundsForDivorce: 'irreconcilable differences',
  marriageDate: '2012-06-15',
  separationDate: '2025-11-01',
  custodyArrangement: 'joint legal custody, primary physical with petitioner',
  childSupportAmount: 600,
  keyEvents: [
    { label: 'Petition filed', date: '2026-02-10' },
    { label: 'Respondent served with petition', date: '2026-03-02' },
  ],
  respondentMilitaryStatus: 'not in military service',
  residencyStateMonths: 8,
};

/** Flatten a structure's sections to one searchable string. */
function textOf(structure) {
  return JSON.stringify(structure.sections);
}

describe('utah support doc builders — shared shape', () => {
  const builders = {
    acceptance_of_service: utah.acceptanceOfService,
    certificate_of_service: utah.certificateOfService,
    financial_declaration: utah.financialDeclaration,
    default_package: utah.motionForDefaultPackage,
    finalization_prep: utah.finalizationPrep,
  };

  test.each(Object.entries(builders))(
    '%s returns a pdfService-renderable affidavit structure',
    (kind, build) => {
      const structure = build(sampleData);
      expect(structure.state).toBe('UT');
      expect(structure.documentType).toBe('affidavit');
      expect(structure.metadata.kind).toBe(kind);
      expect(structure.sections).toBeDefined();
      expect(typeof structure.sections.title).toBe('string');
      expect(Array.isArray(structure.sections.facts.items)).toBe(true);
      expect(structure.sections.facts.items.length).toBeGreaterThan(0);
      structure.sections.facts.items.forEach((item, idx) => {
        expect(item.number).toBe(idx + 1);
        expect(typeof item.content).toBe('string');
        expect(item.content.length).toBeGreaterThan(0);
      });
    },
  );

  test('court filings carry the Utah district-court caption', () => {
    for (const build of [
      utah.acceptanceOfService,
      utah.certificateOfService,
      utah.financialDeclaration,
      utah.motionForDefaultPackage,
    ]) {
      const { sections } = build(sampleData);
      // Same court-line style as the petition/decree templates.
      expect(sections.header).toBe(
        'IN THE DISTRICT COURT OF THE STATE OF UTAH, IN AND FOR SALT LAKE COUNTY',
      );
      expect(sections.caseCaption.formatted).toContain('JANE Q. EXAMPLE');
      expect(sections.caseCaption.formatted).toContain('Petitioner');
      expect(sections.caseCaption.formatted).toContain('JOHN R. EXAMPLE');
      expect(sections.caseCaption.formatted).toContain('Respondent');
      expect(sections.caseCaption.formatted).toContain('Case No. 244900123');
    }
  });

  test('caption uses a blank case-number line when unknown', () => {
    const { sections } = utah.acceptanceOfService({ ...sampleData, caseNumber: undefined });
    expect(sections.caseCaption.formatted).toContain('Case No. ______________');
  });

  test('unsworn declaration is the default signature style', () => {
    const { sections } = utah.acceptanceOfService(sampleData);
    expect(sections.perjuryStatement).toContain(UNSWORN_WORDING);
    expect(sections.notaryBlock).toBeNull();
  });

  test('notary variant renders the subscribed-and-sworn block instead', () => {
    const { sections } = utah.acceptanceOfService(sampleData, { signatureStyle: 'notary' });
    expect(sections.notaryBlock).toContain('Subscribed and sworn to before me');
    expect(sections.notaryBlock).toContain('Notary Public');
    expect(sections.perjuryStatement).toBeNull();
    expect(textOf(utah.acceptanceOfService(sampleData, { signatureStyle: 'notary' }))).not.toContain(
      UNSWORN_WORDING,
    );
  });
});

describe('acceptanceOfService', () => {
  test('acknowledges receipt without agreeing to the petition', () => {
    const structure = utah.acceptanceOfService(sampleData);
    expect(structure.sections.title).toBe('ACCEPTANCE OF SERVICE');
    const text = textOf(structure);
    expect(text).toContain('not agreeing with anything requested in the Petition');
    expect(text).toContain('confirms only that the documents were delivered to me');
    expect(text).toContain('Petition for Divorce');
    // Respondent signs it
    expect(structure.sections.signatureBlock.name).toBe('John R. Example');
    expect(structure.sections.signatureBlock.title).toBe('Respondent');
  });
});

describe('certificateOfService', () => {
  test('states who served what on whom, with date and method', () => {
    const structure = utah.certificateOfService(sampleData);
    expect(structure.sections.title).toBe('CERTIFICATE OF SERVICE');
    const text = textOf(structure);
    expect(text).toContain('John R. Example');
    expect(text).toContain('Date of service: 2026-03-02');
    expect(text).toContain('Method of service: personal service by sheriff');
    expect(structure.sections.signatureBlock.title).toBe('Person Who Completed Service');
  });

  test('leaves blanks where date and method are unknown', () => {
    const structure = utah.certificateOfService({
      petitionerName: 'Jane Q. Example',
      respondentName: 'John R. Example',
    });
    const text = textOf(structure);
    expect(text).toContain('Date of service: ______________');
    expect(text).toContain('Method of service: ______________');
  });
});

describe('financialDeclaration', () => {
  test('totals itemized income and expenses from the breakdowns', () => {
    const structure = utah.financialDeclaration(sampleData);
    expect(structure.sections.title).toBe('FINANCIAL DECLARATION');
    const text = textOf(structure);
    // 3200 + 800, not the stale monthlyIncome of 9999
    expect(text).toContain('TOTAL MONTHLY INCOME: $4,000');
    expect(text).not.toContain('$9,999');
    expect(text).toContain('TOTAL MONTHLY EXPENSES: $1,750');
    // Itemized rows with $X,XXX amounts
    expect(text).toContain('Wages (petitioner)');
    expect(text).toContain('$3,200');
    expect(text).toContain('Rent');
    expect(text).toContain('$1,500');
    // Assets carried through
    expect(text).toContain('2014 Honda Civic; joint checking account');
  });

  test('falls back to monthlyIncome when there is no breakdown', () => {
    const structure = utah.financialDeclaration({
      petitionerName: 'Jane Q. Example',
      monthlyIncome: 2500,
    });
    expect(textOf(structure)).toContain('TOTAL MONTHLY INCOME: $2,500');
  });

  test('includes debts when present', () => {
    const structure = utah.financialDeclaration({
      ...sampleData,
      petitionerDebts: 'Visa card $4,000',
      respondentDebts: 'Truck loan $12,000',
    });
    const text = textOf(structure);
    expect(text).toContain("Petitioner's debts: Visa card $4,000");
    expect(text).toContain("Respondent's debts: Truck loan $12,000");
  });
});

describe('motionForDefaultPackage', () => {
  test('recites the served date from keyEvents and the 21-day default rule', () => {
    const structure = utah.motionForDefaultPackage(sampleData);
    expect(structure.sections.title).toBe('MOTION FOR DEFAULT');
    const text = textOf(structure);
    expect(text).toContain('served with the Petition and Summons on 2026-03-02');
    expect(text).toContain('More than 21 days have passed');
    expect(text).toContain('has not filed an answer');
  });

  test('includes the supporting declaration and military-status note', () => {
    const structure = utah.motionForDefaultPackage(sampleData);
    const text = textOf(structure);
    expect(structure.sections.conclusion).toContain('SUPPORTING DECLARATION OF PETITIONER');
    expect(structure.sections.conclusion).toContain('2026-03-02');
    expect(text).toContain("Respondent's military status: not in military service");
    expect(text).toContain('Servicemembers Civil Relief Act');
  });

  test('leaves a military-status blank when unknown', () => {
    const structure = utah.motionForDefaultPackage({
      ...sampleData,
      respondentMilitaryStatus: undefined,
    });
    expect(textOf(structure)).toContain(
      'whether Respondent is in the military service',
    );
  });
});

describe('finalizationPrep', () => {
  test('is a plain-language prep sheet, not a court filing', () => {
    const structure = utah.finalizationPrep(sampleData);
    expect(structure.sections.title).toBe(
      'Finishing your Utah divorce — your checklist and declaration prep',
    );
    expect(structure.sections.header).toBeNull();
    expect(structure.sections.caseCaption).toBeNull();
    expect(structure.sections.signatureBlock).toBeNull();
    expect(structure.sections.conclusion).toContain('not legal advice');
  });

  test('checklist is derived from the user data', () => {
    const intro = utah.finalizationPrep(sampleData).sections.introduction;
    expect(intro).toContain('30-day waiting period');
    expect(intro).toContain('filed on 2026-02-10');
    // education courses only because children exist
    expect(intro).toContain('divorce education');
    expect(intro).toContain('Emma Example');
    expect(intro).toContain('Financial declarations exchanged');
    expect(intro).toContain('served on 2026-03-02');
  });

  test('omits the education-course item when there are no children', () => {
    const intro = utah.finalizationPrep({ ...sampleData, children: [] }).sections.introduction;
    expect(intro).not.toContain('divorce education');
  });

  test('Q&A is personalized from stored values, with blanks otherwise', () => {
    const structure = utah.finalizationPrep(sampleData);
    const text = textOf(structure);
    expect(text).toContain('Salt Lake County, Utah for at least 3 months');
    expect(text).toContain('about 8 months');
    expect(text).toContain('Married on 2012-06-15');
    expect(text).toContain('irreconcilable differences');
    expect(text).toContain('Emma Example (born 2015-04-02)');
    expect(text).toContain('Liam Example (born 2018-09-10)');
    expect(text).toContain('Child support: $600 per month');
    // every question carries a 'Your answer:' line
    structure.sections.facts.items.forEach((item) => {
      expect(item.content).toContain('Your answer:');
    });

    // Sparse data → blank answer lines
    const sparse = utah.finalizationPrep({ petitionerName: 'Jane', respondentName: 'John' });
    const sparseText = textOf(sparse);
    expect(sparseText).toContain('Your answer: ________________________________');
  });
});

describe('registry (services/supportDocs)', () => {
  test('list(UT) returns the five kinds with EN + ES titles and descriptions', () => {
    const kinds = list('UT');
    expect(kinds.map((k) => k.key).sort()).toEqual([...SUPPORT_DOC_KINDS].sort());
    kinds.forEach((entry) => {
      expect(typeof entry.title).toBe('string');
      expect(entry.title.length).toBeGreaterThan(0);
      expect(typeof entry.titleEs).toBe('string');
      expect(entry.titleEs.length).toBeGreaterThan(0);
      expect(typeof entry.description).toBe('string');
      expect(entry.description.length).toBeGreaterThan(0);
      expect(typeof entry.descriptionEs).toBe('string');
      expect(entry.descriptionEs.length).toBeGreaterThan(0);
    });
  });

  test('getSupportDoc resolves builders case-insensitively and returns null otherwise', () => {
    expect(getSupportDoc('UT', 'financial_declaration')).toBe(utah.financialDeclaration);
    expect(getSupportDoc('ut', 'default_package')).toBe(utah.motionForDefaultPackage);
    expect(getSupportDoc('TX', 'nonexistent_kind')).toBeNull();
    expect(getSupportDoc('UT', 'nonexistent_kind')).toBeNull();
    expect(getSupportDoc(undefined, 'financial_declaration')).toBeNull();
  });

  test('list(TX) exposes the wired-up TX kinds plus the state-agnostic kinds', () => {
    const kinds = list('TX').map((k) => k.key).sort();
    expect(kinds).toEqual(
      ['answer', 'financial_declaration', 'indigency_affidavit', 'lawyer_handoff', 'statement_of_inability'].sort(),
    );
  });
});

describe('county normalization', () => {
  // Profile extraction stores "Salt Lake County"; captions append the word
  // themselves. Doubling shipped to production PDFs on 2026-08-10.
  it('strips a trailing "County" before every caption interpolation', () => {
    const data = { ...sampleData, county: 'Salt Lake County' };
    const kinds = ['financial_declaration', 'answer', 'fee_waiver_motion', 'child_support_worksheet'];
    for (const kind of kinds) {
      const doc = getSupportDoc('UT', kind)(data, {});
      const text = JSON.stringify(doc);
      expect(text).not.toMatch(/County County|COUNTY COUNTY/i);
      expect(text).toMatch(/IN AND FOR SALT LAKE COUNTY/);
    }
    const handoff = getSupportDoc('UT', 'lawyer_handoff')(data, {});
    expect(JSON.stringify(handoff)).not.toMatch(/County County/i);
  });

  it('normalizeCountyName leaves clean values alone', () => {
    expect(utah.normalizeCountyName('Salt Lake County')).toBe('Salt Lake');
    expect(utah.normalizeCountyName('Salt Lake')).toBe('Salt Lake');
    expect(utah.normalizeCountyName(undefined)).toBe(undefined);
  });
});

// ─── live-QA regression: sworn income attribution + caption alignment ────────
// A persona run stored the HOUSEHOLD total ($8,600) in monthlyIncome while
// incomeBreakdown itemized $3,400 (petitioner) / $5,200 (respondent). The
// Financial Declaration — a SWORN form — titled BOTH spouses' wages
// "MONTHLY INCOME … TOTAL: $8,600" under HER declaration: a 2.5x
// overstatement that could cost a real user her fee waiver. Support docs
// also captioned the go-by ("KATIE") and a different court-line style than
// the petition/decree ("KATHLEEN…", "…STATE OF UTAH, IN AND FOR …").
describe('financialDeclaration — persona regression (sworn income attribution)', () => {
  const personaData = {
    petitionerName: "Katie O'Brien-Hatch", // go-by; full legal names below
    respondentName: 'Daniel Hatch',
    childSupportObligee: "Kathleen O'Brien-Hatch",
    childSupportObligor: 'Daniel James Hatch',
    childSupportPayor: 'respondent',
    state: 'UT',
    county: 'Salt Lake',
    monthlyIncome: 8600, // legacy household total (3400 + 5200)
    incomeBreakdown: [
      {
        label: "Katie O'Brien-Hatch wages as office manager at a dental office",
        amount: 3400,
        person: 'petitioner',
      },
      { label: 'Daniel Hatch wages as HVAC technician', amount: 5200, person: 'respondent' },
    ],
    monthlyExpenses: 3100,
    expenseBreakdown: [
      { label: 'Mortgage', amount: 1450 },
      { label: 'Groceries', amount: 700 },
      { label: 'Utilities', amount: 300 },
      { label: 'Gas and car insurance', amount: 400 },
      { label: "Children's activities", amount: 250 },
    ],
  };

  test('swears only the declarant\'s own income — never the household total', () => {
    const structure = utah.financialDeclaration(personaData);
    const text = textOf(structure);
    expect(text).toContain('TOTAL MONTHLY INCOME: $3,400');
    expect(text).not.toContain('$8,600');
    // The spouse's income appears nowhere on the declarant's declaration
    expect(text).not.toContain('Daniel Hatch wages as HVAC technician');
    expect(text).not.toContain('$5,200');
    // Her own itemized wages remain
    expect(text).toContain('office manager at a dental office');
    // The household-scalar detection is surfaced as a warning
    expect(structure.metadata.warnings.join(' ')).toMatch(/household total/i);
    // Expenses are unaffected
    expect(text).toContain('TOTAL MONTHLY EXPENSES: $3,100');
  });

  test('caption matches the petition: full legal names + IN AND FOR court line', () => {
    const { sections } = utah.financialDeclaration(personaData);
    expect(sections.header).toBe(
      'IN THE DISTRICT COURT OF THE STATE OF UTAH, IN AND FOR SALT LAKE COUNTY',
    );
    expect(sections.caseCaption.formatted).toContain("KATHLEEN O'BRIEN-HATCH");
    expect(sections.caseCaption.formatted).toContain('DANIEL JAMES HATCH');
    expect(sections.caseCaption.formatted).not.toContain('KATIE');
    expect(sections.introduction).toContain("I, Kathleen O'Brien-Hatch");
    expect(sections.signatureBlock.name).toBe("Kathleen O'Brien-Hatch");
  });

  test('unknowable income → [MONTHLY INCOME] placeholder plus a validation warning', () => {
    const structure = utah.financialDeclaration({
      petitionerName: 'Jane Q. Example',
      // scalar merely echoes the spouse's itemized income — not the declarant's
      monthlyIncome: 5200,
      incomeBreakdown: [
        { label: 'Spouse wages', amount: 5200, person: 'respondent' },
      ],
    });
    const text = textOf(structure);
    expect(text).toContain('TOTAL MONTHLY INCOME: [MONTHLY INCOME]');
    expect(text).not.toContain('TOTAL MONTHLY INCOME: $5,200');
    expect(text).toContain('fill this in before signing');
    expect(structure.metadata.warnings.length).toBeGreaterThan(0);
    expect(structure.metadata.warnings.join(' ')).toMatch(/not on file/i);
  });

  test('no income data at all → placeholder, never $0 or a blank number', () => {
    const structure = utah.financialDeclaration({ petitionerName: 'Jane Q. Example' });
    const text = textOf(structure);
    expect(text).toContain('TOTAL MONTHLY INCOME: [MONTHLY INCOME]');
    expect(text).not.toContain('TOTAL MONTHLY INCOME: $0');
    expect(structure.metadata.warnings.join(' ')).toMatch(/placeholder/i);
  });

  test('an explicitly declared zero income is sworn as $0, not a placeholder', () => {
    const text = textOf(
      utah.financialDeclaration({ petitionerName: 'Jane Q. Example', monthlyIncome: 0 }),
    );
    expect(text).toContain('TOTAL MONTHLY INCOME: $0');
    expect(text).not.toContain('[MONTHLY INCOME]');
  });
});

// ─── live-QA regression (katie2 replay, 2026-08): names + employment ─────────
// The Child Support Worksheet printed the go-by ("The children live most of
// the time with: Katie O'Brien-Hatch") while every caption used the full
// legal name; the Financial Declaration's Employment line rendered blank
// despite "office manager at a dental office" sitting in the income labels.
describe('supportDocs — persona regression (go-by upgrade + employment)', () => {
  const personaData = {
    petitionerName: "Katie O'Brien-Hatch", // go-by; legal names in obligation fields
    respondentName: 'Daniel Hatch',
    childSupportObligee: "Kathleen O'Brien-Hatch",
    childSupportObligor: 'Daniel James Hatch',
    childSupportPayor: 'respondent',
    primaryCustodian: "Katie O'Brien-Hatch",
    state: 'UT',
    county: 'Salt Lake',
    children: [
      { name: 'Emma Rose Hatch', dob: '2014-08-03' },
      { name: 'Lucas Daniel Hatch', dob: '2018-05-19' },
    ],
    incomeBreakdown: [
      {
        label: "Katie O'Brien-Hatch wages as office manager at a dental office",
        amount: 3400,
        person: 'petitioner',
      },
      { label: 'Daniel Hatch wages as HVAC technician', amount: 5200, person: 'respondent' },
    ],
  };

  test('child support worksheet names the custodian by full legal name, not the go-by', () => {
    const builder = getSupportDoc('UT', 'child_support_worksheet');
    const structure = builder(personaData, {});
    const first = structure.sections.facts.items[0].content;
    expect(first).toContain(
      "The children live most of the time with: Kathleen O'Brien-Hatch.",
    );
    expect(first).not.toContain("with: Katie O'Brien-Hatch");
  });

  test('upgradeToLegalName never substitutes across people or on ambiguity', () => {
    // Different surname/initial: untouched.
    expect(utah.upgradeToLegalName(personaData, 'Daniel Hatch')).toBe('Daniel James Hatch');
    expect(utah.upgradeToLegalName(personaData, 'Somebody Else')).toBe('Somebody Else');
    // Both parties sharing surname + initial → ambiguous → unchanged.
    const shared = {
      petitionerName: 'Dana Hatch',
      respondentName: 'Daniel Hatch',
      petitionerFullLegalName: 'Dana Marie Hatch',
      respondentFullLegalName: 'Daniel James Hatch',
    };
    expect(utah.upgradeToLegalName(shared, 'D. Hatch')).toBe('D. Hatch');
    expect(utah.upgradeToLegalName(personaData, '')).toBe('');
  });

  test("financial declaration derives Employment from the declarant's own income label", () => {
    const { sections } = utah.financialDeclaration(personaData);
    const employmentLine = sections.facts.items[0].content;
    expect(employmentLine).toBe(
      'Employment (employer and job): office manager at a dental office.',
    );
    // Never the spouse's job on the declarant's declaration
    expect(employmentLine).not.toContain('HVAC');
  });

  test('an explicit occupation field still wins over derived labels', () => {
    const { sections } = utah.financialDeclaration({
      ...personaData,
      occupation: 'dental office manager (Smile Dental, SLC)',
    });
    expect(sections.facts.items[0].content).toBe(
      'Employment (employer and job): dental office manager (Smile Dental, SLC).',
    );
  });

  test('bare category labels ("Wages") never masquerade as employment — blank instead', () => {
    const { sections } = utah.financialDeclaration({
      petitionerName: 'Jane Q. Example',
      incomeBreakdown: [
        { label: 'Wages', amount: 3200, person: 'petitioner' },
        { label: 'Side business', amount: 800, person: 'petitioner' },
      ],
    });
    expect(sections.facts.items[0].content).toMatch(
      /^Employment \(employer and job\): _+\.$/,
    );
  });
});

// ─── Texas support docs — Rule 145 + financial info statement ────────────────
const texas = require('../../services/supportDocs/texas');

describe('texas support doc builders — shape', () => {
  const builders = {
    statement_of_inability: texas.statementOfInability,
    financial_declaration: texas.financialInformationStatement,
  };
  const baseData = {
    petitionerName: 'Mari Elena Delgado',
    respondentName: 'Rafael Delgado',
    state: 'TX',
    county: 'Travis',
    caseNumber: 'D-1-FM-26-000123',
    monthlyIncome: 2100,
    monthlyExpenses: 2400,
    dependentsCount: 0,
  };

  test.each(Object.entries(builders))(
    '%s returns a pdfService-renderable affidavit structure',
    (kind, build) => {
      const structure = build(baseData);
      expect(structure.state).toBe('TX');
      expect(structure.documentType).toBe('affidavit');
      expect(structure.metadata.kind).toBe(kind);
      expect(structure.sections).toBeDefined();
      expect(typeof structure.sections.title).toBe('string');
      expect(Array.isArray(structure.sections.facts.items)).toBe(true);
      expect(structure.sections.facts.items.length).toBeGreaterThan(0);
      structure.sections.facts.items.forEach((item, idx) => {
        expect(item.number).toBe(idx + 1);
        expect(typeof item.content).toBe('string');
        expect(item.content.length).toBeGreaterThan(0);
      });
    },
  );

  test('court filings carry the TX district-court caption + full legal names', () => {
    for (const build of Object.values(builders)) {
      const { sections } = build(baseData);
      expect(sections.header).toBe('IN THE DISTRICT COURT OF TRAVIS COUNTY, TEXAS');
      expect(sections.caseCaption.formatted).toContain('MARI ELENA DELGADO');
      expect(sections.caseCaption.formatted).toContain('RAFAEL DELGADO');
      expect(sections.caseCaption.formatted).toContain('CAUSE NO. D-1-FM-26-000123');
      expect(sections.caseCaption.formatted).toContain('IN THE MATTER OF');
      expect(sections.caseCaption.formatted).toContain('THE MARRIAGE OF');
    }
  });

  test('county trailing "County" is normalized before caption interpolation', () => {
    const { sections } = texas.statementOfInability({ ...baseData, county: 'Travis County' });
    expect(sections.header).toBe('IN THE DISTRICT COURT OF TRAVIS COUNTY, TEXAS');
    expect(sections.header).not.toMatch(/COUNTY COUNTY/);
  });

  test('unsworn declaration (Tex. Civ. Prac. & Rem. Code § 132.001) is the default', () => {
    const { sections } = texas.statementOfInability(baseData);
    expect(sections.perjuryStatement).toMatch(/under penalty of perjury/);
    expect(sections.perjuryStatement).toMatch(/§ 132\.001/);
    expect(sections.notaryBlock).toBeNull();
  });

  test('notary variant renders the subscribed-and-sworn block instead', () => {
    const { sections } = texas.statementOfInability(baseData, { signatureStyle: 'notary' });
    expect(sections.notaryBlock).toContain('Subscribed and sworn to before me');
    expect(sections.notaryBlock).toContain('STATE OF TEXAS');
    expect(sections.perjuryStatement).toBeNull();
  });
});

describe('texas statement of inability — Rule 145 form fields (Mari)', () => {
  const mari = {
    petitionerName: 'Mari Elena Delgado',
    respondentName: 'Rafael Delgado',
    state: 'TX',
    county: 'Travis',
    caseNumber: 'D-1-FM-26-000123',
    monthlyIncome: 2100,
    monthlyExpenses: 2400,
    dependentsCount: 0,
    expenseBreakdown: [
      { label: 'Rent', amount: 1100 },
      { label: 'Utilities', amount: 250 },
      { label: 'Groceries', amount: 500 },
      { label: 'Transportation', amount: 250 },
      { label: 'Medical', amount: 300 },
    ],
    incomeBreakdown: [
      { label: 'Mari Elena Delgado wages as home health aide', amount: 2100, person: 'petitioner' },
    ],
    assetsDescription: '2011 Toyota Corolla; checking account $220',
    publicBenefits: 'SNAP (approx. $180/mo)',
  };

  test('title uses the Rule 145 SCOTX-adopted heading', () => {
    const { sections } = texas.statementOfInability(mari);
    expect(sections.title).toBe(
      'STATEMENT OF INABILITY TO AFFORD PAYMENT OF COURT COSTS OR AN APPEAL BOND',
    );
  });

  test('recites Rule 145 (Tex. R. Civ. P. 145) as the requested relief', () => {
    const text = textOf(texas.statementOfInability(mari));
    expect(text).toMatch(/Tex\. R\. Civ\. P\. 145/);
    expect(text).toContain('waive their payment');
  });

  test("swears the declarant's monthly income + expenses + dependents from Mari's data", () => {
    const structure = texas.statementOfInability(mari);
    const text = textOf(structure);
    expect(text).toContain('TOTAL MONTHLY INCOME: $2,100');
    expect(text).toContain('TOTAL MONTHLY EXPENSES: $2,400');
    expect(text).toContain('financially dependent on me (including myself): 0');
    // Itemized rows carry through
    expect(text).toContain('Mari Elena Delgado wages as home health aide');
    expect(text).toContain('Rent');
    expect(text).toContain('$1,100');
    // Public benefits recited when on file
    expect(text).toContain('SNAP (approx. $180/mo)');
  });

  test('missing income → [MONTHLY INCOME] placeholder plus a warning (blank beats wrong number)', () => {
    const structure = texas.statementOfInability({
      petitionerName: 'Mari Elena Delgado',
      respondentName: 'Rafael Delgado',
      state: 'TX',
      county: 'Travis',
      monthlyExpenses: 2400,
      dependentsCount: 0,
    });
    const text = textOf(structure);
    expect(text).toContain('TOTAL MONTHLY INCOME: [MONTHLY INCOME]');
    expect(text).not.toContain('TOTAL MONTHLY INCOME: $0');
    expect(structure.metadata.warnings.length).toBeGreaterThan(0);
    expect(structure.metadata.warnings.join(' ')).toMatch(/not on file/i);
  });

  test('missing dependents count renders a placeholder + warning, never asserts 0', () => {
    const structure = texas.statementOfInability({
      petitionerName: 'Mari Elena Delgado',
      state: 'TX',
      county: 'Travis',
      monthlyIncome: 2100,
      monthlyExpenses: 2400,
    });
    const text = textOf(structure);
    expect(text).toContain('financially dependent on me (including myself): [NUMBER]');
    expect(structure.metadata.warnings.join(' ')).toMatch(/dependents/i);
  });

  test('signatureBlock carries the declarant full legal name, titled Declarant', () => {
    const { sections } = texas.statementOfInability(mari);
    expect(sections.signatureBlock.name).toBe('Mari Elena Delgado');
    expect(sections.signatureBlock.title).toBe('Declarant');
  });
});

describe('texas statement of inability — expense rendering (breakdown vs scalar vs missing)', () => {
  const marisBase = {
    petitionerName: 'Mari Elena Delgado',
    respondentName: 'Rafael Delgado',
    state: 'TX',
    county: 'Travis',
    caseNumber: 'D-1-FM-26-000123',
    monthlyIncome: 2100,
    dependentsCount: 0,
  };

  test('scalar monthlyExpenses only (no breakdown) renders one line + real total', () => {
    // Regression: extraction sometimes stores only the scalar `monthlyExpenses`
    // — the Rule 145 form used to swallow it as "(no itemized expenses on file)"
    // with TOTAL MONTHLY EXPENSES: $0. It must instead render the scalar.
    const structure = texas.statementOfInability({
      ...marisBase,
      monthlyExpenses: 2400,
    });
    const text = textOf(structure);
    expect(text).toContain('Monthly expenses: $2,400');
    expect(text).toContain('TOTAL MONTHLY EXPENSES: $2,400');
    expect(text).not.toContain('(no itemized expenses on file)');
    expect(text).not.toContain('TOTAL MONTHLY EXPENSES: $0');
    // No expense warning when the scalar IS on file.
    const warnings = structure.metadata.warnings || [];
    expect(warnings.join(' ')).not.toMatch(/expenses are not on file/i);
  });

  test('expenseBreakdown wins over the scalar and itemizes each row', () => {
    const structure = texas.statementOfInability({
      ...marisBase,
      monthlyExpenses: 9999, // stale scalar — the itemized rows should win
      expenseBreakdown: [
        { label: 'Rent', amount: 1100 },
        { label: 'Utilities', amount: 250 },
        { label: 'Groceries', amount: 500 },
        { label: 'Transportation', amount: 250 },
        { label: 'Medical', amount: 300 },
      ],
    });
    const text = textOf(structure);
    expect(text).toContain('Rent');
    expect(text).toContain('Utilities');
    expect(text).toContain('Groceries');
    expect(text).toContain('$1,100');
    expect(text).toContain('TOTAL MONTHLY EXPENSES: $2,400');
    expect(text).not.toContain('Monthly expenses: $2,400'); // that line is scalar-only
    expect(text).not.toContain('$9,999');
  });

  test('missing both breakdown and scalar → placeholder + warning (blank beats wrong number)', () => {
    const structure = texas.statementOfInability({ ...marisBase });
    const text = textOf(structure);
    expect(text).toContain('TOTAL MONTHLY EXPENSES: [MONTHLY EXPENSES]');
    expect(text).toContain('(no itemized expenses on file)');
    expect((structure.metadata.warnings || []).join(' ')).toMatch(/expenses are not on file/i);
  });

  test("expenseBreakdown tagged to the SPOUSE never leaks onto the declarant's sworn form", () => {
    // Mirror partyIncome.js's side attribution: person-tagged entries only
    // count for the side they name; untagged entries are the declarant's own.
    const structure = texas.statementOfInability({
      ...marisBase,
      expenseBreakdown: [
        { label: 'Rent', amount: 1100, person: 'petitioner' },
        { label: 'Spouse gym membership', amount: 200, person: 'respondent' },
        { label: 'Utilities', amount: 250 }, // untagged → declarant's own
      ],
    });
    const text = textOf(structure);
    expect(text).toContain('Rent');
    expect(text).toContain('Utilities');
    expect(text).not.toContain('Spouse gym membership');
    expect(text).toContain('TOTAL MONTHLY EXPENSES: $1,350');
  });
});

// ─── Utah fee-waiver — same expense-scalar fallback pattern ─────────────────
const utahFeeWaiver = require('../../services/supportDocs/utahFeeWaiver');

describe('utah fee-waiver motion — expense rendering (breakdown vs scalar vs missing)', () => {
  const base = {
    petitionerName: 'Jane Q. Example',
    respondentName: 'John Q. Example',
    state: 'UT',
    county: 'Salt Lake',
    caseNumber: '244900000',
    monthlyIncome: 2100,
  };

  test('scalar monthlyExpenses only renders as one line + real total', () => {
    const structure = utahFeeWaiver.feeWaiverMotion({ ...base, monthlyExpenses: 2400 });
    const text = textOf(structure);
    expect(text).toContain('Monthly expenses: $2,400');
    expect(text).toContain('TOTAL MONTHLY EXPENSES: $2,400');
    expect(text).not.toContain('(no itemized expenses on file)');
  });

  test('expenseBreakdown itemizes and wins over scalar', () => {
    const structure = utahFeeWaiver.feeWaiverMotion({
      ...base,
      monthlyExpenses: 9999,
      expenseBreakdown: [
        { label: 'Rent', amount: 1100 },
        { label: 'Utilities', amount: 250 },
      ],
    });
    const text = textOf(structure);
    expect(text).toContain('Rent');
    expect(text).toContain('TOTAL MONTHLY EXPENSES: $1,350');
    expect(text).not.toContain('Monthly expenses: $1,350');
    expect(text).not.toContain('$9,999');
  });

  test('missing both → placeholder + warning', () => {
    const structure = utahFeeWaiver.feeWaiverMotion({ ...base });
    const text = textOf(structure);
    expect(text).toContain('(no itemized expenses on file)');
    expect((structure.metadata.warnings || []).join(' ')).toMatch(/expenses are not on file/i);
  });
});

describe("texas Petitioner's Financial Information Statement", () => {
  test('labels the doc honestly — NOT "Financial Declaration under Rule 26.1"', () => {
    const structure = texas.financialInformationStatement({
      petitionerName: 'Mari Elena Delgado',
      state: 'TX',
      county: 'Travis',
      monthlyIncome: 2100,
      monthlyExpenses: 2400,
    });
    expect(structure.sections.title).toBe(
      "PETITIONER'S FINANCIAL INFORMATION STATEMENT",
    );
    const text = textOf(structure);
    expect(text).not.toMatch(/Rule 26\.1/);
    // Truthful disclaimer: TX has no single statewide financial declaration form
    expect(structure.sections.conclusion).toMatch(/does not publish a single statewide/i);
    // References Rule 194 initial disclosures rather than pretending to BE them
    expect(structure.sections.conclusion).toMatch(/194/);
  });

  test('empty income + expenses → placeholders and warnings, never asserted $0', () => {
    const structure = texas.financialInformationStatement({
      petitionerName: 'Mari Elena Delgado',
      state: 'TX',
      county: 'Travis',
    });
    const text = textOf(structure);
    expect(text).toContain('TOTAL MONTHLY INCOME: [MONTHLY INCOME]');
    expect(text).toContain('TOTAL MONTHLY EXPENSES: [MONTHLY EXPENSES]');
    expect(structure.metadata.warnings.length).toBeGreaterThan(0);
  });
});

// ─── Bug 1 acceptance-shape payloads (TX Mari, acceptance v6) ──────────────
// The Rule 145 Statement of Inability + Financial Information Statement kept
// rendering "Monthly expenses: $0    TOTAL MONTHLY EXPENSES: $0" even when
// the caller explicitly passed monthlyExpenses: 2400. These lock in the two
// payload shapes the acceptance run actually hands the builders:
//   1. a FLAT payload — `{state:"TX", monthlyIncome:2100, monthlyExpenses:2400}`
//   2. a WRAPPED payload — `{affidavitData: {state:"TX", monthlyExpenses:2400}}`
// Both must render $2,400; the scalar-fallback fix must not swallow either.

describe('BUG 1 — TX acceptance payload: monthlyExpenses scalar reaches the sworn form', () => {
  const marisAcceptancePayload = {
    petitionerName: 'Mari Elena Delgado',
    respondentName: 'Rafael Delgado',
    state: 'TX',
    county: 'Travis',
    caseNumber: 'D-1-FM-26-000123',
    monthlyIncome: 2100,
    monthlyExpenses: 2400,
    dependentsCount: 0,
  };

  test('Rule 145 Statement of Inability shows TOTAL MONTHLY EXPENSES: $2,400 (flat payload)', () => {
    const structure = texas.statementOfInability(marisAcceptancePayload);
    const text = textOf(structure);
    expect(text).toContain('TOTAL MONTHLY EXPENSES: $2,400');
    expect(text).not.toContain('TOTAL MONTHLY EXPENSES: $0');
    expect(text).not.toContain('Monthly expenses: $0');
  });

  test('Financial Information Statement shows TOTAL MONTHLY EXPENSES: $2,400 (flat payload)', () => {
    const structure = texas.financialInformationStatement(marisAcceptancePayload);
    const text = textOf(structure);
    expect(text).toContain('TOTAL MONTHLY EXPENSES: $2,400');
    expect(text).not.toContain('TOTAL MONTHLY EXPENSES: $0');
    expect(text).not.toContain('Monthly expenses: $0');
  });

  test('Rule 145 Statement of Inability shows $2,400 when caller wraps payload as { affidavitData }', () => {
    // The acceptance run also invokes the builder with the request body as-is
    // — `{ affidavitData: {...} }` rather than the flattened editor blob. The
    // builders must unwrap the nested object rather than swallowing every
    // field as "not on file" and rendering $0.
    const structure = texas.statementOfInability({ affidavitData: marisAcceptancePayload });
    const text = textOf(structure);
    expect(text).toContain('TOTAL MONTHLY EXPENSES: $2,400');
    expect(text).not.toContain('TOTAL MONTHLY EXPENSES: $0');
  });

  test('Financial Information Statement shows $2,400 with wrapped { affidavitData } payload', () => {
    const structure = texas.financialInformationStatement({ affidavitData: marisAcceptancePayload });
    const text = textOf(structure);
    expect(text).toContain('TOTAL MONTHLY EXPENSES: $2,400');
  });

  test('utahFeeWaiver mirrors the fix: wrapped { affidavitData } renders $2,400 not $0', () => {
    const utahBase = {
      petitionerName: 'Jane Q. Example',
      respondentName: 'John Q. Example',
      state: 'UT',
      county: 'Salt Lake',
      caseNumber: '244900000',
      monthlyIncome: 2100,
      monthlyExpenses: 2400,
    };
    const structure = utahFeeWaiver.feeWaiverMotion({ affidavitData: utahBase });
    const text = textOf(structure);
    expect(text).toContain('TOTAL MONTHLY EXPENSES: $2,400');
    expect(text).not.toContain('TOTAL MONTHLY EXPENSES: $0');
  });
});
