/**
 * Court data the metadata files are silent on.
 *
 * Court name resolution in build.ts:
 *   metadata.courtSystem.trialCourt → divorce-metadata.court.name →
 *   divorce-metadata.terminology.court → TRIAL_COURT_OVERRIDES[code] →
 *   'District Court'.
 *
 * Venue lines are templates. `{court}`, `{countyLabel}` and `{name}` are
 * filled at build time; `{county}` and `{state}` are left for composition
 * (see CourtProfile.venueLines). Letter case follows
 * metadata.features.headerFormat.
 */

/** US states whose metadata carries no court name (no courtSystem, no divorce-metadata.court). */
export const TRIAL_COURT_OVERRIDES: Readonly<Record<string, string>> = {
  AZ: 'Superior Court', // A.R.S. § 25-311
  FL: 'Circuit Court', // Fla. Stat. § 26.012(2)(c)
  IL: 'Circuit Court', // 750 ILCS 5/104
  NC: 'District Court', // N.C. Gen. Stat. § 7A-244
  PA: 'Court of Common Pleas', // 23 Pa.C.S. § 3104
  TX: 'District Court', // Tex. Fam. Code § 6.301 (district courts hear suits for dissolution)
  UT: 'District Court', // Utah Code § 78A-5-102
  VA: 'Circuit Court', // Va. Code § 20-96
};

/** Division wording that follows the county line in the caption. */
export const DIVISION_LABELS: Readonly<Record<string, string>> = {
  TX: 'JUDICIAL DISTRICT',
};

/** Per-jurisdiction venue templates where the caption convention is not the country default. */
export const VENUE_TEMPLATES: Readonly<Record<string, readonly string[]>> = {
  ON: ['{name}', '{court}', 'Family Court'],
  AB: ['{court}', 'Judicial Centre of {county}'],
  BC: ['{court}', '{county} Registry'],
  QC: ['{court}', 'District of {county}'],
  NY: ['Supreme Court of the State of New York', 'County of {county}'],
  CA: ['Superior Court of California', 'County of {county}'],
  LA: ['{court}', 'Parish of {county}', 'State of Louisiana'],
};

/** Country-level venue templates. */
export const VENUE_TEMPLATES_BY_COUNTRY: Readonly<Record<string, readonly string[]>> = {
  US: ['In the {court} of', '{county} {countyLabel}, {state}'],
  CA: ['{name}', '{court}', '{countyLabel} of {county}'],
  UK: ['In the {court}', 'sitting at {county}'],
  IE: ['{court}', '{county} Circuit'],
  AU: ['{court}', '{county} Registry'],
  NZ: ['In the {court}', 'at {county}'],
  SG: ['In the {court} of the Republic of Singapore'],
  HK: ['In the {court} of the Hong Kong Special Administrative Region'],
  ZA: ['In the {court}', '{county} Division'],
  NG: ['In the {court}', 'In the {county} Judicial Division'],
  IN: ['In the {court} at {county}'],
};

export const VENUE_TEMPLATE_FALLBACK: readonly string[] = ['In the {court}', '{county}, {state}'];
