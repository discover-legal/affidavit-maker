/** @jest-environment node */
// Tests for the Utah child support estimator + Child Support Worksheet builder.
//
// services/childSupport/utahTable.js carries VERBATIM data from Utah Code
// §§ 81-6-304/-305 (see its header for provenance). The pins below — row
// counts, whole-table checksums, and spot cells — were taken from the same
// two independently-verified extractions of the official le.utah.gov PDFs,
// so any silent edit to the encoded data fails loudly.
//
// Worksheet-math expectations are hand-computed from the encoded rows and the
// verbatim rules of §§ 81-6-204/-205/-206.

const statutoryTable = require('../../services/childSupport/utahTable');
const {
  calculate,
  calculateUtah,
  validateTable,
  OFFICIAL_CALCULATOR_URL,
} = require('../../services/childSupport');
const { childSupportWorksheet } = require('../../services/supportDocs/utahChildSupportWorksheet');

// Two minor children as of 2026 (born 2015 and 2018).
const fullData = {
  petitionerName: 'Jane Q. Example',
  respondentName: 'John R. Example',
  state: 'UT',
  county: 'Salt Lake',
  caseNumber: '244900123',
  children: [
    { name: 'Emma Example', dob: '2015-04-02' },
    { name: 'Liam Example', dateOfBirth: '2018-09-10' },
  ],
  petitionerMonthlyIncome: 2400,
  respondentMonthlyIncome: 1600,
  primaryCustodian: 'petitioner',
  parentTimePlan: 'statutory_minimum',
};

function calc(overrides = {}) {
  return calculateUtah({ ...fullData, ...overrides });
}

function rowFor(rows, income) {
  return rows.find((r) => income >= r.from && income <= r.to);
}

/** Flatten a structure's sections to one searchable string. */
function textOf(structure) {
  return JSON.stringify(structure.sections);
}

const UNPOPULATED_TABLE = { populated: false, baseRows: [], lowIncomeRows: [] };

// ─── encoded-table pins: counts, checksums, spot cells, monotonicity ─────────

