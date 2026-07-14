/** @jest-environment node */
// Tests for the filing-packet assembler (services/courtPacket) and the Utah
// district-court lookup. Input PDFs are built in-memory with pdf-lib itself;
// assertions use page-count arithmetic plus raw-byte text search (pdf-lib
// writes drawText strings as hex-encoded WinAnsi, which for ASCII is just
// the ASCII hex — searchable without a text extractor).

const { PDFDocument } = require('pdf-lib');
const { assemblePacket, exhibitLetter } = require('../../services/courtPacket');
const {
  lookupCourt,
  COUNTY_TO_DISTRICT,
  LOCATOR_URL,
} = require('../../services/courtPacket/utahCourts');

// 1x1 red PNG.
const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

/** Build an in-memory PDF with `pages` blank Letter pages. */
async function makePdf(pages) {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i += 1) doc.addPage([612, 792]);
  return Buffer.from(await doc.save());
}

async function pageCount(buffer) {
  const doc = await PDFDocument.load(buffer);
  return doc.getPageCount();
}

/**
 * Simple text extraction: pdf-lib flate-compresses content streams and emits
 * drawText strings hex-encoded in WinAnsi (ASCII bytes for ASCII text).
 * Inflate every stream in the file and search both the raw and inflated
 * bytes for the literal text and for its hex encoding.
 */
function containsText(pdfBuffer, text) {
  const zlib = require('zlib');
  const raw = pdfBuffer.toString('latin1');
  const chunks = [raw];
  const streamRe = /stream\r?\n/g;
  let match;
  while ((match = streamRe.exec(raw)) !== null) {
    const start = match.index + match[0].length;
    const end = raw.indexOf('endstream', start);
    if (end === -1) continue;
    const slice = pdfBuffer.subarray(start, end);
    try {
      chunks.push(zlib.inflateSync(slice).toString('latin1'));
    } catch {
      /* not a flate stream — raw slice is already covered by `raw` */
    }
  }
  const hex = Buffer.from(text, 'latin1').toString('hex').toUpperCase();
  return chunks.some(
    (chunk) => chunk.includes(text) || chunk.toUpperCase().includes(hex),
  );
}

describe('exhibitLetter', () => {
  it('produces A..Z then AA, AB, …', () => {
    expect(exhibitLetter(0)).toBe('A');
    expect(exhibitLetter(1)).toBe('B');
    expect(exhibitLetter(25)).toBe('Z');
    expect(exhibitLetter(26)).toBe('AA');
    expect(exhibitLetter(27)).toBe('AB');
    expect(exhibitLetter(51)).toBe('AZ');
    expect(exhibitLetter(52)).toBe('BA');
    expect(exhibitLetter(701)).toBe('ZZ');
    expect(exhibitLetter(702)).toBe('AAA');
  });
});

describe('utahCourts.lookupCourt', () => {
  it('maps Salt Lake to the Third District Court', () => {
    const court = lookupCourt('Salt Lake');
    expect(court).toEqual(
      expect.objectContaining({
        district: 3,
        courtName: 'Third District Court — Salt Lake County',
        locatorUrl: LOCATOR_URL,
      }),
    );
  });

  it('normalizes casing and a trailing "County"', () => {
    expect(lookupCourt('  salt lake county ')).toMatchObject({ district: 3 });
    expect(lookupCourt('UTAH')).toMatchObject({
      district: 4,
      courtName: 'Fourth District Court — Utah County',
    });
    expect(lookupCourt('San Juan County')).toMatchObject({ district: 7 });
  });

  it('returns null for unknown counties and junk input', () => {
    expect(lookupCourt('Los Angeles')).toBeNull();
    expect(lookupCourt('')).toBeNull();
    expect(lookupCourt(undefined)).toBeNull();
    expect(lookupCourt(42)).toBeNull();
  });

  it('covers all 29 Utah counties across districts 1-8', () => {
    const counties = Object.keys(COUNTY_TO_DISTRICT);
    expect(counties).toHaveLength(29);
    for (const county of counties) {
      const court = lookupCourt(county);
      expect(court).not.toBeNull();
      expect(court.district).toBeGreaterThanOrEqual(1);
      expect(court.district).toBeLessThanOrEqual(8);
      expect(court.courtName).toMatch(/District Court — .+ County$/);
    }
  });

  it('never fabricates street addresses (locator fallback in effect)', () => {
    // Addresses were not fetchable from utcourts.gov in this environment;
    // the contract is: no addressLines, locatorUrl always present.
    for (const county of Object.keys(COUNTY_TO_DISTRICT)) {
      const court = lookupCourt(county);
      expect(court.addressLines).toBeUndefined();
      expect(court.locatorUrl).toBe(LOCATOR_URL);
    }
  });
});

