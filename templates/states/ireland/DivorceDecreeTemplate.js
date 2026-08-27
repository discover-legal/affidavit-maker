// templates/states/ireland/DivorceDecreeTemplate.js
// Ireland divorce decree template
// Governing Law: Family Law (Divorce) Act 1996, as amended by Family Law Act 2019

'use strict';

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');
const { resolveCustodyArrangement, resolvePrimaryResidenceName } = require('../../core/parenting');
const { asList } = require('../../core/dataShapes');

/**
 * Ireland Divorce Decree Template
 *
 * In Ireland, the final divorce order is called a "Decree of Divorce".
 * It is granted by the Circuit Family Court (most cases) or the High Court
 * (complex or high-value cases).
 *
 * The Decree of Divorce takes effect immediately when granted. There is no
 * statutory waiting period between the granting and its effectiveness (unlike
 * Canada's 31-day rule).
 *
 * Key Legal References:
 * - Family Law (Divorce) Act 1996
 *   - s.5: Three conditions for granting a decree (separation, no reconciliation, proper provision)
 *   - s.13: Periodical payments and lump sum orders
 *   - s.14: Property adjustment orders
 *   - s.15: Miscellaneous ancillary orders
 *   - s.16: Financial compensation orders
 *   - s.17: Pension adjustment orders
 * - Family Law Act 2019, s.3(1)(a): Reduced separation period from 4/5 to 2/3 years
 * - Family Law (Divorce) Act 1996, s.20(2): Factors for financial provision
 * - Guardianship of Infants Act 1964 (as amended): custody and access
 *
 * @class IrelandDivorceDecreeTemplate
 * @extends BaseDivorceDecreeTemplate
 */
class IrelandDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'IRL';
    this.stateName = 'Ireland';
    this.countryCode = 'IE';

    // Irish terminology (see templates/core/terminology.js): the caption is the
    // court-name line (Circuit Family Court); parties are Applicant/Respondent
    // (Family Law (Divorce) Act 1996); venue is the circuit. No "STATE OF"/
    // "COUNTY OF" caption lines and no "X County" body phrasing.
    this.terminology = {
      ...this.terminology,
      jurisdictionLabel: null,
      districtLabel: null,
      districtStyle: 'plain',
      jurisdictionTerm: 'Jurisdiction',
      districtTerm: 'Circuit',
      districtPlaceholder: '[CIRCUIT]',
      filerLabel: 'Applicant',
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
    return 'Record No.';
  }

  getDefaultCourt(county) {
    const location = (county || '[COUNTY/CITY]').toUpperCase();
    return `CIRCUIT FAMILY COURT \u2014 ${location}`;
  }

  /**
   * Ireland document header.
   * @returns {string} Header text
   */
  generateHeader() {
    return 'IRELAND';
  }

  /**
   * Ireland venue uses county or city.
   * @param {string} county - County or city
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const location = (county || '[COUNTY/CITY]').toUpperCase();
    return `COUNTY/CITY OF ${location}`;
  }

  /**
   * Ireland case caption uses Applicant/Respondent labels.
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county)).toUpperCase();
    const caseLabel = this.getCaseNumberLabel();
    const caseNumber = divorceData.caseNumber || '[RECORD NUMBER]';
    const applicant = (divorceData.petitionerName || '[APPLICANT NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();

    const formatted = (
      `IN THE ${courtName}\n\n` +
      `${caseLabel} ${caseNumber}\n\n` +
      `IN THE MATTER OF THE FAMILY LAW (DIVORCE) ACT 1996\n\n` +
      `BETWEEN:\n\n` +
      `${applicant}\n` +
      `Applicant\n\n` +
      `\u2014 and \u2014\n\n` +
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
   * Ireland property division — "proper provision" orders under the 1996 Act.
   * There is no automatic 50/50 split or equalization formula in Ireland.
   * The court has broad discretion to make property adjustment orders (s.14),
   * lump sum orders (s.13), and financial compensation orders (s.16)
   * based on the factors in Family Law (Divorce) Act 1996, s.20(2).
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    if (divorceData.hasProperty === false) {
      items.push({
        content: 'The Court finds there is no property requiring adjustment under the Family Law (Divorce) Act 1996.',
        type: 'finding'
      });
    } else {
      items.push({
        content: 'The Court has considered proper provision for the parties pursuant to section 5(1)(c) of the Family Law (Divorce) Act 1996, having regard to the factors set out in section 20(2) of that Act.',
        type: 'finding'
      });

      if (asList(divorceData.petitionerProperty).length > 0) {
        items.push({
          content: `IT IS ORDERED pursuant to section 14 of the Family Law (Divorce) Act 1996 that the following property is transferred to ${divorceData.petitionerName || 'Applicant'}:`,
          type: 'order'
        });
        asList(divorceData.petitionerProperty).forEach(prop => {
          items.push({ content: `- ${prop}`, type: 'property_item' });
        });
      }

      if (asList(divorceData.respondentProperty).length > 0) {
        items.push({
          content: `IT IS ORDERED pursuant to section 14 of the Family Law (Divorce) Act 1996 that the following property is transferred to ${divorceData.respondentName || 'Respondent'}:`,
          type: 'order'
        });
        asList(divorceData.respondentProperty).forEach(prop => {
          items.push({ content: `- ${prop}`, type: 'property_item' });
        });
      }

      if (divorceData.lumpSumAmount) {
        items.push({
          content: `IT IS ORDERED pursuant to section 13 of the Family Law (Divorce) Act 1996 that ${divorceData.lumpSumPayor || divorceData.respondentName || 'Respondent'} shall pay to ${divorceData.lumpSumPayee || divorceData.petitionerName || 'Applicant'} a lump sum of \u20ac${divorceData.lumpSumAmount}.`,
          type: 'order'
        });
      }

      if (!divorceData.petitionerProperty && !divorceData.respondentProperty && !divorceData.lumpSumAmount) {
        items.push({
          content: 'IT IS ORDERED that each party retains the personal property currently in that party\'s possession, subject to any further property adjustment orders the Court considers proper under section 14 of the Family Law (Divorce) Act 1996.',
          type: 'order'
        });
      }
    }

    return { title: 'PROPERTY ADJUSTMENT', items, type: 'property' };
  }

  /**
   * Ireland child custody section uses Guardianship of Infants Act 1964
   * terminology: "custody" and "access" (Ireland has not adopted the
   * Canadian "parenting time" / "decision-making responsibility" language).
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Child custody section or null if no children
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court finds that the following custody and access arrangements are in the best interests and welfare of the dependent child(ren) (Guardianship of Infants Act 1964, s.3):',
      type: 'finding'
    });

    items.push({ content: 'The dependent child(ren) subject to this order:', type: 'order' });

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
        content: `IT IS ORDERED that ${divorceData.petitionerName || 'Applicant'} and ${divorceData.respondentName || 'Respondent'} shall have joint custody of the dependent child(ren) pursuant to section 11 of the Guardianship of Infants Act 1964 (as amended).`,
        type: 'order'
      });
      items.push({
        content: `IT IS ORDERED that the child(ren) shall primarily reside with ${resolvePrimaryResidenceName(divorceData) || divorceData.petitionerName || 'Applicant'}.`,
        type: 'order'
      });
    } else if (custody.kind === 'sole_petitioner' || custody.kind === 'sole_respondent' || custody.kind === 'legacy_sole') {
      const custodianName =
        custody.kind === 'sole_petitioner'
          ? (divorceData.petitionerName || 'Applicant')
          : custody.kind === 'sole_respondent'
            ? (divorceData.respondentName || 'Respondent')
            : (resolvePrimaryResidenceName(divorceData) || divorceData.petitionerName || 'Applicant');
      const otherParentName =
        custody.kind === 'sole_respondent'
          ? (divorceData.petitionerName || 'Applicant')
          : (divorceData.respondentName || 'Respondent');
      soleCustodianName = custodianName;
      items.push({
        content: `IT IS ORDERED that ${custodianName} shall have sole custody of the dependent child(ren) pursuant to section 11 of the Guardianship of Infants Act 1964 (as amended).`,
        type: 'order'
      });
      items.push({
        content: `IT IS ORDERED that ${otherParentName} shall have reasonable access to the child(ren) as agreed by the parties or as directed by the Court.`,
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

    return { title: 'CUSTODY AND ACCESS', items, type: 'custody' };
  }

  /**
   * Ireland access (visitation) language.
   * @param {Object} divorceData - Divorce data
   * @returns {string} Access language
   */
  getVisitationLanguage(divorceData) {
    return 'IT IS ORDERED that each party shall have access to the dependent child(ren) as agreed in writing by the parties, or, failing agreement, as directed by the Court. Neither party shall do anything to undermine the child(ren)\'s relationship with the other party.';
  }

  /**
   * Ireland child maintenance — no statutory formula, court has discretion.
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
        content: `IT IS ORDERED that ${divorceData.childSupportObligor || divorceData.respondentName || 'Respondent'} shall pay to ${divorceData.childSupportObligee || divorceData.petitionerName || 'Applicant'} maintenance for the dependent child(ren) in the amount of \u20ac${divorceData.childSupportAmount} per month.`,
        type: 'order'
      });
    } else {
      items.push({
        content: 'IT IS ORDERED that maintenance for the dependent child(ren) shall be paid in such amount as the Court considers proper, having regard to the means and needs of the parties and the welfare of the child(ren).',
        type: 'order'
      });
    }

    items.push({
      content: `IT IS ORDERED that ${divorceData.healthInsuranceProvider || 'the maintenance-paying party'} shall maintain health insurance coverage for the dependent child(ren) where available at a reasonable cost.`,
      type: 'order'
    });

    return { title: 'CHILD MAINTENANCE', items, type: 'child_support' };
  }

  /**
   * Ireland spousal maintenance order — discretionary, based on the s.20(2) factors (1996 Act).
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
        content: 'IT IS ORDERED that each party waives and releases any claim for periodical payments (maintenance) from the other party under section 13 of the Family Law (Divorce) Act 1996, now and in the future.',
        type: 'order'
      });
    } else if (divorceData.spousalSupportAwarded) {
      items.push({
        content: `IT IS ORDERED pursuant to section 13 of the Family Law (Divorce) Act 1996 that ${divorceData.spousalSupportPayor || divorceData.respondentName || 'Respondent'} shall pay maintenance to ${divorceData.spousalSupportPayee || divorceData.petitionerName || 'Applicant'} in the amount of \u20ac${divorceData.spousalSupportAmount || '[AMOUNT]'} per month for ${divorceData.spousalSupportDuration || '[DURATION]'}.`,
        type: 'order'
      });
    }

    return { title: 'SPOUSAL MAINTENANCE', items, type: 'spousal_support' };
  }

  /**
   * Ireland final orders section.
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Final orders section
   */
  generateFinalOrdersSection(divorceData) {
    const items = [];

    items.push({
      content: 'IT IS ORDERED that all ancillary relief requested in this proceeding and not expressly granted is dismissed.',
      type: 'order'
    });

    items.push({
      content: 'IT IS ORDERED that this Decree of Divorce constitutes the final order in this proceeding and dissolves the marriage between the parties.',
      type: 'order'
    });

    items.push({
      content: 'IT IS ORDERED that each party shall execute and deliver such further documents and do such further acts as may be necessary to give effect to the terms of this Decree.',
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
   * Ireland decree effective date: immediate upon granting.
   * Unlike Canada (31-day wait) or some other jurisdictions, the Irish decree
   * takes effect when pronounced by the court.
   */
  getEffectiveDateText() {
    return 'This Decree of Divorce takes effect immediately upon being granted by the Court. The parties are free to remarry from the date of this Decree.';
  }

  /**
   * Ireland certified copy of decree.
   */
  getCertificateNote() {
    return 'A certified copy of this Decree of Divorce may be obtained from the court office upon application by either party.';
  }
}

module.exports = IrelandDivorceDecreeTemplate;
