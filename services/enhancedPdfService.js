// services/enhancedPdfService.js
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const logger = require('./logger');

class EnhancedPDFService {
  constructor() {
    this.browser = null;
    this.options = {
      format: 'Letter',
      margin: {
        top: '1in',
        bottom: '1in',
        left: '1in',
        right: '1in'
      },
      printBackground: true,
      displayHeaderFooter: false
    };
  }

  async initialize() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
  }

  async generatePDF(document, options = {}) {
    const startTime = Date.now();
    const { documentId, userId } = options;
    
    try {
      await this.initialize();
      
      // Ensure documents directory exists
      const documentsDir = path.join(__dirname, '..', 'documents');
      await fs.mkdir(documentsDir, { recursive: true });
      
      const filename = `affidavit-${documentId || Date.now()}.pdf`;
      const filepath = path.join(documentsDir, filename);
      
      // Create new page
      const page = await this.browser.newPage();
      
      // Generate HTML content
      const htmlContent = this.generateEnhancedHTML(document);
      
      // Set content and wait for rendering
      await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
      
      // Generate PDF
      await page.pdf({
        path: filepath,
        ...this.options,
        ...options.pdfOptions
      });
      
      await page.close();
      
      const duration = Date.now() - startTime;
      logger.info(`PDF generated successfully in ${duration}ms`, {
        documentId,
        userId,
        filepath,
        duration
      });
      
      return filepath;
    } catch (error) {
      logger.error('PDF generation failed', {
        error: error.message,
        documentId,
        userId
      });
      throw error;
    }
  }

  generateEnhancedHTML(document) {
    const { sections, metadata } = document;
    // Helper to derive formatted string or content for a section
    const getFormatted = (section) => {
      if (!section) return '';
      if (typeof section === 'string') return section;
      if (section.formatted) return String(section.formatted);
      if (section.content) return String(section.content);
      return '';
    };

    // Helper to get facts as array
    const getFactsArray = (factsSection) => {
      if (!factsSection) return [];
      if (Array.isArray(factsSection) && factsSection.length > 0 && factsSection[0].content !== undefined) {
        return factsSection.map((f, idx) => ({ number: f.number || f.index || idx + 1, content: f.content || f.displayContent || '' }));
      }
      if (factsSection.items && Array.isArray(factsSection.items)) {
        return factsSection.items.map((it, idx) => ({ number: it.index || idx + 1, content: it.displayContent || it.content || '' }));
      }
      const formatted = getFormatted(factsSection);
      if (formatted) {
        const parts = formatted.split(/\n\n+/).map(p => p.trim()).filter(Boolean);
        return parts.map((p, idx) => ({ number: idx + 1, content: p }));
      }
      return [];
    };

    const facts = getFactsArray(sections.facts);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Affidavit - ${metadata?.affiantName || 'Document'}</title>
    <style>
        ${this.getEnhancedCSS()}
    </style>
</head>
<body>
    <div class="document">
        ${this.renderHeader(sections, getFormatted)}
        ${this.renderBody(sections, facts, getFormatted)}
        ${this.renderSignatures(sections)}
        ${this.renderNotary(sections)}
        ${this.renderFooter(sections, metadata)}
    </div>
</body>
</html>`;
  }

  getEnhancedCSS() {
    return `
        @page {
            size: letter;
            margin: 1in;
        }
        
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: 'Times New Roman', Times, serif;
            font-size: 12pt;
            line-height: 1.8;
            color: #000;
            background: #fff;
        }
        
        .document {
            max-width: 6.5in;
            margin: 0 auto;
        }
        
        /* Header Styles */
        .header {
            text-align: center;
            font-weight: bold;
            font-size: 14pt;
            margin-bottom: 24pt;
            text-transform: uppercase;
        }
        
        .venue {
            text-align: center;
            font-weight: bold;
            margin-bottom: 18pt;
        }
        
        .case-caption {
            text-align: right;
            margin-bottom: 24pt;
            font-weight: bold;
            border-bottom: 2px solid #000;
            padding-bottom: 12pt;
        }
        
        /* Title */
        .title {
            text-align: center;
            font-weight: bold;
            font-size: 14pt;
            text-decoration: underline;
            margin: 36pt 0;
            text-transform: uppercase;
        }
        
        /* Body Content */
        .introduction {
            text-align: justify;
            margin-bottom: 24pt;
            text-indent: 0.5in;
        }
        
        .facts-section {
            margin: 24pt 0;
        }
        
        .fact {
            margin-bottom: 18pt;
            text-align: justify;
            display: flex;
            align-items: flex-start;
        }
        
        .fact-number {
            font-weight: bold;
            min-width: 36pt;
            flex-shrink: 0;
        }
        
        .fact-content {
            flex: 1;
            text-align: justify;
        }
        
        .conclusion {
            text-align: justify;
            margin: 24pt 0;
            text-indent: 0.5in;
        }
        
        .perjury {
            text-align: justify;
            margin: 24pt 0;
            text-indent: 0.5in;
            font-weight: bold;
        }
        
        /* Signature Section */
        .signature-block {
            margin-top: 72pt;
            margin-bottom: 48pt;
        }
        
        .signature-line {
            border-bottom: 1px solid #000;
            margin-bottom: 6pt;
            min-height: 36pt;
        }
        
        .signature-name {
            font-weight: bold;
            margin-bottom: 6pt;
        }
        
        .signature-title {
            font-style: italic;
        }
        
        .signature-date {
            margin-top: 24pt;
        }
        
        /* Notary Section */
        .notary-block {
            margin-top: 48pt;
            border: 2px solid #000;
            padding: 24pt;
            background-color: #f9f9f9;
            page-break-inside: avoid;
        }
        
        .notary-block pre {
            font-family: 'Times New Roman', Times, serif;
            font-size: 12pt;
            white-space: pre-wrap;
            margin: 0;
        }
        
        /* Footer */
        .footer {
            margin-top: 48pt;
            padding-top: 24pt;
            border-top: 1px solid #ccc;
            font-size: 8pt;
            color: #666;
            text-align: center;
        }
        
        /* Page Breaks */
        .page-break {
            page-break-after: always;
        }
        
        .no-break {
            page-break-inside: avoid;
        }
        
        /* Print Optimization */
        @media print {
            body {
                margin: 0;
                padding: 0;
            }
            
            .document {
                max-width: 100%;
            }
            
            .notary-block {
                background-color: #fff !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
            }
        }
    `;
  }

  renderHeader(sections, getFormatted) {
    let html = '';
    
    if (sections.header) {
      html += `<div class="header">${sections.header}</div>`;
    }
    
    if (sections.venue) {
      html += `<div class="venue">${sections.venue}</div>`;
    }
    
    if (sections.caseCaption) {
      const caption = getFormatted ? getFormatted(sections.caseCaption) : (sections.caseCaption.formatted || sections.caseCaption);
      html += `<div class="case-caption">
        ${caption.replace(/\n/g, '<br>')}
      </div>`;
    }
    
    return html;
  }

  renderBody(sections, facts, getFormatted) {
    let html = '';

    if (sections.title) {
      html += `<div class="title">${sections.title}</div>`;
    }

    if (sections.introduction) {
      html += `<div class="introduction">${sections.introduction}</div>`;
    }

    if (facts && facts.length > 0) {
      html += '<div class="facts-section">';
      facts.forEach(fact => {
        html += `
          <div class="fact">
            <span class="fact-number">${fact.number}.</span>
            <span class="fact-content">${this.escapeHtml(fact.content)}</span>
          </div>
        `;
      });
      html += '</div>';
    }

    if (sections.conclusion) {
      html += `<div class="conclusion">${sections.conclusion}</div>`;
    }

    if (sections.perjuryStatement) {
      html += `<div class="perjury">${sections.perjuryStatement}</div>`;
    }

    return html;
  }

  renderSignatures(sections) {
    if (!sections.signatureBlock) return '';
    
    return `
      <div class="signature-block no-break">
        <div class="signature-line"></div>
        <div class="signature-name">${sections.signatureBlock.name}</div>
        <div class="signature-title">${sections.signatureBlock.title}</div>
        ${sections.signatureBlock.date ? 
          `<div class="signature-date">${sections.signatureBlock.date}</div>` : ''}
      </div>
    `;
  }

  renderNotary(sections) {
    if (!sections.notaryBlock) return '';
    
    return `
      <div class="notary-block no-break">
        <pre>${sections.notaryBlock}</pre>
      </div>
    `;
  }

  renderFooter(sections, metadata) {
    if (!sections.footer && !metadata) return '';
    
    return `
      <div class="footer">
        ${sections.footer?.disclaimer || 'This document was prepared using automated document assembly software.'}
        <br>
        Document ID: ${metadata?.documentId || 'N/A'} | 
        Generated: ${new Date().toLocaleDateString()} | 
        Version: ${metadata?.templateVersion || '1.0.0'}
      </div>
    `;
  }

  escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  async generateBatch(documents, options = {}) {
    const results = [];
    await this.initialize();
    
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

  async cleanup() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  // Generate with custom template
  async generateFromTemplate(templatePath, data, outputPath) {
    try {
      await this.initialize();
      
      const page = await this.browser.newPage();
      
      // Load template
      const template = await fs.readFile(templatePath, 'utf8');
      
      // Replace placeholders
      const html = this.replacePlaceholders(template, data);
      
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      await page.pdf({
        path: outputPath,
        ...this.options
      });
      
      await page.close();
      
      return outputPath;
    } catch (error) {
      logger.error('Template PDF generation failed', {
        error: error.message,
        templatePath,
        outputPath
      });
      throw error;
    }
  }

  replacePlaceholders(template, data) {
    let html = template;
    
    // Replace all {{placeholder}} with data values
    Object.keys(data).forEach(key => {
      const regex = new RegExp(`{{${key}}}`, 'g');
      html = html.replace(regex, data[key] || '');
    });
    
    return html;
  }
}

// Export singleton instance
const enhancedPdfService = new EnhancedPDFService();

// Cleanup on exit
process.on('SIGINT', async () => {
  await enhancedPdfService.cleanup();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await enhancedPdfService.cleanup();
  process.exit(0);
});

module.exports = {
  enhancedPdfService,
  EnhancedPDFService
};