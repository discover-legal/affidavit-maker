// templates/states/australian_capital_territory/DivorcePetitionTemplate.js
'use strict';
const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

class ACTDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();
    this.state = 'ACT'; this.stateName = 'Australian Capital Territory'; this.countryCode = 'AU'; this.documentTitle = 'APPLICATION FOR DIVORCE';
    try { this.metadata = require('./metadata.json'); } catch (e) { this.metadata = null; }
    this.requiredFields = ['petitionerName', 'respondentName', 'state', 'county', 'marriageDate', 'groundsForDivorce'];
    this.residencyRequirements = { stateMonths: 12, countyDays: 0, description: 'Australian citizen, domiciled, or 12-month resident (s.39(3)).' };
    this.waitingPeriod = { days: 0, description: 'Divorce Order takes effect 1 month and 1 day after made (s.55).' };
    this.formatting = { fontSize: '12pt', fontFamily: 'Times New Roman', lineHeight: '1.5', margin: '2.54cm', paperSize: 'A4' };
  }
  getCaseNumberLabel() { return 'File Number'; }
  getDefaultCourt() { return 'FEDERAL CIRCUIT AND FAMILY COURT OF AUSTRALIA — CANBERRA REGISTRY'; }
  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt()).toUpperCase();
    const caseNumber = divorceData.caseNumber || '[FILE NUMBER]';
    const applicant = (divorceData.petitionerName || '[APPLICANT NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();
    return { courtName, caseNumber: divorceData.caseNumber, petitioner: divorceData.petitionerName, respondent: divorceData.respondentName, formatted: [`IN THE ${courtName}`, '', `${this.getCaseNumberLabel()}: ${caseNumber}`, '', `IN THE MATTER OF THE FAMILY LAW ACT 1975 (CTH)`, '', `BETWEEN:`, '', `${applicant}`, `Applicant`, '', `AND`, '', `${respondent}`, `Respondent`].join('\n') };
  }
  getJurisdictionStatement() { return `Either the Applicant or the Respondent is an Australian citizen, is domiciled in Australia, or has been ordinarily resident in Australia for at least twelve months (Family Law Act 1975 (Cth), s.39(3)).`; }
  getVenueReason() { return 'the Applicant or Respondent resides in the Australian Capital Territory'; }
  generateReliefSection(divorceData) {
    const items = [{ number: null, content: 'THE APPLICANT SEEKS THE FOLLOWING ORDERS:', type: 'relief_intro' }];
    const reliefItems = ['A divorce order pursuant to section 48 of the Family Law Act 1975 (Cth);', 'A property settlement order pursuant to section 79;'];
    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) { reliefItems.push('Parenting orders pursuant to Part VII;'); reliefItems.push('A child support assessment through Services Australia;'); }
    if (divorceData.spousalSupportRequested || divorceData.requestSpousalSupport) reliefItems.push('A spousal maintenance order (ss.72-75);');
    reliefItems.push('Such further or other orders as appropriate.');
    reliefItems.forEach((r, i) => items.push({ number: null, content: r, type: 'relief_item', style: 'letter', letter: String.fromCharCode(97 + i) }));
    return { title: 'ORDERS SOUGHT', items, nextParagraphNumber: divorceData._paragraphNum || 15 };
  }
  getVerificationText(divorceData) { return `I, ${divorceData.petitionerName || '[APPLICANT NAME]'}, the Applicant, solemnly affirm that this Application is true and correct.`; }
  getGroundsText() { return 'The marriage has broken down irretrievably (s.48(1)). The parties have lived separately and apart for at least 12 months.'; }
}
module.exports = ACTDivorcePetitionTemplate;
