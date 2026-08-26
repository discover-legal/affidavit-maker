// templates/states/west_virginia/DivorceDecreeTemplate.js
// West Virginia Final Divorce Order template
// Complies with W. Va. Code §48-5-101 et seq. (Divorce)

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');
const { resolveCustodyArrangement, resolvePrimaryResidenceName } = require('../../core/parenting');

/**
 * West Virginia Final Divorce Order Template
 *
 * Legal References:
 * - W. Va. Code §48-5-101 et seq. — Divorce
 * - W. Va. Code §48-5-105 — Residency (1 year; or no min if married in WV)
 * - W. Va. Code §48-5-201 — Grounds (fault and no-fault)
 * - W. Va. Code §48-7-101 et seq. — Equitable distribution of marital property
 * - W. Va. Code §48-6-301 et seq. — Spousal support
 * - W. Va. Code §48-9-101 et seq. — Child custody (allocation of custodial responsibility)
 * - W. Va. Code §48-13-101 et seq. — Child support guidelines
 *
 * West Virginia-Specific Terms:
 * - "Final Divorce Order" (not Decree of Divorce)
 * - "CIVIL ACTION NO." label
 * - "Legal Custody" / "Physical Custody" / "Primary Residential Parent"
 * - "Custodial Responsibility" / "Parenting Time"
 * - "Spousal Support" (not alimony)
 * - Equitable distribution of marital property
 * - Family Court
 */
class WestVirginiaDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'WV';
    this.stateName = 'West Virginia';
    this.documentTitle = 'FINAL DIVORCE ORDER';

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
   * Get West Virginia case number label
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'CIVIL ACTION NO.';
  }

  /**
   * Get default court for West Virginia county — Family Court
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `Family Court of ${countyName} County, West Virginia`;
  }

  /**
   * Generate West Virginia header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF WEST VIRGINIA';
  }

  /**
   * Generate West Virginia venue — title case
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Generate West Virginia title
   * @returns {string} Title text
   */
  generateTitle() {
    return this.documentTitle;
  }

  /**
   * Get effective date text for West Virginia
   * @returns {string} Effective date text
   */
  getEffectiveDateText() {
    return 'the date this Final Divorce Order is entered by the Court';
  }

  /**
   * Generate West Virginia appearances section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Appearances section
   */
  generateAppearancesSection(divorceData) {
    let text = '';

    text += `This matter came before the Court for hearing.\n\n`;

    if (divorceData.isUncontested || divorceData.appearanceType === 'agreed') {
      text += `Petitioner, ${divorceData.petitionerName || '[PETITIONER NAME]'}, appeared ${divorceData.petitionerRepresentation === 'attorney' ? 'with counsel' : 'pro se (self-represented)'}.\n\n`;
      text += `Respondent, ${divorceData.respondentName || '[RESPONDENT NAME]'}, ${divorceData.respondentAppeared ? 'appeared and announced agreement' : 'having been duly served, did not appear'}.`;
    } else {
      text += `Petitioner appeared ${divorceData.petitionerRepresentation === 'attorney' ? 'with counsel' : 'pro se'}.\n\n`;
      text += `Respondent ${divorceData.respondentAppeared ? 'appeared' : 'did not appear'}.`;
    }

    text += `\n\nThe Court, having considered the evidence and applicable law, enters the following Order:`;

    return {
      title: 'APPEARANCES',
      text,
      type: 'appearances'
    };
  }

  /**
   * Generate West Virginia jurisdiction section — 1-year state residency
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Jurisdiction section
   */
  generateJurisdictionSection(divorceData) {
    const groundsText = divorceData.groundsForDivorce === 'voluntary_separation'
      ? 'The parties have lived separate and apart without cohabitation for one year or more. (W. Va. Code §48-5-201(a)(8))'
      : 'Irreconcilable differences exist between the parties. (W. Va. Code §48-5-201)';

    return {
      title: 'JURISDICTION',
      text: `The Court finds that it has jurisdiction over this proceeding and the parties. At least one party has been an actual bona fide resident of the State of West Virginia for at least one (1) year immediately preceding the filing of the petition. (W. Va. Code §48-5-105) The parties were married on ${this.formatDate(divorceData.marriageDate) || '[DATE]'}${divorceData.marriageLocation ? ` in ${divorceData.marriageLocation}` : ''}. ${groundsText}`,
      type: 'jurisdiction'
    };
  }

  /**
   * Generate West Virginia dissolution section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Dissolution section
   */
  generateDissolutionSection(divorceData) {
    return {
      title: 'DIVORCE GRANTED',
      text: `IT IS ORDERED, ADJUDGED, AND DECREED that the marriage of ${divorceData.petitionerName || '[PETITIONER NAME]'} and ${divorceData.respondentName || '[RESPONDENT NAME]'} is hereby dissolved, and the parties are restored to the status of unmarried persons, effective ${this.getEffectiveDateText()}.`,
      type: 'dissolution'
    };
  }

  /**
   * Generate West Virginia property division — equitable distribution
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    items.push({
      content: 'The Court has considered the factors set forth in W. Va. Code §48-7-101 et seq. and orders the following equitable distribution of marital property:',
      type: 'finding'
    });

    if (divorceData.petitionerProperty && divorceData.petitionerProperty.length > 0) {
      items.push({
        content: `IT IS ORDERED that the following property is awarded to ${divorceData.petitionerName || 'Petitioner'} as that party's sole and separate property:`,
        type: 'order'
      });
      divorceData.petitionerProperty.forEach(prop => {
        items.push({ content: `- ${prop}`, type: 'property_item' });
      });
    }

    if (divorceData.respondentProperty && divorceData.respondentProperty.length > 0) {
      items.push({
        content: `IT IS ORDERED that the following property is awarded to ${divorceData.respondentName || 'Respondent'} as that party's sole and separate property:`,
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
   * Generate West Virginia child custody section — "Legal Custody" / "Physical Custody" / "Custodial Responsibility"
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Custody section
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court finds that the following allocation of custodial responsibility is in the best interests of the child(ren) pursuant to W. Va. Code §48-9-101 et seq.:',
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
        content: `IT IS ORDERED that the parties shall share joint legal custody of the minor child(ren). ${divorceData.primaryCustodian || divorceData.petitionerName || 'Petitioner'} shall be designated as the primary residential parent.`,
        type: 'order'
      });
    } else if (custody.kind === 'sole_petitioner' || custody.kind === 'sole_respondent' || custody.kind === 'legacy_sole') {
      const custodianName =
        custody.kind === 'sole_petitioner'
          ? (divorceData.petitionerName || 'Petitioner')
          : custody.kind === 'sole_respondent'
            ? (divorceData.respondentName || 'Respondent')
            : (divorceData.primaryCustodian || divorceData.petitionerName || 'Petitioner');
      soleCustodianName = custodianName;
      items.push({
        content: `IT IS ORDERED that ${custodianName} shall have sole legal and physical custody of the minor child(ren).`,
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

    items.push({
      content: this.getVisitationLanguage(divorceData),
      type: 'order'
    });

    return {
      title: 'ALLOCATION OF CUSTODIAL RESPONSIBILITY',
      items,
      type: 'custody'
    };
  }

  /**
   * Get West Virginia parenting time language
   * @param {Object} divorceData - Divorce data
   * @returns {string} Parenting time language
   */
  getVisitationLanguage(divorceData) {
    return `IT IS ORDERED that the non-residential parent shall have parenting time as agreed by the parties or as otherwise ordered by the Court.`;
  }

  /**
   * Generate West Virginia child support section
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Child support section
   */
  generateChildSupportSection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];
    const obligor = divorceData.childSupportObligor || divorceData.respondentName || 'Respondent';
    const obligee = divorceData.childSupportObligee || divorceData.petitionerName || 'Petitioner';

    if (divorceData.childSupportAmount) {
      items.push({
        content: `IT IS ORDERED that ${obligor} shall pay child support to ${obligee} in the amount of $${divorceData.childSupportAmount} per month, calculated in accordance with the West Virginia Child Support Guidelines, W. Va. Code §48-13-101 et seq.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that child support shall be paid in accordance with the West Virginia Child Support Guidelines, W. Va. Code §48-13-101 et seq. The parties shall complete a Child Support Calculation Worksheet.`,
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
   * Generate West Virginia spousal support section — "Spousal Support"
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Spousal support section
   */
  generateSpousalSupportSection(divorceData) {
    if (!divorceData.spousalSupportAwarded && !divorceData.spousalSupportWaived) {
      return null;
    }

    const items = [];

    if (divorceData.spousalSupportWaived) {
      items.push({
        content: 'IT IS ORDERED that each party waives and relinquishes any claim for spousal support from the other party, now and forever.',
        type: 'order'
      });
    } else if (divorceData.spousalSupportAwarded) {
      const payor = divorceData.spousalSupportPayor || divorceData.respondentName || 'Respondent';
      const payee = divorceData.spousalSupportPayee || divorceData.petitionerName || 'Petitioner';

      items.push({
        content: `The Court, having considered the factors set forth in W. Va. Code §48-6-301 et seq., orders spousal support as follows:`,
        type: 'finding'
      });

      items.push({
        content: `IT IS ORDERED that ${payor} shall pay spousal support to ${payee} in the amount of $${divorceData.spousalSupportAmount || '[AMOUNT]'} per month for a period of ${divorceData.spousalSupportDuration || '[DURATION]'}.`,
        type: 'order'
      });
    }

    return {
      title: 'SPOUSAL SUPPORT',
      items,
      type: 'spousal_support'
    };
  }

  /**
   * Generate West Virginia judgment block
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Judgment block
   */
  generateJudgmentBlock(divorceData) {
    return {
      text: `SO ORDERED this _____ day of _______________, 20___.



_________________________________
JUDGE
${divorceData.county ? `FAMILY COURT OF ${divorceData.county.toUpperCase()} COUNTY` : 'FAMILY COURT OF [COUNTY] COUNTY'}
STATE OF WEST VIRGINIA`,
      type: 'judgment'
    };
  }

  /**
   * Perform West Virginia-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for West Virginia Final Divorce Order');
    }

    if (!divorceData.caseNumber) {
      errors.push('Civil action number is required for West Virginia divorce order');
    }

    if (divorceData.hasMinorChildren === true && (!divorceData.children || divorceData.children.length === 0)) {
      warnings.push('You indicated there are minor children but did not provide child information.');
    }

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('A completed Child Support Calculation Worksheet must be attached per W. Va. Code §48-13-101 et seq.');
      warnings.push('A parenting plan detailing allocation of custodial responsibility must be incorporated into the order.');
    }

    return { errors, warnings };
  }
}

module.exports = WestVirginiaDivorceDecreeTemplate;
