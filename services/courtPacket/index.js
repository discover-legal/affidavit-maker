// services/courtPacket/index.js
/**
 * Case-packet assembler.
 *
 * Merges a generated main document PDF plus the user's uploaded evidence
 * into ONE organized draft PDF:
 *
 *   1. Cover sheet — "CASE PACKET", parties, where-to-file court block
 *      (Utah county → district court via ./utahCourts), plain-language
 *      checklist, information-not-advice line.
 *   2. Table of contents — main document + each exhibit with its page
 *      number in the final packet (page numbers computed up front from
 *      known page counts, so layout is single-pass and deterministic).
 *   3. The main document (pdf-lib copyPages).
 *   4. Per evidence item: an exhibit separator page ("EXHIBIT A" +
 *      original filename + label), then the content — PDFs merged via
 *      copyPages, PNG/JPEG embedded full-page (fit within margins,
 *      aspect preserved), anything else a print-separately placeholder.
 *   5. Final exhibit index (letter → description → original filename).
 *
 * Standard fonts only (no font files); Letter-size pages for the pages we
 * synthesize (merged pages keep their own size). Sparse-safe: no evidence
 * → cover + TOC + main document only; unknown county → generic court block.
 */

const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const { lookupCourt, LOCATOR_URL } = require('./utahCourts');

// ── Layout constants (US Letter, 1" margins) ────────────────────────────────
const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 72;
const CONTENT_WIDTH = PAGE_WIDTH - 2 * MARGIN;

// TOC page count must be known before drawing (its length shifts every page
// number after it), so TOC entries are single, truncated lines with a fixed
// per-page capacity. The exhibit index sits last, so it may flow freely.
const TOC_ENTRIES_PER_PAGE = 24;
const TOC_LINE_HEIGHT = 22;

const INK = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.35, 0.35, 0.35);

// Magic bytes — trust file content, not caller-supplied mime, when deciding
// whether a buffer can be merged/embedded (same defense as
// services/pdfService.appendExhibits).
const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF
const JPG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * Exhibit letter for a zero-based index: A…Z, then AA, AB… (bijective
 * base-26, like spreadsheet columns).
 */
function exhibitLetter(index) {
  let n = index + 1;
  let s = '';
  while (n > 0) {
    n -= 1;
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26);
  }
  return s;
}

/**
 * The standard 14 fonts use WinAnsi encoding; pdf-lib throws on characters
 * outside it. Replace anything unencodable with '?', keeping ASCII, Latin-1
 * and the common CP1252 punctuation (dashes, curly quotes, bullet, ellipsis).
 */
const CP1252_EXTRAS = new Set([
  0x2013, 0x2014, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2026, 0x20ac, 0x2122,
]);
function enc(value) {
  const text = String(value ?? '');
  let out = '';
  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (code === 0x0a || code === 0x0d || code === 0x09) {
      out += ' ';
    } else if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || CP1252_EXTRAS.has(code)) {
      out += ch;
    } else {
      out += '?';
    }
  }
  return out;
}

