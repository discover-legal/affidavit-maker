// templates/states/cross_river/DivorceDecreeTemplate.js
'use strict';
const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');
const { resolveCustodyArrangement, resolvePrimaryResidenceName } = require('../../core/parenting');

class CrossRiverDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  // Nigerian terminology (see templates/core/terminology.js): the caption is the
  // court-name line + suit number; parties are Petitioner/Respondent under the
  // Matrimonial Causes Act 1970; High Courts sit in judicial divisions, not
  // counties. No "STATE OF"/"COUNTY OF" caption lines, no "X County" body phrasing.
  constructor() {
    super();
    this.state = 'CR'; this.stateName = 'Cross River'; this.countryCode = 'NG'; this.terminology = { ...this.terminology, jurisdictionLabel: null, districtLabel: null, districtStyle: 'plain', jurisdictionTerm: 'State', districtTerm: 'Judicial division', districtPlaceholder: '[JUDICIAL DIVISION]', filerLabel: 'Petitioner', responderLabel: 'Respondent', selfRepresentedLabel: 'Self-Represented' }; this.documentTitle = 'DECREE NISI';
    try { this.metadata = require('./metadata.json'); } catch (e) { this.metadata = null; }
    this.requiredFields = ['petitionerName', 'respondentName', 'state', 'county', 'caseNumber', 'marriageDate'];
    this.formatting = { fontSize: '12pt', fontFamily: 'Times New Roman', lineHeight: '1.5', margin: '1in', paperSize: 'A4' };
  }
  getCaseNumberLabel() { return 'Suit No.'; }
  getDefaultCourt(county) { return `HIGH COURT OF CROSS RIVER STATE — ${(county || '[JUDICIAL DIVISION]').toUpperCase()} JUDICIAL DIVISION`; }
  generateHeader() { return 'IN THE HIGH COURT OF CROSS RIVER STATE'; }
  generateVenue(county) { return `${(county || '[JUDICIAL DIVISION]').toUpperCase()} JUDICIAL DIVISION`; }
  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county)).toUpperCase();
    const caseNumber = divorceData.caseNumber || '[SUIT NUMBER]';
    const petitioner = (divorceData.petitionerName || '[PETITIONER NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();
    return { courtName, caseNumber: divorceData.caseNumber, petitioner: divorceData.petitionerName, respondent: divorceData.respondentName, formatted: `IN THE ${courtName}\n\nSuit No. ${caseNumber}\n\nIN THE MATTER OF THE MATRIMONIAL CAUSES ACT, CAP M7 LFN 2004\n\nBETWEEN:\n\n${petitioner}\nPetitioner\n\n— AND —\n\n${respondent}\nRespondent` };
  }
  generatePropertyDivisionSection(divorceData) {
    const items = [];
    if (divorceData.hasProperty === false) { items.push({ content: 'The Court finds that no ancillary order regarding property is necessary.', type: 'finding' }); }
    else { items.push({ content: 'The Court has considered the parties\' submissions regarding property pursuant to MCA s.70-73.', type: 'finding' }); if (!divorceData.petitionerProperty && !divorceData.respondentProperty) items.push({ content: 'IT IS ORDERED that each party retains property in their possession, subject to further order.', type: 'order' }); }
    return { title: 'ANCILLARY ORDERS — PROPERTY', items, type: 'property' };
  }
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) return null;
    const items = [];
    items.push({ content: 'The Court orders the following custody arrangement in the best interests of the child(ren) (MCA s.71; Child Rights Act 2003):', type: 'finding' });
    divorceData.children.forEach((child, i) => { const info = typeof child === 'string' ? child : `${child.name || '[CHILD]'}, born ${this.formatDate(child.birthDate ?? child.dob ?? child.dateOfBirth) || '[DOB]'}`; items.push({ content: `${i + 1}. ${info}`, type: 'child_item' }); });
    // Safety rule (see templates/core/parenting.js): this template historically
    // awarded custody to one named parent unconditionally. Only positively
    // recognized custody values render a joint or sole order now; absent or
    // ambiguous data renders neutral as-agreed language — NEVER a sole order.
    const custody = resolveCustodyArrangement(divorceData);
    const residenceName = resolvePrimaryResidenceName(divorceData);
    let soleCustodianName = null;
    const custodyKind = custody.explicit ? custody.kind : 'unspecified';
    if (custodyKind === 'joint') {
      items.push({ content: `IT IS ORDERED that ${divorceData.petitionerName || 'the Petitioner'} and ${divorceData.respondentName || 'the Respondent'} shall have joint custody of the child(ren) pursuant to MCA s.71.`, type: 'order' });
    } else if (custodyKind === 'sole_petitioner' || custodyKind === 'sole_respondent' || custodyKind === 'legacy_sole') {
      soleCustodianName = custodyKind === 'sole_petitioner' ? (divorceData.petitionerName || 'the Petitioner')
        : custodyKind === 'sole_respondent' ? (divorceData.respondentName || 'the Respondent')
          : (divorceData.primaryCustodian || divorceData.petitionerName || 'the Petitioner');
      items.push({ content: `IT IS ORDERED that ${soleCustodianName} shall have custody of the child(ren) pursuant to MCA s.71.`, type: 'order' });
    } else {
      items.push({ content: 'IT IS ORDERED that the parties shall exercise legal custody and decision-making responsibility for the child(ren) as agreed by the parties: [ARRANGEMENT — set out the parties\' decision-making agreement].', type: 'order' });
    }
    if (custodyKind !== 'joint' && residenceName && residenceName !== soleCustodianName) {
      items.push({ content: `IT IS ORDERED that the child(ren) shall primarily reside with ${residenceName}.`, type: 'order' });
    }
    return { title: 'CUSTODY OF CHILD(REN)', items, type: 'custody' };
  }
  generateChildSupportSection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) return null;
    const items = [];
    items.push({ content: 'IT IS ORDERED pursuant to MCA s.70 that the Respondent shall pay such sum as the Court deems reasonable for child maintenance.', type: 'order' });
    return { title: 'CHILD MAINTENANCE', items, type: 'child_support' };
  }
  generateSpousalSupportSection(divorceData) {
    if (!divorceData.spousalSupportAwarded && !divorceData.spousalSupportWaived) return null;
    const items = [];
    if (divorceData.spousalSupportWaived) items.push({ content: 'Neither party has applied for maintenance under MCA s.70.', type: 'order' });
    else items.push({ content: `IT IS ORDERED pursuant to MCA s.70 that ${divorceData.spousalSupportPayor || 'the Respondent'} shall pay maintenance of NGN ${divorceData.spousalSupportAmount || '[AMOUNT]'} per month.`, type: 'order' });
    return { title: 'SPOUSAL MAINTENANCE', items, type: 'spousal_support' };
  }
  generateFinalOrdersSection() {
    return { title: 'FINAL ORDERS', items: [
      { content: 'IT IS HEREBY DECREED that the marriage is dissolved by this Decree Nisi.', type: 'order' },
      { content: 'This Decree Nisi shall become a Decree Absolute after three months (MCA s.58).', type: 'order' },
      { content: 'Upon the expiration of the said three months, the Decree Nisi becomes absolute by force of section 58 of the Act; no application is required. Where there are children under 16, the Decree Nisi does not become absolute until the Court has made the declaration required by section 57 of the Act.', type: 'order' }
    ], type: 'final_orders' };
  }
}
module.exports = CrossRiverDivorceDecreeTemplate;
