'use strict';

/**
 * BasePleadingTemplate
 *
 * Base class for Complaints, Petitions, and Answers.
 * Structure: caption → title → introduction → numbered paragraphs → prayer → verification → signature
 */

const BaseDocument = require('./BaseDocument');
const { escapeHtml } = BaseDocument;

class BasePleadingTemplate extends BaseDocument {
  constructor(stateCode, stateName) {
    super(stateCode, stateName);
    this.documentType = 'pleading';
    this.requiredFields = ['state'];
    this.sections = {
      header:       true,
      venue:        true,
      caseCaption:  true,
      title:        true,
      introduction: true,
      paragraphs:   true,
      prayer:       true,
      verification: true,
      signatureBlock: true,
      footer:       true
    };
  }

  // ─── Section generators ────────────────────────────────────────────────────

  generateTitle(documentTitle) {
    return (documentTitle || 'PLEADING').toUpperCase();
  }

  generateIntroduction(data) {
    const name = data.petitionerName || data.plaintiffName || '[PETITIONER]';
    return `COMES NOW ${name}, Petitioner, appearing Pro Se, and respectfully states as follows:`;
  }

  /**
   * Convert facts array to numbered paragraph objects.
   * Paragraph 1 is reserved for competency / jurisdictional statement.
   */
  processParagraphs(facts = [], competencyText = null) {
    const paragraphs = [];
    let num = 1;

    if (competencyText) {
      paragraphs.push({ number: num++, content: competencyText });
    }

    for (const fact of facts) {
      const content = typeof fact === 'string'
        ? fact
        : (fact.professionalRewrite || fact.content || '');
      if (content.trim()) {
        paragraphs.push({ number: num++, content: content.trim() });
      }
    }

    return paragraphs;
  }

  generatePrayer(reliefItems = []) {
    if (!reliefItems.length) {
      reliefItems = ['For such other and further relief as the Court deems just and proper.'];
    }
    const numbered = reliefItems.map((r, i) => `  ${i + 1}. ${r}`).join('\n');
    return `WHEREFORE, Petitioner respectfully requests that this Court grant the following relief:\n${numbered}`;
  }

  generateVerification(signerName, stateCode) {
    const name  = signerName || '[NAME]';
    const state = stateCode  || this.stateName || '[STATE]';
    return [
      `I, ${name}, declare under penalty of perjury under the laws of the`,
      `State of ${state} that the foregoing is true and correct to the best of my`,
      `knowledge and belief.`
    ].join(' ');
  }

  generateCertificateOfService(data) {
    const respondent = data.respondentName || data.defendantName || 'Respondent / Defendant';
    const petitioner = data.petitionerName || data.plaintiffName || '[NAME]';
    return [
      'CERTIFICATE OF SERVICE',
      '',
      `I hereby certify that on _________________, a true and correct copy of the`,
      `foregoing was served upon ${respondent} by:`,
      `[ ] Personal Service   [ ] First Class Mail   [ ] Email`,
      '',
      `_________________________________`,
      `${petitioner}`,
      `Pro Se`
    ].join('\n');
  }

  // ─── Main document generator ───────────────────────────────────────────────

  generateDocument(data = {}) {
    const validation = this.validateData(data);

    const header      = this.generateHeader();
    const venue       = data.county ? this.generateVenue(data.county) : null;
    const caseCaption = this.generateCaseCaption(data);
    const title       = this.generateTitle(data.documentTitle || data.document_type);
    const intro       = this.generateIntroduction(data);
    const paragraphs  = this.processParagraphs(data.facts || []);
    const prayer      = this.generatePrayer(data.reliefRequested || []);
    const verification = this.generateVerification(data.petitionerName || data.affiantName, this.stateName);
    const signerName  = data.petitionerName || data.affiantName || '[NAME]';
    const signatureBlock = this.generateSignatureBlock(signerName);
    const footer      = this.generateFooter();

    const sections = { header, venue, caseCaption, title, intro, paragraphs, prayer, verification, signatureBlock, footer };

    return {
      id:         require('node:crypto').randomUUID(),
      state:      this.state,
      timestamp:  new Date(),
      sections,
      fullText:   this._fullText(sections),
      htmlContent: this._html(sections, data),
      validation,
      formatting: this.formatting
    };
  }

  _fullText(s) {
    const lines = [];
    if (s.header)     lines.push(s.header, '');
    if (s.venue)      lines.push(s.venue, '');
    if (s.caseCaption?.formatted) lines.push(s.caseCaption.formatted, '');
    if (s.title)      lines.push(s.title, '');
    if (s.intro)      lines.push(s.intro, '');
    if (s.paragraphs) s.paragraphs.forEach(p => lines.push(`${p.number}. ${p.content}`, ''));
    if (s.prayer)     lines.push(s.prayer, '');
    if (s.verification) lines.push(s.verification, '');
    if (s.signatureBlock?.formatted) lines.push(s.signatureBlock.formatted, '');
    return lines.join('\n');
  }

  _html(s, _data) {
    const esc = BaseDocument.escapeHtml;
    const body = `
  ${s.header ? `<div class="header">${esc(s.header)}</div>` : ''}
  ${s.venue  ? `<div class="venue">${esc(s.venue)}</div>` : ''}
  ${s.caseCaption?.formatted ? `<div class="case-caption">${esc(s.caseCaption.formatted)}</div>` : ''}
  ${s.title  ? `<div class="title">${esc(s.title)}</div>` : ''}
  ${s.intro  ? `<p class="paragraph">${esc(s.intro)}</p>` : ''}
  ${(s.paragraphs || []).map(p => `<p class="paragraph">${p.number}. ${esc(p.content)}</p>`).join('\n  ')}
  ${s.prayer ? `<p class="paragraph">${esc(s.prayer).replace(/\n/g, '<br>')}</p>` : ''}
  ${s.verification ? `<p class="paragraph">${esc(s.verification)}</p>` : ''}
  ${s.signatureBlock?.formatted ? `<div class="signature-block"><pre>${esc(s.signatureBlock.formatted)}</pre></div>` : ''}
  ${s.footer ? `<div class="footer-disclaimer">${esc(s.footer.disclaimer)}</div>` : ''}`;
    return this.wrapHtml(`Pleading — ${this.stateName || ''}`, body);
  }
}

module.exports = BasePleadingTemplate;
