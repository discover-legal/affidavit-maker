'use strict';

/**
 * routes/catalog.js
 *
 * Public catalog of matter types and document types.
 * No authentication required — these are read-only reference endpoints.
 *
 * GET /api/catalog/matters                   - List all 16 matter types
 * GET /api/catalog/matters/:code             - Single matter type detail
 * GET /api/catalog/matters/:code/documents   - Document types for a matter
 * GET /api/catalog/states/:state/matters     - Matters supported in a state
 * GET /api/catalog/document-types/:code      - Single document type detail
 */

const express = require('express');
const router  = express.Router();
const { asyncHandler, NotFoundError, ValidationError } = require('../middleware/errorMiddleware');
const { standardLimiter } = require('../middleware/rateLimiting');
const logger  = require('../utils/logger');
const { isInternationalEnabled } = require('../config/jurisdictions');

// ─── In-memory catalog (single source of truth, no DB dependency) ─────────────
// Keeps the catalog fast and available even before DB migrations run.

const MATTER_TYPES = [
  // Family Law
  { code: 'divorce',           practice_area: 'family', display_name: 'Divorce / Dissolution of Marriage', short_name: 'Divorce',           tagline: 'End your marriage and divide your assets fairly',                    sort_order: 10, is_packaged: true  },
  { code: 'custody',           practice_area: 'family', display_name: 'Child Custody & Visitation',        short_name: 'Custody',           tagline: 'Establish legal custody and a parenting schedule for your children', sort_order: 20, is_packaged: false },
  { code: 'child_support',     practice_area: 'family', display_name: 'Child Support',                    short_name: 'Child Support',     tagline: 'Establish or modify a child support order',                          sort_order: 30, is_packaged: false },
  { code: 'paternity',         practice_area: 'family', display_name: 'Paternity',                        short_name: 'Paternity',         tagline: 'Establish or disestablish legal parentage',                          sort_order: 40, is_packaged: false },
  { code: 'dvro',              practice_area: 'family', display_name: 'Domestic Violence Restraining Order', short_name: 'DVRO',           tagline: 'Get a protective order against domestic violence',                    sort_order: 50, is_packaged: false },
  { code: 'legal_separation',  practice_area: 'family', display_name: 'Legal Separation',                 short_name: 'Legal Separation',  tagline: 'Live separately while remaining legally married',                    sort_order: 60, is_packaged: false },
  { code: 'annulment',         practice_area: 'family', display_name: 'Annulment / Nullity of Marriage',  short_name: 'Annulment',         tagline: 'Declare your marriage was never legally valid',                       sort_order: 70, is_packaged: false },
  { code: 'guardianship_minor',practice_area: 'family', display_name: 'Guardianship of a Minor',          short_name: 'Guardianship',      tagline: 'Become the legal guardian of a child',                               sort_order: 80, is_packaged: false },
  { code: 'adoption',          practice_area: 'family', display_name: 'Adoption',                         short_name: 'Adoption',          tagline: 'Legally adopt a child or adult family member',                       sort_order: 90, is_packaged: false },
  { code: 'emancipation',      practice_area: 'family', display_name: 'Emancipation of a Minor',          short_name: 'Emancipation',      tagline: 'Gain adult legal independence before turning 18',                    sort_order: 100, is_packaged: false },
  // Civil Law
  { code: 'small_claims',      practice_area: 'civil',  display_name: 'Small Claims',                     short_name: 'Small Claims',      tagline: 'Sue for money in small claims court — no lawyer needed',             sort_order: 110, is_packaged: false },
  { code: 'name_change',       practice_area: 'civil',  display_name: 'Name Change',                      short_name: 'Name Change',       tagline: 'Legally change your name or your child\'s name',                    sort_order: 120, is_packaged: false },
  { code: 'civil_harassment',  practice_area: 'civil',  display_name: 'Civil Harassment Restraining Order', short_name: 'Harassment RO',  tagline: 'Get a restraining order against a neighbor, coworker, or acquaintance', sort_order: 130, is_packaged: false },
  { code: 'debt_defense',      practice_area: 'civil',  display_name: 'Debt Collection Defense',          short_name: 'Debt Defense',      tagline: 'Respond to a debt collection lawsuit and assert your defenses',       sort_order: 140, is_packaged: false },
  { code: 'landlord_tenant',   practice_area: 'civil',  display_name: 'Landlord-Tenant',                  short_name: 'Landlord/Tenant',   tagline: 'Handle evictions, deposits, or habitability disputes',               sort_order: 150, is_packaged: false },
  { code: 'general_civil',     practice_area: 'civil',  display_name: 'General Civil Lawsuit',            short_name: 'Civil Lawsuit',     tagline: 'File a civil lawsuit for money damages',                             sort_order: 160, is_packaged: false },
  { code: 'probate',           practice_area: 'civil',  display_name: 'Probate & Estate Administration',  short_name: 'Probate',           tagline: 'Administer a loved one\'s estate after death',                       sort_order: 170, is_packaged: false },
];

