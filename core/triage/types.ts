/**
 * Triage — the first turns of a conversation: understand what the person
 * needs, pick a matter type, or ask one clarifying question.
 *
 * The matter list comes from the matter registry (matters/*.yaml plus the
 * divorce definition); the decision is a `choice` judgment plus a short
 * conversational reply. Safety comes first: any mention of danger yields
 * the country's hotline in the reply before anything else.
 */

import type { Intelligence, Message } from '../intelligence/types';
import type { Country } from '../jurisdictions/types';
import type { MatterCode } from '../model/types';

export interface TriageMatterOption {
  code: MatterCode;
  practiceArea: 'family' | 'civil';
  description: string;
  keywords: string[];
  routingNotes?: string[];
}

export interface TriageInput {
  message: string;
  history: Message[];
  country: Country;
  language: 'en' | 'es';
  matters: TriageMatterOption[];
}

export type TriageOutcome =
  | { kind: 'classified'; matter: MatterCode; confidence: number; reply: string }
  | { kind: 'clarify'; reply: string; candidates: MatterCode[] }
  | { kind: 'out_of_scope'; reply: string; reason: 'criminal' | 'immigration' | 'bankruptcy' | 'criminal_protective_order' | 'other' };

export interface TriageResult {
  outcome: TriageOutcome;
  /** Present when the person described danger; the reply already leads with it. */
  safety?: { hotline: string; country: Country };
}

export interface Triage {
  classify(input: TriageInput): Promise<TriageResult>;
}

export interface TriageDeps {
  intelligence: Intelligence;
}


/** Country → hotline shown when danger is mentioned. */
export const HOTLINES: Record<string, string> = {
  US: 'National Domestic Violence Hotline 1-800-799-7233 (thehotline.org)',
  CA: "Assaulted Women's Helpline 1-866-863-0511 (sheltersafe.ca)",
};
