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
      lineHeight: 2.0,
      bufferPages: true  // CRITICAL: Required for switchToPage() and bufferedPageRange()
    };

    // Footer configuration
    this.FOOTER_FONT_SIZE = 10;
    this.FOOTER_HEIGHT = 15;
    this.FOOTER_BOTTOM_MARGIN = 36;
    this.MIN_CONTENT_FOOTER_GAP = 20;
    
    // CRITICAL: Reduce effective page height to reserve space for footer
    this.EFFECTIVE_PAGE_HEIGHT = 792 - 72 - this.FOOTER_BOTTOM_MARGIN - this.FOOTER_HEIGHT - this.MIN_CONTENT_FOOTER_GAP;
  }

  async generatePDF(document, options = {}) {
    const { documentId, userId } = options;
    
    try {
      const documentsDir = path.join(__dirname, '..', 'documents');
      await fs.mkdir(documentsDir, { recursive: true });
      
      const filename = `affidavit-${documentId || Date.now()}.pdf`;
      const filepath = path.join(documentsDir, filename);
      
      return new Promise((resolve, reject) => {
        const doc = new PDFDocument(this.defaultOptions);
        const stream = doc.pipe(require('fs').createWriteStream(filepath));
        
        try {
          // PASS 1: Render all content
          this.buildPDF(doc, document);

          // ✅ CRITICAL: Get total page count BEFORE flushing
          // flushPages() clears the buffer, so we must get count first!
          const range = doc.bufferedPageRange();
          const totalPages = range.count;

          // PASS 2: Add footers to all pages with correct total
          // Pages are still in buffer, so switchToPage will work
          for (let pageNum = 0; pageNum < totalPages; pageNum++) {
            doc.switchToPage(pageNum); // 0-indexed: 0, 1, 2, ...

            const pageHeight = doc.page.height;
            const footerY = pageHeight - this.FOOTER_BOTTOM_MARGIN;

            // Save current position
            const savedY = doc.y;
            const savedX = doc.x;

            // Add footer (pageNum + 1 for display: 1, 2, 3, ...)
            doc.fontSize(this.FOOTER_FONT_SIZE).font('Times-Roman');
            doc.text(
              `Page ${pageNum + 1} of ${totalPages} • Created with Discover.Legal`,
              doc.page.margins.left,
              footerY,
              {
                width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
                align: 'center',
                lineBreak: false
              }
            );

            // Restore position
            doc.y = savedY;
            doc.x = savedX;
          }

          // ✅ OPTIONAL: Flush pages after adding footers (or let doc.end() handle it)
          // This writes all buffered pages to the stream
          if (typeof doc.flushPages === 'function') {
            doc.flushPages();
          }
          
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

  buildPDF(doc, document) {
    const { sections, metadata } = document;

    // Header
    if (sections.header) {
      doc.fontSize(16).font('Times-Bold');
      doc.text(sections.header, { align: 'center' });
      doc.moveDown(0.5);
    }

    // Venue
    if (sections.venue) {
      this.checkPageBreak(doc);
      doc.fontSize(14).font('Times-Bold');
      doc.text(sections.venue, { align: 'center' });
      doc.moveDown(0.5);
    }

    // Case Caption
    if (sections.caseCaption) {
      this.checkPageBreak(doc, 120);
      doc.fontSize(12).font('Times-Roman');
      doc.text(this.getFormatted(sections.caseCaption), { align: 'center' });
      doc.moveDown(0.5);

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

      const titleWidth = doc.widthOfString(sections.title);
      const titleX = (doc.page.width - titleWidth) / 2;
      doc.moveTo(titleX, doc.y + 2)
         .lineTo(titleX + titleWidth, doc.y + 2)
         .stroke();

      doc.moveDown(1.5);
    }

    // Introduction
    if (sections.introduction) {
      this.checkPageBreak(doc);
      doc.fontSize(12).font('Times-Roman');
      doc.text(sections.introduction, {
        align: 'justify',
        indent: 36
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
          if (sections.conclusion) spaceForEverything += 80;
          if (sections.perjuryStatement) spaceForEverything += 80;
          if (sections.signatureBlock) spaceForEverything += 120;

          let notarySpace = 200;
          if (sections.notaryInstruction) {
            const instructionHeight = this.estimateTextHeight(doc, sections.notaryInstruction, 10) + 40;
            notarySpace = instructionHeight + 180 + 40;
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
            doc.addPage();
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
          lineBreak: true
        });

        doc.x = doc.page.margins.left;
        doc.moveDown(1.0);
        
        renderedFactCount++;
      });
    }

    // Conclusion
    if (sections.conclusion) {
      this.checkPageBreak(doc, 80);
      doc.fontSize(12).font('Times-Roman');
      doc.text(sections.conclusion, {
        align: 'justify',
        indent: 36
      });
      doc.moveDown(1.5);
    }

    // Perjury Statement
    if (sections.perjuryStatement) {
      this.checkPageBreak(doc, 80);
      doc.fontSize(12).font('Times-Roman');
      doc.text(sections.perjuryStatement, {
        align: 'justify',
        indent: 36
      });
      doc.moveDown(2.0);
    }

    // Signature Block
    if (sections.signatureBlock) {
      this.checkPageBreak(doc, 120);
      
      doc.fontSize(12).font('Times-Roman');
      doc.moveDown();
      
      doc.text(sections.signatureBlock.line || '_'.repeat(40));
      doc.moveDown(0.3);
      doc.text(sections.signatureBlock.name || '[AFFIANT NAME]');
      doc.moveDown(0.3);
      doc.text(sections.signatureBlock.title || 'Affiant');

      if (sections.signatureBlock.date) {
        doc.moveDown(0.5);
        doc.text(sections.signatureBlock.date);
      }

      doc.moveDown(1.5);
    }

    // Utah Notary Instruction and Block
    if (sections.notaryInstruction && sections.notaryBlock) {
      const instructionHeight = this.estimateTextHeight(doc, sections.notaryInstruction, 10) + 40;
      const notaryHeight = 180;
      const totalHeight = instructionHeight + notaryHeight + 40;
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
      doc.rect(
        doc.page.margins.left - 5,
        startY - 5,
        doc.page.width - doc.page.margins.left - doc.page.margins.right + 10,
        endY - startY + 10
      ).stroke('#0066cc');

      doc.fillColor('#000000');
      doc.fontSize(12).font('Times-Roman');
      doc.moveDown(1.0);

      if (sections.notaryBlock) {
        const remainingSpace = this.EFFECTIVE_PAGE_HEIGHT - doc.y;
        if (remainingSpace < 200) {
          doc.addPage();
        }
      }
    }

    if (sections.notaryBlock) {
      if (!sections.notaryInstruction) {
        this.checkPageBreak(doc, 200);
      }

      const startY = doc.y;
      doc.fontSize(12).font('Times-Roman');
      this.renderNotaryBlock(doc, sections.notaryBlock);

      const endY = doc.y + 10;
      const borderMargin = 10;
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
      doc.addPage();
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