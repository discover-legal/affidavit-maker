// Source-of-truth catalog data. Mirrors the in-memory catalog from the legacy
// routes/catalog.js. Kept in code (not DB) so it's fast and works pre-migration.
//
// Two sources feed the matter tables:
//   - BUILTIN_* below: matters implemented as hand-written JS orchestrators
//   - matters/*.yaml (services/matters): declarative matters, merged at import
// Server-only: the YAML registry reads from disk. Never import this module
// from a client component.

import { getMatterRegistry, type MatterDefinition } from '@/services/matters';

export type Matter = {
  code: string;
  practice_area: 'family' | 'civil';
  display_name: string;
  short_name: string;
  tagline: string;
  sort_order: number;
  is_packaged: boolean;
};

const BUILTIN_MATTER_TYPES: Matter[] = [
  // Family Law
  { code: 'divorce', practice_area: 'family', display_name: 'Divorce / Dissolution of Marriage', short_name: 'Divorce', tagline: 'End your marriage and divide your assets fairly', sort_order: 10, is_packaged: true },
  { code: 'custody', practice_area: 'family', display_name: 'Child Custody & Visitation', short_name: 'Custody', tagline: 'Establish legal custody and a parenting schedule for your children', sort_order: 20, is_packaged: false },
  { code: 'child_support', practice_area: 'family', display_name: 'Child Support', short_name: 'Child Support', tagline: 'Establish or modify a child support order', sort_order: 30, is_packaged: false },
  { code: 'paternity', practice_area: 'family', display_name: 'Paternity', short_name: 'Paternity', tagline: 'Establish or disestablish legal parentage', sort_order: 40, is_packaged: false },
  { code: 'dvro', practice_area: 'family', display_name: 'Domestic Violence Restraining Order', short_name: 'DVRO', tagline: 'Get a protective order against domestic violence', sort_order: 50, is_packaged: false },
  { code: 'legal_separation', practice_area: 'family', display_name: 'Legal Separation', short_name: 'Legal Separation', tagline: 'Live separately while remaining legally married', sort_order: 60, is_packaged: false },
  { code: 'annulment', practice_area: 'family', display_name: 'Annulment / Nullity of Marriage', short_name: 'Annulment', tagline: 'Declare your marriage was never legally valid', sort_order: 70, is_packaged: false },
  { code: 'guardianship_minor', practice_area: 'family', display_name: 'Guardianship of a Minor', short_name: 'Guardianship', tagline: 'Become the legal guardian of a child', sort_order: 80, is_packaged: false },
  { code: 'adoption', practice_area: 'family', display_name: 'Adoption', short_name: 'Adoption', tagline: 'Legally adopt a child or adult family member', sort_order: 90, is_packaged: false },
  { code: 'emancipation', practice_area: 'family', display_name: 'Emancipation of a Minor', short_name: 'Emancipation', tagline: 'Gain adult legal independence before turning 18', sort_order: 100, is_packaged: false },
  // Civil Law
  { code: 'small_claims', practice_area: 'civil', display_name: 'Small Claims', short_name: 'Small Claims', tagline: 'Sue for money in small claims court — no lawyer needed', sort_order: 110, is_packaged: false },
  { code: 'civil_harassment', practice_area: 'civil', display_name: 'Civil Harassment Restraining Order', short_name: 'Harassment RO', tagline: 'Get a restraining order against a neighbor, coworker, or acquaintance', sort_order: 130, is_packaged: false },
  { code: 'debt_defense', practice_area: 'civil', display_name: 'Debt Collection Defense', short_name: 'Debt Defense', tagline: 'Respond to a debt collection lawsuit and assert your defenses', sort_order: 140, is_packaged: false },
  { code: 'landlord_tenant', practice_area: 'civil', display_name: 'Landlord-Tenant', short_name: 'Landlord/Tenant', tagline: 'Handle evictions, deposits, or habitability disputes', sort_order: 150, is_packaged: false },
  { code: 'general_civil', practice_area: 'civil', display_name: 'General Civil Lawsuit', short_name: 'Civil Lawsuit', tagline: 'File a civil lawsuit for money damages', sort_order: 160, is_packaged: false },
  { code: 'probate', practice_area: 'civil', display_name: 'Probate & Estate Administration', short_name: 'Probate', tagline: "Administer a loved one's estate after death", sort_order: 170, is_packaged: false },
];

function toCatalogMatter(m: MatterDefinition): Matter {
  return {
    code: m.code,
    practice_area: m.practiceArea,
    display_name: m.displayName,
    short_name: m.shortName,
    tagline: m.tagline,
    sort_order: m.sortOrder,
    is_packaged: m.isPackaged,
  };
}

/** YAML-defined matters (matters/*.yaml). Built-in codes are reserved by the loader. */
const YAML_MATTERS: MatterDefinition[] = getMatterRegistry().list();

export const MATTER_TYPES: Matter[] = [...BUILTIN_MATTER_TYPES, ...YAML_MATTERS.map(toCatalogMatter)].sort(
  (a, b) => a.sort_order - b.sort_order,
);

export const MATTER_MAP: Record<string, Matter> = Object.fromEntries(
  MATTER_TYPES.map((m) => [m.code, m]),
);