// Map code → matter for O(1) lookups
const MATTER_MAP = Object.fromEntries(MATTER_TYPES.map(m => [m.code, m]));

// Document types indexed by matter code
const DOCS_BY_MATTER = {
  divorce:            ['divorce_petition', 'divorce_decree', 'parenting_plan', 'waiver_of_service', 'prove_up_affidavit', 'military_status_affidavit', 'cert_last_known_address', 'indigency_affidavit'],
  custody:            ['petition_for_custody', 'motion_to_modify_custody', 'parenting_plan', 'declaration_in_support', 'indigency_affidavit'],
  child_support:      ['petition_for_child_support', 'motion_to_modify_support', 'financial_declaration', 'motion_for_arrears', 'indigency_affidavit'],
  paternity:          ['petition_to_establish_paternity', 'petition_to_disestablish_paternity', 'motion_to_amend_birth_certificate', 'petition_for_child_support'],
  dvro:               ['request_for_tro', 'petition_for_dvro', 'dv_declaration', 'child_custody_dv_order'],
  legal_separation:   ['petition_for_legal_separation', 'separation_agreement', 'parenting_plan', 'spousal_support_order', 'waiver_of_service'],
  annulment:          ['petition_for_annulment', 'declaration_supporting_annulment', 'custody_order'],
  guardianship_minor: ['petition_for_guardianship', 'guardian_declaration', 'notice_to_parents', 'petition_for_guardian_of_estate', 'indigency_affidavit'],
  adoption:           ['petition_for_adoption', 'consent_to_adoption', 'stepparent_adoption_declaration', 'adult_adoptee_consent', 'minor_name_change_declaration', 'indigency_affidavit'],
  emancipation:       ['petition_for_emancipation', 'emancipation_declaration', 'financial_statement'],
  small_claims:       ['small_claims_complaint', 'demand_letter', 'indigency_affidavit'],
  name_change:        ['petition_for_name_change', 'notice_of_petition_name_change', 'minor_name_change_declaration', 'indigency_affidavit'],
  civil_harassment:   ['request_for_tro', 'petition_for_chro', 'chro_declaration'],
  debt_defense:       ['answer_to_complaint', 'counterclaim', 'motion_to_dismiss', 'indigency_affidavit'],
  landlord_tenant:    ['notice_to_vacate', 'eviction_complaint', 'answer_to_eviction', 'small_claims_complaint', 'demand_letter', 'repair_demand_letter', 'habitability_complaint', 'tenant_declaration', 'lease_dispute_complaint', 'indigency_affidavit'],
  general_civil:      ['civil_complaint', 'demand_letter', 'indigency_affidavit'],
  probate:            ['petition_for_probate', 'petition_to_admit_will', 'notice_to_creditors', 'small_estate_affidavit', 'affidavit_of_heirship', 'application_for_muniment_of_title', 'petition_for_summary_administration', 'indigency_affidavit'],
};

