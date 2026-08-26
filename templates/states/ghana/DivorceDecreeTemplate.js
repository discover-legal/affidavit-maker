// templates/states/ghana/DivorceDecreeTemplate.js
// Ghana divorce decree template
// Governing Law: Matrimonial Causes Act 1971 (Act 367)

'use strict';

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');
const { resolveCustodyArrangement, resolvePrimaryResidenceName } = require('../../core/parenting');

/**
 * Ghana Divorce Decree Template
 *
 * In Ghana the court grants a single decree of divorce: under MCA 1971
 * s.37 every decree is final and takes effect from the date the court
 * gives judgment. Ghana has NO decree nisi / decree absolute stage.
 *
 * Key Legal References:
 * - Matrimonial Causes Act 1971 (Act 367)
 *   - s.1(2): Sole ground — marriage has broken down beyond reconciliation
 *   - s.2(1): The six facts that establish breakdown
 *   - s.8: Reconciliation — petitioner reports efforts; court MAY adjourn
 *   - s.19: Financial provision for spouse (s.20 is property settlement)
 *   - s.37: Decrees are final from the date of judgment
 * - Children's Act 1998 (Act 560) — best interests of the child
 * - 1992 Constitution, Art. 22 — spouse's property rights
 *
 * @class GhanaDivorceDecreeTemplate
 * @extends BaseDivorceDecreeTemplate
 */
class GhanaDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'GH';
    this.stateName = 'Ghana';
    this.countryCode = 'GH';

    // Ghanaian terminology (see templates/core/terminology.js): the caption is the
    // court-name line (High Court at X); parties are Petitioner/Respondent
    // (Matrimonial Causes Act 1971 (Act 367)). No "STATE OF"/"COUNTY OF" caption
    // lines and no "X County" body phrasing.
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
    this.documentTitle = 'DECREE OF DIVORCE';

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
    return 'Suit No.';
  }

  getDefaultCourt(county) {
    const city = (county || '[CITY]').toUpperCase();
    return `HIGH COURT OF JUSTICE, ${city}`;
  }

  /**
   * Ghana document header uses "REPUBLIC OF GHANA".
   * @returns {string} Header text
   */
  generateHeader() {
    return 'REPUBLIC OF GHANA';
  }

  /**
   * Ghana venue uses city/district.
   * @param {string} county - City or district
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const location = (county || '[CITY/DISTRICT]').toUpperCase();
    return `IN THE HIGH COURT OF JUSTICE, ${location}`;
  }

  /**
   * Ghana case caption uses Petitioner/Respondent labels.
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county)).toUpperCase();
    const caseLabel = this.getCaseNumberLabel();
    const caseNumber = divorceData.caseNumber || '[SUIT NUMBER]';
    const petitioner = (divorceData.petitionerName || '[PETITIONER NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();

    const formatted = (
      `IN THE ${courtName}\n\n` +
      `${caseLabel} ${caseNumber}\n\n` +
      `IN THE MATTER OF THE MATRIMONIAL CAUSES ACT 1971 (ACT 367)\n\n` +
      `BETWEEN:\n\n` +
      `${petitioner}\n` +
      `Petitioner\n\n` +
      `— versus —\n\n` +
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
   * Ghana dissolution section — single final decree (MCA s.37).
   * The Matrimonial Causes Act uses "broken down beyond reconciliation".
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Dissolution section
   */
  generateDissolutionSection(divorceData) {
    return {
      title: 'DECREE OF DIVORCE',
      text: `THE COURT, having heard the petition, having been informed of the efforts made to effect a reconciliation (section 8 of the Matrimonial Causes Act 1971 (Act 367)), and being satisfied on all the evidence that the marriage between ${divorceData.petitionerName || '[PETITIONER NAME]'} and ${divorceData.respondentName || '[RESPONDENT NAME]'} has broken down beyond reconciliation within the meaning of sections 1(2) and 2(1) of the said Act:\n\nIT IS HEREBY DECREED that the said marriage solemnised on ${this.formatDate(divorceData.marriageDate) || '[DATE OF MARRIAGE]'} be and is hereby dissolved. This decree is final and takes effect from the date of this judgment (section 37).`,
      type: 'dissolution'
    };
  }

  /**
   * Ghana property division — court discretion under 1992 Constitution Art. 22.
   * Ghana does not have statutory community property or equalization.
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    if (divorceData.hasProperty === false) {
      items.push({
        content: 'The Court finds there is no matrimonial property to be divided.',
        type: 'finding'
      });
    } else {
      items.push({
        content: 'The Court has considered the equitable distribution of the parties\' matrimonial property pursuant to Article 22 of the 1992 Constitution of the Republic of Ghana, having regard to the contributions of each party to the acquisition of the property.',
        type: 'finding'
      });

      if (divorceData.petitionerProperty && divorceData.petitionerProperty.length > 0) {
        items.push({
          content: `IT IS ORDERED that the following property is awarded to ${divorceData.petitionerName || 'Petitioner'}:`,
          type: 'order'
        });
        divorceData.petitionerProperty.forEach(prop => {
          items.push({ content: `- ${prop}`, type: 'property_item' });
        });
      }

      if (divorceData.respondentProperty && divorceData.respondentProperty.length > 0) {
        items.push({
          content: `IT IS ORDERED that the following property is awarded to ${divorceData.respondentName || 'Respondent'}:`,
          type: 'order'
        });
        divorceData.respondentProperty.forEach(prop => {
          items.push({ content: `- ${prop}`, type: 'property_item' });
        });
      }

      if (!divorceData.petitionerProperty && !divorceData.respondentProperty) {
        items.push({
          content: 'IT IS ORDERED that each party retains the personal property currently in that party\'s possession, subject to any further orders of this Court regarding the equitable distribution of matrimonial property.',
          type: 'order'
        });
      }
    }

    return { title: 'DIVISION OF PROPERTY', items, type: 'property' };
  }

  /**
   * Ghana child custody section — Children's Act 1998 (Act 560).
   * Best interests of the child is the paramount consideration.
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Child custody section or null if no children
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court finds that the following orders are in the best interests of the child(ren) pursuant to the Children\'s Act 1998 (Act 560):',
      type: 'finding'
    });

    items.push({ content: 'The child(ren) subject to this order:', type: 'order' });

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
        content: `IT IS ORDERED that ${divorceData.petitionerName || 'Petitioner'} and ${divorceData.respondentName || 'Respondent'} shall have joint custody of the child(ren), with the child(ren) primarily residing with ${divorceData.primaryCustodian || divorceData.petitionerName || 'Petitioner'}.`,
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
        content: `IT IS ORDERED that ${custodianName} shall have sole custody of the child(ren).`,
        type: 'order'
      });
      items.push({
        content: `IT IS ORDERED that ${otherParentName} shall have reasonable access to the child(ren) as agreed by the parties or as determined by this Court.`,
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

    return { title: 'CUSTODY OF CHILDREN', items, type: 'custody' };
  }

  /**
   * Ghana access/visitation language.
   * @param {Object} divorceData - Divorce data
   * @returns {string} Visitation language
   */
  getVisitationLanguage(divorceData) {
    return 'IT IS ORDERED that each party shall have access to the child(ren) at times mutually agreed by the parties, or, failing agreement, as this Court may direct. Neither party shall do anything to alienate the child(ren)\'s affection for the other party.';
  }

  /**
   * Ghana child maintenance — Children's Act 1998 (Act 560).
   * No fixed formula — court uses discretion based on needs and means.
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
        content: `IT IS ORDERED pursuant to the Children's Act 1998 (Act 560) that ${divorceData.childSupportObligor || divorceData.respondentName || 'Respondent'} shall pay to ${divorceData.childSupportObligee || divorceData.petitionerName || 'Petitioner'} child maintenance in the amount of GHS ${divorceData.childSupportAmount} per month for the upkeep and education of the child(ren).`,
        type: 'order'
      });
    } else {
      items.push({
        content: 'IT IS ORDERED pursuant to the Children\'s Act 1998 (Act 560) that child maintenance shall be paid in an amount to be determined by this Court, having regard to the needs of the child(ren) and the financial capacity of each parent.',
        type: 'order'
      });
    }

    items.push({
      content: `IT IS ORDERED that ${divorceData.healthInsuranceProvider || 'the maintenance obligor'} shall provide for the health care and educational needs of the minor child(ren) to the extent that the party is financially able.`,
      type: 'order'
    });

    return { title: 'CHILD MAINTENANCE', items, type: 'child_support' };
  }

  /**
   * Ghana spousal maintenance — MCA s.19 (financial provision for spouse).
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
        content: 'IT IS ORDERED that each party waives and releases any claim for maintenance from the other party under section 19 of the Matrimonial Causes Act 1971 (Act 367).',
        type: 'order'
      });
    } else if (divorceData.spousalSupportAwarded) {
      items.push({
        content: `IT IS ORDERED pursuant to section 19 of the Matrimonial Causes Act 1971 (Act 367) that ${divorceData.spousalSupportPayor || divorceData.respondentName || 'Respondent'} shall pay maintenance to ${divorceData.spousalSupportPayee || divorceData.petitionerName || 'Petitioner'} in the amount of GHS ${divorceData.spousalSupportAmount || '[AMOUNT]'} per month for ${divorceData.spousalSupportDuration || '[DURATION]'}.`,
        type: 'order'
      });
    }

    return { title: 'SPOUSAL MAINTENANCE', items, type: 'spousal_support' };
  }

  /**
   * Ghana final orders section.
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Final orders section
   */
  generateFinalOrdersSection(divorceData) {
    const items = [];

    items.push({
      content: 'IT IS ORDERED that all relief requested in this proceeding and not expressly granted is dismissed.',
      type: 'order'
    });

    items.push({
      content: 'IT IS ORDERED that each party shall execute and deliver such documents and do such acts as may be necessary to give effect to the terms of this Decree.',
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

    return { title: 'FINAL ORDERS', items, type: 'final_orders' };
  }

  /**
   * Ghana decrees are final from the date of judgment (MCA s.37).
   */
  getEffectiveDateText() {
    return 'This Decree is final and takes effect from the date of this judgment (Matrimonial Causes Act 1971 (Act 367), section 37).';
  }

  /**
   * Ghana Certificate of Divorce — available once the decree is granted.
   */
  getCertificateNote() {
    return 'A Certificate of Divorce may be obtained from the High Court registry after the grant of this Decree.';
  }

  /**
   * Ghana judgment block — for Justice/Judge signature.
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Judgment block
   */
  generateJudgmentBlock(divorceData) {
    return {
      text: `DATED at ${(divorceData.county || '_______________').toUpperCase()} this _____ day of _________________, _______.\n\n\n_________________________________\nJUSTICE OF THE HIGH COURT`,
      type: 'judgment'
    };
  }
}

module.exports = GhanaDivorceDecreeTemplate;
