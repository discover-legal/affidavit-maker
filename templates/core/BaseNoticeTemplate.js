'use strict';

/**
 * BaseNoticeTemplate
 *
 * Base class for Notices, Letters, Summons, and Demand Letters.
 * Structure: header/letterhead → date → addressee → subject → body → closing → signature
 */

const BaseDocument = require('./BaseDocument');

class BaseNoticeTemplate extends BaseDocument {
  constructor(stateCode, stateName) {
    super(stateCode, stateName);
    this.documentType = 'notice';
    this.requiredFields = [];
  }

  generateDate() {
    return `Date: _________________`;
  }

  generateAddressee(data) {
    const toName    = data.respondentName || data.recipientName || '[RECIPIENT NAME]';
    const toAddress = data.respondentAddress || data.recipientAddress || '[RECIPIENT ADDRESS]';
    return `TO:\n${toName}\n${toAddress}`;
  }

  generateSender(data) {
    const fromName    = data.petitionerName || data.senderName || '[SENDER NAME]';
    const fromAddress = data.petitionerAddress || data.senderAddress || '[SENDER ADDRESS]';
    return `FROM:\n${fromName}\n${fromAddress}`;
  }

  generateSubjectLine(subject) {
    return `RE: ${subject || '[SUBJECT]'}`;
  }

  processBody(bodyParagraphs = []) {
    return bodyParagraphs.map(p => (typeof p === 'string' ? p : (p.content || ''))).filter(Boolean);
  }

  generateClosing(signerName) {
    const name = signerName || '[NAME]';
    return `Respectfully,\n\n\n_________________________________\n${name}\nPro Se`;
  }

  generateDocument(data = {}) {
    const validation   = this.validateData(data);
    const date         = this.generateDate();
    const sender       = this.generateSender(data);
    const addressee    = this.generateAddressee(data);
    const subjectLine  = this.generateSubjectLine(data.subject);
    const body         = this.processBody(data.facts || data.bodyParagraphs || []);
    const signerName   = data.petitionerName || data.senderName || data.affiantName || '[NAME]';
    const closing      = this.generateClosing(signerName);
    const footer       = this.generateFooter();

    const sections = { date, sender, addressee, subjectLine, body, closing, footer };

    return {
      id:          require('uuid').v4(),
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
    return [
      s.date || '',
      '',
      s.sender || '',
      '',
      s.addressee || '',
      '',
      s.subjectLine || '',
      '',
      ...(s.body || []).map(p => `${p}\n`),
      s.closing || '',
      '',
      s.footer?.disclaimer || ''
    ].join('\n');
  }

  _html(s) {
    const esc = BaseDocument.escapeHtml;
    const body = `
  <p class="paragraph">${esc(s.date || '')}</p>
  <p class="paragraph">${esc(s.sender || '').replace(/\n/g, '<br>')}</p>
  <p class="paragraph">${esc(s.addressee || '').replace(/\n/g, '<br>')}</p>
  <p class="paragraph"><strong>${esc(s.subjectLine || '')}</strong></p>
  ${(s.body || []).map(p => `<p class="paragraph">${esc(p)}</p>`).join('\n  ')}
  <p class="paragraph">${esc(s.closing || '').replace(/\n/g, '<br>')}</p>
  ${s.footer ? `<div class="footer-disclaimer">${esc(s.footer.disclaimer)}</div>` : ''}`;
    return this.wrapHtml(`Notice — ${this.stateName || ''}`, body);
  }
}

module.exports = BaseNoticeTemplate;
