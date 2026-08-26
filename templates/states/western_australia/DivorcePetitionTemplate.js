// templates/states/western_australia/DivorcePetitionTemplate.js
// NOTE: WA uses the Family Court of Western Australia (Family Court Act 1997 (WA))
'use strict';

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

class WesternAustraliaDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();
    this.state = 'WA_AU';
    this.stateName = 'Western Australia';
    this.countryCode = 'AU';

    // Australian terminology (see templates/core/terminology.js): divorce is
    // federal (FCFCOA) — the caption is the court-name line + registry; parties
    // are Applicant/Respondent (Family Law Act 1975 (Cth)). No "STATE OF"/
    // "COUNTY OF" caption lines and no "X County" body phrasing.
    this.terminology = {
      ...this.terminology,
      jurisdictionLabel: null,
      districtLabel: null,
      districtStyle: 'plain',
      jurisdictionTerm: 'State',
      districtTerm: 'Registry',
      districtPlaceholder: '[REGISTRY]',
      filerLabel: 'Applicant',
      responderLabel: 'Respondent',
      selfRepresentedLabel: 'Self-Represented',
    };
    this.documentTitle = 'APPLICATION FOR DIVORCE';
    try { this.metadata = require('./metadata.json'); } catch (e) { this.metadata = null; }
    this.requiredFields = ['petitionerName', 'respondentName', 'state', 'county', 'marriageDate', 'groundsForDivorce'];
    this.residencyRequirements = { stateMonths: 12, countyDays: 0, description: 'Either spouse must be an Australian citizen, domiciled in Australia, or ordinarily resident in Australia for at least 12 months (Family Law Act 1975 (Cth), s.39(3)).' };
    this.waitingPeriod = { days: 0, description: 'No waiting period. Divorce Order takes effect 1 month and 1 day after made (s.55).' };
    this.formatting = { fontSize: '12pt', fontFamily: 'Times New Roman', lineHeight: '1.5', margin: '2.54cm', paperSize: 'A4' };
  }

  getCaseNumberLabel() { return 'File Number'; }

  getDefaultCourt(county) {
    return 'FAMILY COURT OF WESTERN AUSTRALIA';
  }

  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county)).toUpperCase();
    const caseNumber = divorceData.caseNumber || '[FILE NUMBER]';
    const applicant = (divorceData.petitionerName || '[APPLICANT NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();
    const caption = [
      `IN THE ${courtName}`, '', `${this.getCaseNumberLabel()}: ${caseNumber}`, '',
      `IN THE MATTER OF THE FAMILY LAW ACT 1975 (CTH)`, `AND THE FAMILY COURT ACT 1997 (WA)`, '',
      `BETWEEN:`, '', `${applicant}`, `Applicant`, '', `AND`, '', `${respondent}`, `Respondent`
    ].join('\n');
    return { courtName, caseNumber: divorceData.caseNumber, petitioner: divorceData.petitionerName, respondent: divorceData.respondentName, formatted: caption };
  }

  getJurisdictionStatement() {
    return `Either the Applicant or the Respondent is an Australian citizen, is domiciled in Australia, or has been ordinarily resident in Australia for at least twelve months immediately preceding the filing of this Application, as required by section 39(3) of the Family Law Act 1975 (Cth). This Application is filed in the Family Court of Western Australia pursuant to the Family Court Act 1997 (WA).`;
  }

  getVenueReason(divorceData) {
    return `the Applicant or Respondent resides in Western Australia and the Family Court of Western Australia has jurisdiction pursuant to the Family Court Act 1997 (WA)`;
  }

  // The Application for Divorce seeks only the divorce order (plus costs where
  // sought) — property/parenting/maintenance orders go in a separate Initiating
  // Application in the Family Court of Western Australia (Family Court Rules 2021 (WA)).
  generateReliefSection(divorceData) {
    const items = [];
    items.push({ number: null, content: 'THE APPLICANT SEEKS THE FOLLOWING ORDERS:', type: 'relief_intro' });
    const reliefItems = [
      'A divorce order pursuant to section 48 of the Family Law Act 1975 (Cth);'
    ];
    if (divorceData.costsRequested || divorceData.requestCosts) {
      reliefItems.push('An order that the Respondent pay the Applicant\'s costs of this application;');
    }
    reliefItems[reliefItems.length - 1] = reliefItems[reliefItems.length - 1].replace(/;$/, '.');
    reliefItems.forEach((r, i) => items.push({ number: null, content: r, type: 'relief_item', style: 'letter', letter: String.fromCharCode(97 + i) }));
    const hasAncillaryClaims =
      divorceData.hasProperty !== false ||
      divorceData.hasMinorChildren === true ||
      (divorceData.children && divorceData.children.length > 0) ||
      divorceData.spousalSupportRequested ||
      divorceData.requestSpousalSupport;
    if (hasAncillaryClaims) {
      items.push({ number: null, content: 'NOTE: Property settlement, parenting, and maintenance orders are sought by a separate Initiating Application in the Family Court of Western Australia under the Family Court Rules 2021 (WA); they cannot be included in this Application for Divorce.', type: 'relief_intro' });
    }
    return { title: 'ORDERS SOUGHT', items, nextParagraphNumber: divorceData._paragraphNum || 15 };
  }

  getVerificationText(divorceData) { return `I, ${divorceData.petitionerName || '[APPLICANT NAME]'}, the Applicant, make oath and say (or solemnly affirm) that the contents of this Application are true and correct to the best of my knowledge, information, and belief.`; }
  getGroundsText() { return 'The marriage has broken down irretrievably within the meaning of section 48(1) of the Family Law Act 1975 (Cth). The parties have lived separately and apart for a continuous period of not less than 12 months immediately preceding the date of filing of this Application.'; }
}

module.exports = WesternAustraliaDivorcePetitionTemplate;
