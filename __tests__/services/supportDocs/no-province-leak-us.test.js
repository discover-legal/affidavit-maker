/**
 * Round-7 attorney review (Tavita FL, 2026-08-30): the shared Answer
 * builder's default location label was "(city and state/province)" — a
 * Canadian idiom that leaked into US Answers. A Florida (or NY / TX / CA
 * / GA) Answer must render "(city and state)"; Canadian jurisdictions
 * keep "(city and province)".
 */

const { answerToPetition: flAnswer } =
  require('../../../services/supportDocs/floridaAnswer');
const { answerToPetition: nyAnswer } =
  require('../../../services/supportDocs/newyorkAnswer');
const { answerToPetition: txAnswer } =
  require('../../../services/supportDocs/texasAnswer');
const { answerToPetition: caAnswer } =
  require('../../../services/supportDocs/californiaAnswer');
const { answerToPetition: gaAnswer } =
  require('../../../services/supportDocs/georgiaAnswer');

function base(state, overrides = {}) {
  return {
    firstName: 'Test',
    lastName: 'User',
    petitionerName: 'Alice Petitioner',
    respondentName: 'Test User',
    role: 'respondent',
    state,
    county: 'Somecounty',
    ...overrides,
  };
}

function structureText(structure) {
  return JSON.stringify(structure);
}

describe('US Answers — no "province" idiom leak (Round-7)', () => {
  test.each([
    ['FL', flAnswer],
    ['NY', nyAnswer],
    ['TX', txAnswer],
    ['CA', caAnswer],
    ['GA', gaAnswer],
  ])('%s Answer contains no "province" text', (state, builder) => {
    const structure = builder(base(state));
    const text = structureText(structure);
    expect(text).not.toMatch(/province/i);
  });
});
