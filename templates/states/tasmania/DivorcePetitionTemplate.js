// templates/states/tasmania/DivorcePetitionTemplate.js
'use strict';
const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

class TasmaniaDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  // Australian terminology (see templates/core/terminology.js): divorce is
  // federal (FCFCOA) — the caption is the court-name line + registry; parties
  // are Applicant/Respondent (Family Law Act 1975 (Cth)). No "STATE OF"/
  // "COUNTY OF" caption lines and no "X County" body phrasing.
  constructor() {
    super();
    this.state = 'TAS'; this.stateName = 'Tasmania'; this.countryCode = 'AU'; this.terminology = { ...this.terminology, jurisdictionLabel: null, districtLabel: null, districtStyle: 'plain', jurisdictionTerm: 'State', districtTerm: 'Registry', districtPlaceholder: '[REGISTRY]', filerLabel: 'Applicant', responderLabel: 'Respondent', selfRepresentedLabel: 'Self-Represented' }; this.documentTitle = 'APPLICATION FOR DIVORCE';
    try { this.metadata = require('./metadata.json'); } catch (e) { this.metadata = null; }
    this.requiredFields = ['petitionerName', 'respondentName', 'state', 'county', 'marriageDate', 'groundsForDivorce'];
    this.residencyRequirements = { stateMonths: 12, countyDays: 0, description: 'Australian citizen, domiciled, or 12-month resident (s.39(3)).' };
    this.waitingPeriod = { days: 0, description: 'Divorce Order takes effect 1 month and 1 day after made (s.55).' };
    this.formatting = { fontSize: '12pt', fontFamily: 'Times New Roman', lineHeight: '1.5', margin: '2.54cm', paperSize: 'A4' };
  }
  getCaseNumberLabel() { return 'File Number'; }
  getDefaultCourt(county) { return `FEDERAL CIRCUIT AND FAMILY COURT OF AUSTRALIA (DIVISION 2) — ${(county || '[CITY]').toUpperCase()} REGISTRY`; }
  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county)).toUpperCase();
    const caseNumber = divorceData.caseNumber || '[FILE NUMBER]';
    const applicant = (divorceData.petitionerName || '[APPLICANT NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();
    return { courtName, caseNumber: divorceData.caseNumber, petitioner: divorceData.petitionerName, respondent: divorceData.respondentName, formatted: [`IN THE ${courtName}`, '', `${this.getCaseNumberLabel()}: ${caseNumber}`, '', `IN THE MATTER OF THE FAMILY LAW ACT 1975 (CTH)`, '', `BETWEEN:`, '', `${applicant}`, `Applicant`, '', `AND`, '', `${respondent}`, `Respondent`].join('\n') };
  }
  getJurisdictionStatement() { return `Either the Applicant or the Respondent is an Australian citizen, is domiciled in Australia, or has been ordinarily resident in Australia for at least twelve months (Family Law Act 1975 (Cth), s.39(3)).`; }
  getVenueReason(divorceData) { return `the Applicant or Respondent resides within the jurisdiction of the ${divorceData.county || '[REGISTRY]'} registry`; }
  // Application for Divorce seeks only the divorce order (plus costs where sought);
  // property/parenting/maintenance orders go in a separate Initiating Application.
  generateReliefSection(divorceData) {
    const items = [{ number: null, content: 'THE APPLICANT SEEKS THE FOLLOWING ORDERS:', type: 'relief_intro' }];
    const reliefItems = ['A divorce order pursuant to section 48 of the Family Law Act 1975 (Cth);'];
    if (divorceData.costsRequested || divorceData.requestCosts) reliefItems.push('An order that the Respondent pay the Applicant\'s costs of this application;');
    reliefItems[reliefItems.length - 1] = reliefItems[reliefItems.length - 1].replace(/;$/, '.');
    // Agreed corollary relief (agreed support amount, spousal-support
    // waiver, property agreement) — spliced before the final general prayer.
    this.appendAgreedReliefItems(reliefItems, divorceData);

    reliefItems.forEach((r, i) => items.push({ number: null, content: r, type: 'relief_item', style: 'letter', letter: String.fromCharCode(97 + i) }));
    if (divorceData.hasProperty !== false || divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0) || divorceData.spousalSupportRequested || divorceData.requestSpousalSupport) {
      items.push({ number: null, content: 'NOTE: Property settlement, parenting, and maintenance orders are sought by a separate Initiating Application under the Federal Circuit and Family Court of Australia (Family Law) Rules 2021 (Cth); they cannot be included in this Application for Divorce.', type: 'relief_intro' });
    }
    return { title: 'ORDERS SOUGHT', items, nextParagraphNumber: divorceData._paragraphNum || 15 };
  }
  getVerificationText(divorceData) { return `I, ${divorceData.petitionerName || '[APPLICANT NAME]'}, the Applicant, make oath and say (or solemnly affirm) that the contents of this Application are true and correct.`; }
  getGroundsText() { return 'The marriage has broken down irretrievably (s.48(1)). The parties have lived separately and apart for a continuous period of at least 12 months immediately preceding the date of filing of this Application (s.48(2)).'; }
}
module.exports = TasmaniaDivorcePetitionTemplate;
