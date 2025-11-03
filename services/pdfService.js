// services/pdfService.js - FIXED VERSION with Notary Block Protection + Critical Rendering Fixes
//
// CRITICAL FIX (Nov 2025) - Text Overlapping Issue:
// PROBLEM: Text was literally overlapping (same Y coordinate) due to PDFKit's
//          handling of continued: true combined with width/lineGap parameters
//
// ROOT CAUSE: Using continued: true with width and lineGap caused PDFKit to
//             not advance the Y position, resulting in all text rendering at
//             the same position on the page
//
// SOLUTION:
// 1. Removed continued: true approach for facts rendering
// 2. Replaced with explicit X,Y positioning for number and content
// 3. Removed all lineGap parameters (they conflicted with text positioning)
// 4. Used moveDown() calls for spacing instead
// 5. Fixed case caption alignment from right to center
// 6. Added visual borders for case caption and title underline
//
// These changes ensure PDF renders correctly with proper text positioning
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
      lineHeight: 2.0  // Double spacing to match preview
    };
  }

  async generatePDF(document, options = {}) {
    const { documentId, userId } = options;
    
    try {
      // Ensure documents directory exists
      const documentsDir = path.join(__dirname, '..', 'documents');
      await fs.mkdir(documentsDir, { recursive: true });
      
      const filename = `affidavit-${documentId || Date.now()}.pdf`;
      const filepath = path.join(documentsDir, filename);
      
      return new Promise((resolve, reject) => {
        const doc = new PDFDocument(this.defaultOptions);
        const stream = doc.pipe(require('fs').createWriteStream(filepath));
        
        try {
          this.buildPDF(doc, document);
          doc.end();
          
          stream.on('finish', () => {
            resolve({
              filepath,
              filename,
              pages: this.calculatePages(document),
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
    let currentPage = 1;
    const pageHeight = doc.page.height;
    const bottomMargin = doc.page.margins.bottom;

    // Track page usage for multi-page support
    this.addPageFooter(doc, currentPage, metadata);

    // Header
    if (sections.header) {
      doc.fontSize(16).font('Times-Bold');
      doc.text(sections.header, { align: 'center' });
      doc.moveDown(0.5);
    }

    // Venue
    if (sections.venue) {
      this.checkPageBreak(doc, 60);
      doc.fontSize(14).font('Times-Bold');
      doc.text(sections.venue, { align: 'center' });
      doc.moveDown(0.5);
    }

    // Case Caption
    if (sections.caseCaption) {
      this.checkPageBreak(doc, 120);  // Increased for caption + border
      const captionStartY = doc.y;
      doc.fontSize(12).font('Times-Roman');
      doc.text(this.getFormatted(sections.caseCaption), { align: 'center' });
      doc.moveDown(0.5);

      // Draw underline border for case caption
      const borderY = doc.y;
      doc.moveTo(doc.page.margins.left, borderY)
         .lineTo(doc.page.width - doc.page.margins.right, borderY)
         .stroke();

      doc.moveDown(1.0);
    }

    // Title
    if (sections.title) {
      this.checkPageBreak(doc, 60);
      doc.fontSize(14).font('Times-Bold');
      const titleY = doc.y;
      doc.text(sections.title, { align: 'center' });

      // Draw underline for title
      const titleWidth = doc.widthOfString(sections.title);
      const titleX = (doc.page.width - titleWidth) / 2;
      doc.moveTo(titleX, doc.y + 2)
         .lineTo(titleX + titleWidth, doc.y + 2)
         .stroke();

      doc.moveDown(1.5);
    }

    // Introduction
    if (sections.introduction) {
      this.checkPageBreak(doc, 60);
      doc.fontSize(12).font('Times-Roman');
      doc.text(sections.introduction, {
        align: 'justify',
        indent: 36
      });
      doc.moveDown(1.5);
    }

    // ✅ CRITICAL FIX: Facts Section with Notary Block Protection
    const factsList = this.getFactsArray(sections.facts);
    if (factsList.length > 0) {
      // Track which facts we've rendered
      let renderedFactCount = 0;
      
      factsList.forEach((fact, index) => {
        const estimatedHeight = this.estimateTextHeight(doc, fact.content, 12) + 20;
        
        // ✅ NOTARY PROTECTION LOGIC
        // If this is the last fact OR second-to-last fact, check if there's room for:
        // - This fact + remaining facts + conclusion + signature + notary block
        const isNearEnd = index >= factsList.length - 2;
        
        if (isNearEnd) {
          // Calculate space needed for everything that follows
          let spaceNeeded = estimatedHeight; // This fact
          
          // Add remaining facts
          for (let i = index + 1; i < factsList.length; i++) {
            spaceNeeded += this.estimateTextHeight(doc, factsList[i].content, 12) + 20;
          }
          
          // Add conclusion space
          if (sections.conclusion) {
            spaceNeeded += 80;
          }
          
          // Add perjury statement space
          if (sections.perjuryStatement) {
            spaceNeeded += 80;
          }
          
          // Add signature block space
          if (sections.signatureBlock) {
            spaceNeeded += 120;
          }
          
          // Add notary block space (with buffer)
          if (sections.notaryBlock) {
            spaceNeeded += 250; // Notary block + buffer
          }
          
          // ✅ KEY DECISION: If everything won't fit, start new page NOW
          // This ensures at least one fact stays with the notary block
          const currentY = doc.y;
          const pageHeight = doc.page.height;
          const bottomMargin = doc.page.margins.bottom;
          const availableSpace = pageHeight - bottomMargin - 50 - currentY;
          
          if (availableSpace < spaceNeeded && renderedFactCount > 0) {
            // Force page break - this keeps last fact(s) with notary
            doc.addPage();
            const newPageNumber = this.getCurrentPageNumber(doc);
            this.addPageFooter(doc, newPageNumber, metadata);
          }
        } else {
          // Normal page break for earlier facts
          this.checkPageBreak(doc, estimatedHeight);
        }

        // Render the fact - Fixed approach to avoid text overlapping
        doc.fontSize(12).font('Times-Roman');

        // Calculate hanging indent for numbered list
        const numberText = `${fact.number}. `;
        const numberWidth = doc.widthOfString(numberText);
        const textWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

        // Render fact with hanging indent (number outdented)
        const currentX = doc.x;
        const currentY = doc.y;

        // Draw the number
        doc.text(numberText, currentX, currentY, {
          continued: false,
          width: numberWidth,
          lineBreak: false
        });

        // Draw the content with indent to align after number
        doc.text(fact.content, currentX + numberWidth, currentY, {
          align: 'justify',
          width: textWidth - numberWidth,
          lineBreak: true
        });

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
      
      // Signature line
      doc.text(sections.signatureBlock.line || '_'.repeat(40));
      doc.moveDown(0.3);
      doc.text(sections.signatureBlock.name || '[AFFIANT NAME]');
      doc.moveDown(0.3);
      doc.text(sections.signatureBlock.title || 'Affiant');

      if (sections.signatureBlock.date) {
        doc.moveDown(0.5);
        doc.text(sections.signatureBlock.date);
      }
      
      doc.moveDown(2);
    }

    // ✅ Notary Block - Should never be orphaned now
    if (sections.notaryBlock) {
      // Final safety check - but should rarely trigger due to protection above
      this.checkPageBreak(doc, 200);
      
      const startY = doc.y;
      doc.fontSize(12).font('Times-Roman');
      
      // Notary content
      const notaryLines = sections.notaryBlock.split('\n');
      notaryLines.forEach((line, idx) => {
        if (idx > 0) doc.moveDown(0.3);
        doc.text(line);
      });
      
      // Draw border around notary section
      const endY = doc.y + 10;
      const borderMargin = 10;
      doc.rect(
        doc.page.margins.left - borderMargin, 
        startY - borderMargin,
        doc.page.width - doc.page.margins.left - doc.page.margins.right + (borderMargin * 2),
        endY - startY + (borderMargin * 2)
      ).stroke();
    }

    // Add final page footer
    this.addPageFooter(doc, this.getCurrentPageNumber(doc), metadata);
  }

  checkPageBreak(doc, neededSpace) {
    const currentY = doc.y;
    const pageHeight = doc.page.height;
    const bottomMargin = doc.page.margins.bottom;
    
    if (currentY + neededSpace > pageHeight - bottomMargin - 50) {
      doc.addPage();
      const newPageNumber = this.getCurrentPageNumber(doc);
      this.addPageFooter(doc, newPageNumber, doc.metadata);
    }
  }

  addPageFooter(doc, pageNumber, metadata) {
    const originalY = doc.y;
    const pageHeight = doc.page.height;
    const bottomMargin = doc.page.margins.bottom;
    
    // Move to footer position
    doc.y = pageHeight - bottomMargin + 20;
    
    doc.fontSize(10).font('Times-Roman');
    doc.text(
      `Page ${pageNumber} • Generated by Discover.Legal • ${new Date().toLocaleDateString()}`,
      doc.page.margins.left,
      doc.y,
      {
        width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
        align: 'center'
      }
    );
    
    // Restore position if not at end
    if (originalY < pageHeight - bottomMargin - 100) {
      doc.y = originalY;
    }
  }

  getCurrentPageNumber(doc) {
    return doc._pageBuffer.length;
  }

  calculatePages(document) {
    const { sections } = document;
    let estimatedHeight = 0;
    
    // Header and venue: ~100px
    estimatedHeight += 100;
    
    // Facts
    const factsForCalc = sections && sections.facts ? this.getFactsArray(sections.facts) : [];
    estimatedHeight += factsForCalc.length * 40;
    
    // Other sections: ~200px total
    estimatedHeight += 200;
    
    // Letter size page is ~720px usable height
    return Math.max(1, Math.ceil(estimatedHeight / 720));
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

    // FIXED: Handle facts.items format from StateTemplateManager
    // Facts are already processed and numbered correctly - don't re-process
    if (factsSection.items && Array.isArray(factsSection.items)) {
      return factsSection.items.map((fact) => ({
        number: fact.number || 0,
        content: fact.content || ''
      }));
    }

    // Legacy support: Handle raw array format (shouldn't happen with StateTemplateManager)
    if (Array.isArray(factsSection)) {
      const prepared = prepareFactsForDisplay(factsSection);
      return prepared.map(f => ({
        number: f.index || f.number || 0,
        content: f.displayContent || f.content || ''
      }));
    }

    // Legacy support: Handle formatted string
    const formatted = this.getFormatted(factsSection);
    if (formatted && typeof formatted === 'string') {
      const parts = formatted.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
      return parts.map((p, idx) => ({ number: idx + 1, content: p }));
    }

    // Last resort: Try to extract from object
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
}

module.exports = PDFService;
