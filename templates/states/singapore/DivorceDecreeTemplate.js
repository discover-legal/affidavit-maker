// templates/states/singapore/DivorceDecreeTemplate.js
// Singapore Interim Judgment / Final Judgment template
// Governing Law: Women's Charter 1961, Part X; Family Justice (General) Rules 2024

'use strict';

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');

/**
 * Singapore Divorce Judgment Template
 *
 * Singapore's divorce process has two stages:
 * 1. Interim Judgment (formerly "Decree Nisi") — marriage is NOT yet dissolved
 * 2. Certificate of Making Interim Judgment Final (formerly "Decree Absolute")
 *    — marriage is dissolved only at this stage
 *
 * The minimum gap between stages is 3 months (Women's Charter, s.99(3)).
 *
 * Key Legal References:
 * - Women's Charter 1961
 *   - s.95: Irretrievable breakdown — sole ground for divorce
 *   - s.95A(1): Six facts proving irretrievable breakdown
 *   - s.99: Interim judgment and final judgment
 *   - s.112: Division of matrimonial assets — "just and equitable"
 *   - s.113-114: Maintenance of wife (gender-specific)
 *   - s.125: Welfare of child paramount in custody matters
 * - Guardianship of Infants Act (Cap 122)
 * - Family Justice (General) Rules 2024
 *
 * IMPORTANT: Muslim marriages are handled by the Syariah Court under AMLA (Cap 3).
 * This template applies ONLY to non-Muslim divorces under the Women's Charter.
 *
 * @class SingaporeDivorceDecreeTemplate
 * @extends BaseDivorceDecreeTemplate
 */
class SingaporeDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'SG';
    this.stateName = 'Singapore';
    this.countryCode = 'SG';
    this.documentTitle = 'INTERIM JUDGMENT';

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
    return 'Divorce Suit No.';
  }

  getDefaultCourt(county) {
    return 'FAMILY JUSTICE COURTS';
  }

  /**
   * Singapore header uses "REPUBLIC OF SINGAPORE".
   * @returns {string} Header text
   */
  generateHeader() {
    return 'REPUBLIC OF SINGAPORE';
  }

  /**
   * Singapore venue — Family Justice Courts (city-state, no sub-jurisdiction).
   * @param {string} county - Not applicable for Singapore
   * @returns {string} Venue text
   */
  generateVenue(county) {
    return 'IN THE FAMILY JUSTICE COURTS';
  }

  /**
   * Singapore case caption uses Plaintiff/Defendant labels.
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county)).toUpperCase();
    const caseLabel = this.getCaseNumberLabel();
    const caseNumber = divorceData.caseNumber || '[SUIT NUMBER]';
    const plaintiff = (divorceData.petitionerName || '[PLAINTIFF NAME]').toUpperCase();
    const defendant = (divorceData.respondentName || '[DEFENDANT NAME]').toUpperCase();

    const formatted = (
      `IN THE ${courtName}\n` +
      `OF THE REPUBLIC OF SINGAPORE\n\n` +
      `${caseLabel} ${caseNumber}\n\n` +
      `BETWEEN:\n\n` +
      `${plaintiff}\n` +
      `Plaintiff\n\n` +
      `— and —\n\n` +
      `${defendant}\n` +
      `Defendant`
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
   * Singapore appearances section uses "Plaintiff" / "Defendant".
   */
  generateAppearancesSection(divorceData) {
    let text = '';

    text += 'On this date, the Court considered the above-entitled matter.\n\n';

    if (divorceData.appearanceType === 'agreed' || divorceData.isUncontested) {
      text += `The Plaintiff, ${divorceData.petitionerName || '[PLAINTIFF NAME]'}, appeared ${divorceData.petitionerRepresentation === 'attorney' ? 'by counsel' : 'in person'}.\n\n`;
      text += `The Defendant, ${divorceData.respondentName || '[DEFENDANT NAME]'}, ${divorceData.respondentAppeared ? 'appeared and consented to the proceedings' : 'having been duly served, did not appear and did not contest the proceedings'}.`;
    } else {
      text += `The Plaintiff, ${divorceData.petitionerName || '[PLAINTIFF NAME]'}, appeared ${divorceData.petitionerRepresentation === 'attorney' ? 'by counsel' : 'in person'}.\n\n`;
      text += `The Defendant, ${divorceData.respondentName || '[DEFENDANT NAME]'}, ${divorceData.respondentAppeared ? 'appeared' : 'although duly served, did not appear'}.`;
    }

    return {
      title: 'APPEARANCES',
      text,
      type: 'appearances'
    };
  }

  /**
   * Singapore dissolution section — Interim Judgment under Women's Charter s.99.
   * The marriage is NOT dissolved at this stage; final judgment is required.
   */
  generateDissolutionSection(divorceData) {
    return {
      title: 'INTERIM JUDGMENT GRANTED',
      text: `IT IS ADJUDGED that the marriage between ${divorceData.petitionerName || '[PLAINTIFF NAME]'} (Plaintiff) and ${divorceData.respondentName || '[DEFENDANT NAME]'} (Defendant), solemnized on ${this.formatDate(divorceData.marriageDate) || '[DATE OF MARRIAGE]'}, has irretrievably broken down and the Court grants an Interim Judgment dissolving the said marriage pursuant to section 95 read with section 99 of the Women's Charter 1961.\n\nNOTE: This Interim Judgment does NOT dissolve the marriage. The marriage is dissolved only when the Certificate of Making Interim Judgment Final is issued (Women's Charter, s.99(3)).`,
      type: 'dissolution'
    };
  }

  /**
   * Singapore property division under Women's Charter, s.112.
   * "Just and equitable" division of "matrimonial assets".
   * The court considers both financial and non-financial contributions.
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    if (divorceData.hasProperty === false) {
      items.push({
        content: 'The Court finds there are no matrimonial assets to be divided under section 112 of the Women\'s Charter 1961.',
        type: 'finding'
      });
    } else {
      items.push({
        content: 'The Court has considered the just and equitable division of the parties\' matrimonial assets pursuant to section 112 of the Women\'s Charter 1961, having regard to the extent of the financial and non-financial contributions made by each party towards the acquisition and improvement of the matrimonial assets, the welfare of the family, and all other relevant circumstances.',
        type: 'finding'
      });

      if (divorceData.petitionerProperty && divorceData.petitionerProperty.length > 0) {
        items.push({
          content: `IT IS ORDERED that the following matrimonial assets are awarded to ${divorceData.petitionerName || 'the Plaintiff'}:`,
          type: 'order'
        });
        divorceData.petitionerProperty.forEach(prop => {
          items.push({ content: `- ${prop}`, type: 'property_item' });
        });
      }

      if (divorceData.respondentProperty && divorceData.respondentProperty.length > 0) {
        items.push({
          content: `IT IS ORDERED that the following matrimonial assets are awarded to ${divorceData.respondentName || 'the Defendant'}:`,
          type: 'order'
        });
        divorceData.respondentProperty.forEach(prop => {
          items.push({ content: `- ${prop}`, type: 'property_item' });
        });
      }

      if (!divorceData.petitionerProperty && !divorceData.respondentProperty) {
        items.push({
          content: 'IT IS ORDERED that each party shall retain the assets currently in that party\'s sole name and possession, subject to any further order of this Court regarding the division of matrimonial assets under section 112 of the Women\'s Charter 1961.',
          type: 'order'
        });
      }
    }

    return { title: 'DIVISION OF MATRIMONIAL ASSETS', items, type: 'property' };
  }

  /**
   * Singapore child custody section — welfare of child is paramount
   * (Guardianship of Infants Act, Cap 122; Women's Charter, s.125).
   * Uses Singapore terminology: "custody", "care and control", and "access".
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Child custody section or null if no children
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court finds that the following orders are in the best interests and welfare of the child(ren) (Women\'s Charter, s.125; Guardianship of Infants Act, Cap 122):',
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
        content: `IT IS ORDERED that ${divorceData.petitionerName || 'the Plaintiff'} and ${divorceData.respondentName || 'the Defendant'} shall have joint custody of the child(ren).`,
        type: 'order'
      });
      items.push({
        content: `IT IS ORDERED that ${divorceData.primaryCustodian || divorceData.petitionerName || 'the Plaintiff'} shall have care and control of the child(ren).`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that ${divorceData.primaryCustodian || divorceData.petitionerName || 'the Plaintiff'} shall have sole custody, care and control of the child(ren).`,
        type: 'order'
      });
    }

    items.push({ content: this.getVisitationLanguage(divorceData), type: 'order' });

    return { title: 'CUSTODY, CARE AND CONTROL', items, type: 'custody' };
  }

  /**
   * Singapore access (visitation) language.
   * @param {Object} divorceData - Divorce data
   * @returns {string} Access language
   */
  getVisitationLanguage(divorceData) {
    return `IT IS ORDERED that ${divorceData.respondentName || 'the Defendant'} shall have reasonable access to the child(ren) as agreed between the parties, or failing agreement, as determined by the Court. Neither party shall do anything to alienate the child(ren) from the other party.`;
  }

  /**
   * Singapore child maintenance under Women's Charter, s.69.
   * Children are entitled to maintenance until age 21.
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
        content: `IT IS ORDERED pursuant to section 69 of the Women's Charter 1961 that ${divorceData.childSupportObligor || divorceData.respondentName || 'the Defendant'} shall pay to ${divorceData.childSupportObligee || divorceData.petitionerName || 'the Plaintiff'} maintenance for the child(ren) in the sum of SGD $${divorceData.childSupportAmount} per month.`,
        type: 'order'
      });
    } else {
      items.push({
        content: 'IT IS ORDERED pursuant to section 69 of the Women\'s Charter 1961 that maintenance for the child(ren) shall be paid in such amount as the Court determines, having regard to the financial needs of the child(ren) and the means of the parents.',
        type: 'order'
      });
    }

    items.push({
      content: 'IT IS ORDERED that maintenance for the child(ren) shall continue until each child attains the age of 21, or until further order of the Court.',
      type: 'order'
    });

    return { title: 'MAINTENANCE OF CHILDREN', items, type: 'child_support' };
  }

  /**
   * Singapore spousal maintenance under Women's Charter, s.113-114.
   * NOTE: Under the Women's Charter, only a wife (or incapacitated husband) may claim
   * maintenance from the other spouse.
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
        content: 'IT IS ORDERED that neither party shall have any claim for maintenance against the other, and each party waives any right to maintenance under sections 113-114 of the Women\'s Charter 1961.',
        type: 'order'
      });
    } else if (divorceData.spousalSupportAwarded) {
      items.push({
        content: `IT IS ORDERED pursuant to sections 113-114 of the Women's Charter 1961 that ${divorceData.spousalSupportPayor || divorceData.respondentName || 'the Defendant'} shall pay maintenance to ${divorceData.spousalSupportPayee || divorceData.petitionerName || 'the Plaintiff'} in the sum of SGD $${divorceData.spousalSupportAmount || '[AMOUNT]'} per month for ${divorceData.spousalSupportDuration || '[DURATION]'}.`,
        type: 'order'
      });
    }

    return { title: 'MAINTENANCE OF FORMER WIFE', items, type: 'spousal_support' };
  }

  /**
   * Singapore final orders section.
   * Includes the critical note about the Interim Judgment and Final Judgment process.
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Final orders section
   */
  generateFinalOrdersSection(divorceData) {
    const items = [];

    items.push({
      content: 'IT IS ORDERED that all ancillary relief not expressly granted in this judgment is dismissed.',
      type: 'order'
    });

    items.push({
      content: 'IT IS ORDERED that each party shall execute and deliver such documents as may be necessary to give effect to the terms of this judgment.',
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

    items.push({
      content: this.getMuslimLawNote(),
      type: 'order'
    });

    return { title: 'FINAL ORDERS', items, type: 'final_orders' };
  }

  /**
   * Singapore effective date: Interim Judgment must be made final after 3 months.
   */
  getEffectiveDateText() {
    return 'This is an Interim Judgment. The marriage is NOT dissolved by this judgment. Either party may apply for the Certificate of Making Interim Judgment Final no earlier than 3 months after the date of this Interim Judgment (Women\'s Charter, s.99(3)).';
  }

  /**
   * Singapore certificate note — Certificate of Making Interim Judgment Final.
   */
  getCertificateNote() {
    return 'The marriage is dissolved only upon the making of the Certificate of Making Interim Judgment Final. The Certificate may be applied for by either party after the expiry of 3 months from the date of this Interim Judgment, unless the Court otherwise directs (Women\'s Charter, s.99).';
  }

  /**
   * Note about Muslim marriages being handled by the Syariah Court.
   */
  getMuslimLawNote() {
    return 'NOTE: This judgment is issued under the Women\'s Charter 1961 and applies to non-Muslim marriages only. Marriages solemnized under Muslim law are governed by the Administration of Muslim Law Act (AMLA, Cap 3) and divorce proceedings for such marriages are handled by the Syariah Court.';
  }

  /**
   * Singapore judgment block — for District Judge of the Family Justice Courts.
   */
  generateJudgmentBlock(divorceData) {
    return {
      text: `DATED this _____ day of _________________, _______.\n\n\n_________________________________\nDISTRICT JUDGE\nFAMILY JUSTICE COURTS`,
      type: 'judgment'
    };
  }

  /**
   * Singapore signature block for agreed proceedings uses "Plaintiff" / "Defendant".
   */
  generateSignatureBlock(divorceData) {
    if (divorceData.isUncontested || divorceData.appearanceType === 'agreed') {
      return {
        title: 'CONSENTED TO:',
        blocks: [
          {
            line: '_________________________________',
            name: divorceData.petitionerName || '[PLAINTIFF NAME]',
            title: 'Plaintiff'
          },
          {
            line: '_________________________________',
            name: divorceData.respondentName || '[DEFENDANT NAME]',
            title: 'Defendant'
          }
        ],
        type: 'party_signatures'
      };
    }

    return null;
  }
}

module.exports = SingaporeDivorceDecreeTemplate;
