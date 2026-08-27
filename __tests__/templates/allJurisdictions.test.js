/** @jest-environment node */
'use strict';

/**
 * allJurisdictions.test.js
 *
 * Comprehensive validation of all 64 jurisdictions in the template system.
 * Checks file existence, metadata validity, template class loading and
 * instantiation, orchestrator loading, and prompt loading.
 *
 * No mocks, no network calls, no DB — pure file-system integration tests.
 */

const fs = require('fs');
const path = require('path');

// ── All 64 jurisdictions: code, directory name, display name ────────────────

const JURISDICTIONS = [
  // Original 7 US states
  { code: 'TX', dir: 'texas', name: 'Texas' },
  { code: 'AZ', dir: 'arizona', name: 'Arizona' },
  { code: 'CA', dir: 'california', name: 'California' },
  { code: 'FL', dir: 'florida', name: 'Florida' },
  { code: 'IL', dir: 'illinois', name: 'Illinois' },
  { code: 'NY', dir: 'newyork', name: 'New York' },
  { code: 'UT', dir: 'utah', name: 'Utah' },
  // Phase 0 US expansion
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
  // Phase 1 US expansion
  { code: 'IN', dir: 'indiana', name: 'Indiana' },
  { code: 'TN', dir: 'tennessee', name: 'Tennessee' },
  { code: 'MO', dir: 'missouri', name: 'Missouri' },
  { code: 'MD', dir: 'maryland', name: 'Maryland' },
  { code: 'MN', dir: 'minnesota', name: 'Minnesota' },
  { code: 'KY', dir: 'kentucky', name: 'Kentucky' },
  // Phase 2 US expansion
  { code: 'WI', dir: 'wisconsin', name: 'Wisconsin' },
  { code: 'SC', dir: 'south_carolina', name: 'South Carolina' },
  { code: 'AL', dir: 'alabama', name: 'Alabama' },
  { code: 'OR', dir: 'oregon', name: 'Oregon' },
  { code: 'OK', dir: 'oklahoma', name: 'Oklahoma' },
  // Phase 3 US expansion
  { code: 'LA', dir: 'louisiana', name: 'Louisiana' },
  { code: 'CT', dir: 'connecticut', name: 'Connecticut' },
  { code: 'NV', dir: 'nevada', name: 'Nevada' },
  { code: 'NM', dir: 'new_mexico', name: 'New Mexico' },
  { code: 'ID', dir: 'idaho', name: 'Idaho' },
  // Phase 4 US expansion
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
  // Phase 5 US expansion
  { code: 'AK', dir: 'alaska', name: 'Alaska' },
  { code: 'ND', dir: 'north_dakota', name: 'North Dakota' },
  { code: 'SD', dir: 'south_dakota', name: 'South Dakota' },
  { code: 'VT', dir: 'vermont', name: 'Vermont' },
  { code: 'WY', dir: 'wyoming', name: 'Wyoming' },
  // Canadian provinces
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
  // Canadian territories
  { code: 'NT', dir: 'northwest_territories', name: 'Northwest Territories' },
  { code: 'YT', dir: 'yukon', name: 'Yukon' },
  { code: 'NU', dir: 'nunavut', name: 'Nunavut' },
];

// ── Shared path helpers ─────────────────────────────────────────────────────

const TEMPLATES_ROOT = path.join(__dirname, '..', '..', 'templates', 'states');
const AGENTS_ROOT   = path.join(__dirname, '..', '..', 'services', 'agents');
const PROMPTS_ROOT  = path.join(AGENTS_ROOT, 'prompts');

/**
 * Map a 2-letter state code to its lowercase prompt directory name.
 * Convention: code.toLowerCase() + 'Divorce' (e.g. 'TX' -> 'txDivorce')
 */
function promptDir(code) {
  return code.toLowerCase() + 'Divorce';
}

/**
 * Map a 2-letter state code to its orchestrator file name.
 * Convention: CODE + 'DivorceOrchestrator.js' (e.g. 'TX' -> 'TXDivorceOrchestrator.js')
 */
function orchestratorFile(code) {
  return code + 'DivorceOrchestrator.js';
}

