/**
 * DocumentTree → a complete HTML document. Only `paragraph` blocks become
 * <p>; every other block kind has its own element so markup counts mean
 * what they say. Blanks draw an underline rule plus their draft note.
 */

import type { Block, DocumentTree } from '../compose/types';
import type { RenderOptions } from './types';
import { sectionHasHeading } from './text';

/** Character-by-character HTML escaping (no pattern matching involved). */
function esc(value: string): string {
  let out = '';
  for (const ch of value) {
    if (ch === '&') out += '&amp;';
    else if (ch === '<') out += '&lt;';
    else if (ch === '>') out += '&gt;';
    else if (ch === '"') out += '&quot;';
    else out += ch;
  }
  return out;
}

const STYLE = [
  'body{font-family:"Times New Roman",Times,serif;font-size:12pt;line-height:1.5;max-width:8.5in;margin:1in auto;padding:0 16px;color:#111}',
  '.draft-banner{border-bottom:1px solid #999;text-align:center;font-style:italic;color:#555;padding-bottom:6px;margin-bottom:18px}',
  'header.caption{margin-bottom:24px}',
  '.file-number{text-align:right;margin-bottom:12px}.court{text-align:center;font-weight:bold}',
  '.parties{margin:18px 0}.party{display:flex;justify-content:space-between;align-items:baseline;margin:4px 0}.party .role{font-style:italic}.versus{text-align:center;margin:4px 0}',
  '.title{text-align:center;font-weight:bold;text-transform:uppercase;letter-spacing:.04em;border-top:1px solid #111;border-bottom:1px solid #111;padding:8px 0;margin:12px 0 20px}',
  '.court{text-align:center;font-weight:bold;text-transform:uppercase}',
  '.file-number{text-align:right;margin-top:12px}',
  '.parties{margin:12px 0}',
  '.versus{margin-left:2em}',
  '.title{text-align:center;font-weight:bold;text-transform:uppercase;margin-top:18px}',
  'h1{font-size:14pt;text-align:center}h2{font-size:12pt}h3{font-size:12pt;font-style:italic}',
  'p.numbered .n{display:inline-block;min-width:2em}',
  '.rule{display:inline-block;min-width:18em;border-bottom:1px solid #111;height:1em;vertical-align:baseline}',
  '.blank{margin:8px 0}.blank .note,.note,cite{display:block;font-size:9pt;font-style:italic;color:#555}',
  '.signature{margin-top:36px}.signature .rule{min-width:22em}',
  '.jurat{margin-top:24px}.jurat .officer{font-style:italic}',
  'footer{margin-top:36px;font-size:10pt;color:#555;border-top:1px solid #999;padding-top:6px}',
].join('');

function renderBlock(block: Block, numbering: { next: number }): string {
  switch (block.kind) {
    case 'heading':
      return `<h${block.level}>${esc(block.text)}</h${block.level}>`;
    case 'paragraph':
      if (block.numbered) {
        const n = numbering.next++;
        return `<p class="numbered"><span class="n">${n}.</span> ${esc(block.text)}</p>`;
      }
      return `<p>${esc(block.text)}</p>`;
    case 'blank':
      // The draft note explaining the gap is review-pane material (tree.blanks), not document text.
      return (
        `<div class="blank" data-field="${esc(block.field)}">` +
        (block.label ? `<span class="label">${esc(block.label)}:</span> ` : '') +
        '<span class="rule" aria-hidden="true"></span></div>'
      );
    case 'list': {
      const tag = block.ordered ? 'ol' : 'ul';
      return `<${tag}>${block.items.map((item) => `<li>${esc(item)}</li>`).join('')}</${tag}>`;
    }
    case 'signature':
      return `<div class="signature" data-party="${esc(block.party)}"><span class="rule" aria-hidden="true"></span><div class="label">${esc(block.label)}</div></div>`;
    case 'jurat':
      return (
        `<div class="jurat"><div class="text">${esc(block.text)}</div>` +
        (block.officer ? `<div class="officer">${esc(officerLabel(block.officer))}</div>` : '') +
        block.citations.map((c) => `<cite>${esc(c)}</cite>`).join('') +
        '</div>'
      );
    case 'note':
      if (block.text.startsWith('Draft — ')) return '';
      return `<aside class="note">${esc(block.text)}</aside>`;
    default:
      return '';
  }
}

/** The oath officer as a person reads it; the block carries the profile's enum. */
const OFFICER_LABEL: Record<string, string> = {
  notary: 'To be sworn or affirmed before a Notary Public.',
  commissioner_for_oaths: 'To be sworn or affirmed before a Commissioner for Taking Oaths.',
  either: 'To be sworn or affirmed before a Notary Public or a Commissioner for Taking Oaths.',
};
const officerLabel = (o: string): string => OFFICER_LABEL[o] ?? o;

export function renderHtml(tree: DocumentTree, options: RenderOptions = {}): string {
  const { caption, framing } = tree;
  const parts: string[] = [];
  parts.push('<!DOCTYPE html>');
  parts.push(`<html lang="${esc(tree.language)}">`);
  parts.push(`<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(caption.title)}</title><style>${STYLE}</style></head>`);
  parts.push('<body>');
  if (options.draftBanner) parts.push(`<div class="draft-banner">${esc(framing.draftNotice)}</div>`);

  parts.push('<header class="caption">');
  parts.push(
    `<div class="file-number">${esc(caption.fileNumberLabel)} ` +
      (caption.fileNumber ? `<span class="value">${esc(caption.fileNumber)}</span>` : '<span class="rule" aria-hidden="true"></span>') +
      '</div>',
  );
  for (const line of caption.courtLines) parts.push(`<div class="court">${esc(line)}</div>`);
  // Style of cause: name left, role right, the joining word centred between.
  const p = caption.parties;
  parts.push('<div class="parties">');
  parts.push(`<div class="party self"><span class="name">${p.selfName ? esc(p.selfName) : '<span class="rule" aria-hidden="true"></span>'}</span><span class="role">${esc(p.selfLabel)}</span></div>`);
  parts.push(`<div class="versus">${esc(p.versus)}</div>`);
  parts.push(`<div class="party other"><span class="name">${p.otherName ? esc(p.otherName) : '<span class="rule" aria-hidden="true"></span>'}</span><span class="role">${esc(p.otherLabel)}</span></div>`);
  parts.push('</div>');
  parts.push(`<div class="title">${esc(caption.title)}</div>`);
  parts.push('</header>');

  parts.push('<main>');
  const numbering = { next: 1 };
  for (const section of tree.sections) {
    parts.push(`<section id="${esc(section.id)}">`);
    if (section.title && !sectionHasHeading(section)) parts.push(`<div class="section-title">${esc(section.title)}</div>`);
    for (const block of section.blocks) {
      if (section.id === 'caption' && block.kind === 'blank' && block.field === 'caseNumber') continue; // shown in the caption row
      parts.push(renderBlock(block, numbering));
    }
    parts.push('</section>');
  }
  parts.push('</main>');

  parts.push('<footer>');
  parts.push(`<div class="draft-notice">${esc(framing.draftNotice)}</div>`);
  if (framing.officialForms) {
    parts.push(`<div class="official-forms"><a href="${esc(framing.officialForms.url)}" rel="noopener">${esc(framing.officialForms.name)}</a></div>`);
  }
  if (options.footerBrand) parts.push(`<div class="brand">${esc(options.footerBrand)}</div>`);
  parts.push('</footer>');
  parts.push('</body>');
  parts.push('</html>');
  return parts.join('\n');
}
