// templates/states/hong_kong/DivorceDecreeTemplate.js
// Hong Kong divorce decree template
// Governing Law: Matrimonial Causes Ordinance (Cap 179); Matrimonial Proceedings and Property Ordinance (Cap 192)

'use strict';

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');
const { resolveCustodyArrangement, resolvePrimaryResidenceName } = require('../../core/parenting');

/**
 * Hong Kong Divorce Decree Template
 *
 * Hong Kong follows the traditional English two-stage process:
 * 1. Decree Nisi — provisional order dissolving the marriage
 * 2. Decree Absolute — final order (applied for 6 weeks after Decree Nisi)
 *
 * The marriage is not dissolved until Decree Absolute is granted.
 *
 * Key Legal References:
 * - Matrimonial Causes Ordinance (Cap 179)
 *   - s.11: Sole ground — irretrievable breakdown of marriage
 *   - s.11A(2): Five facts proving irretrievable breakdown; s.11B: joint application
 *   - s.15: Decree Nisi not to be made absolute within 6 weeks
 *   - s.17: Intervention to prevent Decree Nisi being made Absolute
 * - Matrimonial Proceedings and Property Ordinance (Cap 192)
 *   - s.3-5: Maintenance (periodical payments, lump sum)
 *   - s.6: Property adjustment orders
 *   - s.7: Matters to which court has regard (financial provision)
 * - Guardianship of Minors Ordinance (Cap 13)
 *   - Custody, care and control of minor children
 *
 * @class HongKongDivorceDecreeTemplate
 * @extends BaseDivorceDecreeTemplate
 */
class HongKongDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'HK';
    this.stateName = 'Hong Kong';
    this.countryCode = 'HK';

    // Hong Kong terminology (see templates/core/terminology.js): the caption is the
    // court-name line (Family Court / District Court); parties are
    // Petitioner/Respondent (Matrimonial Causes Ordinance, Cap 179). No "STATE
    // OF"/"COUNTY OF" caption lines and no "X County" body phrasing.
    this.terminology = {
      ...this.terminology,
      jurisdictionLabel: null,
      districtLabel: null,
      districtStyle: 'plain',
      jurisdictionTerm: 'Jurisdiction',
      districtTerm: 'Court location',
      districtPlaceholder: '[COURT LOCATION]',
      filerLabel: 'Petitioner',
      responderLabel: 'Respondent',
      selfRepresentedLabel: 'Self-Represented',
    };
    this.documentTitle = 'DECREE NISI';

    try {
      this.metadata = require('./metadata.json');
    } catch (e) {
      this.metadata = null;
    }

    this.requiredFields = [
      'petitionerName',
      'respondentName',
      'state',
      'county',
      'caseNumber',
      'marriageDate'
    ];

    this.formatting = {
      fontSize: '12pt',
      fontFamily: 'Times New Roman',
      lineHeight: '1.5',
      margin: '1in',
      paperSize: 'A4'
    };
  }

  getCaseNumberLabel() {
    return 'Number FCMC';
  }

  getDefaultCourt(county) {
    return 'DISTRICT COURT OF THE HONG KONG SPECIAL ADMINISTRATIVE REGION';
  }

  /**
   * Hong Kong document header — the Family Court is a division of the District
   * Court, so the prescribed case heading is the District Court's.
   * @returns {string} Header text
   */
  generateHeader() {
    return 'IN THE DISTRICT COURT OF THE\nHONG KONG SPECIAL ADMINISTRATIVE REGION\nMATRIMONIAL CAUSES';
  }

  /**
   * Hong Kong venue.
   * @param {string} county - District
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const location = (county || 'HONG KONG').toUpperCase();
    return `${location}`;
  }

  /**
   * Hong Kong case caption uses Petitioner/Respondent labels.
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county)).toUpperCase();
    const caseLabel = this.getCaseNumberLabel();
    const caseNumber = divorceData.caseNumber || '[CASE NUMBER]';
    const petitioner = (divorceData.petitionerName || '[PETITIONER NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();

    const formatted = (
      `IN THE ${courtName}\n` +
      `MATRIMONIAL CAUSES\n\n` +
      `${caseLabel} ${caseNumber}\n\n` +
      `IN THE MATTER OF THE MATRIMONIAL CAUSES ORDINANCE (CAP 179)\n\n` +
      `BETWEEN:\n\n` +
      `${petitioner}\n` +
      `Petitioner\n\n` +
      `— and —\n\n` +
      `${respondent}\n` +
      `Respondent`
    );

    return {
      courtName,
      caseNumber: divorceData.caseNumber,
      petitioner: divorceData.petitionerName,
      respondent: divorceData.respondentName,
      formatted
    };
  }

  /**
   * Hong Kong property division under the Matrimonial Proceedings and Property
   * Ordinance (Cap 192), s.6-7.
   * Hong Kong does not have a community property or equalization regime — the court
   * exercises broad discretion considering the factors in s.7 MPPO.
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    if (divorceData.hasProperty === false) {
      items.push({
        content: 'The Court finds that there are no matrimonial assets requiring adjustment under the Matrimonial Proceedings and Property Ordinance (Cap 192).',
        type: 'finding'
      });
    } else {
      items.push({
        content: 'The Court has considered the division of matrimonial property having regard to the factors set out in section 7 of the Matrimonial Proceedings and Property Ordinance (Cap 192), including the income, earning capacity, property, and financial resources of each party, their financial needs and obligations, and the standard of living enjoyed by the family before the breakdown of the marriage.',
        type: 'finding'
      });

      if (divorceData.lumpSumPayment) {
        items.push({
          content: `IT IS ORDERED that ${divorceData.lumpSumPayor || divorceData.respondentName || 'Respondent'} shall pay to ${divorceData.lumpSumPayee || divorceData.petitionerName || 'Petitioner'} a lump sum of HKD $${divorceData.lumpSumPayment} pursuant to section 4 of the Matrimonial Proceedings and Property Ordinance (Cap 192).`,
          type: 'order'
        });
      }

      if (divorceData.petitionerProperty && divorceData.petitionerProperty.length > 0) {
        items.push({
          content: `IT IS ORDERED that the following property is transferred to ${divorceData.petitionerName || 'Petitioner'}:`,
          type: 'order'
        });
        divorceData.petitionerProperty.forEach(prop => {
          items.push({ content: `- ${prop}`, type: 'property_item' });
        });
      }

      if (divorceData.respondentProperty && divorceData.respondentProperty.length > 0) {
        items.push({
          content: `IT IS ORDERED that the following property is transferred to ${divorceData.respondentName || 'Respondent'}:`,
          type: 'order'
        });
        divorceData.respondentProperty.forEach(prop => {
          items.push({ content: `- ${prop}`, type: 'property_item' });
        });
      }

      if (!divorceData.petitionerProperty && !divorceData.respondentProperty && !divorceData.lumpSumPayment) {
        items.push({
          content: 'IT IS ORDERED that each party retains the property currently in that party\'s possession, subject to any further order of this Court pursuant to the Matrimonial Proceedings and Property Ordinance (Cap 192).',
          type: 'order'
        });
      }
    }

    return { title: 'DIVISION OF PROPERTY', items, type: 'property' };
  }

  /**
   * Hong Kong child custody section — uses "custody, care and control" terminology.
   * HK has NOT adopted the modern "parenting time" / "decision-making responsibility"
   * terminology used in some other jurisdictions.
   * Governed by Guardianship of Minors Ordinance (Cap 13).
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Child custody section or null if no children
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court finds that the following order for custody, care and control is in the best interests of the child(ren) of the family (Guardianship of Minors Ordinance (Cap 13)):',
      type: 'finding'
    });

    items.push({ content: 'The child(ren) of the family:', type: 'order' });

    divorceData.children.forEach((child, index) => {
      const childInfo = typeof child === 'string'
        ? child
        : `${child.name || '[CHILD NAME]'}, born ${this.formatDate(child.birthDate ?? child.dob ?? child.dateOfBirth) || '[BIRTH DATE]'}`;
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
      items.push({
        content: `IT IS ORDERED that ${divorceData.petitionerName || 'Petitioner'} and ${divorceData.respondentName || 'Respondent'} shall have joint custody of the child(ren) of the family.`,
        type: 'order'
      });
      items.push({
        content: `IT IS ORDERED that care and control of the child(ren) shall be granted to ${divorceData.primaryCustodian || divorceData.petitionerName || 'Petitioner'}, with reasonable access to ${divorceData.respondentName || 'Respondent'}.`,
        type: 'order'
      });
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
      items.push({
        content: `IT IS ORDERED that sole custody, care and control of the child(ren) shall be granted to ${custodianName}.`,
        type: 'order'
      });
      items.push({
        content: `IT IS ORDERED that ${otherParentName} shall have reasonable access to the child(ren) as agreed by the parties or as directed by this Court.`,
        type: 'order'
      });
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

    items.push({ content: this.getVisitationLanguage(divorceData), type: 'order' });

    return { title: 'CUSTODY, CARE AND CONTROL', items, type: 'custody' };
  }

  /**
   * Hong Kong access (visitation) language — uses "access" not "parenting time".
   * @param {Object} divorceData - Divorce data
   * @returns {string} Access language
   */
  getVisitationLanguage(divorceData) {
    return 'IT IS ORDERED that the non-custodial parent shall have reasonable access to the child(ren) as agreed between the parties in writing, or, failing agreement, as directed by this Court. Neither party shall do anything to alienate the child(ren)\'s affection for the other party.';
  }

  /**
   * Hong Kong child maintenance order pursuant to MPPO s.5.
   * There is no statutory formula — the court exercises discretion.
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Child maintenance section or null if no children
   */
  generateChildSupportSection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    if (divorceData.childSupportAmount) {
      items.push({
        content: `IT IS ORDERED pursuant to section 5 of the Matrimonial Proceedings and Property Ordinance (Cap 192) that ${divorceData.childSupportObligor || divorceData.respondentName || 'Respondent'} shall pay to ${divorceData.childSupportObligee || divorceData.petitionerName || 'Petitioner'} periodical payments for the maintenance of the child(ren) in the amount of HKD $${divorceData.childSupportAmount} per month.`,
        type: 'order'
      });
    } else {
      items.push({
        content: 'IT IS ORDERED pursuant to section 5 of the Matrimonial Proceedings and Property Ordinance (Cap 192) that periodical payments for the maintenance of the child(ren) of the family shall be paid in such amount as this Court determines having regard to all the circumstances.',
        type: 'order'
      });
    }

    items.push({
      content: `IT IS ORDERED that ${divorceData.healthInsuranceProvider || 'the maintenance payor'} shall maintain medical coverage for the child(ren) where reasonably available.`,
      type: 'order'
    });

    return { title: 'CHILD MAINTENANCE', items, type: 'child_support' };
  }

  /**
   * Hong Kong spousal maintenance order pursuant to MPPO ss.3-4.
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Spousal maintenance section or null if not applicable
   */
  generateSpousalSupportSection(divorceData) {
    if (!divorceData.spousalSupportAwarded && !divorceData.spousalSupportWaived) {
      return null;
    }

    const items = [];

    if (divorceData.spousalSupportWaived) {
      items.push({
        content: 'IT IS ORDERED that each party waives and releases any claim for maintenance from the other party under sections 3 and 4 of the Matrimonial Proceedings and Property Ordinance (Cap 192), now and in the future.',
        type: 'order'
      });
    } else if (divorceData.spousalSupportAwarded) {
      items.push({
        content: `IT IS ORDERED pursuant to sections 3 and 4 of the Matrimonial Proceedings and Property Ordinance (Cap 192) that ${divorceData.spousalSupportPayor || divorceData.respondentName || 'Respondent'} shall pay maintenance to ${divorceData.spousalSupportPayee || divorceData.petitionerName || 'Petitioner'} in the amount of HKD $${divorceData.spousalSupportAmount || '[AMOUNT]'} per month for ${divorceData.spousalSupportDuration || '[DURATION]'}.`,
        type: 'order'
      });
    }

    return { title: 'MAINTENANCE', items, type: 'spousal_support' };
  }

  /**
   * Hong Kong final orders section — Decree Nisi and Decree Absolute process.
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Final orders section
   */
  generateFinalOrdersSection(divorceData) {
    const items = [];

    items.push({
      content: 'IT IS DECREED that the marriage solemnized between the Petitioner and the Respondent be dissolved unless sufficient cause be shown to the Court within six weeks why the decree should not be made absolute.',
      type: 'order'
    });

    items.push({
      content: 'IT IS ORDERED that all ancillary relief requested in this proceeding and not expressly granted is dismissed.',
      type: 'order'
    });

    items.push({
      content: 'IT IS ORDERED that each party shall execute and deliver such further documents and do such further acts as may be necessary to give effect to the terms of this Decree and any ancillary orders.',
      type: 'order'
    });

    items.push({
      content: this.getEffectiveDateText(),
      type: 'order'
    });

    items.push({
      content: this.getCertificateNote(),
      type: 'order'
    });

    return { title: 'DECREE AND FINAL ORDERS', items, type: 'final_orders' };
  }

  /**
   * Hong Kong Decree Nisi / Decree Absolute process.
   * Matrimonial Causes Ordinance, s.15: Decree Nisi not to be made absolute
   * within 6 weeks from the date it is pronounced.
   */
  getEffectiveDateText() {
    return 'This Decree Nisi shall not be made Absolute until after the expiration of six weeks from the date hereof, unless the Court by general or special order fixes a shorter time (Matrimonial Causes Ordinance (Cap 179), s.15). The marriage is dissolved only upon the grant of the Decree Absolute.';
  }

  /**
   * Hong Kong certificate of decree.
   */
  getCertificateNote() {
    return 'A Certificate of Decree Absolute may be obtained from the Family Court Registry after the Decree Absolute has been granted, upon application by either party.';
  }
}

module.exports = HongKongDivorceDecreeTemplate;
