/**
 * Minimal ambient typing for pdfkit (no @types/pdfkit in the tree). Only the
 * surface core/render/pdf.ts uses is declared.
 */
declare module 'pdfkit' {
  import type { Readable } from 'stream';

  interface PDFMargins {
    top: number;
    bottom: number;
    left: number;
    right: number;
  }

  interface PDFDocumentOptions {
    size?: string | [number, number];
    margins?: PDFMargins;
    bufferPages?: boolean;
    compress?: boolean;
    info?: Record<string, string | Date>;
  }

  interface PDFTextOptions {
    align?: 'left' | 'center' | 'right' | 'justify';
    width?: number;
    indent?: number;
    lineBreak?: boolean;
    link?: string;
    underline?: boolean;
    continued?: boolean;
    paragraphGap?: number;
    lineGap?: number;
    characterSpacing?: number;
  }

  class PDFDocument extends Readable {
    constructor(options?: PDFDocumentOptions);
    page: { width: number; height: number; margins: PDFMargins };
    x: number;
    y: number;
    font(name: string): this;
    fontSize(size: number): this;
    fillColor(color: string): this;
    strokeColor(color: string): this;
    lineWidth(width: number): this;
    text(text: string, x: number, y: number, options?: PDFTextOptions): this;
    text(text: string, options?: PDFTextOptions): this;
    moveDown(lines?: number): this;
    addPage(): this;
    moveTo(x: number, y: number): this;
    lineTo(x: number, y: number): this;
    stroke(): this;
    widthOfString(text: string, options?: PDFTextOptions): number;
    heightOfString(text: string, options?: PDFTextOptions): number;
    bufferedPageRange(): { start: number; count: number };
    switchToPage(page: number): void;
    end(): void;
  }

  export = PDFDocument;
}
