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
  doc.font(FONT_BOLD).fontSize(BODY_SIZE).fillColor(INK);
  for (const line of caption.courtLines) doc.text(line, { align: 'center', width });
  doc.moveDown(0.75);

  body(doc);
  if (caption.fileNumber !== undefined) {
    doc.text(`${caption.fileNumberLabel} ${caption.fileNumber}`, { align: 'right', width });
  } else {
    // Absent file number → drawn as a blank, never as a placeholder string.
    const label = `${caption.fileNumberLabel} `;
    const ruleWidth = 120;
    const labelWidth = doc.widthOfString(label);
    const x = doc.page.width - doc.page.margins.right - ruleWidth - labelWidth;
    const y = doc.y;
    doc.text(label, x, y, { lineBreak: false });
    doc.strokeColor(INK).lineWidth(0.75).moveTo(x + labelWidth, y + BODY_SIZE).lineTo(x + labelWidth + ruleWidth, y + BODY_SIZE).stroke();
    doc.x = doc.page.margins.left;
    doc.y = y + BODY_SIZE + 4;
  }
  doc.moveDown(0.75);

  const p = caption.parties;
  const selfLine = p.selfName !== undefined ? `${p.selfName}, ${p.selfLabel}` : undefined;
  if (selfLine) doc.text(selfLine, { width });
  else {
    rule(doc, 220);
    doc.text(p.selfLabel, { width });
  }
  doc.text(p.versus, { width, indent: 36 });
  const otherLine = p.otherName !== undefined ? `${p.otherName}, ${p.otherLabel}` : undefined;
  if (otherLine) doc.text(otherLine, { width });
  else {
    rule(doc, 220);
    doc.text(p.otherLabel, { width });
  }
  doc.moveDown(1);

  doc.font(FONT_BOLD).fontSize(BODY_SIZE).text(caption.title, { align: 'center', width });
  doc.moveDown(1);
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
      ensureSpace(doc, 56);
      const x = doc.page.margins.left;
      if (block.label) body(doc).text(`${block.label}:`, x, doc.y, { width, lineGap: LINE_GAP });
      rule(doc, Math.min(width, 320));
      doc.font(FONT_ITALIC).fontSize(NOTE_SIZE).fillColor(MUTED).text(block.note, x, doc.y, { width, lineGap: 1 });
      doc.moveDown(1);
      body(doc);
      return;
    }
    case 'list': {
      body(doc);
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
          ensureSpace(doc, 60);
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
