// Minimal ambient types for pdfkit — only the surface lib/marketplace/pdf.ts
// uses. pdfkit ships no bundled types and we avoid adding @types/pdfkit (and an
// install) for this small footprint. The legacy services/pdfService.js uses
// require() (untyped via allowJs), so this only needs to satisfy the TS caller.
declare module 'pdfkit' {
  interface PDFDocumentOptions {
    size?: string;
    margins?: { top: number; bottom: number; left: number; right: number };
  }

  class PDFDocument {
    constructor(options?: PDFDocumentOptions);
    font(name: string): this;
    fontSize(size: number): this;
    text(text: string, options?: { align?: string; lineGap?: number }): this;
    moveDown(lines?: number): this;
    on(event: 'data', listener: (chunk: Buffer) => void): this;
    on(event: 'end', listener: () => void): this;
    on(event: 'error', listener: (err: Error) => void): this;
    end(): void;
  }

  export = PDFDocument;
}
