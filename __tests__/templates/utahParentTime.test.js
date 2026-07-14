/** @jest-environment node */
// __tests__/templates/utahParentTime.test.js
//
// Utah parent-time (visitation) election rendering in the Decree of Divorce.
// Utah has statutory minimum parent-time schedules (Utah Code § 30-3-35 for
// children 5-18; § 30-3-35.5 for children under 5) and an optional expanded
// schedule (§ 30-3-35.1). The interview captures the election as
// divorceData.parentTimePlan (+ parentTimeDetails for custom schedules) and
// the decree must render the matching order sentence.

const UtahDivorceDecreeTemplate = require('../../templates/states/utah/DivorceDecreeTemplate');

function baseDivorceData(overrides = {}) {
  return {
    petitionerName: 'Jane Doe',
    respondentName: 'John Doe',
    primaryCustodian: 'Jane Doe',
    state: 'UT',
    county: 'Salt Lake',
    caseNumber: '244900123',
    marriageDate: '2015-06-01',
    hasMinorChildren: true,
    children: [{ name: 'Sam Doe', birthDate: '2018-03-04' }],
    ...overrides,
  };
}

describe('UtahDivorceDecreeTemplate parent-time election', () => {
  let template;

  beforeEach(() => {
    template = new UtahDivorceDecreeTemplate();
  });

  function custodyOrderTexts(divorceData) {
    const section = template.generateChildCustodySection(divorceData);
    expect(section).not.toBeNull();
    return section.items.map((item) => item.content);
  }

  test('no election keeps the pre-existing default language exactly', () => {
    const texts = custodyOrderTexts(baseDivorceData());
    expect(texts).toContain(
      'IT IS ORDERED that John Doe shall have parent-time with the minor child(ren) in accordance with Utah Code § 81-9-302 (minimum schedule) or as otherwise agreed by the parties.'
    );
  });

  test('statutory_minimum election orders the §§ 30-3-35 / 30-3-35.5 minimum schedules', () => {
    const texts = custodyOrderTexts(baseDivorceData({ parentTimePlan: 'statutory_minimum' }));
    expect(texts).toContain(
      'IT IS ORDERED that John Doe shall have parent-time with the minor child(ren) as provided in the minimum schedules of Utah Code §§ 30-3-35 and 30-3-35.5, unless the parties agree otherwise in writing.'
    );
  });

  test('expanded election orders the optional § 30-3-35.1 expanded schedule', () => {
    const texts = custodyOrderTexts(baseDivorceData({ parentTimePlan: 'expanded' }));
    expect(texts).toContain(
      'IT IS ORDERED that John Doe shall have parent-time with the minor child(ren) as provided in the optional expanded parent-time schedule of Utah Code § 30-3-35.1, unless the parties agree otherwise in writing.'
    );
  });

  test('equal election with details renders equal parent-time plus the schedule', () => {
    const texts = custodyOrderTexts(baseDivorceData({
      parentTimePlan: 'equal',
      parentTimeDetails: 'week on / week off, exchanges Sunday at 6:00 p.m.',
    }));
    expect(texts).toContain(
      'IT IS ORDERED that the parties shall have equal (50/50) parent-time with the minor child(ren) as follows: week on / week off, exchanges Sunday at 6:00 p.m.'
    );
  });

  test('equal election without details renders equal parent-time with a written-agreement schedule', () => {
    const texts = custodyOrderTexts(baseDivorceData({ parentTimePlan: 'equal' }));
    expect(texts).toContain(
      'IT IS ORDERED that the parties shall have equal (50/50) parent-time with the minor child(ren) on a schedule the parties agree to in writing.'
    );
  });

  test('custom election renders parentTimeDetails verbatim inside the order sentence', () => {
    const texts = custodyOrderTexts(baseDivorceData({
      parentTimePlan: 'custom',
      parentTimeDetails: 'every Wednesday overnight and every other weekend Friday to Monday morning',
    }));
    expect(texts).toContain(
      'IT IS ORDERED that John Doe shall have parent-time with the minor child(ren) as follows: every Wednesday overnight and every other weekend Friday to Monday morning'
    );
  });

  test('custom election without details falls back to the statutory minimum sentence', () => {
    const texts = custodyOrderTexts(baseDivorceData({ parentTimePlan: 'custom' }));
    expect(texts).toContain(
      'IT IS ORDERED that John Doe shall have parent-time with the minor child(ren) as provided in the minimum schedules of Utah Code §§ 30-3-35 and 30-3-35.5, unless the parties agree otherwise in writing.'
    );
  });

  test('the non-custodial parent is the petitioner when the respondent is primary custodian', () => {
    const texts = custodyOrderTexts(baseDivorceData({
      primaryCustodian: 'John Doe',
      parentTimePlan: 'statutory_minimum',
    }));
    expect(texts.join('\n')).toContain(
      'IT IS ORDERED that Jane Doe shall have parent-time with the minor child(ren) as provided in the minimum schedules'
    );
  });

  test('the election flows through the full generated document', () => {
    const doc = template.generateDocument(baseDivorceData({ parentTimePlan: 'expanded' }));
    expect(doc.fullText).toContain('Utah Code § 30-3-35.1');
    expect(doc.sections.childCustody.title).toBe('CUSTODY AND PARENT-TIME');
  });
});