// States/provinces that have full support for each matter type.
// Canadian provinces are supported for divorce under the federal Divorce Act.
// Matter types other than divorce are state/province-agnostic (document templates available everywhere).
const SUPPORTED_STATES = {
  divorce: [
    // US states
    'TX', 'AZ', 'CA', 'FL', 'IL', 'NY', 'UT',
    'CO', 'GA', 'MA', 'MI', 'NC', 'NJ', 'OH', 'PA', 'VA', 'WA',
    'IN', 'TN', 'MO', 'MD', 'MN', 'KY',
    'WI', 'SC', 'AL', 'OR', 'OK',
    'LA', 'CT', 'NV', 'NM', 'ID',
    'IA', 'AR', 'KS', 'MS', 'NE', 'WV', 'HI', 'ME', 'NH', 'RI', 'MT', 'DE', 'DC',
    'AK', 'ND', 'SD', 'VT', 'WY',
    // Canadian provinces and territories
    'ON', 'BC', 'AB', 'QC', 'MB', 'NB', 'NL', 'NS', 'PE', 'SK',
    'NT', 'YT', 'NU',
  ],
};
const ALL_STATES = ['TX', 'AZ', 'CA', 'FL', 'IL', 'NY', 'UT', 'CO', 'GA', 'MA', 'MI', 'NC', 'NJ', 'OH', 'PA', 'VA', 'WA', 'IN', 'TN', 'MO', 'MD', 'MN', 'KY', 'WI', 'SC', 'AL', 'OR', 'OK', 'LA', 'CT', 'NV', 'NM', 'ID', 'IA', 'AR', 'KS', 'MS', 'NE', 'WV', 'HI', 'ME', 'NH', 'RI', 'MT', 'DE', 'DC', 'AK', 'ND', 'SD', 'VT', 'WY'];
const ALL_PROVINCES = ['ON', 'BC', 'AB', 'QC', 'MB', 'NB', 'NL', 'NS', 'PE', 'SK', 'NT', 'YT', 'NU'];
// International jurisdiction arrays
const ALL_UK = ['ENG', 'SCO', 'NIR'];
const ALL_IE = ['IRL'];
const ALL_AU = ['NSW', 'VIC', 'QLD', 'WA_AU', 'SA_AU', 'TAS', 'ACT', 'NT_AU'];
const ALL_NZ = ['NZ'];
const ALL_IN = ['IN_DL', 'IN_MH', 'IN_KA', 'IN_TN', 'IN_GJ', 'IN_UP', 'IN_WB', 'IN_TS', 'IN_RJ', 'IN_KL', 'IN_PB', 'IN_HR', 'IN_MP', 'IN_BR', 'IN_OD', 'IN_AP'];
const ALL_PK = ['PK_PB', 'PK_SD', 'PK_KP', 'PK_BA', 'PK_IS'];
const ALL_BD = ['BD'];
const ALL_LK = ['LK'];
const ALL_ZA = ['ZA'];
const ALL_NG = ['LA_NG', 'FC', 'RV', 'CR', 'ED', 'DT', 'OY', 'OG', 'AN', 'EN', 'IM', 'AB_NG'];
const ALL_AFRICA = ['KE', 'GH', 'UG', 'TZ', 'ZM', 'ZW', 'BW', 'MW', 'NA_NM'];
const ALL_SE_ASIA = ['SG', 'HK', 'MY'];
const ALL_CARIBBEAN = ['JM', 'TT', 'BB', 'BS', 'BM', 'GY', 'BZ', 'AG', 'DM', 'GD', 'KN', 'VC'];
const ALL_PACIFIC = ['FJ', 'PG'];
const ALL_MEDITERRANEAN = ['CY'];
// All jurisdictions (full list — used when ENABLE_INTERNATIONAL=true)
const _ALL_JURISDICTIONS_FULL = [
  ...ALL_STATES, ...ALL_PROVINCES,
  ...ALL_UK, ...ALL_IE, ...ALL_AU, ...ALL_NZ,
  ...ALL_IN, ...ALL_PK, ...ALL_BD, ...ALL_LK,
  ...ALL_ZA, ...ALL_NG, ...ALL_AFRICA,
  ...ALL_SE_ASIA, ...ALL_CARIBBEAN, ...ALL_PACIFIC, ...ALL_MEDITERRANEAN,
];

