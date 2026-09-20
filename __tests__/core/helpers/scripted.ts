/**
 * Shared helpers for the core/ behaviour tests.
 *
 * Everything here is structural: CaseFile factories, in-memory jurisdiction
 * profiles, a matter registry stub, and `runInterview` — the simple loop
 * that drives the interview engine turn by turn with a scripted user script
 * and a scripted model script (core/README.md, "Testing rules").
 *
 * No regexes, no keyword lists, no substring matching on prose.
 */

import type { AskRequest, Json, JsonObject, Message } from '@/core/intelligence/types';
import { ScriptedIntelligence, no, pick, yes } from '@/core/intelligence/scripted';
import { ASK } from '@/core/intelligence/purposes';
import { emptyCaseFile } from '@/core/model/types';
import type { CaseFile, Provenance } from '@/core/model/types';
import type { JurisdictionProfile, JurisdictionRegistry } from '@/core/jurisdictions/types';
import * as interviewModule from '@/core/interview';
import type { InterviewEngine, MatterDefinition, TurnProposal, TurnResult } from '@/core/interview/types';

// ─── CaseFile ───────────────────────────────────────────────────────────────

export function fileFor(overrides: Partial<CaseFile> = {}): CaseFile {
  return emptyCaseFile({ id: 'case_test', userId: 'user_test', ...overrides });
}

/** A `stated` provenance for pre-populating files in scenarios. */
export function stated(quote: string): Provenance {
  return { source: 'stated', quote, at: '2026-01-01T00:00:00.000Z' };
}

/**
 * ISO calendar date `n` months before today. Pure date arithmetic (a
 * syntactic shape for the separation-gate scenarios), not a semantic rule.
 */
export function monthsAgo(n: number): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() - n);
  return d.toISOString().slice(0, 10);
}

// ─── Jurisdictions ──────────────────────────────────────────────────────────

const JURAT_NOTARY = {
  officer: 'notary' as const,
  verificationText: 'Sworn to and subscribed before me.',
  citations: ['Tex. Civ. Prac. & Rem. Code §132.001'],
};

const PROFILES: Record<string, JurisdictionProfile> = {
  ON: {
    code: 'ON',
    name: 'Ontario',
    country: 'CA',
    paper: 'letter',
    directory: 'ontario',
    lexicon: {
      petitioner: 'Applicant',
      respondent: 'Respondent',
      fileNumberLabel: 'Court File No.',
      versus: 'AND BETWEEN',
      orderIntro: 'IT IS ORDERED',
      selfRepresented: 'self-represented',
      maritalProperty: 'family property',
      maritalDebts: 'family debts',
      counterClaimTitle: 'Answer with Claim',
      regionLabel: 'Province',
      countyLabel: 'Region',
    },
    court: { name: 'Superior Court of Justice', venueLines: ['ONTARIO', 'SUPERIOR COURT OF JUSTICE', '{county}'] },
    jurat: {
      officer: 'commissioner_for_oaths',
      verificationText: 'Sworn before me at the City of Toronto.',
      citations: ['Commissioners for Taking Affidavits Act, RSO 1990, c. C.17'],
    },
    divorce: {
      instrument: { petition: 'Application', decree: 'Divorce Order', answer: 'Answer' },
      residency: { text: 'Either spouse ordinarily resident in Ontario for at least one year.', citation: 'Divorce Act s. 3(1)', months: 12 },
      grounds: [
        { code: 'one_year_separation', label: 'Breakdown of marriage: one year separation', citation: 'Divorce Act s. 8(2)(a)', noFault: true },
        { code: 'adultery', label: 'Adultery', citation: 'Divorce Act s. 8(2)(b)(i)', noFault: false },
        { code: 'cruelty', label: 'Cruelty', citation: 'Divorce Act s. 8(2)(b)(ii)', noFault: false },
      ],
      separationMonthsRequired: 12,
      citations: { divorceAct: 'Divorce Act, RSC 1985, c. 3 (2nd Supp.)' },
      officialFormsUrl: 'https://ontariocourtforms.on.ca/en/family-law-rules-forms/',
      officialFormsName: 'Ontario Family Law Rules forms',
    },
  },
  TX: {
    code: 'TX',
    name: 'Texas',
    country: 'US',
    paper: 'letter',
    directory: 'texas',
    lexicon: {
      petitioner: 'Petitioner',
      respondent: 'Respondent',
      fileNumberLabel: 'Cause No.',
      versus: 'v.',
      orderIntro: 'IT IS ORDERED AND DECREED',
      selfRepresented: 'pro se',
      maritalProperty: 'community property',
      maritalDebts: 'community debts',
      counterClaimTitle: 'Counter-Petition',
      regionLabel: 'State',
      countyLabel: 'County',
    },
    court: { name: 'District Court', venueLines: ['IN THE DISTRICT COURT OF', '{county} COUNTY, TEXAS'], divisionLabel: 'Judicial District' },
    jurat: JURAT_NOTARY,
    divorce: {
      instrument: { petition: 'Original Petition for Divorce', decree: 'Final Decree of Divorce', answer: 'Original Answer' },
      residency: { text: 'Six months in Texas and ninety days in the county.', citation: 'Tex. Fam. Code §6.301', months: 6 },
      waitingPeriod: { text: 'Sixty days from filing.', citation: 'Tex. Fam. Code §6.702' },
      grounds: [
        { code: 'insupportability', label: 'Insupportability', citation: 'Tex. Fam. Code §6.001', noFault: true },
        { code: 'cruelty', label: 'Cruelty', citation: 'Tex. Fam. Code §6.002', noFault: false, alternative: 'insupportability' },
      ],
      citations: { familyCode: 'Tex. Fam. Code' },
    },
  },
  NY: {
    code: 'NY',
    name: 'New York',
    country: 'US',
    paper: 'letter',
    directory: 'new_york',
    lexicon: {
      petitioner: 'Plaintiff',
      respondent: 'Defendant',
      fileNumberLabel: 'Index No.',
      versus: 'v.',
      orderIntro: 'ORDERED, ADJUDGED AND DECREED',
      selfRepresented: 'pro se',
      maritalProperty: 'marital property',
      maritalDebts: 'marital debts',
      counterClaimTitle: 'Counterclaim',
      regionLabel: 'State',
      countyLabel: 'County',
    },
    court: { name: 'Supreme Court', venueLines: ['SUPREME COURT OF THE STATE OF NEW YORK', 'COUNTY OF {county}'] },
    jurat: JURAT_NOTARY,
    divorce: {
      instrument: { petition: 'Verified Complaint', decree: 'Judgment of Divorce', answer: 'Verified Answer' },
      residency: { text: 'Residency basis under DRL §230.', citation: 'DRL §230', months: 12 },
      grounds: [{ code: 'irretrievable_breakdown', label: 'Irretrievable breakdown for six months', citation: 'DRL §170(7)', noFault: true }],
      citations: { drl: 'N.Y. Dom. Rel. Law' },
    },
  },
};

