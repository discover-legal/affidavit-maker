// services/pdfService.js - TWO-PASS APPROACH
// Pass 1: Render all content (know total pages)
// Pass 2: Add footers with correct page numbers
// Supports: affidavits, divorce petitions, divorce decrees, + Word (.docx)

const PDFDocument = require('pdfkit');
const fs = require('fs').promises;
const fssync = require('fs');
const path = require('path');
const previewRenderer = require('./previewRenderer');
const { prepareFactsForDisplay, isEvidence, evidenceHasFile, getEvidenceItems } = require('../utils/factNormalizer');
const { validatePath } = require('../utils/pathSecurity');
const { PDFDocument: PDFLib } = require('pdf-lib');
const docx = require('docx');
const logger = require('../utils/logger');

// International jurisdictions that use A4 paper (non-US/CA)
const A4_JURISDICTIONS = new Set([
  'ENG', 'SCO', 'NIR', 'IRL',
  'NSW', 'VIC', 'QLD', 'WA_AU', 'SA_AU', 'TAS', 'ACT', 'NT_AU',
  'NZ', 'SG', 'HK',
  'ZA', 'KE', 'GH',
  'LA_NG', 'FC', 'RV', 'CR', 'ED', 'DT', 'OY', 'OG', 'AN', 'EN', 'IM', 'AB_NG',
  'IN_DL', 'IN_MH', 'IN_KA', 'IN_TN', 'IN_GJ', 'IN_UP', 'IN_WB', 'IN_TS',
  'IN_RJ', 'IN_KL', 'IN_PB', 'IN_HR', 'IN_MP', 'IN_BR', 'IN_OD', 'IN_AP',
]);

/**
 * PDF and Word document generation service for legal documents.
 *
 * Generates affidavits, divorce petitions, and divorce decrees using a
 * two-pass PDF rendering approach (pass 1 counts pages, pass 2 adds
 * footers with accurate page numbers). Also supports Word (.docx) export.
 *
 * Thread-safe: all mutable render state is held in a per-call
 * `renderContext` object rather than on `this`, so concurrent calls to
 * `generatePDF` do not interfere with each other.
 */
class PDFService {
  /**
   * @param {object} [options]
   * @param {object} [options.templateManager] - StateTemplateManager instance
   *   used to look up jurisdiction-specific exhibit rules. May be null.
   */
  constructor(options = {}) {
    this.templateManager = options.templateManager || null;
    this.defaultOptions = {
      size: 'letter',
      margins: { top: 72, bottom: 72, left: 72, right: 72 },
      font: 'Times-Roman',
      fontSize: 12,
      bufferPages: true  // CRITICAL: Required for switchToPage() and bufferedPageRange()
    };

    // A4 options for international jurisdictions (all non-US/CA)
    this.a4Options = {
      size: 'A4',  // 595.28 x 841.89 points (210mm x 297mm)
      margins: { top: 72, bottom: 72, left: 72, right: 72 },
      font: 'Times-Roman',
      fontSize: 12,
      bufferPages: true
    };

    // Footer configuration (immutable)
    this.FOOTER_FONT_SIZE = 10;
    this.FOOTER_HEIGHT = 15;
    this.FOOTER_BOTTOM_MARGIN = 36;
    this.MIN_CONTENT_FOOTER_GAP = 10; // Reduced from 20 to allow more content per page
  }

  /**
   * Create a fresh render context that holds all mutable state for a single
   * PDF generation call. Passed through every render method so that
   * concurrent `generatePDF` calls do not share state.
   *
   * @param {number} pageHeight - Total page height in points (792 for Letter, 841.89 for A4).
   * @returns {{ currentPage: number, totalPages: number, shouldAddFooters: boolean, addingFooter: boolean, EFFECTIVE_PAGE_HEIGHT: number }}
   */
  _createRenderContext(pageHeight) {
    return {
      currentPage: 1,
      totalPages: 0,
      shouldAddFooters: false,
      addingFooter: false,
      // Maximum Y coordinate before a page break is needed.
      // Formula: pageHeight - footer reserves = max Y coordinate
      EFFECTIVE_PAGE_HEIGHT: pageHeight - this.FOOTER_BOTTOM_MARGIN - this.FOOTER_HEIGHT - this.MIN_CONTENT_FOOTER_GAP,
    };
  }

  /**
   * Detect document type from sections shape.
   *
   * @param {object} document - The document object with `sections`, `documentType`, and/or `metadata`.
   * @returns {'petition'|'decree'|'affidavit'} The detected document type.
   */
  detectDocumentType(document) {
    const { sections, documentType } = document;
    // Explicit type from template
    if (documentType === 'divorce_petition' || documentType === 'petition') return 'petition';
    if (documentType === 'divorce_decree' || documentType === 'decree') return 'decree';
    if (documentType === 'affidavit') return 'affidavit';
    // Infer from metadata
    if (document.metadata?.documentType === 'divorce_petition') return 'petition';
    if (document.metadata?.documentType === 'divorce_decree') return 'decree';
    // Infer from section keys
    if (sections) {
      if (sections.reliefRequested || sections.parties || sections.verification) return 'petition';
      if (sections.judgmentBlock || sections.dissolution || sections.appearances) return 'decree';
    }
    return 'affidavit';
  }

  /**
   * Get PDFKit options based on jurisdiction (Letter vs A4).
   */
  getPageOptions(document) {
    // Check metadata paperSize first (set by jurisdiction templates)
    if (document.metadata?.paperSize === 'A4') {
      return { ...this.a4Options };
    }
    const state = document.state || document.metadata?.state || 'TX';
    if (A4_JURISDICTIONS.has(state)) {
      return { ...this.a4Options };
    }
    return { ...this.defaultOptions };
  }

