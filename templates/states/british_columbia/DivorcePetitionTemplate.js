// templates/states/british_columbia/DivorcePetitionTemplate.js
// British Columbia divorce application template
// Governing Law: Divorce Act (RSC 1985, c. 3); BC Supreme Court Family Rules, BC Reg. 169/2009

'use strict';

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * British Columbia Divorce Application Template
 *
 * BC uses "Notice of Family Claim" (Form F8) for an unilateral divorce claim,
 * or "Notice of Joint Family Claim" (Form F3) when both spouses agree.
 *
 * Key Legal References:
 * - Divorce Act, RSC 1985, c. 3 (federal)
 *   - s.8(2)(a): 1-year separation (primary ground)
 *   - s.8(2)(b): Adultery or physical/mental cruelty
 * - Family Law Act, SBC 2011, c. 25 (provincial — property, support, parenting)
 *   - Part 5: Division of family property
 *   - Part 7: Child and spousal support (supplements federal guidelines)
 * - BC Supreme Court Family Rules, BC Reg. 169/2009
 * - Federal Child Support Guidelines, SOR/97-175
 *
 * Residency Requirement (Divorce Act, s.3):
 * - Either spouse must have been ordinarily resident in BC for at least 1 year.
 *
 * BC-Specific:
 * - Parties are "Claimant" and "Respondent"
 * - Court is Supreme Court of BC (NOT Provincial Court — that court handles family but not divorce)
 * - Court File No. with registry location (e.g., "Vancouver Registry", "Victoria Registry")
 * - "Ordinary residence" standard (same as other provinces under federal Divorce Act)
 * - BC has no mandatory cooling-off period beyond the 1-year separation ground
 * - Joint divorce (Form F3) available if both spouses agree on all issues
 *
 * @class BCDivorcePetitionTemplate
 * @extends BaseDivorcePetitionTemplate
 */
class BCDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'BC';
    this.stateName = 'British Columbia';
    this.countryCode = 'CA';
    this.documentTitle = 'NOTICE OF FAMILY CLAIM';

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

    this.residencyRequirements = {
      stateMonths: 12,
      countyDays: 0,
      description: 'Either spouse must have been ordinarily resident in British Columbia for at least one year immediately before the application (Divorce Act, s.3(1)).'
    };

    this.waitingPeriod = {
      days: 0,
      description: 'No mandatory waiting period after filing. The 1-year separation period must be complete before or at the time of judgment.'
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
    const registry = (county || '[REGISTRY]').toUpperCase();
    return `SUPREME COURT OF BRITISH COLUMBIA — ${registry} REGISTRY`;
  }

  getGroundsStatement(groundsForDivorce) {
    const g = (groundsForDivorce || 'separation').toLowerCase();
    if (g.includes('adultery')) {
      return 'The Respondent has committed adultery within the meaning of paragraph 8(2)(b)(i) of the Divorce Act.';
    }
    if (g.includes('cruelty') || g.includes('violence')) {
      return 'The Respondent has treated the Claimant with physical or mental cruelty of such a kind as to render intolerable the continued cohabitation of the spouses, within the meaning of paragraph 8(2)(b)(ii) of the Divorce Act.';
    }
    return 'The spouses have lived separate and apart for at least one year immediately preceding the determination of the divorce application, within the meaning of paragraph 8(2)(a) of the Divorce Act.';
  }
}

module.exports = BCDivorcePetitionTemplate;
