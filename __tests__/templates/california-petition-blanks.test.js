/**
 * CA v10 replay guard: the FL-100 petition (and matching decree) must
 * render a visible fill-in-by-hand blank + Draft note when the drafter
 * hasn't pinned down an exact marriage or separation date — never a
 * `[DATE OF SEPARATION]` / `[SEPARATION DATE]` / `[DATE OF MARRIAGE]` /
 * `[DATE]` sentinel token. The generate route's PLACEHOLDER_DENYLIST
 * refuses those tokens, so emitting them causes a 422
 * MissingRequiredFields even when the drafter has said "separated a
 * few months" and does not know the exact date. (Alison v10 replay,
 * 2026-08.)
 */

const CaliforniaDivorcePetitionTemplate =
  require('../../templates/states/california/DivorcePetitionTemplate');
const CaliforniaDivorceDecreeTemplate =
  require('../../templates/states/california/DivorceDecreeTemplate');

function renderMarriageSection(data) {
  const tpl = new CaliforniaDivorcePetitionTemplate();
  const section = tpl.generateMarriageInformationSection(data);
  const body = section.items.map((i) => i.content).join('\n');
  return { section, body };
}

function renderDecreeJurisdiction(data) {
  const tpl = new CaliforniaDivorceDecreeTemplate();
  const section = tpl.generateJurisdictionSection(data);
  return { section, body: section.text };
}

const BASE_PETITION = {
  petitionerName: 'Alison Q. Test',
  respondentName: 'Robin B. Test',
  state: 'CA',
  county: 'Alameda',
};

describe('California petition — missing marriage/separation dates', () => {
  test('missing separationDate: renders visible blank + Draft note, no sentinel tokens', () => {
    const { body } = renderMarriageSection({
      ...BASE_PETITION,
      marriageDate: '2010-06-15',
    });
    expect(body).toMatch(/The parties separated on or about __________________\./);
    expect(body).toMatch(/\(Draft — insert exact date of separation before filing\)/);
    expect(body).not.toMatch(/\[SEPARATION DATE\]/);
    expect(body).not.toMatch(/\[DATE OF SEPARATION\]/);
  });

  test('present separationDate: renders the literal date, no blank, no draft note', () => {
    const { body } = renderMarriageSection({
      ...BASE_PETITION,
      marriageDate: '2010-06-15',
      separationDate: '2024-03-01',
    });
    expect(body).toMatch(/The parties separated on or about /);
    expect(body).not.toMatch(/__________________/);
    expect(body).not.toMatch(/Draft — insert exact date of separation/);
    expect(body).not.toMatch(/\[SEPARATION DATE\]/);
    expect(body).not.toMatch(/\[DATE OF SEPARATION\]/);
  });

  test('missing marriageDate: renders visible blank + Draft note, no sentinel tokens', () => {
    const { body } = renderMarriageSection({
      ...BASE_PETITION,
      separationDate: '2024-03-01',
    });
    expect(body).toMatch(/Petitioner and Respondent were married on __________________/);
    expect(body).toMatch(/\(Draft — insert exact date of marriage before filing\)/);
    expect(body).not.toMatch(/\[MARRIAGE DATE\]/);
    expect(body).not.toMatch(/\[DATE OF MARRIAGE\]/);
  });

  test('both dates missing: two separate blanks, two separate Draft notes, no sentinels', () => {
    const { body } = renderMarriageSection(BASE_PETITION);
    expect(body).toMatch(/Petitioner and Respondent were married on __________________/);
    expect(body).toMatch(/The parties separated on or about __________________\./);
    expect(body).toMatch(/\(Draft — insert exact date of marriage before filing\)/);
    expect(body).toMatch(/\(Draft — insert exact date of separation before filing\)/);
    expect(body).not.toMatch(/\[SEPARATION DATE\]/);
    expect(body).not.toMatch(/\[DATE OF SEPARATION\]/);
    expect(body).not.toMatch(/\[MARRIAGE DATE\]/);
    expect(body).not.toMatch(/\[DATE OF MARRIAGE\]/);
    expect(body).not.toMatch(/\[DATE\]/);
  });

  test('freeform separationDate "a few months ago" falls through to blank + Draft note (v11 replay)', () => {
    const { body } = renderMarriageSection({
      ...BASE_PETITION,
      marriageDate: '2010-06-15',
      separationDate: 'a few months ago',
    });
    expect(body).not.toMatch(/on or about a few months ago/);
    expect(body).toMatch(/The parties separated on or about __________________\./);
    expect(body).toMatch(/\(Draft — insert exact date of separation before filing\)/);
  });

  test('freeform separationDate "unknown" falls through to blank + Draft note', () => {
    const { body } = renderMarriageSection({
      ...BASE_PETITION,
      marriageDate: '2010-06-15',
      separationDate: 'unknown',
    });
    expect(body).not.toMatch(/on or about unknown/);
    expect(body).toMatch(/The parties separated on or about __________________\./);
    expect(body).toMatch(/\(Draft — insert exact date of separation before filing\)/);
  });

  test('freeform separationDate "sometime in 2024" falls through to blank + Draft note', () => {
    const { body } = renderMarriageSection({
      ...BASE_PETITION,
      marriageDate: '2010-06-15',
      separationDate: 'sometime in 2024',
    });
    expect(body).not.toMatch(/on or about sometime in 2024/);
    expect(body).toMatch(/The parties separated on or about __________________\./);
    expect(body).toMatch(/\(Draft — insert exact date of separation before filing\)/);
  });

  test('ISO-shaped separationDate "2024-06-15" renders literally', () => {
    const { body } = renderMarriageSection({
      ...BASE_PETITION,
      marriageDate: '2010-06-15',
      separationDate: '2024-06-15',
    });
    expect(body).toMatch(/The parties separated on or about June 15, 2024\./);
    expect(body).not.toMatch(/__________________/);
    expect(body).not.toMatch(/Draft — insert exact date of separation/);
  });

  test('empty-string separationDate falls through to blank + Draft note', () => {
    const { body } = renderMarriageSection({
      ...BASE_PETITION,
      marriageDate: '2010-06-15',
      separationDate: '',
    });
    expect(body).toMatch(/The parties separated on or about __________________\./);
    expect(body).toMatch(/\(Draft — insert exact date of separation before filing\)/);
  });

  test('freeform marriageDate "a few years back" falls through to blank + Draft note', () => {
    const { body } = renderMarriageSection({
      ...BASE_PETITION,
      marriageDate: 'a few years back',
      separationDate: '2024-06-15',
    });
    expect(body).not.toMatch(/married on a few years back/);
    expect(body).toMatch(/Petitioner and Respondent were married on __________________/);
    expect(body).toMatch(/\(Draft — insert exact date of marriage before filing\)/);
  });

  test('decree: freeform separationDate "a few months ago" falls through to blank + Draft note', () => {
    const { body } = renderDecreeJurisdiction({
      ...BASE_PETITION,
      caseNumber: 'FL-12345',
      marriageDate: '2010-06-15',
      separationDate: 'a few months ago',
    });
    expect(body).not.toMatch(/separated on a few months ago/);
    expect(body).toMatch(/separated on __________________/);
    expect(body).toMatch(/\(Draft — insert exact date of separation before filing\)/);
  });

  test('separationDate is NOT in requiredFields (draft renders without a validation error)', () => {
    const tpl = new CaliforniaDivorcePetitionTemplate();
    expect(tpl.requiredFields).not.toContain('separationDate');
    expect(tpl.requiredFields).not.toContain('marriageDate');
  });

  test('performStateSpecificValidation demotes missing separationDate/marriageDate to warnings', () => {
    const tpl = new CaliforniaDivorcePetitionTemplate();
    const result = tpl.performStateSpecificValidation({
      ...BASE_PETITION,
    });
    expect(result.errors).not.toContain(
      'Date of separation is required for California dissolution petitions'
    );
    // No error about separation or marriage should remain.
    for (const err of result.errors) {
      expect(err).not.toMatch(/separation/i);
      expect(err).not.toMatch(/marriage/i);
    }
    expect(result.warnings.some((w) => /separation/i.test(w))).toBe(true);
    expect(result.warnings.some((w) => /marriage/i.test(w))).toBe(true);
  });
});

