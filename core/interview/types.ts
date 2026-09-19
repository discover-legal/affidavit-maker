/**
 * Interview — one engine for every matter, driven by a MatterDefinition
 * (matters/*.yaml, plus the divorce definition with jurisdiction overlays).
 *
 * A turn is: build context → ask the model for a structured Turn →
 * verify the parts that have consequences (affirmations, corrections,
 * child identity) with judgments → apply to the CaseFile → decide the next
 * phase in code. The model never mutates state; it proposes, code disposes.
 *
 * Invariants the engine enforces (not the prompt):
 *   - exactly one question per reply (a reply with 0 or 2+ questions is reformulated once)
 *   - the user's own full name is captured before any other phase completes
 *   - a Confirmation is recorded only when a judgment over the user's verbatim
 *     message clears THRESHOLDS.affirmation; otherwise the engine asks for it
 *   - a fact is retired only when a judgment says the new statement supersedes it
 *   - the reply is in the case language (judged; reformulated once if not)
 *   - a phase completes only when its required fields are present
 */

import type { Intelligence, Json, Message } from '../intelligence/types';
import type { JurisdictionProfile, JurisdictionRegistry } from '../jurisdictions/types';
import type { CaseFile, ConfirmationKey, Fact, FactCategory, Language } from '../model/types';

/** A field the matter's interview may collect. Mirrors matters/*.yaml `fields`. */
export interface FieldSpec {
  key: string; // snake_case, what the model emits
  target: string; // camelCase, where it lands on CaseFile.fields (or a well-known path)
  schema: Json; // JSON schema fragment
  /** Well-known destinations get routed to typed slots instead of `fields`. */
  binds?:
    | 'self.firstName'
    | 'self.lastName'
    | 'other.firstName'
    | 'other.lastName'
    | 'county'
    | 'jurisdiction'
    | 'caseNumber'
    | 'children'
    | 'other.whereaboutsUnknown'
    | 'other.suspectedLocation';
}

export interface PhaseSpec {
  id: string;
  displayName: string;
  /** Legal substance for this phase: what to collect, jurisdiction notes. Plain text, no rules about turn mechanics. */
  guidance: string;
  requiredFields: string[]; // camelCase targets or well-known paths
  skipUnlessAny?: string[];
  skipIfAny?: string[];
  factCategory?: FactCategory;
  /** Confirmations this phase may elicit (e.g. PROPERTY → no_property). */
  confirmations?: ConfirmationKey[];
}

export interface MatterDefinition {
  code: string;
  practiceArea: 'family' | 'civil';
  displayName: string;
  familyProfile: boolean;
  fields: FieldSpec[];
  phases: PhaseSpec[];
  /** Whether the interview should ask which side the user is on. */
  roles?: boolean;
  /** Jurisdiction-specific guidance merged into phases (divorce). */
  overlay?: (jurisdiction: JurisdictionProfile) => Partial<Record<string, string>>;
}

/** What the model returns for one turn. This is the `ask("interview.turn")` schema. */
export interface TurnProposal {
  say: string;
  /** The question(s) the reply asks, verbatim. The engine requires exactly one. */
  questions_asked: string[];
  phase_complete: boolean;
  /** Field values the user stated this turn, keyed by FieldSpec.key. Omit anything not stated. */
  fields: Record<string, Json>;
  facts: Array<{ statement: string; category: FactCategory; subcategory?: string; quote: string; values?: Fact['values'] }>;
  /** Earlier fact statements this turn contradicts or replaces. */
  corrections: Array<{ earlier_statement: string; because: string }>;
  /** Confirmations the user appears to have made this turn. Each is verified before recording. */
  affirmations: ConfirmationKey[];
  children: Array<{ name?: string; date_of_birth?: string; age?: number; resides_with?: 'self' | 'other' | 'shared' | 'third_party' }>;
}

export interface TurnInput {
  file: CaseFile;
  history: Message[];
  message: string;
}

export interface TurnResult {
  reply: string;
  file: CaseFile;
  asked: string[];
  phaseAdvanced: boolean;
  newFacts: Fact[];
  retiredFacts: Fact[];
  /** Confirmations recorded this turn. */
  confirmed: ConfirmationKey[];
  /** Affirmations the model proposed that the judgment did not clear; the next turn asks explicitly. */
  unconfirmed: ConfirmationKey[];
  language: Language;
}

export interface InterviewEngine {
  turn(input: TurnInput): Promise<TurnResult>;
  /** The phase the file will be in next, given its current data (pure). */
  nextPhase(file: CaseFile, definition: MatterDefinition): string | null;
  /** Completion: every phase done and review confirmed. */
  isComplete(file: CaseFile, definition: MatterDefinition): boolean;
}

export interface InterviewDeps {
  intelligence: Intelligence;
  matters: { get(code: string): MatterDefinition | null };
  jurisdictions: JurisdictionRegistry;
}

