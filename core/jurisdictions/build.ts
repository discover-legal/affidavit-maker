/**
 * Build one JurisdictionProfile from a directory's raw metadata.
 *
 * Every value is read from the metadata files first; the data tables under
 * ./data fill only what the files are silent on, and each table entry
 * names its source. Nothing here inspects prose: it reads keys, compares
 * declared codes and fills templates.
 */

import { officialFormsLink } from '../../lib/officialForms';
import {
  DIVISION_LABELS,
  TRIAL_COURT_OVERRIDES,
  VENUE_TEMPLATES,
  VENUE_TEMPLATES_BY_COUNTRY,
  VENUE_TEMPLATE_FALLBACK,
} from './data/courts';
import { CANONICAL_GROUND_CODES, GROUND_ALTERNATIVES, SEPARATION_MONTHS_BY_COUNTRY } from './data/grounds';
import { INSTRUMENT_DEFAULTS, INSTRUMENT_FALLBACK, INSTRUMENT_OVERRIDES } from './data/instruments';
import {
  LEXICON_BY_COUNTRY,
  LEXICON_FALLBACK,
  LEXICON_OVERRIDES,
  PARTY_DEFAULTS,
  PARTY_FALLBACK,
  PROPERTY_VOCABULARY_BY_TYPE,
} from './data/lexicon';
import { A4_JURISDICTIONS } from './data/paper';
import type { RawCitation, RawDivorceMetadata, RawFeatures, RawGround, RawJurisdiction } from './metadata';
import type { CourtProfile, DivorceProfile, Ground, Jurat, JurisdictionProfile, Lexicon } from './types';

/** US metadata files omit countryCode; every other country declares it. */
const DEFAULT_COUNTRY = 'US';
const DEFAULT_FILE_NUMBER_LABEL = 'Case No.';
const DEFAULT_COURT_NAME = 'District Court';

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function firstNonEmpty(...values: unknown[]): string | undefined {
  for (const v of values) if (nonEmpty(v)) return v.trim();
  return undefined;
}

function citationCodes(citations: RawCitation[] | undefined): string[] {
  if (!Array.isArray(citations)) return [];
  return citations.map((c) => (nonEmpty(c?.code) ? c.code.trim() : '')).filter((c) => c.length > 0);
}

// ─── Lexicon ────────────────────────────────────────────────────────────────

function buildLexicon(raw: RawJurisdiction, code: string, country: string): Lexicon {
  const features: RawFeatures = raw.metadata.features ?? {};
  const parties = raw.metadata.divorceTerminology?.parties;
  const term = raw.divorce?.terminology ?? {};
  const partyDefaults = PARTY_DEFAULTS[country] ?? PARTY_FALLBACK;

  const petitioner =
    firstNonEmpty(Array.isArray(parties) ? parties[0] : undefined, term.petitioner, term.plaintiff) ?? partyDefaults.petitioner;
  const respondent =
    firstNonEmpty(Array.isArray(parties) ? parties[1] : undefined, term.respondent, term.defendant) ?? partyDefaults.respondent;
  const fileNumberLabel = firstNonEmpty(features.caseNumberLabel, term.caseNumberLabel) ?? DEFAULT_FILE_NUMBER_LABEL;

  const base = { ...LEXICON_FALLBACK, ...(LEXICON_BY_COUNTRY[country] ?? {}) };

  // Declared by the metadata flags (each flag is a boolean the files carry).
  const countyLabel =
    features.usesJudicialDistrict === true
      ? 'Judicial Centre'
      : features.usesParish === true
        ? 'Parish'
        : features.usesRegistry === true || features.noCounties === true
          ? 'Registry'
          : base.countyLabel;
  const regionLabel =
    features.territoryNotState === true ? 'Territory' : features.provinceNotJurisdiction === true ? 'Province' : base.regionLabel;

  const propertyType = raw.divorce?.propertyDivision?.type;
  const property = nonEmpty(propertyType) ? PROPERTY_VOCABULARY_BY_TYPE[propertyType] : undefined;

  return {
    ...base,
    petitioner,
    respondent,
    fileNumberLabel,
    ...(property ?? {}),
    countyLabel,
    regionLabel,
    ...(LEXICON_OVERRIDES[code] ?? {}),
  };
}

// ─── Court ──────────────────────────────────────────────────────────────────

