'use strict';

/**
 * BaseDocument
 *
 * Common ancestor for all legal document templates.
 * Provides shared infrastructure: HTML escaping, formatting defaults,
 * venue/caption generation, signature blocks, and footer.
 *
 * Specific document shapes extend this:
 *   BaseAffidavitTemplate   — numbered facts + notary jurat
 *   BasePleadingTemplate    — complaint/petition/answer + prayer
 *   BaseMotionTemplate      — motion + legal argument + prayer
 *   BaseOrderTemplate       — proposed order/decree/judgment
 *   BaseDeclarationTemplate — penalty-of-perjury declaration (no notary)
 *   BaseNoticeTemplate      — notice/letter/summons
 */

const escapeHtml = (str) => {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

class BaseDocument {
  constructor(stateCode, stateName) {
    this.state     = stateCode  || null;
    this.stateName = stateName  || null;
    this.documentType = 'document'; // overridden by subclass
    this.requiredFields = [];
    this.formatting = {
      fontSize:   '12pt',
      fontFamily: 'Times New Roman',
      lineHeight: '2',
      margin:     '1in'
    };
  }

  // ─── Shared section generators ─────────────────────────────────────────────

  generateHeader() {
    if (!this.stateName) return 'STATE / COUNTY';
    return this.state === 'TX'
      ? `THE STATE OF TEXAS`
      : `STATE OF ${this.stateName.toUpperCase()}`;
  }

  generateVenue(county) {
    const c = (county || '[COUNTY]').toUpperCase();
    return `COUNTY OF ${c}`;
  }

  /**
   * Generate a two-column court caption.
   * Used by pleadings, motions, orders, and declarations.
   */
  generateCaseCaption(data) {
    const courtName   = (data.court || data.courtName || '[COURT NAME]').toUpperCase();
    const caseLabel   = data.caseNumberLabel || 'CASE NO.';
    const caseNumber  = data.caseNumber || data.causeNumber || '[CASE NUMBER]';
    const petitioner  = data.petitionerName || data.plaintiff || data.petitioner || '[PETITIONER]';
    const respondent  = data.respondentName || data.defendant || data.respondent || '[RESPONDENT]';

    const formatted = [
      `IN THE ${courtName}`,
      '',
      `${caseLabel} ${caseNumber}`,
      '',
      `${petitioner.toUpperCase()}`,
      `       Petitioner,`,
      `v.`,
      `${respondent.toUpperCase()}`,
      `       Respondent.`
    ].join('\n');

    return { courtName, caseNumber, petitioner, respondent, formatted };
  }

  generateSignatureBlock(signerName, title = 'Pro Se') {
    const name = signerName || '[NAME]';
    return {
      line:      '_________________________________',
      name,
      title,
      formatted: `_________________________________\n${name}\n${title}`
    };
  }

  generateFooter() {
    return {
      disclaimer: 'This document was prepared using AI-assisted software. It is not legal advice. Review with a licensed attorney before filing.',
      timestamp:  new Date().toISOString(),
      version:    '1.0'
    };
  }

  // ─── Validation ────────────────────────────────────────────────────────────

  validateData(data) {
    const errors   = [];
    const warnings = [];

    for (const field of this.requiredFields) {
      if (!data[field] || String(data[field]).trim() === '') {
        errors.push(`${field} is required`);
      }
    }

    const stateCheck = this.performStateSpecificValidation(data);
    errors.push(...stateCheck.errors);
    warnings.push(...stateCheck.warnings);

    return { isValid: errors.length === 0, errors, warnings };
  }

  performStateSpecificValidation(_data) {
    return { errors: [], warnings: [] };
  }

  // ─── HTML helpers ──────────────────────────────────────────────────────────

  get _css() {
    return `
    body { font-family:'Times New Roman',serif; font-size:12pt; line-height:2; margin:1in; color:#000; background:white; }
    .header, .venue { text-align:center; font-weight:bold; margin-bottom:10px; }
    .case-caption { text-align:center; margin-bottom:20px; white-space:pre-line; }
    .title { text-align:center; font-weight:bold; text-decoration:underline; margin:20px 0; }
    .paragraph { margin-bottom:15px; text-align:justify; }
    .signature-block { margin-top:40px; margin-bottom:30px; white-space:pre-line; }
    .footer-disclaimer { margin-top:40px; font-size:9pt; color:#666; border-top:1px solid #ccc; padding-top:8px; }
    @media print { body { margin:0; padding:1in; } }`;
  }

  wrapHtml(title, bodyHtml) {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(title)}</title>
  <style>${this._css}</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
  }

  // ─── Expose escapeHtml for subclasses ──────────────────────────────────────
  static escapeHtml = escapeHtml;
}

module.exports = BaseDocument;