describe('California decree — missing marriage/separation dates', () => {
  const BASE_DECREE = {
    ...BASE_PETITION,
    caseNumber: 'FL-12345',
  };

  test('missing separationDate + marriageDate: visible blanks + single combined Draft note, no sentinels', () => {
    const { body } = renderDecreeJurisdiction(BASE_DECREE);
    expect(body).toMatch(/married on __________________ and separated on __________________/);
    expect(body).toMatch(
      /\(Draft — insert exact date of marriage and date of separation before filing\)/
    );
    expect(body).not.toMatch(/\[DATE\]/);
    expect(body).not.toMatch(/\[SEPARATION DATE\]/);
    expect(body).not.toMatch(/\[DATE OF SEPARATION\]/);
    expect(body).not.toMatch(/\[MARRIAGE DATE\]/);
    expect(body).not.toMatch(/\[DATE OF MARRIAGE\]/);
  });

  test('missing separationDate only: date-of-marriage renders literally, separation gets blank + note', () => {
    const { body } = renderDecreeJurisdiction({
      ...BASE_DECREE,
      marriageDate: '2010-06-15',
    });
    expect(body).toMatch(/separated on __________________/);
    expect(body).toMatch(/\(Draft — insert exact date of separation before filing\)/);
    expect(body).not.toMatch(/married on __________________/);
    expect(body).not.toMatch(/date of marriage and date of separation/);
    expect(body).not.toMatch(/\[DATE\]/);
    expect(body).not.toMatch(/\[SEPARATION DATE\]/);
    expect(body).not.toMatch(/\[DATE OF SEPARATION\]/);
  });

  test('both dates present: literal dates, no blanks, no draft note', () => {
    const { body } = renderDecreeJurisdiction({
      ...BASE_DECREE,
      marriageDate: '2010-06-15',
      separationDate: '2024-03-01',
    });
    expect(body).not.toMatch(/__________________/);
    expect(body).not.toMatch(/Draft — insert exact/);
    expect(body).not.toMatch(/\[DATE\]/);
  });

  test('decree separationDate/marriageDate NOT in requiredFields', () => {
    const tpl = new CaliforniaDivorceDecreeTemplate();
    expect(tpl.requiredFields).not.toContain('separationDate');
    expect(tpl.requiredFields).not.toContain('marriageDate');
  });
});
