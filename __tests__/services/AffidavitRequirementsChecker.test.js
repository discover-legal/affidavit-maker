/** @jest-environment node */
'use strict';

const checker = require('../../services/agents/AffidavitRequirementsChecker');
const REQUIREMENTS = require('../../services/affidavits/requirements/index');

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeFact(content, category) {
  return {
    id:        `${Date.now()}_test`,
    content,
    category,
    type:      'fact',
    timestamp: new Date().toISOString(),
  };
}

// ─── Registry ─────────────────────────────────────────────────────────────────

describe('Requirements registry', () => {
  const EXPECTED_TYPES = [
    'general_affidavit',
    'affidavit_of_residency',
    'affidavit_of_identity',
    'financial_affidavit',
    'affidavit_of_support',
    'affidavit_of_heirship',
    'small_estate_affidavit',
    'affidavit_of_domicile',
    'affidavit_of_no_divorce',
    'affidavit_of_survivorship',
    'affidavit_of_lost_document',
    'vehicle_transfer_affidavit',
    'affidavit_of_no_lien',
  ];

  test('all 13 affidavit types are registered', () => {
    const registered = checker.listTypes();
    EXPECTED_TYPES.forEach(t => {
      expect(registered).toContain(t);
    });
    expect(registered).toHaveLength(EXPECTED_TYPES.length);
  });

  test('every type has required fields in its spec', () => {
    EXPECTED_TYPES.forEach(typeId => {
      const req = REQUIREMENTS[typeId];
      expect(req).toBeDefined();
      expect(typeof req.id).toBe('string');
      expect(typeof req.displayName).toBe('string');
      expect(typeof req.minimumFacts).toBe('number');
      expect(req.minimumFacts).toBeGreaterThan(0);
      expect(Array.isArray(req.requiredTopics)).toBe(true);
      expect(req.requiredTopics.length).toBeGreaterThan(0);
      expect(Array.isArray(req.structuredFields)).toBe(true);
    });
  });

  test('every topic has id, label, hint, and categories', () => {
    EXPECTED_TYPES.forEach(typeId => {
      const req = REQUIREMENTS[typeId];
      req.requiredTopics.forEach(topic => {
        expect(typeof topic.id).toBe('string');
        expect(typeof topic.label).toBe('string');
        expect(typeof topic.hint).toBe('string');
        expect(Array.isArray(topic.categories)).toBe(true);
        expect(topic.categories.length).toBeGreaterThan(0);
      });
    });
  });

  test('unknown type falls back gracefully to general_affidavit', () => {
    const result = checker.check('nonexistent_type', {}, []);
    expect(result.typeId).toBe('nonexistent_type');
    expect(result.displayName).toBe('General Affidavit');
    expect(result.isComplete).toBe(false); // no facts, so incomplete
  });
});

// ─── check() — empty state ────────────────────────────────────────────────────

describe('check() with empty data and no facts', () => {
  test('general_affidavit: incomplete with no facts', () => {
    const result = checker.check('general_affidavit', {}, []);
    expect(result.isComplete).toBe(false);
    expect(result.missingTopics.length).toBeGreaterThan(0);
    expect(result.completeness).toBeLessThan(1);
    expect(result.factCount).toBe(0);
  });

  test('affidavit_of_residency: incomplete with no data or facts', () => {
    const result = checker.check('affidavit_of_residency', {}, []);
    expect(result.isComplete).toBe(false);
    expect(result.missingTopics).toHaveLength(3); // residency_duration, proof_of_residence, purpose
    expect(result.missingFields).toContain('affiantAddress');
  });

  test('financial_affidavit: incomplete with no facts', () => {
    const result = checker.check('financial_affidavit', {}, []);
    expect(result.isComplete).toBe(false);
    expect(result.missingTopics).toHaveLength(4); // income, expenses, assets, liabilities
  });
});

// ─── check() — category matching ──────────────────────────────────────────────

