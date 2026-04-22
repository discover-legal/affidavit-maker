'use strict';

/**
 * routingConsistency.test.js
 *
 * Verifies that catalog.js and chat.js are in sync:
 * - The set of divorce-supported state codes matches between both files
 * - ALL_STATES has exactly 51 entries (50 states + DC)
 * - ALL_PROVINCES has exactly 13 entries (10 provinces + 3 territories)
 * - CANADIAN_PROVINCES in chat.js includes NT, YT, NU
 * - Every supported code has a matching template directory
 * - Every supported code has a matching orchestrator file
 * - Every supported code has a matching prompts directory
 *
 * Uses fs.readFileSync + regex to extract data from the route files,
 * avoiding require() which would pull in Express and other server deps.
 *
 * No mocks, no network calls, no DB.
 */

const fs = require('fs');
const path = require('path');

// ── Paths ───────────────────────────────────────────────────────────────────

const PROJECT_ROOT   = path.join(__dirname, '..', '..');
const CATALOG_PATH   = path.join(PROJECT_ROOT, 'routes', 'catalog.js');
const CHAT_PATH      = path.join(PROJECT_ROOT, 'routes', 'chat.js');
const TEMPLATES_ROOT = path.join(PROJECT_ROOT, 'templates', 'states');
const AGENTS_ROOT    = path.join(PROJECT_ROOT, 'services', 'agents');
const PROMPTS_ROOT   = path.join(AGENTS_ROOT, 'prompts');

// ── State code to directory mapping ─────────────────────────────────────────

const CODE_TO_DIR = {
  TX: 'texas', AZ: 'arizona', CA: 'california', FL: 'florida',
  IL: 'illinois', NY: 'newyork', UT: 'utah', CO: 'colorado',
  GA: 'georgia', MA: 'massachusetts', MI: 'michigan',
  NC: 'north_carolina', NJ: 'new_jersey', OH: 'ohio',
  PA: 'pennsylvania', VA: 'virginia', WA: 'washington',
  IN: 'indiana', TN: 'tennessee', MO: 'missouri', MD: 'maryland',
  MN: 'minnesota', KY: 'kentucky', WI: 'wisconsin',
  SC: 'south_carolina', AL: 'alabama', OR: 'oregon', OK: 'oklahoma',
  LA: 'louisiana', CT: 'connecticut', NV: 'nevada', NM: 'new_mexico',
  ID: 'idaho', IA: 'iowa', AR: 'arkansas', KS: 'kansas',
  MS: 'mississippi', NE: 'nebraska', WV: 'west_virginia',
  HI: 'hawaii', ME: 'maine', NH: 'new_hampshire', RI: 'rhode_island',
  MT: 'montana', DE: 'delaware', DC: 'dc',
  AK: 'alaska', ND: 'north_dakota', SD: 'south_dakota',
  VT: 'vermont', WY: 'wyoming',
  ON: 'ontario', BC: 'british_columbia', AB: 'alberta', QC: 'quebec',
  MB: 'manitoba', NB: 'new_brunswick', NL: 'newfoundland',
  NS: 'nova_scotia', PE: 'prince_edward_island', SK: 'saskatchewan',
  NT: 'northwest_territories', YT: 'yukon', NU: 'nunavut',
};

// ── Extraction helpers ──────────────────────────────────────────────────────

/**
 * Extract all 2-letter state codes from the SUPPORTED_STATES.divorce array
 * in catalog.js. The array spans multiple lines and contains string literals
 * like 'TX', 'AZ', etc.
 */
