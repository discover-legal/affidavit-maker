/**
 * Attorney round-4 (Marcus ON decree, 2026-08-30). A parenting schedule
 * string that reads as a subjective wish or explicitly disclaims
 * specificity ("wants additional mid-week parenting time; specific
 * schedule not yet provided") must NOT be paraphrased into an operative
 * "IT IS ORDERED" clause. Render an explicit [SCHEDULE — insert...]
 * bracket so the drafter fills in a real schedule before filing.
 */

'use strict';

const OntarioDivorceDecreeTemplate =
  require('../../templates/states/ontario/DivorceDecreeTemplate');

const tpl = new OntarioDivorceDecreeTemplate();

function makeDecree(extra = {}) {
  return tpl.generateDocument({
    petitionerName: 'Priya Thompson',
    respondentName: 'Marcus Thompson',
    state: 'ON',
    county: 'Toronto',
    marriageDate: '2013-08-03',
    separationDate: '2025-01-01',
    groundsForDivorce: 'breakdown_of_marriage',
    hasMinorChildren: true,
    numberOfChildren: 2,
    children: [
      { name: 'Ava', birthDate: '2016-03-01' },
      { name: 'Ethan', birthDate: '2019-09-01' },
    ],
    ...extra,
  });
}

function decreeText(doc) {
  return typeof doc.fullText === 'string'
    ? doc.fullText
    : JSON.stringify(doc);
}

describe('Ontario decree parenting-time schedule bracket', () => {
  test('subjective wish text ("wants additional mid-week...not yet provided") renders as [SCHEDULE — insert...] bracket', () => {
    const doc = makeDecree({
      parentTimeDetails:
        'Marcus wants additional mid-week parenting time; specific schedule not yet provided.',
    });
    const text = decreeText(doc);
    // The wish must NOT become the operative schedule clause.
    expect(text).not.toMatch(
      /parenting time with the child\(ren\) on the following schedule: Marcus wants additional mid-week/,
    );
    // The bracket placeholder is present.
    expect(text).toMatch(/\[SCHEDULE — insert specific parenting schedule/);
  });

  test('operative schedule text (>50 chars, no wish tokens) still renders verbatim', () => {
    const doc = makeDecree({
      parentTimeDetails:
        'Each party shall exercise parenting time on alternating weekends from Friday 6:00 p.m. to Sunday 6:00 p.m., with mid-week dinners each Wednesday from 5:00 p.m. to 8:00 p.m.',
    });
    const text = decreeText(doc);
    expect(text).toMatch(/alternating weekends from Friday 6:00 p\.m\./);
    expect(text).not.toMatch(/\[SCHEDULE — insert/);
  });

  test('empty parentTimeDetails renders the default "as agreed in writing" fallback (unchanged)', () => {
    const doc = makeDecree({ parentTimeDetails: '' });
    const text = decreeText(doc);
    expect(text).toMatch(/as agreed in writing by the parties/);
    expect(text).not.toMatch(/\[SCHEDULE — insert/);
  });
});
