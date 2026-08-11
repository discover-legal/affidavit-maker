// templates/states/idaho/DivorceDecreeTemplate.js
// Idaho Judgment and Decree of Divorce template
// Complies with Idaho Code §32-601 et seq. (Divorce)

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');

/**
 * Idaho Judgment and Decree of Divorce Template
 *
 * Legal References:
 * - Idaho Code §32-601 et seq. — Divorce
 * - Idaho Code §32-701 — Residency (6 full weeks)
 * - Idaho Code §32-603 — Grounds (irreconcilable differences, fault, separation)
 * - Idaho Code §32-716 — 21-day waiting period after service
 * - Idaho Code §32-712 — Community property division (substantially equal)
 * - Idaho Code §32-705 — Spousal maintenance
 * - Idaho Code §32-717B — Joint custody
 * - Idaho Code §32-717 — Custody (best interest standard)
 * - Idaho Code §32-706 — Child support guidelines (income shares)
 *
 * Idaho-Specific Terms:
 * - "Judgment and Decree of Divorce" (not Final Decree)
 * - "CASE NO." label
 * - "Plaintiff" / "Defendant" (not Petitioner/Respondent)
 * - "Legal Custody" / "Physical Custody"
 * - "Visitation" (not Parenting Time)
 * - "Spousal Maintenance" (not alimony)
 * - Community property — substantially equal division
 * - District Court
 */
class IdahoDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'ID';
    this.stateName = 'Idaho';
    this.documentTitle = 'JUDGMENT AND DECREE OF DIVORCE';

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
   * Get Idaho case number label
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'CASE NO.';
  }

  /**
   * Get default court for Idaho county — District Court
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `District Court of the State of Idaho, in and for the County of ${countyName}`;
  }

  /**
   * Generate Idaho header — full District Court header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'IN THE DISTRICT COURT OF THE _____ JUDICIAL DISTRICT OF THE STATE OF IDAHO';
  }

  /**
   * Generate Idaho venue — uppercase
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    return `IN AND FOR THE COUNTY OF ${countyName.toUpperCase()}`;
  }

  /**
   * Generate Idaho title
   * @returns {string} Title text
   */
  generateTitle() {
    return this.documentTitle;
  }

  /**
   * Get effective date text for Idaho
   * @returns {string} Effective date text
   */
  getEffectiveDateText() {
    return 'the date this Judgment and Decree is entered by the Court';
  }

  /**
   * Generate Idaho appearances section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Appearances section
   */
  generateAppearancesSection(divorceData) {
    let text = '';

    text += `This matter came before the Court for hearing.\n\n`;

    if (divorceData.isUncontested || divorceData.appearanceType === 'agreed') {
      text += `Plaintiff, ${divorceData.petitionerName || '[PLAINTIFF NAME]'}, appeared ${divorceData.petitionerRepresentation === 'attorney' ? 'with counsel' : 'pro se (self-represented)'}.\n\n`;
      text += `Defendant, ${divorceData.respondentName || '[DEFENDANT NAME]'}, ${divorceData.respondentAppeared ? 'appeared and announced agreement' : 'having been duly served, did not appear'}.`;
    } else {
      text += `Plaintiff appeared ${divorceData.petitionerRepresentation === 'attorney' ? 'with counsel' : 'pro se'}.\n\n`;
      text += `Defendant ${divorceData.respondentAppeared ? 'appeared' : 'did not appear'}.`;
    }

    text += `\n\nThe Court, having considered the evidence and applicable law, enters the following Judgment and Decree:`;

    return {
      title: 'APPEARANCES',
      text,
      type: 'appearances'
    };
  }

  /**
   * Generate Idaho jurisdiction section — 6-week residency
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Jurisdiction section
   */
  generateJurisdictionSection(divorceData) {
    return {
      title: 'JURISDICTION',
      text: `The Court finds that it has jurisdiction over this proceeding and the parties. Plaintiff has been a bona fide resident of the State of Idaho for a full six (6) weeks immediately preceding the filing of the Complaint. (Idaho Code §32-701) The parties were married on ${this.formatDate(divorceData.marriageDate) || '[DATE]'}${divorceData.marriageLocation ? ` in ${divorceData.marriageLocation}` : ''}. Irreconcilable differences have caused the irremediable breakdown of the marriage. At least twenty-one (21) days have elapsed since service of the summons and complaint on Defendant. (Idaho Code §32-716)`,
      type: 'jurisdiction'
    };
  }

  /**
   * Generate Idaho dissolution section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Dissolution section
   */
  generateDissolutionSection(divorceData) {
    return {
      title: 'JUDGMENT AND DECREE OF DIVORCE',
      text: `IT IS HEREBY ORDERED, ADJUDGED, AND DECREED that the marriage of ${divorceData.petitionerName || '[PLAINTIFF NAME]'} and ${divorceData.respondentName || '[DEFENDANT NAME]'} is hereby dissolved, and the parties are restored to the status of unmarried persons, effective ${this.getEffectiveDateText()}.`,
      type: 'dissolution'
    };
  }

  /**
   * Generate Idaho property division — community property with substantially equal division
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    items.push({
      content: 'The Court has considered the factors set forth in Idaho Code §32-712 and orders the following substantially equal division of the community property and community debts:',
      type: 'finding'
    });

    if (divorceData.petitionerProperty && divorceData.petitionerProperty.length > 0) {
      items.push({
        content: `IT IS ORDERED that the following community property is awarded to ${divorceData.petitionerName || 'Plaintiff'} as that party's sole and separate property:`,
        type: 'order'
      });
      divorceData.petitionerProperty.forEach(prop => {
        items.push({ content: `- ${prop}`, type: 'property_item' });
      });
    }

    if (divorceData.respondentProperty && divorceData.respondentProperty.length > 0) {
      items.push({
        content: `IT IS ORDERED that the following community property is awarded to ${divorceData.respondentName || 'Defendant'} as that party's sole and separate property:`,
        type: 'order'
      });
      divorceData.respondentProperty.forEach(prop => {
        items.push({ content: `- ${prop}`, type: 'property_item' });
      });
    }

    if (!divorceData.petitionerProperty && !divorceData.respondentProperty) {
      items.push({
        content: `IT IS ORDERED that each party is awarded the personal property currently in that party's possession as that party's sole and separate property.`,
        type: 'order'
      });
    }

    items.push({
      content: 'IT IS FURTHER ORDERED that the separate property of each party is confirmed to that party.',
      type: 'order'
    });

    return {
      title: 'DIVISION OF COMMUNITY PROPERTY',
      items,
      type: 'property'
    };
  }

  /**
   * Generate Idaho child custody section — "Legal Custody" and "Physical Custody"
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Custody section
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court finds that the following custody arrangement is in the best interests of the child(ren) pursuant to Idaho Code §32-717:',
      type: 'finding'
    });

    items.push({
      content: 'The minor child(ren) of this marriage:',
      type: 'order'
    });

    divorceData.children.forEach((child, index) => {
      const childInfo = typeof child === 'string'
        ? child
        : `${child.name || '[CHILD NAME]'}, born ${this.formatDate(child.birthDate ?? child.dob ?? child.dateOfBirth) || '[BIRTH DATE]'}`;
      items.push({
        content: `${index + 1}. ${childInfo}`,
        type: 'child_item'
      });
    });

    const custodyType = divorceData.custodyType || 'joint';

    if (custodyType === 'joint') {
      items.push({
        content: `IT IS ORDERED that the parties shall share joint legal custody and joint physical custody of the minor child(ren) pursuant to Idaho Code §32-717B. ${divorceData.primaryCustodian || divorceData.petitionerName || 'Plaintiff'} shall have primary physical custody.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that ${divorceData.primaryCustodian || divorceData.petitionerName || 'Plaintiff'} shall have sole legal and physical custody of the minor child(ren).`,
        type: 'order'
      });
    }

    items.push({
      content: this.getVisitationLanguage(divorceData),
      type: 'order'
    });

    return {
      title: 'CUSTODY',
      items,
      type: 'custody'
    };
  }

  /**
   * Get Idaho visitation language
   * @param {Object} divorceData - Divorce data
   * @returns {string} Visitation language
   */
  getVisitationLanguage(divorceData) {
    return `IT IS ORDERED that the noncustodial parent shall have reasonable visitation with the minor child(ren), or as otherwise agreed by the parties and approved by the Court.`;
  }

  /**
   * Generate Idaho child support section
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
        content: `IT IS ORDERED that ${obligor} shall pay child support to ${obligee} in the amount of $${divorceData.childSupportAmount} per month, calculated in accordance with the Idaho Child Support Guidelines, Idaho Code §32-706.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that child support shall be paid in accordance with the Idaho Child Support Guidelines, Idaho Code §32-706. The parties shall complete a Child Support Worksheet.`,
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
   * Generate Idaho spousal maintenance section — "Maintenance" not "Alimony"
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Maintenance section
   */
  generateSpousalSupportSection(divorceData) {
    if (!divorceData.spousalSupportAwarded && !divorceData.spousalSupportWaived) {
      return null;
    }

    const items = [];

    if (divorceData.spousalSupportWaived) {
      items.push({
        content: 'IT IS ORDERED that each party waives and relinquishes any claim for spousal maintenance from the other party, now and forever.',
        type: 'order'
      });
    } else if (divorceData.spousalSupportAwarded) {
      const payor = divorceData.spousalSupportPayor || divorceData.respondentName || 'Defendant';
      const payee = divorceData.spousalSupportPayee || divorceData.petitionerName || 'Plaintiff';

      items.push({
        content: `The Court, having considered the factors set forth in Idaho Code §32-705, orders spousal maintenance as follows:`,
        type: 'finding'
      });

      items.push({
        content: `IT IS ORDERED that ${payor} shall pay spousal maintenance to ${payee} in the amount of $${divorceData.spousalSupportAmount || '[AMOUNT]'} per month for a period of ${divorceData.spousalSupportDuration || '[DURATION]'}.`,
        type: 'order'
      });
    }

    return {
      title: 'SPOUSAL MAINTENANCE',
      items,
      type: 'spousal_support'
    };
  }

  /**
   * Generate Idaho judgment block
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Judgment block
   */
  generateJudgmentBlock(divorceData) {
    return {
      text: `SO ORDERED this _____ day of _______________, 20___.



_________________________________
JUDGE, DISTRICT COURT
${divorceData.county ? `${divorceData.county.toUpperCase()} COUNTY` : '[COUNTY] COUNTY'}
STATE OF IDAHO`,
      type: 'judgment'
    };
  }

  /**
   * Perform Idaho-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for Idaho Judgment and Decree of Divorce');
    }

    if (!divorceData.caseNumber) {
      errors.push('Case number is required for Idaho divorce decree');
    }

    warnings.push('Ensure 21 days have elapsed from service before entering the decree. (Idaho Code §32-716)');

    if (divorceData.hasMinorChildren === true && (!divorceData.children || divorceData.children.length === 0)) {
      warnings.push('You indicated there are minor children but did not provide child information.');
    }

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('A completed Child Support Worksheet must be attached per Idaho Code §32-706.');
      warnings.push('Custody must be determined in the best interests of the child(ren) per Idaho Code §32-717.');
    }

    return { errors, warnings };
  }
}

module.exports = IdahoDivorceDecreeTemplate;
