// templates/states/prince_edward_island/DivorcePetitionTemplate.js
// Prince Edward Island divorce application template
// Governing Law: Divorce Act (RSC 1985, c. 3 (2nd Supp.)); Family Law Act, RSPEI 1988, c. F-2.1

'use strict';

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Prince Edward Island Divorce Petition Template
 *
 * PEI uses the term "Petition" for divorce proceedings.
 * The Supreme Court of Prince Edward Island has exclusive
 * jurisdiction over divorce matters. Family law proceedings are handled by the
 * Family Section.
 *
 * Key Legal References:
 * - Divorce Act, RSC 1985, c. 3 (2nd Supp.) (federal — governs divorce nationwide)
 *   - s.3(1): Residency — either spouse habitually resident in PEI for at least 1 year
 *   - s.8(2)(a): Separation for 1 year is the primary ground
 *   - s.8(2)(b): Adultery or physical/mental cruelty (rare)
 * - Family Law Act, RSPEI 1988, c. F-2.1 (division of family property)
 * - Family Law Act, RSPEI 1988, c. F-2.1 (spousal and child support, domestic contracts)
 * - Alimony Act, RSPEI 1988, c. A-10 (spousal support and maintenance)
 * - Custody Jurisdiction and Enforcement Act, RSPEI 1988, c. C-33 (custody orders)
 * - Child Support Guidelines, SOR/97-175 (federal support calculation)
 *
 * Residency Requirement (Divorce Act, s.3):
 * - Either spouse must have been habitually resident in PEI for at least 1 year
 *   immediately before the divorce application.
 *
 * PEI-Specific:
 * - Parties are "Petitioner" and "Respondent"
 * - Court is Supreme Court of Prince Edward Island
 * - Court File No. instead of "CAUSE NO." or "CASE NO."
 * - PEI is the smallest province — court proceedings may be less formal
 *   but all statutory requirements still apply
 * - Matrimonial property divided equally by default (Family Law Act, RSPEI 1988, c. F-2.1)
 * - Support is termed "maintenance" under the Maintenance Enforcement Act and Family Law Act
 *
 * @class PEIDivorcePetitionTemplate
 * @extends BaseDivorcePetitionTemplate
 */
class PEIDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'PE';
    this.stateName = 'Prince Edward Island';
    
    // Canadian terminology (see templates/core/terminology.js):
    // Supreme Court of PEI petition; Rules of Civil Procedure keep Petitioner/Respondent; single-court province, no counties for venue.
    // No "STATE OF"/"COUNTY OF" caption lines and no "X County" body
    // phrasing — the caption's court-name line carries the venue.
    this.terminology = {
      ...this.terminology,
      jurisdictionLabel: null,
      jurisdictionTerm: 'Province',
      districtLabel: null,
      districtTerm: 'Court location',
      districtStyle: 'plain',
      districtPlaceholder: '[COURT LOCATION]',
      filerLabel: 'Petitioner',
      responderLabel: 'Respondent',
      selfRepresentedLabel: 'Self-Represented',
    };
    this.countryCode = 'CA';
    this.documentTitle = 'PETITION FOR DIVORCE';

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

    // PEI residency: 1 year habitually resident in province (Divorce Act s.3(1))
    this.residencyRequirements = {
      stateMonths: 12,
      countyDays: 0,
      description: 'Either spouse must have been habitually resident in Prince Edward Island for at least one year immediately before the application (Divorce Act, s.3(1)).'
    };

    // No mandatory waiting period after filing in PEI beyond the separation ground itself
    this.waitingPeriod = {
      days: 0,
      description: 'No waiting period after filing — the 1-year separation must be complete before the divorce is granted.'
    };

    this.formatting = {
      fontSize: '12pt',
      fontFamily: 'Times New Roman',
      lineHeight: '1.5',
      margin: '1in',
      paperSize: '8.5in x 11in'
    };
  }

  /**
   * PEI uses "Court File No." (not "CASE NO." or "CAUSE NO.").
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'Court File No.';
  }

  /**
   * Default court for PEI divorce — Supreme Court of Prince Edward Island.
   * The Family Section sits within the Trial Division; the formal court name is Trial Division.
   * Judicature Act, RSPEI 1988, c. J-2.1.
   * @param {string} county - City or location of filing
   * @returns {string} Default court name
   */
  getDefaultCourt(county) {
    // PEI court: Supreme Court of Prince Edward Island
    // The Family Section sits within the Trial Division (not a separate division).
    // Correct formal name per the Judicature Act, RSPEI 1988, c. J-2.1.
    return `SUPREME COURT OF PRINCE EDWARD ISLAND`;
  }

  /**
   * PEI grounds for divorce under the Divorce Act.
   * Divorce Act, s.8 provides three grounds:
   *   (a) 1-year separation
   *   (b)(i) adultery
   *   (b)(ii) physical or mental cruelty
   * @param {string} groundsForDivorce - Grounds for divorce
   * @returns {string} Grounds statement
   */
  getGroundsText(groundsForDivorce) {
    const g = (groundsForDivorce || 'separation').toLowerCase();
    if (g.includes('adultery')) {
      return 'The Respondent has committed adultery within the meaning of paragraph 8(2)(b)(i) of the Divorce Act.';
    }
    if (g.includes('cruelty') || g.includes('violence')) {
      return 'The Respondent has treated the Petitioner with physical or mental cruelty of such a kind as to render intolerable the continued cohabitation of the spouses, within the meaning of paragraph 8(2)(b)(ii) of the Divorce Act.';
    }
    // Default: 1-year separation (most common ground)
    return 'The spouses have lived separate and apart for at least one year immediately preceding the determination of the divorce application, within the meaning of paragraph 8(2)(a) of the Divorce Act.';
  }

  /**
   * PEI relief section — uses Canadian Divorce Act corollary relief terminology.
   * "Corollary relief" (not "ancillary relief") is the correct term under the Divorce Act.
   * Post-March 1, 2021 amendments (Bill C-78): "parenting time" and
   * "decision-making responsibility" replace "custody" and "access" (Divorce Act, ss.16.1-16.92).
   * Family Law Act, RSPEI 1988, c. F-2.1 governs equal division of matrimonial property.
   * Spousal support is termed "maintenance" under the Family Law Act, RSPEI 1988, c. F-2.1,
   * and Alimony Act, RSPEI 1988, c. A-10.
   * Petitioner/Respondent labels per PEI divorce practice.
   */
  generateReliefSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 15;

    items.push({
      number: null,
      content: 'WHEREFORE, the Petitioner requests that the Court grant the following relief:',
      type: 'relief_intro'
    });

    const reliefItems = [
      'A divorce order pursuant to section 8 of the Divorce Act, RSC 1985, c. 3 (2nd Supp.);',
      'Division of matrimonial property pursuant to the Family Law Act, RSPEI 1988, c. F-2.1;',
      'An order allocating responsibility for debts in an equitable manner;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('A parenting order specifying parenting time and decision-making responsibility pursuant to section 16.1 of the Divorce Act;');
      reliefItems.push('A child support order pursuant to section 15.1 of the Divorce Act and the Federal Child Support Guidelines, SOR/97-175;');
    }

    if (divorceData.spousalSupportRequested || divorceData.requestSpousalSupport) {
      reliefItems.push('A maintenance order pursuant to section 15.2 of the Divorce Act and the Family Law Act, RSPEI 1988, c. F-2.1, as corollary relief;');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`An order restoring the Petitioner's former name: ${divorceData.previousName};`);
    }

    reliefItems.push('Such further and other relief as this Court deems just and appropriate.');

    // Agreed corollary relief (agreed support amount, spousal-support

    // waiver, property agreement) — spliced before the final general prayer.

    this.appendAgreedReliefItems(reliefItems, divorceData);


    reliefItems.forEach((relief, index) => {
      const letter = String.fromCharCode(97 + index);
      items.push({
        number: null,
        content: relief,
        type: 'relief_item',
        style: 'letter',
        letter
      });
    });

    return {
      title: 'RELIEF REQUESTED',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * PEI jurisdiction statement — habitually resident for 1 year.
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    return `Either the Petitioner or the Respondent has been habitually resident in the Province of Prince Edward Island for at least one year immediately preceding the filing of this Petition, as required by section 3(1) of the Divorce Act.`;
  }

  /**
   * PEI venue reason — location of filing.
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    const location = divorceData.county || divorceData.city || '[location]';
    return `the Petitioner resides in ${location}, Prince Edward Island`;
  }

  /**
   * PEI verification text — solemn declaration.
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PETITIONER NAME]';
    return `I, ${name}, Petitioner, solemnly declare that the facts stated in this Petition are true to the best of my knowledge and belief, and I make this solemn declaration conscientiously believing it to be true.`;
  }
}

module.exports = PEIDivorcePetitionTemplate;