describe('utahTable — verbatim data pins', () => {
  test('row counts and whole-table checksums match the verified extraction', () => {
    const sum = (rows) =>
      rows.reduce((s, r) => s + r.byChildren.reduce((a, v) => a + (v || 0), 0), 0);
    expect(statutoryTable.baseRows).toHaveLength(221);
    expect(statutoryTable.lowIncomeRows).toHaveLength(88);
    expect(sum(statutoryTable.baseRows)).toBe(3848005);
    expect(sum(statutoryTable.lowIncomeRows)).toBe(180482);
  });

  test.each([
    // [income, expected row: from, to, byChildren]
    [1951, 1951, 2000, [366, null, null, null, null, null]],
    [2250, 2201, 2300, [410, 628, 728, null, null, null]],
    [4000, 3901, 4000, [581, 1004, 1160, 1294, 1423, 1548]],
    [4050, 4001, 4100, [590, 1024, 1182, 1318, 1450, 1577]],
    [8000, 7901, 8000, [915, 1442, 1642, 1831, 2014, 2192]],
    [21000, 20001, 22000, [1766, 2754, 3117, 3475, 3822, 4159]],
    [99999, 98001, 100000, [5908, 8356, 9751, 11139, 12313, 13472]],
  ])('base table @ %i', (income, from, to, byChildren) => {
    const row = rowFor(statutoryTable.baseRows, income);
    expect(row).toEqual({ from, to, byChildren });
  });

  test.each([
    [25, 0, 50, [30, 30, 30, 30, 30, 30]],
    [500, 151, 750, [30, 55, 75, 90, 100, 105]],
    [1000, 751, 1256, [60, 111, 151, 181, 201, 211]],
    [1600, 1591, 1600, [175, 255, 318, 366, 398, 414]],
    [1955, 1951, 1960, [351, 449, 527, 585, 624, 644]],
    [1995, 1991, 2000, [null, 478, 557, 617, 657, 677]],
    [2450, 2401, 2450, [null, null, null, null, null, 1008]],
  ])('low income table @ %i', (income, from, to, byChildren) => {
    const row = rowFor(statutoryTable.lowIncomeRows, income);
    expect(row).toEqual({ from, to, byChildren });
  });

  test('provenance is recorded and the module validates structurally', () => {
    expect(statutoryTable.populated).toBe(true);
    expect(statutoryTable.sourceUrl).toMatch(/^https:\/\/le\.utah\.gov\//);
    expect(statutoryTable.effectiveDate).toMatch(/9\/1\/2024/);
    expect(statutoryTable.fetchedAt).toBe('2026-07-11');
    expect(statutoryTable.minimumSoleAward).toBe(30);
    const result = validateTable(statutoryTable);
    expect(result.errors).toEqual([]);
    expect(result.valid).toBe(true);
  });

  test('obligations are non-decreasing in combined income for every child count', () => {
    for (const rows of [statutoryTable.baseRows, statutoryTable.lowIncomeRows]) {
      for (let col = 0; col < statutoryTable.childColumns; col++) {
        let prev = -Infinity;
        for (const row of rows) {
          const v = row.byChildren[col];
          if (v === null) continue;
          expect(v).toBeGreaterThanOrEqual(prev);
          prev = v;
        }
      }
    }
  });
});

// ─── validateTable: instant verification for future re-encodings ─────────────

describe('validateTable', () => {
  const tinyValid = {
    populated: true,
    sourceUrl: 'https://le.utah.gov/x',
    effectiveDate: 'x',
    fetchedAt: 'x',
    childColumns: 2,
    minimumSoleAward: 30,
    baseRows: [
      { from: 1000, to: 1999, byChildren: [100, 150] },
      { from: 2000, to: 2999, byChildren: [200, 300] },
    ],
    lowIncomeRows: [{ from: 0, to: 999, byChildren: [30, 40] }],
  };

  test('accepts a well-formed table', () => {
    expect(validateTable(tinyValid).valid).toBe(true);
  });

  test('rejects non-contiguous brackets', () => {
    const broken = {
      ...tinyValid,
      baseRows: [tinyValid.baseRows[0], { from: 2500, to: 2999, byChildren: [200, 300] }],
    };
    const result = validateTable(broken);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/not contiguous/);
  });

  test('rejects obligations that decrease as the child count rises', () => {
    const broken = {
      ...tinyValid,
      baseRows: [{ from: 1000, to: 1999, byChildren: [150, 100] }],
    };
    expect(validateTable(broken).errors.join(' ')).toMatch(/decreases as the child count rises/);
  });

  test('rejects obligations that decrease as income rises', () => {
    const broken = {
      ...tinyValid,
      baseRows: [
        { from: 1000, to: 1999, byChildren: [100, 150] },
        { from: 2000, to: 2999, byChildren: [90, 150] },
      ],
    };
    expect(validateTable(broken).errors.join(' ')).toMatch(/decreases as income rises/);
  });

  test('rejects wrong column counts, non-integers, and missing provenance', () => {
    expect(
      validateTable({
        ...tinyValid,
        baseRows: [{ from: 1000, to: 1999, byChildren: [100] }],
      }).errors.join(' '),
    ).toMatch(/exactly 2 entries/);
    expect(
      validateTable({
        ...tinyValid,
        baseRows: [{ from: 1000, to: 1999, byChildren: [100.5, 150] }],
      }).errors.join(' '),
    ).toMatch(/positive integer/);
    expect(validateTable({ ...tinyValid, effectiveDate: null }).errors.join(' ')).toMatch(
      /effectiveDate/,
    );
  });

  test('unpopulated shape is fine only while it carries no rows', () => {
    expect(validateTable(UNPOPULATED_TABLE).valid).toBe(true);
    const halfEdited = { ...UNPOPULATED_TABLE, baseRows: tinyValid.baseRows };
    const result = validateTable(halfEdited);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/populated is false but rows are present/);
  });
});

// ─── worksheet math: § 81-6-205 sole custody (hand-computed) ─────────────────