  /**
   * Generate a PDF file for the given document.
   *
   * Uses a two-pass approach: pass 1 renders to a throwaway PDFDocument to
   * count total pages; pass 2 renders again with accurate footer page numbers.
   * An optional pass 3 appends exhibit attachments for affidavits.
   *
   * @param {object} document - Document data including `sections`, `state`, `metadata`, etc.
   * @param {object} [options]
   * @param {string|number} [options.documentId] - Used in the output filename.
   * @param {string|number} [options.userId] - Owner user ID (needed for exhibit attachment).
   * @returns {Promise<{ filepath: string, filename: string, pages: number, documentType: string, success: boolean }>}
   */
  async generatePDF(document, options = {}) {
    const { documentId, userId } = options;

    try {
      const documentsDir = path.join(__dirname, '..', 'documents');
      await fs.mkdir(documentsDir, { recursive: true });

      const docType = this.detectDocumentType(document);
      const prefix = docType === 'petition' ? 'petition' : docType === 'decree' ? 'decree' : 'affidavit';
      const filename = `${prefix}-${documentId || Date.now()}.pdf`;
      const filepath = path.join(documentsDir, filename);
      const pageOptions = this.getPageOptions(document);

      // Compute effective page height for this document's paper size
      const pageHeight = pageOptions.size === 'A4' ? 841.89 : 792;

      // Generate base PDF
      const result = await new Promise((resolve, reject) => {
        // Create a render context for pass 1 (no footers)
        const ctx1 = this._createRenderContext(pageHeight);

        // PASS 1: Count total pages by rendering to a dummy document
        const dummyDoc = new PDFDocument(pageOptions);
        dummyDoc.pipe(require('stream').PassThrough()); // Pipe to nowhere
        this.buildPDF(dummyDoc, document, false, ctx1);
        const totalPages = dummyDoc.bufferedPageRange().count;
        dummyDoc.end();

        // Create a render context for pass 2 (with footers)
        const ctx2 = this._createRenderContext(pageHeight);
        ctx2.totalPages = totalPages;

        // PASS 2: Render actual PDF with footers
        const doc = new PDFDocument(pageOptions);
        const stream = doc.pipe(require('fs').createWriteStream(filepath));

        try {
          this.buildPDF(doc, document, true, ctx2);
          doc.end();

          stream.on('finish', () => {
            resolve({
              filepath,
              filename,
              pages: totalPages,
              documentType: docType,
              success: true
            });
          });

          stream.on('error', reject);
        } catch (error) {
          reject(error);
        }
      });

      // PASS 3: Append exhibits if any (affidavits only)
      if (docType === 'affidavit') {
        const facts = document.metadata?.facts
          || document.sections?.facts?.items
          || document.sections?.facts
          || [];
        const state = document.state || document.metadata?.state || 'TX';

        logger.debug('Checking for exhibits', {
          userId,
          factsCount: Array.isArray(facts) ? facts.length : 0,
          state,
          hasEvidence: Array.isArray(facts) ? facts.some(f => f.type === 'evidence') : false
        });

        if (userId && Array.isArray(facts) && facts.length > 0) {
          await this.appendExhibits(filepath, facts, state, userId);
        }
      }

      return result;
    } catch (error) {
      logger.error('PDF generation error', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate Word (.docx) document from the same document data.
   *
   * @param {object} document - Document data including `sections`, `state`, `metadata`, etc.
   * @param {object} [options]
   * @param {string|number} [options.documentId] - Used in the output filename.
   * @returns {Promise<{ filepath: string, filename: string, documentType: string, success: boolean }>}
   */
  async generateWordDoc(document, options = {}) {
    const { documentId } = options;
    const documentsDir = path.join(__dirname, '..', 'documents');
    await fs.mkdir(documentsDir, { recursive: true });

    const docType = this.detectDocumentType(document);
    const prefix = docType === 'petition' ? 'petition' : docType === 'decree' ? 'decree' : 'affidavit';
    const filename = `${prefix}-${documentId || Date.now()}.docx`;
    const filepath = path.join(documentsDir, filename);

    try {
      const children = this._buildWordSections(document, docType);

      const wordDoc = new docx.Document({
        styles: {
          default: {
            document: {
              run: { font: 'Times New Roman', size: 24 }, // 12pt = 24 half-points
              paragraph: { spacing: { line: 360 } } // 1.5 line spacing
            }
          }
        },
        sections: [{
          properties: {
            page: {
              size: (document.metadata?.paperSize === 'A4' || A4_JURISDICTIONS.has(document.state || document.metadata?.state || 'TX'))
                ? { width: 11906, height: 16838 } // A4 in twips
                : { width: 12240, height: 15840 }, // Letter in twips
              margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } // 1 inch = 1440 twips
            }
          },
          children
        }]
      });

      const buffer = await docx.Packer.toBuffer(wordDoc);
      await fs.writeFile(filepath, buffer);

      logger.info('Word document generated', { filepath, docType });
      return { filepath, filename, documentType: docType, success: true };
    } catch (error) {
      logger.error('Word generation error', { error: error.message });
      throw error;
    }
  }

  /**
   * Add a new page and increment page counter in the render context.
   * Adds footer to the current page before breaking.
   *
   * @param {object} doc - PDFKit document instance.
   * @param {object} ctx - Mutable render context.
   */
  addPageWithFooter(doc, ctx) {
    // Add footer to current page before creating new page
    if (ctx.shouldAddFooters && !ctx.addingFooter) {
      this.addFooter(doc, ctx);
    }

    // Add new page
    doc.addPage();

    // Increment page counter
    if (ctx.shouldAddFooters) {
      ctx.currentPage++;
    }
  }

  /**
   * Render the footer on the current page.
   *
   * @param {object} doc - PDFKit document instance.
   * @param {object} ctx - Mutable render context.
   */
  addFooter(doc, ctx) {
    // Prevent recursive footer addition
    ctx.addingFooter = true;

    const pageHeight = doc.page.height;
    const footerY = pageHeight - this.FOOTER_BOTTOM_MARGIN;

    // Save current state
    const savedY = doc.y;
    const savedX = doc.x;
    const savedFont = doc._font;
    const savedFontSize = doc._fontSize;

    // CRITICAL: Move cursor to a safe position to prevent page break
    // Set Y to a position well within the page margins
    doc.y = Math.min(savedY, ctx.EFFECTIVE_PAGE_HEIGHT - 50);

    // Use direct PDF text positioning to place footer outside normal flow
    const footerText = `Page ${ctx.currentPage} of ${ctx.totalPages} • Generated with AI assistance via Discover.Legal • Not legal advice — have an attorney review before filing`;
    const textWidth = doc.widthOfString(footerText, { fontSize: this.FOOTER_FONT_SIZE });
    const centerX = (doc.page.width - textWidth) / 2;

    // Render footer using direct positioning
    doc.fontSize(this.FOOTER_FONT_SIZE).font('Times-Roman');
    doc.save();
    doc.translate(centerX, footerY);
    doc.text(footerText, 0, 0, {
      lineBreak: false,
      width: textWidth
    });
    doc.restore();

    // Restore state
    doc.y = savedY;
    doc.x = savedX;
    if (savedFont) doc.font(savedFont.name || 'Times-Roman');
    if (savedFontSize) doc.fontSize(savedFontSize);

    ctx.addingFooter = false;
  }

  /**
   * Dispatch to the correct PDF builder based on document type.
   *
   * @param {object} doc - PDFKit document instance.
   * @param {object} document - The document data.
   * @param {boolean} addFooters - Whether to render footers (pass 2 only).
   * @param {object} ctx - Mutable render context.
   */
  buildPDF(doc, document, addFooters, ctx) {
    const { sections } = document;

    // Configure footer rendering in context
    ctx.shouldAddFooters = addFooters;
    if (addFooters) {
      ctx.currentPage = 1;
      ctx.addingFooter = false;
    }

    const docType = this.detectDocumentType(document);

    switch (docType) {
      case 'petition':
        this.buildPetitionPDF(doc, sections, ctx);
        break;
      case 'decree':
        this.buildDecreePDF(doc, sections, ctx);
        break;
      default:
        this.buildAffidavitPDF(doc, sections, ctx);
        break;
    }

    // Add footer to the last page
    if (ctx.shouldAddFooters && !ctx.addingFooter) {
      this.addFooter(doc, ctx);
    }
  }

  // ─── AFFIDAVIT PDF BUILDER (original) ──────────────────────────────────────

  buildAffidavitPDF(doc, sections, ctx) {
    // Header
    if (sections.header) {
      doc.fontSize(16).font('Times-Bold');
      doc.text(sections.header, { align: 'center' });
      doc.moveDown(1.5);
    }

    // Venue
    if (sections.venue) {
      this.checkPageBreak(doc, ctx);
      doc.fontSize(14).font('Times-Bold');
      doc.text(sections.venue, { align: 'center' });
      doc.moveDown(1.5);
    }

    // Case Caption
    if (sections.caseCaption) {
      this.checkPageBreak(doc, ctx, 120);
      doc.fontSize(12).font('Times-Roman');
      doc.text(this.getFormatted(sections.caseCaption), { align: 'center' });
      doc.moveDown(1.5);

      const borderY = doc.y;
      doc.moveTo(doc.page.margins.left, borderY)
         .lineTo(doc.page.width - doc.page.margins.right, borderY)
         .stroke();

      doc.moveDown(1.0);
    }

    // Title
    if (sections.title) {
      this.checkPageBreak(doc, ctx);
      doc.fontSize(14).font('Times-Bold');
      doc.text(sections.title, { align: 'center' });

      const borderY = doc.y + 2;
      doc.moveTo(doc.page.margins.left, borderY)
         .lineTo(doc.page.width - doc.page.margins.right, borderY)
         .stroke();

      doc.moveDown(1.5);
    }

    // Introduction
    if (sections.introduction) {
      this.checkPageBreak(doc, ctx);
      doc.fontSize(12).font('Times-Roman');
      doc.text(sections.introduction, {
        align: 'justify',
        indent: 36,
        lineGap: 6
      });
      doc.moveDown(1.5);
    }

    // Facts Section
    const factsList = this.getFactsArray(sections.facts);
    if (factsList.length > 0) {
      let renderedFactCount = 0;

      factsList.forEach((fact, index) => {
        const estimatedHeight = this.estimateTextHeight(doc, fact.content, 12) + 20;
        const isLastFact = index === factsList.length - 1;

        if (isLastFact && sections.notaryBlock) {
          let spaceForEverything = estimatedHeight;
          if (sections.conclusion) spaceForEverything += 60;
          if (sections.perjuryStatement) spaceForEverything += 60;
          if (sections.signatureBlock) spaceForEverything += 100;

          let notarySpace = 155;
          if (sections.notaryInstruction) {
            const instructionHeight = this.estimateTextHeight(doc, sections.notaryInstruction, 10) + 20;
            notarySpace = instructionHeight + 145 + 20;
          }
          spaceForEverything += notarySpace;

          const availableSpace = ctx.EFFECTIVE_PAGE_HEIGHT - doc.y;

          if (availableSpace >= spaceForEverything) {
            this.checkPageBreak(doc, ctx, estimatedHeight);
          }
          else if (renderedFactCount > 0) {
            doc.moveDown(1.5);
            doc.fontSize(11).font('Times-Italic');
            doc.text('(Continued on next page)', { align: 'center' });
            doc.font('Times-Roman').fontSize(12);
            this.addPageWithFooter(doc, ctx);
          }
          else {
            this.checkPageBreak(doc, ctx, estimatedHeight);
          }
        } else {
          this.checkPageBreak(doc, ctx, estimatedHeight);
        }

        this.renderNumberedParagraph(doc, fact.number, fact.content);
        doc.moveDown(1.0);
        renderedFactCount++;
      });
    }

    // Conclusion
    if (sections.conclusion) {
      this.checkPageBreak(doc, ctx, 60);
      doc.fontSize(12).font('Times-Roman');
      doc.text(sections.conclusion, { align: 'justify', indent: 36, lineGap: 6 });
      doc.moveDown(1.5);
    }

    // Perjury Statement
    if (sections.perjuryStatement) {
      this.checkPageBreak(doc, ctx, 60);
      doc.moveDown(1.5);
      doc.fontSize(12).font('Times-Roman');
      doc.text(sections.perjuryStatement, { align: 'justify', indent: 36, lineGap: 6 });
      doc.moveDown(1.5);
    }

    // Signature Block
    if (sections.signatureBlock) {
      this.renderAffiantSignature(doc, sections.signatureBlock, ctx);
    }

    // Notary Instruction + Block
    this.renderNotarySection(doc, sections, ctx);
  }

  // ─── PETITION PDF BUILDER ──────────────────────────────────────────────────

  buildPetitionPDF(doc, sections, ctx) {
    // Header + Venue + Caption + Title (shared with affidavit)
    this.renderDocumentHeader(doc, sections, ctx);

    // Numbered-paragraph sections (I. PARTIES, II. JURISDICTION, III. MARRIAGE, etc.)
    const numberedSections = [
      'parties', 'jurisdiction', 'marriageInfo', 'grounds', 'childrenInfo', 'propertyInfo'
    ];

    for (const key of numberedSections) {
      const section = sections[key];
      if (!section || !section.title) continue;

      this.checkPageBreak(doc, ctx, 60);
      doc.fontSize(13).font('Times-Bold');
      doc.text(section.title, { align: 'center' });
      doc.moveDown(0.8);

      if (section.items && Array.isArray(section.items)) {
        section.items.forEach(item => {
          const estimatedHeight = this.estimateTextHeight(doc, item.content, 12) + 20;
          this.checkPageBreak(doc, ctx, estimatedHeight);

          if (item.number) {
            this.renderNumberedParagraph(doc, item.number, item.content);
          } else {
            doc.fontSize(12).font('Times-Roman');
            doc.text(item.content, { align: 'justify', indent: 36, lineGap: 6 });
          }
          doc.moveDown(0.8);
        });
      }
      doc.moveDown(0.5);
    }

    // VII. PRAYER FOR RELIEF (letter-style items)
    if (sections.reliefRequested) {
      this.checkPageBreak(doc, ctx, 80);
      doc.fontSize(13).font('Times-Bold');
      doc.text(sections.reliefRequested.title || 'PRAYER FOR RELIEF', { align: 'center' });
      doc.moveDown(0.8);

      if (sections.reliefRequested.items) {
        sections.reliefRequested.items.forEach(item => {
          this.checkPageBreak(doc, ctx, 30);
          doc.fontSize(12).font('Times-Roman');

          if (item.type === 'relief_intro') {
            doc.text(item.content, { align: 'justify', indent: 36, lineGap: 6 });
          } else if (item.letter) {
            // Letter-numbered relief item: (a) text
            const label = `(${item.letter}) `;
            const labelWidth = doc.widthOfString(label);
            const textWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right - 36;
            const currentX = doc.page.margins.left + 36;
            const currentY = doc.y;

            doc.text(label, currentX, currentY, { continued: false, width: labelWidth, lineBreak: false });
            doc.text(item.content, currentX + labelWidth, currentY, {
              align: 'justify', width: textWidth - labelWidth, lineBreak: true, lineGap: 6
            });
            doc.x = doc.page.margins.left;
          } else {
            doc.text(item.content, { align: 'justify', indent: 72, lineGap: 6 });
          }
          doc.moveDown(0.5);
        });
      }
      doc.moveDown(1.0);
    }

    // VERIFICATION section
    if (sections.verification) {
      this.checkPageBreak(doc, ctx, 80);
      doc.fontSize(13).font('Times-Bold');
      doc.text(sections.verification.title || 'VERIFICATION', { align: 'center' });
      doc.moveDown(0.8);

      doc.fontSize(12).font('Times-Roman');
      doc.text(sections.verification.text || '', { align: 'justify', indent: 36, lineGap: 6 });
      doc.moveDown(1.5);
    }

    // Signature Block (petitioner)
    if (sections.signatureBlock) {
      this.renderAffiantSignature(doc, sections.signatureBlock, ctx);
    }
  }

  // ─── DECREE PDF BUILDER ────────────────────────────────────────────────────

  buildDecreePDF(doc, sections, ctx) {
    // Header + Venue + Caption + Title (shared)
    this.renderDocumentHeader(doc, sections, ctx);

    // Text sections (appearances, jurisdiction, dissolution)
    const textSections = ['appearances', 'jurisdiction', 'dissolution'];
    for (const key of textSections) {
      const section = sections[key];
      if (!section || !section.title) continue;

      this.checkPageBreak(doc, ctx, 60);
      doc.fontSize(13).font('Times-Bold');
      doc.text(section.title, { align: 'center' });
      doc.moveDown(0.8);

      doc.fontSize(12).font('Times-Roman');
      doc.text(section.text || '', { align: 'justify', indent: 36, lineGap: 6 });
      doc.moveDown(1.5);
    }

    // Item sections (property, debts, custody, support, spousal, finalOrders)
    const itemSections = [
      'propertyDivision', 'debtAllocation', 'childCustody',
      'childSupport', 'spousalSupport', 'finalOrders'
    ];
    for (const key of itemSections) {
      const section = sections[key];
      if (!section || !section.title) continue;

      this.checkPageBreak(doc, ctx, 60);
      doc.fontSize(13).font('Times-Bold');
      doc.text(section.title, { align: 'center' });
      doc.moveDown(0.8);

      // Some decree sections use .text instead of .items
      if (section.text) {
        doc.fontSize(12).font('Times-Roman');
        doc.text(section.text, { align: 'justify', indent: 36, lineGap: 6 });
        doc.moveDown(0.8);
      }

      if (section.items && Array.isArray(section.items)) {
        section.items.forEach(item => {
          const estimatedHeight = this.estimateTextHeight(doc, item.content, 12) + 15;
          this.checkPageBreak(doc, ctx, estimatedHeight);

          doc.fontSize(12).font('Times-Roman');
          if (item.type === 'order') {
            doc.font('Times-Bold');
          }
          doc.text(item.content, { align: 'justify', indent: 36, lineGap: 6 });
          doc.font('Times-Roman');
          doc.moveDown(0.6);
        });
      }
      doc.moveDown(0.5);
    }

    // Name Change (text section, may be null)
    if (sections.nameChange && sections.nameChange.title) {
      this.checkPageBreak(doc, ctx, 60);
      doc.fontSize(13).font('Times-Bold');
      doc.text(sections.nameChange.title, { align: 'center' });
      doc.moveDown(0.8);

      doc.fontSize(12).font('Times-Roman');
      doc.text(sections.nameChange.text || '', { align: 'justify', indent: 36, lineGap: 6 });
      doc.moveDown(1.5);
    }

    // Judgment Block (judge signature)
    if (sections.judgmentBlock) {
      this.checkPageBreak(doc, ctx, 120);
      doc.moveDown(2);
      doc.fontSize(12).font('Times-Roman');
      const judgmentText = sections.judgmentBlock.text || '';
      judgmentText.split('\n').forEach(line => {
        doc.text(line, { align: 'left' });
        doc.moveDown(0.3);
      });
      doc.moveDown(1.5);
    }

    // Party Signatures (agreed decrees)
    if (sections.signatureBlock && sections.signatureBlock.type === 'party_signatures') {
      this.checkPageBreak(doc, ctx, 150);
      doc.moveDown(1);
      doc.fontSize(12).font('Times-Bold');
      doc.text(sections.signatureBlock.title || 'APPROVED AS TO FORM AND SUBSTANCE:', { align: 'left' });
      doc.moveDown(1.5);

      if (sections.signatureBlock.blocks) {
        sections.signatureBlock.blocks.forEach(block => {
          this.checkPageBreak(doc, ctx, 80);
          doc.font('Times-Roman');
          doc.text(block.line || '_'.repeat(40));
          doc.moveDown(0.3);
          doc.text(block.name || '[NAME]');
          doc.moveDown(0.3);
          doc.text(block.title || '');
          doc.moveDown(2);
        });
      }
    }
    // Fallback: regular signature block (same as affidavit)
    else if (sections.signatureBlock && sections.signatureBlock.line) {
      this.renderAffiantSignature(doc, sections.signatureBlock, ctx);
    }
  }

  // ─── SHARED PDF RENDERING HELPERS ──────────────────────────────────────────

  /**
   * Render common document header: header, venue, caption, title.
   */
  renderDocumentHeader(doc, sections, ctx) {
    if (sections.header) {
      doc.fontSize(16).font('Times-Bold');
      doc.text(sections.header, { align: 'center' });
      doc.moveDown(1.5);
    }

    if (sections.venue) {
      this.checkPageBreak(doc, ctx);
      doc.fontSize(14).font('Times-Bold');
      doc.text(sections.venue, { align: 'center' });
      doc.moveDown(1.5);
    }

    if (sections.caseCaption) {
      this.checkPageBreak(doc, ctx, 120);
      doc.fontSize(12).font('Times-Roman');
      doc.text(this.getFormatted(sections.caseCaption), { align: 'center' });
      doc.moveDown(1.5);

      const borderY = doc.y;
      doc.moveTo(doc.page.margins.left, borderY)
         .lineTo(doc.page.width - doc.page.margins.right, borderY)
         .stroke();
      doc.moveDown(1.0);
    }

    if (sections.title) {
      this.checkPageBreak(doc, ctx);
      doc.fontSize(14).font('Times-Bold');
      doc.text(sections.title, { align: 'center' });

      const borderY = doc.y + 2;
      doc.moveTo(doc.page.margins.left, borderY)
         .lineTo(doc.page.width - doc.page.margins.right, borderY)
         .stroke();
      doc.moveDown(1.5);
    }
  }

  /**
   * Render a numbered paragraph: "N. content"
   */
  renderNumberedParagraph(doc, number, content) {
    doc.fontSize(12).font('Times-Roman');
    const numberText = `${number}. `;
    const numberWidth = doc.widthOfString(numberText);
    const textWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const currentX = doc.page.margins.left;
    const currentY = doc.y;

    doc.text(numberText, currentX, currentY, {
      continued: false, width: numberWidth, lineBreak: false
    });
    doc.text(content, currentX + numberWidth, currentY, {
      align: 'justify', width: textWidth - numberWidth, lineBreak: true, lineGap: 6
    });
    doc.x = doc.page.margins.left;
  }

  /**
   * Render affiant/petitioner signature block.
   */
  renderAffiantSignature(doc, sigBlock, ctx) {
    this.checkPageBreak(doc, ctx, 100);
    doc.moveDown(1.5);
    doc.fontSize(12).font('Times-Roman');

    doc.text(sigBlock.line || '_'.repeat(40));
    doc.moveDown(0.3);
    doc.text(sigBlock.name || '[NAME]');
    doc.moveDown(0.3);
    doc.text(sigBlock.title || 'Affiant');

    if (sigBlock.date) {
      doc.moveDown(0.5);
      doc.text(sigBlock.date);
    }
    doc.moveDown(1.5);
  }

  /**
   * Render notary instruction + notary block (affidavits only).
   */
  renderNotarySection(doc, sections, ctx) {
    if (sections.notaryInstruction && sections.notaryBlock) {
      const instructionHeight = this.estimateTextHeight(doc, sections.notaryInstruction, 10) + 30;
      const notaryHeight = 155;
      const totalHeight = instructionHeight + notaryHeight + 30;
      this.checkPageBreak(doc, ctx, totalHeight);
    }

    if (sections.notaryInstruction) {
      if (!sections.notaryBlock) {
        this.checkPageBreak(doc, ctx, 150);
      }

      doc.fontSize(10).font('Times-Bold');
      doc.fillColor('#0066cc');

      const startY = doc.y;
      const instructionLines = sections.notaryInstruction.split('\n');

      instructionLines.forEach(line => {
        doc.text(line, {
          align: 'left',
          width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
          lineGap: 6
        });
      });

      const endY = doc.y + 6.5;
      const instructionBorderMargin = 10;
      doc.rect(
        doc.page.margins.left - instructionBorderMargin,
        startY - 13,
        doc.page.width - doc.page.margins.left - doc.page.margins.right + (instructionBorderMargin * 2),
        endY - startY + 13
      ).stroke('#0066cc');

      doc.y = endY;
      doc.fillColor('#000000');
      doc.strokeColor('#000000');
      doc.fontSize(12).font('Times-Roman');
      doc.moveDown(1.5);

      if (sections.notaryBlock) {
        const remainingSpace = ctx.EFFECTIVE_PAGE_HEIGHT - doc.y;
        if (remainingSpace < 155) {
          this.addPageWithFooter(doc, ctx);
        }
      }
    }

    if (sections.notaryBlock) {
      if (!sections.notaryInstruction) {
        this.checkPageBreak(doc, ctx, 155);
        doc.moveDown(1.5);
      }

      const startY = doc.y;
      const borderMargin = 10;
      const estimatedHeight = this.estimateTextHeight(doc, sections.notaryBlock, 12) + 20;

      doc.fillColor('#f9f9f9');
      doc.rect(
        doc.page.margins.left - borderMargin,
        startY - borderMargin,
        doc.page.width - doc.page.margins.left - doc.page.margins.right + (borderMargin * 2),
        estimatedHeight + (borderMargin * 2)
      ).fill();

      doc.fillColor('#000000');
      doc.fontSize(12).font('Times-Roman');
      this.renderNotaryBlock(doc, sections.notaryBlock);

      const endY = doc.y + 10;
      doc.rect(
        doc.page.margins.left - borderMargin,
        startY - borderMargin,
        doc.page.width - doc.page.margins.left - doc.page.margins.right + (borderMargin * 2),
        endY - startY + (borderMargin * 2)
      ).stroke();
    }
  }

  /**
   * Check if a page break is needed and add one if so.
   *
   * @param {object} doc - PDFKit document instance.
   * @param {object} ctx - Mutable render context.
   * @param {number} [neededSpace=60] - Space in points required for the next element.
   */
  checkPageBreak(doc, ctx, neededSpace = 60) {
    const availableSpace = ctx.EFFECTIVE_PAGE_HEIGHT - doc.y;

    if (neededSpace > availableSpace) {
      this.addPageWithFooter(doc, ctx);
    }
  }

  getFormatted(section) {
    if (!section) return '';
    if (typeof section === 'string') return section;
    if (section.formatted) return String(section.formatted);
    if (section.content) return String(section.content);
    if (section.items && Array.isArray(section.items)) {
      return section.items.map(it => it.displayContent || it.content || String(it)).join('\n\n');
    }
    return '';
  }

  getFactsArray(factsSection) {
    if (!factsSection) return [];

    if (factsSection.items && Array.isArray(factsSection.items)) {
      return factsSection.items.map((fact) => ({
        number: fact.number || 0,
        content: fact.content || ''
      }));
    }

    if (Array.isArray(factsSection)) {
      const prepared = prepareFactsForDisplay(factsSection);
      return prepared.map(f => ({
        number: f.index || f.number || 0,
        content: f.displayContent || f.content || ''
      }));
    }

    const formatted = this.getFormatted(factsSection);
    if (formatted && typeof formatted === 'string') {
      const parts = formatted.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
      return parts.map((p, idx) => ({ number: idx + 1, content: p }));
    }

    if (factsSection && typeof factsSection === 'object') {
      try {
        const { items } = previewRenderer.generateBoth(factsSection);
        return Array.isArray(items) ? items.map((it, idx) => ({
          number: it.number || idx + 1,
          content: it.displayContent || it.text || it.content || ''
        })) : [];
      } catch (e) {
        return [];
      }
    }

    return [];
  }

  estimateTextHeight(doc, text, fontSize) {
    const previousFontSize = doc._fontSize;
    doc.fontSize(fontSize);

    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const height = doc.heightOfString(text, { width });

    doc.fontSize(previousFontSize);
    return height;
  }

  renderNotaryBlock(doc, notaryBlockText) {
    const lines = notaryBlockText.split('\n');

    lines.forEach((line, idx) => {
      if (idx > 0) doc.moveDown(0.5);

      if (line.includes('_____')) {
        if (line.includes('(notary public name)') ||
            line.includes('(date)') ||
            line.includes('(month)') ||
            line.includes('(year)') ||
            line.includes('(name of document signer)')) {
          doc.text(line, { align: 'left', indent: 20 });
        } else if (line.includes('Subscribed and sworn to before me,')) {
          const parts = line.split(',');
          doc.text(parts[0] + ',', { continued: true });
          doc.text(' ________________________________,');
        } else if (line.includes('on this') && line.includes('day of')) {
          doc.text(line, { align: 'left' });
        } else if (line.includes('by ___')) {
          doc.text(line, { align: 'left' });
        } else if (line.includes('My commission expires:')) {
          doc.text(line, { align: 'left' });
        } else if (line.includes('(SEAL)')) {
          const parts = line.split('(SEAL)');
          doc.text('(SEAL)', doc.page.margins.left, doc.y, {
            continued: false,
            width: 100
          });

          const sigX = doc.page.margins.left + 120;
          doc.text(parts[1].trim(), sigX, doc.y - 12, { align: 'left' });
        } else {
          doc.text(line, { align: 'left' });
        }
      } else {
        doc.text(line, { align: 'left' });
      }
    });
  }

  /**
   * Generate exhibit cover page using PDFKit.
   *
   * @param {string} exhibitLabel - The exhibit letter/number (e.g. "A").
   * @param {string} description - Optional description text.
   * @param {boolean} requireCoverPage - Whether a cover page is needed.
   * @param {object} [pageOptions] - PDFKit page options (size, margins, etc.).
   *   Defaults to `this.defaultOptions` (US Letter) when not provided.
   */
  generateExhibitCoverPage(exhibitLabel, description, requireCoverPage, pageOptions) {
    if (!requireCoverPage) return null;

    return new Promise((resolve) => {
      const doc = new PDFDocument(pageOptions || this.defaultOptions);
      const chunks = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      // Center the title vertically and horizontally
      const pageHeight = doc.page.height;
      const pageWidth = doc.page.width;

      doc.fontSize(20).font('Times-Bold');
      const titleText = `EXHIBIT ${exhibitLabel}`;
      const titleWidth = doc.widthOfString(titleText);
      const titleX = (pageWidth - titleWidth) / 2;
      const titleY = pageHeight / 3;

      doc.text(titleText, titleX, titleY, { align: 'center' });

      // Add description below if provided
      if (description) {
        doc.moveDown(2);
        doc.fontSize(12).font('Times-Roman');
        doc.text(description, {
          align: 'center',
          width: pageWidth - 144 // 1 inch margins on each side
        });
      }

      doc.end();
    });
  }

  /**
   * Append exhibits to PDF using pdf-lib
   */
  async appendExhibits(pdfPath, facts, state, userId) {
    logger.debug('Appending exhibits to PDF', {
      factsCount: facts?.length || 0,
      state,
      userId
    });

    const allEvidenceItems = getEvidenceItems(facts || []);
    const evidenceItems = allEvidenceItems.filter(e => evidenceHasFile(e));

    logger.debug('Evidence items for attachment', {
      total: allEvidenceItems.length,
      withFiles: evidenceItems.length
    });

    if (evidenceItems.length === 0) {
      logger.debug('No evidence items with files to append');
      return pdfPath;
    }

    try {
      // Get exhibit rules for this state
      let exhibitRules = {
        labelStyle: 'letters',
        requireCoverPage: false,
        allowedFormats: ['PDF', 'JPG', 'PNG'],
        maxFileSize: 25 * 1024 * 1024,
        maxTotalSize: 100 * 1024 * 1024,
        instructions: 'Attach exhibits after the affidavit.',
      };
      if (this.templateManager) {
        const template = this.templateManager.getTemplate(state);
        if (template && typeof template.getExhibitRules === 'function') {
          exhibitRules = template.getExhibitRules();
        }
      }

      // Determine page options for exhibit cover pages (A4 vs Letter)
      const coverPageOptions = A4_JURISDICTIONS.has(state)
        ? { ...this.a4Options }
        : { ...this.defaultOptions };

      logger.info('Appending exhibits to PDF', { count: evidenceItems.length });

      // Load the main PDF
      const mainPdfBytes = await fs.readFile(pdfPath);
      const mainPdf = await PDFLib.load(mainPdfBytes);

      // Process each evidence item
      for (const evidence of evidenceItems) {
        const evidenceData = evidence.evidenceData || {};
        const exhibitLabel = evidenceData.exhibitLabel || '?';
        const description = evidenceData.description || '';
        const fileKey = evidenceData.fileKey;

        if (!fileKey) {
          logger.debug('Skipping evidence - no file key', { exhibitLabel });
          continue;
        }

        // Construct file path with path traversal protection
        const evidenceBasePath = process.env.EVIDENCE_STORAGE_PATH || path.join(__dirname, '..', 'documents', 'evidence');
        let filePath;
        try {
          filePath = validatePath(evidenceBasePath, fileKey);
        } catch (pathError) {
          logger.warn('Skipping exhibit - invalid path', { exhibitLabel });
          continue;
        }

        // Check if file exists
        if (!fssync.existsSync(filePath)) {
          logger.warn('Skipping evidence - file not found', { exhibitLabel });
          continue;
        }

        logger.debug('Attaching exhibit', { exhibitLabel });

        try {
          // Add cover page if required
          if (exhibitRules.requireCoverPage) {
            const coverPageBuffer = await this.generateExhibitCoverPage(
              exhibitLabel,
              description,
              exhibitRules.requireCoverPage,
              coverPageOptions
            );

            if (coverPageBuffer) {
              const coverPdf = await PDFLib.load(coverPageBuffer);
              const [coverPage] = await mainPdf.copyPages(coverPdf, [0]);
              mainPdf.addPage(coverPage);
            }
          }

          // Add the actual exhibit file
          const fileBuffer = await fs.readFile(filePath);
          const fileType = evidenceData.fileType || '';
          const fileName = evidenceData.fileName || '';

          // Determine file type from both fileType field and fileName extension
          const isPDF = fileType === 'application/pdf' || fileType === 'pdf' || fileName.toLowerCase().endsWith('.pdf');
          const isJPG = fileType === 'image/jpeg' || fileType === 'jpg' || fileName.toLowerCase().match(/\.(jpg|jpeg)$/);
          const isPNG = fileType === 'image/png' || fileType === 'png' || fileName.toLowerCase().endsWith('.png');

          if (isPDF) {
            // Merge PDF
            const exhibitPdf = await PDFLib.load(fileBuffer);
            const pages = await mainPdf.copyPages(exhibitPdf, exhibitPdf.getPageIndices());
            pages.forEach(page => mainPdf.addPage(page));
          } else if (isJPG || isPNG) {
            // Embed image
            const image = isJPG
              ? await mainPdf.embedJpg(fileBuffer)
              : await mainPdf.embedPng(fileBuffer);

            const page = mainPdf.addPage();
            const { width: pageWidth, height: pageHeight } = page.getSize();

            // Scale image to fit page while maintaining aspect ratio
            const imgWidth = image.width;
            const imgHeight = image.height;
            const scale = Math.min(
              (pageWidth - 144) / imgWidth,  // 1 inch margins
              (pageHeight - 144) / imgHeight
            );

            const scaledWidth = imgWidth * scale;
            const scaledHeight = imgHeight * scale;
            const x = (pageWidth - scaledWidth) / 2;
            const y = (pageHeight - scaledHeight) / 2;

            page.drawImage(image, {
              x,
              y,
              width: scaledWidth,
              height: scaledHeight
            });
          }
        } catch (error) {
          logger.error('Failed to attach exhibit', { exhibitLabel, error: error.message });
        }
      }

      // Save the merged PDF
      const mergedPdfBytes = await mainPdf.save();
      await fs.writeFile(pdfPath, mergedPdfBytes);

      logger.info('Successfully appended exhibits to PDF', { count: evidenceItems.length });
      return pdfPath;
    } catch (error) {
      logger.error('Failed to append exhibits', { error: error.message });
      // Return original PDF if exhibit attachment fails
      return pdfPath;
    }
  }

  // ─── WORD DOCUMENT BUILDER ──────────────────────────────────────────────────

  /**
   * Build docx paragraph children for the given document type.
   */
  _buildWordSections(document, docType) {
    const { sections } = document;
    const children = [];

    // Shared header/venue/caption/title
    if (sections.header) {
      children.push(new docx.Paragraph({
        children: [new docx.TextRun({ text: sections.header, bold: true, size: 32 })],
        alignment: docx.AlignmentType.CENTER, spacing: { after: 240 }
      }));
    }
    if (sections.venue) {
      children.push(new docx.Paragraph({
        children: [new docx.TextRun({ text: sections.venue, bold: true, size: 28 })],
        alignment: docx.AlignmentType.CENTER, spacing: { after: 240 }
      }));
    }
    if (sections.caseCaption) {
      const captionText = this.getFormatted(sections.caseCaption);
      captionText.split('\n').forEach(line => {
        children.push(new docx.Paragraph({
          children: [new docx.TextRun({ text: line, size: 24 })],
          alignment: docx.AlignmentType.CENTER
        }));
      });
      // Horizontal rule
      children.push(new docx.Paragraph({
        border: { bottom: { style: docx.BorderStyle.SINGLE, size: 6, color: '000000' } },
        spacing: { after: 200 }
      }));
    }
    if (sections.title) {
      children.push(new docx.Paragraph({
        children: [new docx.TextRun({ text: sections.title, bold: true, size: 28 })],
        alignment: docx.AlignmentType.CENTER,
        border: { bottom: { style: docx.BorderStyle.SINGLE, size: 6, color: '000000' } },
        spacing: { after: 240 }
      }));
    }

    switch (docType) {
      case 'petition':
        this._buildWordPetition(children, sections);
        break;
      case 'decree':
        this._buildWordDecree(children, sections);
        break;
      default:
        this._buildWordAffidavit(children, sections);
        break;
    }

    // Footer disclaimer
    const footer = sections.footer;
    if (footer && footer.disclaimer) {
      children.push(new docx.Paragraph({
        children: [new docx.TextRun({ text: footer.disclaimer, italics: true, size: 18 })],
        alignment: docx.AlignmentType.CENTER, spacing: { before: 480 }
      }));
    }

    return children;
  }

  _buildWordAffidavit(children, sections) {
    // Introduction
    if (sections.introduction) {
      children.push(new docx.Paragraph({
        children: [new docx.TextRun({ text: sections.introduction, size: 24 })],
        alignment: docx.AlignmentType.JUSTIFIED, indent: { firstLine: 720 },
        spacing: { after: 240 }
      }));
    }

    // Facts
    const factsList = this.getFactsArray(sections.facts);
    factsList.forEach(fact => {
      children.push(new docx.Paragraph({
        children: [
          new docx.TextRun({ text: `${fact.number}. `, bold: true, size: 24 }),
          new docx.TextRun({ text: fact.content, size: 24 })
        ],
        alignment: docx.AlignmentType.JUSTIFIED, spacing: { after: 200 }
      }));
    });

    // Conclusion
    if (sections.conclusion) {
      children.push(new docx.Paragraph({
        children: [new docx.TextRun({ text: sections.conclusion, size: 24 })],
        alignment: docx.AlignmentType.JUSTIFIED, indent: { firstLine: 720 },
        spacing: { before: 240, after: 240 }
      }));
    }

    // Perjury
    if (sections.perjuryStatement) {
      children.push(new docx.Paragraph({
        children: [new docx.TextRun({ text: sections.perjuryStatement, size: 24 })],
        alignment: docx.AlignmentType.JUSTIFIED, indent: { firstLine: 720 },
        spacing: { before: 240, after: 240 }
      }));
    }

    // Signature
    if (sections.signatureBlock) {
      this._addWordSignature(children, sections.signatureBlock);
    }

    // Notary
    if (sections.notaryBlock) {
      children.push(new docx.Paragraph({
        children: [new docx.TextRun({ text: 'NOTARY ACKNOWLEDGMENT', bold: true, size: 24 })],
        spacing: { before: 480 }
      }));
      sections.notaryBlock.split('\n').forEach(line => {
        children.push(new docx.Paragraph({
          children: [new docx.TextRun({ text: line, size: 24 })]
        }));
      });
    }
  }

  _buildWordPetition(children, sections) {
    // Numbered-paragraph sections
    const numberedSections = ['parties', 'jurisdiction', 'marriageInfo', 'grounds', 'childrenInfo', 'propertyInfo'];
    for (const key of numberedSections) {
      const section = sections[key];
      if (!section || !section.title) continue;

      children.push(new docx.Paragraph({
        children: [new docx.TextRun({ text: section.title, bold: true, size: 26 })],
        alignment: docx.AlignmentType.CENTER, spacing: { before: 360, after: 200 }
      }));

      if (section.items) {
        section.items.forEach(item => {
          if (item.number) {
            children.push(new docx.Paragraph({
              children: [
                new docx.TextRun({ text: `${item.number}. `, bold: true, size: 24 }),
                new docx.TextRun({ text: item.content, size: 24 })
              ],
              alignment: docx.AlignmentType.JUSTIFIED, spacing: { after: 160 }
            }));
          } else {
            children.push(new docx.Paragraph({
              children: [new docx.TextRun({ text: item.content, size: 24 })],
              alignment: docx.AlignmentType.JUSTIFIED, indent: { firstLine: 720 },
              spacing: { after: 160 }
            }));
          }
        });
      }
    }

    // Prayer for Relief
    if (sections.reliefRequested) {
      children.push(new docx.Paragraph({
        children: [new docx.TextRun({ text: sections.reliefRequested.title || 'PRAYER FOR RELIEF', bold: true, size: 26 })],
        alignment: docx.AlignmentType.CENTER, spacing: { before: 360, after: 200 }
      }));

      if (sections.reliefRequested.items) {
        sections.reliefRequested.items.forEach(item => {
          if (item.type === 'relief_intro') {
            children.push(new docx.Paragraph({
              children: [new docx.TextRun({ text: item.content, size: 24 })],
              indent: { firstLine: 720 }, spacing: { after: 160 }
            }));
          } else if (item.letter) {
            children.push(new docx.Paragraph({
              children: [
                new docx.TextRun({ text: `(${item.letter}) `, bold: true, size: 24 }),
                new docx.TextRun({ text: item.content, size: 24 })
              ],
              indent: { left: 720 }, spacing: { after: 120 }
            }));
          }
        });
      }
    }

    // Verification
    if (sections.verification) {
      children.push(new docx.Paragraph({
        children: [new docx.TextRun({ text: sections.verification.title || 'VERIFICATION', bold: true, size: 26 })],
        alignment: docx.AlignmentType.CENTER, spacing: { before: 360, after: 200 }
      }));
      children.push(new docx.Paragraph({
        children: [new docx.TextRun({ text: sections.verification.text || '', size: 24 })],
        alignment: docx.AlignmentType.JUSTIFIED, indent: { firstLine: 720 },
        spacing: { after: 240 }
      }));
    }

    // Signature
    if (sections.signatureBlock) {
      this._addWordSignature(children, sections.signatureBlock);
    }
  }

  _buildWordDecree(children, sections) {
    // Text sections
    const textSections = ['appearances', 'jurisdiction', 'dissolution'];
    for (const key of textSections) {
      const section = sections[key];
      if (!section || !section.title) continue;

      children.push(new docx.Paragraph({
        children: [new docx.TextRun({ text: section.title, bold: true, size: 26 })],
        alignment: docx.AlignmentType.CENTER, spacing: { before: 360, after: 200 }
      }));
      children.push(new docx.Paragraph({
        children: [new docx.TextRun({ text: section.text || '', size: 24 })],
        alignment: docx.AlignmentType.JUSTIFIED, indent: { firstLine: 720 },
        spacing: { after: 240 }
      }));
    }

    // Item sections
    const itemSections = ['propertyDivision', 'debtAllocation', 'childCustody', 'childSupport', 'spousalSupport', 'finalOrders'];
    for (const key of itemSections) {
      const section = sections[key];
      if (!section || !section.title) continue;

      children.push(new docx.Paragraph({
        children: [new docx.TextRun({ text: section.title, bold: true, size: 26 })],
        alignment: docx.AlignmentType.CENTER, spacing: { before: 360, after: 200 }
      }));

      if (section.text) {
        children.push(new docx.Paragraph({
          children: [new docx.TextRun({ text: section.text, size: 24 })],
          alignment: docx.AlignmentType.JUSTIFIED, indent: { firstLine: 720 },
          spacing: { after: 200 }
        }));
      }

      if (section.items) {
        section.items.forEach(item => {
          const isBold = item.type === 'order';
          children.push(new docx.Paragraph({
            children: [new docx.TextRun({ text: item.content, bold: isBold, size: 24 })],
            alignment: docx.AlignmentType.JUSTIFIED, indent: { firstLine: 720 },
            spacing: { after: 120 }
          }));
        });
      }
    }

    // Name Change
    if (sections.nameChange && sections.nameChange.title) {
      children.push(new docx.Paragraph({
        children: [new docx.TextRun({ text: sections.nameChange.title, bold: true, size: 26 })],
        alignment: docx.AlignmentType.CENTER, spacing: { before: 360, after: 200 }
      }));
      children.push(new docx.Paragraph({
        children: [new docx.TextRun({ text: sections.nameChange.text || '', size: 24 })],
        alignment: docx.AlignmentType.JUSTIFIED, indent: { firstLine: 720 },
        spacing: { after: 240 }
      }));
    }

    // Judgment Block
    if (sections.judgmentBlock) {
      children.push(new docx.Paragraph({ spacing: { before: 480 } }));
      (sections.judgmentBlock.text || '').split('\n').forEach(line => {
        children.push(new docx.Paragraph({
          children: [new docx.TextRun({ text: line, size: 24 })],
          spacing: { after: 60 }
        }));
      });
    }

    // Party Signatures (agreed decree)
    if (sections.signatureBlock && sections.signatureBlock.type === 'party_signatures') {
      children.push(new docx.Paragraph({
        children: [new docx.TextRun({ text: sections.signatureBlock.title || 'APPROVED AS TO FORM AND SUBSTANCE:', bold: true, size: 24 })],
        spacing: { before: 480, after: 240 }
      }));

      if (sections.signatureBlock.blocks) {
        sections.signatureBlock.blocks.forEach(block => {
          children.push(new docx.Paragraph({
            children: [new docx.TextRun({ text: block.line || '_'.repeat(40), size: 24 })],
            spacing: { before: 240 }
          }));
          children.push(new docx.Paragraph({
            children: [new docx.TextRun({ text: block.name || '[NAME]', size: 24 })]
          }));
          children.push(new docx.Paragraph({
            children: [new docx.TextRun({ text: block.title || '', size: 24 })],
            spacing: { after: 240 }
          }));
        });
      }
    } else if (sections.signatureBlock && sections.signatureBlock.line) {
      this._addWordSignature(children, sections.signatureBlock);
    }
  }

  /**
   * Add a signature block to Word doc children.
   */
  _addWordSignature(children, sigBlock) {
    children.push(new docx.Paragraph({ spacing: { before: 480 } }));
    children.push(new docx.Paragraph({
      children: [new docx.TextRun({ text: sigBlock.line || '_'.repeat(40), size: 24 })]
    }));
    children.push(new docx.Paragraph({
      children: [new docx.TextRun({ text: sigBlock.name || '[NAME]', size: 24 })]
    }));
    children.push(new docx.Paragraph({
      children: [new docx.TextRun({ text: sigBlock.title || '', size: 24 })]
    }));
    if (sigBlock.date) {
      children.push(new docx.Paragraph({
        children: [new docx.TextRun({ text: sigBlock.date, size: 24 })],
        spacing: { before: 120 }
      }));
    }
  }
}

module.exports = PDFService;
