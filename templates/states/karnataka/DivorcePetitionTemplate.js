// templates/states/karnataka/DivorcePetitionTemplate.js
'use strict';
const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

class KarnatakaDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();
    this.state = 'IN_KA'; this.stateName = 'Karnataka'; this.countryCode = 'IN';
    this.documentTitle = 'PETITION FOR DIVORCE';
    try { this.metadata = require('./metadata.json'); } catch (e) { this.metadata = null; }
    this.requiredFields = ['petitionerName', 'respondentName', 'state', 'county', 'marriageDate', 'groundsForDivorce'];
    this.residencyRequirements = { stateMonths: 0, countyDays: 0, description: 'Filed where the marriage was solemnized, or where the parties last resided together, or where the respondent resides, or where the petitioner (wife) resides (HMA s.19).' };
    this.waitingPeriod = { days: 180, description: 'Mutual consent: 6-month cooling-off period (may be waived per Amardeep Singh v. Harveen Kaur (2017)). Supreme Court may also grant divorce directly under Art. 142 on irretrievable breakdown (Shilpa Sailesh v. Varun Sreenivasan (2023)).' };
    this.formatting = { fontSize: '12pt', fontFamily: 'Times New Roman', lineHeight: '1.5', margin: '1in', paperSize: 'A4' };
  }

  getCaseNumberLabel() { return 'Case No.'; }
  getDefaultCourt(county) { return 'FAMILY COURT, BENGALURU'; }

  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county)).toUpperCase();
    const caseNumber = divorceData.caseNumber || '[CASE NUMBER]';
    const petitioner = (divorceData.petitionerName || '[PETITIONER NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();
    const caption = [`IN THE ${courtName}`, '', `Case No. ${caseNumber}`, '', 'IN THE MATTER OF:', '', petitioner, 'Petitioner', '', 'VERSUS', '', respondent, 'Respondent'].join('\n');
    return { courtName, caseNumber: divorceData.caseNumber, petitioner: divorceData.petitionerName, respondent: divorceData.respondentName, formatted: caption };
  }

  getJurisdictionStatement(divorceData) {
    return `This Hon'ble Court has jurisdiction to entertain this petition as the marriage was solemnized / the parties last resided together / the Respondent resides / the Petitioner (wife) resides within the jurisdiction of this Court (HMA s.19 / SMA s.31).`;
  }

  getVenueReason(divorceData) { return `the Petitioner or Respondent resides within the jurisdiction of this Court at ${divorceData.county || 'Bengaluru'}`; }

  generateReliefSection(divorceData) {
    const items = [];
    items.push({ number: null, content: 'PRAYER: It is most respectfully prayed that this Hon\'ble Court may be pleased to:', type: 'relief_intro' });
    const reliefItems = ['Pass a decree of divorce dissolving the marriage;', 'Grant permanent alimony / maintenance as deemed fit;'];
    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Grant custody of the minor child(ren) as appropriate;');
      reliefItems.push('Direct payment of child maintenance under HMA s.26 / BNSS s.144;');
    }
    if (divorceData.spousalSupportRequested) reliefItems.push('Grant maintenance pendente lite under HMA s.24;');
    reliefItems.push('Pass any other order(s) as deemed fit and proper.');
    reliefItems.forEach((r, i) => { items.push({ number: null, content: r, type: 'relief_item', style: 'letter', letter: String.fromCharCode(97 + i) }); });
    return { title: 'PRAYER', items, nextParagraphNumber: divorceData._paragraphNum || 15 };
  }

  getVerificationText(divorceData) {
    return `Verified at Bengaluru on this _____ day of __________, _______. I, ${divorceData.petitionerName || '[PETITIONER NAME]'}, the Petitioner, verify that the contents of the above petition are true and correct to the best of my knowledge and belief.`;
  }

  getGroundsText(groundsForDivorce) {
    const g = (groundsForDivorce || 'mutual_consent').toLowerCase();
    if (g.includes('mutual') || g.includes('consent')) return 'The parties have been living separately for more than one year and have mutually consented to dissolve the marriage (HMA s.13B / SMA s.28).';
    if (g.includes('adultery')) return 'The Respondent has committed adultery (HMA s.13(1)(i)).';
    if (g.includes('cruelty')) return 'The Respondent has treated the Petitioner with cruelty (HMA s.13(1)(ia)).';
    if (g.includes('desertion')) return 'The Respondent has deserted the Petitioner for not less than two years (HMA s.13(1)(ib)).';
    return 'The parties have mutually consented to dissolve the marriage (HMA s.13B / SMA s.28).';
  }
}

module.exports = KarnatakaDivorcePetitionTemplate;
