/** @jest-environment node */
'use strict';

const { mergeFacts } = require('../../services/agents/FactOrganizer');

const fact = (id, content, category) => ({ id, content, category });

describe('mergeFacts', () => {
  test('never reorders existing facts (manual ordering preserved)', () => {
    // User dragged a children fact above a residency fact — non-canonical order.
    const existing = [
      fact('c1', 'Our children live with me.', 'children'),
      fact('r1', 'I have lived in Texas for six years.', 'residency'),
      fact('g1', 'The marriage is insupportable.', 'grounds'),
    ];
    const merged = mergeFacts(existing, [fact('s1', 'I request spousal support.', 'support')]);
    expect(merged.slice(0, 3).map((f) => f.id)).toEqual(['c1', 'r1', 'g1']);
  });

  test('inserts a new fact after the last fact of its section', () => {
    const existing = [
      fact('r1', 'I have lived in Texas for six years.', 'residency'),
      fact('c1', 'Our children live with me.', 'children'),
      fact('g1', 'The marriage is insupportable.', 'grounds'),
    ];
    const merged = mergeFacts(existing, [
      fact('c2', 'My youngest starts school next year.', 'children'),
    ]);
    expect(merged.map((f) => f.id)).toEqual(['r1', 'c1', 'c2', 'g1']);
  });

  test('appends when no section sibling exists', () => {
    const existing = [fact('r1', 'I have lived in Texas for six years.', 'residency')];
    const merged = mergeFacts(existing, [
      fact('m1', 'The respondent is not in the military service.', 'military'),
    ]);
    expect(merged.map((f) => f.id)).toEqual(['r1', 'm1']);
  });

  test('upserts duplicates by id, then by normalized content, in place', () => {
    const existing = [
      fact('r1', 'I have lived in Texas for six years.', 'residency'),
      fact('g1', 'The marriage is insupportable.', 'grounds'),
    ];
    const merged = mergeFacts(existing, [
      { id: 'r1', content: 'I have lived in Texas for seven years.', category: 'residency' },
      { content: 'the marriage is   insupportable.', category: 'grounds', subcategory: 'x' },
    ]);
    expect(merged).toHaveLength(2);
    expect(merged[0].content).toBe('I have lived in Texas for seven years.');
    expect(merged[1].subcategory).toBe('x');
    expect(merged[1].id).toBe('g1');
  });

  test('tolerates empty/garbage input', () => {
    expect(mergeFacts(undefined, undefined)).toEqual([]);
    expect(mergeFacts(null, [fact('a', 'Something happened.', 'general')])).toHaveLength(1);
    expect(mergeFacts([fact('a', 'A.', 'general')], [null])).toHaveLength(1);
  });
});
