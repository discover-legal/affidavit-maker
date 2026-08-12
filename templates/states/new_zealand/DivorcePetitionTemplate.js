// templates/states/new_zealand/DivorcePetitionTemplate.js
// New Zealand dissolution of marriage application template
// Governing Law: Family Proceedings Act 1980; Property (Relationships) Act 1976

'use strict';

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * New Zealand Dissolution of Marriage Application Template
 *
 * New Zealand uses "dissolution of marriage" rather than "divorce" in formal legal
 * documents. The Family Court handles all dissolution applications.
 *
 * Key Legal References:
 * - Family Proceedings Act 1980
 *   - s.37: Domicile requirement — either spouse must be domiciled in NZ
 *   - s.39: Sole ground — irreconcilable breakdown shown by 2-year separation
 *   - s.42: Registrar-made orders become final 1 month after being made;
 *           an order made by a Judge at a hearing takes effect immediately
 * - Property (Relationships) Act 1976 (relationship property — equal sharing)
 * - Care of Children Act 2004 (guardianship, day-to-day care, contact)
 * - Child Support Act 1991 (child support — administered by Inland Revenue)
 * - Oaths and Declarations Act 1957 (affidavit requirements)
 *
 * Domicile Requirement (Family Proceedings Act, s.37):
 * - Either spouse must be domiciled in New Zealand at the time of the application.
 *   Domicile means NZ is the person's permanent home.
 *
 * New Zealand-Specific:
 * - Parties are "Applicant" and "Respondent" (joint applications also permitted)
 * - Court is the Family Court of New Zealand
 * - Filing fee: approx. NZD $242
 * - Undefended applications: dissolution granted without a hearing
 * - A4 paper size, NZD currency
 * - FAM No. (Family Court case reference)
 *
 * @class NewZealandDivorcePetitionTemplate
 * @extends BaseDivorcePetitionTemplate
 */
class NewZealandDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'NZ';
    this.stateName = 'New Zealand';
    this.countryCode = 'NZ';
    this.documentTitle = 'APPLICATION FOR DISSOLUTION OF MARRIAGE';

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

    // NZ domicile requirement (not residency period)
    this.residencyRequirements = {
      stateMonths: 0,
      countyDays: 0,
      description: 'Either spouse must be domiciled in New Zealand at the time of the application (Family Proceedings Act 1980, s.37).'
    };

    // Registrar-made orders become final 1 month after being made (s.42)
    this.waitingPeriod = {
      days: 30,
      description: 'A dissolution order made by a Registrar takes effect as a final order 1 month after it is made; an order made by a Family Court Judge at a hearing takes effect immediately (Family Proceedings Act 1980, s.42). The 2-year separation must be completed before filing.'
    };

    this.formatting = {
      fontSize: '12pt',
      fontFamily: 'Times New Roman',
      lineHeight: '1.5',
      margin: '2.54cm',
      paperSize: 'A4'
    };
  }

  getCaseNumberLabel() {
    return 'FAM No.';
  }

  getDefaultCourt(county) {
    const city = (county || '[CITY]').toUpperCase();
    return `FAMILY COURT AT ${city}`;
  }

  /**
   * NZ case caption uses "Applicant" and "Respondent".
   * Family Court proceedings reference "IN THE FAMILY COURT AT [location]".
   */
  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county) || '[COURT NAME]').toUpperCase();
    const caseLabel = this.getCaseNumberLabel();
    const caseNumber = divorceData.caseNumber || '[FAM NUMBER]';

    const applicant = (divorceData.petitionerName || '[APPLICANT NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();

    const caption = [
      `IN THE ${courtName}`,
      '',
      `${caseLabel} ${caseNumber}`,
      '',
      `IN THE MATTER of the Family Proceedings Act 1980`,
      '',
      `BETWEEN:`,
      '',
      `${applicant}`,
      `Applicant`,
      '',
      `AND`,
      '',
      `${respondent}`,
      `Respondent`
    ].join('\n');

    return {
      courtName,
      caseNumber: divorceData.caseNumber,
      petitioner: divorceData.petitionerName,
      respondent: divorceData.respondentName,
      formatted: caption
    };
  }

  /**
   * NZ jurisdiction statement — Family Proceedings Act 1980, s.37.
   * Domicile (not residency) is the requirement.
   */
  getJurisdictionStatement(divorceData) {
    return `Either the Applicant or the Respondent is domiciled in New Zealand at the time of this application, as required by section 37 of the Family Proceedings Act 1980.`;
  }

  /**
   * NZ venue reason — Applicant or Respondent resides in this court district.
   */
  getVenueReason(divorceData) {
    const location = divorceData.county || '[COURT LOCATION]';
    return `the Applicant or Respondent resides in ${location}`;
  }

  /**
   * NZ relief section — uses NZ legal terminology.
   * Dissolution under Family Proceedings Act 1980.
   * Property under Property (Relationships) Act 1976.
   * Children under Care of Children Act 2004.
   */
  generateReliefSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 15;

    items.push({
      number: null,
      content: 'THE APPLICANT REQUESTS that the Court make the following orders:',
      type: 'relief_intro'
    });

    const reliefItems = [
      'An order for dissolution of marriage pursuant to section 39 of the Family Proceedings Act 1980;',
      'An order for division of relationship property pursuant to the Property (Relationships) Act 1976;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('A parenting order specifying day-to-day care and contact arrangements pursuant to the Care of Children Act 2004;');
      reliefItems.push('Such orders for child support as may be appropriate under the Child Support Act 1991;');
    }

    if (divorceData.spousalSupportRequested || divorceData.requestSpousalSupport) {
      reliefItems.push('An order for maintenance pursuant to sections 63-74 of the Family Proceedings Act 1980;');
    }

    reliefItems.push('Such further and other orders as the Court considers just.');

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
      title: 'RELIEF SOUGHT',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * NZ verification text.
   * Uses a sworn affidavit under the Oaths and Declarations Act 1957.
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[APPLICANT NAME]';
    return `I, ${name}, Applicant, swear (or solemnly affirm) that the contents of this application are true, to the best of my knowledge, information, and belief.`;
  }

  /**
   * NZ grounds for dissolution.
   * Family Proceedings Act 1980:
   *   - s.39: Standard ground — 2-year separation
   *   - s.39A: Family violence exception — protected person with final protection order
   *            (in force 17 October 2025, inserted by the Family Proceedings (Dissolution
   *            of Marriage or Civil Union for Family Violence) Amendment Act 2024)
   * There are NO fault-based grounds in New Zealand.
   */
  getGroundsText(groundsForDivorce) {
    const g = (groundsForDivorce || 'separation').toLowerCase();
    if (g.includes('family_violence') || g.includes('protection_order') || g.includes('violence')) {
      return 'The Applicant is a protected person under a final protection order made against the Respondent, and applies for dissolution pursuant to section 39A of the Family Proceedings Act 1980 (as inserted by the Family Proceedings (Dissolution of Marriage or Civil Union for Family Violence) Amendment Act 2024).';
    }
    // Default: 2-year separation (s.39)
    return 'The marriage has broken down irreconcilably as the parties have lived apart for a continuous period of at least two years immediately preceding the filing of this application, within the meaning of section 39 of the Family Proceedings Act 1980.';
  }
}

module.exports = NewZealandDivorcePetitionTemplate;
