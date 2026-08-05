// services/pdfService.js - TWO-PASS APPROACH
// Pass 1: Render all content (know total pages)
// Pass 2: Add footers with correct page numbers
// Supports: affidavits, divorce petitions, divorce decrees, + Word (.docx)

const PDFDocument = require('pdfkit');
const fs = require('fs').promises;
const fssync = require('fs');
const path = require('path');
const previewRenderer = require('./previewRenderer');
const { makeSectionPrefixer } = require('../utils/sectionNumbering');
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

class PDFService {
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

    // Footer configuration
    this.FOOTER_FONT_SIZE = 10;
    this.FOOTER_HEIGHT = 15;
    this.FOOTER_BOTTOM_MARGIN = 36;
    this.MIN_CONTENT_FOOTER_GAP = 10; // Reduced from 20 to allow more content per page

    // CRITICAL: Set effective page height to reserve space for footer
    // This is the maximum Y coordinate before page break (not the available height)
    // Available space = EFFECTIVE_PAGE_HEIGHT - doc.y (where doc.y starts at 72)
    // Formula: 792 (page height) - footer reserves = max Y coordinate
    this.EFFECTIVE_PAGE_HEIGHT = 792 - this.FOOTER_BOTTOM_MARGIN - this.FOOTER_HEIGHT - this.MIN_CONTENT_FOOTER_GAP;
  }

  /**
   * Detect document type from sections shape.
   * Returns 'petition', 'decree', or 'affidavit' (default).
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
    const state = document.state || document.metadata?.state || 'TX';
    if (A4_JURISDICTIONS.has(state)) {
      return { ...this.a4Options };
    }
    return { ...this.defaultOptions };
  }

  async generatePDF(document, options = {}) {
    // documentId no longer names the output file (generation happens in a
    // private mkdtemp workDir) but is still required to authorize exhibits.
    const { documentId, userId } = options;
    let workDir;

    try {
      const documentsDir = path.resolve(
        process.env.DOCUMENTS_PATH || path.join(__dirname, '..', 'documents')
      );
      await fs.mkdir(documentsDir, { recursive: true });

      workDir = await fs.mkdtemp(path.join(documentsDir, '.generation-'));
      await fs.chmod(workDir, 0o700);
      const docType = this.detectDocumentType(document);
      const prefix = docType === 'petition' ? 'petition' : docType === 'decree' ? 'decree' : 'affidavit';
      const filename = `${prefix}.pdf`;
      const filepath = path.join(workDir, filename);
      const pageOptions = this.getPageOptions(document);

      // Update effective page height for A4 if needed
      const pageHeight = pageOptions.size === 'A4' ? 841.89 : 792;
      this.EFFECTIVE_PAGE_HEIGHT = pageHeight - this.FOOTER_BOTTOM_MARGIN - this.FOOTER_HEIGHT - this.MIN_CONTENT_FOOTER_GAP;

      // Generate base PDF
      const result = await new Promise((resolve, reject) => {
        // PASS 1: Count total pages by rendering to a dummy document
        const dummyDoc = new PDFDocument(pageOptions);
        dummyDoc.pipe(require('stream').PassThrough()); // Pipe to nowhere
        this.buildPDF(dummyDoc, document, false); // false = no footers
        const totalPages = dummyDoc.bufferedPageRange().count;
        dummyDoc.end();

        // PASS 2: Render actual PDF with footers
        const doc = new PDFDocument(pageOptions);
        const stream = doc.pipe(require('fs').createWriteStream(filepath));

        // Set up page numbering for pass 2
        this.totalPages = totalPages;

        try {
          this.buildPDF(doc, document, true); // true = add footers
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

        if (userId && documentId && Array.isArray(facts) && facts.length > 0) {
          await this.appendExhibits(filepath, facts, state, userId, documentId);
        } else if (Array.isArray(facts) && facts.some(f => f?.type === 'evidence')) {
          logger.warn('Skipping exhibits - authenticated user and owned document are required');
        }
      }

      return result;
    } catch (error) {
      if (workDir) {
        await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
      }
      logger.error('PDF generation error', { error: error.message });
      throw error;
    }
  }

  /**
   * Generate Word (.docx) document from the same document data.
   * Returns { filepath, filename, documentType, success }.
   */
  async generateWordDoc(document, options = {}) {
    const documentsDir = path.resolve(
      process.env.DOCUMENTS_PATH || path.join(__dirname, '..', 'documents')
    );
    await fs.mkdir(documentsDir, { recursive: true });

    const workDir = await fs.mkdtemp(path.join(documentsDir, '.generation-'));
    await fs.chmod(workDir, 0o700);
    const docType = this.detectDocumentType(document);
    const prefix = docType === 'petition' ? 'petition' : docType === 'decree' ? 'decree' : 'affidavit';
    const filename = `${prefix}.docx`;
    const filepath = path.join(workDir, filename);

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
              size: A4_JURISDICTIONS.has(document.state || document.metadata?.state || 'TX')
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
      await fs.rm(workDir, { recursive: true, force: true }).catch(() => {});
      logger.error('Word generation error', { error: error.message });
      throw error;
    }
  }

  addPageWithFooter(doc) {
    // Add footer to current page before creating new page
    if (this.shouldAddFooters && !this.addingFooter) {
      this.addFooter(doc);
    }

    // Add new page
    doc.addPage();

    // Increment page counter
    if (this.shouldAddFooters) {
      this.currentPage++;
    }
  }

  addFooter(doc) {
    // Prevent recursive footer addition
    this.addingFooter = true;

    const pageHeight = doc.page.height;
    const footerY = pageHeight - this.FOOTER_BOTTOM_MARGIN;

    // Save current state
    const savedY = doc.y;
    const savedX = doc.x;
    const savedFont = doc._font;
    const savedFontSize = doc._fontSize;

    // CRITICAL: Move cursor to a safe position to prevent page break
    // Set Y to a position well within the page margins
    doc.y = Math.min(savedY, this.EFFECTIVE_PAGE_HEIGHT - 50);

    // Use direct PDF text positioning to place footer outside normal flow
    const footerText = `Page ${this.currentPage} of ${this.totalPages} • Created with Discover.Legal`;
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

    this.addingFooter = false;
  }

  buildPDF(doc, document, addFooters = false) {
    const { sections } = document;

    // Track current page for footer rendering
    this.shouldAddFooters = addFooters;
    if (addFooters) {
      this.currentPage = 1;
      this.addingFooter = false;
    }

    const docType = this.detectDocumentType(document);

    switch (docType) {
      case 'petition':
        this.buildPetitionPDF(doc, sections);
        break;
      case 'decree':
        this.buildDecreePDF(doc, sections);
        break;
      default:
        this.buildAffidavitPDF(doc, sections);
        break;
    }

    // Add footer to the last page
    if (this.shouldAddFooters && !this.addingFooter) {
      this.addFooter(doc);
    }
  }

  // ─── AFFIDAVIT PDF BUILDER (original) ──────────────────────────────────────

  buildAffidavitPDF(doc, sections) {
    // Header
    if (sections.header) {
      doc.fontSize(16).font('Times-Bold');
      doc.text(sections.header, { align: 'center' });
      doc.moveDown(1.5);
    }

    // Venue
    if (sections.venue) {
      this.checkPageBreak(doc);
      doc.fontSize(14).font('Times-Bold');
      doc.text(sections.venue, { align: 'center' });
      doc.moveDown(1.5);
    }

    // Case Caption
    if (sections.caseCaption) {
      this.checkPageBreak(doc, 120);
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
      this.checkPageBreak(doc);
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
      this.checkPageBreak(doc);
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

          const availableSpace = this.EFFECTIVE_PAGE_HEIGHT - doc.y;

          if (availableSpace >= spaceForEverything) {
            this.checkPageBreak(doc, estimatedHeight);
          }
          else if (renderedFactCount > 0) {
            doc.moveDown(1.5);
            doc.fontSize(11).font('Times-Italic');
            doc.text('(Continued on next page)', { align: 'center' });
            doc.font('Times-Roman').fontSize(12);
            this.addPageWithFooter(doc);
          }
          else {
            this.checkPageBreak(doc, estimatedHeight);
          }
        } else {
          this.checkPageBreak(doc, estimatedHeight);
        }

        this.renderNumberedParagraph(doc, fact.number, fact.content);
        doc.moveDown(1.0);
        renderedFactCount++;
      });
    }

    // Keep closing sections together: conclusion, perjury, signature, and notary block
    // Estimate the combined height so they don't get split across pages
    {
      let closingHeight = 0;
      if (sections.conclusion) {
        closingHeight += this.estimateTextHeight(doc, sections.conclusion, 12) + 36; // text + spacing
      }
      if (sections.perjuryStatement) {
        closingHeight += this.estimateTextHeight(doc, sections.perjuryStatement, 12) + 54; // text + moveDown(1.5)*3
      }
      if (sections.signatureBlock) {
        closingHeight += 100 + 18; // signature lines + spacing
      }
      if (sections.notaryInstruction) {
        closingHeight += this.estimateTextHeight(doc, sections.notaryInstruction, 10) + 50;
      }
      if (sections.notaryBlock) {
        closingHeight += this.estimateTextHeight(doc, sections.notaryBlock, 12) + 40;
      }

      const availableSpace = this.EFFECTIVE_PAGE_HEIGHT - doc.y;
      if (closingHeight > 0 && closingHeight > availableSpace) {
        // If the entire closing block won't fit, start a new page
        // (unless we're already at the top of a page)
        if (doc.y > doc.page.margins.top + 20) {
          this.addPageWithFooter(doc);
        }
      }
    }

    // Conclusion
    if (sections.conclusion) {
      this.checkPageBreak(doc, 60);
      doc.fontSize(12).font('Times-Roman');
      doc.text(sections.conclusion, { align: 'justify', indent: 36, lineGap: 6 });
      doc.moveDown(1.5);
    }

    // Perjury Statement
    if (sections.perjuryStatement) {
      this.checkPageBreak(doc, 60);
      doc.moveDown(1.5);
      doc.fontSize(12).font('Times-Roman');
      doc.text(sections.perjuryStatement, { align: 'justify', indent: 36, lineGap: 6 });
      doc.moveDown(1.5);
    }

    // Signature Block
    if (sections.signatureBlock) {
      this.renderAffiantSignature(doc, sections.signatureBlock);
    }

    // Notary Instruction + Block
    this.renderNotarySection(doc, sections);
  }

  // ─── PETITION PDF BUILDER ──────────────────────────────────────────────────

  buildPetitionPDF(doc, sections) {
    // Header + Venue + Caption + Title (shared with affidavit)
    this.renderDocumentHeader(doc, sections);

    // Numbered-paragraph sections (I. PARTIES, II. JURISDICTION, III. MARRIAGE, etc.)
    const numberedSections = [
      'parties', 'jurisdiction', 'marriageInfo', 'grounds', 'childrenInfo', 'propertyInfo'
    ];

    for (const key of numberedSections) {
      const section = sections[key];
      if (!section || !section.title) continue;

      this.checkPageBreak(doc, 60);
      doc.fontSize(13).font('Times-Bold');
      doc.text(section.title, { align: 'center' });
      doc.moveDown(0.8);

      if (section.items && Array.isArray(section.items)) {
        section.items.forEach(item => {
          const estimatedHeight = this.estimateTextHeight(doc, item.content, 12) + 20;
          this.checkPageBreak(doc, estimatedHeight);

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
      this.checkPageBreak(doc, 80);
      doc.fontSize(13).font('Times-Bold');
      doc.text(sections.reliefRequested.title || 'PRAYER FOR RELIEF', { align: 'center' });
      doc.moveDown(0.8);

      if (sections.reliefRequested.items) {
        sections.reliefRequested.items.forEach(item => {
          this.checkPageBreak(doc, 30);
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
      this.checkPageBreak(doc, 80);
      doc.fontSize(13).font('Times-Bold');
      doc.text(sections.verification.title || 'VERIFICATION', { align: 'center' });
      doc.moveDown(0.8);

      doc.fontSize(12).font('Times-Roman');
      doc.text(sections.verification.text || '', { align: 'justify', indent: 36, lineGap: 6 });
      doc.moveDown(1.5);
    }

    // Signature Block (petitioner)
    if (sections.signatureBlock) {
      this.renderAffiantSignature(doc, sections.signatureBlock);
    }
  }

  // ─── DECREE PDF BUILDER ────────────────────────────────────────────────────

  buildDecreePDF(doc, sections) {
    // Header + Venue + Caption + Title (shared)
    this.renderDocumentHeader(doc, sections);

    // Text sections (appearances, jurisdiction, dissolution)
    const textSections = ['appearances', 'jurisdiction', 'dissolution'];
    for (const key of textSections) {
      const section = sections[key];
      if (!section || !section.title) continue;

      this.checkPageBreak(doc, 60);
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

      this.checkPageBreak(doc, 60);
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
        // Match the preview's per-section numbering (utils/sectionNumbering).
        const nextPrefix = makeSectionPrefixer(section.items);
        section.items.forEach(item => {
          const estimatedHeight = this.estimateTextHeight(doc, item.content, 12) + 15;
          this.checkPageBreak(doc, estimatedHeight);

          const prefix = nextPrefix(item);
          const bold = item.type === 'order';
          if (prefix) {
            // Trim the "N." prefix back to "N" — renderNumberedParagraph
            // adds the ". " separator itself.
            const m = prefix.match(/^(\S+)\.\s/);
            const label = m ? m[1] : prefix.replace(/\.\s*$/, '');
            this.renderNumberedParagraph(doc, label, item.content, { bold });
          } else {
            doc.fontSize(12).font(bold ? 'Times-Bold' : 'Times-Roman');
            doc.text(item.content, { align: 'justify', indent: 36, lineGap: 6 });
            doc.font('Times-Roman');
          }
          doc.moveDown(0.6);
        });
      }
      doc.moveDown(0.5);
    }

    // Name Change (text section, may be null)
    if (sections.nameChange && sections.nameChange.title) {
      this.checkPageBreak(doc, 60);
      doc.fontSize(13).font('Times-Bold');
      doc.text(sections.nameChange.title, { align: 'center' });
      doc.moveDown(0.8);

      doc.fontSize(12).font('Times-Roman');
      doc.text(sections.nameChange.text || '', { align: 'justify', indent: 36, lineGap: 6 });
      doc.moveDown(1.5);
    }

    // Judgment Block (judge signature)
    if (sections.judgmentBlock) {
      this.checkPageBreak(doc, 120);
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
      this.checkPageBreak(doc, 150);
      doc.moveDown(1);
      doc.fontSize(12).font('Times-Bold');
      doc.text(sections.signatureBlock.title || 'APPROVED AS TO FORM AND SUBSTANCE:', { align: 'left' });
      doc.moveDown(1.5);

      if (sections.signatureBlock.blocks) {
        sections.signatureBlock.blocks.forEach(block => {
          this.checkPageBreak(doc, 80);
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
      this.renderAffiantSignature(doc, sections.signatureBlock);
    }
  }

  // ─── SHARED PDF RENDERING HELPERS ──────────────────────────────────────────

  /**
   * Render common document header: header, venue, caption, title.
   */
  renderDocumentHeader(doc, sections) {
    if (sections.header) {
      doc.fontSize(16).font('Times-Bold');
      doc.text(sections.header, { align: 'center' });
      doc.moveDown(1.5);
    }

    if (sections.venue) {
      this.checkPageBreak(doc);
      doc.fontSize(14).font('Times-Bold');
      doc.text(sections.venue, { align: 'center' });
      doc.moveDown(1.5);
    }

    if (sections.caseCaption) {
      this.checkPageBreak(doc, 120);
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
      this.checkPageBreak(doc);
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
   *
   * `bold` keeps the operative-clause styling the decree relies on for
   * "IT IS ORDERED…" items — the function used to hard-code Times-Roman,
   * which silently dropped any bold the caller had set on the doc.
   */
  renderNumberedParagraph(doc, number, content, { bold = false } = {}) {
    doc.fontSize(12).font(bold ? 'Times-Bold' : 'Times-Roman');
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
    doc.font('Times-Roman');
  }

  /**
   * Render affiant/petitioner signature block.
   */
  renderAffiantSignature(doc, sigBlock) {
    this.checkPageBreak(doc, 100);
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
  renderNotarySection(doc, sections) {
    if (sections.notaryInstruction && sections.notaryBlock) {
      const instructionHeight = this.estimateTextHeight(doc, sections.notaryInstruction, 10) + 30;
      const notaryHeight = 155;
      const totalHeight = instructionHeight + notaryHeight + 30;
      this.checkPageBreak(doc, totalHeight);
    }

    if (sections.notaryInstruction) {
      if (!sections.notaryBlock) {
        this.checkPageBreak(doc, 150);
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
        const remainingSpace = this.EFFECTIVE_PAGE_HEIGHT - doc.y;
        if (remainingSpace < 155) {
          this.addPageWithFooter(doc);
        }
      }
    }

    if (sections.notaryBlock) {
      if (!sections.notaryInstruction) {
        this.checkPageBreak(doc, 155);
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

  checkPageBreak(doc, neededSpace = 60) {
    const availableSpace = this.EFFECTIVE_PAGE_HEIGHT - doc.y;

    if (neededSpace > availableSpace) {
      this.addPageWithFooter(doc);
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
   * Generate exhibit cover page using PDFKit
   */
  generateExhibitCoverPage(exhibitLabel, description, requireCoverPage) {
    if (!requireCoverPage) return null;

    return new Promise((resolve) => {
      const doc = new PDFDocument(this.defaultOptions);
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
   * Resolve an evidence key only when it belongs to the authenticated user
   * and the document whose ownership was checked by the route handler.
   */
  resolveEvidencePath(fileKey, userId, documentId) {
    if (typeof fileKey !== 'string' || !/^\d+$/.test(String(userId)) || !/^\d+$/.test(String(documentId))) {
      throw new Error('Invalid evidence authorization context');
    }

    // Must mirror services/evidenceStorage.js basePath resolution exactly:
    // EVIDENCE_STORAGE_PATH first, else <resolved DOCUMENTS_PATH>/evidence.
    const evidenceBasePath = process.env.EVIDENCE_STORAGE_PATH || path.join(
      path.resolve(process.env.DOCUMENTS_PATH || path.join(__dirname, '..', 'documents')),
      'evidence'
    );
    const candidate = validatePath(evidenceBasePath, fileKey);
    const expectedDir = path.resolve(evidenceBasePath, String(userId), String(documentId));
    const relative = path.relative(expectedDir, candidate);

    if (
      relative === ''
      || relative === '.'
      || relative.startsWith('..')
      || path.isAbsolute(relative)
      || relative.includes('\0')
    ) {
      throw new Error('Evidence does not belong to the authorized document');
    }

    return candidate;
  }

  /**
   * Append exhibits to PDF using pdf-lib
   */
  async appendExhibits(pdfPath, facts, state, userId, documentId) {
    logger.debug('Appending exhibits to PDF', {
      factsCount: facts?.length || 0,
      state,
      userId,
      documentId
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

      logger.info('Appending exhibits to PDF', { count: evidenceItems.length });

      // Load the main PDF
      const mainPdfBytes = await fs.readFile(pdfPath);
      const mainPdf = await PDFLib.load(mainPdfBytes);

      // Process each evidence item
      let totalEvidenceBytes = 0;
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
        let filePath;
        try {
          filePath = this.resolveEvidencePath(fileKey, userId, documentId);
        } catch (pathError) {
          logger.warn('Skipping exhibit - unauthorized or invalid path', { exhibitLabel });
          continue;
        }

        // Read the file directly — let fs.readFile throw if the file is
        // missing (no TOCTOU window between an existsSync check and the
        // read). We catch the ENOENT below.
        logger.debug('Attaching exhibit', { exhibitLabel });

        let fileBuffer;
        try {
          fileBuffer = await fs.readFile(filePath);
        } catch (readErr) {
          if (readErr && readErr.code === 'ENOENT') {
            logger.warn('Skipping evidence - file not found', { exhibitLabel });
          } else {
            logger.warn('Skipping evidence - read failed', { exhibitLabel, code: readErr?.code });
          }
          continue;
        }

        const maxFileSize = Math.min(
          Number(exhibitRules.maxFileSize) || 25 * 1024 * 1024,
          25 * 1024 * 1024
        );
        const maxTotalSize = Math.min(
          Number(exhibitRules.maxTotalSize) || 100 * 1024 * 1024,
          100 * 1024 * 1024
        );
        if (fileBuffer.length > maxFileSize) {
          logger.warn('Skipping evidence - file exceeds exhibit size limit', { exhibitLabel });
          continue;
        }
        if (totalEvidenceBytes + fileBuffer.length > maxTotalSize) {
          logger.warn('Stopping exhibits - total size limit reached', { exhibitLabel });
          break;
        }
        totalEvidenceBytes += fileBuffer.length;

        try {
          // Add cover page if required
          if (exhibitRules.requireCoverPage) {
            const coverPageBuffer = await this.generateExhibitCoverPage(
              exhibitLabel,
              description,
              exhibitRules.requireCoverPage
            );

            if (coverPageBuffer) {
              const coverPdf = await PDFLib.load(coverPageBuffer);
              const [coverPage] = await mainPdf.copyPages(coverPdf, [0]);
              mainPdf.addPage(coverPage);
            }
          }

          // SECURITY: identify the embedded file type by magic bytes, not by
          // user-controlled metadata (evidenceData.fileType / fileName). The
          // upload path validates magic bytes on the way in, but defense-in
          // -depth means we also refuse to treat a buffer as a PDF unless
          // its first bytes are `%PDF`. PDFLib.load() would fail loudly on
          // a non-PDF, but pdf-lib's error message is less actionable than
          // a deliberate refusal here.
          const PDF_MAGIC = Buffer.from([0x25, 0x50, 0x44, 0x46]); // %PDF
          const JPG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
          const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
          const head = fileBuffer.subarray(0, 8);
          const isPDF = head.subarray(0, 4).equals(PDF_MAGIC);
          const isJPG = head.subarray(0, 3).equals(JPG_MAGIC);
          const isPNG = head.subarray(0, 8).equals(PNG_MAGIC);

          if (!isPDF && !isJPG && !isPNG) {
            logger.warn('Skipping evidence - unrecognized magic bytes', {
              exhibitLabel,
              head: head.toString('hex'),
            });
            continue;
          }

          if (isPDF) {
            // Merge PDF
            const exhibitPdf = await PDFLib.load(fileBuffer);
            const pageIndices = exhibitPdf.getPageIndices();
            if (pageIndices.length < 1 || pageIndices.length > 500) {
              logger.warn('Skipping evidence - PDF page count exceeds safe limit', {
                exhibitLabel,
                pages: pageIndices.length,
              });
              continue;
            }
            const pages = await mainPdf.copyPages(exhibitPdf, pageIndices);
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
        // Same per-section numbering as preview/PDF (utils/sectionNumbering).
        const nextPrefix = makeSectionPrefixer(section.items);
        section.items.forEach(item => {
          const isBold = item.type === 'order';
          const prefix = nextPrefix(item);
          children.push(new docx.Paragraph({
            children: [new docx.TextRun({ text: `${prefix}${item.content}`, bold: isBold, size: 24 })],
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
