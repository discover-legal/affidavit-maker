// templates/states/ontario/DivorcePetitionTemplate.js
// Ontario divorce application template
// Governing Law: Divorce Act (RSC 1985, c. 3); Family Law Rules, O. Reg. 114/99

'use strict';

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Ontario Divorce Application Template
 *
 * Ontario uses the term "Application" rather than "Petition" for divorce proceedings.
 * The standard form is Form 8 (Application — General) under the Family Law Rules.
 *
 * Key Legal References:
 * - Divorce Act, RSC 1985, c. 3 (federal — governs divorce nationwide)
 *   - s.8(2)(a): Separation for 1 year is the primary ground
 *   - s.8(2)(b): Adultery or physical/mental cruelty (rare)
 * - Family Law Act, RSO 1990, c. F.3 (provincial — property, support)
 * - Family Law Rules, O. Reg. 114/99 (procedure — Form 8)
 * - Children's Law Reform Act, RSO 1990, c. C.12 (custody/access)
 * - Child Support Guidelines, SOR/97-175 (federal support calculation)
 *
 * Residency Requirement (Divorce Act, s.3):
 * - Either spouse must have been ordinarily resident in Ontario for at least 1 year
 *   immediately before the divorce application.
 *
 * Ontario-Specific:
 * - Parties are "Applicant" and "Respondent" (not "Petitioner")
 * - Court is Superior Court of Justice (or Family Court branch where available)
 * - Filing fee: approx. $157 (waivable with Form 26B if impecunious)
 * - Uncontested divorce: typically handled on paper without a hearing
 * - Court File No. instead of "CAUSE NO." or "CASE NO."
 *
 * @class OntarioDivorcePetitionTemplate
 * @extends BaseDivorcePetitionTemplate
 */
class OntarioDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'ON';
    this.stateName = 'Ontario';
    this.countryCode = 'CA';
    this.documentTitle = 'APPLICATION FOR DIVORCE';

    try {
      this.metadata = require('./metadata.json');
    } catch (e) {
      this.metadata = null;
    }

    this.requiredFields = [
      'petitionerName',
      'respondentName',
      'state',
      'county',
      'marriageDate',
      'groundsForDivorce'
    ];

    // Ontario residency: 1 year in province (Divorce Act s.3)
    this.residencyRequirements = {
      stateMonths: 12,
      countyDays: 0,
      description: 'Either spouse must have been ordinarily resident in Ontario for at least one year immediately before the divorce application (Divorce Act, s.3(1)).'
    };

    // No mandatory waiting period after filing in Ontario beyond the separation ground itself
    this.waitingPeriod = {
      days: 0,
      description: 'No mandatory waiting period after filing — the 1-year separation must be completed before or by the time the application is granted.'
    };

    this.formatting = {
      fontSize: '12pt',
      fontFamily: 'Times New Roman',
      lineHeight: '1.5',
      margin: '1in',
      paperSize: '8.5in x 11in'
    };
  }

  getCaseNumberLabel() {
    return 'Court File No.';
  }

  getDefaultCourt(county) {
    const city = (county || '[CITY]').toUpperCase();
    return `SUPERIOR COURT OF JUSTICE — ${city}`;
  }

  /**
   * Ontario grounds for divorce.
   * Divorce Act, s.8 provides three grounds:
   *   (a) 1-year separation
   *   (b) adultery
   *   (b) physical or mental cruelty
   */
  getGroundsStatement(groundsForDivorce) {
    const g = (groundsForDivorce || 'separation').toLowerCase();
    if (g.includes('adultery')) {
      return 'The Respondent has committed adultery within the meaning of paragraph 8(2)(b)(i) of the Divorce Act.';
    }
    if (g.includes('cruelty') || g.includes('violence')) {
      return 'The Respondent has treated the Applicant with physical or mental cruelty of such a kind as to render intolerable the continued cohabitation of the spouses, within the meaning of paragraph 8(2)(b)(ii) of the Divorce Act.';
    }
    // Default: 1-year separation
    return 'The spouses have lived separate and apart for at least one year immediately preceding the determination of the divorce application, within the meaning of paragraph 8(2)(a) of the Divorce Act.';
  }
}

module.exports = OntarioDivorcePetitionTemplate;
