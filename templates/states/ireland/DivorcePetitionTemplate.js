// templates/states/ireland/DivorcePetitionTemplate.js
// Ireland divorce application template
// Governing Law: Family Law (Divorce) Act 1996, as amended by Family Law Act 2019

'use strict';

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Ireland Divorce Application Template
 *
 * Ireland uses a "Family Law Civil Bill" to initiate divorce proceedings in the
 * Circuit Family Court. High Court proceedings use an "Originating Notice of Motion"
 * or "Special Summons" for more complex cases.
 *
 * Key Legal References:
 * - Family Law (Divorce) Act 1996 (primary divorce statute)
 *   - s.5(1)(a): Lived apart for at least 2 of the preceding 3 years (as amended 2019)
 *   - s.5(1)(b): No reasonable prospect of reconciliation
 *   - s.5(1)(c): Proper provision made or will be made for spouses and dependants
 * - Family Law Act 2019, s.9: Reduced separation from 4/5 years to 2/3 years
 *   (implementing 38th Amendment to the Constitution)
 * - Constitution of Ireland, Art. 41.3.2 (divorce provision)
 * - Family Law Act 1995: s.16 factors for financial provision (applied by analogy)
 * - Guardianship of Infants Act 1964 (as amended): custody, access, guardianship
 * - Children and Family Relationships Act 2015: modern parentage and guardianship
 *
 * Residency Requirement (1996 Act, s.39(1)(a)):
 * - Either spouse must be domiciled in Ireland on the date of institution of proceedings, OR
 * - Ordinarily resident in Ireland for at least 1 year immediately before that date.
 *
 * Ireland-Specific:
 * - Parties are "Applicant" and "Respondent"
 * - Court is Circuit Family Court (standard) or High Court (complex/high-value)
 * - No court filing fee for family law applications in Circuit Court
 * - No no-fault divorce in the US sense — separation is required, plus court satisfaction
 *   of proper provision and no prospect of reconciliation
 * - Record No. (not "Case No." or "Court File No.")
 * - A4 paper size, EUR currency
 *
 * @class IrelandDivorcePetitionTemplate
 * @extends BaseDivorcePetitionTemplate
 */
class IrelandDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'IRL';
    this.stateName = 'Ireland';
    this.countryCode = 'IE';
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

    // Ireland residency: domiciled or ordinarily resident for 1 year (s.39(1)(a))
    this.residencyRequirements = {
      stateMonths: 12,
      countyDays: 0,
      description: 'Either spouse must be domiciled in Ireland on the date of institution of proceedings OR ordinarily resident in Ireland for at least one year immediately before that date (Family Law (Divorce) Act 1996, s.39(1)(a)).'
    };

    // No mandatory waiting period after filing
    this.waitingPeriod = {
      days: 0,
      description: 'No mandatory waiting period after filing. The 2-year separation must already be satisfied before or by the date the court grants the decree.'
    };

    this.formatting = {
      fontSize: '12pt',
      fontFamily: 'Times New Roman',
      lineHeight: '1.5',
      margin: '1in',
      paperSize: 'A4'
    };
  }

  getCaseNumberLabel() {
    return 'Record No.';
  }

  getDefaultCourt(county) {
    const location = (county || '[COUNTY/CITY]').toUpperCase();
    return `CIRCUIT FAMILY COURT \u2014 ${location}`;
  }

  /**
   * Ireland case caption uses "Applicant" and "Respondent".
   * Circuit Family Court uses "Record No." as the case identifier.
   */
  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county) || '[COURT NAME]').toUpperCase();
    const caseLabel = this.getCaseNumberLabel();
    const caseNumber = divorceData.caseNumber || '[RECORD NUMBER]';

    const applicant = (divorceData.petitionerName || '[APPLICANT NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();

    const caption = [
      `IN THE ${courtName}`,
      '',
      `${caseLabel} ${caseNumber}`,
      '',
      `IN THE MATTER OF THE FAMILY LAW (DIVORCE) ACT 1996`,
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
   * Ireland jurisdiction statement — Family Law (Divorce) Act 1996, s.39(1)(a).
   * Either spouse must be domiciled in Ireland or ordinarily resident for 1 year.
   */
  getJurisdictionStatement(divorceData) {
    return `Either the Applicant or the Respondent is domiciled in Ireland, or has been ordinarily resident in Ireland for at least one year immediately preceding the institution of these proceedings, as required by section 39(1)(a) of the Family Law (Divorce) Act 1996.`;
  }

  /**
   * Ireland venue reason — Applicant or Respondent resides in this circuit.
   */
  getVenueReason(divorceData) {
    const location = divorceData.county || '[COUNTY/CITY]';
    return `the Applicant or Respondent resides in ${location}`;
  }

  /**
   * Ireland relief section — uses Irish family law terminology.
   * "Proper provision" is the constitutional and statutory standard.
   * Property orders: Family Law (Divorce) Act 1996, ss.14-18.
   * Maintenance: s.13 (periodical payments), s.14 (lump sum), s.15 (property adjustment).
   * Pension: s.17 (pension adjustment orders).
   */
  generateReliefSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 15;

    items.push({
      number: null,
      content: 'THE APPLICANT REQUESTS that the Court grant the following relief:',
      type: 'relief_intro'
    });

    const reliefItems = [
      'A Decree of Divorce pursuant to section 5 of the Family Law (Divorce) Act 1996, as amended by section 9 of the Family Law Act 2019;',
      'Such property adjustment orders as the Court considers proper pursuant to section 15 of the Family Law (Divorce) Act 1996;',
      'Such financial compensation orders as the Court considers proper pursuant to sections 13 and 14 of the Family Law (Divorce) Act 1996;',
      'A pension adjustment order, if applicable, pursuant to section 17 of the Family Law (Divorce) Act 1996;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Such orders for the custody of and right of access to dependent children as the Court considers proper pursuant to section 5(2) of the Guardianship of Infants Act 1964 (as amended);');
      reliefItems.push('Such orders for the maintenance of dependent children as the Court considers proper;');
    }

    if (divorceData.spousalSupportRequested || divorceData.requestSpousalSupport) {
      reliefItems.push('A periodical payments order (maintenance) for the benefit of the Applicant pursuant to section 13 of the Family Law (Divorce) Act 1996;');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`An order permitting the Applicant to revert to the name: ${divorceData.previousName};`);
    }

    reliefItems.push('Such further and other relief as the Court considers proper.');

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
   * Ireland verification text.
   * Ireland uses sworn affidavits (not US-style "penalty of perjury" declarations).
   * The jurat is sworn before a Commissioner for Oaths or Practising Solicitor.
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[APPLICANT NAME]';
    return `I, ${name}, Applicant, make oath and say that the contents of this Application are true, to the best of my knowledge, information, and belief.`;
  }

  /**
   * Ireland grounds for divorce.
   * Family Law (Divorce) Act 1996, s.5(1) requires three conditions:
   *   (a) Lived apart for at least 2 of the preceding 3 years
   *   (b) No reasonable prospect of reconciliation
   *   (c) Proper provision made or will be made
   * Ireland does NOT have fault-based grounds (adultery/cruelty are not separate grounds,
   * though they may be relevant to the separation requirement or proper provision).
   */
  getGroundsStatement(groundsForDivorce) {
    return (
      'The Applicant and the Respondent have lived apart from one another for a period of, ' +
      'or periods amounting to, at least two years during the preceding three years, within the ' +
      'meaning of section 5(1)(a) of the Family Law (Divorce) Act 1996, as amended by section 9 ' +
      'of the Family Law Act 2019. There is no reasonable prospect of a reconciliation between ' +
      'the spouses (s.5(1)(b)). The Applicant submits that proper provision has been made or will ' +
      'be made for the spouses and any dependent members of the family (s.5(1)(c)).'
    );
  }
}

module.exports = IrelandDivorcePetitionTemplate;
