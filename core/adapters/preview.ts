/**
 * DocumentTree → the v1 preview `sections` object the editor's
 * DocumentPreview component already paginates. Purely a shape adapter so
 * the existing client works against the v2 engine unchanged.
 *
 * v1 shape (components/app/DocumentPreview.js): a keyed object whose keys
 * are looked up in a per-document-type order; each value is a string, a
 * `{ formatted }` block, or `{ title, items: [{ content, type }] }`.
 */

import type { Block, DocumentTree, Section } from '../compose/types';

type Item = { content: string; type?: string; number?: number };

const OFFICER_LABEL: Record<string, string> = {
  notary: 'To be sworn or affirmed before a Notary Public.',
  commissioner_for_oaths: 'To be sworn or affirmed before a Commissioner for Taking Oaths.',
  either: 'To be sworn or affirmed before a Notary Public or a Commissioner for Taking Oaths.',
};
type Titled = { title?: string; items: Item[] };
export type LegacySections = Record<string, string | { formatted: string } | { content: string } | Titled | { text: string }>;

/** Petition section ids → the keys DocumentPreview orders for `divorce_petition`. */
const PETITION_KEYS: Record<string, string> = {
  caption: 'parties',
  parties: 'parties',
  residency: 'jurisdiction',
  marriage: 'marriageInfo',
  grounds: 'grounds',
  children: 'childrenInfo',
  property: 'propertyInfo',
  support: 'propertyInfo',
  relief: 'reliefRequested',
  verification: 'verification',
};

const DECREE_KEYS: Record<string, string> = {
  appearances: 'appearances',
  residency: 'jurisdiction',
  dissolution: 'dissolution',
  property: 'propertyDivision',
  debts: 'debtAllocation',
  children: 'childCustody',
  child_support: 'childSupport',
  support: 'spousalSupport',
  orders: 'finalOrders',
  judgment: 'judgmentBlock',
};

export function toLegacyPreview(tree: DocumentTree): LegacySections {
  const out: LegacySections = {};
  // `venue` renders line-per-line in the editor; `header` collapses newlines.
  out.venue = tree.caption.courtLines.join('\n');
  out.caseCaption = { formatted: captionText(tree) };
  out.title = tree.caption.title;

  const keyed = tree.kind === 'divorce_petition' ? PETITION_KEYS : tree.kind === 'divorce_decree' ? DECREE_KEYS : null;
  // Pleading paragraphs are numbered continuously through the document, as
  // the PDF numbers them; the editor's per-section prefixer honours an
  // explicit `number` and leaves everything else in that section unprefixed.
  const numbering = { next: 1 };

  if (keyed) {
    for (const section of tree.sections) {
      const key = keyed[section.id] ?? section.id;
      // The caption row already shows the file-number blank.
      const blocks = section.id === 'caption' ? section.blocks.filter((b) => !(b.kind === 'blank' && b.field === 'caseNumber')) : section.blocks;
      const items = blocks.flatMap((b) => blockToItems(b, numbering));
      const signature = blocks.find((b): b is Extract<Block, { kind: 'signature' }> => b.kind === 'signature');
      const jurat = blocks.find((b): b is Extract<Block, { kind: 'jurat' }> => b.kind === 'jurat');
      if (signature) out.signatureBlock = { formatted: signatureText(signature) };
      if (jurat) out.notaryBlock = { content: `${jurat.text}\n${OFFICER_LABEL[jurat.officer] ?? ''}`.trim() };
      const body = items.filter((i) => i.type !== 'signature' && i.type !== 'jurat');
      if (body.length === 0) continue;
      const existing = out[key];
      if (existing && typeof existing === 'object' && 'items' in existing) {
        if (section.title) existing.items.push({ content: section.title, type: 'section_header' });
        existing.items.push(...body);
      } else {
        out[key] = { title: section.title, items: body };
      }
    }
  } else {
    // Affidavit-style documents: introduction / facts / conclusion order.
    const [first, ...rest] = tree.sections;
    const intro = first ? first.blocks.flatMap((b) => blockToItems(b)).map((i) => i.content).join('\n\n') : '';
    if (intro) out.introduction = intro;
    const facts: Item[] = [];
    let conclusion = '';
    for (const section of rest) {
      for (const block of section.blocks) {
        if (block.kind === 'signature') out.signatureBlock = { formatted: signatureText(block) };
        else if (block.kind === 'jurat') out.notaryBlock = { content: block.text };
        else if (section.id === 'verification' || section.id === 'conclusion') conclusion += blockToItems(block).map((i) => i.content).join('\n');
        else facts.push(...blockToItems(block));
      }
    }
    if (facts.length) out.facts = { items: facts.map((f, i) => ({ ...f, number: i + 1 })) as Item[] };
    if (conclusion) out.conclusion = conclusion;
  }

  out.footer = tree.framing.draftNotice;
  return out;
}

function captionText(tree: DocumentTree): string {
  const c = tree.caption;
  // The editor centres the caption block, so use the centred style of cause
  // ("Name, Role" / joining word / "Name, Role"); the PDF draws the columns.
  const rule = '______________________________';
  const lines = [
    `${c.fileNumberLabel} ${c.fileNumber ?? '____________'}`,
    '',
    `${c.parties.selfName ?? rule}, ${c.parties.selfLabel}`,
    c.parties.versus,
    `${c.parties.otherName ?? rule}, ${c.parties.otherLabel}`,
  ];
  return lines.join('\n');
}

function signatureText(block: Extract<Block, { kind: 'signature' }>): string {
  return `________________________________\n${block.label}`;
}

interface Numbering { next: number }

function numbered(content: string, numbering?: Numbering): Item {
  return numbering ? { content, type: 'paragraph', number: numbering.next++ } : { content, type: 'paragraph' };
}

/** (a), (b), … as the PDF letters relief items. */
function letterOf(index: number): string {
  return String.fromCharCode(97 + (index % 26));
}

function blockToItems(block: Block, numbering?: Numbering): Item[] {
  switch (block.kind) {
    case 'heading':
      return [{ content: block.text, type: 'section_header' }];
    case 'paragraph':
      return block.numbered === false ? [{ content: block.text, type: 'text' }] : [numbered(block.text, numbering)];
    case 'blank':
      // The draft note is for the review pane, not the document. A sentenced
      // blank is a numbered pleading sentence with an underscored gap.
      if (block.sentence) return [numbered(block.sentence.split('___').join('______________'), numbering)];
      return [{ content: `${block.label ? `${block.label}: ` : ''}______________________________`, type: 'blank' }];
    case 'list':
      // Markers travel in the text so the editor's prefixer skips these items.
      return block.items.map((item, i) => (block.ordered ? { content: `(${letterOf(i)}) ${item}`, type: 'relief_item' } : { content: `• ${item}`, type: 'text' }));
    case 'note':
      return block.text.startsWith('Draft — ') ? [] : [{ content: block.text, type: 'note' }];
    case 'signature':
      return [{ content: signatureText(block), type: 'signature' }];
    case 'jurat':
      return [{ content: block.text, type: 'jurat' }];
  }
}

export function sectionTitles(tree: DocumentTree): string[] {
  return tree.sections.map((s: Section) => s.title ?? s.id);
}
