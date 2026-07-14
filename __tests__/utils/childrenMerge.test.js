/** @jest-environment node */
'use strict';

const {
  mergeChildren,
  removeChildrenByName,
  summarizeChildren,
} = require('../../utils/childrenMerge');

describe('mergeChildren', () => {
  test('appends children collected one at a time across turns', () => {
    let children = mergeChildren([], [{ name: 'Emma Smith', dob: '2015-04-02' }]);
    children = mergeChildren(children, [{ name: 'Liam Smith', dob: '2017-06-15' }]);
    children = mergeChildren(children, [{ name: 'Ava Smith', dob: '2019-09-09' }]);
    expect(children).toHaveLength(3);
    expect(children.map((c) => c.name)).toEqual(['Emma Smith', 'Liam Smith', 'Ava Smith']);
  });

  test('reminding the AI about one child does not remove the others (reported bug)', () => {
    const collected = [
      { name: 'Emma Smith', dob: '2015-04-02' },
      { name: 'Liam Smith', dob: '2017-06-15' },
    ];
    // The LLM emits only the child under discussion.
    const merged = mergeChildren(collected, [{ name: 'Ava Smith', dob: '2019-09-09' }]);
    expect(merged).toHaveLength(3);
    expect(merged.map((c) => c.name)).toEqual(['Emma Smith', 'Liam Smith', 'Ava Smith']);
  });

  test('re-sending an existing child updates it instead of duplicating', () => {
    const collected = [{ name: 'Emma Smith', dob: '2015-04-02' }];
    const merged = mergeChildren(collected, [{ name: 'emma smith', age: 11 }]);
    expect(merged).toHaveLength(1);
    expect(merged[0].age).toBe(11);
    expect(merged[0].dob).toBe('2015-04-02');
  });

  test('a first-name-only mention updates the matching child without renaming it', () => {
    const collected = [
      { name: 'Emma Smith', dob: '2015-04-02' },
      { name: 'Liam Smith', dob: '2017-06-15' },
    ];
    const merged = mergeChildren(collected, [{ name: 'Emma', age: 11 }]);
    expect(merged).toHaveLength(2);
    expect(merged[0].name).toBe('Emma Smith');
    expect(merged[0].age).toBe(11);
  });

  test('empty values never erase recorded details', () => {
    const collected = [{ name: 'Emma Smith', dob: '2015-04-02', age: 10 }];
    const merged = mergeChildren(collected, [{ name: 'Emma Smith', dob: '', age: null }]);
    expect(merged[0].dob).toBe('2015-04-02');
    expect(merged[0].age).toBe(10);
  });

  test('stamps dob/dateOfBirth/birthDate aliases for template compatibility', () => {
    const merged = mergeChildren([], [{ name: 'Emma Smith', dob: '2015-04-02' }]);
    expect(merged[0].dob).toBe('2015-04-02');
    expect(merged[0].dateOfBirth).toBe('2015-04-02');
    expect(merged[0].birthDate).toBe('2015-04-02');

    const fromLegacy = mergeChildren([], [{ name: 'Liam', dateOfBirth: '2017-06-15' }]);
    expect(fromLegacy[0].birthDate).toBe('2017-06-15');
  });

  test('matches by date of birth when the incoming entry has no name', () => {
    const collected = [{ name: 'Emma Smith', dob: '2015-04-02' }];
    const merged = mergeChildren(collected, [{ dob: '2015-04-02', age: 11 }]);
    expect(merged).toHaveLength(1);
    expect(merged[0].age).toBe(11);
  });

  test('tolerates undefined/garbage input', () => {
    expect(mergeChildren(undefined, undefined)).toEqual([]);
    expect(mergeChildren(null, [{ name: 'Emma' }])).toHaveLength(1);
    expect(mergeChildren([{ name: 'Emma' }], [null, 'junk', 42])).toHaveLength(1);
  });
});

describe('removeChildrenByName', () => {
  test('removes by exact and partial name match', () => {
    const collected = [
      { name: 'Emma Smith' },
      { name: 'Liam Smith' },
      { name: 'Ava Smith' },
    ];
    expect(removeChildrenByName(collected, ['Liam']).map((c) => c.name)).toEqual([
      'Emma Smith',
      'Ava Smith',
    ]);
    expect(removeChildrenByName(collected, ['ava smith'])).toHaveLength(2);
  });

  test('no-ops on empty removal list', () => {
    const collected = [{ name: 'Emma Smith' }];
    expect(removeChildrenByName(collected, [])).toEqual(collected);
    expect(removeChildrenByName(collected, undefined)).toEqual(collected);
  });
});

describe('summarizeChildren', () => {
  test('renders a numbered list with birth dates', () => {
    const out = summarizeChildren([
      { name: 'Emma Smith', dob: '2015-04-02' },
      { name: 'Liam Smith', age: 7 },
    ]);
    expect(out).toBe('1. Emma Smith (DOB 2015-04-02)\n2. Liam Smith (age 7)');
  });

  test('returns empty string for no children', () => {
    expect(summarizeChildren([])).toBe('');
    expect(summarizeChildren(undefined)).toBe('');
  });
});

describe('dob fallback and hasMinors', () => {
  const { hasMinors } = require('../../utils/childrenMerge');

  test('a re-spelled name with the same dob corrects instead of duplicating', () => {
    const merged = require('../../utils/childrenMerge').mergeChildren(
      [{ name: 'Emma Smith', dob: '2015-04-02' }],
      [{ name: 'Emma Smyth', dob: '2015-04-02' }],
    );
    expect(merged).toHaveLength(1);
    expect(merged[0].name).toBe('Emma Smyth');
  });

  test('hasMinors uses real ages — adult children do not count', () => {
    const now = new Date(2026, 6, 10);
    expect(hasMinors([{ name: 'A', age: 22 }, { name: 'B', age: 25 }], now)).toBe(false);
    expect(hasMinors([{ name: 'A', age: 22 }, { name: 'B', dob: '2015-04-02' }], now)).toBe(true);
    expect(hasMinors([{ name: 'Unknown kid' }], now)).toBe(true); // unknown age = assume minor
    expect(hasMinors([], now)).toBe(false);
  });
});
