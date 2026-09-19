/**
 * Lexicon defaults and per-jurisdiction overrides for values the metadata
 * files do not carry. The builder consults the metadata first (party
 * labels from divorceTerminology.parties / terminology.*, file-number
 * label from features.caseNumberLabel, community-property vocabulary from
 * divorce-metadata.propertyDivision.type, county label from the features
 * flags) and only then these tables.
 *
 * Every entry names the source it was read from.
 */

import type { Lexicon } from '../types';

/** Party labels when neither divorceTerminology.parties nor terminology.petitioner is present. */
export const PARTY_DEFAULTS: Readonly<Record<string, { petitioner: string; respondent: string }>> = {
  US: { petitioner: 'Petitioner', respondent: 'Respondent' },
  CA: { petitioner: 'Applicant', respondent: 'Respondent' },
  UK: { petitioner: 'Applicant', respondent: 'Respondent' },
  IE: { petitioner: 'Applicant', respondent: 'Respondent' },
  AU: { petitioner: 'Applicant', respondent: 'Respondent' },
  NZ: { petitioner: 'Applicant', respondent: 'Respondent' },
};
export const PARTY_FALLBACK = { petitioner: 'Petitioner', respondent: 'Respondent' } as const;

/** Country-level defaults for the lexicon entries no metadata field describes. */
export const LEXICON_BY_COUNTRY: Readonly<Record<string, Partial<Lexicon>>> = {
  US: {
    versus: 'v.',
    orderIntro: 'IT IS ORDERED AND DECREED',
    selfRepresented: 'pro se',
    maritalProperty: 'marital property',
    maritalDebts: 'marital debts',
    counterClaimTitle: 'Counter-Petition',
    regionLabel: 'State',
    countyLabel: 'County',
  },
  CA: {
    versus: 'AND BETWEEN',
    orderIntro: 'IT IS ORDERED',
    selfRepresented: 'self-represented',
    maritalProperty: 'family property',
    maritalDebts: 'family debts',
    counterClaimTitle: 'Counter-Petition',
    regionLabel: 'Province',
    countyLabel: 'County',
  },
  AU: { regionLabel: 'State', countyLabel: 'Registry', counterClaimTitle: 'Response' },
  NZ: { regionLabel: 'Country', countyLabel: 'Registry' },
  UK: { regionLabel: 'Country', countyLabel: 'Court' },
  IE: { regionLabel: 'Country', countyLabel: 'Circuit' },
  SG: { regionLabel: 'Country', countyLabel: 'Registry' },
  HK: { regionLabel: 'Country', countyLabel: 'Registry' },
  ZA: { regionLabel: 'Country', countyLabel: 'Division' },
  KE: { regionLabel: 'Country', countyLabel: 'County' },
  GH: { regionLabel: 'Country', countyLabel: 'Region' },
  NG: { regionLabel: 'State', countyLabel: 'Judicial Division' },
  IN: { regionLabel: 'State', countyLabel: 'District' },
};

/** Applies to every country not listed above (and fills gaps in the listed ones). */
export const LEXICON_FALLBACK: Omit<Lexicon, 'petitioner' | 'respondent' | 'fileNumberLabel'> = {
  versus: 'v.',
  orderIntro: 'IT IS ORDERED',
  selfRepresented: 'self-represented',
  maritalProperty: 'matrimonial property',
  maritalDebts: 'matrimonial debts',
  counterClaimTitle: 'Cross-Petition',
  regionLabel: 'State',
  countyLabel: 'County',
};

/** Vocabulary declared by divorce-metadata.propertyDivision.type. */
export const PROPERTY_VOCABULARY_BY_TYPE: Readonly<Record<string, { maritalProperty: string; maritalDebts: string }>> = {
  community_property: { maritalProperty: 'community property', maritalDebts: 'community debts' },
  equitable_distribution: { maritalProperty: 'marital property', maritalDebts: 'marital debts' },
};

/**
 * Per-jurisdiction overrides. Each line names the metadata field or rule it
 * was read from; these are the jurisdictions where a country default would
 * be wrong.
 */
export const LEXICON_OVERRIDES: Readonly<Record<string, Partial<Lexicon>>> = {
  // Ontario: Family Law Rules r.10 — the responding party's claim is made in the Answer (Form 10).
  ON: { counterClaimTitle: 'Answer with Claim', countyLabel: 'Region' },
  // Alberta: features.usesJudicialDistrict; Alta. Rules of Court r.3.3 "judicial centre"; Statement of Defence and Counterclaim (requiredForms).
  AB: { counterClaimTitle: 'Statement of Defence and Counterclaim' },
  // British Columbia: Supreme Court Family Rules — Counterclaim (Form F5); property vocabulary per terminology.maritalProperty "Family Property".
  BC: { counterClaimTitle: 'Counterclaim' },
  // Quebec: Code of Civil Procedure — "c." (contre) in the style of cause; judicial districts; family patrimony (terminology.maritalProperty).
  QC: { versus: 'c.', countyLabel: 'District', maritalProperty: 'family patrimony', maritalDebts: 'family debts' },
  // New Brunswick: terminology.maritalProperty "Marital Property (Marital Property Act, RSNB 2012, c. 107)".
  NB: { maritalProperty: 'marital property', maritalDebts: 'marital debts' },
  // Nova Scotia / PEI / Newfoundland: terminology.maritalProperty "Matrimonial Property (…)".
  NS: { maritalProperty: 'matrimonial property', maritalDebts: 'matrimonial debts' },
  PE: { maritalProperty: 'matrimonial property', maritalDebts: 'matrimonial debts' },
  NL: { maritalProperty: 'matrimonial property', maritalDebts: 'matrimonial debts' },
  // Yukon: terminology.maritalProperty "Family Assets (Family Property and Support Act, RSY 2002, c. 83)".
  YT: { maritalProperty: 'family assets', maritalDebts: 'family debts' },
  // Canadian territories (no territoryNotState flag in their metadata).
  NT: { regionLabel: 'Territory' },
  NU: { regionLabel: 'Territory' },
  // New York: terminology.notes (Plaintiff/Defendant, Supreme Court); decretal wording per NY judgment forms UD-11; CPLR 3019 counterclaim.
  NY: { orderIntro: 'IT IS ORDERED, ADJUDGED AND DECREED', counterClaimTitle: 'Counterclaim' },
  // New Jersey: terminology.plaintiff/defendant; Counterclaim (R. 5:4-2).
  NJ: { counterClaimTitle: 'Counterclaim' },
  // Mississippi: terminology.petitioner "Complainant" with no respondent entry — chancery practice pairs it with Defendant.
  MS: { respondent: 'Defendant' },
  // District of Columbia is not a state.
  DC: { regionLabel: 'District' },
};
