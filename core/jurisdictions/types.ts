/**
 * Jurisdictions — one registry, sourced from templates/states/<dir>/metadata.json
 * and divorce-metadata.json (the data the legal validation program verified),
 * gated by JURISDICTION_ALLOWLIST / ENABLE_INTERNATIONAL.
 *
 * A JurisdictionProfile is pure data. Everything that used to be a regex
 * rewrite ("marital" → "family", "Case No." → "Court File No.", "v." →
 * "AND BETWEEN") is a lexicon entry here, applied by composition, never by
 * post-processing prose.
 */

export type Country = 'US' | 'CA' | 'UK' | 'IE' | 'AU' | 'NZ' | 'IN' | 'NG' | 'ZA' | 'KE' | 'GH' | 'SG' | 'HK' | string;

export interface Lexicon {
  /** Rendered role labels. */
  petitioner: string; // Petitioner | Applicant | Plaintiff | Complainant
  respondent: string; // Respondent | Defendant
  /** Caption pieces. */
  fileNumberLabel: string; // "Case No." | "Court File No." | "Cause No."
  versus: string; // "v." | "AND BETWEEN" | "and"
  /** Order / decree vocabulary. */
  orderIntro: string; // "IT IS ORDERED AND DECREED" | "IT IS ORDERED"
  selfRepresented: string; // "pro se" | "self-represented"
  /** Property vocabulary. */
  maritalProperty: string; // "community property" | "marital property" | "family property"
  maritalDebts: string;
  counterClaimTitle: string; // "Counter-Petition" | "Answer with Claim"
  regionLabel: string; // "State" | "Province" | "Country"
  countyLabel: string; // "County" | "Judicial Centre" | "Region"
}

export interface CourtProfile {
  name: string; // "District Court" | "Superior Court of Justice"
  /** Lines that make up the venue header; {county} / {state} substituted by composition. */
  venueLines: string[];
  divisionLabel?: string;
}

export interface Jurat {
  /** Who administers the oath. */
  officer: 'notary' | 'commissioner_for_oaths' | 'either';
  /** Perjury / verification statement text, cited. */
  verificationText: string;
  citations: string[];
}

export interface Ground {
  code: string; // canonical slug used in fields (e.g. 'irreconcilable_differences', 'cruelty', 'one_year_separation')
  label: string;
  citation?: string;
  /** Whether this is a no-fault ground. */
  noFault: boolean;
  /** Ground that must also be pleaded in the alternative (TX cruelty → insupportability). */
  alternative?: string;
}

export interface DivorceProfile {
  instrument: { petition: string; decree: string; answer: string }; // "Petition"/"Application", "Decree"/"Order", "Answer"/"Answer with Claim"
  residency: { text: string; citation?: string; months?: number };
  waitingPeriod?: { text: string; citation?: string };
  grounds: Ground[];
  /** Canada: one-year separation cannot be pleaded as satisfied earlier than this many months. */
  separationMonthsRequired?: number;
  citations: Record<string, string>;
  officialFormsUrl?: string;
  officialFormsName?: string;
}

export interface JurisdictionProfile {
  code: JurisdictionCodeUpper;
  name: string;
  country: Country;
  paper: 'letter' | 'a4';
  lexicon: Lexicon;
  court: CourtProfile;
  jurat: Jurat;
  divorce?: DivorceProfile;
  /** The template directory this profile was built from. */
  directory: string;
}

export type JurisdictionCodeUpper = string;

export interface JurisdictionRegistry {
  get(code: string): JurisdictionProfile | null;
  /** Codes surfaced to users after allowlist / international gating. */
  active(): JurisdictionProfile[];
  /** Every profile on disk, gated or not. */
  all(): JurisdictionProfile[];
  countryOf(code: string): Country | null;
  defaultFor(country: Country): JurisdictionProfile | null;
}
