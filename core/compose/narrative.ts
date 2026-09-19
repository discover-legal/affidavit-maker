/**
 * Narrative paragraphs — ONE ask(ASK.COMPOSE_NARRATIVE) per section that
 * needs prose, drafted from the record, then verified paragraph by
 * paragraph. The section id travels in `input` (never in the instructions),
 * as does the record and the jurisdiction's vocabulary; the answer's
 * `supported_by` ids become `supportedBy`.
 *
 * Code disposes of what the model proposes:
 *   - an id the record does not carry is dropped;
 *   - a paragraph left with no ids is dropped (nothing to verify it against);
 *   - every remaining paragraph is judged; unsupported → blank.
 */

import { ASK } from '../intelligence/purposes';
import type { Intelligence, Json, JsonSchema } from '../intelligence/types';
import type { JurisdictionProfile } from '../jurisdictions/types';
import type { CaseFile } from '../model/types';
import type { Block } from './types';
import { citableIds, languageOf, paragraph, recordJson, toJson } from './record';
import type { ParagraphBlock } from './verify';
import { verifyParagraphs } from './verify';

const NARRATIVE_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['paragraphs'],
  properties: {
    paragraphs: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'supported_by'],
        properties: {
          text: { type: 'string', description: 'One numbered pleading paragraph, third person, past tense for events.' },
          supported_by: {
            type: 'array',
            items: { type: 'string' },
            description: 'Ids from the record (field keys, fact ids, child ids, confirmation keys, parties.<side>.<field>) this paragraph relies on.',
          },
        },
      },
    },
  },
};

const INSTRUCTIONS = [
  'Draft the pleading paragraphs for the section named in input.section of a family-law document, using ONLY the record in input.record.',
  'State facts the record contains; never infer, assume, soften or embellish. If the record says nothing useful for this section, return an empty list.',
  'Use the party labels and vocabulary in input.jurisdiction.lexicon and cite statutes only from input.jurisdiction.citations or the ground citations given.',
  'Every paragraph must list, in supported_by, the ids of the record entries it relies on. Do not write a paragraph you cannot support.',
  'Do not state that there is no property, no debt, no children or that support is waived unless the matching confirmation key is in input.record.confirmations, and then cite that key.',
  'Write for the court: plain, formal, no commentary about drafting choices, no placeholders, no brackets.',
].join(' ');

interface NarrativeAnswer {
  paragraphs?: Array<{ text?: unknown; supported_by?: unknown }>;
}

export interface NarrativeSource {
  intelligence: Intelligence;
  file: CaseFile;
  jurisdiction: JurisdictionProfile;
}

/** Ask for one section's narrative, keep only citable ids, verify, and return paragraph / blank blocks. */
export async function narrativeFor(src: NarrativeSource, sectionId: string): Promise<Block[]> {
  const { intelligence, file, jurisdiction } = src;
  const grounds = jurisdiction.divorce?.grounds ?? [];
  const input: Json = {
    section: sectionId,
    record: recordJson(file),
    jurisdiction: {
      code: jurisdiction.code,
      name: jurisdiction.name,
      lexicon: toJson(jurisdiction.lexicon),
      citations: toJson({ ...(jurisdiction.divorce?.citations ?? {}), ...Object.fromEntries(grounds.filter((g) => g.citation).map((g) => [g.code, g.citation])) }),
    },
  };
  const answer = await intelligence.ask<Json>({
    purpose: ASK.COMPOSE_NARRATIVE,
    instructions: INSTRUCTIONS,
    input,
    schema: NARRATIVE_SCHEMA,
    language: languageOf(file),
  });
  const proposed = normalise(answer, citableIds(file));
  if (proposed.length === 0) return [];
  return verifyParagraphs(intelligence, proposed, recordJson(file));
}

/** Shape-check the answer and drop ids / paragraphs the record cannot back. */
function normalise(answer: Json, citable: Set<string>): ParagraphBlock[] {
  const raw = (answer && typeof answer === 'object' && !Array.isArray(answer) ? (answer as NarrativeAnswer).paragraphs : undefined) ?? [];
  const out: ParagraphBlock[] = [];
  for (const item of Array.isArray(raw) ? raw : []) {
    if (!item || typeof item !== 'object') continue;
    const text = typeof item.text === 'string' ? item.text.trim() : '';
    if (text.length === 0) continue;
    const ids = Array.isArray(item.supported_by) ? item.supported_by.filter((id): id is string => typeof id === 'string' && citable.has(id)) : [];
    if (ids.length === 0) continue;
    out.push(paragraph(text, Array.from(new Set(ids))) as ParagraphBlock);
  }
  return out;
}
