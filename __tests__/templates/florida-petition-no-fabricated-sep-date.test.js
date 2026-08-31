/**
 * Round-7 attorney review (Tavita FL, 2026-08-30): the transcript said
 * "3 months ago" and the orchestrator computed a specific separation
 * date ("May 29, 2026"). A specific day pleaded under oath is a
 * fabrication when the source was a relative expression. When the
 * profile flags the separation date as approximate, the section must
 * render the Draft blank instead of the specific day.
 */

const FloridaDivorcePetitionTemplate =
  require('../../templates/states/florida/DivorcePetitionTemplate');

function baseData(overrides = {}) {
  return {
    petitionerName: 'Marco Rossi',
    respondentName: 'Tavita Faletau',
    state: 'FL',
    county: 'Miami-Dade',
    marriageDate: '2018-06-15',
    hasMinorChildren: false,
    hasProperty: false,
    noPropertyConfirmed: true,
    ...overrides,
  };
}

describe('Florida petition — no fabricated separation date (Round-7)', () => {
  test('separationDateApproximate=true suppresses the specific day', () => {
    const tpl = new FloridaDivorcePetitionTemplate();
    const section = tpl.generateMarriageInformationSection(
      baseData({
        separationDate: '2026-05-29',
        separationDateApproximate: true,
      }),
    );
    const body = section.items.map((i) => i.content).join('\n');
    expect(body).not.toMatch(/2026-05-29/);
    expect(body).not.toMatch(/May 29, 2026/);
    expect(body).toMatch(/Draft — insert exact date of separation/);
  });

  test('facts-derived relative expression ("3 months ago") suppresses the day', () => {
    const tpl = new FloridaDivorcePetitionTemplate();
    const section = tpl.generateMarriageInformationSection(
      baseData({
        separationDate: '2026-05-29',
        facts: [
          {
            subcategory: 'separation',
            content: 'The parties separated three months ago.',
            sourceQuote: 'we separated 3 months ago',
          },
        ],
      }),
    );
    const body = section.items.map((i) => i.content).join('\n');
    expect(body).not.toMatch(/2026-05-29/);
    expect(body).not.toMatch(/May 29, 2026/);
    expect(body).toMatch(/Draft — insert exact date of separation/);
  });

  test('a real ISO separation date without approximate flag still renders as a date', () => {
    const tpl = new FloridaDivorcePetitionTemplate();
    const section = tpl.generateMarriageInformationSection(
      baseData({ separationDate: '2025-11-01' }),
    );
    const body = section.items.map((i) => i.content).join('\n');
    expect(body).toMatch(/separated on or about/);
    expect(body).not.toMatch(/Draft — insert exact date of separation/);
  });
});
