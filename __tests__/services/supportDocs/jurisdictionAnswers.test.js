/** @jest-environment node */
// Cross-jurisdiction Answer builder tests. Each of the newly registered
// jurisdictions (FL, GA, NY, TX, CA, ON, AB) exposes an
// answerToPetition(data, opts) built on services/supportDocs/BaseAnswerTemplate.js;
// the assertions here confirm every one:
//  - returns a pdfService-renderable affidavit structure
//  - captions Petitioner v. Respondent (or the jurisdiction's equivalent)
//    with the party names and case number the caller supplied
//  - carries a general-denial / position sentence
//  - renders a prayer / relief line
//  - contains no `[BRACKETED_SENTINEL]` placeholder tokens
//  - the signer is the party this filing represents

const path = require('path');

const JURISDICTIONS = [
  {
    file: 'floridaAnswer',
    state: 'FL',
    filerLabel: 'Respondent',
    opposingLabel: 'Petitioner',
    headerContains: ['CIRCUIT COURT', 'DUVAL COUNTY, FLORIDA'],
    counterTitle: 'COUNTERPETITION FOR DISSOLUTION OF MARRIAGE',
  },
  {
    file: 'georgiaAnswer',
    state: 'GA',
    filerLabel: 'Defendant',
    opposingLabel: 'Plaintiff',
    headerContains: ['SUPERIOR COURT', 'STATE OF GEORGIA'],
    counterTitle: 'COUNTERCLAIM FOR DIVORCE',
  },
  {
    file: 'newyorkAnswer',
    state: 'NY',
    filerLabel: 'Defendant',
    opposingLabel: 'Plaintiff',
    headerContains: ['SUPREME COURT', 'NEW YORK'],
    counterTitle: 'COUNTERCLAIM FOR DIVORCE',
  },
  {
    file: 'texasAnswer',
    state: 'TX',
    filerLabel: 'Respondent',
    opposingLabel: 'Petitioner',
    headerContains: ['DISTRICT COURT', 'TEXAS'],
    counterTitle: 'COUNTERPETITION FOR DIVORCE',
  },
  {
    file: 'californiaAnswer',
    state: 'CA',
    filerLabel: 'Respondent',
    opposingLabel: 'Petitioner',
    headerContains: ['SUPERIOR COURT OF CALIFORNIA'],
    counterTitle: 'AFFIRMATIVE RELIEF REQUESTED BY RESPONDENT',
  },
  {
    file: 'ontarioAnswer',
    state: 'ON',
    filerLabel: 'Respondent',
    opposingLabel: 'Applicant',
    headerContains: ['ONTARIO SUPERIOR COURT', 'Court File No'],
    counterTitle: 'RESPONDENT’S CLAIM',
  },
  {
    file: 'albertaAnswer',
    state: 'AB',
    filerLabel: 'Defendant',
    opposingLabel: 'Plaintiff',
    headerContains: ["COURT OF KING'S BENCH OF ALBERTA", 'Action No'],
    counterTitle: 'COUNTERCLAIM FOR DIVORCE',
  },
];

const sampleData = {
  role: 'respondent',
  petitionerName: 'Alice Q. Example',
  respondentName: 'Bob R. Example',
  county: 'Duval',
  courtLocation: 'Toronto',
  judicialCentre: 'Calgary',
  caseNumber: 'CASE-1234',
  marriageDate: '2018-03-15',
  marriageLocation: 'Miami, Florida',
  separationDate: '2025-08-01',
  children: [
    { name: 'Charlie Example', dob: '2020-06-12' },
    { name: 'Dana Example', birthDate: '2022-11-04' },
  ],
  answerPositions: [
    { paragraph: 1, position: 'admit' },
    { paragraph: 2, position: 'deny' },
    { paragraph: 3, position: 'lack_knowledge' },
  ],
  answerRequests: ['divide the marital property fairly', 'let each side pay their own debts'],
};

function textOf(structure) {
  return JSON.stringify(structure.sections);
}

/** Every un-rendered `[TOKEN]` sentinel any state's petition template can leave. */
const SENTINEL_RE = /\[[A-Z][A-Z0-9 _/-]{2,}\]/;

