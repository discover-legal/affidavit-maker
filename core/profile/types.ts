/**
 * Life story — the durable profile a person builds across sessions and
 * documents, so they never repeat themselves.
 *
 * hydrate(): gap-fill a CaseFile from the profile (current document wins;
 *            jurisdiction never hydrates; family details only into family matters).
 * absorb():  merge a CaseFile back (an absent incoming value never erases a
 *            stored one; itemized money replaces per person; children merge
 *            by identity judgment, never by string equality).
 * promote(): fill structured fields from active facts with ONE extraction
 *            call against the matter's field schema. Replaces the rescue
 *            loops and the whereabouts / children-count / grounds regexes.
 */

import type { Intelligence } from '../intelligence/types';
import type { MatterDefinition } from '../interview/types';
import type { CaseFile, Child, Confirmations, Fact, Field, Party } from '../model/types';

export interface TimelineEvent {
  id: string;
  date?: string; // ISO or partial
  title: string;
  detail?: string;
  provenance: Fact['provenance'];
}

export interface LifeStory {
  userId: string;
  self: Party;
  /** Keyed by a stable person id; the current spouse/other party is one of them. */
  people: Record<string, Party & { relationship?: Field<string> }>;
  children: Child[];
  /** Cross-matter structured fields (marriage date, separation date, income, …). */
  fields: Record<string, Field>;
  facts: Fact[];
  confirmations: Confirmations;
  events: TimelineEvent[];
  updatedAt: string;
}

export type HydrationScope = 'family' | 'general';

export interface IngestInput {
  /** Text pasted or OCR'd from a court paper. */
  text: string;
  documentId: string;
  kind?: 'petition' | 'response' | 'notice' | 'order' | 'unknown';
}

export interface IngestResult {
  events: TimelineEvent[];
  facts: Fact[];
  /** Party names, case number, court, dates found in the paper. */
  fields: Record<string, Field>;
  kind: NonNullable<IngestInput['kind']>;
}

export interface LifeStoryService {
  hydrate(story: LifeStory | null, file: CaseFile, scope: HydrationScope): CaseFile;
  absorb(story: LifeStory | null, file: CaseFile): Promise<LifeStory>;
  promote(file: CaseFile, definition: MatterDefinition): Promise<CaseFile>;
  ingest(story: LifeStory | null, input: IngestInput): Promise<IngestResult>;
  /** Privacy erase: the returned story is empty and the caller persists that. */
  erase(userId: string): LifeStory;
}

export interface LifeStoryDeps {
  intelligence: Intelligence;
}

