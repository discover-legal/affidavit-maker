// templates/states/newyork/AffidavitTemplate.js
// LEGAL COMPLIANCE VERSION 2.0 - Updated to conform with NY statutory requirements
// Governing Law: N.Y. C.P.L.R. § 2106, N.Y. Executive Law § 137, N.Y. Real Property Law § 309-B

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * New York Affidavit Template - LEGALLY COMPLIANT v2.0
 *
 * CRITICAL COMPLIANCE NOTES:
 * - Traditional notarized affidavit format (subscribed and sworn)
 * - Perjury statement REQUIRED
 * - County is required field
 * - Uses "INDEX NO." terminology (New York convention)
 * - NOTE: As of Jan 1, 2024, CPLR § 2106 allows unsworn affirmations
 *   for court filings as alternative (future enhancement)
 *
 * @class NewYorkAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class NewYorkAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    // Load metadata
    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // New York includes perjury statement in sworn affidavits
    this.sections.perjuryStatement = true;
  }

  /**
   * New York-specific case caption with "INDEX NO." terminology
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {Object} Case caption with formatted text
   */
  generateCaseCaption(affidavitData) {
    let caption = '';

    // Court name - use 'court' field (matches schema), fallback to courtName for backwards compatibility
    let courtName = affidavitData.court || affidavitData.courtName || '[COURT NAME]';
    courtName = courtName.toUpperCase();

    caption += `${courtName}\n\n`;

    // Case number - New York uses "INDEX NO."
    const indexNumber = affidavitData.indexNumber || affidavitData.caseNumber || '[INDEX NUMBER]';
    caption += `INDEX NO. ${indexNumber.toUpperCase()}\n\n`;

    // Add party names
    const plaintiff = affidavitData.plaintiff || '[PLAINTIFF NAME]';
    const defendant = affidavitData.defendant || '[DEFENDANT NAME]';

    caption += `${plaintiff.toUpperCase()},\n`;
    caption += `    Plaintiff,\n\n`;
    caption += `  -against-\n\n`;
    caption += `${defendant.toUpperCase()},\n`;
    caption += `    Defendant.`;

    return {
      courtName,
      caseNumber: affidavitData.indexNumber || affidavitData.caseNumber,
      plaintiff: affidavitData.plaintiff,
      defendant: affidavitData.defendant,
      formatted: caption
    };
  }

  /**
   * New York-specific validation
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // County is REQUIRED for New York affidavits
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push('County is required for New York affidavits');
    }

    // Verify perjury statement is present
    const factsText = (affidavitData.facts || []).join(' ').toLowerCase();
    if (!factsText.includes('penalty of perjury') && !factsText.includes('under perjury')) {
      warnings.push('Consider adding language about penalty of perjury for New York sworn affidavits');
    }

    return { errors, warnings };
  }

  /**
   * New York notary block - Traditional jurat format
   * COMPLIANT WITH: Standard New York notarial practice
   *
   * NOTE: This implements the traditional "subscribed and sworn" format.
   * CPLR § 2106 now allows unsworn affirmations as alternative for court filings.
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    return `State of ${this.stateName}    )
                     ) ss.:
County of _________  )

Subscribed and sworn to before me this _____ day of _________, 20__.


_________________________________
Notary Public

My commission expires: ___________`;
  }

  /**
   * New York exhibit rules
   * Letters or numbers acceptable, cover pages recommended but not required
   *
   * @returns {Object} Exhibit formatting rules
   */
  getExhibitRules() {
    return {
      labelStyle: 'letters', // A, B, C... (numbers also acceptable)
      requireCoverPage: false,
      coverPageFormat: {
        title: 'EXHIBIT [LABEL]',
        centered: true,
        description: true
      },
      allowedFormats: ['PDF', 'JPG', 'PNG'],
      maxFileSize: 25 * 1024 * 1024, // 25MB
      maxTotalSize: 100 * 1024 * 1024, // 100MB
      instructions: 'Exhibits may be labeled with letters (A, B, C, etc.) or numbers. Cover pages are recommended but not required.'
    };
  }

  /**
   * New York perjury statement
   * Required for traditional sworn affidavits
   *
   * NOTE: CPLR § 2106 (effective Jan 1, 2024) allows unsworn affirmations
   * as an alternative for court filings, but this template implements
   * the traditional notarized affidavit format.
   *
   * @returns {string} Perjury statement text
   */
  generatePerjuryStatement() {
    return `I declare under penalty of perjury under the laws of the State of ${this.stateName} that the foregoing is true and correct.`;
  }

  /**
   * New York-specific venue format (uppercase with ss.: notation)
   *
   * @param {string} county - County name
   * @returns {string} Formatted venue
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY NAME]';
    return `STATE OF NEW YORK    )\n                     ) ss.:\nCOUNTY OF ${countyName.toUpperCase()}  )`;
  }
}

module.exports = NewYorkAffidavitTemplate;
