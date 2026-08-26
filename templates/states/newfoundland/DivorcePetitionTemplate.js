// templates/states/newfoundland/DivorcePetitionTemplate.js
// Newfoundland and Labrador divorce application template
// Governing Law: Divorce Act (RSC 1985, c. 3 (2nd Supp.)); Family Law Act, RSNL 1990, c. F-2

'use strict';

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Newfoundland and Labrador Divorce Application Template
 *
 * NL uses the term "Petition" for divorce proceedings filed in the
 * Supreme Court of Newfoundland and Labrador, consistent with common-law
 * Atlantic Canada practice (Judicature Act, RSNL 1990, c. J-4).
 * The Supreme Court of Newfoundland and Labrador has exclusive jurisdiction
 * over divorce matters.
 *
 * Key Legal References:
 * - Divorce Act, RSC 1985, c. 3 (2nd Supp.) (federal — governs divorce nationwide)
 *   - s.3(1): Residency — either spouse habitually resident in NL for at least 1 year
 *   - s.8(2)(a): Separation for 1 year is the primary ground
 *   - s.8(2)(b): Adultery or physical/mental cruelty (rare)
 * - Family Law Act, RSNL 1990, c. F-2 (provincial — property division on marriage breakdown)
 * - Family Law Act, RSNL 1990, c. F-2 (provincial — maintenance/support obligations)
 * - Judicature Act, RSNL 1990, c. J-4 (court procedures and jurisdiction)
 * - Children and Youth Care and Protection Act, SNL 2010, c. C-12.2 (child welfare)
 * - Child Support Guidelines, SOR/97-175 (federal support calculation)
 *
 * Residency Requirement (Divorce Act, s.3):
 * - Either spouse must have been habitually resident in NL for at least 1 year
 *   immediately before the divorce application.
 *
 * NL-Specific:
 * - Parties are "Petitioner" and "Respondent"
 * - Court is Supreme Court of Newfoundland and Labrador (General Division, or Family Division where established)
 * - Court File No. instead of "CAUSE NO." or "CASE NO."
 * - Uncontested divorce typically handled on paper without a hearing
 * - Property division: Family Law Act, RSNL 1990, c. F-2 (equal division presumption)
 * - Support is termed "maintenance" under the Family Law Act, RSNL 1990, c. F-2
 *
 * @class NewfoundlandDivorcePetitionTemplate
 * @extends BaseDivorcePetitionTemplate
 */
class NewfoundlandDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'NL';
    this.stateName = 'Newfoundland and Labrador';
    
    // Canadian terminology (see templates/core/terminology.js):
    // Supreme Court of Newfoundland and Labrador sits at judicial centres; this template's validated forms use Petitioner/Respondent.
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
    this.documentTitle = 'ORIGINATING APPLICATION (FAMILY LAW)';

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

    // NL residency: 1 year habitually resident in province (Divorce Act s.3(1))
    this.residencyRequirements = {
      stateMonths: 12,
      countyDays: 0,
      description: 'Either spouse must have been habitually resident in Newfoundland and Labrador for at least one year immediately before the application (Divorce Act, s.3(1)).'
    };

    // No mandatory waiting period after filing in NL beyond the separation ground itself
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
   * NL uses "Court File No." (not "CASE NO." or "CAUSE NO.").
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'Court File No.';
  }

  /**
   * Default court for NL divorce — Supreme Court of Newfoundland and Labrador.
   * @param {string} county - City or location of filing
   * @returns {string} Default court name
   */
  getDefaultCourt(county) {
    return `SUPREME COURT OF NEWFOUNDLAND AND LABRADOR — ${(county || '______________').toUpperCase()}`;
  }

  /**
   * NL grounds for divorce under the Divorce Act.
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
   * NL relief section — uses Canadian Divorce Act corollary relief terminology.
   * "Corollary relief" (not "ancillary relief") is the correct term under the Divorce Act.
   * Post-March 1, 2021 amendments (Bill C-78): "parenting time" and
   * "decision-making responsibility" replace "custody" and "access" (Divorce Act, ss.16.1-16.92).
   * Family Law Act, RSNL 1990, c. F-2 governs property division.
   * Spousal support is termed "maintenance" under the Family Law Act, RSNL 1990, c. F-2.
   * Petitioner/Respondent labels per NL divorce practice.
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
      'Division of matrimonial property pursuant to the Family Law Act, RSNL 1990, c. F-2;',
      'An order allocating responsibility for debts in an equitable manner;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('A parenting order specifying parenting time and decision-making responsibility pursuant to section 16.1 of the Divorce Act;');
      reliefItems.push('A child support order pursuant to section 15.1 of the Divorce Act and the Federal Child Support Guidelines, SOR/97-175;');
    }

    if (divorceData.spousalSupportRequested || divorceData.requestSpousalSupport) {
      reliefItems.push('A maintenance order pursuant to section 15.2 of the Divorce Act and the Family Law Act, RSNL 1990, c. F-2, as corollary relief;');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`An order restoring the Petitioner's former name: ${divorceData.previousName};`);
    }

    reliefItems.push('Such further and other relief as this Court deems just and appropriate.');

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
   * NL jurisdiction statement — habitually resident for 1 year.
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    return `Either the Petitioner or the Respondent has been habitually resident in the Province of Newfoundland and Labrador for at least one year immediately preceding the filing of this Petition, as required by section 3(1) of the Divorce Act.`;
  }

  /**
   * NL venue reason — city/location of filing.
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    const location = divorceData.county || divorceData.city || '[location]';
    return `the Petitioner resides in ${location}`;
  }

  /**
   * NL verification text — affirmation rather than perjury statement.
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PETITIONER NAME]';
    return `I, ${name}, Petitioner, solemnly declare that the facts stated in this Petition are true to the best of my knowledge and belief, and I make this solemn declaration conscientiously believing it to be true.`;
  }
}

module.exports = NewfoundlandDivorcePetitionTemplate;