/** Greedy word wrap; always returns at least one line for non-empty text. */
function wrapLines(font, size, text, maxWidth) {
  const clean = enc(text).trim();
  if (!clean) return [];
  const words = clean.split(/\s+/);
  const lines = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Truncate to fit maxWidth, appending an ellipsis when cut. */
function truncateToWidth(font, size, text, maxWidth) {
  let clean = enc(text).trim();
  if (font.widthOfTextAtSize(clean, size) <= maxWidth) return clean;
  while (clean.length > 1 && font.widthOfTextAtSize(`${clean}…`, size) > maxWidth) {
    clean = clean.slice(0, -1);
  }
  return `${clean}…`;
}

function drawCentered(page, text, y, font, size, color = INK) {
  const clean = enc(text);
  const width = font.widthOfTextAtSize(clean, size);
  page.drawText(clean, { x: (PAGE_WIDTH - width) / 2, y, size, font, color });
}

/**
 * Draw a wrapped paragraph starting at `y` (baseline of first line).
 * Returns the y below the last drawn line.
 */
function drawParagraph(page, text, x, y, font, size, maxWidth, lineHeight, color = INK) {
  let cursor = y;
  for (const line of wrapLines(font, size, text, maxWidth)) {
    page.drawText(line, { x, y: cursor, size, font, color });
    cursor -= lineHeight;
  }
  return cursor;
}

/** Classify one evidence item by magic bytes (mime is only a hint). */
function classifyEvidence(item) {
  const buffer = item && Buffer.isBuffer(item.buffer) ? item.buffer : null;
  if (!buffer || buffer.length < 4) return 'placeholder';
  const head = buffer.subarray(0, 8);
  if (head.subarray(0, 4).equals(PDF_MAGIC)) return 'pdf';
  if (buffer.length >= 8 && head.equals(PNG_MAGIC)) return 'png';
  if (head.subarray(0, 3).equals(JPG_MAGIC)) return 'jpg';
  return 'placeholder';
}

/** Build the where-to-file lines for the cover sheet. */
function buildCourtBlockLines(state, county) {
  const stateCode = typeof state === 'string' ? state.trim().toUpperCase() : '';
  if (stateCode === 'UT') {
    const court = lookupCourt(county);
    if (court) {
      const lines = [
        court.courtName,
        `Judicial District ${court.district} — serving ${court.county} County, Utah`,
      ];
      if (Array.isArray(court.addressLines) && court.addressLines.length > 0) {
        lines.push(...court.addressLines);
      }
      lines.push(`Find the address and hours: ${court.locatorUrl}`);
      return lines;
    }
    // Utah, but no recognized county — generic Utah block.
    return [
      'File with the Utah District Court for the county where your case belongs',
      '(usually where you or the other party lives).',
      `Find your courthouse, its address and hours: ${LOCATOR_URL}`,
    ];
  }
  // Non-Utah / unknown jurisdiction — fully generic, jurisdiction-neutral
  // block (court naming and sub-jurisdiction vocabulary differ everywhere:
  // county vs. judicial district vs. registry, district/superior/circuit
  // court vs. Superior Court of Justice, etc. — so name none of them).
  return [
    'File with the trial court that handles cases like yours for the area where',
    'your case belongs — usually where you or the other party lives. The court',
    'office or clerk can confirm you are in the right place, tell you the exact',
    'court name, and explain the filing steps.',
  ];
}

const CHECKLIST_ITEMS = [
  'Bring the original plus at least 2 copies of this packet — courts generally keep the original and stamp your copy so you have proof of filing.',
  'Bring a government-issued photo ID.',
  'Bring the filing fee, or a completed fee-waiver motion if you cannot afford the fee.',
  'If any exhibit below is marked "print separately," print it and place it behind its exhibit cover page before filing.',
];

const DISCLAIMER =
  'This cover sheet is general information to help you get organized. It is not legal advice, ' +
  'and every court has its own requirements — please confirm copies, fees, and procedures with the court clerk.';

// ── Page builders ────────────────────────────────────────────────────────────

function drawCoverPage(page, fonts, opts) {
  const { documentTitles, parties, state, county, packetDate } = opts;
  let y = PAGE_HEIGHT - 130;

  drawCentered(page, 'CASE PACKET', y, fonts.bold, 28);
  y -= 40;

  // Every document in the packet is named on the cover (petition + decree +
  // …), not just the first.
  for (const docTitle of documentTitles || []) {
    for (const line of wrapLines(fonts.regular, 14, docTitle, CONTENT_WIDTH)) {
      drawCentered(page, line, y, fonts.regular, 14);
      y -= 20;
    }
  }

  const partyLines = (Array.isArray(parties) ? parties : parties ? [parties] : [])
    .map((p) => enc(p).trim())
    .filter(Boolean);
  if (partyLines.length > 0) {
    y -= 6;
    for (const line of partyLines) {
      drawCentered(page, truncateToWidth(fonts.regular, 12, line, CONTENT_WIDTH), y, fonts.regular, 12);
      y -= 17;
    }
  }

  drawCentered(page, `Prepared: ${enc(packetDate)}`, y - 4, fonts.italic, 10, MUTED);
  y -= 40;

  // Where to file
  page.drawText('WHERE TO FILE', { x: MARGIN, y, size: 13, font: fonts.bold, color: INK });
  y -= 20;
  for (const line of buildCourtBlockLines(state, county)) {
    y = drawParagraph(page, line, MARGIN, y, fonts.regular, 11, CONTENT_WIDTH, 15);
  }
  y -= 18;

  // Checklist
  page.drawText('BEFORE YOU GO — CHECKLIST', { x: MARGIN, y, size: 13, font: fonts.bold, color: INK });
  y -= 20;
  for (const item of CHECKLIST_ITEMS) {
    page.drawText('•', { x: MARGIN, y, size: 11, font: fonts.regular, color: INK });
    y = drawParagraph(page, item, MARGIN + 14, y, fonts.regular, 11, CONTENT_WIDTH - 14, 15);
    y -= 5;
  }

  // Information-not-advice line, pinned near the bottom.
  drawParagraph(page, DISCLAIMER, MARGIN, MARGIN + 24, fonts.italic, 9, CONTENT_WIDTH, 12, MUTED);
}

function drawTocPages(doc, fonts, tocEntries) {
  const pageCount = Math.max(1, Math.ceil(tocEntries.length / TOC_ENTRIES_PER_PAGE));
  for (let p = 0; p < pageCount; p += 1) {
    const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let y = PAGE_HEIGHT - 110;
    drawCentered(page, p === 0 ? 'TABLE OF CONTENTS' : 'TABLE OF CONTENTS (continued)', y, fonts.bold, 16);
    y -= 44;

    const slice = tocEntries.slice(p * TOC_ENTRIES_PER_PAGE, (p + 1) * TOC_ENTRIES_PER_PAGE);
    for (const entry of slice) {
      const pageLabel = String(entry.page);
      const pageLabelWidth = fonts.regular.widthOfTextAtSize(pageLabel, 12);
      const titleMax = CONTENT_WIDTH - pageLabelWidth - 24;
      const title = truncateToWidth(fonts.regular, 12, entry.title, titleMax);
      page.drawText(title, { x: MARGIN, y, size: 12, font: fonts.regular, color: INK });

      // Dot leader between title and page number.
      const titleWidth = fonts.regular.widthOfTextAtSize(title, 12);
      const dotsStart = MARGIN + titleWidth + 6;
      const dotsEnd = PAGE_WIDTH - MARGIN - pageLabelWidth - 6;
      if (dotsEnd > dotsStart) {
        const dotWidth = fonts.regular.widthOfTextAtSize('.', 12) + 2;
        const count = Math.floor((dotsEnd - dotsStart) / dotWidth);
        if (count > 0) {
          page.drawText('.'.repeat(count), { x: dotsStart, y, size: 12, font: fonts.regular, color: MUTED });
        }
      }
      page.drawText(pageLabel, {
        x: PAGE_WIDTH - MARGIN - pageLabelWidth,
        y,
        size: 12,
        font: fonts.regular,
        color: INK,
      });
      y -= TOC_LINE_HEIGHT;
    }
  }
  return pageCount;
}

function drawSeparatorPage(doc, fonts, exhibit) {
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const midY = PAGE_HEIGHT / 2;
  drawCentered(page, `EXHIBIT ${exhibit.letter}`, midY + 40, fonts.bold, 36);
  if (exhibit.originalName) {
    drawCentered(
      page,
      truncateToWidth(fonts.regular, 13, exhibit.originalName, CONTENT_WIDTH),
      midY - 6,
      fonts.regular,
      13,
    );
  }
  if (exhibit.label) {
    drawCentered(
      page,
      truncateToWidth(fonts.italic, 11, exhibit.label, CONTENT_WIDTH),
      midY - 28,
      fonts.italic,
      11,
      MUTED,
    );
  }
  return page;
}

function drawPlaceholderPage(doc, fonts, exhibit) {
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - 200;
  drawCentered(page, `EXHIBIT ${exhibit.letter} — PRINT SEPARATELY`, y, fonts.bold, 16);
  y -= 36;
  const name = exhibit.originalName || 'unnamed file';
  const type = exhibit.mime || 'unknown type';
  y = drawParagraph(
    page,
    `Exhibit ${exhibit.letter} is a file type that must be printed separately: ${name}, ${type}.`,
    MARGIN,
    y,
    fonts.regular,
    12,
    CONTENT_WIDTH,
    17,
  );
  y -= 10;
  drawParagraph(
    page,
    'Print that file on its own and place it directly behind this page before filing.',
    MARGIN,
    y,
    fonts.italic,
    11,
    CONTENT_WIDTH,
    15,
    MUTED,
  );
  return page;
}

async function drawImagePage(doc, item, kind) {
  // Embed BEFORE adding the page: if the image data is undecodable we throw
  // without having appended a page, so the caller's placeholder fallback
  // keeps the packet's page arithmetic intact.
  const image = kind === 'png' ? await doc.embedPng(item.buffer) : await doc.embedJpg(item.buffer);
  const page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  const maxW = CONTENT_WIDTH;
  const maxH = PAGE_HEIGHT - 2 * MARGIN;
  const scale = Math.min(maxW / image.width, maxH / image.height);
  const w = image.width * scale;
  const h = image.height * scale;
  page.drawImage(image, {
    x: (PAGE_WIDTH - w) / 2,
    y: (PAGE_HEIGHT - h) / 2,
    width: w,
    height: h,
  });
  return page;
}

function drawIndexPages(doc, fonts, exhibits) {
  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - 110;
  drawCentered(page, 'EXHIBIT INDEX', y, fonts.bold, 16);
  y -= 44;

  for (const exhibit of exhibits) {
    // New page when fewer than ~4 lines of room remain.
    if (y < MARGIN + 60) {
      page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - 110;
      drawCentered(page, 'EXHIBIT INDEX (continued)', y, fonts.bold, 16);
      y -= 44;
    }
    page.drawText(`Exhibit ${exhibit.letter}`, { x: MARGIN, y, size: 12, font: fonts.bold, color: INK });
    y -= 16;
    if (exhibit.label) {
      y = drawParagraph(page, exhibit.label, MARGIN + 18, y, fonts.regular, 11, CONTENT_WIDTH - 18, 15);
    }
    y = drawParagraph(
      page,
      `File: ${exhibit.originalName || 'unnamed file'}`,
      MARGIN + 18,
      y,
      fonts.regular,
      10,
      CONTENT_WIDTH - 18,
      14,
      MUTED,
    );
    y -= 10;
  }
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Assemble the case packet.
 *
 * @param {object} opts
 * @param {Array<{buffer: Buffer, title?: string}>} [opts.documents]
 *        The rendered documents of the package, in filing order (e.g.
 *        petition then decree). Every entry is included in the packet with
 *        its own cover/TOC title. Takes precedence over mainPdfBuffer.
 * @param {Buffer} [opts.mainPdfBuffer] - Single-document form (required when
 *        `documents` is not given).
 * @param {string} [opts.mainTitle] - Title for the single-document form.
 * @param {Array<{label?: string, originalName?: string, mime?: string, buffer?: Buffer|null}>} [opts.evidence]
 *        Uploaded evidence, in exhibit order. A missing/unreadable buffer or
 *        an unsupported type becomes a "print separately" placeholder page.
 * @param {string} [opts.state] - Two-letter jurisdiction code ('UT' enables the county court block).
 * @param {string} [opts.county] - County/district/court-location name for the where-to-file block.
 * @param {string} [opts.packetDate] - Display date; defaults to today (YYYY-MM-DD).
 * @param {string|string[]} [opts.parties] - Optional party line(s) for the cover.
 * @returns {Promise<Buffer>} The merged, organized draft PDF.
 */
async function assemblePacket(opts) {
  const {
    documents,
    mainPdfBuffer,
    mainTitle = 'Main Document',
    evidence = [],
    state,
    county,
    packetDate = new Date().toISOString().slice(0, 10),
    parties,
  } = opts || {};

  // Normalize to a document list; the historical single-document call shape
  // (mainPdfBuffer + mainTitle) is the one-element case.
  let docInputs;
  if (Array.isArray(documents) && documents.length > 0) {
    docInputs = documents.map((d, i) => ({
      buffer: d && d.buffer,
      title: (d && typeof d.title === 'string' && d.title.trim()) || `Document ${i + 1}`,
    }));
    for (const d of docInputs) {
      if (!Buffer.isBuffer(d.buffer) || !d.buffer.subarray(0, 4).equals(PDF_MAGIC)) {
        throw new Error('assemblePacket: every documents[] buffer must be a PDF buffer');
      }
    }
  } else {
    if (!Buffer.isBuffer(mainPdfBuffer) || !mainPdfBuffer.subarray(0, 4).equals(PDF_MAGIC)) {
      throw new Error('assemblePacket: mainPdfBuffer must be a PDF buffer');
    }
    docInputs = [{ buffer: mainPdfBuffer, title: mainTitle }];
  }

  const mainDocs = [];
  for (const d of docInputs) {
    const doc = await PDFDocument.load(d.buffer);
    mainDocs.push({ title: d.title, doc, pages: doc.getPageCount() });
  }

  // ── Pass 1 (planning): classify evidence + compute every page number ──────
  const exhibits = [];
  for (let i = 0; i < evidence.length; i += 1) {
    const item = evidence[i] || {};
    let kind = classifyEvidence(item);
    let srcDoc = null;
    let contentPages = 1; // image + placeholder both occupy one page
    if (kind === 'pdf') {
      try {
        srcDoc = await PDFDocument.load(item.buffer);
        contentPages = srcDoc.getPageCount();
        if (contentPages < 1 || contentPages > 500) {
          kind = 'placeholder';
          srcDoc = null;
          contentPages = 1;
        }
      } catch (err) {
        // Corrupt/encrypted PDF — degrade to the placeholder page.
        kind = 'placeholder';
        srcDoc = null;
        contentPages = 1;
      }
    }
    exhibits.push({
      letter: exhibitLetter(i),
      label: item.label || '',
      originalName: item.originalName || '',
      mime: item.mime || 'unknown type',
      buffer: Buffer.isBuffer(item.buffer) ? item.buffer : null,
      kind,
      srcDoc,
      contentPages,
    });
  }

  const tocEntryCount = mainDocs.length + exhibits.length;
  const tocPageCount = Math.max(1, Math.ceil(tocEntryCount / TOC_ENTRIES_PER_PAGE));

  let cursor = 1 /* cover */ + tocPageCount + 1;
  const tocEntries = [];
  for (const mainEntry of mainDocs) {
    tocEntries.push({ title: mainEntry.title, page: cursor });
    cursor += mainEntry.pages;
  }
  for (const exhibit of exhibits) {
    tocEntries.push({
      title: exhibit.label
        ? `Exhibit ${exhibit.letter} — ${exhibit.label}`
        : `Exhibit ${exhibit.letter}${exhibit.originalName ? ` — ${exhibit.originalName}` : ''}`,
      page: cursor, // the exhibit's separator page
    });
    cursor += 1 + exhibit.contentPages;
  }

  // ── Pass 2 (drawing): emit pages in final order ────────────────────────────
  const out = await PDFDocument.create();
  out.setTitle(enc(`Case Packet — ${mainDocs.map((d) => d.title).join('; ')}`));
  out.setProducer('Discover.Legal');
  const fonts = {
    regular: await out.embedFont(StandardFonts.TimesRoman),
    bold: await out.embedFont(StandardFonts.TimesRomanBold),
    italic: await out.embedFont(StandardFonts.TimesRomanItalic),
  };

  // 1. Cover
  const cover = out.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  drawCoverPage(cover, fonts, {
    documentTitles: mainDocs.map((d) => d.title),
    parties,
    state,
    county,
    packetDate,
  });

  // 2. TOC
  drawTocPages(out, fonts, tocEntries);

  // 3. The rendered documents, in filing order
  for (const mainEntry of mainDocs) {
    const copiedMain = await out.copyPages(mainEntry.doc, mainEntry.doc.getPageIndices());
    for (const page of copiedMain) out.addPage(page);
  }

  // 4. Exhibits (skipped entirely when there is no evidence)
  for (const exhibit of exhibits) {
    drawSeparatorPage(out, fonts, exhibit);
    if (exhibit.kind === 'pdf' && exhibit.srcDoc) {
      const pageIndices = exhibit.srcDoc.getPageIndices();
      if (pageIndices.length < 1 || pageIndices.length > 500) {
        drawPlaceholderPage(out, fonts, exhibit);
        continue;
      }
      const copied = await out.copyPages(exhibit.srcDoc, pageIndices);
      for (const page of copied) out.addPage(page);
    } else if (exhibit.kind === 'png' || exhibit.kind === 'jpg') {
      try {
        await drawImagePage(out, exhibit, exhibit.kind);
      } catch (err) {
        // Undecodable image data — fall back to the placeholder so the
        // packet still assembles. Page count stays 1 either way, so the
        // TOC numbers remain correct.
        drawPlaceholderPage(out, fonts, exhibit);
      }
    } else {
      drawPlaceholderPage(out, fonts, exhibit);
    }
  }

  // 5. Exhibit index
  if (exhibits.length > 0) {
    drawIndexPages(out, fonts, exhibits);
  }

  const bytes = await out.save();
  return Buffer.from(bytes);
}

module.exports = {
  assemblePacket,
  exhibitLetter,
};