const BUILTIN_DOCS_BY_MATTER: Record<string, string[]> = {
  divorce: ['divorce_petition', 'divorce_decree', 'parenting_plan', 'waiver_of_service', 'prove_up_affidavit', 'military_status_affidavit', 'cert_last_known_address', 'indigency_affidavit'],
  custody: ['petition_for_custody', 'motion_to_modify_custody', 'parenting_plan', 'declaration_in_support', 'indigency_affidavit'],
  child_support: ['petition_for_child_support', 'motion_to_modify_support', 'financial_declaration', 'motion_for_arrears', 'indigency_affidavit'],
  paternity: ['petition_to_establish_paternity', 'petition_to_disestablish_paternity', 'motion_to_amend_birth_certificate', 'petition_for_child_support'],
  dvro: ['request_for_tro', 'petition_for_dvro', 'dv_declaration', 'child_custody_dv_order'],
  legal_separation: ['petition_for_legal_separation', 'separation_agreement', 'parenting_plan', 'spousal_support_order', 'waiver_of_service'],
  annulment: ['petition_for_annulment', 'declaration_supporting_annulment', 'custody_order'],
  guardianship_minor: ['petition_for_guardianship', 'guardian_declaration', 'notice_to_parents', 'petition_for_guardian_of_estate', 'indigency_affidavit'],
  adoption: ['petition_for_adoption', 'consent_to_adoption', 'stepparent_adoption_declaration', 'adult_adoptee_consent', 'minor_name_change_declaration', 'indigency_affidavit'],
  emancipation: ['petition_for_emancipation', 'emancipation_declaration', 'financial_statement'],
  small_claims: ['small_claims_complaint', 'demand_letter', 'indigency_affidavit'],
  civil_harassment: ['request_for_tro', 'petition_for_chro', 'chro_declaration'],
  debt_defense: ['answer_to_complaint', 'counterclaim', 'motion_to_dismiss', 'indigency_affidavit'],
  landlord_tenant: ['notice_to_vacate', 'eviction_complaint', 'answer_to_eviction', 'small_claims_complaint', 'demand_letter', 'repair_demand_letter', 'habitability_complaint', 'tenant_declaration', 'lease_dispute_complaint', 'indigency_affidavit'],
  general_civil: ['civil_complaint', 'demand_letter', 'indigency_affidavit'],
  probate: ['petition_for_probate', 'petition_to_admit_will', 'notice_to_creditors', 'small_estate_affidavit', 'affidavit_of_heirship', 'application_for_muniment_of_title', 'petition_for_summary_administration', 'indigency_affidavit'],
};

export const DOCS_BY_MATTER: Record<string, string[]> = {
  ...BUILTIN_DOCS_BY_MATTER,
  ...Object.fromEntries(YAML_MATTERS.map((m) => [m.code, [...m.documents]])),
};

export const ALL_STATES = ['TX', 'AZ', 'CA', 'FL', 'IL', 'NY', 'UT', 'CO', 'GA', 'MA', 'MI', 'NC', 'NJ', 'OH', 'PA', 'VA', 'WA', 'IN', 'TN', 'MO', 'MD', 'MN', 'KY', 'WI', 'SC', 'AL', 'OR', 'OK', 'LA', 'CT', 'NV', 'NM', 'ID', 'IA', 'AR', 'KS', 'MS', 'NE', 'WV', 'HI', 'ME', 'NH', 'RI', 'MT', 'DE', 'DC', 'AK', 'ND', 'SD', 'VT', 'WY'];
export const ALL_PROVINCES = ['ON', 'BC', 'AB', 'QC', 'MB', 'NB', 'NL', 'NS', 'PE', 'SK', 'NT', 'YT', 'NU'];

const ALL_INTERNATIONAL = [
  'ENG', 'SCO', 'NIR', 'IRL',
  'NSW', 'VIC', 'QLD', 'WA_AU', 'SA_AU', 'TAS', 'ACT', 'NT_AU', 'NZ',
  'IN_DL', 'IN_MH', 'IN_KA', 'IN_TN', 'IN_GJ', 'IN_UP', 'IN_WB', 'IN_TS', 'IN_RJ', 'IN_KL', 'IN_PB', 'IN_HR', 'IN_MP', 'IN_BR', 'IN_OD', 'IN_AP',
  'PK_PB', 'PK_SD', 'PK_KP', 'PK_BA', 'PK_IS', 'BD', 'LK',
  'ZA',
  'LA_NG', 'FC', 'RV', 'CR', 'ED', 'DT', 'OY', 'OG', 'AN', 'EN', 'IM', 'AB_NG',
  'KE', 'GH', 'UG', 'TZ', 'ZM', 'ZW', 'BW', 'MW', 'NA_NM',
  'SG', 'HK', 'MY',
  'JM', 'TT', 'BB', 'BS', 'BM', 'GY', 'BZ', 'AG', 'DM', 'GD', 'KN', 'VC',
  'FJ', 'PG',
  'CY',
];

export const SUPPORTED_STATES: Record<string, string[]> = {
  divorce: [...ALL_STATES, ...ALL_PROVINCES],
  ...Object.fromEntries(
    YAML_MATTERS.filter((m) => m.supportedJurisdictions).map((m) => [m.code, [...(m.supportedJurisdictions as string[])]]),
  ),
};

export function isInternationalEnabled(): boolean {
  return process.env.ENABLE_INTERNATIONAL === 'true';
}

/**
 * JURISDICTION_ALLOWLIST env-var override. Comma-separated codes
 * ("ON,UT"). When set, ONLY those codes are surfaced. Overrides
 * ENABLE_INTERNATIONAL. Use to launch narrow and expand progressively.
 */
function readAllowlist(): Set<string> | null {
  const raw = process.env.JURISDICTION_ALLOWLIST;
  if (typeof raw !== 'string') return null;
  const codes = raw.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  if (codes.length === 0) return null;
  return new Set(codes);
}

export function getAllJurisdictions(): string[] {
  const allowlist = readAllowlist();
  const full = isInternationalEnabled()
    ? [...ALL_STATES, ...ALL_PROVINCES, ...ALL_INTERNATIONAL]
    : [...ALL_STATES, ...ALL_PROVINCES];
  if (!allowlist) return full;
  return full.filter((code) => allowlist.has(code));
}
