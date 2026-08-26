// templates/states/maharashtra/DivorceDecreeTemplate.js
// Maharashtra divorce decree template
// Governing Law: Hindu Marriage Act 1955 / Special Marriage Act 1954 / Divorce Act, 1869

'use strict';

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');
const { resolveCustodyArrangement, resolvePrimaryResidenceName } = require('../../core/parenting');

class MaharashtraDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();
    this.state = 'IN_MH';
    this.stateName = 'Maharashtra';
    this.countryCode = 'IN';

    // Indian terminology (see templates/core/terminology.js): the caption is the
    // court-name line (Family Court / District Court) + district; parties are
    // Petitioner/Respondent (HMA 1955 / SMA 1954). No "STATE OF"/"COUNTY OF"
    // caption lines and no "X County" body phrasing.
    this.terminology = {
      ...this.terminology,
      jurisdictionLabel: null,
      districtLabel: null,
      districtStyle: 'plain',
      jurisdictionTerm: 'State',
      districtTerm: 'District',
      districtPlaceholder: '[DISTRICT]',
      filerLabel: 'Petitioner',
      responderLabel: 'Respondent',
      selfRepresentedLabel: 'Self-Represented',
    };
    this.documentTitle = 'DECREE OF DIVORCE';
    try { this.metadata = require('./metadata.json'); } catch (e) { this.metadata = null; }
    this.requiredFields = ['petitionerName', 'respondentName', 'state', 'county', 'caseNumber', 'marriageDate'];
    this.formatting = { fontSize: '12pt', fontFamily: 'Times New Roman', lineHeight: '1.5', margin: '1in', paperSize: 'A4' };
  }

  // Family Court, Mumbai dockets matrimonial matters as "Petition No. A-.../year"
  getCaseNumberLabel() { return 'Petition No.'; }
  // Prefer the filer's own district/city over the hardcoded default court
  getDefaultCourt(county) {
    const loc = county && String(county).trim();
    if (loc && loc.toUpperCase() !== 'MUMBAI') return `FAMILY COURT, ${loc.toUpperCase()}`;
    return 'FAMILY COURT, BANDRA, MUMBAI';
  }
  generateHeader(divorceData = {}) { return `IN THE ${(divorceData.court || this.getDefaultCourt(divorceData.county || divorceData.city)).toUpperCase()}`; }
  generateVenue(county) { return (county || 'MUMBAI').toUpperCase(); }

  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county || divorceData.city)).toUpperCase();
    const caseNumber = divorceData.caseNumber || '[CASE NUMBER]';
    const petitioner = (divorceData.petitionerName || '[PETITIONER NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();
    const formatted = `IN THE ${courtName}\n\n${this.getCaseNumberLabel()} ${caseNumber}\n\nIN THE MATTER OF:\n\n${petitioner}\nPetitioner\n\nVersus\n\n${respondent}\nRespondent`;
    return { courtName, caseNumber: divorceData.caseNumber, petitioner: divorceData.petitionerName, respondent: divorceData.respondentName, formatted };
  }

  generatePropertyDivisionSection(divorceData) {
    const items = [];
    if (divorceData.hasProperty === false) {
      items.push({ content: 'The Court finds there is no matrimonial property to be divided.', type: 'finding' });
    } else {
      items.push({ content: 'The Court has considered the settlement of property between the parties.', type: 'finding' });
      if (divorceData.petitionerProperty && divorceData.petitionerProperty.length > 0) {
        items.push({ content: `IT IS ORDERED that the following property is awarded to ${divorceData.petitionerName || 'Petitioner'}:`, type: 'order' });
        divorceData.petitionerProperty.forEach(prop => { items.push({ content: `- ${prop}`, type: 'property_item' }); });
      }
      if (divorceData.respondentProperty && divorceData.respondentProperty.length > 0) {
        items.push({ content: `IT IS ORDERED that the following property is awarded to ${divorceData.respondentName || 'Respondent'}:`, type: 'order' });
        divorceData.respondentProperty.forEach(prop => { items.push({ content: `- ${prop}`, type: 'property_item' }); });
      }
      if (!divorceData.petitionerProperty && !divorceData.respondentProperty) {
        items.push({ content: 'IT IS ORDERED that each party retains the property currently in their possession, as agreed or as deemed fit by this Court.', type: 'order' });
      }
    }
    return { title: 'DIVISION OF PROPERTY', items, type: 'property' };
  }

  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) return null;
    const items = [];
    items.push({ content: 'The Court finds that the following custody order is in the best interest and welfare of the child(ren):', type: 'finding' });
    items.push({ content: 'The child(ren) subject to this order:', type: 'order' });
    divorceData.children.forEach((child, index) => {
      const childInfo = typeof child === 'string' ? child : `${child.name || '[CHILD NAME]'}, born ${this.formatDate(child.birthDate ?? child.dob ?? child.dateOfBirth) || '[BIRTH DATE]'}`;
      items.push({ content: `${index + 1}. ${childInfo}`, type: 'child_item' });
    });
    // Safety rule (mirrors the base class): only positively recognized
    // custody values render a joint or sole order. Legacy free text like
    // "joint decision making" maps to the joint branch; anything ambiguous
    // renders neutral as-agreed language with a placeholder — NEVER a sole
    // order (see templates/core/parenting.js).
    const custody = resolveCustodyArrangement(divorceData);
    const residenceName = resolvePrimaryResidenceName(divorceData);
    let soleCustodianName = null;
    if (custody.kind === 'joint') {
      items.push({ content: `IT IS ORDERED that both parties shall have joint custody of the child(ren) (Hindu Minority and Guardianship Act 1956 / Guardians and Wards Act 1890).`, type: 'order' });
    } else if (custody.kind === 'sole_petitioner' || custody.kind === 'sole_respondent' || custody.kind === 'legacy_sole') {
      const custodianName =
        custody.kind === 'sole_petitioner'
          ? (divorceData.petitionerName || 'Petitioner')
          : custody.kind === 'sole_respondent'
            ? (divorceData.respondentName || 'Respondent')
            : (divorceData.primaryCustodian || divorceData.petitionerName || 'Petitioner');
      const otherParentName =
        custody.kind === 'sole_respondent'
          ? (divorceData.petitionerName || 'Petitioner')
          : (divorceData.respondentName || 'Respondent');
      soleCustodianName = custodianName;
      items.push({ content: `IT IS ORDERED that ${custodianName} shall have sole custody of the child(ren).`, type: 'order' });
      items.push({ content: `IT IS ORDERED that ${otherParentName} shall have visitation rights as agreed or determined by this Court.`, type: 'order' });
    } else {
      // Unrecognized/undecided arrangement — neutral order with an explicit
      // placeholder for the parties' actual agreement. Never default to sole.
      items.push({
        content: 'IT IS ORDERED that the parties shall exercise legal custody and decision-making responsibility for the minor child(ren) as agreed by the parties: [ARRANGEMENT — set out the parties\' decision-making agreement].',
        type: 'order'
      });
    }

    // Primary residence: ordered whenever the case data says where the
    // child(ren) live, regardless of the custody branch. (The joint branch
    // keeps its historical wording and fallbacks unchanged.)
    if (custody.kind !== 'joint' && residenceName && residenceName !== soleCustodianName) {
      items.push({
        content: `IT IS ORDERED that the child(ren) shall primarily reside with ${residenceName}.`,
        type: 'order'
      });
    }
    items.push({ content: 'IT IS ORDERED that both parties shall have reasonable visitation rights and neither party shall alienate the child(ren)\'s affection for the other party.', type: 'order' });
    return { title: 'CUSTODY ORDER', items, type: 'custody' };
  }

  generateChildSupportSection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) return null;
    const items = [];
    if (divorceData.childSupportAmount) {
      items.push({ content: `IT IS ORDERED that ${divorceData.childSupportObligor || divorceData.respondentName || 'Respondent'} shall pay maintenance of INR ${divorceData.childSupportAmount} per month for the minor child(ren) under HMA s.26 / BNSS s.144.`, type: 'order' });
    } else {
      items.push({ content: 'IT IS ORDERED that maintenance for the minor child(ren) shall be paid in an amount as this Court deems fit under HMA s.26 / BNSS s.144.', type: 'order' });
    }
    items.push({ content: 'IT IS ORDERED that maintenance shall include provisions for education, medical expenses, and general welfare of the child(ren).', type: 'order' });
    return { title: 'CHILD MAINTENANCE', items, type: 'child_support' };
  }

  generateSpousalSupportSection(divorceData) {
    if (!divorceData.spousalSupportAwarded && !divorceData.spousalSupportWaived) return null;
    const items = [];
    if (divorceData.spousalSupportWaived) {
      items.push({ content: 'IT IS ORDERED that neither party shall claim permanent alimony or maintenance from the other party.', type: 'order' });
    } else if (divorceData.spousalSupportAwarded) {
      items.push({ content: `IT IS ORDERED under HMA s.25 that ${divorceData.spousalSupportPayor || divorceData.respondentName || 'Respondent'} shall pay permanent alimony / maintenance to ${divorceData.spousalSupportPayee || divorceData.petitionerName || 'Petitioner'} of INR ${divorceData.spousalSupportAmount || '[AMOUNT]'} per month for ${divorceData.spousalSupportDuration || '[DURATION]'}.`, type: 'order' });
    }
    return { title: 'PERMANENT ALIMONY / MAINTENANCE', items, type: 'spousal_support' };
  }

  generateFinalOrdersSection(divorceData) {
    const items = [];
    items.push({ content: 'IT IS HEREBY ORDERED AND DECREED that the marriage between the Petitioner and the Respondent stands dissolved by a decree of divorce.', type: 'order' });
    items.push({ content: 'IT IS ORDERED that all relief not expressly granted herein is dismissed.', type: 'order' });
    items.push({ content: this.getEffectiveDateText(), type: 'order' });
    items.push({ content: this.getCertificateNote(), type: 'order' });
    return { title: 'FINAL ORDERS', items, type: 'final_orders' };
  }

  getEffectiveDateText() { return 'This Decree of Divorce takes effect from the date it is passed by this Court.'; }
  getCertificateNote() { return 'A certified copy of this Decree may be obtained from the court registry.'; }
}

module.exports = MaharashtraDivorceDecreeTemplate;
