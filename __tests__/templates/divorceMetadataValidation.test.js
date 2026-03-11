'use strict';

/**
 * divorceMetadataValidation.test.js
 *
 * Validates the legal accuracy and structural consistency of
 * divorce-metadata.json across all 64 jurisdictions.
 *
 * No mocks, no network calls, no DB — pure file-system integration tests.
 */

const fs = require('fs');
const path = require('path');

// ── Jurisdiction list (same as allJurisdictions.test.js) ────────────────────

const JURISDICTIONS = [
  { code: 'TX', dir: 'texas', name: 'Texas' },
  { code: 'AZ', dir: 'arizona', name: 'Arizona' },
  { code: 'CA', dir: 'california', name: 'California' },
  { code: 'FL', dir: 'florida', name: 'Florida' },
  { code: 'IL', dir: 'illinois', name: 'Illinois' },
  { code: 'NY', dir: 'newyork', name: 'New York' },
  { code: 'UT', dir: 'utah', name: 'Utah' },
  { code: 'CO', dir: 'colorado', name: 'Colorado' },
  { code: 'GA', dir: 'georgia', name: 'Georgia' },
  { code: 'MA', dir: 'massachusetts', name: 'Massachusetts' },
  { code: 'MI', dir: 'michigan', name: 'Michigan' },
  { code: 'NC', dir: 'north_carolina', name: 'North Carolina' },
  { code: 'NJ', dir: 'new_jersey', name: 'New Jersey' },
  { code: 'OH', dir: 'ohio', name: 'Ohio' },
  { code: 'PA', dir: 'pennsylvania', name: 'Pennsylvania' },
  { code: 'VA', dir: 'virginia', name: 'Virginia' },
  { code: 'WA', dir: 'washington', name: 'Washington' },
  { code: 'IN', dir: 'indiana', name: 'Indiana' },
  { code: 'TN', dir: 'tennessee', name: 'Tennessee' },
  { code: 'MO', dir: 'missouri', name: 'Missouri' },
  { code: 'MD', dir: 'maryland', name: 'Maryland' },
  { code: 'MN', dir: 'minnesota', name: 'Minnesota' },
  { code: 'KY', dir: 'kentucky', name: 'Kentucky' },
  { code: 'WI', dir: 'wisconsin', name: 'Wisconsin' },
  { code: 'SC', dir: 'south_carolina', name: 'South Carolina' },
  { code: 'AL', dir: 'alabama', name: 'Alabama' },
  { code: 'OR', dir: 'oregon', name: 'Oregon' },
  { code: 'OK', dir: 'oklahoma', name: 'Oklahoma' },
  { code: 'LA', dir: 'louisiana', name: 'Louisiana' },
  { code: 'CT', dir: 'connecticut', name: 'Connecticut' },
  { code: 'NV', dir: 'nevada', name: 'Nevada' },
  { code: 'NM', dir: 'new_mexico', name: 'New Mexico' },
  { code: 'ID', dir: 'idaho', name: 'Idaho' },
  { code: 'IA', dir: 'iowa', name: 'Iowa' },
  { code: 'AR', dir: 'arkansas', name: 'Arkansas' },
  { code: 'KS', dir: 'kansas', name: 'Kansas' },
  { code: 'MS', dir: 'mississippi', name: 'Mississippi' },
  { code: 'NE', dir: 'nebraska', name: 'Nebraska' },
  { code: 'WV', dir: 'west_virginia', name: 'West Virginia' },
  { code: 'HI', dir: 'hawaii', name: 'Hawaii' },
  { code: 'ME', dir: 'maine', name: 'Maine' },
  { code: 'NH', dir: 'new_hampshire', name: 'New Hampshire' },
  { code: 'RI', dir: 'rhode_island', name: 'Rhode Island' },
  { code: 'MT', dir: 'montana', name: 'Montana' },
  { code: 'DE', dir: 'delaware', name: 'Delaware' },
  { code: 'DC', dir: 'dc', name: 'District of Columbia' },
  { code: 'AK', dir: 'alaska', name: 'Alaska' },
  { code: 'ND', dir: 'north_dakota', name: 'North Dakota' },
  { code: 'SD', dir: 'south_dakota', name: 'South Dakota' },
  { code: 'VT', dir: 'vermont', name: 'Vermont' },
  { code: 'WY', dir: 'wyoming', name: 'Wyoming' },
  { code: 'ON', dir: 'ontario', name: 'Ontario' },
  { code: 'BC', dir: 'british_columbia', name: 'British Columbia' },
  { code: 'AB', dir: 'alberta', name: 'Alberta' },
  { code: 'QC', dir: 'quebec', name: 'Quebec' },
  { code: 'MB', dir: 'manitoba', name: 'Manitoba' },
  { code: 'NB', dir: 'new_brunswick', name: 'New Brunswick' },
  { code: 'NL', dir: 'newfoundland', name: 'Newfoundland and Labrador' },
  { code: 'NS', dir: 'nova_scotia', name: 'Nova Scotia' },
  { code: 'PE', dir: 'prince_edward_island', name: 'Prince Edward Island' },
  { code: 'SK', dir: 'saskatchewan', name: 'Saskatchewan' },
  { code: 'NT', dir: 'northwest_territories', name: 'Northwest Territories' },
  { code: 'YT', dir: 'yukon', name: 'Yukon' },
  { code: 'NU', dir: 'nunavut', name: 'Nunavut' },
];

