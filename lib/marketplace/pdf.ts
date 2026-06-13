/**
 * lib/marketplace/pdf.ts
 *
 * Minimal, generic PDF renderer for marketplace documents. The platform's
 * pdfService is hard-wired to affidavit schemas, so marketplace templates
 * (arbitrary lawyer-authored bodies) get this dedicated renderer: it lays out
 * the completed plain-text document into a clean, paginated US-Letter PDF.
 *
 * Returns a Buffer so Route Handlers can stream it with the right headers.
 */
import PDFDocument from 'pdfkit';

export function renderDocumentPdf(opts: { title: string; body: string }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'LETTER', margins: { top: 72, bottom: 72, left: 72, right: 72 } });
      const chunks: Buffer[] = [];
      doc.on('data', (c: Buffer) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.font('Times-Bold').fontSize(16).text(opts.title, { align: 'center' });
      doc.moveDown(1.5);

      doc.font('Times-Roman').fontSize(12);
      const paragraphs = opts.body.split(/\n{2,}/);
      paragraphs.forEach((para, i) => {
        // Preserve single newlines inside a paragraph as soft line breaks.
        doc.text(para.replace(/\n/g, '\n'), { align: 'left', lineGap: 2 });
        if (i < paragraphs.length - 1) doc.moveDown(0.8);
      });

      doc.end();
    } catch (err) {
      reject(err as Error);
    }
  });
}
