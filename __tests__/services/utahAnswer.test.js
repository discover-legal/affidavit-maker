/** @jest-environment node */
// Tests for the Utah Answer (and Counterclaim) builder — the respondent's
// side. Pure (data, opts) => documentStructure function, so no mocks.

const { answerToPetition } = require('../../services/supportDocs/utahAnswer');

const UNSWORN_WORDING =
  'I declare under criminal penalty of the State of Utah that the foregoing is true and correct.';

const sampleData = {
  role: 'respondent',
  petitionerName: 'Jane Q. Example',
  respondentName: 'John R. Example',
  state: 'UT',
  county: 'Salt Lake',
  caseNumber: '244900123',
  marriageDate: '2012-06-15',
  marriageLocation: 'Provo, Utah',
  separationDate: '2025-11-01',
  groundsForDivorce: 'irreconcilable differences',
  children: [
    { name: 'Emma Example', dob: '2015-04-02' },
    { name: 'Liam Example', birthDate: '2018-09-10' },
  ],
  answerPositions: [
    { paragraph: 1, position: 'admit' },
    { paragraph: '2', position: 'deny' },
    { paragraph: 3, position: 'admit' },
    { paragraph: 4, position: 'lack_knowledge' },
    { paragraph: 5, position: 'admit' },
  ],
  answerRequests: ['divide the marital property fairly', 'let each side pay their own debts.'],
};

/** Flatten a structure's sections to one searchable string. */
function textOf(structure) {
  return JSON.stringify(structure.sections);
}

describe('answerToPetition — shape and caption', () => {
  test('returns a pdfService-renderable affidavit structure', () => {
    const structure = answerToPetition(sampleData);
    expect(structure.state).toBe('UT');
    expect(structure.documentType).toBe('affidavit');
    expect(structure.metadata.kind).toBe('answer');
    expect(typeof structure.sections.title).toBe('string');
    expect(Array.isArray(structure.sections.facts.items)).toBe(true);
    expect(structure.sections.facts.items.length).toBeGreaterThan(0);
    structure.sections.facts.items.forEach((item, idx) => {
      expect(item.number).toBe(idx + 1);
      expect(typeof item.content).toBe('string');
      expect(item.content.length).toBeGreaterThan(0);
    });
  });

  test('caption keeps Petitioner v. Respondent with the Utah district-court header', () => {
    const { sections } = answerToPetition(sampleData);
    expect(sections.header).toBe('IN THE DISTRICT COURT OF SALT LAKE COUNTY, STATE OF UTAH');
    expect(sections.caseCaption.formatted).toContain('JANE Q. EXAMPLE');
    expect(sections.caseCaption.formatted).toContain('Petitioner');
    expect(sections.caseCaption.formatted).toContain('JOHN R. EXAMPLE');
    expect(sections.caseCaption.formatted).toContain('Respondent');
    expect(sections.caseCaption.formatted).toContain('Case No. 244900123');
  });

  test('closing carries a certificate-of-service line', () => {
    const { sections } = answerToPetition(sampleData);
    expect(sections.conclusion).toContain('CERTIFICATE OF SERVICE');
    expect(sections.conclusion).toContain('copy of this document to Petitioner');
  });
});

describe('answerToPetition — positions grouping', () => {
  test('groups admits, denials, and lack-of-knowledge into three sentences', () => {
    const items = answerToPetition(sampleData).sections.facts.items;
    const contents = items.map((i) => i.content);
    expect(contents[0]).toBe('Respondent ADMITS the allegations in paragraphs 1, 3, and 5.');
    expect(contents[1]).toBe('Respondent DENIES the allegations in paragraph 2.');
    expect(contents[2]).toContain('Respondent LACKS KNOWLEDGE OR INFORMATION');
    expect(contents[2]).toContain('paragraph 4');
    expect(contents[2]).toContain('therefore denies them');
  });

  test('mentions ONLY paragraphs the user classified — nothing is auto-denied', () => {
    const structure = answerToPetition({
      ...sampleData,
      answerPositions: [{ paragraph: 2, position: 'admit' }],
    });
    const text = textOf(structure);
    expect(text).toContain('ADMITS the allegations in paragraph 2');
    expect(text).not.toContain('DENIES');
    expect(text).not.toContain('LACKS KNOWLEDGE');
    // No other paragraph number appears in a position sentence.
    const positionItems = structure.sections.facts.items.filter(
      (i) => i.type === 'answer_position',
    );
    expect(positionItems).toHaveLength(1);
  });

  test('drops malformed or unknown-position rows instead of reinterpreting them', () => {
    const structure = answerToPetition({
      ...sampleData,
      answerPositions: [
        { paragraph: 1, position: 'admit' },
        { paragraph: 2, position: 'object' }, // not a recognized position
        { paragraph: '', position: 'deny' }, // no paragraph
        'not-an-object',
        null,
      ],
    });
    const text = textOf(structure);
    expect(text).toContain('ADMITS the allegations in paragraph 1');
    expect(text).not.toContain('DENIES the allegations');
    expect(text).not.toContain('object');
  });

  test('with no classified positions, leaves a fill-in blank (no invented positions)', () => {
    const structure = answerToPetition({ ...sampleData, answerPositions: [] });
    const text = textOf(structure);
    expect(text).toContain(
      'Respondent responds to the numbered paragraphs of the Petition as follows: ' +
        '________________________________.',
    );
    expect(text).not.toContain('ADMITS');
    expect(text).not.toContain('DENIES the allegations');
  });
});

