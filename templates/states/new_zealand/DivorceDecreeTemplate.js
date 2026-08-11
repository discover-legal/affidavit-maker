// templates/states/new_zealand/DivorceDecreeTemplate.js
// New Zealand dissolution of marriage order template
// Governing Law: Family Proceedings Act 1980; Property (Relationships) Act 1976

'use strict';

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');

/**
 * New Zealand Dissolution Order Template
 *
 * In New Zealand, the final order is called an "Order for Dissolution of Marriage"
 * (not a "Decree" or "Divorce Order"). It is issued by the Family Court.
 *
 * The dissolution order takes effect immediately upon being made by the court
 * (Family Proceedings Act 1980, s.46) — there is no further waiting period.
 *
 * Key Legal References:
 * - Family Proceedings Act 1980
 *   - s.38: Domicile requirement
 *   - s.39: Sole ground — 2-year separation
 *   - s.46: Order takes effect immediately
 * - Property (Relationships) Act 1976 (equal sharing of relationship property)
 * - Care of Children Act 2004 (guardianship, day-to-day care, contact)
 * - Child Support Act 1991 (child support — Inland Revenue)
 *
 * @class NewZealandDivorceDecreeTemplate
 * @extends BaseDivorceDecreeTemplate
 */
class NewZealandDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'NZ';
    this.stateName = 'New Zealand';
    this.countryCode = 'NZ';
    this.documentTitle = 'ORDER FOR DISSOLUTION OF MARRIAGE';

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
      margin: '2.54cm',
      paperSize: 'A4'
    };
  }

  getCaseNumberLabel() {
    return 'FAM No.';
  }

  getDefaultCourt(county) {
    const city = (county || '[CITY]').toUpperCase();
    return `FAMILY COURT AT ${city}`;
  }

  /**
   * NZ document header.
   * @returns {string} Header text
   */
  generateHeader() {
    return 'IN THE FAMILY COURT OF NEW ZEALAND';
  }

  /**
   * NZ venue uses city or district.
   * @param {string} county - City or district
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const location = (county || '[CITY/DISTRICT]').toUpperCase();
    return `AT ${location}`;
  }

  /**
   * NZ case caption uses Applicant/Respondent labels.
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county)).toUpperCase();
    const caseLabel = this.getCaseNumberLabel();
    const caseNumber = divorceData.caseNumber || '[FAM NUMBER]';
    const applicant = (divorceData.petitionerName || '[APPLICANT NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();

    const formatted = (
      `IN THE ${courtName}\n\n` +
      `${caseLabel} ${caseNumber}\n\n` +
      `IN THE MATTER of the Family Proceedings Act 1980\n\n` +
      `BETWEEN:\n\n` +
      `${applicant}\n` +
      `Applicant\n\n` +
      `and\n\n` +
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
   * NZ property division under the Property (Relationships) Act 1976.
   * Equal sharing of "relationship property" is the starting point.
   * Separate property remains with the owner.
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    if (divorceData.hasProperty === false) {
      items.push({
        content: 'The Court finds there is no relationship property to be divided under the Property (Relationships) Act 1976.',
        type: 'finding'
      });
    } else {
      items.push({
        content: 'The Court has considered the division of the parties\' relationship property pursuant to the Property (Relationships) Act 1976. Under section 11, relationship property is to be divided equally between the parties.',
        type: 'finding'
      });

      if (divorceData.petitionerProperty && divorceData.petitionerProperty.length > 0) {
        items.push({
          content: `IT IS ORDERED that the following relationship property is awarded to ${divorceData.petitionerName || 'Applicant'}:`,
          type: 'order'
        });
        divorceData.petitionerProperty.forEach(prop => {
          items.push({ content: `- ${prop}`, type: 'property_item' });
        });
      }

      if (divorceData.respondentProperty && divorceData.respondentProperty.length > 0) {
        items.push({
          content: `IT IS ORDERED that the following relationship property is awarded to ${divorceData.respondentName || 'Respondent'}:`,
          type: 'order'
        });
        divorceData.respondentProperty.forEach(prop => {
          items.push({ content: `- ${prop}`, type: 'property_item' });
        });
      }

      if (divorceData.compensationPayment) {
        items.push({
          content: `IT IS ORDERED that ${divorceData.compensationPayor || divorceData.respondentName || 'Respondent'} shall pay to ${divorceData.compensationPayee || divorceData.petitionerName || 'Applicant'} compensation of $${divorceData.compensationPayment} to achieve equal sharing of relationship property pursuant to s.11 of the Property (Relationships) Act 1976.`,
          type: 'order'
        });
      }

      if (!divorceData.petitionerProperty && !divorceData.respondentProperty && !divorceData.compensationPayment) {
        items.push({
          content: 'IT IS ORDERED that each party retains the relationship property currently in that party\'s possession, and that this achieves an equal sharing of relationship property pursuant to the Property (Relationships) Act 1976.',
          type: 'order'
        });
      }
    }

    return { title: 'DIVISION OF RELATIONSHIP PROPERTY', items, type: 'property' };
  }

  /**
   * NZ child section uses Care of Children Act 2004 terminology:
   * "guardianship" — legal responsibility for the child
   * "day-to-day care" — where the child primarily lives
   * "contact" — time with the other parent
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Child arrangements section or null if no children
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court finds that the following parenting order is in the welfare and best interests of the child(ren) (Care of Children Act 2004, s.4):',
      type: 'finding'
    });

    items.push({ content: 'The child(ren) subject to this order:', type: 'order' });

    divorceData.children.forEach((child, index) => {
      const childInfo = typeof child === 'string'
        ? child
        : `${child.name || '[CHILD NAME]'}, born ${this.formatDate(child.birthDate ?? child.dob ?? child.dateOfBirth) || '[BIRTH DATE]'}`;
      items.push({ content: `${index + 1}. ${childInfo}`, type: 'child_item' });
    });

    const custodyType = divorceData.custodyType || 'joint';
    if (custodyType === 'joint') {
      items.push({
        content: `IT IS ORDERED that both ${divorceData.petitionerName || 'Applicant'} and ${divorceData.respondentName || 'Respondent'} shall be guardians of the child(ren) pursuant to the Care of Children Act 2004.`,
        type: 'order'
      });
      items.push({
        content: `IT IS ORDERED that the child(ren) shall be in the day-to-day care of ${divorceData.primaryCustodian || divorceData.petitionerName || 'Applicant'}, with ${divorceData.respondentName || 'Respondent'} having contact as agreed or as set out in a parenting schedule attached to this Order.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that ${divorceData.primaryCustodian || divorceData.petitionerName || 'Applicant'} shall have the day-to-day care of the child(ren) pursuant to the Care of Children Act 2004.`,
        type: 'order'
      });
      items.push({
        content: `IT IS ORDERED that ${divorceData.respondentName || 'Respondent'} shall have contact with the child(ren) as agreed by the parties or as set out in a parenting schedule attached to this Order.`,
        type: 'order'
      });
    }

    items.push({ content: this.getVisitationLanguage(divorceData), type: 'order' });

    return { title: 'PARENTING ORDER', items, type: 'custody' };
  }

  /**
   * NZ contact language — uses "contact" not "access" or "visitation".
   * @param {Object} divorceData - Divorce data
   * @returns {string} Contact language
   */
  getVisitationLanguage(divorceData) {
    return 'IT IS ORDERED that both parties shall foster the child(ren)\'s relationship with the other party and shall not do anything to undermine that relationship. The welfare and best interests of the child(ren) shall be the paramount consideration in all matters relating to guardianship, day-to-day care, and contact (Care of Children Act 2004, s.4).';
  }

  /**
   * NZ child support — Child Support Act 1991.
   * Child support is assessed and collected by Inland Revenue, not the Family Court.
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Child support section or null if no children
   */
  generateChildSupportSection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    if (divorceData.childSupportAmount) {
      items.push({
        content: `IT IS ORDERED that ${divorceData.childSupportObligor || divorceData.respondentName || 'Respondent'} shall pay to ${divorceData.childSupportObligee || divorceData.petitionerName || 'Applicant'} child support in the amount of $${divorceData.childSupportAmount} per month, or such amount as assessed by Inland Revenue under the Child Support Act 1991.`,
        type: 'order'
      });
    } else {
      items.push({
        content: 'IT IS ORDERED that child support shall be assessed and paid in accordance with the Child Support Act 1991, as administered by Inland Revenue.',
        type: 'order'
      });
    }

    return { title: 'CHILD SUPPORT', items, type: 'child_support' };
  }

  /**
   * NZ spousal maintenance under Family Proceedings Act 1980, ss.63-74.
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Maintenance section or null if not applicable
   */
  generateSpousalSupportSection(divorceData) {
    if (!divorceData.spousalSupportAwarded && !divorceData.spousalSupportWaived) {
      return null;
    }

    const items = [];

    if (divorceData.spousalSupportWaived) {
      items.push({
        content: 'IT IS ORDERED that each party waives and releases any claim for maintenance from the other party under sections 63-74 of the Family Proceedings Act 1980.',
        type: 'order'
      });
    } else if (divorceData.spousalSupportAwarded) {
      items.push({
        content: `IT IS ORDERED pursuant to section 64 of the Family Proceedings Act 1980 that ${divorceData.spousalSupportPayor || divorceData.respondentName || 'Respondent'} shall pay maintenance to ${divorceData.spousalSupportPayee || divorceData.petitionerName || 'Applicant'} in the amount of $${divorceData.spousalSupportAmount || '[AMOUNT]'} per month for ${divorceData.spousalSupportDuration || '[DURATION]'}.`,
        type: 'order'
      });
    }

    return { title: 'MAINTENANCE', items, type: 'spousal_support' };
  }

  /**
   * NZ final orders section.
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Final orders section
   */
  generateFinalOrdersSection(divorceData) {
    const items = [];

    items.push({
      content: 'IT IS ORDERED that all relief sought in this proceeding and not expressly granted is dismissed.',
      type: 'order'
    });

    items.push({
      content: 'IT IS ORDERED that this Order constitutes the final determination of the application for dissolution of marriage and disposes of all matters between the parties.',
      type: 'order'
    });

    items.push({
      content: 'IT IS ORDERED that each party shall execute and deliver such further documents and do such further acts as may be necessary to give effect to the terms of this Order.',
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
   * NZ dissolution effective date: immediately upon being made (s.46).
   */
  getEffectiveDateText() {
    return 'This Order for Dissolution of Marriage takes effect immediately upon being made (Family Proceedings Act 1980, s.46).';
  }

  /**
   * Certificate of dissolution confirmation.
   */
  getCertificateNote() {
    return 'A certificate confirming the dissolution of marriage may be obtained from the Family Court registry after the order takes effect.';
  }
}

module.exports = NewZealandDivorceDecreeTemplate;