describe.each(JURISDICTIONS)('$file — Answer builder', (j) => {
  // eslint-disable-next-line import/no-dynamic-require, global-require
  const { answerToPetition } = require(path.join(
    '..',
    '..',
    '..',
    'services',
    'supportDocs',
    j.file,
  ));

  test('returns pdfService-renderable affidavit structure', () => {
    const structure = answerToPetition(sampleData);
    expect(structure.state).toBe(j.state);
    expect(structure.documentType).toBe('affidavit');
    expect(structure.metadata.kind).toBe('answer');
    expect(structure.metadata.state).toBe(j.state);
    expect(typeof structure.sections.title).toBe('string');
    expect(structure.sections.title.length).toBeGreaterThan(0);
    expect(Array.isArray(structure.sections.facts.items)).toBe(true);
    expect(structure.sections.facts.items.length).toBeGreaterThan(0);
    structure.sections.facts.items.forEach((item, idx) => {
      expect(item.number).toBe(idx + 1);
      expect(typeof item.content).toBe('string');
    });
  });

  test('caption carries party names, case number, and the jurisdiction header', () => {
    const { sections } = answerToPetition(sampleData);
    for (const needle of j.headerContains) {
      expect(sections.header).toContain(needle);
    }
    expect(sections.caseCaption.formatted).toContain('ALICE Q. EXAMPLE');
    expect(sections.caseCaption.formatted).toContain('BOB R. EXAMPLE');
    expect(sections.caseCaption.formatted).toContain(j.filerLabel);
    expect(sections.caseCaption.formatted).toContain(j.opposingLabel);
    // Case number surfaces somewhere in the caption or header.
    expect(`${sections.header}\n${sections.caseCaption.formatted}`).toContain('CASE-1234');
  });

  test('positions render an admit / deny / lack-of-knowledge sentence', () => {
    const items = answerToPetition(sampleData).sections.facts.items;
    const positionContents = items
      .filter((i) => i.type === 'answer_position')
      .map((i) => i.content);
    expect(positionContents.join('\n')).toMatch(new RegExp(`${j.filerLabel} ADMITS`));
    expect(positionContents.join('\n')).toMatch(new RegExp(`${j.filerLabel} DENIES`));
    expect(positionContents.join('\n')).toMatch(new RegExp(`${j.filerLabel} LACKS KNOWLEDGE`));
  });

  test("user's own requests are transcribed as asks — never invented", () => {
    const structure = answerToPetition(sampleData);
    const text = textOf(structure);
    expect(text).toContain(`${j.filerLabel} asks the court to divide the marital property fairly.`);
    expect(text).toContain(
      `${j.filerLabel} asks the court to let each side pay their own debts.`,
    );

    // No requests → nothing synthesized.
    const empty = answerToPetition({ ...sampleData, answerRequests: [] });
    expect(
      empty.sections.facts.items.filter((i) => i.type === 'answer_request'),
    ).toHaveLength(0);
  });

  test('signer is the party this filing represents', () => {
    const { sections } = answerToPetition(sampleData);
    expect(sections.signatureBlock.name).toBe('Bob R. Example');
    expect(sections.signatureBlock.title).toBe(j.filerLabel);
    // Two acceptable intro styles: the default first-person "I, Bob R.
    // Example, am the Respondent" (used by most jurisdictions) and the
    // Texas-style third-person "Respondent, Bob R. Example, files this…".
    // Either way, the signer name appears in the introduction, adjacent to
    // the filer label, and the opposing party's name is mentioned.
    expect(sections.introduction).toContain('Bob R. Example');
    expect(sections.introduction).toContain(j.filerLabel);
    expect(sections.introduction).toContain('Alice Q. Example');
  });

  test('counterclaim variant extends the title and renders WHEREFORE relief', () => {
    const plain = answerToPetition(sampleData);
    const withCounter = answerToPetition({ ...sampleData, includeCounterclaim: true });
    expect(withCounter.sections.title).not.toBe(plain.sections.title);
    const text = textOf(withCounter);
    expect(text).toContain(j.counterTitle);
    expect(text).toContain('WHEREFORE, on this Counterclaim');
    // Petitioner's requests recycle into the counterclaim relief.
    expect(text).toContain('divide the marital property fairly');
  });

  test('sparse data never throws and falls back to fill-in blanks', () => {
    const structure = answerToPetition();
    expect(structure.sections.title.length).toBeGreaterThan(0);
    expect(structure.sections.signatureBlock.name).toBe('________________________________');
  });

  test('rendered document contains no [BRACKETED_SENTINEL] placeholders', () => {
    const structure = answerToPetition(sampleData);
    const parts = [
      structure.sections.header,
      structure.sections.title,
      structure.sections.caseCaption.formatted,
      structure.sections.introduction,
      structure.sections.conclusion,
      structure.sections.perjuryStatement,
    ]
      .filter(Boolean)
      .concat(structure.sections.facts.items.map((i) => i.content));
    for (const chunk of parts) {
      expect(chunk).not.toMatch(SENTINEL_RE);
    }
  });
});
