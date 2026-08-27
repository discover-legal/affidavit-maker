// templates/states/tasmania/DivorceDecreeTemplate.js
'use strict';
const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');
const { resolveCustodyArrangement, resolvePrimaryResidenceName } = require('../../core/parenting');

class TasmaniaDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  // Australian terminology (see templates/core/terminology.js): divorce is
  // federal (FCFCOA) — the caption is the court-name line + registry; parties
  // are Applicant/Respondent (Family Law Act 1975 (Cth)). No "STATE OF"/
  // "COUNTY OF" caption lines and no "X County" body phrasing.
  constructor() {
    super();
    this.state = 'TAS'; this.stateName = 'Tasmania'; this.countryCode = 'AU'; this.terminology = { ...this.terminology, jurisdictionLabel: null, districtLabel: null, districtStyle: 'plain', jurisdictionTerm: 'State', districtTerm: 'Registry', districtPlaceholder: '[REGISTRY]', filerLabel: 'Applicant', responderLabel: 'Respondent', selfRepresentedLabel: 'Self-Represented' }; this.documentTitle = 'DIVORCE ORDER';
    try { this.metadata = require('./metadata.json'); } catch (e) { this.metadata = null; }
    this.requiredFields = ['petitionerName', 'respondentName', 'state', 'county', 'caseNumber', 'marriageDate'];
    this.formatting = { fontSize: '12pt', fontFamily: 'Times New Roman', lineHeight: '1.5', margin: '2.54cm', paperSize: 'A4' };
  }
  getCaseNumberLabel() { return 'File Number'; }
  getDefaultCourt(county) { return `FEDERAL CIRCUIT AND FAMILY COURT OF AUSTRALIA (DIVISION 2) — ${(county || '[CITY]').toUpperCase()} REGISTRY`; }
  generateHeader() { return 'TASMANIA'; }
  generateVenue(county) { return `${(county || '[REGISTRY]').toUpperCase()} REGISTRY`; }
  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county)).toUpperCase();
    const caseNumber = divorceData.caseNumber || '[FILE NUMBER]';
    const applicant = (divorceData.petitionerName || '[APPLICANT NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();
    return { courtName, caseNumber: divorceData.caseNumber, petitioner: divorceData.petitionerName, respondent: divorceData.respondentName, formatted: `IN THE ${courtName}\n\n${this.getCaseNumberLabel()}: ${caseNumber}\n\nIN THE MATTER OF THE FAMILY LAW ACT 1975 (CTH)\n\nBETWEEN:\n\n${applicant}\nApplicant\n\n— and —\n\n${respondent}\nRespondent` };
  }
  generatePropertyDivisionSection(divorceData) {
    const items = [];
    if (divorceData.hasProperty === false) items.push({ content: 'The Court finds there is no property to be divided (s.79).', type: 'finding' });
    else { items.push({ content: 'The Court has considered property division pursuant to s.79.', type: 'finding' });
      if (!divorceData.petitionerProperty && !divorceData.respondentProperty) items.push({ content: 'IT IS ORDERED that each party retains their current property.', type: 'order' }); }
    return { title: 'PROPERTY SETTLEMENT', items, type: 'property' };
  }
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) return null;
    const items = [{ content: 'Parenting orders in the best interests of the child(ren) (s.60CA):', type: 'finding' }];
    // Safety rule: only positively recognized custody values render a joint or
    // sole order; anything ambiguous renders neutral as-agreed language —
    // NEVER a sole order (see templates/core/parenting.js).
    const custody = resolveCustodyArrangement(divorceData);
    const residenceName = resolvePrimaryResidenceName(divorceData);
    let soleCustodianName = null;
    if (custody.kind === 'joint') {
      items.push({ content: 'IT IS ORDERED: shared parental responsibility.', type: 'order' });
    } else if (custody.kind === 'sole_petitioner' || custody.kind === 'sole_respondent' || custody.kind === 'legacy_sole') {
      soleCustodianName = custody.kind === 'sole_petitioner' ? (divorceData.petitionerName || 'Applicant')
        : custody.kind === 'sole_respondent' ? (divorceData.respondentName || 'Respondent')
          : (resolvePrimaryResidenceName(divorceData) || 'Applicant');
      items.push({ content: `IT IS ORDERED: ${soleCustodianName} has sole parental responsibility.`, type: 'order' });
    } else {
      items.push({ content: 'IT IS ORDERED that the parties shall exercise parental responsibility for the child(ren) as agreed by the parties: [ARRANGEMENT — set out the parties\' decision-making agreement].', type: 'order' });
    }
    if (custody.kind !== 'joint' && residenceName && residenceName !== soleCustodianName) {
      items.push({ content: `IT IS ORDERED that the child(ren) shall primarily reside with ${residenceName}.`, type: 'order' });
    }
    return { title: 'PARENTING ORDERS', items, type: 'custody' };
  }
  getVisitationLanguage() { return 'IT IS ORDERED that each party shall facilitate the child(ren)\'s relationship with the other party.'; }
  generateChildSupportSection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) return null;
    return { title: 'CHILD SUPPORT', items: [{ content: 'IT IS ORDERED that child support shall be assessed by Services Australia.', type: 'order' }], type: 'child_support' };
  }
  generateSpousalSupportSection(divorceData) {
    if (!divorceData.spousalSupportAwarded && !divorceData.spousalSupportWaived) return null;
    const items = [];
    if (divorceData.spousalSupportWaived) items.push({ content: 'IT IS ORDERED that each party releases claims for spousal maintenance.', type: 'order' });
    else if (divorceData.spousalSupportAwarded) items.push({ content: `IT IS ORDERED: spousal maintenance of $${divorceData.spousalSupportAmount || '[AMOUNT]'}/month for ${divorceData.spousalSupportDuration || '[DURATION]'}.`, type: 'order' });
    return { title: 'SPOUSAL MAINTENANCE', items, type: 'spousal_support' };
  }
  generateFinalOrdersSection() {
    return { title: 'FINAL ORDERS', items: [
      { content: 'IT IS ORDERED that the marriage is dissolved.', type: 'order' },
      { content: 'IT IS ORDERED that all claims not granted are dismissed.', type: 'order' },
      { content: this.getEffectiveDateText(), type: 'order' },
      { content: this.getCertificateNote(), type: 'order' }
    ], type: 'final_orders' };
  }
  getEffectiveDateText() { return 'This Divorce Order takes effect one month and one day after the date on which it is made (s.55).'; }
  getCertificateNote() { return 'A sealed copy may be obtained from the court registry after the order takes effect.'; }
}
module.exports = TasmaniaDivorceDecreeTemplate;
