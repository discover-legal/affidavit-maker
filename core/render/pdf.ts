/**
 * DocumentTree → PDF bytes via pdfkit.
 *
 * Page conventions follow the v1 builder (services/pdfService.js) without
 * importing it: Letter or A4 from tree.paper, Times-Roman 12pt, 1in
 * margins, and a "Page N of M" footer stamped in a single pass over the
 * buffered pages once the content is laid out. The draft banner draws a
 * line across the top of the first page; a blank draws an underline rule
 * with its draft note in smaller italic.
 */

import PDFDocument from 'pdfkit';
import type { Block, DocumentTree } from '../compose/types';
import type { RenderOptions } from './types';
import { sectionHasHeading } from './text';

const FONT = 'Times-Roman';
const FONT_BOLD = 'Times-Bold';
const FONT_ITALIC = 'Times-Italic';
const FONT_BOLD_ITALIC = 'Times-BoldItalic';
const BODY_SIZE = 12;
const NOTE_SIZE = 9;
const FOOTER_SIZE = 10;
const LINE_GAP = 3;
/** Width of the "12." gutter so numbered paragraphs hang neatly. */
const NUMBER_GUTTER = 28;
const MARGIN = 72;
/** Extra bottom margin reserved for the footer line. */
const FOOTER_RESERVE = 24;
const INK = '#111111';
const MUTED = '#555555';

type Doc = InstanceType<typeof PDFDocument>;

function contentWidth(doc: Doc): number {
  return doc.page.width - doc.page.margins.left - doc.page.margins.right;
}

function maxY(doc: Doc): number {
  return doc.page.height - doc.page.margins.bottom;
}

/** The oath officer as a person reads it; the block carries the profile's enum. */
const OFFICER_LABEL: Record<string, string> = {
  notary: 'To be sworn or affirmed before a Notary Public.',
  commissioner_for_oaths: 'To be sworn or affirmed before a Commissioner for Taking Oaths.',
  either: 'To be sworn or affirmed before a Notary Public or a Commissioner for Taking Oaths.',
};
const officerLabel = (o: string): string => OFFICER_LABEL[o] ?? o;

function ensureSpace(doc: Doc, height: number): void {
  if (doc.y + height > maxY(doc)) doc.addPage();
}

function body(doc: Doc): Doc {
  return doc.font(FONT).fontSize(BODY_SIZE).fillColor(INK);
}

function rule(doc: Doc, width: number): void {
  ensureSpace(doc, 18);
  const x = doc.page.margins.left;
  const y = doc.y + BODY_SIZE;
  doc.strokeColor(INK).lineWidth(0.75).moveTo(x, y).lineTo(x + width, y).stroke();
  doc.y = y + 4;
}

function drawBanner(doc: Doc, tree: DocumentTree): void {
  doc.font(FONT_ITALIC).fontSize(FOOTER_SIZE).fillColor(MUTED).text(tree.framing.draftNotice, { align: 'center' });
  if (tree.framing.officialForms) {
    doc.font(FONT).fontSize(FOOTER_SIZE).fillColor(MUTED).text(`${tree.framing.officialForms.name}: ${tree.framing.officialForms.url}`, {
      align: 'center',
      link: tree.framing.officialForms.url,
    });
  }
  const y = doc.y + 2;
  doc.strokeColor(MUTED).lineWidth(0.5).moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y).stroke();
  doc.y = y + 14;
  body(doc);
}

