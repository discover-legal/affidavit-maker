/** @jest-environment node */
'use strict';

const { mergeLabeledAmounts, totalOf } = require('../../utils/labeledAmounts');

describe('mergeLabeledAmounts — replace-per-person', () => {
  test('a later turn mentioning the same person REPLACES that person\'s entries, even under a new label', () => {
    // The katie2 live-replay bug: the model restated the same wage under a
    // near-identical label variant, and label-keyed merging appended it,
    // doubling the sworn income. Replacement per person fixes it structurally.
    let items = mergeLabeledAmounts([], [
      { label: "Katie O'Brien-Hatch wages as office manager at dental office", amount: 3400, person: 'petitioner' },
    ]);
    items = mergeLabeledAmounts(items, [
      { label: "Kathleen O'Brien-Hatch wages as office manager at a dental office", amount: 3400, person: 'petitioner' },
    ]);
    expect(items).toEqual([
      { label: "Kathleen O'Brien-Hatch wages as office manager at a dental office", amount: 3400, person: 'petitioner' },
    ]);
  });

  test('the full katie2 name-variant scenario yields ONE entry per person and correct sums', () => {
    let items = mergeLabeledAmounts([], [
      { label: "Katie O'Brien-Hatch wages as office manager at dental office", amount: 3400, person: 'petitioner' },
      { label: 'Daniel Hatch wages as HVAC technician', amount: 5200, person: 'respondent' },
    ]);
    items = mergeLabeledAmounts(items, [
      { label: "Kathleen O'Brien-Hatch wages as office manager at a dental office", amount: 3400, person: 'petitioner' },
      { label: 'Daniel James Hatch wages as HVAC technician', amount: 5200, person: 'respondent' },
    ]);
    const petitioner = items.filter((e) => e.person === 'petitioner');
    const respondent = items.filter((e) => e.person === 'respondent');
    expect(petitioner).toHaveLength(1);
    expect(respondent).toHaveLength(1);
    expect(totalOf(petitioner)).toBe(3400); // not 6800
    expect(totalOf(respondent)).toBe(5200); // not 10400
  });

  test('persons NOT mentioned in a turn keep their stored entries untouched', () => {
    let items = mergeLabeledAmounts([], [
      { label: 'My wages', amount: 3400, person: 'petitioner' },
      { label: 'Spouse wages', amount: 5200, person: 'respondent' },
    ]);
    items = mergeLabeledAmounts(items, [
      { label: 'My wages', amount: 3600, person: 'petitioner' }, // correction
    ]);
    expect(items).toEqual([
      { label: 'Spouse wages', amount: 5200, person: 'respondent' },
      { label: 'My wages', amount: 3600, person: 'petitioner' },
    ]);
  });

  test('a person\'s multi-item list survives when that person is restated completely', () => {
    let items = mergeLabeledAmounts([], [
      { label: 'My wages', amount: 3400, person: 'petitioner' },
      { label: 'Child support received', amount: 850, person: 'petitioner' },
    ]);
    items = mergeLabeledAmounts(items, [
      { label: 'My wages', amount: 3400, person: 'petitioner' },
      { label: 'Child support received', amount: 900, person: 'petitioner' },
      { label: 'Side gig', amount: 200, person: 'petitioner' },
    ]);
    expect(items).toHaveLength(3);
    expect(totalOf(items)).toBe(4500);
  });

  test('expense mirror: person-less entries share one bucket, so an expense turn replaces the whole expense list', () => {
    let items = mergeLabeledAmounts([], [
      { label: 'Housing', amount: 1400 },
      { label: 'Food', amount: 600 },
    ]);
    // The model restates the COMPLETE list (per the schema) with a correction.
    items = mergeLabeledAmounts(items, [
      { label: 'Housing', amount: 1450 },
      { label: 'Food', amount: 700 },
      { label: 'Utilities', amount: 300 },
    ]);
    expect(items.map((i) => i.label)).toEqual(['Housing', 'Food', 'Utilities']);
    expect(totalOf(items)).toBe(2450);
  });

  test('an exact (person, label) repeat within one turn collapses, latest amount winning', () => {
    const items = mergeLabeledAmounts(
      [{ label: 'Housing', amount: 1400 }],
      [
        { label: 'housing', amount: 1550 },
        { label: 'Housing ', amount: 1600 },
      ],
    );
    expect(items).toHaveLength(1);
    expect(items[0].amount).toBe(1600);
  });

  test('an empty or absent incoming list changes nothing (no accidental wipes)', () => {
    const base = [{ label: 'My wages', amount: 3400, person: 'petitioner' }];
    expect(mergeLabeledAmounts(base, [])).toEqual(base);
    expect(mergeLabeledAmounts(base, undefined)).toEqual(base);
    expect(mergeLabeledAmounts(base, [null, { label: '', amount: 5 }])).toEqual(base);
  });

  test('sanitizes garbage and keeps person', () => {
    const items = mergeLabeledAmounts(null, [
      { label: 'Wages', amount: 4200.4, person: 'petitioner' },
      { label: '', amount: 100 },
      { label: 'Bad', amount: 'x' },
      null,
    ]);
    expect(items).toEqual([{ label: 'Wages', amount: 4200, person: 'petitioner' }]);
  });

  test('totalOf sums valid items', () => {
    expect(totalOf([{ label: 'A', amount: 100 }, { label: 'B', amount: 50 }])).toBe(150);
    expect(totalOf(undefined)).toBe(0);
  });
});
