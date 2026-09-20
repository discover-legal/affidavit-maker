/**
 * Ground-code data the metadata files do not carry.
 *
 * Everything here is keyed by jurisdiction (or country) and ground code as
 * spelled in divorce-metadata.json — a lookup table, never an inference.
 */

/**
 * Grounds that must also be pleaded in the alternative, per jurisdiction.
 *
 * TX: a fault petition pleads the fault ground (Tex. Fam. Code § 6.002
 * cruelty, § 6.003 adultery) with § 6.001 insupportability in the
 * alternative so the case does not collapse if fault proof is thin
 * (attorney review, v5.1.0).
 */
export const GROUND_ALTERNATIVES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  TX: {
    cruelty: 'insupportability',
    adultery: 'insupportability',
  },
};

/**
 * Canonical spellings for ground codes, per country. The Canadian
 * divorce-metadata files spell the Divorce Act s.8(2)(a) ground
 * "separation"; the contract's canonical slug is "one_year_separation"
 * (also the spelling South Carolina's data already uses for its one-year
 * ground).
 */
export const CANONICAL_GROUND_CODES: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  CA: { separation: 'one_year_separation' },
};

/**
 * Minimum months of separation before a separation ground can be pleaded
 * as satisfied. Canada: Divorce Act, RSC 1985, c. 3, s.8(2)(a) — one year.
 */
export const SEPARATION_MONTHS_BY_COUNTRY: Readonly<Record<string, number>> = {
  CA: 12,
};
