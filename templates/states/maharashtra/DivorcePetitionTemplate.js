// templates/states/maharashtra/DivorcePetitionTemplate.js
// Maharashtra divorce petition template
// Governing Law: Hindu Marriage Act 1955 / Special Marriage Act 1954 / Indian Divorce Act 1869

'use strict';

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

class MaharashtraDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();
    this.state = 'IN_MH';
    this.stateName = 'Maharashtra';
    this.countryCode = 'IN';
    this.documentTitle = 'PETITION FOR DIVORCE';
    try { this.metadata = require('./metadata.json'); } catch (e) { this.metadata = null; }
    this.requiredFields = ['petitionerName', 'respondentName', 'state', 'county', 'marriageDate', 'groundsForDivorce'];
    this.residencyRequirements = { stateMonths: 0, countyDays: 0, description: 'Filed where the marriage was solemnized, or where the parties last resided together, or where the respondent resides, or where the petitioner (wife) resides (HMA s.19).' };
    this.waitingPeriod = { days: 180, description: 'Mutual consent: 6-month cooling-off period (may be waived per Amardeep Singh v. Harveen Kaur (2017)).' };
    this.formatting = { fontSize: '12pt', fontFamily: 'Times New Roman', lineHeight: '1.5', margin: '1in', paperSize: 'A4' };
  }

  getCaseNumberLabel() { return 'Case No.'; }
  getDefaultCourt(county) { return 'FAMILY COURT, BANDRA, MUMBAI'; }

  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county)).toUpperCase();
    const caseNumber = divorceData.caseNumber || '[CASE NUMBER]';
    const petitioner = (divorceData.petitionerName || '[PETITIONER NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();
    const caption = [`IN THE ${courtName}`, '', `Case No. ${caseNumber}`, '', 'IN THE MATTER OF:', '', petitioner, 'Petitioner', '', 'VERSUS', '', respondent, 'Respondent'].join('\n');
    return { courtName, caseNumber: divorceData.caseNumber, petitioner: divorceData.petitionerName, respondent: divorceData.respondentName, formatted: caption };
  }

  getJurisdictionStatement(divorceData) {
    return `This Hon'ble Court has jurisdiction to entertain this petition as the marriage was solemnized / the parties last resided together / the Respondent resides / the Petitioner (wife) resides within the jurisdiction of this Court, as required under Section 19 of the Hindu Marriage Act 1955 / Section 31 of the Special Marriage Act 1954 (as applicable).`;
  }

  getVenueReason(divorceData) {
    const location = divorceData.county || 'Mumbai';
    return `the Petitioner or Respondent resides within the jurisdiction of this Court at ${location}`;
  }

  generateReliefSection(divorceData) {
    const items = [];
    items.push({ number: null, content: 'PRAYER: It is, therefore, most respectfully prayed that this Hon\'ble Court may be pleased to:', type: 'relief_intro' });
    const reliefItems = ['Pass a decree of divorce dissolving the marriage between the Petitioner and the Respondent;', 'Grant permanent alimony / maintenance as this Hon\'ble Court deems fit and proper;'];
    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Grant custody of the minor child(ren) to the Petitioner / Respondent as this Court deems appropriate;');
      reliefItems.push('Direct payment of maintenance for the minor child(ren) under Section 26 of the HMA / BNSS s.144;');
    }
    if (divorceData.spousalSupportRequested || divorceData.requestSpousalSupport) {
      reliefItems.push('Grant maintenance pendente lite and expenses of the proceedings under Section 24 of the HMA;');
    }
    reliefItems.push('Pass any other order(s) as this Hon\'ble Court may deem fit and proper.');
    reliefItems.forEach((relief, index) => { items.push({ number: null, content: relief, type: 'relief_item', style: 'letter', letter: String.fromCharCode(97 + index) }); });
    return { title: 'PRAYER', items, nextParagraphNumber: divorceData._paragraphNum || 15 };
  }

  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PETITIONER NAME]';
    return `Verified at Mumbai on this _____ day of __________, _______. I, ${name}, the Petitioner above-named, do hereby verify that the contents of the above petition are true and correct to the best of my knowledge and belief and nothing material has been concealed therefrom.`;
  }

  getGroundsStatement(groundsForDivorce) {
    const g = (groundsForDivorce || 'mutual_consent').toLowerCase();
    if (g.includes('mutual') || g.includes('consent')) return 'The Petitioner and Respondent have been living separately for more than one year and have mutually consented to dissolve the marriage under Section 13B of the Hindu Marriage Act 1955 / Section 28 of the Special Marriage Act 1954.';
    if (g.includes('adultery')) return 'The Respondent has had voluntary sexual intercourse with a person other than the Petitioner after solemnization of the marriage (HMA s.13(1)(i)).';
    if (g.includes('cruelty')) return 'The Respondent has treated the Petitioner with cruelty (HMA s.13(1)(ia)).';
    if (g.includes('desertion')) return 'The Respondent has deserted the Petitioner for a continuous period of not less than two years (HMA s.13(1)(ib)).';
    return 'The Petitioner and Respondent have been living separately for more than one year and have mutually consented to dissolve the marriage under Section 13B of the Hindu Marriage Act 1955 / Section 28 of the Special Marriage Act 1954.';
  }
}

module.exports = MaharashtraDivorcePetitionTemplate;
