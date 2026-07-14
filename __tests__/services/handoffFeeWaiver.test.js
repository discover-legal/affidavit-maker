/** @jest-environment node */
// Tests for the lawyer-handoff summary and Utah fee-waiver motion builders.
// Builders are pure (data, opts) => documentStructure functions, so no mocks.

const { lawyerHandoff } = require('../../services/supportDocs/lawyerHandoff');
const { feeWaiverMotion } = require('../../services/supportDocs/utahFeeWaiver');

const UNSWORN_WORDING =
  'I declare under criminal penalty of the State of Utah that the foregoing is true and correct.';

const sampleData = {
  petitionerName: 'Jane Q. Example',
  respondentName: 'John R. Example',
  state: 'UT',
  county: 'Salt Lake',
  caseNumber: '244900123',
  matterType: 'divorce',
  marriageDate: '2012-06-15',
  separationDate: '2025-11-01',
  children: [
    { name: 'Emma Example', dob: '2015-04-02' },
    { name: 'Liam Example', dob: '2018-09-10' },
  ],
  childrenLiveWith: 'petitioner, in the family home',
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
  petitionerDebts: 'Visa card $4,000',
  keyEvents: [
    { label: 'Respondent served with petition', date: '2026-03-02' },
    { label: 'Petition filed', date: '2026-02-10' },
  ],
  profileFacts: [
    {
      content: 'I moved out of the family home on November 1, 2025.',
      sourceQuote: 'I packed up and left on Nov 1st, the kids stayed with me',
      section: 'separation',
    },
    { content: 'My spouse handles the joint checking account.' },
  ],
  generatedDocuments: ['Petition for Divorce', 'Financial Declaration'],
};

/** Flatten a structure's sections to one searchable string. */
function textOf(structure) {
  return JSON.stringify(structure.sections);
}

describe('shared structure shape', () => {
  test.each([
    ['lawyer_handoff', lawyerHandoff],
    ['fee_waiver_motion', feeWaiverMotion],
  ])('%s returns a pdfService-renderable affidavit structure', (kind, build) => {
    const structure = build(sampleData);
    expect(structure.documentType).toBe('affidavit');
    expect(structure.kind).toBe(kind);
    expect(structure.metadata.supportDoc).toBe(true);
    expect(structure.metadata.kind).toBe(kind);
    expect(typeof structure.sections.title).toBe('string');
    expect(Array.isArray(structure.sections.facts.items)).toBe(true);
    expect(structure.sections.facts.items.length).toBeGreaterThan(0);
    structure.sections.facts.items.forEach((item, idx) => {
      expect(item.number).toBe(idx + 1);
      expect(typeof item.content).toBe('string');
      expect(item.content.length).toBeGreaterThan(0);
    });
  });

  test.each([
    ['lawyer_handoff', lawyerHandoff],
    ['fee_waiver_motion', feeWaiverMotion],
  ])('%s never throws on empty, null-ish, or junk data', (kind, build) => {
    expect(() => build()).not.toThrow();
    expect(() => build({})).not.toThrow();
    expect(() =>
      build({
        children: 'not-an-array',
        keyEvents: [null, 42, { label: '' }],
        incomeBreakdown: {},
        expenseBreakdown: [null, 'x'],
        profileFacts: [null, { content: '' }, 'junk'],
        generatedDocuments: [null, '', 7],
      }),
    ).not.toThrow();
    const structure = build({});
    expect(structure.documentType).toBe('affidavit');
    expect(structure.sections.facts.items.length).toBeGreaterThan(0);
  });
});

