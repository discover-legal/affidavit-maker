/**
 * Narrative paragraphs — ONE ask(ASK.COMPOSE_NARRATIVE) per DOCUMENT,
 * drafted from the record against everything the structural sections
 * already say, then verified concurrently paragraph by paragraph. Section
 * ids travel in `input` (never in the instructions), as does the record and
 * the jurisdiction's vocabulary; the answer's `supported_by` ids become
 * `supportedBy`.
 *
 * Code disposes of what the model proposes:
 *   - an id the record does not carry is dropped;
 *   - a paragraph left with no ids is dropped (nothing to verify it against);
 *   - every remaining paragraph is judged; unsupported → dropped.
 */

import { ASK } from '../intelligence/purposes';
import type { Intelligence, Json, JsonSchema } from '../intelligence/types';
import type { JurisdictionProfile } from '../jurisdictions/types';
import type { CaseFile } from '../model/types';
import type { Block } from './types';
import { citableIds, languageOf, paragraph, recordJson, toJson } from './record';
import type { ParagraphBlock } from './verify';
import { keepSupported } from './verify';

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
        required: ['section', 'text', 'supported_by'],
        properties: {
          section: { type: 'string', description: 'The id of the section this paragraph belongs to, one of input.sections[].id.' },
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
  'Draft ADDITIONAL pleading paragraphs for a family-law document, using ONLY the record in input.record. input.sections lists each section by id with the paragraphs it already contains.',
  'Never restate, rephrase or summarise anything already in any section; add only facts from the record that no section covers, and tag each paragraph with the id of the section it belongs in. If nothing is left to add, return an empty list — that is the usual answer.',
  'State facts the record contains; never infer, assume, soften or embellish.',
  'Use the party labels and vocabulary in input.jurisdiction.lexicon and cite statutes only from input.jurisdiction.citations or the ground citations given.',
  'Every paragraph must list, in supported_by, the ids of the record entries it relies on. Do not write a paragraph you cannot support.',
  'Do not state that there is no property, no debt, no children or that support is waived unless the matching confirmation key is in input.record.confirmations, and then cite that key.',
  'Write for the court: plain, formal, no commentary about drafting choices, no placeholders, no brackets.',
].join(' ');

/**
 * Models sometimes number their own paragraphs ("2. The Respondent…"). The
 * renderer numbers; a leading ordinal in the text would print twice. This is
 * a syntactic check on the first token only, not a reading of the prose.
 */
function stripLeadingOrdinal(text: string): string {
  const firstSpace = text.indexOf(' ');
  if (firstSpace <= 0 || firstSpace > 4) return text;
  const token = text.slice(0, firstSpace);
  const body = token.endsWith('.') || token.endsWith(')') ? token.slice(0, -1) : '';
  if (body.length === 0 || !Number.isInteger(Number(body))) return text;
  return text.slice(firstSpace + 1).trim();
}

interface NarrativeAnswer {
  paragraphs?: Array<{ section?: unknown; text?: unknown; supported_by?: unknown }>;
}

export interface NarrativeSource {
  intelligence: Intelligence;
  file: CaseFile;
  jurisdiction: JurisdictionProfile;
}

/** What the model may add to: each section's id, title and the text it already holds. */
export interface StatedSection {
  id: string;
  title?: string;
  blocks: Block[];
}

function statedText(blocks: Block[]): string[] {
  return blocks.flatMap((b) => (b.kind === 'paragraph' ? [b.text] : b.kind === 'list' ? b.items : []));
}

/**
 * ONE narrative ask for the whole document: the model sees every section
 * and what each already says, and proposes additions tagged by section.
 * Every proposal is verified concurrently (supported + not a restatement);
 * survivors come back grouped by section id, in the model's order.
 */
export async function narrativeForDocument(src: NarrativeSource, sections: StatedSection[]): Promise<Map<string, Block[]>> {
  const { intelligence, file, jurisdiction } = src;
  const grounds = jurisdiction.divorce?.grounds ?? [];
  const input: Json = {
    sections: sections.map((s) => ({ id: s.id, title: s.title ?? s.id, already_stated: statedText(s.blocks) })),
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
  const known = new Set(sections.map((s) => s.id));
  const proposed = normalise(answer, citableIds(file), known);
  const out = new Map<string, Block[]>();
  if (proposed.length === 0) return out;
  const stated = sections.flatMap((s) => statedText(s.blocks));
  const record = recordJson(file);
  // Unsupported or restating additions are dropped, not noted: a note belongs
  // to a required value that is missing, and structure already places those.
  const kept = await keepSupported(intelligence, proposed.map((p) => p.block), record, stated);
  const keptSet = new Set(kept);
  for (const p of proposed) {
    if (!keptSet.has(p.block)) continue;
    const list = out.get(p.section) ?? [];
    list.push(p.block);
    out.set(p.section, list);
  }
  return out;
}

/** Shape-check the answer and drop ids / paragraphs the record cannot back or sections that do not exist. */
function normalise(answer: Json, citable: Set<string>, sections: Set<string>): Array<{ section: string; block: ParagraphBlock }> {
  const raw = (answer && typeof answer === 'object' && !Array.isArray(answer) ? (answer as NarrativeAnswer).paragraphs : undefined) ?? [];
  const out: Array<{ section: string; block: ParagraphBlock }> = [];
  for (const item of Array.isArray(raw) ? raw : []) {
    if (!item || typeof item !== 'object') continue;
    const section = typeof item.section === 'string' ? item.section : '';
    if (!sections.has(section)) continue;
    const text = stripLeadingOrdinal(typeof item.text === 'string' ? item.text.trim() : '');
    if (text.length === 0) continue;
    const ids = Array.isArray(item.supported_by) ? item.supported_by.filter((id): id is string => typeof id === 'string' && citable.has(id)) : [];
    if (ids.length === 0) continue;
    out.push({ section, block: paragraph(text, Array.from(new Set(ids))) as ParagraphBlock });
  }
  return out;
}
