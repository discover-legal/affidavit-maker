// templates/states/south_australia/DivorceDecreeTemplate.js
'use strict';
const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');
const { resolveCustodyArrangement, resolvePrimaryResidenceName } = require('../../core/parenting');

class SouthAustraliaDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  // Australian terminology (see templates/core/terminology.js): divorce is
  // federal (FCFCOA) — the caption is the court-name line + registry; parties
  // are Applicant/Respondent (Family Law Act 1975 (Cth)). No "STATE OF"/
  // "COUNTY OF" caption lines and no "X County" body phrasing.
  constructor() {
    super();
    this.state = 'SA_AU'; this.stateName = 'South Australia'; this.countryCode = 'AU'; this.terminology = { ...this.terminology, jurisdictionLabel: null, districtLabel: null, districtStyle: 'plain', jurisdictionTerm: 'State', districtTerm: 'Registry', districtPlaceholder: '[REGISTRY]', filerLabel: 'Applicant', responderLabel: 'Respondent', selfRepresentedLabel: 'Self-Represented' }; this.documentTitle = 'DIVORCE ORDER';
    try { this.metadata = require('./metadata.json'); } catch (e) { this.metadata = null; }
    this.requiredFields = ['petitionerName', 'respondentName', 'state', 'county', 'caseNumber', 'marriageDate'];
    this.formatting = { fontSize: '12pt', fontFamily: 'Times New Roman', lineHeight: '1.5', margin: '2.54cm', paperSize: 'A4' };
  }

  getCaseNumberLabel() { return 'File Number'; }
  getDefaultCourt(county) { return `FEDERAL CIRCUIT AND FAMILY COURT OF AUSTRALIA (DIVISION 2) — ${(county || '[CITY]').toUpperCase()} REGISTRY`; }
  generateHeader() { return 'SOUTH AUSTRALIA'; }
  generateVenue(county) { return `${(county || '[REGISTRY LOCATION]').toUpperCase()} REGISTRY`; }

  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county)).toUpperCase();
    const caseNumber = divorceData.caseNumber || '[FILE NUMBER]';
    const applicant = (divorceData.petitionerName || '[APPLICANT NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();
    const formatted = `IN THE ${courtName}\n\n${this.getCaseNumberLabel()}: ${caseNumber}\n\nIN THE MATTER OF THE FAMILY LAW ACT 1975 (CTH)\n\nBETWEEN:\n\n${applicant}\nApplicant\n\n— and —\n\n${respondent}\nRespondent`;
    return { courtName, caseNumber: divorceData.caseNumber, petitioner: divorceData.petitionerName, respondent: divorceData.respondentName, formatted };
  }

  generatePropertyDivisionSection(divorceData) {
    const items = [];
    if (divorceData.hasProperty === false) { items.push({ content: 'The Court finds there is no property to be divided (s.79).', type: 'finding' }); }
    else { items.push({ content: 'The Court has considered the division of property pursuant to section 79 of the Family Law Act 1975 (Cth).', type: 'finding' });
      if (!divorceData.petitionerProperty && !divorceData.respondentProperty) items.push({ content: 'IT IS ORDERED that each party retains the property currently in that party\'s possession.', type: 'order' });
    }
    return { title: 'PROPERTY SETTLEMENT', items, type: 'property' };
  }

  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) return null;
    const items = [];
    items.push({ content: 'The Court finds that the following parenting orders are in the best interests of the child(ren) (s.60CA):', type: 'finding' });
    // Safety rule: only positively recognized custody values render a joint or
    // sole order; anything ambiguous renders neutral as-agreed language —
    // NEVER a sole order (see templates/core/parenting.js).
    const custody = resolveCustodyArrangement(divorceData);
    const residenceName = resolvePrimaryResidenceName(divorceData);
    let soleCustodianName = null;
    if (custody.kind === 'joint') {
      items.push({ content: 'IT IS ORDERED that the parties shall have shared parental responsibility.', type: 'order' });
    } else if (custody.kind === 'sole_petitioner' || custody.kind === 'sole_respondent' || custody.kind === 'legacy_sole') {
      soleCustodianName = custody.kind === 'sole_petitioner' ? (divorceData.petitionerName || 'Applicant')
        : custody.kind === 'sole_respondent' ? (divorceData.respondentName || 'Respondent')
          : (divorceData.primaryCustodian || divorceData.petitionerName || 'Applicant');
      items.push({ content: `IT IS ORDERED that ${soleCustodianName} shall have sole parental responsibility.`, type: 'order' });
    } else {
      items.push({ content: 'IT IS ORDERED that the parties shall exercise parental responsibility for the child(ren) as agreed by the parties: [ARRANGEMENT — set out the parties\' decision-making agreement].', type: 'order' });
    }
    if (custody.kind !== 'joint' && residenceName && residenceName !== soleCustodianName) {
      items.push({ content: `IT IS ORDERED that the child(ren) shall primarily reside with ${residenceName}.`, type: 'order' });
    }
    return { title: 'PARENTING ORDERS', items, type: 'custody' };
  }

  getVisitationLanguage() { return 'IT IS ORDERED that each party shall facilitate the child(ren)\'s relationship with the other party (s.60CC).'; }

  generateChildSupportSection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) return null;
    return { title: 'CHILD SUPPORT', items: [{ content: 'IT IS ORDERED that child support shall be assessed by Services Australia (Child Support).', type: 'order' }], type: 'child_support' };
  }

  generateSpousalSupportSection(divorceData) {
    if (!divorceData.spousalSupportAwarded && !divorceData.spousalSupportWaived) return null;
    const items = [];
    if (divorceData.spousalSupportWaived) items.push({ content: 'IT IS ORDERED that each party releases any claim for spousal maintenance (ss.72-75).', type: 'order' });
    else if (divorceData.spousalSupportAwarded) items.push({ content: `IT IS ORDERED that ${divorceData.spousalSupportPayor || 'Respondent'} shall pay spousal maintenance of $${divorceData.spousalSupportAmount || '[AMOUNT]'} per month for ${divorceData.spousalSupportDuration || '[DURATION]'}.`, type: 'order' });
    return { title: 'SPOUSAL MAINTENANCE', items, type: 'spousal_support' };
  }

  generateFinalOrdersSection() {
    return { title: 'FINAL ORDERS', items: [
      { content: 'IT IS ORDERED that the marriage between the parties is dissolved.', type: 'order' },
      { content: 'IT IS ORDERED that all claims not expressly granted are dismissed.', type: 'order' },
      { content: this.getEffectiveDateText(), type: 'order' },
      { content: this.getCertificateNote(), type: 'order' }
    ], type: 'final_orders' };
  }

  getEffectiveDateText() { return 'This Divorce Order takes effect one month and one day after the date on which it is made (s.55).'; }
  getCertificateNote() { return 'A sealed copy of this Divorce Order may be obtained from the court registry after the order takes effect.'; }
}

module.exports = SouthAustraliaDivorceDecreeTemplate;