function drawCaption(doc: Doc, tree: DocumentTree): void {
  const { caption } = tree;
  const width = contentWidth(doc);
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;

  // File number, top right, before the court name (Form 8 / most US forms).
  body(doc);
  const fileLabel = `${caption.fileNumberLabel} `;
  const fileY = doc.y;
  if (caption.fileNumber !== undefined) {
    doc.text(`${fileLabel}${caption.fileNumber}`, left, fileY, { width, align: 'right' });
  } else {
    const ruleWidth = 130;
    const labelWidth = doc.widthOfString(fileLabel);
    const x = right - ruleWidth - labelWidth;
    doc.text(fileLabel, x, fileY, { lineBreak: false });
    doc.strokeColor(INK).lineWidth(0.75).moveTo(x + labelWidth, fileY + BODY_SIZE).lineTo(right, fileY + BODY_SIZE).stroke();
    doc.x = left;
    doc.y = fileY + BODY_SIZE + 4;
  }
  doc.moveDown(0.6);

  // Court name, centred.
  doc.font(FONT_BOLD).fontSize(BODY_SIZE).fillColor(INK);
  for (const line of caption.courtLines) doc.text(line, left, doc.y, { align: 'center', width });
  doc.moveDown(1);

  // Style of cause: name on the left, role on the right, the joining word centred between.
  const p = caption.parties;
  const roleWidth = 110;
  const nameWidth = width - roleWidth - 24;
  const party = (name: string | undefined, role: string) => {
    ensureSpace(doc, 40);
    const y = doc.y;
    body(doc);
    if (name !== undefined) doc.text(name, left, y, { width: nameWidth, lineBreak: false });
    else doc.strokeColor(INK).lineWidth(0.75).moveTo(left, y + BODY_SIZE).lineTo(left + nameWidth * 0.8, y + BODY_SIZE).stroke();
    doc.font(FONT_ITALIC).fontSize(BODY_SIZE).text(role, right - roleWidth, y, { width: roleWidth, align: 'right', lineBreak: false });
    doc.x = left;
    doc.y = y + BODY_SIZE + 6;
  };
  party(p.selfName, p.selfLabel);
  doc.font(FONT).fontSize(BODY_SIZE).fillColor(INK).text(p.versus, left, doc.y, { width, align: 'center' });
  doc.moveDown(0.3);
  party(p.otherName, p.otherLabel);
  doc.moveDown(0.8);

  // Title, centred, ruled above and below.
  const ruleY = doc.y;
  doc.strokeColor(INK).lineWidth(0.75).moveTo(left, ruleY).lineTo(right, ruleY).stroke();
  doc.y = ruleY + 8;
  doc.font(FONT_BOLD).fontSize(13).text(caption.title.toUpperCase(), left, doc.y, { align: 'center', width, characterSpacing: 0.5 });
  const under = doc.y + 6;
  doc.strokeColor(INK).lineWidth(0.75).moveTo(left, under).lineTo(right, under).stroke();
  doc.y = under + 16;
  body(doc);
}

function drawBlock(doc: Doc, block: Block, numbering: { next: number }): void {
  const width = contentWidth(doc);
  switch (block.kind) {
    case 'heading': {
      ensureSpace(doc, 60);
      doc.moveDown(0.4);
      if (block.level === 1) doc.font(FONT_BOLD).fontSize(14).text(block.text.toUpperCase(), { align: 'center', width, characterSpacing: 0.5 });
      else if (block.level === 2) doc.font(FONT_BOLD).fontSize(BODY_SIZE).text(block.text.toUpperCase(), { width, characterSpacing: 0.3 });
      else doc.font(FONT_BOLD_ITALIC).fontSize(BODY_SIZE).text(block.text, { width });
      doc.moveDown(0.4);
      body(doc);
      return;
    }
    case 'paragraph': {
      if (!block.numbered) {
        body(doc).text(block.text, { width, align: 'justify', lineGap: LINE_GAP });
        doc.moveDown(0.7);
        return;
      }
      // Hanging indent: the number sits in a gutter, the text wraps flush.
      ensureSpace(doc, 36);
      const n = `${numbering.next++}.`;
      const x = doc.page.margins.left;
      const y = doc.y;
      body(doc).text(n, x, y, { width: NUMBER_GUTTER, lineBreak: false });
      doc.text(block.text, x + NUMBER_GUTTER, y, { width: width - NUMBER_GUTTER, align: 'justify', lineGap: LINE_GAP });
      doc.x = x;
      doc.moveDown(0.7);
      return;
    }
    case 'blank': {
      // The draft note that explains what belongs here is for the review
      // pane (tree.blanks), not the document. With a sentence, the blank is a
      // numbered pleading paragraph whose gap is an underlined space.
      if (block.sentence) {
        ensureSpace(doc, 40);
        const n = `${numbering.next++}.`;
        const x0 = doc.page.margins.left;
        const y0 = doc.y;
        body(doc).text(n, x0, y0, { width: NUMBER_GUTTER, lineBreak: false });
        // Draw the sentence as runs: plain text, then an underlined run of
        // spaces for each gap, with `continued` so it wraps as one paragraph.
        const parts = block.sentence.split('___');
        const gap = '\u00a0'.repeat(26);
        doc.x = x0 + NUMBER_GUTTER;
        doc.y = y0;
        parts.forEach((part, i) => {
          const last = i === parts.length - 1;
          if (part.length > 0) doc.text(part, { width: width - NUMBER_GUTTER, align: 'left', lineGap: LINE_GAP, continued: !last || false, underline: false });
          if (!last) doc.text(gap, { width: width - NUMBER_GUTTER, lineGap: LINE_GAP, continued: true, underline: true });
        });
        if (parts[parts.length - 1].length === 0) doc.text('', { continued: false });
        doc.x = x0;
        doc.moveDown(0.7);
        return;
      }
      ensureSpace(doc, 40);
      const x = doc.page.margins.left;
      const label = block.label ? `${block.label}: ` : '';
      const y = doc.y;
      body(doc);
      if (label) doc.text(label, x, y, { lineBreak: false });
      const labelWidth = label ? doc.widthOfString(label) : 0;
      const lineEnd = Math.min(x + width, x + labelWidth + 260);
      doc.strokeColor(INK).lineWidth(0.75).moveTo(x + labelWidth, y + BODY_SIZE).lineTo(lineEnd, y + BODY_SIZE).stroke();
      doc.x = x;
      doc.y = y + BODY_SIZE + 4;
      doc.moveDown(0.7);
      return;
    }
    case 'list': {
      body(doc);
      // Keep a short list on one page.
      if (block.items.length <= 6) ensureSpace(doc, 20 * block.items.length + 12);
      const x = doc.page.margins.left + NUMBER_GUTTER;
      block.items.forEach((item, i) => {
        ensureSpace(doc, 24);
        const marker = block.ordered ? `(${String.fromCharCode(97 + i)})` : '•';
        const y = doc.y;
        doc.text(marker, x, y, { width: NUMBER_GUTTER, lineBreak: false });
        doc.text(item, x + NUMBER_GUTTER, y, { width: width - 2 * NUMBER_GUTTER, align: 'justify', lineGap: LINE_GAP });
        doc.moveDown(0.25);
      });
      doc.x = doc.page.margins.left;
      doc.moveDown(0.6);
      return;
    }
    case 'signature': {
      // Keep the signature with the jurat that follows it: never orphan the oath.
      ensureSpace(doc, 200);
      doc.y += 20;
      rule(doc, 250);
      body(doc).text(block.label, { width });
      doc.moveDown(0.8);
      return;
    }
    case 'jurat': {
      ensureSpace(doc, 80);
      body(doc).text(block.text, { width });
      if (block.officer) doc.font(FONT_ITALIC).fontSize(NOTE_SIZE).fillColor(MUTED).text(officerLabel(block.officer), { width });
      if (block.citations.length > 0) doc.font(FONT).fontSize(NOTE_SIZE).fillColor(MUTED).text(block.citations.join('; '), { width });
      doc.moveDown(0.8);
      body(doc);
      return;
    }
    case 'note': {
      // Draft notes ("Draft — …") belong to the review pane; other notes are
      // document text (e.g. the alternative-ground explanation) and print.
      if (block.text.startsWith('Draft — ')) return;
      doc.font(FONT_ITALIC).fontSize(FOOTER_SIZE).fillColor(MUTED).text(block.text, { width });
      doc.moveDown(0.6);
      body(doc);
      return;
    }
    default:
      return;
  }
}