/**
 * Template substitution for the build-time tokens. Plain split/join on the
 * literal token — syntactic, not a pattern match.
 */
function fillTemplate(line: string, values: Record<string, string>): string {
  let out = line;
  for (const [token, value] of Object.entries(values)) out = out.split(`{${token}}`).join(value);
  return out;
}

/**
 * Upper-case a venue line while leaving `{county}` / `{state}` placeholders
 * untouched so composition can still substitute them. Brace tracking is a
 * syntactic walk over the template, not a parse of prose.
 */
function upperOutsidePlaceholders(line: string): string {
  let out = '';
  let depth = 0;
  for (const ch of line) {
    if (ch === '{') depth += 1;
    if (depth === 0) out += ch.toUpperCase();
    else out += ch;
    if (ch === '}' && depth > 0) depth -= 1;
  }
  return out;
}

function buildCourt(raw: RawJurisdiction, code: string, country: string, name: string, lexicon: Lexicon): CourtProfile {
  const courtName =
    firstNonEmpty(raw.metadata.courtSystem?.trialCourt, raw.divorce?.court?.name, raw.divorce?.terminology?.court) ??
    TRIAL_COURT_OVERRIDES[code] ??
    DEFAULT_COURT_NAME;

  const template = VENUE_TEMPLATES[code] ?? VENUE_TEMPLATES_BY_COUNTRY[country] ?? VENUE_TEMPLATE_FALLBACK;
  const filled = template.map((line) => fillTemplate(line, { court: courtName, countyLabel: lexicon.countyLabel, name }));
  const headerFormat = raw.metadata.features?.headerFormat;
  const uppercase = headerFormat === 'uppercase' || headerFormat === 'commonwealth';
  const venueLines = uppercase ? filled.map(upperOutsidePlaceholders) : filled;

  const divisionLabel = DIVISION_LABELS[code];
  return { name: courtName, venueLines, ...(divisionLabel ? { divisionLabel } : {}) };
}

// ─── Jurat ──────────────────────────────────────────────────────────────────

function buildJurat(raw: RawJurisdiction): Jurat {
  const f: RawFeatures = raw.metadata.features ?? {};
  let officer: Jurat['officer'];
  if (f.commissionerForOaths === true || f.commissionerOfOaths === true) officer = 'commissioner_for_oaths';
  else if (f.justiceOfThePeace === true || f.solicitorOrJP === true || f.statementOfTruth === true) officer = 'either';
  else if (f.notaryBlock === true) officer = 'notary';
  else officer = 'either';

  return {
    officer,
    verificationText: nonEmpty(raw.metadata.affidavitJurat) ? raw.metadata.affidavitJurat : '',
    citations: citationCodes(raw.metadata.legalCitations),
  };
}

// ─── Divorce ────────────────────────────────────────────────────────────────

function buildGrounds(dv: RawDivorceMetadata, code: string, country: string): Ground[] {
  const source = dv.groundsForDivorce ?? dv.groundsForDissolution ?? {};
  const canonical = CANONICAL_GROUND_CODES[country] ?? {};
  const alternatives = GROUND_ALTERNATIVES[code] ?? {};
  const seen = new Set<string>();
  const grounds: Ground[] = [];

  for (const [category, value] of Object.entries(source)) {
    if (!Array.isArray(value)) continue; // notes and sub-structures are not ground lists
    // Category keys are the files' own schema: noFault / fault / conversion / wifeAdditional.
    const noFault = category === 'noFault' || category === 'conversion';
    for (const entry of value as RawGround[]) {
      if (!entry || typeof entry !== 'object' || !nonEmpty(entry.code)) continue;
      const rawCode = entry.code.trim();
      const groundCode = canonical[rawCode] ?? rawCode;
      if (seen.has(groundCode)) continue;
      seen.add(groundCode);
      const alternative = alternatives[groundCode] ?? alternatives[rawCode];
      grounds.push({
        code: groundCode,
        label: firstNonEmpty(entry.name) ?? groundCode,
        ...(nonEmpty(entry.statute) ? { citation: entry.statute.trim() } : {}),
        noFault,
        ...(alternative ? { alternative } : {}),
      });
    }
  }
  return grounds;
}

