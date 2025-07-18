// services/pdfService.js 
const PDFDocument = require('pdfkit');
const fs = require('fs').promises;
const path = require('path');

class PDFService {
  constructor() {
    this.defaultOptions = {
      size: 'letter',
      margins: { top: 72, bottom: 72, left: 72, right: 72 },
      font: 'Times-Roman',
      fontSize: 12,
      lineHeight: 1.5
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
      this.checkPageBreak(doc, 80);
      doc.fontSize(12).font('Times-Roman');
      doc.text(sections.caseCaption.formatted || sections.caseCaption, { align: 'right' });
      doc.moveDown();
    }

    // Title
    if (sections.title) {
      this.checkPageBreak(doc, 60);
      doc.fontSize(14).font('Times-Bold');
      doc.text(sections.title, { align: 'center' });
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
      doc.moveDown();
    }

    // Facts Section with proper page breaks
    if (sections.facts && sections.facts.length > 0) {
      sections.facts.forEach((fact, index) => {
        // Estimate space needed for this fact
        const estimatedHeight = this.estimateTextHeight(doc, fact.content, 12) + 20;
        this.checkPageBreak(doc, estimatedHeight);

        doc.fontSize(12).font('Times-Roman');
        
        // Number and content with proper spacing
        const numberWidth = doc.widthOfString(`${fact.number}. `);
        doc.text(`${fact.number}. `, { continued: true });
        doc.text(fact.content, {
          align: 'justify',
          width: doc.page.width - doc.page.margins.left - doc.page.margins.right - numberWidth,
          indent: 0
        });
        doc.moveDown(0.5);
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
      doc.moveDown();
    }

    // Perjury Statement
    if (sections.perjuryStatement) {
      this.checkPageBreak(doc, 80);
      doc.fontSize(12).font('Times-Roman');
      doc.text(sections.perjuryStatement, { 
        align: 'justify',
        indent: 36 
      });
      doc.moveDown(1.5);
    }

    // Signature Block
    if (sections.signatureBlock) {
      this.checkPageBreak(doc, 120);
      
      doc.fontSize(12).font('Times-Roman');
      doc.moveDown();
      
      // Signature line
      doc.text(sections.signatureBlock.line || '_'.repeat(40));
      doc.text(sections.signatureBlock.name || '[AFFIANT NAME]', { continued: false });
      doc.text(sections.signatureBlock.title || 'Affiant');
      
      if (sections.signatureBlock.date) {
        doc.moveDown(0.5);
        doc.text(sections.signatureBlock.date);
      }
      
      doc.moveDown(2);
    }

    // Notary Block
    if (sections.notaryBlock) {
      this.checkPageBreak(doc, 200);
      
      // Add border around notary block
      const startY = doc.y;
      doc.fontSize(12).font('Times-Roman');
      
      // Notary content
      const notaryLines = sections.notaryBlock.split('\n');
      notaryLines.forEach(line => {
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
    
    if (currentY + neededSpace > pageHeight - bottomMargin - 50) { // 50px buffer for footer
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
    // Rough estimate of pages based on content
    const { sections } = document;
    let estimatedHeight = 0;
    
    // Header and venue: ~100px
    estimatedHeight += 100;
    
    // Facts: ~40px per fact
    if (sections.facts) {
      estimatedHeight += sections.facts.length * 40;
    }
    
    // Other sections: ~200px total
    estimatedHeight += 200;
    
    // Letter size page is ~720px usable height
    return Math.max(1, Math.ceil(estimatedHeight / 720));
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