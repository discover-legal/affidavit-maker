/**
 * DocumentTree → plain text. One line per block at minimum; the caption
 * contributes one line per court line plus the file number, parties and
 * title. Deterministic: no dates, no ids.
 */

import type { Block, DocumentTree, Section } from '../compose/types';

export const BLANK_RULE = '____________________';

/** A section's own title is drawn only when it has no heading block of its own. */
export function sectionHasHeading(section: Section): boolean {
  return section.blocks.some((b) => b.kind === 'heading');
}

export function captionLines(tree: DocumentTree): string[] {
  const { caption } = tree;
  const lines = [...caption.courtLines];
  lines.push(`${caption.fileNumberLabel} ${caption.fileNumber ?? BLANK_RULE}`);
  const p = caption.parties;
  lines.push(`${p.selfName ?? BLANK_RULE}, ${p.selfLabel}`);
  lines.push(p.versus);
  lines.push(`${p.otherName ?? BLANK_RULE}, ${p.otherLabel}`);
  lines.push(caption.title);
  return lines;
}

function blockLines(block: Block, numbering: { next: number }): string[] {
  switch (block.kind) {
    case 'heading':
      return [block.text];
    case 'paragraph':
      if (block.numbered) {
        const n = numbering.next++;
        return [`${n}. ${block.text}`];
      }
      return [block.text];
    case 'blank':
      return [`${block.label ?? block.field}: ${BLANK_RULE}`, `[${block.note}]`];
    case 'list':
      return block.items.map((item, i) => (block.ordered ? `${i + 1}. ${item}` : `- ${item}`));
    case 'signature':
      return [BLANK_RULE + BLANK_RULE, block.label];
    case 'jurat': {
      const lines = [block.text];
      if (block.officer) lines.push(block.officer);
      if (block.citations.length > 0) lines.push(block.citations.join('; '));
      return lines;
    }
    case 'note':
      return [block.text];
    default:
      return [];
  }
}

export function renderText(tree: DocumentTree): string {
  const lines: string[] = [];
  lines.push(tree.framing.draftNotice);
  lines.push(...captionLines(tree));
  const numbering = { next: 1 };
  for (const section of tree.sections) {
    lines.push('');
    if (section.title && !sectionHasHeading(section)) lines.push(section.title);
    for (const block of section.blocks) lines.push(...blockLines(block, numbering));
  }
  if (tree.framing.officialForms) {
    lines.push('');
    lines.push(`${tree.framing.officialForms.name}: ${tree.framing.officialForms.url}`);
  }
  return lines.join('\n');
}
