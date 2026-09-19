/**
 * Raw metadata shapes and the synchronous loader for
 * templates/states/<dir>/metadata.json and divorce-metadata.json.
 *
 * The shapes below are deliberately loose: the files were authored by hand
 * over several years and the legal validation program verified their
 * substance, not their key layout. The builder (build.ts) reads only the
 * keys it needs and tolerates everything else.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface RawCitation {
  code?: string;
  description?: string;
  url?: string;
}

export interface RawFeatures {
  perjuryStatement?: boolean;
  notaryBlock?: boolean;
  caseNumberLabel?: string;
  headerFormat?: string;
  venueFormat?: string;
  commissionerForOaths?: boolean;
  commissionerOfOaths?: boolean;
  justiceOfThePeace?: boolean;
  solicitorOrJP?: boolean;
  statementOfTruth?: boolean;
  usesJudicialDistrict?: boolean;
  usesParish?: boolean;
  usesRegistry?: boolean;
  noCounties?: boolean;
  territoryNotState?: boolean;
  provinceNotJurisdiction?: boolean;
  [key: string]: unknown;
}

export interface RawMetadata {
  stateCode?: string;
  stateName?: string;
  countryCode?: string;
  paperSize?: string;
  features?: RawFeatures;
  courtSystem?: { trialCourt?: string; familyDivision?: string; familyCourt?: string; [key: string]: unknown };
  divorceTerminology?: { parties?: string[]; grounds?: string; propertyDivision?: string; [key: string]: unknown };
  legalCitations?: RawCitation[];
  affidavitJurat?: string;
  [key: string]: unknown;
}

export interface RawGround {
  code?: string;
  name?: string;
  description?: string;
  statute?: string;
  [key: string]: unknown;
}

export interface RawForm {
  name?: string;
  description?: string;
  required?: boolean;
  [key: string]: unknown;
}

export interface RawDivorceMetadata {
  stateCode?: string;
  paperSize?: string;
  residencyRequirements?: { stateMonths?: number | null; description?: string; statute?: string; [key: string]: unknown };
  waitingPeriod?: { days?: number | null; description?: string; statute?: string; startsFrom?: string; [key: string]: unknown };
  groundsForDivorce?: Record<string, unknown>;
  groundsForDissolution?: Record<string, unknown>;
  propertyDivision?: { type?: string; description?: string; statute?: string; [key: string]: unknown };
  terminology?: {
    petitioner?: string;
    respondent?: string;
    plaintiff?: string;
    defendant?: string;
    petition?: string;
    petitionTitle?: string;
    decree?: string;
    decreeTitle?: string;
    court?: string;
    [key: string]: unknown;
  };
  requiredForms?: { basic?: RawForm[]; [key: string]: unknown };
  court?: { name?: string; description?: string; [key: string]: unknown };
  legalCitations?: RawCitation[];
  [key: string]: unknown;
}

export interface RawJurisdiction {
  directory: string;
  metadata: RawMetadata;
  divorce: RawDivorceMetadata | null;
}

function readJson<T>(file: string): T | null {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8')) as T;
  } catch (err) {
    // A broken file is logged and skipped; it never takes the registry down.
    console.warn(`core/jurisdictions: could not parse ${file}: ${(err as Error).message}`);
    return null;
  }
}

/** Default location of the template directories, resolved from this module (falls back to cwd). */
export function defaultTemplatesDir(): string {
  const fromModule = path.resolve(__dirname, '..', '..', 'templates', 'states');
  if (fs.existsSync(fromModule)) return fromModule;
  return path.join(process.cwd(), 'templates', 'states');
}

/** Every jurisdiction directory with a parseable metadata.json, in directory order. */
export function loadRawJurisdictions(templatesDir: string): RawJurisdiction[] {
  if (!fs.existsSync(templatesDir)) return [];
  const out: RawJurisdiction[] = [];
  const entries = fs.readdirSync(templatesDir, { withFileTypes: true }).filter((e) => e.isDirectory());
  for (const entry of entries) {
    const dir = path.join(templatesDir, entry.name);
    const metadata = readJson<RawMetadata>(path.join(dir, 'metadata.json'));
    if (!metadata || typeof metadata.stateCode !== 'string' || metadata.stateCode.trim() === '') continue;
    const divorce = readJson<RawDivorceMetadata>(path.join(dir, 'divorce-metadata.json'));
    out.push({ directory: entry.name, metadata, divorce });
  }
  return out;
}