describe('assemblePacket', () => {
  it('rejects a non-PDF main buffer', async () => {
    await expect(
      assemblePacket({ mainPdfBuffer: Buffer.from('not a pdf') }),
    ).rejects.toThrow(/mainPdfBuffer/);
  });

  it('assembles a no-evidence packet: cover + TOC + main, no exhibit machinery', async () => {
    const main = await makePdf(2);
    const packet = await assemblePacket({
      mainPdfBuffer: main,
      mainTitle: 'Affidavit of Jane Example',
      state: 'UT',
      county: 'Salt Lake',
      packetDate: '2026-07-11',
    });

    expect(packet.subarray(0, 4).toString('latin1')).toBe('%PDF');
    // 1 cover + 1 TOC + 2 main = 4. No separators, no exhibit index.
    expect(await pageCount(packet)).toBe(4);
    expect(containsText(packet, 'FILING PACKET')).toBe(true);
    expect(containsText(packet, 'TABLE OF CONTENTS')).toBe(true);
    expect(containsText(packet, 'Third District Court')).toBe(true);
    expect(containsText(packet, 'EXHIBIT INDEX')).toBe(false);
  });

  it('merges PDF exhibits, embeds a PNG, and placeholders unknown types with correct page arithmetic', async () => {
    const main = await makePdf(2);
    const exhibitPdf = await makePdf(3);

    const packet = await assemblePacket({
      mainPdfBuffer: main,
      mainTitle: 'Affidavit of Jane Example',
      state: 'UT',
      county: 'Utah',
      packetDate: '2026-07-11',
      parties: ['Petitioner: Jane Example', 'Respondent: John Example'],
      evidence: [
        { label: 'Lease agreement', originalName: 'lease.pdf', mime: 'application/pdf', buffer: exhibitPdf },
        { label: 'Photo of damage', originalName: 'photo.png', mime: 'image/png', buffer: TINY_PNG },
        { label: 'Voicemail audio', originalName: 'voicemail.mp3', mime: 'audio/mpeg', buffer: Buffer.from('ID3 not a doc') },
      ],
    });

    // cover(1) + toc(1) + main(2)
    //   + [sep(1) + pdf(3)] + [sep(1) + png(1)] + [sep(1) + placeholder(1)]
    //   + index(1) = 13
    expect(await pageCount(packet)).toBe(13);
    expect(containsText(packet, 'EXHIBIT A')).toBe(true);
    expect(containsText(packet, 'EXHIBIT B')).toBe(true);
    expect(containsText(packet, 'EXHIBIT C')).toBe(true);
    expect(containsText(packet, 'EXHIBIT INDEX')).toBe(true);
    expect(containsText(packet, 'PRINT SEPARATELY')).toBe(true);
    expect(containsText(packet, 'voicemail.mp3')).toBe(true);
    expect(containsText(packet, 'Fourth District Court')).toBe(true);
  });

  it('embeds a PNG image exhibit on exactly one page', async () => {
    const main = await makePdf(1);
    const packet = await assemblePacket({
      mainPdfBuffer: main,
      mainTitle: 'Doc',
      evidence: [{ label: 'photo', originalName: 'p.png', mime: 'image/png', buffer: TINY_PNG }],
    });
    // cover + toc + main(1) + sep + image + index = 6
    expect(await pageCount(packet)).toBe(6);
    // The image page carries an XObject image resource.
    expect(packet.toString('latin1')).toContain('/Image');
  });

  it('substitutes a placeholder for a missing buffer and a corrupt PDF', async () => {
    const main = await makePdf(1);
    const corruptPdf = Buffer.concat([
      Buffer.from('%PDF-1.7 '),
      Buffer.from('garbage garbage garbage'),
    ]);
    const packet = await assemblePacket({
      mainPdfBuffer: main,
      mainTitle: 'Doc',
      evidence: [
        { label: 'unreadable', originalName: 'gone.pdf', mime: 'application/pdf', buffer: null },
        { label: 'corrupt', originalName: 'bad.pdf', mime: 'application/pdf', buffer: corruptPdf },
      ],
    });
    // cover + toc + main(1) + 2 * [sep + placeholder] + index = 8
    expect(await pageCount(packet)).toBe(8);
    expect(containsText(packet, 'PRINT SEPARATELY')).toBe(true);
  });

  it('letters exhibits past Z (27 exhibits reaches AA)', async () => {
    const main = await makePdf(1);
    const evidence = [];
    for (let i = 0; i < 27; i += 1) {
      evidence.push({
        label: `Item ${i + 1}`,
        originalName: `file-${i + 1}.bin`,
        mime: 'application/octet-stream',
        buffer: Buffer.from('binary'),
      });
    }
    const packet = await assemblePacket({ mainPdfBuffer: main, mainTitle: 'Doc', evidence });

    // cover(1) + toc(2: 28 entries at 24/page) + main(1)
    //   + 27 * [sep(1) + placeholder(1)] + index(>=1)
    const pages = await pageCount(packet);
    expect(pages).toBeGreaterThanOrEqual(1 + 2 + 1 + 54 + 1);
    expect(containsText(packet, 'EXHIBIT AA')).toBe(true);
    expect(containsText(packet, 'TABLE OF CONTENTS (continued)')).toBe(true);
  });

  it('renders a generic court block when the county is missing or unknown', async () => {
    const main = await makePdf(1);
    const utNoCounty = await assemblePacket({
      mainPdfBuffer: main,
      mainTitle: 'Doc',
      state: 'UT',
    });
    expect(containsText(utNoCounty, 'Utah District Court')).toBe(true);
    expect(containsText(utNoCounty, 'utcourts.gov')).toBe(true);

    const otherState = await assemblePacket({
      mainPdfBuffer: main,
      mainTitle: 'Doc',
      state: 'TX',
      county: 'Travis',
    });
    expect(containsText(otherState, 'trial court')).toBe(true);
    expect(containsText(otherState, 'utcourts.gov')).toBe(false);
  });

  it('sanitizes non-WinAnsi characters instead of throwing', async () => {
    const main = await makePdf(1);
    const packet = await assemblePacket({
      mainPdfBuffer: main,
      mainTitle: 'Declaración de Hechos — 宣誓供述書',
      evidence: [
        { label: 'снимок экрана', originalName: '截图.png', mime: 'image/png', buffer: TINY_PNG },
      ],
    });
    expect(packet.subarray(0, 4).toString('latin1')).toBe('%PDF');
    expect(await pageCount(packet)).toBe(6);
  });
});