// NA-only jurisdictions (used when ENABLE_INTERNATIONAL=false)
const _ALL_JURISDICTIONS_NA = [...ALL_STATES, ...ALL_PROVINCES];

/** Active jurisdiction list, gated by ENABLE_INTERNATIONAL feature flag. */
function getAllJurisdictions() {
  return isInternationalEnabled() ? _ALL_JURISDICTIONS_FULL : _ALL_JURISDICTIONS_NA;
}

// ─── GET /api/catalog/matters ─────────────────────────────────────────────────

router.get('/matters',
  standardLimiter,
  asyncHandler(async (req, res) => {
    const { practice_area } = req.query;

    let matters = MATTER_TYPES;
    if (practice_area) {
      if (!['family', 'civil'].includes(practice_area)) {
        throw new ValidationError('practice_area must be "family" or "civil"');
      }
      matters = matters.filter(m => m.practice_area === practice_area);
    }

    res.sendSuccess({ matters });
  })
);

// ─── GET /api/catalog/matters/:code ───────────────────────────────────────────

router.get('/matters/:code',
  standardLimiter,
  asyncHandler(async (req, res) => {
    const { code } = req.params;
    const matter = MATTER_MAP[code];

    if (!matter) {
      throw new NotFoundError(`Matter type "${code}" not found`);
    }

    const documents       = DOCS_BY_MATTER[code] || [];
    const supported_states = SUPPORTED_STATES[code] || getAllJurisdictions();

    res.sendSuccess({ matter: { ...matter, documents, supported_states } });
  })
);

// ─── GET /api/catalog/matters/:code/documents ─────────────────────────────────

router.get('/matters/:code/documents',
  standardLimiter,
  asyncHandler(async (req, res) => {
    const { code } = req.params;

    if (!MATTER_MAP[code]) {
      throw new NotFoundError(`Matter type "${code}" not found`);
    }

    const documents = DOCS_BY_MATTER[code] || [];

    res.sendSuccess({ matter_code: code, documents });
  })
);

// ─── GET /api/catalog/states/:state/matters ───────────────────────────────────

router.get('/states/:state/matters',
  standardLimiter,
  asyncHandler(async (req, res) => {
    const state = req.params.state.toUpperCase();

    const activeJurisdictions = getAllJurisdictions();
    if (!activeJurisdictions.includes(state)) {
      throw new NotFoundError(`"${state}" is not currently supported. Supported jurisdictions: ${activeJurisdictions.join(', ')}`);
    }

    const matters = MATTER_TYPES.filter(m => {
      const supportedStates = SUPPORTED_STATES[m.code];
      if (!supportedStates) return true;  // available in all states
      return supportedStates.includes(state);
    });

    logger.info('Catalog: state matters requested', { state, count: matters.length });

    res.sendSuccess({ state, matters });
  })
);

// ─── GET /api/catalog/document-types/:code ────────────────────────────────────
// Returns metadata about a specific document type across all matters.

router.get('/document-types/:code',
  standardLimiter,
  asyncHandler(async (req, res) => {
    const { code } = req.params;

    // Find which matters use this document type
    const usedIn = Object.entries(DOCS_BY_MATTER)
      .filter(([, docs]) => docs.includes(code))
      .map(([matterCode]) => matterCode);

    if (usedIn.length === 0) {
      throw new NotFoundError(`Document type "${code}" not found in catalog`);
    }

    res.sendSuccess({
      document_type: code,
      used_in_matters: usedIn
    });
  })
);

module.exports = router;