function extractCatalogDivorceCodes(source) {
  // Must anchor to SUPPORTED_STATES to avoid matching DOCS_BY_MATTER.divorce first
  const supportedMatch = source.match(/SUPPORTED_STATES\s*=\s*\{[\s\S]*?divorce:\s*\[([\s\S]*?)\]/);
  if (!supportedMatch) return [];

  const block = supportedMatch[1];
  const codes = [];
  const codeRegex = /'([A-Z]{2})'/g;
  let m;
  while ((m = codeRegex.exec(block)) !== null) {
    codes.push(m[1]);
  }
  return codes;
}

/**
 * Extract divorce orchestrator state codes from chat.js.
 * These appear as entries like ['TX', '../services/agents/TXDivorceOrchestrator']
 * inside the divorceOrchestrators initialization loop.
 */
function extractChatDivorceCodes(source) {
  const blockMatch = source.match(
    /const\s+divorceOrchestrators\s*=\s*\{\};[\s\S]*?for\s*\(\s*const\s+\[stateCode,\s*modulePath\]\s+of\s+\[([\s\S]*?)\]\s*\)/
  );
  if (!blockMatch) return [];

  const block = blockMatch[1];
  const codes = [];
  const codeRegex = /\[\s*'([A-Z]{2})'/g;
  let m;
  while ((m = codeRegex.exec(block)) !== null) {
    codes.push(m[1]);
  }
  return codes;
}

/**
 * Extract ALL_STATES array from catalog.js.
 */
function extractAllStates(source) {
  const match = source.match(/const\s+ALL_STATES\s*=\s*\[([\s\S]*?)\]/);
  if (!match) return [];
  const codes = [];
  const codeRegex = /'([A-Z]{2})'/g;
  let m;
  while ((m = codeRegex.exec(match[1])) !== null) {
    codes.push(m[1]);
  }
  return codes;
}

/**
 * Extract ALL_PROVINCES array from catalog.js.
 */
function extractAllProvinces(source) {
  const match = source.match(/const\s+ALL_PROVINCES\s*=\s*\[([\s\S]*?)\]/);
  if (!match) return [];
  const codes = [];
  const codeRegex = /'([A-Z]{2})'/g;
  let m;
  while ((m = codeRegex.exec(match[1])) !== null) {
    codes.push(m[1]);
  }
  return codes;
}

/**
 * Extract CANADIAN_PROVINCES set from chat.js.
 */
function extractCanadianProvinces(source) {
  const match = source.match(/const\s+CANADIAN_PROVINCES\s*=\s*new\s+Set\(\[([\s\S]*?)\]\)/);
  if (!match) return [];
  const codes = [];
  const codeRegex = /'([A-Z]{2})'/g;
  let m;
  while ((m = codeRegex.exec(match[1])) !== null) {
    codes.push(m[1]);
  }
  return codes;
}

// ── Eagerly load data at module level (needed for it.each/describe.each) ────

const catalogSource = fs.readFileSync(CATALOG_PATH, 'utf-8');
const chatSource    = fs.readFileSync(CHAT_PATH, 'utf-8');

const catalogDivorceCodes = extractCatalogDivorceCodes(catalogSource);
const chatDivorceCodes    = extractChatDivorceCodes(chatSource);
const allStates           = extractAllStates(catalogSource);
const allProvinces        = extractAllProvinces(catalogSource);
const canadianProvinces   = extractCanadianProvinces(chatSource);

// ═══════════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('Routing Consistency - catalog.js and chat.js', () => {

  // ── 1 & 2 & 3. Catalog and chat divorce codes match ────────────────────

  describe('divorce code extraction sanity', () => {
    it('should extract codes from catalog.js SUPPORTED_STATES.divorce', () => {
      expect(catalogDivorceCodes.length).toBeGreaterThan(0);
    });

    it('should extract codes from chat.js divorceOrchestrators', () => {
      expect(chatDivorceCodes.length).toBeGreaterThan(0);
    });
  });

  describe('catalog and chat divorce codes match', () => {
    it('every catalog divorce code should appear in chat orchestrators', () => {
      const chatSet = new Set(chatDivorceCodes);
      const missing = catalogDivorceCodes.filter((c) => !chatSet.has(c));
      expect(missing).toEqual([]);
    });

    it('every chat orchestrator code should appear in catalog divorce list', () => {
      const catalogSet = new Set(catalogDivorceCodes);
      const missing = chatDivorceCodes.filter((c) => !catalogSet.has(c));
      expect(missing).toEqual([]);
    });

    it('both sets should have the same size', () => {
      expect(chatDivorceCodes.length).toBe(catalogDivorceCodes.length);
    });
  });

  // ── 4. ALL_STATES count === 51 (50 states + DC) ────────────────────────

  describe('ALL_STATES', () => {
    it('should contain exactly 51 entries (50 states + DC)', () => {
      expect(allStates.length).toBe(51);
    });

    it('should include DC', () => {
      expect(allStates).toContain('DC');
    });

    it('should have no duplicates', () => {
      const unique = new Set(allStates);
      expect(unique.size).toBe(allStates.length);
    });
  });

  // ── 5. ALL_PROVINCES count === 13 (10 provinces + 3 territories) ───────

  describe('ALL_PROVINCES', () => {
    it('should contain exactly 13 entries (10 provinces + 3 territories)', () => {
      expect(allProvinces.length).toBe(13);
    });

    it('should include NT, YT, and NU (territories)', () => {
      expect(allProvinces).toContain('NT');
      expect(allProvinces).toContain('YT');
      expect(allProvinces).toContain('NU');
    });

    it('should have no duplicates', () => {
      const unique = new Set(allProvinces);
      expect(unique.size).toBe(allProvinces.length);
    });
  });

  // ── 6. CANADIAN_PROVINCES in chat.js includes NT, YT, NU ──────────────

  describe('CANADIAN_PROVINCES in chat.js', () => {
    it('should include NT (Northwest Territories)', () => {
      expect(canadianProvinces).toContain('NT');
    });

    it('should include YT (Yukon)', () => {
      expect(canadianProvinces).toContain('YT');
    });

    it('should include NU (Nunavut)', () => {
      expect(canadianProvinces).toContain('NU');
    });

    it('should include all 13 Canadian jurisdiction codes', () => {
      expect(canadianProvinces.length).toBe(13);
    });
  });

  // ── 7. Every SUPPORTED_STATES.divorce code has a template directory ────

  describe('template directory existence', () => {
    it.each(
      catalogDivorceCodes.map((code) => ({ code, dir: CODE_TO_DIR[code] }))
    )('$code should have a template directory at templates/states/$dir', ({ code, dir }) => {
      expect(dir).toBeDefined();
      const dirPath = path.join(TEMPLATES_ROOT, dir);
      expect(fs.existsSync(dirPath)).toBe(true);
    });
  });

  // ── 8. Every code has a matching orchestrator file ─────────────────────

  describe('orchestrator file existence', () => {
    it.each(
      catalogDivorceCodes.map((code) => ({ code }))
    )('$code should have a DivorceOrchestrator file', ({ code }) => {
      const filePath = path.join(AGENTS_ROOT, `${code}DivorceOrchestrator.js`);
      expect(fs.existsSync(filePath)).toBe(true);
    });
  });

  // ── 9. Every code has a matching prompts directory ─────────────────────

  describe('prompts directory existence', () => {
    it.each(
      catalogDivorceCodes.map((code) => ({
        code,
        promptDirName: code.toLowerCase() + 'Divorce',
      }))
    )('$code should have a prompts/$promptDirName directory with index.js', ({ code, promptDirName }) => {
      const dirPath = path.join(PROMPTS_ROOT, promptDirName);
      expect(fs.existsSync(dirPath)).toBe(true);

      const indexPath = path.join(dirPath, 'index.js');
      expect(fs.existsSync(indexPath)).toBe(true);
    });
  });
});