function buildInstrument(dv: RawDivorceMetadata, code: string, country: string): DivorceProfile['instrument'] {
  const override = INSTRUMENT_OVERRIDES[code] ?? {};
  const defaults = INSTRUMENT_DEFAULTS[country] ?? INSTRUMENT_FALLBACK;
  const term = dv.terminology ?? {};
  const firstBasicForm = Array.isArray(dv.requiredForms?.basic) ? dv.requiredForms?.basic[0]?.name : undefined;
  return {
    petition: override.petition ?? firstNonEmpty(term.petition, term.petitionTitle, firstBasicForm) ?? defaults.petition,
    decree: override.decree ?? firstNonEmpty(term.decree, term.decreeTitle) ?? defaults.decree,
    answer: override.answer ?? defaults.answer,
  };
}

function buildWaitingPeriod(dv: RawDivorceMetadata): DivorceProfile['waitingPeriod'] {
  const w = dv.waitingPeriod;
  if (!w || typeof w !== 'object') return undefined;
  const days = typeof w.days === 'number' ? w.days : undefined;
  if (days === 0) return undefined; // the file says there is no waiting period
  const description = firstNonEmpty(w.description);
  if (days === undefined && !description) return undefined;
  const text = description ?? `${days}-day waiting period`;
  return { text, ...(nonEmpty(w.statute) ? { citation: w.statute.trim() } : {}) };
}

function buildDivorce(raw: RawJurisdiction, code: string, country: string): DivorceProfile | undefined {
  const dv = raw.divorce;
  if (!dv) return undefined;

  const residencyRaw = dv.residencyRequirements ?? {};
  const residency: DivorceProfile['residency'] = {
    text: firstNonEmpty(residencyRaw.description) ?? '',
    ...(nonEmpty(residencyRaw.statute) ? { citation: residencyRaw.statute.trim() } : {}),
    ...(typeof residencyRaw.stateMonths === 'number' ? { months: residencyRaw.stateMonths } : {}),
  };

  const citations: Record<string, string> = {};
  if (nonEmpty(residencyRaw.statute)) citations.residency = residencyRaw.statute.trim();
  if (nonEmpty(dv.waitingPeriod?.statute)) citations.waitingPeriod = dv.waitingPeriod.statute.trim();
  if (nonEmpty(dv.propertyDivision?.statute)) citations.propertyDivision = dv.propertyDivision.statute.trim();
  if (nonEmpty(raw.metadata.divorceTerminology?.grounds)) citations.grounds = raw.metadata.divorceTerminology.grounds.trim();
  for (const c of dv.legalCitations ?? []) {
    if (!nonEmpty(c?.code)) continue;
    citations[firstNonEmpty(c.description) ?? c.code.trim()] = c.code.trim();
  }

  const waitingPeriod = buildWaitingPeriod(dv);
  const separationMonths = SEPARATION_MONTHS_BY_COUNTRY[country];
  const forms = officialFormsLink(code);

  return {
    instrument: buildInstrument(dv, code, country),
    residency,
    ...(waitingPeriod ? { waitingPeriod } : {}),
    grounds: buildGrounds(dv, code, country),
    ...(separationMonths !== undefined ? { separationMonthsRequired: separationMonths } : {}),
    citations,
    ...(forms ? { officialFormsUrl: forms.url, officialFormsName: forms.name } : {}),
  };
}

// ─── Profile ────────────────────────────────────────────────────────────────

export function buildProfile(raw: RawJurisdiction): JurisdictionProfile {
  const code = String(raw.metadata.stateCode).trim().toUpperCase();
  const country = (firstNonEmpty(raw.metadata.countryCode) ?? DEFAULT_COUNTRY).toUpperCase();
  const name = firstNonEmpty(raw.metadata.stateName) ?? code;
  const paper: JurisdictionProfile['paper'] =
    raw.metadata.paperSize === 'A4' || raw.divorce?.paperSize === 'A4' || A4_JURISDICTIONS.has(code) ? 'a4' : 'letter';

  const lexicon = buildLexicon(raw, code, country);
  const divorce = buildDivorce(raw, code, country);

  return {
    code,
    name,
    country,
    paper,
    lexicon,
    court: buildCourt(raw, code, country, name, lexicon),
    jurat: buildJurat(raw),
    ...(divorce ? { divorce } : {}),
    directory: raw.directory,
  };
}
