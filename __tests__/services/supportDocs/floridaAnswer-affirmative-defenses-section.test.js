/**
 * FL Answer — dedicated AFFIRMATIVE DEFENSES section with numbered
 * defenses (attorney round-3, Tavita, 2026-08-30).
 *
 * Fla. R. Civ. P. 1.110(d): affirmative defenses MUST be pleaded in a
 * dedicated section or waived. Prenup is a classic affirmative defense.
 * Round-3 required the prenup defense to render as THREE distinct
 * numbered items (execution, independent-counsel recital, bar on
 * inconsistent relief) rather than one composite paragraph.
 */

const { answerToPetition } = require('../../../services/supportDocs/floridaAnswer');

function base(overrides = {}) {
  return {
    firstName: 'Tavita',
    lastName: 'Poloa',
    petitionerName: 'Ana Poloa',
    respondentName: 'Tavita Poloa',
    role: 'respondent',
    state: 'FL',
    county: 'Miami-Dade',
    ...overrides,
  };
}

describe('FL Answer — AFFIRMATIVE DEFENSES section', () => {
  test('prenupSigned=true → dedicated section with three numbered defenses', () => {
    const structure = answerToPetition(base({ prenupSigned: true, prenupYear: 2018 }));
    const items = structure.sections.facts.items;

    // Dedicated section_header for AFFIRMATIVE DEFENSES.
    const headerIdx = items.findIndex(
      (it) => it.type === 'section_header' && /AFFIRMATIVE DEFENSES/.test(it.content),
    );
    expect(headerIdx).toBeGreaterThanOrEqual(0);

    // Every 'affirmative_defense' item carries a paragraph number.
    const defenses = items.filter((it) => it.type === 'affirmative_defense');
    expect(defenses.length).toBeGreaterThanOrEqual(3);
    for (const d of defenses) {
      expect(typeof d.number).toBe('number');
      expect(d.number).toBeGreaterThan(0);
    }

    // Three distinct prenup defense items — execution, counsel, bar.
    const joined = defenses.map((d) => d.content).join('\n');
    expect(joined).toMatch(/PRENUPTIAL AGREEMENT — EXECUTION/);
    expect(joined).toMatch(/PRENUPTIAL AGREEMENT — INDEPENDENT COUNSEL/);
    expect(joined).toMatch(/PRENUPTIAL AGREEMENT — BAR ON INCONSISTENT RELIEF/);
    expect(joined).toMatch(/Fla\. Stat\. § 61\.079/);
    expect(joined).toMatch(/§ 61\.075/);
    expect(joined).toMatch(/dated 2018/);
    expect(joined).toMatch(/independent counsel/i);

    // The AFFIRMATIVE DEFENSES section renders BEFORE the counter-petition
    // offer and BEFORE the WHEREFORE closing.
    const offerIdx = items.findIndex(
      (it) => it.type === 'section_header' && /COUNTER-PETITION/.test(it.content),
    );
    expect(headerIdx).toBeLessThan(offerIdx);
  });

  test('prenupBothCounsel=false → counsel recital reflects opportunity-to-consult wording', () => {
    const structure = answerToPetition(base({
      prenupSigned: true,
      prenupYear: 2018,
      prenupBothCounsel: false,
    }));
    const body = structure.sections.facts.items.map((i) => i.content).join('\n');
    expect(body).toMatch(/opportunity to consult independent counsel/);
    expect(body).toMatch(/§ 61\.079\(7\)/);
  });

  test('no prenup → no AFFIRMATIVE DEFENSES section', () => {
    const structure = answerToPetition(base());
    const items = structure.sections.facts.items;
    const defenseItems = items.filter((it) => it.type === 'affirmative_defense');
    expect(defenseItems.length).toBe(0);
  });
});
