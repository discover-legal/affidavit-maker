/**
 * @jest-environment node
 */
import {
  MATTER_TYPES,
  MATTER_MAP,
  DOCS_BY_MATTER,
  getAllJurisdictions,
} from '@/lib/api/catalog-data';

describe('catalog data', () => {
  const originalInternational = process.env.ENABLE_INTERNATIONAL;

  afterEach(() => {
    if (originalInternational === undefined) delete process.env.ENABLE_INTERNATIONAL;
    else process.env.ENABLE_INTERNATIONAL = originalInternational;
  });

  it('exposes 17 matter types across family + civil practice areas', () => {
    expect(MATTER_TYPES).toHaveLength(17);
    expect(MATTER_TYPES.filter((m) => m.practice_area === 'family')).toHaveLength(10);
    expect(MATTER_TYPES.filter((m) => m.practice_area === 'civil')).toHaveLength(7);
  });

  it('merges YAML-defined matters (matters/*.yaml) into the catalog in sort order', () => {
    const nameChange = MATTER_MAP.name_change;
    expect(nameChange).toBeDefined();
    expect(nameChange.display_name).toBe('Name Change');
    expect(nameChange.sort_order).toBe(120);
    expect(DOCS_BY_MATTER.name_change).toEqual([
      'petition_for_name_change',
      'notice_of_petition_name_change',
      'minor_name_change_declaration',
      'indigency_affidavit',
    ]);
    const orders = MATTER_TYPES.map((m) => m.sort_order);
    expect(orders).toEqual([...orders].sort((a, b) => a - b));
    expect(MATTER_TYPES.findIndex((m) => m.code === 'name_change')).toBeGreaterThan(
      MATTER_TYPES.findIndex((m) => m.code === 'small_claims'),
    );
  });

  it('every matter has a non-empty document list', () => {
    for (const matter of MATTER_TYPES) {
      const docs = DOCS_BY_MATTER[matter.code];
      expect(docs).toBeDefined();
      expect(docs.length).toBeGreaterThan(0);
    }
  });

  it('MATTER_MAP keys match MATTER_TYPES codes', () => {
    expect(Object.keys(MATTER_MAP).sort()).toEqual(MATTER_TYPES.map((m) => m.code).sort());
  });

  it('NA-only jurisdictions = 51 states + 13 provinces/territories = 64', () => {
    process.env.ENABLE_INTERNATIONAL = 'false';
    expect(getAllJurisdictions()).toHaveLength(64);
  });

  it('international flag widens to 110+ jurisdictions', () => {
    process.env.ENABLE_INTERNATIONAL = 'true';
    expect(getAllJurisdictions().length).toBeGreaterThan(100);
    process.env.ENABLE_INTERNATIONAL = 'false';
  });
});