describe('calculateUtah — sole custody (§ 81-6-205)', () => {
  test('proportional share: base 1,442 @ 8,000 combined, obligor 62.5% → $901', () => {
    // Obligor income 5,000 is above the low income table, so no cap applies.
    const result = calc({
      petitionerMonthlyIncome: 3000,
      respondentMonthlyIncome: 5000,
    });
    expect(result.model).toBe('sole');
    expect(result.combinedMonthlyIncome).toBe(8000);
    expect(result.baseCombinedObligation).toBe(1442); // row 7,901-8,000, 2 children
    expect(result.petitionerShare).toBe(37.5);
    expect(result.respondentShare).toBe(62.5);
    expect(result.obligorRole).toBe('respondent');
    expect(result.monthlyObligation).toBe(901); // round(1442 × 0.625) = round(901.25)
    expect(result.childCount).toBe(2);
    expect(result.meta.statute).toMatch(/81-6-304/);
    expect(result.meta.encodedFrom).toMatch(/le\.utah\.gov/);
    expect(result.notes.join(' ')).toMatch(/ESTIMATE/);
    expect(result.notes.join(' ')).toMatch(/not legal advice/);
    expect(result.notes.join(' ')).toContain(OFFICIAL_CALCULATOR_URL);
  });

  test('low income cap (§ 205(4)(a)): lesser of $402 share and $255 low-table amount', () => {
    // fullData: combined 4,000 → base 1,004 (2 children); respondent share 40%
    // → round(401.6) = 402; obligor income 1,600 → low table row 1,591-1,600,
    // 2 children = 255; award = lesser = 255.
    const result = calc();
    expect(result.baseCombinedObligation).toBe(1004);
    expect(result.monthlyObligation).toBe(255);
    expect(result.perChild).toBe(127.5);
    expect(result.notes.join(' ')).toMatch(/low income table/);
  });

  test('blank low income cell (§ 205(4)(b)) keeps the proportional amount', () => {
    // Combined 10,000 → base 1,026 (1 child); obligor income 2,000 → low row
    // 1,991-2,000 is blank for 1 child → keep round(1026 × 0.2) = 205.
    const result = calc({
      petitionerMonthlyIncome: 8000,
      respondentMonthlyIncome: 2000,
      children: [{ name: 'Solo Example', dob: '2016-03-01' }],
    });
    expect(result.baseCombinedObligation).toBe(1026);
    expect(result.monthlyObligation).toBe(205);
    expect(result.notes.join(' ')).not.toMatch(/low income table sets/);
  });

  test('below the base table (§§ 204(4), 205(3)): low table sets the award', () => {
    // Combined 1,800 < 1,951 → base $0; obligor income 800 → low row
    // 751-1,256, 2 children = 111.
    const result = calc({
      petitionerMonthlyIncome: 1000,
      respondentMonthlyIncome: 800,
    });
    expect(result.baseCombinedObligation).toBe(0);
    expect(result.monthlyObligation).toBe(111);
    expect(result.notes.join(' ')).toMatch(/low income table/);
  });

  test('blank base cell (§ 204(4)) also routes to the low table', () => {
    // Combined 2,050 → row 2,001-2,100 blank for 3 children → base $0;
    // obligor income 750 → low row 151-750, 3 children = 75.
    const result = calc({
      petitionerMonthlyIncome: 1300,
      respondentMonthlyIncome: 750,
      children: [
        { name: 'A Example', dob: '2015-01-01' },
        { name: 'B Example', dob: '2017-01-01' },
        { name: 'C Example', dob: '2019-01-01' },
      ],
    });
    expect(result.baseCombinedObligation).toBe(0);
    expect(result.monthlyObligation).toBe(75);
  });

  test('$30 minimum (§ 205(5))', () => {
    // Combined 2,040 → base 385 (1 child); obligor share 40/2040 → round(7.55)
    // = 8 → floor to $30.
    const result = calc({
      petitionerMonthlyIncome: 2000,
      respondentMonthlyIncome: 40,
      children: [{ name: 'Solo Example', dob: '2016-03-01' }],
    });
    expect(result.monthlyObligation).toBe(30);
    expect(result.notes.join(' ')).toMatch(/minimum of \$30/);
  });

  test('above the table (§ 204(8)): highest bracket is the floor, with a note', () => {
    // Combined 120,000 → highest row 98,001-100,000, 3 children = 9,751;
    // obligor share 50% → round(4,875.5) = 4,876.
    const result = calc({
      petitionerMonthlyIncome: 60000,
      respondentMonthlyIncome: 60000,
      children: [
        { name: 'A Example', dob: '2015-01-01' },
        { name: 'B Example', dob: '2017-01-01' },
        { name: 'C Example', dob: '2019-01-01' },
      ],
    });
    expect(result.baseCombinedObligation).toBe(9751);
    expect(result.monthlyObligation).toBe(4876);
    expect(result.notes.join(' ')).toMatch(/highest bracket/);
  });

  test('more than six children (§ 204(7)): six-child column with a note', () => {
    // Combined 6,000 → row 5,901-6,000, 6-child column = 1,971; obligor share
    // 60% → round(1,182.6) = 1,183 (obligor income 3,600 is above the low table).
    const children = Array.from({ length: 7 }, (_, i) => ({
      name: `Child ${i + 1} Example`,
      dob: '2018-01-01',
    }));
    const result = calc({
      petitionerMonthlyIncome: 2400,
      respondentMonthlyIncome: 3600,
      children,
    });
    expect(result.childCount).toBe(7);
    expect(result.baseCombinedObligation).toBe(1971);
    expect(result.monthlyObligation).toBe(1183);
    expect(result.notes.join(' ')).toMatch(/81-6-204\(7\)/);
  });

  test('adult children are excluded from the count, with a note', () => {
    // One minor left → base row 3,901-4,000, 1 child = 581; share 40% →
    // round(232.4) = 232; obligor income 1,600 → low table 1 child = 175 →
    // lesser = 175.
    const result = calc({
      children: [
        { name: 'Emma Example', dob: '2015-04-02' },
        { name: 'Grown Example', dob: '2000-01-01' },
      ],
    });
    expect(result.childCount).toBe(1);
    expect(result.baseCombinedObligation).toBe(581);
    expect(result.monthlyObligation).toBe(175);
    expect(result.notes.join(' ')).toMatch(/Grown Example/);
  });

  test('explicit childSupportPayor (by name) overrides the custodian inference', () => {
    // Obligor petitioner: share 60% of 1,004 → round(602.4) = 602; petitioner
    // income 2,400 is above the low table, no cap.
    const result = calc({ childSupportPayor: 'Jane Q. Example', primaryCustodian: undefined });
    expect(result.obligorRole).toBe('petitioner');
    expect(result.monthlyObligation).toBe(602);
  });

  test('income fallbacks: monthlyIncome + person-tagged incomeBreakdown', () => {
    const result = calc({
      petitionerMonthlyIncome: undefined,
      respondentMonthlyIncome: undefined,
      monthlyIncome: '$2,400',
      incomeBreakdown: [
        { label: 'Wages', amount: 9999 }, // ignored: monthlyIncome wins for petitioner
        { label: 'Respondent wages', amount: 1600, person: 'respondent' },
      ],
    });
    expect(result.petitionerIncome).toBe(2400);
    expect(result.respondentIncome).toBe(1600);
    expect(result.monthlyObligation).toBe(255);
  });

  test("'expanded' parent-time keeps the sole model and points to the official calculator", () => {
    const result = calc({ parentTimePlan: 'expanded' });
    expect(result.model).toBe('sole');
    expect(result.monthlyObligation).toBe(255);
    expect(result.notes.join(' ')).toMatch(/joint physical custody/i);
    expect(result.notes.join(' ')).toMatch(/overnight count/i);
  });
});

