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

type Item = { content: string; type?: string };
type Titled = { title?: string; items: Item[] };
export type LegacySections = Record<string, string | { formatted: string } | { content: string } | Titled | { text: string }>;

/** Petition section ids → the keys DocumentPreview orders for `divorce_petition`. */
const PETITION_KEYS: Record<string, string> = {
  parties: 'parties',
  residency: 'jurisdiction',
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
  out.header = tree.caption.courtLines.join('\n');
  out.caseCaption = { formatted: captionText(tree) };
  out.title = tree.caption.title;

  const keyed = tree.kind === 'divorce_petition' ? PETITION_KEYS : tree.kind === 'divorce_decree' ? DECREE_KEYS : null;

  if (keyed) {
    for (const section of tree.sections) {
      const key = keyed[section.id] ?? section.id;
      const items = section.blocks.flatMap(blockToItems);
      const signature = section.blocks.find((b): b is Extract<Block, { kind: 'signature' }> => b.kind === 'signature');
      const jurat = section.blocks.find((b): b is Extract<Block, { kind: 'jurat' }> => b.kind === 'jurat');
      if (signature) out.signatureBlock = { formatted: signatureText(signature) };
      if (jurat) out.notaryBlock = { content: jurat.text };
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
    const intro = first ? first.blocks.flatMap(blockToItems).map((i) => i.content).join('\n\n') : '';
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
  const lines = [
    `${c.parties.selfLabel}: ${c.parties.selfName ?? '________________________'}`,
    c.parties.versus,
    `${c.parties.otherLabel}: ${c.parties.otherName ?? '________________________'}`,
    `${c.fileNumberLabel} ${c.fileNumber ?? '____________'}`,
  ];
  return lines.join('\n');
}

function signatureText(block: Extract<Block, { kind: 'signature' }>): string {
  return `________________________________\n${block.label}`;
}

function blockToItems(block: Block): Item[] {
  switch (block.kind) {
    case 'heading':
      return [{ content: block.text, type: 'section_header' }];
    case 'paragraph':
      return [{ content: block.text, type: block.numbered === false ? 'text' : 'paragraph' }];
    case 'blank':
      // Notes already begin with "Draft — "; render them as written.
      return [{ content: `${block.label ? `${block.label}: ` : ''}__________________\n(${block.note})`, type: 'blank' }];
    case 'list':
      return block.items.map((item) => ({ content: item, type: block.ordered ? 'relief_item' : 'text' }));
    case 'note':
      return [{ content: `(${block.text})`, type: 'note' }];
    case 'signature':
      return [{ content: signatureText(block), type: 'signature' }];
    case 'jurat':
      return [{ content: block.text, type: 'jurat' }];
  }
}

export function sectionTitles(tree: DocumentTree): string[] {
  return tree.sections.map((s: Section) => s.title ?? s.id);
}
