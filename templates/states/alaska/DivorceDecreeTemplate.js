// templates/states/alaska/DivorceDecreeTemplate.js
// Alaska Decree of Divorce template
// Complies with AS 25.24 (Divorce and Dissolution)

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');

/**
 * Alaska Decree of Divorce Template
 *
 * Legal References:
 * - AS 25.24 — Divorce and Dissolution
 * - AS 25.24.090 — Residency (domicile); 30-day waiting period after service
 * - AS 25.24.050 — Grounds (fault and no-fault)
 * - AS 25.24.160 — Property division (equitable distribution); alimony
 * - AS 25.20.060 — Custody and visitation (shared custody)
 * - Civil Rule 90.3 — Alaska Child Support Guidelines
 * - AS 22.10 — Superior Court jurisdiction
 *
 * Alaska-Specific Terms:
 * - "Decree of Divorce" (not Decree of Dissolution)
 * - "CASE NO." label
 * - "Legal Custody" / "Physical Custody"
 * - "Visitation" (AS 25.20.060)
 * - "Alimony" (AS 25.24.160)
 * - Equitable distribution — fair and just division
 * - Superior Court
 * - Parties: "Plaintiff" and "Defendant"
 */
class AlaskaDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'AK';
    this.stateName = 'Alaska';
    this.documentTitle = 'DECREE OF DIVORCE';

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
   * Get Alaska case number label
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'CASE NO.';
  }

  /**
   * Get default court for Alaska — Superior Court
   * @param {string} county - Judicial district name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[JUDICIAL DISTRICT]';
    return `Superior Court for the State of Alaska, ${countyName} Judicial District`;
  }

  /**
   * Generate Alaska header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF ALASKA';
  }

  /**
   * Generate Alaska venue — title case
   * @param {string} county - Judicial district name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[JUDICIAL DISTRICT]';
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `${countyFormatted} Judicial District`;
  }

  /**
   * Generate Alaska title
   * @returns {string} Title text
   */
  generateTitle() {
    return this.documentTitle;
  }

  /**
   * Get effective date text for Alaska
   * @returns {string} Effective date text
   */
  getEffectiveDateText() {
    return 'the date this Decree is entered by the Court';
  }

  /**
   * Generate Alaska appearances section
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

    text += `\n\nThe Court, having considered the evidence and applicable law, enters the following Decree:`;

    return {
      title: 'APPEARANCES',
      text,
      type: 'appearances'
    };
  }

  /**
   * Generate Alaska jurisdiction section — domicile required
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Jurisdiction section
   */
  generateJurisdictionSection(divorceData) {
    return {
      title: 'JURISDICTION',
      text: `The Court finds that it has jurisdiction over this proceeding and the parties. The Plaintiff is domiciled in the State of Alaska, ${divorceData.county || '[JUDICIAL DISTRICT]'} Judicial District. (AS 25.24.090) The parties were married on ${this.formatDate(divorceData.marriageDate) || '[DATE]'}${divorceData.marriageLocation ? ` in ${divorceData.marriageLocation}` : ''}. There exists an incompatibility of temperament between the parties. At least thirty (30) days have elapsed since service of process on the Defendant. (AS 25.24.090)`,
      type: 'jurisdiction'
    };
  }

  /**
   * Generate Alaska dissolution section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Dissolution section
   */
  generateDissolutionSection(divorceData) {
    return {
      title: 'DECREE OF DIVORCE',
      text: `IT IS ORDERED, ADJUDGED, AND DECREED that the marriage of ${divorceData.petitionerName || '[PLAINTIFF NAME]'} and ${divorceData.respondentName || '[DEFENDANT NAME]'} is hereby dissolved, and the parties are restored to the status of unmarried persons, effective ${this.getEffectiveDateText()}.`,
      type: 'dissolution'
    };
  }

  /**
   * Generate Alaska property division — equitable distribution
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    items.push({
      content: 'The Court has considered the factors set forth in AS 25.24.160 and orders the following fair and just division of marital property:',
      type: 'finding'
    });

    if (divorceData.petitionerProperty && divorceData.petitionerProperty.length > 0) {
      items.push({
        content: `IT IS ORDERED that the following property is awarded to ${divorceData.petitionerName || 'Plaintiff'} as that party's sole and separate property:`,
        type: 'order'
      });
      divorceData.petitionerProperty.forEach(prop => {
        items.push({ content: `- ${prop}`, type: 'property_item' });
      });
    }

    if (divorceData.respondentProperty && divorceData.respondentProperty.length > 0) {
      items.push({
        content: `IT IS ORDERED that the following property is awarded to ${divorceData.respondentName || 'Defendant'} as that party's sole and separate property:`,
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

    return {
      title: 'DIVISION OF PROPERTY',
      items,
      type: 'property'
    };
  }

  /**
   * Generate Alaska child custody section — "Legal Custody" and "Physical Custody"
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Custody section
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court finds that the following custody arrangement is in the best interests of the child(ren) pursuant to AS 25.20.060:',
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
   * Get Alaska visitation language
   * @param {Object} divorceData - Divorce data
   * @returns {string} Visitation language
   */
  getVisitationLanguage(divorceData) {
    return `IT IS ORDERED that the non-custodial parent shall have reasonable visitation with the minor child(ren) as agreed by the parties, or as otherwise ordered by the Court pursuant to AS 25.20.060.`;
  }

  /**
   * Generate Alaska child support section
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
        content: `IT IS ORDERED that ${obligor} shall pay child support to ${obligee} in the amount of $${divorceData.childSupportAmount} per month, calculated in accordance with the Alaska Child Support Guidelines, Civil Rule 90.3.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that child support shall be paid in accordance with the Alaska Child Support Guidelines, Civil Rule 90.3. The parties shall complete a Child Support Guidelines Affidavit (DR-306).`,
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
   * Generate Alaska alimony section — "Alimony"
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
        content: `The Court, having considered the factors set forth in AS 25.24.160, orders alimony as follows:`,
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
   * Generate Alaska judgment block
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Judgment block
   */
  generateJudgmentBlock(divorceData) {
    return {
      text: `SO ORDERED this _____ day of _______________, 20___.



_________________________________
JUDGE
SUPERIOR COURT FOR THE STATE OF ALASKA
${divorceData.county ? `${divorceData.county.toUpperCase()} JUDICIAL DISTRICT` : '[JUDICIAL DISTRICT]'}`,
      type: 'judgment'
    };
  }

  /**
   * Perform Alaska-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('Judicial district is required for Alaska Decree of Divorce');
    }

    if (!divorceData.caseNumber) {
      errors.push('Case number is required for Alaska divorce decree');
    }

    warnings.push('Ensure 30 days have elapsed from service before entering the decree. (AS 25.24.090)');

    if (divorceData.hasMinorChildren === true && (!divorceData.children || divorceData.children.length === 0)) {
      warnings.push('You indicated there are minor children but did not provide child information.');
    }

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('A Child Support Guidelines Affidavit (DR-306) must be completed per Civil Rule 90.3.');
      warnings.push('Custody and visitation must be established per AS 25.20.060.');
    }

    return { errors, warnings };
  }
}

module.exports = AlaskaDivorceDecreeTemplate;