export function jurisdictionStub(code: 'ON' | 'TX' | 'NY'): JurisdictionProfile {
  return structuredClone(PROFILES[code]);
}

export function registryStub(profiles: JurisdictionProfile[]): JurisdictionRegistry {
  const byCode = new Map(profiles.map((p) => [p.code, p]));
  return {
    get: (code) => byCode.get(String(code).toUpperCase()) ?? null,
    active: () => [...profiles],
    all: () => [...profiles],
    countryOf: (code) => byCode.get(String(code).toUpperCase())?.country ?? null,
    defaultFor: (country) => profiles.find((p) => p.country === country) ?? null,
  };
}

// ─── Matters ────────────────────────────────────────────────────────────────

export function matterStub(...defs: MatterDefinition[]): { get(code: string): MatterDefinition | null } {
  return { get: (code) => defs.find((d) => d.code === code) ?? null };
}

/**
 * A three-phase civil matter used by the engine tests:
 *   INTAKE → DETAILS (only when hasChildren) → REVIEW.
 */
export function simpleDefinition(): MatterDefinition {
  return {
    code: 'test_matter',
    practiceArea: 'civil',
    displayName: 'Test Matter',
    familyProfile: false,
    fields: [
      { key: 'petitioner_first_name', target: 'petitionerFirstName', schema: { type: 'string' }, binds: 'self.firstName' },
      { key: 'petitioner_last_name', target: 'petitionerLastName', schema: { type: 'string' }, binds: 'self.lastName' },
      { key: 'county', target: 'county', schema: { type: 'string' }, binds: 'county' },
      { key: 'has_children', target: 'hasChildren', schema: { type: 'boolean' } },
      { key: 'user_confirmed_review', target: 'userConfirmedReview', schema: { type: 'boolean' } },
    ],
    phases: [
      {
        id: 'INTAKE',
        displayName: 'Getting Started',
        guidance: 'Collect the full legal name of the person and the county they will file in.',
        requiredFields: ['petitionerFirstName', 'petitionerLastName', 'county'],
      },
      {
        id: 'DETAILS',
        displayName: 'Children',
        guidance: 'Collect the children of the household.',
        requiredFields: [],
        skipUnlessAny: ['hasChildren'],
        factCategory: 'children',
        confirmations: ['no_children'],
      },
      {
        id: 'REVIEW',
        displayName: 'Review & Confirm',
        guidance: 'Summarize and ask the person to confirm.',
        requiredFields: ['userConfirmedReview'],
        confirmations: ['review_confirmed'],
      },
    ],
  };
}