describe('answerToPetition — requests to the court', () => {
  test('transcribes only the user\'s explicit requests, phrased as asks', () => {
    const text = textOf(answerToPetition(sampleData));
    expect(text).toContain('Respondent asks the court to divide the marital property fairly.');
    expect(text).toContain('Respondent asks the court to let each side pay their own debts.');
  });

  test('no requests → no request items are synthesized', () => {
    const structure = answerToPetition({ ...sampleData, answerRequests: [] });
    const requestItems = structure.sections.facts.items.filter(
      (i) => i.type === 'answer_request',
    );
    expect(requestItems).toHaveLength(0);
  });

  test('empty and non-string entries are dropped', () => {
    const structure = answerToPetition({
      ...sampleData,
      answerRequests: ['  ', null, 42, 'keep the house until the kids finish school'],
    });
    const requestItems = structure.sections.facts.items.filter(
      (i) => i.type === 'answer_request',
    );
    expect(requestItems).toHaveLength(2); // '42' stringifies non-empty; blanks/null dropped
    expect(textOf(structure)).toContain('keep the house until the kids finish school');
  });
});

describe('answerToPetition — counterclaim on/off', () => {
  test('off by default: title is ANSWER and no counterclaim items exist', () => {
    const structure = answerToPetition(sampleData);
    expect(structure.sections.title).toBe('ANSWER');
    expect(textOf(structure)).not.toContain('COUNTERCLAIM');
  });

  test('on: title extends and the petition-style recitals appear', () => {
    const structure = answerToPetition({ ...sampleData, includeCounterclaim: true });
    expect(structure.sections.title).toBe('ANSWER AND COUNTERCLAIM');
    const text = textOf(structure);
    expect(text).toContain('COUNTERCLAIM FOR DIVORCE');
    expect(text).toContain(
      'resident of Salt Lake County, State of Utah, for at least three months',
    );
    expect(text).toContain('married on 2012-06-15 in Provo, Utah');
    expect(text).toContain('separated on or about 2025-11-01');
    expect(text).toContain('Irreconcilable differences of the marriage have arisen');
    expect(text).toContain('Emma Example (born 2015-04-02)');
    expect(text).toContain('Liam Example (born 2018-09-10)');
    // Relief recycles the user's requests — never invents new ones.
    expect(text).toContain('WHEREFORE, on this Counterclaim');
    expect(text).toContain('divide the marital property fairly');
    expect(text).toContain('grant a divorce dissolving the marriage');
  });

  test('counterclaim is sparse-data safe: blanks, not throws', () => {
    const structure = answerToPetition({ includeCounterclaim: true });
    const text = textOf(structure);
    expect(text).toContain('______________ County, State of Utah');
    expect(text).toContain('married on ______________');
    expect(text).toContain(
      'Minor children of the marriage (names and birth dates), if any: ' +
        '________________________________.',
    );
    expect(text).not.toContain('separated on or about');
  });

  test('explicit no-minor-children flag is recited instead of a blank', () => {
    const text = textOf(
      answerToPetition({
        ...sampleData,
        includeCounterclaim: true,
        children: [],
        hasMinorChildren: false,
      }),
    );
    expect(text).toContain('There are no minor children of this marriage.');
  });
});

describe('answerToPetition — signer is the respondent', () => {
  test('signature and intro name the respondent, not the petitioner', () => {
    const { sections } = answerToPetition(sampleData);
    expect(sections.signatureBlock.name).toBe('John R. Example');
    expect(sections.signatureBlock.title).toBe('Respondent');
    expect(sections.introduction).toContain('I, John R. Example, am the Respondent');
    expect(sections.introduction).toContain('filed by Jane Q. Example');
  });

  test('legacy profile: user stored as petitionerName flips into the respondent slot', () => {
    // Profile created before `role` existed — interviews put the user's own
    // name under petitionerName. Explicit role: 'respondent' flips it.
    const { sections } = answerToPetition({
      role: 'respondent',
      firstName: 'John',
      lastName: 'Example',
      petitionerName: 'John Example',
    });
    expect(sections.signatureBlock.name).toBe('John Example');
    expect(sections.caseCaption.formatted).toContain('JOHN EXAMPLE,\nRespondent.');
    expect(sections.caseCaption.formatted).toContain('_________________________________,');
  });

  test('no role at all defaults to treating the user as respondent', () => {
    const { sections } = answerToPetition({
      firstName: 'Robin',
      lastName: 'Doe',
    });
    expect(sections.signatureBlock.name).toBe('Robin Doe');
    expect(sections.signatureBlock.title).toBe('Respondent');
  });

  test('sparse data never throws and falls back to fill-in blanks', () => {
    const { sections } = answerToPetition();
    expect(sections.signatureBlock.name).toBe('_________________________________');
    expect(sections.caseCaption.formatted).toContain('Case No. ______________');
    expect(sections.title).toBe('ANSWER');
  });
});

describe('answerToPetition — signature styles', () => {
  test('unsworn declaration is the default', () => {
    const { sections } = answerToPetition(sampleData);
    expect(sections.perjuryStatement).toContain(UNSWORN_WORDING);
    expect(sections.notaryBlock).toBeNull();
    expect(answerToPetition(sampleData).metadata.signatureStyle).toBe('unsworn');
  });

  test('notary variant renders the subscribed-and-sworn block instead', () => {
    const structure = answerToPetition(sampleData, { signatureStyle: 'notary' });
    expect(structure.sections.notaryBlock).toContain('Subscribed and sworn to before me');
    expect(structure.sections.notaryBlock).toContain('Notary Public');
    expect(structure.sections.perjuryStatement).toBeNull();
    expect(structure.metadata.signatureStyle).toBe('notary');
    expect(textOf(structure)).not.toContain(UNSWORN_WORDING);
  });
});