describe('check() topic satisfaction via fact category', () => {
  test('satisfies topic when fact.category matches a topic category keyword', () => {
    const facts = [makeFact('I have lived here since 2021.', 'residency')];
    const result = checker.check('affidavit_of_residency', { affiantAddress: '123 Main St' }, facts);
    const satisfiedIds = result.satisfiedTopics.map(t => t.id);
    expect(satisfiedIds).toContain('residency_duration');
  });

  test('satisfies topic when fact.content contains a category keyword', () => {
    // No category set — match via content
    const facts = [makeFact('I moved into this address in January 2022 and have resided here since.', 'general')];
    const result = checker.check('affidavit_of_residency', { affiantAddress: '123 Main St' }, facts);
    const satisfiedIds = result.satisfiedTopics.map(t => t.id);
    expect(satisfiedIds).toContain('residency_duration');
  });

  test('topic is not satisfied when category and content share no keywords', () => {
    const facts = [makeFact('My name is John.', 'identity')];
    const result = checker.check('affidavit_of_residency', {}, facts);
    const satisfiedIds = result.satisfiedTopics.map(t => t.id);
    expect(satisfiedIds).not.toContain('residency_duration');
    expect(satisfiedIds).not.toContain('proof_of_residence');
    expect(satisfiedIds).not.toContain('purpose');
  });
});

// ─── check() — structured fields ─────────────────────────────────────────────

describe('check() structured field evaluation', () => {
  test('affidavit_of_residency: affiantAddress present → field satisfied', () => {
    const result = checker.check('affidavit_of_residency', { affiantAddress: '123 Main St' }, []);
    expect(result.satisfiedFields).toContain('affiantAddress');
    expect(result.missingFields).not.toContain('affiantAddress');
  });

  test('affidavit_of_residency: affiantAddress missing → field in missing', () => {
    const result = checker.check('affidavit_of_residency', {}, []);
    expect(result.missingFields).toContain('affiantAddress');
    expect(result.satisfiedFields).not.toContain('affiantAddress');
  });

  test('empty string does not satisfy a structured field', () => {
    const result = checker.check('affidavit_of_residency', { affiantAddress: '  ' }, []);
    expect(result.missingFields).toContain('affiantAddress');
  });
});

// ─── check() — minimum facts gate ────────────────────────────────────────────

describe('check() minimum facts gate', () => {
  test('does not complete when fact count is below minimum even if topics covered', () => {
    // financial_affidavit needs 4 facts minimum
    const facts = [
      makeFact('My monthly income is $3,000.', 'income'),
      makeFact('My monthly expenses total $2,000.', 'expenses'),
      makeFact('I own a vehicle worth $10,000.', 'assets'),
      // liabilities topic NOT covered — so isComplete should be false
    ];
    const result = checker.check('financial_affidavit', {}, facts);
    expect(result.isComplete).toBe(false);
    expect(result.missingTopics.map(t => t.id)).toContain('liabilities');
  });

  test('affidavit_of_no_divorce: 1 fact minimum — satisfied by one fact', () => {
    const facts = [makeFact('I have never been divorced and no divorce proceedings are pending.', 'marital')];
    const result = checker.check('affidavit_of_no_divorce', {}, facts);
    expect(result.isComplete).toBe(true);
    expect(result.hasEnoughFacts).toBe(true);
  });

  test('hasEnoughFacts is false when below minimum', () => {
    // affidavit_of_heirship needs 3 facts minimum
    const facts = [makeFact('Decedent John Smith died on Jan 1 2024.', 'decedent')];
    const result = checker.check('affidavit_of_heirship', {}, facts);
    expect(result.hasEnoughFacts).toBe(false);
    expect(result.factCount).toBe(1);
    expect(result.minimumFacts).toBe(3);
  });
});

// ─── check() — completeness ratio ────────────────────────────────────────────

describe('check() completeness ratio', () => {
  test('0.0 when nothing collected for a type with no structured fields', () => {
    const result = checker.check('affidavit_of_support', {}, []);
    expect(result.completeness).toBe(0);
  });

  test('between 0 and 1 when partially complete', () => {
    const facts = [makeFact('The person I support is my spouse Jane Doe.', 'relationship')];
    const result = checker.check('affidavit_of_support', {}, facts);
    expect(result.completeness).toBeGreaterThan(0);
    expect(result.completeness).toBeLessThan(1);
  });

  test('1.0 when fully complete', () => {
    const facts = [
      makeFact('I have never been divorced and no divorce is pending.', 'marital'),
    ];
    const result = checker.check('affidavit_of_no_divorce', {}, facts);
    // 1 topic, 0 structured fields → 1/1 = 1.0, plus minimumFacts met
    expect(result.completeness).toBe(1.0);
    expect(result.isComplete).toBe(true);
  });
});

// ─── check() — complete scenarios per type ───────────────────────────────────