describe('lawyerHandoff', () => {
  test('is a plain summary, not a filing: no caption, no signature, no oath', () => {
    const { sections } = lawyerHandoff(sampleData);
    expect(sections.title).toBe('CASE SUMMARY FOR ATTORNEY REVIEW');
    expect(sections.header).toBeNull();
    expect(sections.caseCaption).toBeNull();
    expect(sections.signatureBlock).toBeNull();
    expect(sections.perjuryStatement).toBeNull();
    expect(sections.notaryBlock).toBeNull();
    // Prominent first line: prepared with software, not a filing
    expect(sections.introduction.split('\n')[0]).toContain('document-preparation software');
    expect(sections.introduction.split('\n')[0]).toContain('NOT a court filing');
  });

  test('notary opt does not sneak a signature onto the handoff', () => {
    const { sections } = lawyerHandoff(sampleData, { signatureStyle: 'notary' });
    expect(sections.signatureBlock).toBeNull();
    expect(sections.notaryBlock).toBeNull();
  });

  test('snapshot carries parties, location, dates, matter, and children', () => {
    const text = textOf(lawyerHandoff(sampleData));
    expect(text).toContain('SNAPSHOT');
    expect(text).toContain('Jane Q. Example (petitioner) and John R. Example (respondent)');
    expect(text).toContain('Salt Lake County, UT');
    expect(text).toContain('Matter type: divorce');
    expect(text).toContain('Married: 2012-06-15');
    expect(text).toContain('Separated: 2025-11-01');
    expect(text).toContain('Emma Example (born 2015)');
    expect(text).toContain('Liam Example (born 2018)');
    expect(text).toContain('currently with: petitioner, in the family home');
  });

  test('timeline sorts keyEvents by date when all dates parse', () => {
    const text = textOf(lawyerHandoff(sampleData));
    // sample data lists 'served' first but 'filed' is earlier
    const filedIdx = text.indexOf('2026-02-10 — Petition filed');
    const servedIdx = text.indexOf('2026-03-02 — Respondent served with petition');
    expect(filedIdx).toBeGreaterThan(-1);
    expect(servedIdx).toBeGreaterThan(-1);
    expect(filedIdx).toBeLessThan(servedIdx);
  });

  test('timeline keeps original order when a date is unparseable', () => {
    const structure = lawyerHandoff({
      keyEvents: [
        { label: 'Second thing', date: 'sometime last spring' },
        { label: 'First thing', date: '2026-01-05' },
      ],
    });
    const text = textOf(structure);
    expect(text.indexOf('Second thing')).toBeLessThan(text.indexOf('First thing'));
  });

  test("the user's account renders numbered statements with provenance lines", () => {
    const { sections } = lawyerHandoff(sampleData);
    const withQuote = sections.facts.items.find((i) =>
      i.content.includes('I moved out of the family home'),
    );
    expect(withQuote).toBeDefined();
    expect(withQuote.content).toContain(
      'User\'s own words: "I packed up and left on Nov 1st, the kids stayed with me"',
    );
    // A fact without a sourceQuote carries no provenance line
    const withoutQuote = sections.facts.items.find((i) =>
      i.content.includes('joint checking account.'),
    );
    expect(withoutQuote).toBeDefined();
    expect(withoutQuote.content).not.toContain("User's own words");
  });

  test('provenance quotes are truncated to 200 characters', () => {
    const longQuote = 'x'.repeat(300);
    const structure = lawyerHandoff({
      profileFacts: [{ content: 'A fact.', sourceQuote: longQuote }],
    });
    const item = structure.sections.facts.items.find((i) => i.content.includes('A fact.'));
    const quoted = item.content.match(/"([^"]+)"/)[1];
    expect(quoted.length).toBeLessThanOrEqual(200);
    expect(quoted.endsWith('…')).toBe(true);
  });

  test('finances total from the breakdowns, ignoring stale monthlyIncome', () => {
    const text = textOf(lawyerHandoff(sampleData));
    expect(text).toContain('Total monthly income: $4,000');
    expect(text).not.toContain('$9,999');
    expect(text).toContain('Total monthly expenses: $1,750');
    expect(text).toContain('Wages (petitioner): $3,200');
    expect(text).toContain('2014 Honda Civic; joint checking account');
    expect(text).toContain('Visa card $4,000');
  });

  test('lists generated documents when provided', () => {
    const text = textOf(lawyerHandoff(sampleData));
    expect(text).toContain('DOCUMENTS PREPARED SO FAR');
    expect(text).toContain('Petition for Divorce');
    expect(text).toContain('Financial Declaration');
  });

  test('absent sections are skipped cleanly', () => {
    const sparse = lawyerHandoff({ petitionerName: 'Jane Q. Example' });
    const text = textOf(sparse);
    expect(text).not.toContain('TIMELINE');
    expect(text).not.toContain("THE USER'S ACCOUNT");
    expect(text).not.toContain('FINANCES');
    expect(text).not.toContain('DOCUMENTS PREPARED SO FAR');
    // Snapshot still present (we know one party), and questions always scaffold
    expect(text).toContain('SNAPSHOT');
    expect(text).toContain('QUESTIONS THE USER MAY WANT TO ASK');
  });

  test('questions adapt to what is true in the data, framed as questions', () => {
    const full = textOf(lawyerHandoff(sampleData));
    expect(full).toContain('parenting schedule');
    expect(full).toContain('child support');
    expect(full).toContain('property and debts');
    expect(full).toContain('date of service in my timeline, what deadlines');

    const noKids = textOf(lawyerHandoff({ ...sampleData, children: [] }));
    expect(noKids).not.toContain('parenting schedule');

    const noService = textOf(lawyerHandoff({ ...sampleData, keyEvents: [] }));
    expect(noService).not.toContain('what deadlines am I facing');

    const bare = lawyerHandoff({});
    const bareText = textOf(bare);
    expect(bareText).not.toContain('parenting schedule');
    expect(bareText).not.toContain('property and debts');
    // Baseline consult questions always present, and every scaffold entry is a question
    expect(bareText).toContain('limited-scope');
    const questionItems = bare.sections.facts.items.filter((i) => i.content.includes('- '));
    expect(questionItems.length).toBeGreaterThan(0);
    questionItems.forEach((i) => {
      i.content
        .split('\n')
        .filter((line) => line.startsWith('- '))
        .forEach((line) => expect(line.trim().endsWith('?')).toBe(true));
    });
  });

  test('footer has the prepared-date placeholder and LawHelp.org pointer', () => {
    const { sections } = lawyerHandoff(sampleData);
    expect(sections.conclusion).toContain('Prepared on: ______________');
    expect(sections.conclusion).toContain('limited-scope');
    expect(sections.conclusion).toContain('LawHelp.org');
  });
});

