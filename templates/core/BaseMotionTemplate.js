'use strict';

/**
 * BaseMotionTemplate
 *
 * Base class for Motions, Requests for Orders (RFO), Opposition briefs.
 * Structure: caption → title → introduction → facts → legal argument → prayer → signature
 */

const BaseDocument = require('./BaseDocument');

class BaseMotionTemplate extends BaseDocument {
  constructor(stateCode, stateName) {
    super(stateCode, stateName);
    this.documentType = 'motion';
    this.requiredFields = ['state'];
  }

  generateTitle(motionTitle) {
    return (motionTitle || 'MOTION').toUpperCase();
  }

  generateIntroduction(data) {
    const name = data.movantName || data.petitionerName || data.affiantName || '[MOVANT]';
    return `${name.toUpperCase()}, appearing Pro Se, respectfully moves this Court for the relief requested below, and in support thereof states:`;
  }

  processFacts(facts = []) {
    return facts.map((f, i) => ({
      number:  i + 1,
      content: typeof f === 'string' ? f : (f.professionalRewrite || f.content || '')
    })).filter(f => f.content.trim());
  }

  generateLegalArgument(argumentText) {
    return argumentText || 'ARGUMENT\n\n[Legal argument to be completed based on applicable law.]';
  }

  generatePrayer(reliefItems = []) {
    if (!reliefItems.length) {
      reliefItems = ['For such other and further relief as the Court deems just and proper.'];
    }
    const numbered = reliefItems.map((r, i) => `  ${i + 1}. ${r}`).join('\n');
    return `WHEREFORE, Movant respectfully requests this Court:\n${numbered}`;
  }

  generateDocument(data = {}) {
    const validation  = this.validateData(data);
    const header      = this.generateHeader();
    const venue       = data.county ? this.generateVenue(data.county) : null;
    const caseCaption = this.generateCaseCaption(data);
    const title       = this.generateTitle(data.documentTitle || data.document_type);
    const intro       = this.generateIntroduction(data);
    const facts       = this.processFacts(data.facts || []);
    const prayer      = this.generatePrayer(data.reliefRequested || []);
    const signerName  = data.movantName || data.petitionerName || data.affiantName || '[NAME]';
    const signatureBlock = this.generateSignatureBlock(signerName);
    const footer      = this.generateFooter();

    const sections = { header, venue, caseCaption, title, intro, facts, prayer, signatureBlock, footer };

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
    const lines = [];
    if (s.header)     lines.push(s.header, '');
    if (s.venue)      lines.push(s.venue, '');
    if (s.caseCaption?.formatted) lines.push(s.caseCaption.formatted, '');
    if (s.title)      lines.push(s.title, '');
    if (s.intro)      lines.push(s.intro, '');
    (s.facts || []).forEach(f => lines.push(`${f.number}. ${f.content}`, ''));
    if (s.prayer)     lines.push(s.prayer, '');
    if (s.signatureBlock?.formatted) lines.push(s.signatureBlock.formatted, '');
    return lines.join('\n');
  }

  _html(s) {
    const esc = BaseDocument.escapeHtml;
    const body = `
  ${s.header ? `<div class="header">${esc(s.header)}</div>` : ''}
  ${s.venue  ? `<div class="venue">${esc(s.venue)}</div>` : ''}
  ${s.caseCaption?.formatted ? `<div class="case-caption">${esc(s.caseCaption.formatted)}</div>` : ''}
  ${s.title  ? `<div class="title">${esc(s.title)}</div>` : ''}
  ${s.intro  ? `<p class="paragraph">${esc(s.intro)}</p>` : ''}
  ${(s.facts || []).map(f => `<p class="paragraph">${f.number}. ${esc(f.content)}</p>`).join('\n  ')}
  ${s.prayer ? `<p class="paragraph">${esc(s.prayer).replace(/\n/g, '<br>')}</p>` : ''}
  ${s.signatureBlock?.formatted ? `<div class="signature-block"><pre>${esc(s.signatureBlock.formatted)}</pre></div>` : ''}
  ${s.footer ? `<div class="footer-disclaimer">${esc(s.footer.disclaimer)}</div>` : ''}`;
    return this.wrapHtml(`Motion — ${this.stateName || ''}`, body);
  }
}

module.exports = BaseMotionTemplate;
