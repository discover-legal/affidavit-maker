'use strict';

/**
 * BaseDeclarationTemplate
 *
 * Base class for Declarations signed under penalty of perjury (no notary required).
 * Used in states that accept unsworn declarations (CA, AZ, and others) and for
 * any document type that is a personal statement of facts without a notary.
 *
 * Structure: caption → title → introduction → numbered facts → declaration language → signature
 */

const BaseDocument = require('./BaseDocument');

class BaseDeclarationTemplate extends BaseDocument {
  constructor(stateCode, stateName) {
    super(stateCode, stateName);
    this.documentType = 'declaration';
    this.requiredFields = ['state'];
    this.sections = {
      header:        true,
      venue:         false,  // Declarations don't always have venue
      caseCaption:   true,
      title:         true,
      introduction:  true,
      facts:         true,
      declarationStatement: true,
      signatureBlock: true,
      footer:        true
    };
  }

  generateTitle(declarationTitle) {
    return `DECLARATION OF ${(declarationTitle || '[DECLARANT]').toUpperCase()}`;
  }

  generateIntroduction(data) {
    const name = data.affiantName || data.declarantName || data.petitionerName || '[NAME]';
    return `I, ${name}, declare as follows:`;
  }

  /**
   * Build competency statement (fact #1).
   */
  generateCompetencyStatement(name) {
    return {
      number:  1,
      content: `I am over the age of eighteen (18) years, of sound mind, and personally knowledgeable of the facts stated in this declaration.`,
      type:    'competency'
    };
  }

  processFacts(facts = []) {
    const items = [this.generateCompetencyStatement()];
    let num = 2;
    for (const fact of facts) {
      const content = typeof fact === 'string' ? fact : (fact.professionalRewrite || fact.content || '');
      if (content.trim()) {
        items.push({ number: num++, content: content.trim(), type: typeof fact === 'object' ? (fact.type || 'fact') : 'fact' });
      }
    }
    return items;
  }

  /**
   * The penalty-of-perjury statement at the bottom (replaces notary for unsworn declarations).
   */
  generateDeclarationStatement(signerName, stateCode) {
    const name  = signerName || '[NAME]';
    const state = stateCode  || this.stateName || '[STATE]';
    return `I declare under penalty of perjury under the laws of the State of ${state} that the foregoing is true and correct.\n\nExecuted on _________________, at _________________________, ${state}.`;
  }

  generateDocument(data = {}) {
    const validation = this.validateData(data);
    const header     = this.generateHeader();
    const caseCaption = this.generateCaseCaption(data);
    const signerName = data.affiantName || data.declarantName || data.petitionerName || '[NAME]';
    const title      = this.generateTitle(signerName);
    const intro      = this.generateIntroduction(data);
    const facts      = this.processFacts(data.facts || []);
    const declarationStatement = this.generateDeclarationStatement(signerName, this.stateName);
    const signatureBlock = this.generateSignatureBlock(signerName, 'Declarant');
    const footer     = this.generateFooter();

    const sections = { header, caseCaption, title, intro, facts, declarationStatement, signatureBlock, footer };

    return {
      id:          require('node:crypto').randomUUID(),
      state:       this.state,
      timestamp:   new Date(),
      sections,
      fullText:    this._fullText(sections),
      htmlContent: this._html(sections),
      validation,
      formatting:  this.formatting
    };
  }

  _fullText(s) {
    const lines = [];
    if (s.header)     lines.push(s.header, '');
    if (s.caseCaption?.formatted) lines.push(s.caseCaption.formatted, '');
    if (s.title)      lines.push(s.title, '');
    if (s.intro)      lines.push(s.intro, '');
    (s.facts || []).forEach(f => lines.push(`${f.number}. ${f.content}`, ''));
    if (s.declarationStatement) lines.push(s.declarationStatement, '');
    if (s.signatureBlock?.formatted) lines.push(s.signatureBlock.formatted, '');
    return lines.join('\n');
  }

  _html(s) {
    const esc = BaseDocument.escapeHtml;
    const body = `
  ${s.header ? `<div class="header">${esc(s.header)}</div>` : ''}
  ${s.caseCaption?.formatted ? `<div class="case-caption">${esc(s.caseCaption.formatted)}</div>` : ''}
  ${s.title  ? `<div class="title">${esc(s.title)}</div>` : ''}
  ${s.intro  ? `<p class="paragraph">${esc(s.intro)}</p>` : ''}
  ${(s.facts || []).map(f => `<p class="paragraph">${f.number}. ${esc(f.content)}</p>`).join('\n  ')}
  ${s.declarationStatement ? `<p class="paragraph">${esc(s.declarationStatement).replace(/\n/g, '<br>')}</p>` : ''}
  ${s.signatureBlock?.formatted ? `<div class="signature-block"><pre>${esc(s.signatureBlock.formatted)}</pre></div>` : ''}
  ${s.footer ? `<div class="footer-disclaimer">${esc(s.footer.disclaimer)}</div>` : ''}`;
    return this.wrapHtml(`Declaration — ${this.stateName || ''}`, body);
  }
}

module.exports = BaseDeclarationTemplate;
