// templates/states/kenya/DivorceDecreeTemplate.js
// Kenya divorce decree template
// Governing Law: Marriage Act, 2014 (No. 4 of 2014); Matrimonial Property Act, 2013

'use strict';

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');

/**
 * Kenya Divorce Decree Template
 *
 * In Kenya, divorce proceedings in practice result in a Decree Nisi (conditional
 * decree) followed by a Decree Absolute (final dissolution) — a court practice
 * inherited from the repealed Matrimonial Causes Act; the Marriage Act, 2014 is
 * silent on the nisi/absolute stages. The Decree Nisi is issued by the
 * magistrates' court ('court' = resident magistrate's court, Marriage Act, 2014,
 * s.2) or Kadhi's Court (Islamic marriages); the High Court hears appeals.
 * Either party may apply for the Decree Absolute after a prescribed period
 * (typically 30 days from Decree Nisi).
 *
 * Key Legal References:
 * - Marriage Act, 2014 (No. 4 of 2014)
 *   - s.65-71: Grounds for divorce (marriage-type specific; s.66 civil)
 *   - ss.64, 66(4), 68: Voluntary/discretionary conciliation (s.67 is
 *     recognition of foreign decrees)
 *   - s.77-80: Maintenance
 * - Matrimonial Property Act, 2013 (No. 49 of 2013) — contribution-based property division
 * - Children Act, 2022 (No. 29 of 2022) — custody, parental responsibility, child maintenance
 * - Constitution of Kenya, 2010, Art. 170 — Kadhi's Courts
 *
 * @class KenyaDivorceDecreeTemplate
 * @extends BaseDivorceDecreeTemplate
 */
class KenyaDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'KE';
    this.stateName = 'Kenya';
    this.countryCode = 'KE';
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
    return 'Divorce Cause No.';
  }

  getDefaultCourt(county) {
    const station = (county || '[STATION]').toUpperCase();
    return `CHIEF MAGISTRATE'S COURT AT ${station}`;
  }

  /**
   * Kenya document header uses "REPUBLIC OF KENYA".
   * @returns {string} Header text
   */
  generateHeader() {
    return 'REPUBLIC OF KENYA';
  }

  /**
   * Kenya venue uses county, not "STATE OF".
   * @param {string} county - County of filing
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const location = (county || '[COUNTY]').toUpperCase();
    return `AT ${location}`;
  }

  /**
   * Kenya case caption uses Petitioner/Respondent labels.
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
      `IN THE ${courtName}\n\n` +
      `${caseLabel} ${caseNumber}\n\n` +
      `IN THE MATTER OF A PETITION FOR DIVORCE\n` +
      `UNDER THE MARRIAGE ACT, 2014\n\n` +
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
   * Kenya property division under the Matrimonial Property Act, 2013.
   * Contribution-based approach: the court considers both financial and
   * non-financial contributions of each spouse (s.7).
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    if (divorceData.hasProperty === false) {
      items.push({
        content: 'The Court finds there is no matrimonial property to be divided under the Matrimonial Property Act, 2013.',
        type: 'finding'
      });
    } else {
      items.push({
        content: 'The Court has considered the division of matrimonial property pursuant to the Matrimonial Property Act, 2013 (No. 49 of 2013), taking into account the contribution of each party, whether financial or non-financial.',
        type: 'finding'
      });

      if (divorceData.petitionerProperty && divorceData.petitionerProperty.length > 0) {
        items.push({
          content: `IT IS ORDERED that the following property is awarded to ${divorceData.petitionerName || 'the Petitioner'}:`,
          type: 'order'
        });
        divorceData.petitionerProperty.forEach(prop => {
          items.push({ content: `- ${prop}`, type: 'property_item' });
        });
      }

      if (divorceData.respondentProperty && divorceData.respondentProperty.length > 0) {
        items.push({
          content: `IT IS ORDERED that the following property is awarded to ${divorceData.respondentName || 'the Respondent'}:`,
          type: 'order'
        });
        divorceData.respondentProperty.forEach(prop => {
          items.push({ content: `- ${prop}`, type: 'property_item' });
        });
      }

      if (!divorceData.petitionerProperty && !divorceData.respondentProperty) {
        items.push({
          content: 'IT IS ORDERED that the matrimonial property shall be divided in accordance with the respective contributions of each party as determined by this Court under the Matrimonial Property Act, 2013.',
          type: 'order'
        });
      }
    }

    return { title: 'DIVISION OF MATRIMONIAL PROPERTY', items, type: 'property' };
  }

  /**
   * Kenya child custody section — Children Act, 2022.
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
      content: 'The Court finds that the following custody order is in the best interests of the child(ren) (Children Act, 2022, s.8):',
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
        content: `IT IS ORDERED that ${divorceData.petitionerName || 'the Petitioner'} and ${divorceData.respondentName || 'the Respondent'} shall have joint custody and parental responsibility for the child(ren) pursuant to the Children Act, 2022.`,
        type: 'order'
      });
      items.push({
        content: `IT IS ORDERED that the child(ren) shall primarily reside with ${divorceData.primaryCustodian || divorceData.petitionerName || 'the Petitioner'}, who shall have care and control.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that ${divorceData.primaryCustodian || divorceData.petitionerName || 'the Petitioner'} shall have sole custody and parental responsibility for the child(ren) pursuant to the Children Act, 2022.`,
        type: 'order'
      });
      items.push({
        content: `IT IS ORDERED that ${divorceData.respondentName || 'the Respondent'} shall have reasonable access to the child(ren) as agreed by the parties or as determined by this Court.`,
        type: 'order'
      });
    }

    items.push({ content: this.getVisitationLanguage(divorceData), type: 'order' });

    return { title: 'CUSTODY AND PARENTAL RESPONSIBILITY', items, type: 'custody' };
  }

  /**
   * Kenya access/visitation language.
   * @param {Object} divorceData - Divorce data
   * @returns {string} Access language
   */
  getVisitationLanguage(divorceData) {
    return 'IT IS ORDERED that each party shall have access to the child(ren) as agreed in writing by the parties, or, failing agreement, as determined by this Court. Neither party shall do anything to alienate the child(ren)\'s affection for the other party.';
  }

  /**
   * Kenya child maintenance order — Children Act, 2022, s.24.
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
        content: `IT IS ORDERED pursuant to the Children Act, 2022, s.24, that ${divorceData.childSupportObligor || divorceData.respondentName || 'the Respondent'} shall pay to ${divorceData.childSupportObligee || divorceData.petitionerName || 'the Petitioner'} child maintenance in the amount of KES ${divorceData.childSupportAmount} per month for the benefit of the minor child(ren).`,
        type: 'order'
      });
    } else {
      items.push({
        content: 'IT IS ORDERED pursuant to the Children Act, 2022, s.24, that child maintenance shall be paid in an amount to be determined by this Court, having regard to the needs of the child(ren), the means of both parents, and the standard of living the child(ren) was accustomed to.',
        type: 'order'
      });
    }

    items.push({
      content: `IT IS ORDERED that ${divorceData.healthInsuranceProvider || 'the maintenance obligor'} shall maintain medical insurance or cover medical expenses for the minor child(ren) where reasonably available.`,
      type: 'order'
    });

    return { title: 'CHILD MAINTENANCE', items, type: 'child_support' };
  }

  /**
   * Kenya spousal maintenance order — Marriage Act, 2014, s.77-80.
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
        content: 'IT IS ORDERED that each party waives and releases any claim for maintenance from the other party under sections 77-80 of the Marriage Act, 2014, now and in the future.',
        type: 'order'
      });
    } else if (divorceData.spousalSupportAwarded) {
      items.push({
        content: `IT IS ORDERED pursuant to sections 77-80 of the Marriage Act, 2014, that ${divorceData.spousalSupportPayor || divorceData.respondentName || 'the Respondent'} shall pay maintenance to ${divorceData.spousalSupportPayee || divorceData.petitionerName || 'the Petitioner'} in the amount of KES ${divorceData.spousalSupportAmount || '[AMOUNT]'} per month for ${divorceData.spousalSupportDuration || '[DURATION]'}.`,
        type: 'order'
      });
    }

    return { title: 'MAINTENANCE', items, type: 'spousal_support' };
  }

  /**
   * Kenya final orders section — Decree Nisi and Decree Absolute process.
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Final orders section
   */
  generateFinalOrdersSection(divorceData) {
    const items = [];

    items.push({
      content: 'IT IS ORDERED that all relief prayed for in this Petition and not expressly granted is dismissed.',
      type: 'order'
    });

    items.push({
      content: 'IT IS ORDERED that this Decree Nisi shall constitute the conditional order in this proceeding.',
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
   * Kenya divorce effective date: Decree Nisi becomes Decree Absolute
   * after the prescribed period (typically 30 days).
   */
  getEffectiveDateText() {
    return 'This Decree Nisi shall become absolute upon application by either party after the expiry of thirty (30) days from the date hereof, unless cause is shown to the contrary or the court otherwise orders.';
  }

  /**
   * Kenya Decree Absolute note.
   */
  getCertificateNote() {
    return 'Either party may apply for the Decree Absolute after the prescribed period has elapsed. The marriage shall be dissolved upon the grant of the Decree Absolute.';
  }
}

module.exports = KenyaDivorceDecreeTemplate;
