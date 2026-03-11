// templates/states/tamil_nadu/DivorcePetitionTemplate.js
'use strict';
const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

class TamilNaduDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();
    this.state = 'IN_TN'; this.stateName = 'Tamil Nadu'; this.countryCode = 'IN';
    this.documentTitle = 'PETITION FOR DIVORCE';
    try { this.metadata = require('./metadata.json'); } catch (e) { this.metadata = null; }
    this.requiredFields = ['petitionerName', 'respondentName', 'state', 'county', 'marriageDate', 'groundsForDivorce'];
    this.residencyRequirements = { stateMonths: 0, countyDays: 0, description: 'HMA s.19 / SMA s.31 jurisdiction rules.' };
    this.waitingPeriod = { days: 180, description: '6-month cooling-off (waivable per Amardeep Singh (2017)).' };
    this.formatting = { fontSize: '12pt', fontFamily: 'Times New Roman', lineHeight: '1.5', margin: '1in', paperSize: 'A4' };
  }
  getCaseNumberLabel() { return 'Case No.'; }
  getDefaultCourt() { return 'FAMILY COURT, CHENNAI'; }
  generateCaseCaption(dd) {
    const cn = (dd.court || this.getDefaultCourt()).toUpperCase(); const no = dd.caseNumber || '[CASE NUMBER]';
    const p = (dd.petitionerName || '[PETITIONER NAME]').toUpperCase(); const r = (dd.respondentName || '[RESPONDENT NAME]').toUpperCase();
    return { courtName: cn, caseNumber: dd.caseNumber, petitioner: dd.petitionerName, respondent: dd.respondentName, formatted: [`IN THE ${cn}`, '', `Case No. ${no}`, '', 'IN THE MATTER OF:', '', p, 'Petitioner', '', 'VERSUS', '', r, 'Respondent'].join('\n') };
  }
  getJurisdictionStatement() { return `This Hon'ble Court has jurisdiction under HMA s.19 / SMA s.31.`; }
  getVenueReason(dd) { return `the Petitioner or Respondent resides at ${dd.county || 'Chennai'}`; }
  generateReliefSection(dd) {
    const items = []; items.push({ number: null, content: 'PRAYER: It is most respectfully prayed that this Hon\'ble Court may be pleased to:', type: 'relief_intro' });
    const r = ['Pass a decree of divorce;', 'Grant maintenance as deemed fit;'];
    if (dd.hasMinorChildren === true || dd.children?.length > 0) { r.push('Grant custody of the child(ren);'); r.push('Direct child maintenance under HMA s.26 / BNSS s.144;'); }
    if (dd.spousalSupportRequested) r.push('Grant maintenance pendente lite under HMA s.24;');
    r.push('Pass any other order(s) as deemed fit.'); r.forEach((x, i) => items.push({ number: null, content: x, type: 'relief_item', style: 'letter', letter: String.fromCharCode(97+i) }));
    return { title: 'PRAYER', items, nextParagraphNumber: dd._paragraphNum || 15 };
  }
  getVerificationText(dd) { return `Verified at Chennai on this _____ day of __________, _______. I, ${dd.petitionerName || '[PETITIONER NAME]'}, verify that the contents are true and correct.`; }
  getGroundsStatement(g) {
    const s = (g || 'mutual_consent').toLowerCase();
    if (s.includes('mutual') || s.includes('consent')) return 'The parties have mutually consented to dissolve the marriage (HMA s.13B / SMA s.28).';
    if (s.includes('cruelty')) return 'The Respondent has treated the Petitioner with cruelty (HMA s.13(1)(ia)).';
    if (s.includes('desertion')) return 'The Respondent has deserted the Petitioner for not less than two years (HMA s.13(1)(ib)).';
    return 'The parties have mutually consented to dissolve the marriage (HMA s.13B / SMA s.28).';
  }
}
module.exports = TamilNaduDivorcePetitionTemplate;
