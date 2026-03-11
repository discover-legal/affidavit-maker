// templates/states/connecticut/DivorceDecreeTemplate.js
// Connecticut Judgment of Dissolution of Marriage template
// Complies with Conn. Gen. Stat. §46b-40 et seq. (Dissolution of Marriage)

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');

/**
 * Connecticut Judgment of Dissolution of Marriage Template
 *
 * Legal References:
 * - Conn. Gen. Stat. §46b-40 — Grounds for dissolution
 * - Conn. Gen. Stat. §46b-44 — Residency (12 months state)
 * - Conn. Gen. Stat. §46b-67 — 90-day waiting period from return date
 * - Conn. Gen. Stat. §46b-81 — Property division (ALL property — marital and separate)
 * - Conn. Gen. Stat. §46b-82 — Alimony
 * - Conn. Gen. Stat. §46b-56 — Custody and visitation (legal custody, physical custody, access)
 * - Conn. Gen. Stat. §46b-84 — Child support obligations
 * - Conn. Gen. Stat. §46b-215a-1 et seq. — CT Child Support and Arrearage Guidelines
 *
 * Connecticut-Specific Terms:
 * - "Judgment of Dissolution of Marriage" (not decree of divorce)
 * - "DOCKET NO." label (family actions use "FA-" prefix)
 * - "Plaintiff" / "Defendant"
 * - "Legal Custody" / "Physical Custody"
 * - "Visitation" or "Access"
 * - "Alimony" (not maintenance or spousal support)
 * - ALL property (marital and separate) subject to equitable division
 * - Superior Court, Family Division
 * - Judicial districts (not just counties)
 */
class ConnecticutDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'CT';
    this.stateName = 'Connecticut';
    this.documentTitle = 'JUDGMENT OF DISSOLUTION OF MARRIAGE';

    try {
      this.metadata = require('./divorce-metadata.json');
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
  }

  /**
   * Get Connecticut case number label
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'DOCKET NO.';
  }

  /**
   * Get default court for Connecticut judicial district — Superior Court, Family Division
   * @param {string} county - Judicial district name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const districtName = county || '[JUDICIAL DISTRICT]';
    return `Superior Court, Family Division, Judicial District of ${districtName}, State of Connecticut`;
  }

  /**
   * Generate Connecticut header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF CONNECTICUT, SUPERIOR COURT';
  }

  /**
   * Generate Connecticut venue — judicial district
   * @param {string} county - Judicial district name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const districtName = county || '[JUDICIAL DISTRICT]';
    const districtFormatted = districtName.charAt(0).toUpperCase() + districtName.slice(1).toLowerCase();
    return `Judicial District of ${districtFormatted}`;
  }

  /**
   * Generate Connecticut title
   * @returns {string} Title text
   */
  generateTitle() {
    return this.documentTitle;
  }

  /**
   * Get effective date text for Connecticut
   * @returns {string} Effective date text
   */
  getEffectiveDateText() {
    return 'the date this Judgment is entered by the Court';
  }

  /**
   * Generate Connecticut appearances section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Appearances section
   */
  generateAppearancesSection(divorceData) {
    let text = '';

    text += `This matter came before the Court for hearing.\n\n`;

    if (divorceData.isUncontested || divorceData.appearanceType === 'agreed') {
      text += `Plaintiff, ${divorceData.petitionerName || '[PLAINTIFF NAME]'}, appeared ${divorceData.petitionerRepresentation === 'attorney' ? 'with counsel' : 'self-represented'}.\n\n`;
      text += `Defendant, ${divorceData.respondentName || '[DEFENDANT NAME]'}, ${divorceData.respondentAppeared ? 'appeared and announced agreement' : 'having been duly served, did not appear'}.`;
    } else {
      text += `Plaintiff appeared ${divorceData.petitionerRepresentation === 'attorney' ? 'with counsel' : 'self-represented'}.\n\n`;
      text += `Defendant ${divorceData.respondentAppeared ? 'appeared' : 'did not appear'}.`;
    }

    text += `\n\nThe Court, having considered the evidence and applicable law, enters the following Judgment:`;

    return {
      title: 'APPEARANCES',
      text,
      type: 'appearances'
    };
  }

  /**
   * Generate Connecticut jurisdiction section — 12-month state residency
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Jurisdiction section
   */
  generateJurisdictionSection(divorceData) {
    return {
      title: 'JURISDICTION',
      text: `The Court finds that it has jurisdiction over this proceeding and the parties. At least one party has been a resident of the State of Connecticut for at least twelve (12) months preceding the filing of this action. (Conn. Gen. Stat. §46b-44) The parties were married on ${this.formatDate(divorceData.marriageDate) || '[DATE]'}${divorceData.marriageLocation ? ` in ${divorceData.marriageLocation}` : ''}. The marriage has broken down irretrievably. At least ninety (90) days have elapsed since the return date. (Conn. Gen. Stat. §46b-67)`,
      type: 'jurisdiction'
    };
  }

  /**
   * Generate Connecticut dissolution section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Dissolution section
   */
  generateDissolutionSection(divorceData) {
    return {
      title: 'JUDGMENT OF DISSOLUTION',
      text: `IT IS ORDERED, ADJUDGED, AND DECREED that the marriage of ${divorceData.petitionerName || '[PLAINTIFF NAME]'} and ${divorceData.respondentName || '[DEFENDANT NAME]'} is hereby dissolved, and the parties are restored to the status of unmarried persons, effective ${this.getEffectiveDateText()}.`,
      type: 'dissolution'
    };
  }

  /**
   * Generate Connecticut property division — ALL property subject to division (unique CT rule)
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    items.push({
      content: 'The Court has considered the factors set forth in Conn. Gen. Stat. §46b-81 and, exercising its broad equitable authority to assign all or any part of the estate of either party, orders the following division of property:',
      type: 'finding'
    });

    if (divorceData.petitionerProperty && divorceData.petitionerProperty.length > 0) {
      items.push({
        content: `IT IS ORDERED that the following property is assigned to ${divorceData.petitionerName || 'Plaintiff'} as that party's sole property:`,
        type: 'order'
      });
      divorceData.petitionerProperty.forEach(prop => {
        items.push({ content: `- ${prop}`, type: 'property_item' });
      });
    }

    if (divorceData.respondentProperty && divorceData.respondentProperty.length > 0) {
      items.push({
        content: `IT IS ORDERED that the following property is assigned to ${divorceData.respondentName || 'Defendant'} as that party's sole property:`,
        type: 'order'
      });
      divorceData.respondentProperty.forEach(prop => {
        items.push({ content: `- ${prop}`, type: 'property_item' });
      });
    }

    if (!divorceData.petitionerProperty && !divorceData.respondentProperty) {
      items.push({
        content: `IT IS ORDERED that each party is assigned the personal property currently in that party's possession as that party's sole property.`,
        type: 'order'
      });
    }

    return {
      title: 'DIVISION OF PROPERTY',
      items,
      type: 'property'
    };
  }

  /**
   * Generate Connecticut child custody section — "Legal Custody" and "Physical Custody"
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Custody section
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court finds that the following custody arrangement is in the best interests of the child(ren) pursuant to Conn. Gen. Stat. §46b-56:',
      type: 'finding'
    });

    items.push({
      content: 'The minor child(ren) of this marriage:',
      type: 'order'
    });

    divorceData.children.forEach((child, index) => {
      const childInfo = typeof child === 'string'
        ? child
        : `${child.name || '[CHILD NAME]'}, born ${this.formatDate(child.birthDate) || '[BIRTH DATE]'}`;
      items.push({
        content: `${index + 1}. ${childInfo}`,
        type: 'child_item'
      });
    });

    const custodyType = divorceData.custodyType || 'joint';

    if (custodyType === 'joint') {
      items.push({
        content: `IT IS ORDERED that the parties shall share joint legal custody of the minor child(ren). ${divorceData.primaryCustodian || divorceData.petitionerName || 'Plaintiff'} shall have primary physical custody.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that ${divorceData.primaryCustodian || divorceData.petitionerName || 'Plaintiff'} shall have sole legal custody and sole physical custody of the minor child(ren).`,
        type: 'order'
      });
    }

    items.push({
      content: this.getVisitationLanguage(divorceData),
      type: 'order'
    });

    return {
      title: 'CUSTODY AND VISITATION',
      items,
      type: 'custody'
    };
  }

  /**
   * Get Connecticut visitation language — uses "visitation" or "access"
   * @param {Object} divorceData - Divorce data
   * @returns {string} Visitation language
   */
  getVisitationLanguage(divorceData) {
    return `IT IS ORDERED that the non-custodial parent shall have reasonable and liberal visitation and access with the minor child(ren), as agreed by the parties and approved by the Court, or as the Court determines to be in the best interests of the child(ren) pursuant to Conn. Gen. Stat. §46b-56.`;
  }

  /**
   * Generate Connecticut child support section
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Child support section
   */
  generateChildSupportSection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];
    const obligor = divorceData.childSupportObligor || divorceData.respondentName || 'Defendant';
    const obligee = divorceData.childSupportObligee || divorceData.petitionerName || 'Plaintiff';

    if (divorceData.childSupportAmount) {
      items.push({
        content: `IT IS ORDERED that ${obligor} shall pay child support to ${obligee} in the amount of $${divorceData.childSupportAmount} per week, calculated in accordance with the Connecticut Child Support and Arrearage Guidelines, Conn. Gen. Stat. §46b-84 and §46b-215a-1 et seq.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that child support shall be paid in accordance with the Connecticut Child Support and Arrearage Guidelines, Conn. Gen. Stat. §46b-84 and §46b-215a-1 et seq. The parties shall complete a Child Support Guidelines Worksheet.`,
        type: 'order'
      });
    }

    items.push({
      content: `IT IS ORDERED that ${obligor} shall maintain health insurance coverage for the minor child(ren) if available at a reasonable cost through employment or otherwise.`,
      type: 'order'
    });

    return {
      title: 'CHILD SUPPORT',
      items,
      type: 'child_support'
    };
  }

  /**
   * Generate Connecticut alimony section — "Alimony" (not maintenance)
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Alimony section
   */
  generateSpousalSupportSection(divorceData) {
    if (!divorceData.spousalSupportAwarded && !divorceData.spousalSupportWaived) {
      return null;
    }

    const items = [];

    if (divorceData.spousalSupportWaived) {
      items.push({
        content: 'IT IS ORDERED that each party waives and relinquishes any claim for alimony from the other party, now and forever.',
        type: 'order'
      });
    } else if (divorceData.spousalSupportAwarded) {
      const payor = divorceData.spousalSupportPayor || divorceData.respondentName || 'Defendant';
      const payee = divorceData.spousalSupportPayee || divorceData.petitionerName || 'Plaintiff';

      items.push({
        content: `The Court, having considered the factors set forth in Conn. Gen. Stat. §46b-82, orders alimony as follows:`,
        type: 'finding'
      });

      items.push({
        content: `IT IS ORDERED that ${payor} shall pay alimony to ${payee} in the amount of $${divorceData.spousalSupportAmount || '[AMOUNT]'} per month for a period of ${divorceData.spousalSupportDuration || '[DURATION]'}.`,
        type: 'order'
      });
    }

    return {
      title: 'ALIMONY',
      items,
      type: 'spousal_support'
    };
  }

  /**
   * Generate Connecticut judgment block
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Judgment block
   */
  generateJudgmentBlock(divorceData) {
    const districtName = divorceData.county || '[JUDICIAL DISTRICT]';
    return {
      text: `SO ORDERED this _____ day of _______________, 20___.



_________________________________
JUDGE, SUPERIOR COURT
JUDICIAL DISTRICT OF ${districtName.toUpperCase()}
STATE OF CONNECTICUT`,
      type: 'judgment'
    };
  }

  /**
   * Perform Connecticut-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('Judicial district is required for Connecticut Judgment of Dissolution of Marriage');
    }

    if (!divorceData.caseNumber) {
      errors.push('Docket number is required for Connecticut dissolution judgment');
    }

    warnings.push('Ensure 90 days have elapsed from the return date before entering the judgment. (Conn. Gen. Stat. §46b-67)');
    warnings.push('Connecticut courts may divide ALL property of either spouse, including separate property. (Conn. Gen. Stat. §46b-81)');

    if (divorceData.hasMinorChildren === true && (!divorceData.children || divorceData.children.length === 0)) {
      warnings.push('You indicated there are minor children but did not provide child information.');
    }

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('A completed Child Support Guidelines Worksheet must be attached per Conn. Gen. Stat. §46b-215a-1 et seq.');
      warnings.push('Custody and visitation orders must be established per Conn. Gen. Stat. §46b-56.');
    }

    return { errors, warnings };
  }
}

module.exports = ConnecticutDivorceDecreeTemplate;
