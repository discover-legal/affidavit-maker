// templates/states/kenya/DivorcePetitionTemplate.js
// Kenya divorce petition template
// Governing Law: Marriage Act, 2014 (No. 4 of 2014); Matrimonial Property Act, 2013

'use strict';

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Kenya Divorce Petition Template
 *
 * Kenya uses the term "Petition" for divorce proceedings under the Marriage Act, 2014.
 * The petition is filed in the High Court (Family Division) for civil, Christian,
 * customary, and Hindu marriages, or in the Kadhi's Court for Islamic marriages.
 *
 * Key Legal References:
 * - Marriage Act, 2014 (No. 4 of 2014)
 *   - s.6: Types of marriage recognized (civil, Christian, customary, Hindu, Islamic)
 *   - s.65: Jurisdiction — either party must be resident in Kenya at time of filing
 *   - s.66: Grounds — adultery, cruelty, desertion (3+ years), exceptional depravity
 *           (court must be satisfied marriage has broken down irretrievably)
 *   - s.67-68: Mandatory reconciliation — court must refer parties to attempt reconciliation
 *   - s.77-80: Maintenance
 * - Matrimonial Property Act, 2013 (No. 49 of 2013) — contribution-based property division
 * - Children Act, 2022 (No. 29 of 2022) — best interests of child, parenting plan
 * - Constitution of Kenya, 2010, Art. 170 — Kadhi's Courts for Islamic marriages
 *
 * Residency Requirement (Marriage Act, 2014, s.65):
 * - Either party must be resident in Kenya at the time of filing
 * - No minimum duration specified
 *
 * Kenya-Specific:
 * - Parties are "Petitioner" and "Respondent"
 * - Court is High Court (Family Division) or Kadhi's Court (Islamic marriages)
 * - Filing fee: approx KES 4,000-10,000
 * - Process: Petition -> Reconciliation attempt -> Decree Nisi -> Decree Absolute
 * - A4 paper size, KES currency
 *
 * @class KenyaDivorcePetitionTemplate
 * @extends BaseDivorcePetitionTemplate
 */
class KenyaDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'KE';
    this.stateName = 'Kenya';
    this.countryCode = 'KE';
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

    // Kenya residency: resident in Kenya at time of filing (Marriage Act s.65)
    this.residencyRequirements = {
      stateMonths: 0,
      countyDays: 0,
      description: 'Either party must be resident in Kenya at the time of filing the petition (Marriage Act, 2014, s.65).'
    };

    // No mandatory waiting period after filing — reconciliation is mandatory, then Decree Nisi → Absolute
    this.waitingPeriod = {
      days: 0,
      description: 'No statutory waiting period after filing. Mandatory reconciliation attempt required (s.67-68). Decree Nisi becomes Decree Absolute after a prescribed period (typically 30 days).'
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
    return 'Case No.';
  }

  getDefaultCourt(county) {
    const location = (county || '[LOCATION]').toUpperCase();
    return `HIGH COURT OF KENYA AT ${location}`;
  }

  /**
   * Kenya case caption uses "Petitioner" and "Respondent".
   * Filed in the High Court (Family Division) or Kadhi's Court (Islamic marriages).
   */
  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county) || '[COURT NAME]').toUpperCase();
    const caseLabel = this.getCaseNumberLabel();
    const caseNumber = divorceData.caseNumber || '[CASE NUMBER]';

    const petitioner = (divorceData.petitionerName || '[PETITIONER NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();

    const caption = [
      `IN THE ${courtName}`,
      '',
      `${caseLabel} ${caseNumber}`,
      '',
      `IN THE MATTER OF A PETITION FOR DIVORCE`,
      `UNDER THE MARRIAGE ACT, 2014`,
      '',
      `BETWEEN:`,
      '',
      `${petitioner}`,
      `Petitioner`,
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
   * Kenya jurisdiction statement — Marriage Act, 2014, s.65.
   * Either party must be resident in Kenya at the time of filing.
   */
  getJurisdictionStatement(divorceData) {
    return `The Petitioner (or Respondent) is resident in the Republic of Kenya at the time of filing this Petition, as required by section 65 of the Marriage Act, 2014 (No. 4 of 2014).`;
  }

  /**
   * Kenya venue reason — Petitioner or Respondent resides in this court station.
   */
  getVenueReason(divorceData) {
    const location = divorceData.county || '[COURT STATION]';
    return `the Petitioner or Respondent resides within the jurisdiction of the court station at ${location}`;
  }

  /**
   * Kenya relief section — Marriage Act, 2014 terminology.
   * Property division under Matrimonial Property Act, 2013 (contribution-based).
   * Maintenance under Marriage Act, 2014, s.77-80.
   */
  generateReliefSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 15;

    items.push({
      number: null,
      content: 'THE PETITIONER PRAYS that the Honourable Court be pleased to grant the following orders:',
      type: 'relief_intro'
    });

    const reliefItems = [
      'A Decree Nisi dissolving the marriage between the Petitioner and the Respondent, and thereafter a Decree Absolute, pursuant to section 66 of the Marriage Act, 2014;',
      'An order for the division of matrimonial property in accordance with the Matrimonial Property Act, 2013, taking into account the contribution (financial and non-financial) of each party;',
      'An order for the division of household effects and personal property;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('An order granting custody and parental responsibility for the minor child(ren) of the marriage to the Petitioner, with reasonable access to the Respondent, pursuant to the Children Act, 2022;');
      reliefItems.push('An order for child maintenance payable by the Respondent, in an amount to be determined by this Honourable Court;');
    }

    if (divorceData.spousalSupportRequested || divorceData.requestSpousalSupport) {
      reliefItems.push('An order for maintenance in favour of the Petitioner pursuant to sections 77-80 of the Marriage Act, 2014;');
    }

    reliefItems.push('Costs of this Petition;');
    reliefItems.push('Such further and other relief as this Honourable Court deems just and expedient to grant.');

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
      title: 'PRAYER',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Kenya verification text.
   * Kenya uses a sworn affidavit (supporting affidavit filed with the petition).
   * Oaths and Statutory Declarations Act (Cap 15).
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PETITIONER NAME]';
    return `I, ${name}, the Petitioner herein, make oath and say that the contents of this Petition are true to the best of my knowledge, information, and belief.`;
  }

  /**
   * Kenya grounds for divorce.
   * Marriage Act, 2014, s.66 — the court must be satisfied that the marriage
   * has broken down irretrievably on one of the following grounds:
   *   (a) adultery
   *   (b) cruelty (physical or mental)
   *   (c) desertion for 3+ years
   *   (d) exceptional depravity
   */
  getGroundsStatement(groundsForDivorce) {
    const g = (groundsForDivorce || 'cruelty').toLowerCase();
    if (g.includes('adultery')) {
      return 'The Respondent has committed adultery and the Petitioner finds it intolerable to continue living with the Respondent, within the meaning of section 66(a) of the Marriage Act, 2014. The marriage has broken down irretrievably.';
    }
    if (g.includes('desertion')) {
      return 'The Respondent has deserted the Petitioner for a continuous period of at least three years immediately preceding the presentation of this Petition, within the meaning of section 66(c) of the Marriage Act, 2014. The marriage has broken down irretrievably.';
    }
    if (g.includes('depravity') || g.includes('exceptional')) {
      return 'The Respondent has behaved in such a way that the Petitioner cannot reasonably be expected to continue living with the Respondent (exceptional depravity), within the meaning of section 66(d) of the Marriage Act, 2014. The marriage has broken down irretrievably.';
    }
    // Default: cruelty
    return 'The Respondent has been cruel to the Petitioner, being physical or mental cruelty of such a nature as to render continued cohabitation intolerable, within the meaning of section 66(b) of the Marriage Act, 2014. The marriage has broken down irretrievably.';
  }
}

module.exports = KenyaDivorcePetitionTemplate;
