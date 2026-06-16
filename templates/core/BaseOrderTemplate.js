'use strict';

/**
 * BaseOrderTemplate
 *
 * Base class for proposed Orders, Decrees, and Judgments.
 * SRLs generate "proposed" orders; the judge reviews, signs, and dates them.
 * Structure: caption → title → findings → orders → judge signature block
 */

const BaseDocument = require('./BaseDocument');

class BaseOrderTemplate extends BaseDocument {
  constructor(stateCode, stateName) {
    super(stateCode, stateName);
    this.documentType = 'order';
    this.requiredFields = ['state'];
  }

  generateTitle(orderTitle) {
    return `PROPOSED ${(orderTitle || 'ORDER').toUpperCase()}`;
  }

  generatePreamble(data) {
    const court = (data.court || data.courtName || '[COURT]').toUpperCase();
    const date  = '[DATE]';
    return `This matter having come before the Court on ${date}, and the Court having reviewed the record and considered the matter:`;
  }

  generateFindings(findingItems = []) {
    if (!findingItems.length) {
      return 'THE COURT FINDS:\n\n1. [Court findings to be completed by the Court.]';
    }
    const numbered = findingItems.map((f, i) => `${i + 1}. ${f}`).join('\n\n');
    return `THE COURT FINDS:\n\n${numbered}`;
  }

  generateOrders(orderItems = []) {
    if (!orderItems.length) {
      return 'IT IS THEREFORE ORDERED:\n\n1. [Court orders to be completed by the Court.]';
    }
    const numbered = orderItems.map((o, i) => `${i + 1}. ${o}`).join('\n\n');
    return `IT IS THEREFORE ORDERED:\n\n${numbered}`;
  }

  generateJudgeBlock() {
    return [
      'SIGNED AND ENTERED this _____ day of __________________, 20___.',
      '',
      '_________________________________',
      'Judge / Commissioner',
      '[Court Name]'
    ].join('\n');
  }

  generateDocument(data = {}) {
    const validation  = this.validateData(data);
    const header      = this.generateHeader();
    const venue       = data.county ? this.generateVenue(data.county) : null;
    const caseCaption = this.generateCaseCaption(data);
    const title       = this.generateTitle(data.documentTitle || data.document_type);
    const preamble    = this.generatePreamble(data);
    const findings    = this.generateFindings(data.findings || []);
    const orders      = this.generateOrders(data.proposedOrders || []);
    const judgeBlock  = this.generateJudgeBlock();
    const footer      = this.generateFooter();

    const sections = { header, venue, caseCaption, title, preamble, findings, orders, judgeBlock, footer };

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
    if (s.venue)      lines.push(s.venue, '');
    if (s.caseCaption?.formatted) lines.push(s.caseCaption.formatted, '');
    if (s.title)      lines.push(s.title, '');
    if (s.preamble)   lines.push(s.preamble, '');
    if (s.findings)   lines.push(s.findings, '');
    if (s.orders)     lines.push(s.orders, '');
    if (s.judgeBlock) lines.push(s.judgeBlock, '');
    return lines.join('\n');
  }

  _html(s) {
    const esc = BaseDocument.escapeHtml;
    const body = `
  ${s.header ? `<div class="header">${esc(s.header)}</div>` : ''}
  ${s.venue  ? `<div class="venue">${esc(s.venue)}</div>` : ''}
  ${s.caseCaption?.formatted ? `<div class="case-caption">${esc(s.caseCaption.formatted)}</div>` : ''}
  ${s.title  ? `<div class="title">${esc(s.title)}</div>` : ''}
  ${s.preamble ? `<p class="paragraph">${esc(s.preamble)}</p>` : ''}
  ${s.findings ? `<p class="paragraph">${esc(s.findings).replace(/\n/g, '<br>')}</p>` : ''}
  ${s.orders   ? `<p class="paragraph">${esc(s.orders).replace(/\n/g, '<br>')}</p>` : ''}
  ${s.judgeBlock ? `<div class="signature-block"><pre>${esc(s.judgeBlock)}</pre></div>` : ''}
  ${s.footer ? `<div class="footer-disclaimer">${esc(s.footer.disclaimer)}</div>` : ''}`;
    return this.wrapHtml(`Proposed Order — ${this.stateName || ''}`, body);
  }
}

module.exports = BaseOrderTemplate;