describe('check() — isComplete: true scenarios', () => {
  test('general_affidavit complete with core facts + purpose', () => {
    const facts = [
      makeFact('On March 1, 2024, I personally witnessed the accident.', 'fact'),
      makeFact('This affidavit is needed for an insurance claim filing.', 'purpose'),
    ];
    const result = checker.check('general_affidavit', {}, facts);
    expect(result.isComplete).toBe(true);
  });

  test('affidavit_of_identity complete', () => {
    const facts = [
      makeFact('My full legal name is Jane Smith, formerly Jane Doe before my marriage.', 'name'),
      makeFact('The discrepancy is that my passport shows Jane Doe and my SSA record shows Jane Smith.', 'discrepancy'),
    ];
    const result = checker.check('affidavit_of_identity', {}, facts);
    expect(result.isComplete).toBe(true);
  });

  test('affidavit_of_support complete', () => {
    const facts = [
      makeFact('The person I sponsor is my brother Carlos Reyes, a lawful immigrant.', 'relationship'),
      makeFact('I provide $1,500 per month in financial support and he resides in my home.', 'financial'),
    ];
    const result = checker.check('affidavit_of_support', {}, facts);
    expect(result.isComplete).toBe(true);
  });

  test('affidavit_of_lost_document complete', () => {
    const facts = [
      makeFact('The lost document is the original vehicle title for my 2018 Honda Civic.', 'lost'),
      makeFact('I last saw the title in my filing cabinet; it was lost during my move in April 2024. I searched all boxes and contacted the DMV for a replacement.', 'circumstances'),
    ];
    const result = checker.check('affidavit_of_lost_document', {}, facts);
    expect(result.isComplete).toBe(true);
  });

  test('vehicle_transfer_affidavit complete', () => {
    const facts = [
      makeFact('The vehicle is a 2019 Toyota Camry, VIN 4T1B11HK8KU123456.', 'vehicle'),
      makeFact('I am transferring title to this vehicle because the registered owner, my mother, died on February 10, 2024.', 'death'),
    ];
    const result = checker.check('vehicle_transfer_affidavit', {}, facts);
    expect(result.isComplete).toBe(true);
  });

  test('affidavit_of_no_lien complete', () => {
    const facts = [
      makeFact('The property is located at 456 Oak Lane, Houston, TX, Lot 12 Block 3 Greenwood Subdivision.', 'property'),
      makeFact('There is no mortgage, no judgment liens, no mechanic liens, all taxes are current, and no HOA fees are owed. The property is free and clear of all encumbrances.', 'lien'),
    ];
    const result = checker.check('affidavit_of_no_lien', {}, facts);
    expect(result.isComplete).toBe(true);
  });
});

// ─── formatMissingForPrompt ───────────────────────────────────────────────────

describe('formatMissingForPrompt()', () => {
  test('returns completion message when nothing is missing', () => {
    const facts = [
      makeFact('I have never been divorced.', 'marital'),
    ];
    const result = checker.check('affidavit_of_no_divorce', {}, facts);
    const text = checker.formatMissingForPrompt(result);
    expect(text).toMatch(/all required topics/i);
    expect(text).toMatch(/phase_complete/i);
  });

  test('lists missing topic labels when incomplete', () => {
    const result = checker.check('affidavit_of_residency', {}, []);
    const text = checker.formatMissingForPrompt(result);
    expect(text).toMatch(/TOPICS STILL TO COVER/);
    expect(text).toContain('How long the affiant has lived at the current address');
  });

  test('includes hint text for missing topics', () => {
    const result = checker.check('affidavit_of_residency', {}, []);
    const text = checker.formatMissingForPrompt(result);
    // hint for residency_duration references "date they moved in"
    expect(text).toMatch(/date they moved in|how many years/i);
  });

  test('lists missing structured fields', () => {
    const result = checker.check('affidavit_of_residency', {}, []);
    const text = checker.formatMissingForPrompt(result);
    expect(text).toMatch(/STRUCTURED FIELDS STILL NEEDED/);
    expect(text).toContain('affiantAddress');
  });
});

// ─── formatSatisfiedForPrompt ─────────────────────────────────────────────────

describe('formatSatisfiedForPrompt()', () => {
  test('returns "no topics covered" message when empty', () => {
    const result = checker.check('financial_affidavit', {}, []);
    const text = checker.formatSatisfiedForPrompt(result);
    expect(text).toMatch(/no topics covered/i);
  });

  test('lists satisfied topics with checkmarks', () => {
    const facts = [makeFact('My monthly salary is $4,000.', 'income')];
    const result = checker.check('financial_affidavit', {}, facts);
    const text = checker.formatSatisfiedForPrompt(result);
    expect(text).toMatch(/ALREADY COVERED/);
    expect(text).toContain('✓');
    expect(text).toMatch(/Monthly income/i);
  });
});