// ─── worksheet math: § 81-6-206 joint physical custody (hand-computed) ───────

describe('calculateUtah — joint physical custody (§ 81-6-206)', () => {
  test("equal schedule (§ 206(7)): deemed 183/182, offsets .0027/.0084 → $110", () => {
    // Base 1,004; lower-income respondent deemed 183 → petitioner has 182
    // (lesser). Offsets: 20 × .0027 + 52 × .0084 = .4908.
    // round(1004 × (0.6 − 0.4908)) = round(109.6368) = 110, petitioner pays.
    const result = calc({ parentTimePlan: 'equal', primaryCustodian: undefined });
    expect(result.model).toBe('joint');
    expect(result.baseCombinedObligation).toBe(1004);
    expect(result.obligorRole).toBe('petitioner');
    expect(result.monthlyObligation).toBe(110);
    expect(result.overnights).toEqual({ petitioner: 182, respondent: 183 });
    expect(result.notes.join(' ')).toMatch(/81-6-206\(7\)/);
  });

  test('explicit overnights: 120 nights → 10 × .0027 offset → $374', () => {
    // Lesser = respondent (120): round(1004 × (0.4 − 10 × .0027)) =
    // round(374.492) = 374.
    const result = calc({
      petitionerOvernights: 245,
      respondentOvernights: 120,
      parentTimePlan: 'custom',
    });
    expect(result.model).toBe('joint');
    expect(result.obligorRole).toBe('respondent');
    expect(result.monthlyObligation).toBe(374);
  });

  test('negative result flips the payor (§ 206(6))', () => {
    // Shares 40/60; lesser-overnights petitioner (182): 1004 × (0.4 − 0.4908)
    // = −91.16 → respondent (more overnights) pays $91.
    const result = calc({
      petitionerMonthlyIncome: 1600,
      respondentMonthlyIncome: 2400,
      petitionerOvernights: 182,
      respondentOvernights: 183,
      parentTimePlan: 'custom',
    });
    expect(result.model).toBe('joint');
    expect(result.obligorRole).toBe('respondent');
    expect(result.monthlyObligation).toBe(91);
    expect(result.notes.join(' ')).toMatch(/flips who pays/);
  });

  test('base $0 in joint custody → award $0, no $30 minimum (§ 206(2))', () => {
    const result = calc({
      petitionerMonthlyIncome: 900,
      respondentMonthlyIncome: 900,
      parentTimePlan: 'equal',
    });
    expect(result.model).toBe('joint');
    expect(result.baseCombinedObligation).toBe(0);
    expect(result.monthlyObligation).toBe(0);
    expect(result.obligorRole).toBeNull();
    expect(result.notes.join(' ')).toMatch(/81-6-206\(2\)/);
  });

  test('equal schedule needs no primary custodian to compute', () => {
    const result = calc({ parentTimePlan: 'equal', primaryCustodian: undefined, childSupportPayor: undefined });
    expect(result.insufficient).toBeUndefined();
    expect(result.model).toBe('joint');
  });
});