// ── Required template files per jurisdiction ────────────────────────────────

const REQUIRED_FILES = [
  'metadata.json',
  'divorce-metadata.json',
  'AffidavitTemplate.js',
  'DivorcePetitionTemplate.js',
  'DivorceDecreeTemplate.js',
];

// ═══════════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════════

describe('All Jurisdictions - Template System', () => {

  // Sanity check: we have exactly 64 jurisdictions
  it('should define exactly 64 jurisdictions', () => {
    expect(JURISDICTIONS.length).toBe(64);
  });

  describe.each(JURISDICTIONS)('$code ($name)', ({ code, dir, name }) => {
    const templateDir = path.join(TEMPLATES_ROOT, dir);

    // ── 1. File existence ─────────────────────────────────────────────────

    describe('template file existence', () => {
      it.each(REQUIRED_FILES)('should have %s', (fileName) => {
        const filePath = path.join(templateDir, fileName);
        expect(fs.existsSync(filePath)).toBe(true);
      });
    });

    // ── 2. Metadata JSON validity ─────────────────────────────────────────

    describe('metadata.json validity', () => {
      let metadata;

      beforeAll(() => {
        const raw = fs.readFileSync(path.join(templateDir, 'metadata.json'), 'utf-8');
        metadata = JSON.parse(raw);
      });

      it('should parse without errors', () => {
        expect(metadata).toBeDefined();
        expect(typeof metadata).toBe('object');
      });

      it('should have stateCode matching the jurisdiction code', () => {
        expect(metadata.stateCode).toBe(code);
      });

      it('should have a stateName string', () => {
        expect(typeof metadata.stateName).toBe('string');
        expect(metadata.stateName.length).toBeGreaterThan(0);
      });

      it('should have documentTypes as a non-empty array', () => {
        expect(Array.isArray(metadata.documentTypes)).toBe(true);
        expect(metadata.documentTypes.length).toBeGreaterThan(0);
      });

      it('should have features.perjuryStatement as a boolean', () => {
        expect(metadata.features).toBeDefined();
        expect(typeof metadata.features.perjuryStatement).toBe('boolean');
      });
    });

    describe('divorce-metadata.json validity', () => {
      let divorceMeta;

      beforeAll(() => {
        const raw = fs.readFileSync(path.join(templateDir, 'divorce-metadata.json'), 'utf-8');
        divorceMeta = JSON.parse(raw);
      });

      it('should parse without errors', () => {
        expect(divorceMeta).toBeDefined();
        expect(typeof divorceMeta).toBe('object');
      });

      it('should have stateCode matching the jurisdiction code', () => {
        expect(divorceMeta.stateCode).toBe(code);
      });

      it('should have a stateName string', () => {
        expect(typeof divorceMeta.stateName).toBe('string');
        expect(divorceMeta.stateName.length).toBeGreaterThan(0);
      });

      it('should have terminology as an object', () => {
        expect(typeof divorceMeta.terminology).toBe('object');
        expect(divorceMeta.terminology).not.toBeNull();
      });
    });

    // ── 3. Template class loading ─────────────────────────────────────────

    describe('template class loading', () => {
      it('should require AffidavitTemplate.js without errors', () => {
        expect(() => {
          require(path.join(templateDir, 'AffidavitTemplate.js'));
        }).not.toThrow();
      });

      it('should require DivorcePetitionTemplate.js without errors', () => {
        expect(() => {
          require(path.join(templateDir, 'DivorcePetitionTemplate.js'));
        }).not.toThrow();
      });

      it('should require DivorceDecreeTemplate.js without errors', () => {
        expect(() => {
          require(path.join(templateDir, 'DivorceDecreeTemplate.js'));
        }).not.toThrow();
      });
    });

    // ── 4. Template instantiation ─────────────────────────────────────────

    describe('AffidavitTemplate instantiation', () => {
      let instance;

      beforeAll(() => {
        const AffidavitTemplate = require(path.join(templateDir, 'AffidavitTemplate.js'));
        instance = new AffidavitTemplate();
      });

      it('should have a state property', () => {
        expect(instance.state).toBeDefined();
        expect(typeof instance.state).toBe('string');
      });

      it('should have a stateName property', () => {
        expect(instance.stateName).toBeDefined();
        expect(typeof instance.stateName).toBe('string');
      });

      it('should have a generateHeader method', () => {
        expect(typeof instance.generateHeader).toBe('function');
      });

      it('should have a generateVenue method', () => {
        expect(typeof instance.generateVenue).toBe('function');
      });

      it('should have a performStateSpecificValidation method', () => {
        expect(typeof instance.performStateSpecificValidation).toBe('function');
      });
    });

    describe('DivorcePetitionTemplate instantiation', () => {
      let instance;

      beforeAll(() => {
        const DivorcePetitionTemplate = require(path.join(templateDir, 'DivorcePetitionTemplate.js'));
        instance = new DivorcePetitionTemplate();
      });

      it('should have a state property', () => {
        expect(instance.state).toBeDefined();
        expect(typeof instance.state).toBe('string');
      });

      it('should have a stateName property', () => {
        expect(instance.stateName).toBeDefined();
        expect(typeof instance.stateName).toBe('string');
      });

      it('should have a documentTitle property', () => {
        expect(instance.documentTitle).toBeDefined();
        expect(typeof instance.documentTitle).toBe('string');
        expect(instance.documentTitle.length).toBeGreaterThan(0);
      });

      it('should have a getCaseNumberLabel method', () => {
        expect(typeof instance.getCaseNumberLabel).toBe('function');
      });

      it('should have a getDefaultCourt method', () => {
        expect(typeof instance.getDefaultCourt).toBe('function');
      });

      it('should have a generateHeader method', () => {
        expect(typeof instance.generateHeader).toBe('function');
      });

      it('should have a generateGroundsSection method', () => {
        expect(typeof instance.generateGroundsSection).toBe('function');
      });

      it('should have a generateReliefSection method', () => {
        expect(typeof instance.generateReliefSection).toBe('function');
      });
    });

    describe('DivorceDecreeTemplate instantiation', () => {
      let instance;

      beforeAll(() => {
        const DivorceDecreeTemplate = require(path.join(templateDir, 'DivorceDecreeTemplate.js'));
        instance = new DivorceDecreeTemplate();
      });

      it('should have a state property', () => {
        expect(instance.state).toBeDefined();
        expect(typeof instance.state).toBe('string');
      });

      it('should have a stateName property', () => {
        expect(instance.stateName).toBeDefined();
        expect(typeof instance.stateName).toBe('string');
      });

      it('should have a documentTitle property', () => {
        expect(instance.documentTitle).toBeDefined();
        expect(typeof instance.documentTitle).toBe('string');
        expect(instance.documentTitle.length).toBeGreaterThan(0);
      });

      it('should have a getCaseNumberLabel method', () => {
        expect(typeof instance.getCaseNumberLabel).toBe('function');
      });

      it('should have a getDefaultCourt method', () => {
        expect(typeof instance.getDefaultCourt).toBe('function');
      });

      it('should have a generateHeader method', () => {
        expect(typeof instance.generateHeader).toBe('function');
      });

      it('should have a generateJurisdictionSection method', () => {
        expect(typeof instance.generateJurisdictionSection).toBe('function');
      });

      it('should have a generateDissolutionSection method', () => {
        expect(typeof instance.generateDissolutionSection).toBe('function');
      });
    });

    // ── 4b. Exactly one court identification ──────────────────────────────
    // The 2026-08 Utah QA run found the court line doubled: the
    // generateHeader/generateVenue block rendered immediately above a case
    // caption that also names the court. The caption is the single court
    // identification (templates/core/captionDedupe.js) — assert every
    // jurisdiction's petition and decree renders its court-line phrase
    // exactly once in the full text.

    describe('single court identification', () => {
      const { normalizeCourtText } = require(path.join(
        __dirname, '..', '..', 'templates', 'core', 'captionDedupe.js'
      ));
      const SAMPLE = {
        petitionerName: 'Sam Matrix',
        respondentName: 'Alex Matrix',
        county: 'Testville',
        caseNumber: 'FC-1234',
        marriageDate: '2012-06-15',
        separationDate: '2024-11-01',
        divorceDate: '2026-08-01',
        groundsForDivorce: 'separation',
        hasMinorChildren: true,
        children: [{ name: 'Jo Matrix', dob: '2015-04-02' }],
      };

      const countOccurrences = (haystack, needle) => {
        if (!needle) return 0;
        return haystack.split(needle).length - 1;
      };

      it.each(['DivorcePetitionTemplate.js', 'DivorceDecreeTemplate.js'])(
        '%s renders its court-line phrase exactly once',
        (file) => {
          const Template = require(path.join(templateDir, file));
          const instance = new Template();
          const doc = instance.generateDocument({ ...SAMPLE, state: instance.state });
          const caption = doc.sections.caseCaption || {};
          // The caption's own court line: the first formatted line naming a
          // court/tribunal, else the courtName field.
          const captionCourtLine =
            String(caption.formatted || '')
              .split('\n')
              .find((line) => /\b(COURT|TRIBUNAL)\b/i.test(line)) ||
            caption.courtName ||
            caption.courtHeaderLine;
          const needle = normalizeCourtText(captionCourtLine);
          expect(needle).toBeTruthy();
          // Count in the region above the document title — a judgment
          // block naming the court after the orders is legitimate; a second
          // court identification above the title is the doubled-caption bug.
          const fullText = doc.fullText;
          const title = doc.sections.title;
          const titleIdx = title ? fullText.indexOf(title) : -1;
          const head = normalizeCourtText(titleIdx >= 0 ? fullText.slice(0, titleIdx) : fullText);
          expect(countOccurrences(head, needle)).toBe(1);
        }
      );
    });

    // ── 5. Orchestrator loading ───────────────────────────────────────────

    describe('orchestrator loading', () => {
      let orchestrator;

      beforeAll(() => {
        orchestrator = require(path.join(AGENTS_ROOT, orchestratorFile(code)));
      });

      it('should load without errors', () => {
        expect(orchestrator).toBeDefined();
        expect(typeof orchestrator).toBe('object');
      });

      it('should have a stateCode property', () => {
        expect(orchestrator.stateCode).toBe(code);
      });

      it('should have a stateName property', () => {
        expect(typeof orchestrator.stateName).toBe('string');
        expect(orchestrator.stateName.length).toBeGreaterThan(0);
      });

      it('should have a phases object', () => {
        expect(typeof orchestrator.phases).toBe('object');
        expect(orchestrator.phases).not.toBeNull();
      });

      it('should have a phaseOrder array', () => {
        expect(Array.isArray(orchestrator.phaseOrder)).toBe(true);
        expect(orchestrator.phaseOrder.length).toBeGreaterThan(0);
      });
    });

    // ── 6. Prompt loading ─────────────────────────────────────────────────

    describe('prompt loading', () => {
      let prompts;

      beforeAll(() => {
        prompts = require(path.join(PROMPTS_ROOT, promptDir(code), 'index.js'));
      });

      it('should export PHASES as an object with at least 8 keys', () => {
        expect(typeof prompts.PHASES).toBe('object');
        expect(prompts.PHASES).not.toBeNull();
        expect(Object.keys(prompts.PHASES).length).toBeGreaterThanOrEqual(8);
      });

      it('should export PHASE_ORDER as an array of at least 8 strings', () => {
        expect(Array.isArray(prompts.PHASE_ORDER)).toBe(true);
        expect(prompts.PHASE_ORDER.length).toBeGreaterThanOrEqual(8);
        prompts.PHASE_ORDER.forEach((phase) => {
          expect(typeof phase).toBe('string');
        });
      });

      it('should have every PHASE_ORDER entry present in PHASES', () => {
        prompts.PHASE_ORDER.forEach((phaseName) => {
          expect(prompts.PHASES).toHaveProperty(phaseName);
        });
      });

      it('should have every PHASES key present in PHASE_ORDER', () => {
        Object.keys(prompts.PHASES).forEach((phaseName) => {
          expect(prompts.PHASE_ORDER).toContain(phaseName);
        });
      });
    });
  });
});