const TEMPLATES_ROOT = path.join(__dirname, '..', '..', 'templates', 'states');

// ── Community property states ───────────────────────────────────────────────
// These states use community property division. All others use equitable
// distribution (if they have a propertyDivision field at all).

const COMMUNITY_PROPERTY_CODES = new Set([
  'TX', 'AZ', 'CA', 'WA', 'NV', 'NM', 'ID', 'LA', 'WI',
]);

// ── Canadian territory codes ────────────────────────────────────────────────
const CANADIAN_TERRITORY_CODES = new Set(['NT', 'YT', 'NU']);

// ── Helper: load divorce-metadata.json for a jurisdiction ───────────────────

function loadDivorceMetadata(dir) {
  const filePath = path.join(TEMPLATES_ROOT, dir, 'divorce-metadata.json');
  const raw = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(raw);
}

// ── Helper: deep-search an object for any numeric value ─────────────────────

function deepContainsNumber(obj) {
  const search = (val) => {
    if (typeof val === 'number') return true;
    if (Array.isArray(val)) return val.some(search);
    if (val && typeof val === 'object') return Object.values(val).some(search);
    return false;
  };
  return search(obj);
}

// ── Helper: deep-search an object for a string value (case-insensitive) ─────

function deepContainsString(obj, searchStr) {
  const lower = searchStr.toLowerCase();
  const search = (val) => {
    if (typeof val === 'string') return val.toLowerCase().includes(lower);
    if (Array.isArray(val)) return val.some(search);
    if (val && typeof val === 'object') return Object.values(val).some(search);
    return false;
  };
  return search(obj);
}

// ── Eagerly load all metadata at module level (needed for it.each) ──────────

const allMeta = {};
JURISDICTIONS.forEach(({ code, dir }) => {
  allMeta[code] = loadDivorceMetadata(dir);
});

