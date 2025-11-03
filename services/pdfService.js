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

    // FIXED: Don't add page footer at start - it will be added at the end
    // This was causing a blank first page issue

    // Header
    if (sections.header) {
      doc.fontSize(16).font('Times-Bold');
      doc.text(sections.header, { align: 'center' });
      doc.moveDown(0.5);
    }

    // Venue
    if (sections.venue) {
      this.checkPageBreak(doc, 60, metadata);
      doc.fontSize(14).font('Times-Bold');
      doc.text(sections.venue, { align: 'center' });
      doc.moveDown(0.5);
    }

    // Case Caption
    if (sections.caseCaption) {
      this.checkPageBreak(doc, 120, metadata);  // Increased for caption + border
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
      this.checkPageBreak(doc, 60, metadata);
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
      this.checkPageBreak(doc, 60, metadata);
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

        // ✅ NOTARY PROTECTION LOGIC - Only for the LAST fact
        // Only force a page break if the notary block would be orphaned alone on a new page
        const isLastFact = index === factsList.length - 1;

        if (isLastFact && sections.notaryBlock) {
          // Calculate space needed for: this fact + conclusion + signature (but NOT notary yet)
          let spaceForFactAndSignature = estimatedHeight;

          if (sections.conclusion) {
            spaceForFactAndSignature += 80;
          }

          if (sections.perjuryStatement) {
            spaceForFactAndSignature += 80;
          }

          if (sections.signatureBlock) {
            spaceForFactAndSignature += 120;
          }

          // Calculate space for notary block (use more conservative estimate)
          const notarySpace = 200;

          // Check current available space
          const currentY = doc.y;
          const pageHeight = doc.page.height;
          const bottomMargin = doc.page.margins.bottom;
          const availableSpace = pageHeight - bottomMargin - 50 - currentY;

          // If everything (fact + signature + notary) fits, use normal page break
          if (availableSpace >= spaceForFactAndSignature + notarySpace) {
            this.checkPageBreak(doc, estimatedHeight, metadata, true);
          }
          // If fact + signature fit but notary doesn't, the notary would be orphaned
          // In this case, force a page break to keep the fact with the notary
          else if (availableSpace >= spaceForFactAndSignature && renderedFactCount > 0) {
            // Add centered continuation indicator
            doc.moveDown(1.5);
            doc.fontSize(11).font('Times-Italic');
            doc.text('(Continued on next page)', {
              align: 'center'
            });
            doc.font('Times-Roman').fontSize(12);

            const currentPageNum = this.getCurrentPageNumber(doc);
            this.addPageFooter(doc, currentPageNum, metadata);
            doc.addPage();
          }
          // Otherwise, use normal page break
          else {
            this.checkPageBreak(doc, estimatedHeight, metadata, true);
          }
        } else {
          // Normal page break for non-last facts
          this.checkPageBreak(doc, estimatedHeight, metadata, true);
        }

        // Render the fact - Fixed approach to avoid text overlapping
        doc.fontSize(12).font('Times-Roman');

        // Calculate hanging indent for numbered list
        const numberText = `${fact.number}. `;
        const numberWidth = doc.widthOfString(numberText);
        const textWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

        // FIXED: Render fact with hanging indent, ensuring X position is reset
        // Always start from the left margin to prevent progressive indentation
        const currentX = doc.page.margins.left;
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

        // FIXED: Reset X position to left margin after rendering
        doc.x = doc.page.margins.left;
        doc.moveDown(1.0);
        
        renderedFactCount++;
      });
    }

    // Conclusion
    if (sections.conclusion) {
      this.checkPageBreak(doc, 80, metadata);
      doc.fontSize(12).font('Times-Roman');
      doc.text(sections.conclusion, {
        align: 'justify',
        indent: 36
      });
      doc.moveDown(1.5);
    }

    // Perjury Statement
    if (sections.perjuryStatement) {
      this.checkPageBreak(doc, 80, metadata);
      doc.fontSize(12).font('Times-Roman');
      doc.text(sections.perjuryStatement, {
        align: 'justify',
        indent: 36
      });
      doc.moveDown(2.0);
    }

    // Signature Block
    if (sections.signatureBlock) {
      this.checkPageBreak(doc, 120, metadata);
      
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

      doc.moveDown(1.5);
    }

    // FIXED: Utah Notary Instruction and Block - treat as single unit to prevent overlap
    // If both instruction and notary block exist, calculate total height needed
    if (sections.notaryInstruction && sections.notaryBlock) {
      // Calculate combined height for instruction + notary block
      const instructionHeight = this.estimateTextHeight(doc, sections.notaryInstruction, 10) + 30;
      const notaryHeight = 160; // Estimated notary block height (reduced to prevent excessive page breaks)
      const totalHeight = instructionHeight + notaryHeight + 20; // Reduced buffer

      // Check if both can fit, if not start new page
      this.checkPageBreak(doc, totalHeight, metadata);
    }

    // Utah Notary Instruction (rendered before notary block if present)
    if (sections.notaryInstruction) {
      // Don't check page break here if we have notary block (already checked above)
      if (!sections.notaryBlock) {
        this.checkPageBreak(doc, 150, metadata);
      }

      doc.fontSize(10).font('Times-Bold');
      doc.fillColor('#0066cc');

      // Render instruction in a highlighted box
      const startY = doc.y;
      const instructionLines = sections.notaryInstruction.split('\n');

      instructionLines.forEach(line => {
        doc.text(line, {
          align: 'left',
          width: doc.page.width - doc.page.margins.left - doc.page.margins.right
        });
      });

      // Draw border around instruction
      const endY = doc.y + 5;
      doc.rect(
        doc.page.margins.left - 5,
        startY - 5,
        doc.page.width - doc.page.margins.left - doc.page.margins.right + 10,
        endY - startY + 10
      ).stroke('#0066cc');

      // Reset color and font
      doc.fillColor('#000000');
      doc.fontSize(12).font('Times-Roman');
      doc.moveDown(1.0); // Space between instruction and notary block
    }

    // ✅ FIXED: Notary Block with proper field alignment
    if (sections.notaryBlock) {
      // Don't check page break here if we have instruction (already checked above)
      if (!sections.notaryInstruction) {
        this.checkPageBreak(doc, 200, metadata);
      }

      const startY = doc.y;
      doc.fontSize(12).font('Times-Roman');

      // FIXED: Render notary block with proper field alignment
      this.renderNotaryBlock(doc, sections.notaryBlock);

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

  checkPageBreak(doc, neededSpace, metadata, showContinuation = false) {
    const currentY = doc.y;
    const pageHeight = doc.page.height;
    const bottomMargin = doc.page.margins.bottom;

    // FIXED: Add buffer space (50px) to prevent text from getting too close to footer
    if (currentY + neededSpace > pageHeight - bottomMargin - 50) {
      // Add continuation indicator if requested (for facts section)
      if (showContinuation) {
        doc.moveDown(1.5);
        doc.fontSize(11).font('Times-Italic');
        doc.text('(Continued on next page)', {
          align: 'center'
        });
        doc.font('Times-Roman').fontSize(12);
      }

      // Add footer to current page before creating new page
      const currentPageNum = this.getCurrentPageNumber(doc);
      this.addPageFooter(doc, currentPageNum, metadata);

      // Now add the new page
      doc.addPage();
    }
  }

  addPageFooter(doc, pageNumber, metadata) {
    // FIXED: Don't modify the document Y position permanently
    // Save the current position
    const originalY = doc.y;
    const pageHeight = doc.page.height;
    const bottomMargin = doc.page.margins.bottom;

    // Calculate footer position
    const footerY = pageHeight - bottomMargin + 20;

    // Only render footer if we're not already past it
    if (originalY < footerY) {
      doc.fontSize(10).font('Times-Roman');
      doc.text(
        `Page ${pageNumber} • Generated by Discover.Legal • ${new Date().toLocaleDateString()}`,
        doc.page.margins.left,
        footerY,
        {
          width: doc.page.width - doc.page.margins.left - doc.page.margins.right,
          align: 'center'
        }
      );

      // Always restore the original Y position to prevent layout issues
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

  renderNotaryBlock(doc, notaryBlockText) {
    // FIXED: Properly format notary block with aligned fields
    // Parse the notary block to identify field labels and underscores
    const lines = notaryBlockText.split('\n');

    lines.forEach((line, idx) => {
      if (idx > 0) doc.moveDown(0.5);

      // Check if line contains underscore fields that need alignment
      if (line.includes('_____')) {
        // Handle lines with field labels and underscores
        // Pattern: "text _____ text" or "text: _____"

        // For Utah notary block, handle special formatting
        if (line.includes('(notary public name)') ||
            line.includes('(date)') ||
            line.includes('(month)') ||
            line.includes('(year)') ||
            line.includes('(name of document signer)')) {
          // These are labels under the underscores
          doc.text(line, { align: 'left', indent: 20 });
        } else if (line.includes('Subscribed and sworn to before me,')) {
          // First line of Utah notary block
          const parts = line.split(',');
          doc.text(parts[0] + ',', { continued: true });
          doc.text(' ________________________________,');
        } else if (line.includes('on this') && line.includes('day of')) {
          // Date line with multiple fields
          doc.text(line, { align: 'left' });
        } else if (line.includes('by ___')) {
          // "by" line
          doc.text(line, { align: 'left' });
        } else if (line.includes('My commission expires:')) {
          // Commission expiration line
          doc.text(line, { align: 'left' });
        } else if (line.includes('(SEAL)')) {
          // SEAL and signature line
          const parts = line.split('(SEAL)');
          doc.text('(SEAL)', doc.page.margins.left, doc.y, {
            continued: false,
            width: 100
          });

          // Signature line on the right
          const sigX = doc.page.margins.left + 120;
          doc.text(parts[1].trim(), sigX, doc.y - 12, { align: 'left' });
        } else {
          // Default rendering for other underscore lines
          doc.text(line, { align: 'left' });
        }
      } else {
        // Regular text line without special formatting
        doc.text(line, { align: 'left' });
      }
    });
  }
}

module.exports = PDFService;
