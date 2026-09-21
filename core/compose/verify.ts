/**
 * Verification — is this paragraph supported by the record? That is a
 * judge() question (JUDGE.COMPOSE_VERIFY), asked once per paragraph with
 * the paragraph and the record as state. Below THRESHOLDS.supported the
 * paragraph becomes a typed blank on its first supporting id (or
 * 'narrative' when it cited nothing), with a draft note.
 *
 * This replaces v1's meta-commentary regexes and placeholder denylist: no
 * substring ever decides whether prose is trustworthy.
 */

import { JUDGE } from '../intelligence/purposes';
import type { Intelligence, Json } from '../intelligence/types';
import { THRESHOLDS, yesno } from '../intelligence/types';
import type { CaseFile } from '../model/types';
import type { Block, DocumentTree, Section } from './types';
import { blank, recordJson } from './record';

export type ParagraphBlock = Extract<Block, { kind: 'paragraph' }>;
export type BlankBlock = Extract<Block, { kind: 'blank' }>;

const UNSUPPORTED_NOTE =
  'Draft — this statement could not be verified against what you told us and was removed. State the underlying facts in the interview, or write the paragraph yourself from your own knowledge.';

/** True when the model judges every claim in the paragraph supported by the record. */
export async function isSupported(intelligence: Intelligence, paragraph: ParagraphBlock, record: Json): Promise<boolean> {
  const answers = await intelligence.judge({
    purpose: JUDGE.COMPOSE_VERIFY,
    state: { paragraph: { text: paragraph.text, supportedBy: [...paragraph.supportedBy] }, record },
    questions: {
      supported: yesno(
        'Is every factual claim in the paragraph supported by the record (its fields, facts, confirmations, parties and children)?',
        'Everything the paragraph asserts about the parties, dates, children, property, debts, support or grounds is stated in the record.',
        'The paragraph asserts, implies or embellishes something the record does not contain, or contradicts it.',
      ),
    },
  });
  return answers.supported.probability > THRESHOLDS.supported;
}

/** The blank that stands in for a paragraph the record does not support. */
export function blankForParagraph(paragraph: ParagraphBlock): BlankBlock {
  return blank(paragraph.supportedBy[0] ?? 'narrative', UNSUPPORTED_NOTE) as BlankBlock;
}

/**
 * Judge narrative additions once each; keep only those the record supports
 * AND that do not restate what the section already says. Both are judgments
 * over the same state in one call.
 */
export async function keepSupported(intelligence: Intelligence, paragraphs: ParagraphBlock[], record: Json, alreadyStated: string[] = []): Promise<Block[]> {
  // Each paragraph's judgment is independent of the others: run them together.
  const verdicts = await Promise.all(paragraphs.map(async (p) => {
    const answers = await intelligence.judge({
      purpose: JUDGE.COMPOSE_VERIFY,
      state: { paragraph: { text: p.text, supportedBy: [...p.supportedBy] }, record, already_stated: alreadyStated },
      questions: {
        supported: yesno(
          'Is every factual claim in the paragraph supported by the record (its fields, facts, confirmations, parties and children)?',
          'Everything the paragraph asserts is stated in the record.',
          'The paragraph asserts, implies or embellishes something the record does not contain, or contradicts it.',
        ),
        restates: yesno(
          'Does the paragraph merely repeat, rephrase or summarise something one of the already_stated paragraphs already says?',
          'It adds no fact beyond what already_stated contains.',
          'It adds at least one fact from the record that already_stated does not contain.',
        ),
      },
    });
    return answers.supported.probability > THRESHOLDS.supported && answers.restates.probability < THRESHOLDS.supported;
  }));
  return paragraphs.filter((_, i) => verdicts[i]);
}

/** Judge a list of paragraphs once each; unsupported ones come back as blanks, in the same order. */
export async function verifyParagraphs(intelligence: Intelligence, paragraphs: ParagraphBlock[], record: Json): Promise<Block[]> {
  const verdicts = await Promise.all(paragraphs.map((p) => isSupported(intelligence, p, record)));
  return paragraphs.map((p, i) => (verdicts[i] ? p : blankForParagraph(p)));
}

/** Every blank block in the tree, with its section id, in document order. */
export function indexBlanks(sections: Section[]): DocumentTree['blanks'] {
  const blanks: DocumentTree['blanks'] = [];
  for (const s of sections) for (const b of s.blocks) if (b.kind === 'blank') blanks.push({ field: b.field, note: b.note, section: s.id });
  return blanks;
}

/**
 * Judge every paragraph block in the tree against the file. Returns a new
 * tree; the input is never mutated. Blanks are not paragraphs, so a second
 * pass re-judges only what is still prose — the operation is idempotent
 * under a stable judgment.
 */
export async function verifyTree(intelligence: Intelligence, tree: DocumentTree, file: CaseFile): Promise<DocumentTree> {
  const record = recordJson(file);
  const added: DocumentTree['blanks'] = [];
  const sections: Section[] = [];
  for (const s of tree.sections) {
    const paragraphs = s.blocks.filter((b): b is ParagraphBlock => b.kind === 'paragraph');
    const verdicts = new Map<Block, boolean>();
    await Promise.all(paragraphs.map(async (p) => verdicts.set(p, await isSupported(intelligence, p, record))));
    const blocks: Block[] = [];
    for (const b of s.blocks) {
      if (b.kind !== 'paragraph' || verdicts.get(b)) {
        blocks.push(b);
        continue;
      }
      const replacement = blankForParagraph(b);
      blocks.push(replacement);
      added.push({ field: replacement.field, note: replacement.note, section: s.id });
    }
    sections.push({ ...s, blocks });
  }
  return { ...tree, sections, blanks: [...tree.blanks, ...added] };
}
