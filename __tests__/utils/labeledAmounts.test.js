/** @jest-environment node */
'use strict';

const { mergeLabeledAmounts, totalOf } = require('../../utils/labeledAmounts');

describe('mergeLabeledAmounts', () => {
  test('accumulates items across turns without dropping earlier ones', () => {
    let items = mergeLabeledAmounts([], [{ label: 'Housing', amount: 1400 }]);
    items = mergeLabeledAmounts(items, [{ label: 'Food', amount: 600 }]);
    expect(items.map((i) => i.label)).toEqual(['Housing', 'Food']);
  });

  test('re-stating a label updates the amount in place (corrections)', () => {
    const items = mergeLabeledAmounts(
      [{ label: 'Housing', amount: 1400 }],
      [{ label: 'housing', amount: 1550 }],
    );
    expect(items).toHaveLength(1);
    expect(items[0].amount).toBe(1550);
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
