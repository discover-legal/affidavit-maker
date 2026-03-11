// templates/states/new_south_wales/DivorcePetitionTemplate.js
// New South Wales divorce application template
// Governing Law: Family Law Act 1975 (Cth); Family Law Rules 2004 (Cth)

'use strict';

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * New South Wales Divorce Application Template
 *
 * Australian divorce is governed entirely by federal law — the Family Law Act 1975 (Cth).
 * There is only one ground: irretrievable breakdown of the marriage, evidenced by
 * 12 months of continuous separation (s.48(1)).
 *
 * Key Legal References:
 * - Family Law Act 1975 (Cth)
 *   - s.39(3): Jurisdiction — Australian citizen, domiciled, or ordinarily resident 12 months
 *   - s.48(1): Sole ground — irretrievable breakdown (12-month separation)
 *   - s.55: Divorce order takes effect 1 month and 1 day after made
 *   - s.60CA: Best interests of the child as paramount consideration
 *   - s.79: Property settlement — just and equitable division
 *   - ss.72-75: Spousal maintenance
 * - Family Law Rules 2004 (Cth) — procedural rules
 * - Oaths Act 1900 (NSW) — affidavit formalities
 *
 * Court: Federal Circuit and Family Court of Australia (FCFCOA)
 * Registry: Sydney (Parramatta), Newcastle, Wollongong
 *
 * @class NewSouthWalesDivorcePetitionTemplate
 * @extends BaseDivorcePetitionTemplate
 */
class NewSouthWalesDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'NSW';
    this.stateName = 'New South Wales';
    this.countryCode = 'AU';
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

    // Australian jurisdiction — 12-month residency (s.39(3))
    this.residencyRequirements = {
      stateMonths: 12,
      countyDays: 0,
      description: 'Either spouse must be an Australian citizen, domiciled in Australia, or ordinarily resident in Australia for at least 12 months immediately before the application (Family Law Act 1975 (Cth), s.39(3)).'
    };

    // No waiting period after filing — 12-month separation must already be complete
    this.waitingPeriod = {
      days: 0,
      description: 'No waiting period after filing. The 12-month separation must be complete before the hearing. Divorce Order takes effect 1 month and 1 day after it is made (s.55).'
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
    return 'File Number';
  }

  getDefaultCourt(county) {
    const city = (county || '[CITY]').toUpperCase();
    return `FEDERAL CIRCUIT AND FAMILY COURT OF AUSTRALIA — ${city} REGISTRY`;
  }

  /**
   * NSW case caption uses "Applicant" and "Respondent".
   */
  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county) || '[COURT NAME]').toUpperCase();
    const caseLabel = this.getCaseNumberLabel();
    const caseNumber = divorceData.caseNumber || '[FILE NUMBER]';

    const applicant = (divorceData.petitionerName || '[APPLICANT NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();

    const caption = [
      `IN THE ${courtName}`,
      '',
      `${caseLabel}: ${caseNumber}`,
      '',
      `IN THE MATTER OF THE FAMILY LAW ACT 1975 (CTH)`,
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
   * Australian jurisdiction statement — Family Law Act 1975 (Cth), s.39(3).
   */
  getJurisdictionStatement(divorceData) {
    return `Either the Applicant or the Respondent is an Australian citizen, is domiciled in Australia, or has been ordinarily resident in Australia for at least twelve months immediately preceding the filing of this Application, as required by section 39(3) of the Family Law Act 1975 (Cth).`;
  }

  /**
   * Venue reason — registry location.
   */
  getVenueReason(divorceData) {
    const location = divorceData.county || '[REGISTRY LOCATION]';
    return `the Applicant or Respondent resides within the jurisdiction of the ${location} registry`;
  }

  /**
   * Relief section — Australian divorce and ancillary relief.
   */
  generateReliefSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 15;

    items.push({
      number: null,
      content: 'THE APPLICANT SEEKS THE FOLLOWING ORDERS:',
      type: 'relief_intro'
    });

    const reliefItems = [
      'A divorce order pursuant to section 48 of the Family Law Act 1975 (Cth);',
      'A property settlement order pursuant to section 79 of the Family Law Act 1975 (Cth), providing for a just and equitable division of property;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Parenting orders pursuant to Part VII of the Family Law Act 1975 (Cth), providing for the parenting arrangements for the child(ren) of the marriage;');
      reliefItems.push('A child support order or assessment through Services Australia (Child Support) pursuant to the Child Support (Assessment) Act 1989 (Cth);');
    }

    if (divorceData.spousalSupportRequested || divorceData.requestSpousalSupport) {
      reliefItems.push('A spousal maintenance order pursuant to sections 72-75 of the Family Law Act 1975 (Cth);');
    }

    reliefItems.push('Such further or other orders as the Court considers appropriate.');

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
      title: 'ORDERS SOUGHT',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Australian verification — sworn affidavit, not US-style penalty of perjury.
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[APPLICANT NAME]';
    return `I, ${name}, the Applicant, make oath and say (or solemnly affirm) that the contents of this Application are true and correct to the best of my knowledge, information, and belief.`;
  }

  /**
   * Australian grounds — only one: irretrievable breakdown (12-month separation).
   */
  getGroundsStatement(groundsForDivorce) {
    return 'The marriage has broken down irretrievably within the meaning of section 48(1) of the Family Law Act 1975 (Cth). The parties have lived separately and apart for a continuous period of not less than 12 months immediately preceding the date of filing of this Application.';
  }
}

module.exports = NewSouthWalesDivorcePetitionTemplate;
