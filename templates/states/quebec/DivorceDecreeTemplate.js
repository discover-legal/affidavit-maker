// templates/states/quebec/DivorceDecreeTemplate.js
// Quebec divorce judgment template
// Governing Law: Divorce Act (RSC 1985, c. 3); Code of Civil Procedure, CQLR c. C-25.01

'use strict';

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');

/**
 * Quebec Divorce Judgment Template
 *
 * Quebec's Superior Court (Cour supérieure) issues the final divorce judgment.
 * Quebec follows the federal Divorce Act for the divorce itself, but provincial
 * law governs property division, custody, and support procedures.
 *
 * Quebec civil law creates important distinctions:
 *   - Family patrimony (patrimoine familial) is MANDATORY — the court MUST partition
 *     certain assets equally regardless of ownership or agreement between spouses
 *   - Partnership of acquests (société d'acquêts) is the default matrimonial regime
 *     and divides property acquired during the marriage
 *   - The court must verify that adequate arrangements exist for any children
 *
 * Key Legal References:
 * - Divorce Act, RSC 1985, c. 3
 *   - s.10: Duty of court regarding reasonable arrangements for children
 *   - s.12: Divorce effective 31 days after judgment
 *   - s.12(7): Certificate of Divorce — issued by court registrar after effective date
 * - Civil Code of Quebec, CQLR c. CCQ-1991
 *   - Arts. 414-426: Family patrimony (patrimoine familial — mandatory equal partition)
 *   - Arts. 448-484: Partnership of acquests (société d'acquêts — default matrimonial regime)
 * - Code of Civil Procedure, CQLR c. C-25.01 (procedure)
 *
 * @class QuebecDivorceDecreeTemplate
 * @extends BaseDivorceDecreeTemplate
 */
class QuebecDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'QC';
    this.stateName = 'Quebec';
    this.countryCode = 'CA';
    this.documentTitle = 'DIVORCE JUDGMENT\n(JUGEMENT EN DIVORCE)';

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
      paperSize: '8.5in x 11in'
    };
  }

  getCaseNumberLabel() {
    return 'No. :';
  }

  getDefaultCourt(county) {
    const district = (county || '[JUDICIAL DISTRICT]').toUpperCase();
    return `SUPERIOR COURT (COUR SUPÉRIEURE) — DISTRICT OF ${district}`;
  }

  /**
   * Quebec document header uses "PROVINCE OF QUEBEC" (not "STATE OF").
   * @returns {string} Header text
   */
  generateHeader() {
    return 'PROVINCE OF QUEBEC\n(PROVINCE DE QUÉBEC)';
  }

  /**
   * Quebec venue uses judicial district, not "COUNTY OF".
   * @param {string} county - Judicial district
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const district = (county || '[JUDICIAL DISTRICT]').toUpperCase();
    return `DISTRICT OF ${district}`;
  }

  /**
   * Quebec case caption uses Plaintiff/Defendant labels (Code of Civil Procedure,
   * CQLR c. C-25.01 — divorce actions use the standard civil action structure).
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county)).toUpperCase();
    const caseLabel = this.getCaseNumberLabel();
    const caseNumber = divorceData.caseNumber || '[CASE NUMBER]';
    const plaintiff = (divorceData.petitionerName || '[PLAINTIFF NAME]').toUpperCase();
    const defendant = (divorceData.respondentName || '[DEFENDANT NAME]').toUpperCase();

    const formatted = (
      `IN THE ${courtName}\n\n` +
      `${caseLabel} ${caseNumber}\n\n` +
      `IN THE MATTER OF THE DIVORCE ACT, RSC 1985, c. 3\n\n` +
      `BETWEEN:\n\n` +
      `${plaintiff}\n` +
      `Plaintiff / Demandeur(esse)\n\n` +
      `— and / — et —\n\n` +
      `${defendant}\n` +
      `Defendant / Défendeur(esse)`
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
   * Quebec property division under the Civil Code of Quebec.
   * Family patrimony (patrimoine familial, arts. 414-426) is mandatory equal partition.
   * Partnership of acquests (société d'acquêts, arts. 448-484) is the default regime.
   * "Community property" or "marital property" (US terms) must not appear.
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    items.push({
      content: 'FAMILY PATRIMONY (PATRIMOINE FAMILIAL): The Court notes that under articles 414-426 of the Civil Code of Quebec, CQLR c. CCQ-1991, the family patrimony must be partitioned equally between the spouses regardless of ownership. The family patrimony includes family residences, rights conferred by leases, furnishings therein, motor vehicles used for family travel, and retirement and pension plans accumulated during the marriage. This partition is mandatory.',
      type: 'finding'
    });

    if (divorceData.hasProperty === false) {
      items.push({
        content: 'The Court finds there is no additional property subject to division beyond the mandatory family patrimony partition under the Civil Code of Quebec.',
        type: 'finding'
      });
    } else {
      items.push({
        content: 'The Court has considered the partition of the family patrimony and the dissolution of the matrimonial regime (partnership of acquests or as otherwise applicable) pursuant to the Civil Code of Quebec, CQLR c. CCQ-1991.',
        type: 'finding'
      });

      if (divorceData.petitionerProperty && divorceData.petitionerProperty.length > 0) {
        items.push({
          content: `IT IS ORDERED that the following property is awarded to ${divorceData.petitionerName || 'Plaintiff'} as that party's exclusive property:`,
          type: 'order'
        });
        divorceData.petitionerProperty.forEach(prop => {
          items.push({ content: `- ${prop}`, type: 'property_item' });
        });
      }

      if (divorceData.respondentProperty && divorceData.respondentProperty.length > 0) {
        items.push({
          content: `IT IS ORDERED that the following property is awarded to ${divorceData.respondentName || 'Defendant'} as that party's exclusive property:`,
          type: 'order'
        });
        divorceData.respondentProperty.forEach(prop => {
          items.push({ content: `- ${prop}`, type: 'property_item' });
        });
      }

      if (!divorceData.petitionerProperty && !divorceData.respondentProperty) {
        items.push({
          content: 'IT IS ORDERED that the parties\' property shall be partitioned in accordance with the applicable matrimonial regime under the Civil Code of Quebec, CQLR c. CCQ-1991, subject to the mandatory family patrimony partition under arts. 414-426.',
          type: 'order'
        });
      }
    }

    return { title: 'PARTITION OF FAMILY PATRIMONY AND MATRIMONIAL REGIME', items, type: 'property' };
  }

  /**
   * Quebec child parenting order uses 2021 Divorce Act terminology:
   * "decision-making responsibility" (s.16.1) replaces "custody";
   * "parenting time" (s.16.1) replaces "access".
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Child parenting section or null if no children
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court finds that the following parenting order is in the best interests of the child(ren) (Divorce Act, s.16):',
      type: 'finding'
    });

    items.push({ content: 'The child(ren) subject to this order:', type: 'order' });

    divorceData.children.forEach((child, index) => {
      const childInfo = typeof child === 'string'
        ? child
        : `${child.name || '[CHILD NAME]'}, born ${this.formatDate(child.birthDate) || '[BIRTH DATE]'}`;
      items.push({ content: `${index + 1}. ${childInfo}`, type: 'child_item' });
    });

    const custodyType = divorceData.custodyType || 'joint';
    if (custodyType === 'joint') {
      items.push({
        content: `IT IS ORDERED that ${divorceData.petitionerName || 'Plaintiff'} and ${divorceData.respondentName || 'Defendant'} shall have shared decision-making responsibility for the child(ren) pursuant to the Divorce Act, RSC 1985, c. 3, s.16.1.`,
        type: 'order'
      });
      items.push({
        content: `IT IS ORDERED that the child(ren) shall primarily reside with ${divorceData.primaryCustodian || divorceData.petitionerName || 'Plaintiff'}, who shall have primary parenting time.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that ${divorceData.primaryCustodian || divorceData.petitionerName || 'Plaintiff'} shall have sole decision-making responsibility for the child(ren) pursuant to the Divorce Act, RSC 1985, c. 3, s.16.1.`,
        type: 'order'
      });
      items.push({
        content: `IT IS ORDERED that ${divorceData.respondentName || 'Defendant'} shall have parenting time with the child(ren) as agreed by the parties or as set out in a parenting schedule attached to this Judgment.`,
        type: 'order'
      });
    }

    items.push({ content: this.getVisitationLanguage(divorceData), type: 'order' });

    return { title: 'PARENTING ORDER', items, type: 'custody' };
  }

  /**
   * Quebec parenting time language — uses Divorce Act 2021 terminology.
   * @param {Object} divorceData - Divorce data
   * @returns {string} Parenting time language
   */
  getVisitationLanguage(divorceData) {
    return 'IT IS ORDERED that each party shall have parenting time with the child(ren) as agreed in writing by the parties, or, failing agreement, as set out in a parenting schedule filed with this Court. Neither party shall do anything to alienate the child(ren)\'s affection for the other party (Divorce Act, s.16.3).';
  }

  /**
   * Quebec child support order pursuant to Divorce Act s.15.1 and the Federal
   * Child Support Guidelines, SOR/97-175.
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
        content: `IT IS ORDERED pursuant to s.15.1 of the Divorce Act, RSC 1985, c. 3, and the Federal Child Support Guidelines, SOR/97-175, that ${divorceData.childSupportObligor || divorceData.respondentName || 'Defendant'} shall pay to ${divorceData.childSupportObligee || divorceData.petitionerName || 'Plaintiff'} child support in the amount of $${divorceData.childSupportAmount} per month.`,
        type: 'order'
      });
    } else {
      items.push({
        content: 'IT IS ORDERED pursuant to s.15.1 of the Divorce Act, RSC 1985, c. 3, that child support shall be paid in accordance with the Federal Child Support Guidelines, SOR/97-175.',
        type: 'order'
      });
    }

    items.push({
      content: `IT IS ORDERED that ${divorceData.healthInsuranceProvider || 'the support payor'} shall maintain health and dental coverage for the minor child(ren) where available at a reasonable cost through an employer or group plan.`,
      type: 'order'
    });

    return { title: 'CHILD SUPPORT', items, type: 'child_support' };
  }

  /**
   * Quebec spousal support order pursuant to Divorce Act s.15.2.
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Spousal support section or null if not applicable
   */
  generateSpousalSupportSection(divorceData) {
    if (!divorceData.spousalSupportAwarded && !divorceData.spousalSupportWaived) {
      return null;
    }

    const items = [];

    if (divorceData.spousalSupportWaived) {
      items.push({
        content: 'IT IS ORDERED that each party waives and releases any claim for spousal support from the other party under s.15.2 of the Divorce Act, RSC 1985, c. 3, now and in the future.',
        type: 'order'
      });
    } else if (divorceData.spousalSupportAwarded) {
      items.push({
        content: `IT IS ORDERED pursuant to s.15.2 of the Divorce Act, RSC 1985, c. 3, that ${divorceData.spousalSupportPayor || divorceData.respondentName || 'Defendant'} shall pay spousal support to ${divorceData.spousalSupportPayee || divorceData.petitionerName || 'Plaintiff'} in the amount of $${divorceData.spousalSupportAmount || '[AMOUNT]'} per month for ${divorceData.spousalSupportDuration || '[DURATION]'}.`,
        type: 'order'
      });
    }

    return { title: 'SPOUSAL SUPPORT', items, type: 'spousal_support' };
  }

  /**
   * Quebec final orders section — avoids US "decree" and "final judgment" language.
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Final orders section
   */
  generateFinalOrdersSection(divorceData) {
    const items = [];

    items.push({
      content: 'IT IS ORDERED that all corollary relief requested in this proceeding and not expressly granted is dismissed.',
      type: 'order'
    });

    items.push({
      content: 'IT IS ORDERED that this Divorce Judgment constitutes the final judgment in this proceeding and disposes of all matters between the parties.',
      type: 'order'
    });

    items.push({
      content: 'IT IS ORDERED that each party shall execute and deliver such further documents and do such further acts as may be necessary to give effect to the terms of this Judgment.',
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

  getEffectiveDateText() {
    return 'This Divorce Judgment takes effect on the 31st day after it is pronounced, unless appealed or the effective date is varied (Divorce Act, s.12(1)).';
  }

  getCertificateNote() {
    return 'A Certificate of Divorce (Certificat de divorce) may be obtained from the court clerk after the effective date (Divorce Act, s.12(7)).';
  }

  /**
   * Quebec-specific note about mandatory family patrimony partition.
   * This must appear in any Quebec divorce decree where applicable.
   */
  getFamilyPatrimonyNote() {
    return 'IMPORTANT — FAMILY PATRIMONY (PATRIMOINE FAMILIAL): Under articles 414-426 of the Civil Code of Quebec, the family patrimony must be partitioned equally between the spouses regardless of ownership. The family patrimony includes: the family residences and rights conferred by a lease, the furnishings in the family residences, motor vehicles used for family travel, and retirement plans and pension plans accumulated during the marriage. This partition is mandatory and cannot be waived except as permitted by law.';
  }
}

module.exports = QuebecDivorceDecreeTemplate;
