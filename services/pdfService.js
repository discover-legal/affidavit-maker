// services/pdfService.js - TWO-PASS APPROACH
// Pass 1: Render all content (know total pages)
// Pass 2: Add footers with correct page numbers

const PDFDocument = require('pdfkit');
const fs = require('fs').promises;
const path = require('path');
const previewRenderer = require('./previewRenderer');
const { prepareFactsForDisplay } = require('../utils/factNormalizer');

class PDFService {
  constructor() {
    this.defaultOptions = {
      size: 'letter',
      margins: { top: 72, bottom: 72, left: 72, right: 72 },
      font: 'Times-Roman',
      fontSize: 12,
      bufferPages: true  // CRITICAL: Required for switchToPage() and bufferedPageRange()
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

  async generatePDF(document, options = {}) {
    const { documentId, userId } = options;

    try {
      const documentsDir = path.join(__dirname, '..', 'documents');
      await fs.mkdir(documentsDir, { recursive: true });

      const filename = `affidavit-${documentId || Date.now()}.pdf`;
      const filepath = path.join(documentsDir, filename);

      return new Promise((resolve, reject) => {
        // PASS 1: Count total pages by rendering to a dummy document
        const dummyDoc = new PDFDocument(this.defaultOptions);
        dummyDoc.pipe(require('stream').PassThrough()); // Pipe to nowhere
        this.buildPDF(dummyDoc, document, false); // false = no footers
        const totalPages = dummyDoc.bufferedPageRange().count;
        dummyDoc.end();

        // PASS 2: Render actual PDF with footers
        const doc = new PDFDocument(this.defaultOptions);
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
              success: true
            });
          });

          stream.on('error', reject);
        } catch (error) {
          reject(error);
        }
      });
    } catch (error) {
      console.error('PDF generation error:', error);
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
    const { sections, metadata } = document;

    // Track current page for footer rendering
    this.shouldAddFooters = addFooters;
    if (addFooters) {
      this.currentPage = 1;
      this.addingFooter = false;
    }

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
        lineGap: 6  // 0.5 * fontSize (12pt) = 6pt for 1.5x line height
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

          let notarySpace = 155; // Reduced from 180 for more accurate space calculation
          if (sections.notaryInstruction) {
            const instructionHeight = this.estimateTextHeight(doc, sections.notaryInstruction, 10) + 20;
            notarySpace = instructionHeight + 145 + 20; // More accurate notary block estimation
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

        doc.fontSize(12).font('Times-Roman');
        const numberText = `${fact.number}. `;
        const numberWidth = doc.widthOfString(numberText);
        const textWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
        const currentX = doc.page.margins.left;
        const currentY = doc.y;

        doc.text(numberText, currentX, currentY, {
          continued: false,
          width: numberWidth,
          lineBreak: false
        });

        doc.text(fact.content, currentX + numberWidth, currentY, {
          align: 'justify',
          width: textWidth - numberWidth,
          lineBreak: true,
          lineGap: 6  // 0.5 * fontSize (12pt) = 6pt for 1.5x line height
        });

        doc.x = doc.page.margins.left;
        doc.moveDown(1.0);
        
        renderedFactCount++;
      });
    }

    // Conclusion
    if (sections.conclusion) {
      this.checkPageBreak(doc, 60);
      doc.fontSize(12).font('Times-Roman');
      doc.text(sections.conclusion, {
        align: 'justify',
        indent: 36,
        lineGap: 6  // 0.5 * fontSize (12pt) = 6pt for 1.5x line height
      });
      doc.moveDown(1.5);
    }

    // Perjury Statement
    if (sections.perjuryStatement) {
      this.checkPageBreak(doc, 60);
      doc.moveDown(1.5); // Total spacing with conclusion = 24+24=48px (matches CSS margin collapse)
      doc.fontSize(12).font('Times-Roman');
      doc.text(sections.perjuryStatement, {
        align: 'justify',
        indent: 36,
        lineGap: 6  // 0.5 * fontSize (12pt) = 6pt for 1.5x line height
      });
      doc.moveDown(1.5); // Spacing after perjury to match preview (24px = 1.5 moveDown)
    }

    // Signature Block
    if (sections.signatureBlock) {
      this.checkPageBreak(doc, 100);

      doc.moveDown(1.5); // Total spacing with perjury = 24+24=48px (matches CSS margin collapse)
      doc.fontSize(12).font('Times-Roman');

      doc.text(sections.signatureBlock.line || '_'.repeat(40));
      doc.moveDown(0.3);
      doc.text(sections.signatureBlock.name || '[AFFIANT NAME]');
      doc.moveDown(0.3);
      doc.text(sections.signatureBlock.title || 'Affiant');

      if (sections.signatureBlock.date) {
        doc.moveDown(0.5);
        doc.text(sections.signatureBlock.date);
      }

      doc.moveDown(1.5); // Spacing after signature to match preview (24px = 1.5 moveDown)
    }

    // Utah Notary Instruction and Block
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
          width: doc.page.width - doc.page.margins.left - doc.page.margins.right
        });
      });

      const endY = doc.y + 5;
      const instructionBorderMargin = 10; // Match notary block border margin
      doc.rect(
        doc.page.margins.left - instructionBorderMargin,
        startY - 5,
        doc.page.width - doc.page.margins.left - doc.page.margins.right + (instructionBorderMargin * 2),
        endY - startY + 10
      ).stroke('#0066cc');

      // Reset colors and add spacing to match preview (24px)
      doc.fillColor('#000000');
      doc.strokeColor('#000000'); // Reset stroke color to black for subsequent borders
      doc.fontSize(12).font('Times-Roman');
      doc.moveDown(1.5); // 1.5 * 12pt = 18pt = 24px (matches preview margin-bottom)

      if (sections.notaryBlock) {
        const remainingSpace = this.EFFECTIVE_PAGE_HEIGHT - doc.y;
        if (remainingSpace < 155) { // Reduced from 180 for more accurate space calculation
          this.addPageWithFooter(doc);
        }
      }
    }

    if (sections.notaryBlock) {
      if (!sections.notaryInstruction) {
        this.checkPageBreak(doc, 155); // Reduced from 180 for more accurate space calculation
        doc.moveDown(1.5); // Total spacing = 24+24=48px (matches CSS margin collapse)
      }

      const startY = doc.y;
      const borderMargin = 10;

      // Estimate notary block height
      const estimatedHeight = this.estimateTextHeight(doc, sections.notaryBlock, 12) + 20;

      // Draw background fill FIRST (light gray) to match preview
      doc.fillColor('#f9f9f9');
      doc.rect(
        doc.page.margins.left - borderMargin,
        startY - borderMargin,
        doc.page.width - doc.page.margins.left - doc.page.margins.right + (borderMargin * 2),
        estimatedHeight + (borderMargin * 2)
      ).fill();

      // Reset fill color to black BEFORE rendering text
      doc.fillColor('#000000');

      // NOW render the text on top of the background
      doc.fontSize(12).font('Times-Roman');
      this.renderNotaryBlock(doc, sections.notaryBlock);

      const endY = doc.y + 10;

      // Draw border on top
      doc.rect(
        doc.page.margins.left - borderMargin,
        startY - borderMargin,
        doc.page.width - doc.page.margins.left - doc.page.margins.right + (borderMargin * 2),
        endY - startY + (borderMargin * 2)
      ).stroke();
    }

    // Add footer to the last page
    if (this.shouldAddFooters && !this.addingFooter) {
      this.addFooter(doc);
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
}

module.exports = PDFService;