describe('feeWaiverMotion', () => {
  test('two-part structure: motion then supporting statement, with statute cites', () => {
    const { sections } = feeWaiverMotion(sampleData);
    expect(sections.title).toBe('MOTION TO WAIVE FEES');
    expect(sections.header).toBe('IN THE DISTRICT COURT OF SALT LAKE COUNTY, STATE OF UTAH');
    expect(sections.caseCaption.formatted).toContain('Case No. 244900123');
    const text = textOf(feeWaiverMotion(sampleData));
    expect(text).toContain('78A-2-302');
    expect(text).toContain('78A-2-304');
    expect(text).toContain('STATEMENT SUPPORTING MOTION TO WAIVE FEES');
    // The motion asks; it never concludes the court must grant
    expect(sections.introduction).toContain('ask the court to waive the fees');
  });

  test('totals math from the breakdowns, ignoring stale monthlyIncome', () => {
    const text = textOf(feeWaiverMotion(sampleData));
    expect(text).toContain('TOTAL MONTHLY GROSS INCOME: $4,000');
    expect(text).not.toContain('$9,999');
    expect(text).toContain('TOTAL MONTHLY EXPENSES: $1,750');
    expect(text).toContain('Wages (petitioner)');
    expect(text).toContain('$3,200');
  });

  test('falls back to monthlyIncome when there is no breakdown', () => {
    const text = textOf(
      feeWaiverMotion({ petitionerName: 'Jane', monthlyIncome: 2500 }),
    );
    expect(text).toContain('TOTAL MONTHLY GROSS INCOME: $2,500');
  });

  test('household size is 1 + children, stated as a correctable assumption', () => {
    const text = textOf(feeWaiverMotion(sampleData));
    expect(text).toContain('HOUSEHOLD SIZE: 3 (myself plus 2 children)');
    expect(text).toContain('correct it if');

    const solo = textOf(feeWaiverMotion({ petitionerName: 'Jane' }));
    expect(solo).toContain('HOUSEHOLD SIZE: 1 (myself)');
  });

  test('public benefits render as blank checklist lines', () => {
    const text = textOf(feeWaiverMotion(sampleData));
    expect(text).toContain('[ ] SNAP (food stamps)');
    expect(text).toContain('[ ] Medicaid');
    expect(text).toContain('[ ] SSI');
    expect(text).toContain('[ ] Other:');
  });

  test('FPG percentage line present when income is known — neutral, court decides', () => {
    const { sections } = feeWaiverMotion(sampleData);
    // income 4000/mo → 48000/yr; household 3 → 15650 + 2*5500 = 26650; 48000/26650 ≈ 180%
    const fpgItem = sections.facts.items.find((i) =>
      i.content.includes('federal poverty guideline'),
    );
    expect(fpgItem).toBeDefined();
    expect(fpgItem.content).toContain('approximately 180%');
    expect(fpgItem.content).toContain('household of 3');
    expect(fpgItem.content).toContain("court's decision");
    // Never an eligibility conclusion
    expect(fpgItem.content).not.toMatch(/qualif|eligib|should grant|entitled/i);
  });

  test('FPG line absent when there is no income data', () => {
    const text = textOf(feeWaiverMotion({ petitionerName: 'Jane' }));
    expect(text).not.toContain('federal poverty guideline');
    // Unknown totals render as blanks rather than $0
    expect(text).toContain('TOTAL MONTHLY GROSS INCOME: ______________');
  });

  test('unsworn declaration is the default signature style', () => {
    const { sections } = feeWaiverMotion(sampleData);
    expect(sections.perjuryStatement).toContain(UNSWORN_WORDING);
    expect(sections.notaryBlock).toBeNull();
    expect(sections.signatureBlock.name).toBe('Jane Q. Example');
    expect(sections.signatureBlock.title).toBe('Movant');
  });

  test('notary variant renders the subscribed-and-sworn block instead', () => {
    const { sections } = feeWaiverMotion(sampleData, { signatureStyle: 'notary' });
    expect(sections.notaryBlock).toContain('Subscribed and sworn to before me');
    expect(sections.notaryBlock).toContain('Notary Public');
    expect(sections.perjuryStatement).toBeNull();
    expect(textOf(feeWaiverMotion(sampleData, { signatureStyle: 'notary' }))).not.toContain(
      UNSWORN_WORDING,
    );
  });

  test('assets and debts carried through; blanks for unknowns', () => {
    const text = textOf(feeWaiverMotion(sampleData));
    expect(text).toContain('2014 Honda Civic; joint checking account');
    expect(text).toContain('Visa card $4,000');

    const sparse = textOf(feeWaiverMotion({}));
    expect(sparse).toContain('ASSETS');
    expect(sparse).toContain('DEBTS (what I owe): ________________________________');
  });
});
