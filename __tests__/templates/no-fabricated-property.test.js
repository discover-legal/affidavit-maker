/**
 * Attorney round-2 replay guard (2026-08): the base divorce petition
 * property section must never fabricate a community/marital property
 * allegation. Rules:
 *   - hasProperty=false + noPropertyConfirmed=true → nil finding, no
 *     "There exists community property..." allegation.
 *   - Neither flag set → no affirmative allegation; a Draft-note blank
 *     the filer must confirm before filing.
 *   - hasProperty=true → the usual community/marital property allegation.
 *
 * Regression: Mari's TX petition (transcript: "no property, no house,
 * no retirement, no kids") still rendered "There exists community
 * property owned by the parties..." because the branch fired without
 * checking the confirmed no-property flag.
 */

const BaseDivorcePetitionTemplate = require('../../templates/core/BaseDivorcePetitionTemplate');
const TexasDivorcePetitionTemplate = require('../../templates/states/texas/DivorcePetitionTemplate');

function renderBase(data) {
  const tpl = new BaseDivorcePetitionTemplate();
  tpl.state = 'US';
  tpl.stateName = 'United States';
  const section = tpl.generatePropertySection(data);
  const body = section.items.map((i) => i.content).join('\n');
  return { section, body };
}

function renderTexas(data) {
  const tpl = new TexasDivorcePetitionTemplate();
  const section = tpl.generatePropertySection(data);
  const body = section.items.map((i) => i.content).join('\n');
  return { section, body };
}

const AFFIRMATIVE_HEDGE =
  /(there exists community property|parties have accumulated community\/marital property|parties have accumulated community property)/i;

describe('BaseDivorcePetitionTemplate — property fabrication guard', () => {
  test('hasProperty=false + noPropertyConfirmed=true renders nil finding, not community-property allegation', () => {
    const { body } = renderBase({
      hasProperty: false,
      noPropertyConfirmed: true,
    });
    expect(body).not.toMatch(AFFIRMATIVE_HEDGE);
    expect(body).toMatch(/no community or marital property/i);
  });

  test('noPropertyConfirmed=true alone (without explicit hasProperty=false) still suppresses the allegation', () => {
    const { body } = renderBase({
      noPropertyConfirmed: true,
    });
    expect(body).not.toMatch(AFFIRMATIVE_HEDGE);
  });

  test('neither flag set — no affirmative community-property allegation; Draft-note blank instead', () => {
    const { body } = renderBase({});
    expect(body).not.toMatch(AFFIRMATIVE_HEDGE);
    expect(body).toMatch(/\(Draft —/);
  });

  test('hasProperty=true still pleads community/marital property (positive control)', () => {
    const { body } = renderBase({ hasProperty: true });
    expect(body).toMatch(AFFIRMATIVE_HEDGE);
  });
});

describe('TexasDivorcePetitionTemplate — no fabricated community estate (Mari replay)', () => {
  test('hasProperty=false + noPropertyConfirmed=true — no "There exists community property" text', () => {
    const { body } = renderTexas({
      petitionerName: 'Mari Ortiz',
      respondentName: 'Ricardo Ortiz',
      hasProperty: false,
      noPropertyConfirmed: true,
      hasDebts: false,
    });
    expect(body).not.toMatch(/there exists community property/i);
  });

  test('noPropertyConfirmed=true alone — no fabricated community estate', () => {
    const { body } = renderTexas({
      petitionerName: 'Mari Ortiz',
      respondentName: 'Ricardo Ortiz',
      noPropertyConfirmed: true,
    });
    expect(body).not.toMatch(/there exists community property/i);
  });
});