// ─── insufficient-data path ──────────────────────────────────────────────────

describe('calculateUtah — insufficient data', () => {
  test('missing respondent income', () => {
    const result = calc({ respondentMonthlyIncome: undefined });
    expect(result.insufficient).toBe(true);
    expect(result.missing).toContain('respondent gross monthly income');
    expect(result.notes.join(' ')).toMatch(/not legal advice/);
  });

  test('missing petitioner income, children, and custodian all reported together', () => {
    const result = calculateUtah({});
    expect(result.insufficient).toBe(true);
    expect(result.missing).toEqual(
      expect.arrayContaining([
        'petitioner gross monthly income',
        'respondent gross monthly income',
        'the children this support covers (names and birth dates)',
      ]),
    );
    expect(result.missing.join(' ')).toMatch(/primary custodian/);
  });
});

// ─── defensive: broken or unpopulated table module ───────────────────────────

describe('calculateUtah — table module guardrails', () => {
  test('unpopulated table → unavailable, never a dollar figure', () => {
    const result = calculateUtah(fullData, { table: UNPOPULATED_TABLE });
    expect(result.unavailable).toBe(true);
    expect(result.reason).toBe('table_not_populated');
    expect(result.officialCalculatorUrl).toBe(OFFICIAL_CALCULATOR_URL);
    expect(result.monthlyObligation).toBeUndefined();
    // Table-free math still comes through for the worksheet.
    expect(result.partial.combinedMonthlyIncome).toBe(4000);
    expect(result.partial.petitionerShare).toBe(60);
    expect(result.partial.respondentShare).toBe(40);
  });

  test('structurally invalid table → unavailable with reason table_invalid', () => {
    const broken = { ...statutoryTable, baseRows: [] };
    const result = calculateUtah(fullData, { table: broken });
    expect(result.unavailable).toBe(true);
    expect(result.reason).toBe('table_invalid');
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

// ─── dispatcher ──────────────────────────────────────────────────────────────

describe('childSupport index dispatch', () => {
  test('calculate() routes UT (case-insensitively) and returns null otherwise', () => {
    expect(calculate('TX', fullData)).toBeNull();
    expect(calculate('', fullData)).toBeNull();
    expect(calculate(undefined, fullData)).toBeNull();
    const viaDispatch = calculate('ut', fullData);
    expect(viaDispatch.model).toBe('sole');
    expect(viaDispatch.monthlyObligation).toBe(255);
  });

  test('calculateUtah is re-exported', () => {
    expect(typeof calculateUtah).toBe('function');
  });
});

// ─── worksheet builder ───────────────────────────────────────────────────────

describe('childSupportWorksheet builder', () => {
  test('returns a pdfService-renderable affidavit structure', () => {
    const structure = childSupportWorksheet(fullData);
    expect(structure.state).toBe('UT');
    expect(structure.documentType).toBe('affidavit');
    expect(structure.metadata.kind).toBe('child_support_worksheet');
    expect(structure.metadata.estimate).toBe(true);
    expect(structure.sections.title).toBe('CHILD SUPPORT WORKSHEET (ESTIMATE)');
    expect(structure.sections.header).toContain('DISTRICT COURT OF SALT LAKE COUNTY');
    expect(structure.sections.caseCaption.formatted).toContain('JANE Q. EXAMPLE');
    expect(Array.isArray(structure.sections.facts.items)).toBe(true);
    structure.sections.facts.items.forEach((item, idx) => {
      expect(item.number).toBe(idx + 1);
      expect(typeof item.content).toBe('string');
      expect(item.content.length).toBeGreaterThan(0);
    });
  });

  test.each([
    ['full estimate', undefined, fullData],
    ['unavailable', { table: UNPOPULATED_TABLE }, fullData],
    ['insufficient', undefined, { ...fullData, respondentMonthlyIncome: undefined }],
  ])('%s state carries the disclaimer and official-calculator pointer', (_label, opts, data) => {
    const text = textOf(childSupportWorksheet(data, opts));
    expect(text).toMatch(/ESTIMATE/);
    expect(text).toMatch(/not legal advice/);
    expect(text).toContain(OFFICIAL_CALCULATOR_URL);
  });

  test('full state prints the statutory numbers, payor, and children', () => {
    const text = textOf(childSupportWorksheet(fullData));
    expect(text).toContain('$2,400'); // petitioner income
    expect(text).toContain('$1,600'); // respondent income
    expect(text).toContain('$4,000'); // combined
    expect(text).toContain('$1,004'); // base combined obligation (2 children)
    expect(text).toContain('$255'); // monthly obligation (low income cap)
    expect(text).toContain('$127.50'); // per child, informational
    expect(text).toContain('60%');
    expect(text).toContain('40%');
    expect(text).toContain('Sole physical custody');
    expect(text).toMatch(/John R\. Example/); // obligor
    expect(text).toContain('(born 2015)');
    expect(text).toContain('(born 2018)');
  });

  test('joint custody state names the joint worksheet and amount', () => {
    const text = textOf(
      childSupportWorksheet({ ...fullData, parentTimePlan: 'equal', primaryCustodian: undefined }),
    );
    expect(text).toContain('Joint physical custody');
    expect(text).toContain('$110');
    expect(text).toMatch(/81-6-206\(7\)/);
  });

  test('unavailable state still prints incomes but blanks the table lines', () => {
    const text = textOf(childSupportWorksheet(fullData, { table: UNPOPULATED_TABLE }));
    expect(text).toContain('$2,400');
    expect(text).toContain('$1,600');
    expect(text).toContain('$4,000');
    expect(text).toContain('60%');
    expect(text).toContain('$__________'); // blank money lines
    expect(text).toMatch(/not available yet/i);
    expect(text).toMatch(/official child support calculator/i);
    expect(text).not.toContain('$255'); // no dollar estimate without the table
  });

  test('insufficient state renders blanks plus the exact missing list and fix path', () => {
    const data = {
      petitionerName: 'Jane Q. Example',
      respondentName: 'John R. Example',
      county: 'Salt Lake',
      children: [{ name: 'Emma Example', dob: '2015-04-02' }],
      petitionerMonthlyIncome: 2400,
      // no respondent income, no custodian/payor
    };
    const text = textOf(childSupportWorksheet(data));
    expect(text).toContain('$__________');
    expect(text).toContain('respondent gross monthly income');
    expect(text).toMatch(/primary custodian/);
    expect(text).toContain('/profile');
    expect(text).toContain('Fix my story');
    expect(text).toContain('Emma Example'); // listed even without a computed count
  });
});
