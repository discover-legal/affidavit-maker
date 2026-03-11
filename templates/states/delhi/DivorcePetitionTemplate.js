// templates/states/delhi/DivorcePetitionTemplate.js
// Delhi divorce petition template
// Governing Law: Hindu Marriage Act 1955 / Special Marriage Act 1954 / Indian Divorce Act 1869

'use strict';

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Delhi Divorce Petition Template
 *
 * India uses a personal law system — the applicable marriage/divorce statute depends
 * on the religion of the parties:
 *   - Hindu Marriage Act 1955 (HMA) — Hindus, Buddhists, Jains, Sikhs
 *   - Special Marriage Act 1954 (SMA) — inter-faith or secular marriages
 *   - Indian Divorce Act 1869 (IDA) — Christians
 *   - Dissolution of Muslim Marriages Act 1939 (DMMA) — Muslim wives
 *
 * Filing jurisdiction (HMA s.19 / SMA s.31):
 *   - Where the marriage was solemnized, OR
 *   - Where the parties last resided together, OR
 *   - Where the respondent resides, OR
 *   - Where the petitioner resides (if wife is petitioner)
 *
 * Mutual consent (HMA s.13B / SMA s.28):
 *   - Living separately for 1+ year
 *   - Joint petition → First Motion → 6-month cooling-off → Second Motion → Decree
 *   - Amardeep Singh v. Harveen Kaur (2017): courts may waive the cooling-off period
 *   - Delhi HC Full Bench (Dec 2025, MAT.APP.(FC) 111/2025): 1-year separation
 *     under s.13B(1) is directory (not mandatory) and waivable under s.14(1)
 *     in cases of exceptional hardship/depravity; both periods waivable independently
 *
 * Court: Family Court (Family Courts Act 1984)
 * Filing fee: ~INR 500-5,000 (varies)
 * Stamp paper: INR 10 (Delhi)
 * Paper size: A4
 *
 * @class DelhiDivorcePetitionTemplate
 * @extends BaseDivorcePetitionTemplate
 */
class DelhiDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'IN_DL';
    this.stateName = 'Delhi';
    this.countryCode = 'IN';
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

    this.residencyRequirements = {
      stateMonths: 0,
      countyDays: 0,
      description: 'Filed where the marriage was solemnized, or where the parties last resided together, or where the respondent resides, or where the petitioner (wife) resides (HMA s.19).'
    };

    this.waitingPeriod = {
      days: 180,
      description: 'Mutual consent: 6-month cooling-off period between First and Second Motion (waivable per Amardeep Singh v. Harveen Kaur (2017)). Delhi HC Full Bench (Dec 2025): 1-year separation under s.13B(1) is also waivable under s.14(1) in cases of exceptional hardship/depravity.'
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
    return 'FAMILY COURT, SAKET, NEW DELHI';
  }

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
      `IN THE MATTER OF:`,
      '',
      `${petitioner}`,
      `Petitioner`,
      '',
      `VERSUS`,
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

  getJurisdictionStatement(divorceData) {
    return `This Hon'ble Court has jurisdiction to entertain this petition as the marriage was solemnized / the parties last resided together / the Respondent resides / the Petitioner (wife) resides within the jurisdiction of this Court, as required under Section 19 of the Hindu Marriage Act 1955 / Section 31 of the Special Marriage Act 1954 (as applicable).`;
  }

  getVenueReason(divorceData) {
    const location = divorceData.county || 'New Delhi';
    return `the Petitioner or Respondent resides within the jurisdiction of this Court at ${location}`;
  }

  generateReliefSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 15;

    items.push({
      number: null,
      content: 'PRAYER: It is, therefore, most respectfully prayed that this Hon\'ble Court may be pleased to:',
      type: 'relief_intro'
    });

    const reliefItems = [
      'Pass a decree of divorce dissolving the marriage between the Petitioner and the Respondent;',
      'Grant permanent alimony / maintenance as this Hon\'ble Court deems fit and proper;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Grant custody of the minor child(ren) to the Petitioner / Respondent as this Court deems appropriate in the best interest of the child(ren);');
      reliefItems.push('Direct the Respondent / Petitioner to pay maintenance for the minor child(ren) under Section 26 of the Hindu Marriage Act 1955 / BNSS s.144;');
    }

    if (divorceData.spousalSupportRequested || divorceData.requestSpousalSupport) {
      reliefItems.push('Grant maintenance pendente lite and expenses of the proceedings under Section 24 of the Hindu Marriage Act 1955;');
    }

    reliefItems.push('Pass any other order(s) as this Hon\'ble Court may deem fit and proper in the facts and circumstances of the case.');

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

  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PETITIONER NAME]';
    return `Verified at New Delhi on this _____ day of __________, _______. I, ${name}, the Petitioner above-named, do hereby verify that the contents of the above petition are true and correct to the best of my knowledge and belief and nothing material has been concealed therefrom.`;
  }

  getGroundsStatement(groundsForDivorce) {
    const g = (groundsForDivorce || 'mutual_consent').toLowerCase();
    if (g.includes('mutual') || g.includes('consent')) {
      return 'The Petitioner and Respondent have been living separately for more than one year and have mutually consented to dissolve the marriage by a decree of divorce under Section 13B of the Hindu Marriage Act 1955 / Section 28 of the Special Marriage Act 1954.';
    }
    if (g.includes('adultery')) {
      return 'The Respondent has, after the solemnization of the marriage, had voluntary sexual intercourse with a person other than the Petitioner, within the meaning of Section 13(1)(i) of the Hindu Marriage Act 1955.';
    }
    if (g.includes('cruelty') || g.includes('violence')) {
      return 'The Respondent has treated the Petitioner with such cruelty as to cause a reasonable apprehension in the mind of the Petitioner that it would be harmful or injurious for the Petitioner to live with the Respondent, within the meaning of Section 13(1)(ia) of the Hindu Marriage Act 1955.';
    }
    if (g.includes('desertion')) {
      return 'The Respondent has deserted the Petitioner for a continuous period of not less than two years immediately preceding the presentation of this petition, within the meaning of Section 13(1)(ib) of the Hindu Marriage Act 1955.';
    }
    // Default: mutual consent
    return 'The Petitioner and Respondent have been living separately for more than one year and have mutually consented to dissolve the marriage by a decree of divorce under Section 13B of the Hindu Marriage Act 1955 / Section 28 of the Special Marriage Act 1954.';
  }
}

module.exports = DelhiDivorcePetitionTemplate;