/**
 * Functions the implementation is expected to export from '@/core/interview'
 * but that the contract file does not declare yet (getDivorceDefinition,
 * fromYamlMatter). Resolved at runtime so the suite type-checks today and
 * fails red with a "not implemented" message until they exist.
 */
export function interviewExport<T>(name: string): T {
  const value = (interviewModule as unknown as Record<string, unknown>)[name];
  if (typeof value !== 'function') throw new Error(`core/interview: ${name} not implemented yet`);
  return value as T;
}

// ─── Turn proposals ─────────────────────────────────────────────────────────

/** A TurnProposal with every collection empty and exactly one question. */
export function proposal(partial: Partial<TurnProposal> = {}): TurnProposal {
  return {
    say: 'Thank you. What county will you be filing in?',
    questions_asked: ['What county will you be filing in?'],
    phase_complete: false,
    fields: {},
    facts: [],
    corrections: [],
    affirmations: [],
    children: [],
    ...partial,
  };
}

// ─── The simple loop ────────────────────────────────────────────────────────

type JudgeScript = Parameters<ScriptedIntelligence['onJudge']>[1];
type AskScript = Parameters<ScriptedIntelligence['onAsk']>[1];

export interface ScriptStep {
  user: string;
  model: TurnProposal | ((file: CaseFile, req: AskRequest) => TurnProposal);
  /** Judgment answers keyed by question key (or "purpose:key"); merged over the defaults. */
  judgments?: Record<string, JudgeScript>;
  /** Extra asks the turn may make (e.g. ASK.INTERVIEW_REFORMULATE), keyed by purpose. */
  asks?: Record<string, AskScript>;
}

export interface Harness {
  engine: InterviewEngine;
  intel: ScriptedIntelligence;
}

export interface TurnRecord {
  result: TurnResult;
  file: CaseFile;
}

/** Judgments every turn gets unless a step overrides them. */
export function defaultJudgments(): Record<string, JudgeScript> {
  return {
    language: pick('en'),
    in_language: yes(),
    affirmed: yes(),
    supersedes: yes(),
    same_child: no(),
    duplicate: no(),
  };
}

/**
 * Drive the engine through `script`, one turn per step. Each step scripts
 * the model's TurnProposal for ASK.INTERVIEW_TURN plus the step's judgments
 * (over the defaults), calls `engine.turn`, and records `{ result, file }`.
 * The conversation history grows as the real route would grow it.
 */
export async function runInterview(h: Harness, file: CaseFile, script: ScriptStep[]): Promise<TurnRecord[]> {
  const records: TurnRecord[] = [];
  const history: Message[] = [];
  let current = file;
  for (const step of script) {
    const model = step.model;
    const proposalFor = typeof model === 'function' ? model : () => model;
    const snapshot = current;
    h.intel.onAsk(ASK.INTERVIEW_TURN, (req) => proposalFor(snapshot, req) as unknown as JsonObject);
    for (const [purpose, handler] of Object.entries(step.asks ?? {})) h.intel.onAsk(purpose, handler);
    for (const [key, handler] of Object.entries({ ...defaultJudgments(), ...(step.judgments ?? {}) })) h.intel.onJudge(key, handler);

    const result = await h.engine.turn({ file: current, history: [...history], message: step.user });
    history.push({ role: 'user', content: step.user }, { role: 'assistant', content: result.reply });
    current = result.file;
    records.push({ result, file: current });
  }
  return records;
}

/** The last ask made to `purpose`, typed for structural assertions. */
export function lastAsk(intel: ScriptedIntelligence, purpose: string): AskRequest {
  const calls = intel.callsTo(purpose);
  const last = calls[calls.length - 1];
  if (!last || last.kind !== 'ask') throw new Error(`no ask("${purpose}") was made`);
  return last.request;
}

/** The last judge call made to `purpose`. */
export function lastJudge(intel: ScriptedIntelligence, purpose: string): { state: Json; questions: Record<string, { type: string; options?: Record<string, string | null> }> } {
  const calls = intel.callsTo(purpose);
  const last = calls[calls.length - 1];
  if (!last || last.kind !== 'judge') throw new Error(`no judge("${purpose}") was made`);
  return last.request as unknown as { state: Json; questions: Record<string, { type: string; options?: Record<string, string | null> }> };
}

export function asObject(value: Json | undefined): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('expected a JSON object');
  return value;
}