// ═══════════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('Divorce Metadata Validation - All Jurisdictions', () => {

  // ── 1. Residency requirements ───────────────────────────────────────────

  describe('residency requirements', () => {
    it.each(JURISDICTIONS)('$code ($name) should have residencyRequirements', ({ code }) => {
      const meta = allMeta[code];
      expect(meta.residencyRequirements).toBeDefined();
      // Jurisdictions use many different structures:
      //   - Most: stateMonths (number)
      //   - MO: stateDays (number)
      //   - SC: bothResidentMonths / oneNonResidentMonths
      //   - NY: options (array of jurisdictional bases)
      //   - NV/ID: stateWeeks (number)
      //   - LA: parishMonths / domicile
      //   - OR: nested marriedInOregon.stateMonths / marriedOutsideOregon.stateMonths
      // All must have at least one numeric duration field somewhere or an options array.
      const r = meta.residencyRequirements;
      const hasOptionsArray = Array.isArray(r.options) && r.options.length > 0;
      const hasNumericField = deepContainsNumber(r);
      const hasDomicile = r.domicile === true;
      expect(hasNumericField || hasOptionsArray || hasDomicile).toBe(true);
    });
  });

  // ── 2. Waiting period ───────────────────────────────────────────────────

  describe('waiting period', () => {
    it.each(JURISDICTIONS)('$code ($name) should have waitingPeriod', ({ code }) => {
      const meta = allMeta[code];
      expect(meta.waitingPeriod).toBeDefined();
      // Waiting period structures vary:
      //   - Most: waitingPeriod.days (number)
      //   - PA: waitingPeriod.mutualConsent.days / waitingPeriod.separation.years
      //   - SC: waitingPeriod.noFault.separationYears / waitingPeriod.faultBased.daysAfterFiling
      //   - TN: waitingPeriod.noChildren.days / waitingPeriod.withChildren.days
      // All must have at least one numeric duration field somewhere in the object.
      const wp = meta.waitingPeriod;
      const hasDirectDays = typeof wp.days === 'number';
      const hasNestedDays = deepContainsNumber(wp);
      expect(hasDirectDays || hasNestedDays).toBe(true);
    });
  });

  // ── 3. Grounds for divorce/dissolution ──────────────────────────────────

  describe('grounds for divorce', () => {
    it.each(JURISDICTIONS)('$code ($name) should have grounds with at least a noFault array', ({ code }) => {
      const meta = allMeta[code];
      // Some states use groundsForDivorce, others use groundsForDissolution
      const grounds = meta.groundsForDivorce || meta.groundsForDissolution;
      expect(grounds).toBeDefined();
      expect(Array.isArray(grounds.noFault)).toBe(true);
      expect(grounds.noFault.length).toBeGreaterThan(0);
    });
  });

  // ── 4. Community property states ────────────────────────────────────────

  describe('community property vs equitable distribution', () => {
    // Only test jurisdictions that have a propertyDivision field
    const jurisdictionsWithProperty = JURISDICTIONS.filter(({ code }) => {
      return allMeta[code].propertyDivision != null;
    });

    it.each(
      jurisdictionsWithProperty.filter(({ code }) => COMMUNITY_PROPERTY_CODES.has(code))
    )('$code ($name) should be community_property', ({ code }) => {
      expect(allMeta[code].propertyDivision.type).toBe('community_property');
    });

    it.each(
      jurisdictionsWithProperty.filter(({ code }) => !COMMUNITY_PROPERTY_CODES.has(code))
    )('$code ($name) should be equitable_distribution', ({ code }) => {
      expect(allMeta[code].propertyDivision.type).toBe('equitable_distribution');
    });
  });

  // ── 5. Canadian territories must reference the Divorce Act ──────────────

  describe('Canadian territories reference Divorce Act', () => {
    const territories = JURISDICTIONS.filter(({ code }) => CANADIAN_TERRITORY_CODES.has(code));

    it.each(territories)('$code ($name) should reference Divorce Act', ({ code }) => {
      const meta = allMeta[code];
      // Check in legalCitations, description fields, or grounds statutes
      const hasDivorceActRef = deepContainsString(meta, 'Divorce Act');
      expect(hasDivorceActRef).toBe(true);
    });
  });

  // ── 6. Unique terminology checks ────────────────────────────────────────

  describe('state-specific terminology', () => {
    it('WI should reference "Physical Placement" in terminology', () => {
      const terminology = allMeta['WI'].terminology;
      const hasPhysicalPlacement = deepContainsString(terminology, 'Physical Placement');
      expect(hasPhysicalPlacement).toBe(true);
    });

    it('VT should reference "Legal Responsibility" or "Physical Responsibility" in terminology', () => {
      const terminology = allMeta['VT'].terminology;
      const hasLegalResp = deepContainsString(terminology, 'Legal Responsibility');
      const hasPhysicalResp = deepContainsString(terminology, 'Physical Responsibility');
      expect(hasLegalResp || hasPhysicalResp).toBe(true);
    });

    it('ND should reference "Primary Residential Responsibility" or "Decision-Making Responsibility" in terminology', () => {
      const terminology = allMeta['ND'].terminology;
      const hasPrimary = deepContainsString(terminology, 'Primary Residential Responsibility');
      const hasDecision = deepContainsString(terminology, 'Decision-Making Responsibility');
      expect(hasPrimary || hasDecision).toBe(true);
    });

    it('MS should reference "Complainant", "Chancellor", or "Chancery" in terminology', () => {
      const terminology = allMeta['MS'].terminology;
      const hasComplainant = deepContainsString(terminology, 'Complainant');
      const hasChancellor = deepContainsString(terminology, 'Chancellor');
      const hasChancery = deepContainsString(terminology, 'Chancery');
      expect(hasComplainant || hasChancellor || hasChancery).toBe(true);
    });

    it('TX should reference "Conservatorship" in terminology', () => {
      const terminology = allMeta['TX'].terminology;
      const hasConservatorship = deepContainsString(terminology, 'Conservatorship');
      expect(hasConservatorship).toBe(true);
    });

    it('FL should reference "Time-Sharing" in terminology', () => {
      const terminology = allMeta['FL'].terminology;
      const hasTimeSharing = deepContainsString(terminology, 'Time-Sharing');
      expect(hasTimeSharing).toBe(true);
    });

    it('NY should reference "Maintenance" (not "Alimony") in terminology', () => {
      const terminology = allMeta['NY'].terminology;
      const hasMaintenance = deepContainsString(terminology, 'Maintenance');
      expect(hasMaintenance).toBe(true);
      // alimony key should say "Maintenance", not "Alimony"
      if (terminology.alimony) {
        expect(terminology.alimony).toBe('Maintenance');
      }
    });
  });

  // ── 7. FL waiting period is 20 days (Fla. Stat. section 61.19) ──────────

  describe('Florida waiting period', () => {
    it('FL should have a 20-day waiting period per Fla. Stat. section 61.19', () => {
      expect(allMeta['FL'].waitingPeriod.days).toBe(20);
    });
  });

  // ── 8. NY DRL 170(5)/(6) says 6+ months ────────────────────────────────

  describe('New York separation ground duration', () => {
    it('NY should reference 6+ months for living apart conversion grounds (Chapter 673, Laws of 2025)', () => {
      const grounds = allMeta['NY'].groundsForDivorce || allMeta['NY'].groundsForDissolution;
      expect(grounds).toBeDefined();

      // Check conversion grounds (DRL 170(5) and 170(6))
      const conversion = grounds.conversion || [];
      const allGrounds = [...(grounds.noFault || []), ...(grounds.fault || []), ...conversion];

      // Find DRL 170(5) or 170(6) entries
      const separationGrounds = allGrounds.filter((g) => {
        const statute = (g.statute || '').toLowerCase();
        const description = (g.description || '').toLowerCase();
        return statute.includes('170(5)') || statute.includes('170(6)') ||
               description.includes('170(5)') || description.includes('170(6)');
      });

      expect(separationGrounds.length).toBeGreaterThan(0);

      // Each should mention "6" months (not "1 year" as the old law said)
      separationGrounds.forEach((ground) => {
        const desc = (ground.description || '').toLowerCase();
        const has6Months = desc.includes('6') && desc.includes('month');
        expect(has6Months).toBe(true);
      });
    });
  });
});