function drawFooters(doc: Doc, options: RenderOptions): void {
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    const label = `Page ${i - range.start + 1} of ${range.count}` + (options.footerBrand ? ` • ${options.footerBrand}` : '');
    // Writing inside the bottom margin must not trigger a new page: lift the margin for the stamp.
    const savedBottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc.font(FONT).fontSize(FOOTER_SIZE).fillColor(MUTED).text(label, doc.page.margins.left, doc.page.height - 40, {
      width: contentWidth(doc),
      align: 'center',
      lineBreak: false,
    });
    doc.page.margins.bottom = savedBottom;
  }
}

export function renderPdf(tree: DocumentTree, options: RenderOptions = {}): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: tree.paper === 'a4' ? 'A4' : 'LETTER',
      margins: { top: MARGIN, bottom: MARGIN + FOOTER_RESERVE, left: MARGIN, right: MARGIN },
      bufferPages: true,
      info: { Title: tree.caption.title },
    });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    try {
      body(doc);
      if (options.draftBanner) drawBanner(doc, tree);
      drawCaption(doc, tree);

      const numbering = { next: 1 };
      for (const section of tree.sections) {
        if (section.title && !sectionHasHeading(section)) {
          // A short section (heading, lead sentence, a few list items or a
          // signature and jurat) stays on one page rather than splitting
          // after its heading.
          const short = section.blocks.length <= 4 && section.blocks.every((b) => b.kind !== 'paragraph' || b.text.length < 400);
          ensureSpace(doc, short ? 180 : 60);
          doc.moveDown(0.4);
          doc.font(FONT_BOLD).fontSize(BODY_SIZE).text(section.title.toUpperCase(), doc.page.margins.left, doc.y, { width: contentWidth(doc), characterSpacing: 0.3 });
          doc.moveDown(0.4);
          body(doc);
        }
        for (const block of section.blocks) {
          if (section.id === 'caption' && block.kind === 'blank' && block.field === 'caseNumber') continue; // drawn in the caption row
          drawBlock(doc, block, numbering);
        }
      }

      drawFooters(doc, options);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
