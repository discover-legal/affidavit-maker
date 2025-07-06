// services/pdfService.js - Enhanced PDF generation for template system
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
            resolve(filepath);
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
    let yPosition = doc.y;

    // Header
    if (sections.header) {
      doc.fontSize(16).font('Times-Bold');
      doc.text(sections.header, { align: 'center' });
      doc.moveDown(0.5);
    }

    // Venue
    if (sections.venue) {
      doc.fontSize(14).font('Times-Bold');
      doc.text(sections.venue, { align: 'center' });
      doc.moveDown(0.5);
    }

    // Case Caption
    if (sections.caseCaption) {
      doc.fontSize(12).font('Times-Roman');
      doc.text(sections.caseCaption.formatted, { align: 'right' });
      doc.moveDown();
    }

    // Title
    if (sections.title) {
      doc.fontSize(14).font('Times-Bold');
      doc.text(sections.title, { align: 'center' });
      doc.moveDown(1.5);
    }

    // Introduction
    if (sections.introduction) {
      doc.fontSize(12).font('Times-Roman');
      doc.text(sections.introduction, { 
        align: 'justify',
        indent: 36
      });
      doc.moveDown();
    }

    // Facts Section
    if (sections.facts && sections.facts.length > 0) {
      sections.facts.forEach(fact => {
        // Check if we need a new page
        if (doc.y > doc.page.height - 150) {
          doc.addPage();
        }

        doc.fontSize(12).font('Times-Roman');
        
        // Number and content on same line
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
      if (doc.y > doc.page.height - 150) {
        doc.addPage();
      }
      doc.fontSize(12).font('Times-Roman');
      doc.text(sections.conclusion, { 
        align: 'justify',
        indent: 36 
      });
      doc.moveDown();
    }

    // Perjury Statement
    if (sections.perjuryStatement) {
      if (doc.y > doc.page.height - 150) {
        doc.addPage();
      }
      doc.fontSize(12).font('Times-Roman');
      doc.text(sections.perjuryStatement, { 
        align: 'justify',
        indent: 36 
      });
      doc.moveDown(1.5);
    }

    // Signature Block
    if (sections.signatureBlock) {
      if (doc.y > doc.page.height - 200) {
        doc.addPage();
      }
      
      doc.fontSize(12).font('Times-Roman');
      doc.moveDown();
      
      // Signature line
      doc.text(sections.signatureBlock.line);
      doc.text(sections.signatureBlock.name, { continued: false });
      doc.text(sections.signatureBlock.title || 'Affiant');
      
      if (sections.signatureBlock.date) {
        doc.moveDown(0.5);
        doc.text(sections.signatureBlock.date);
      }
      
      doc.moveDown(2);
    }

    // Notary Block
    if (sections.notaryBlock) {
      if (doc.y > doc.page.height - 200) {
        doc.addPage();
      }
      
      // Add border for notary section
      const notaryStartY = doc.y;
      doc.fontSize(12).font('Times-Roman');
      
      // Split notary block into lines and format
      const notaryLines = sections.notaryBlock.split('\n');
      notaryLines.forEach(line => {
        if (line.trim()) {
          doc.text(line.trim());
        } else {
          doc.moveDown(0.3);
        }
      });
      
      // Draw border around notary block
      const notaryEndY = doc.y + 10;
      doc.rect(doc.page.margins.left - 10, notaryStartY - 10, 
               doc.page.width - doc.page.margins.left - doc.page.margins.right + 20, 
               notaryEndY - notaryStartY + 20)
         .stroke();
    }

    // Footer with metadata
    if (sections.footer) {
      doc.fontSize(8).font('Times-Roman');
      doc.text(sections.footer.disclaimer, 
        doc.page.margins.left, 
        doc.page.height - doc.page.margins.bottom + 20,
        { align: 'center' }
      );
    }
  }

  // Alternative HTML to PDF conversion
  async generatePDFFromHTML(htmlContent, options = {}) {
    const { documentId } = options;
    
    try {
      const documentsDir = path.join(__dirname, '..', 'documents');
      await fs.mkdir(documentsDir, { recursive: true });
      
      const filename = `affidavit-${documentId || Date.now()}.pdf`;
      const filepath = path.join(documentsDir, filename);
      
      // For production, you might want to use puppeteer or similar
      // This is a simplified implementation
      return new Promise((resolve, reject) => {
        const doc = new PDFDocument(this.defaultOptions);
        const stream = doc.pipe(require('fs').createWriteStream(filepath));
        
        try {
          // Simple HTML to PDF conversion
          // Remove HTML tags and format as plain text
          const plainText = htmlContent
            .replace(/<[^>]*>/g, '')
            .replace(/&nbsp;/g, ' ')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&');
          
          doc.fontSize(12).font('Times-Roman');
          doc.text(plainText, {
            align: 'justify',
            lineGap: 6
          });
          
          doc.end();
          
          stream.on('finish', () => {
            resolve(filepath);
          });
          
          stream.on('error', reject);
        } catch (error) {
          reject(error);
        }
      });
    } catch (error) {
      console.error('HTML to PDF conversion error:', error);
      throw error;
    }
  }

  // Batch PDF generation
  async generateMultiplePDFs(documents, options = {}) {
    const results = [];
    
    for (const doc of documents) {
      try {
        const filepath = await this.generatePDF(doc, {
          ...options,
          documentId: doc.id || Date.now()
        });
        results.push({
          success: true,
          documentId: doc.id,
          filepath
        });
      } catch (error) {
        results.push({
          success: false,
          documentId: doc.id,
          error: error.message
        });
      }
    }
    
    return results;
  }

  // PDF validation
  async validatePDF(filepath) {
    try {
      const stats = await fs.stat(filepath);
      return {
        exists: true,
        size: stats.size,
        created: stats.birthtime,
        modified: stats.mtime,
        isValid: stats.size > 1000 // Basic validation - PDF should be > 1KB
      };
    } catch (error) {
      return {
        exists: false,
        error: error.message
      };
    }
  }

  // Clean up old PDFs
  async cleanupOldPDFs(maxAgeHours = 24) {
    try {
      const documentsDir = path.join(__dirname, '..', 'documents');
      const files = await fs.readdir(documentsDir);
      const cutoffTime = new Date(Date.now() - (maxAgeHours * 60 * 60 * 1000));
      
      let deletedCount = 0;
      
      for (const file of files) {
        if (file.endsWith('.pdf')) {
          const filepath = path.join(documentsDir, file);
          const stats = await fs.stat(filepath);
          
          if (stats.birthtime < cutoffTime) {
            await fs.unlink(filepath);
            deletedCount++;
          }
        }
      }
      
      return {
        success: true,
        deletedCount,
        message: `Cleaned up ${deletedCount} old PDF files`
      };
    } catch (error) {
      console.error('PDF cleanup error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Export both the class and a convenience function
const pdfService = new PDFService();

async function generatePDF(document, options = {}) {
  return pdfService.generatePDF(document, options);
}

module.exports = {
  PDFService,
  generatePDF,
  pdfService
};