// templates/states/wisconsin/DivorceDecreeTemplate.js
// Wisconsin Judgment of Divorce template
// Complies with Wis. Stat. Chapter 767 (Actions Affecting the Family)

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');
const { resolveCustodyArrangement, resolvePrimaryResidenceName } = require('../../core/parenting');

/**
 * Wisconsin Judgment of Divorce Template
 *
 * Legal References:
 * - Wis. Stat. Chapter 767 — Actions Affecting the Family
 * - Wis. Stat. §767.301 — Residency (6 months state, 30 days county)
 * - Wis. Stat. §767.315 — Grounds (irretrievable breakdown — no-fault only)
 * - Wis. Stat. §767.335 — 120-day waiting period from service or joint filing
 * - Wis. Stat. §767.61 — Property division (community property, equal presumption)
 * - Wis. Stat. §767.56 — Maintenance
 * - Wis. Stat. §767.41 — Legal custody and physical placement
 * - Wis. Stat. §767.511 — Child support (percentage of income)
 *
 * Wisconsin-Specific Terms:
 * - "Judgment of Divorce" (NOT Decree of Dissolution)
 * - "CASE NO." label
 * - "Legal Custody" / "Physical Placement" (NOT physical custody)
 * - "Periods of Physical Placement" (NOT parenting time or visitation)
 * - "Maintenance" (NOT alimony)
 * - Community property with presumption of equal division
 * - Circuit Court
 */
class WisconsinDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'WI';
    this.stateName = 'Wisconsin';
    this.documentTitle = 'JUDGMENT OF DIVORCE';

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
   * Get Wisconsin case number label
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'CASE NO.';
  }

  /**
   * Get default court for Wisconsin county — Circuit Court
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `${countyName} County Circuit Court, State of Wisconsin`;
  }

  /**
   * Generate Wisconsin header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF WISCONSIN';
  }

  /**
   * Generate Wisconsin venue — title case
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Generate Wisconsin title
   * @returns {string} Title text
   */
  generateTitle() {
    return this.documentTitle;
  }

  /**
   * Get effective date text for Wisconsin
   * @returns {string} Effective date text
   */
  getEffectiveDateText() {
    return 'the date this Judgment is entered by the Court';
  }

  /**
   * Generate Wisconsin appearances section
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

    text += `\n\nThe Court, having considered the evidence and applicable law, enters the following Judgment:`;

    return {
      title: 'APPEARANCES',
      text,
      type: 'appearances'
    };
  }

  /**
   * Generate Wisconsin jurisdiction section — 6-month state, 30-day county
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Jurisdiction section
   */
  generateJurisdictionSection(divorceData) {
    return {
      title: 'JURISDICTION',
      text: `The Court finds that it has jurisdiction over this proceeding and the parties. At least one party has been a resident of Wisconsin for at least six (6) months and a resident of ${divorceData.county || '[COUNTY]'} County for at least thirty (30) days preceding the filing of the petition. (Wis. Stat. §767.301) The parties were married on ${this.formatDate(divorceData.marriageDate) || '[DATE]'}${divorceData.marriageLocation ? ` in ${divorceData.marriageLocation}` : ''}. The marriage is irretrievably broken. (Wis. Stat. §767.315) At least one hundred twenty (120) days have elapsed since service of the summons and petition. (Wis. Stat. §767.335)`,
      type: 'jurisdiction'
    };
  }

  /**
   * Generate Wisconsin dissolution section — "Judgment of Divorce"
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Dissolution section
   */
  generateDissolutionSection(divorceData) {
    return {
      title: 'JUDGMENT OF DIVORCE',
      text: `IT IS ORDERED, ADJUDGED, AND DECREED that the marriage of ${divorceData.petitionerName || '[PETITIONER NAME]'} and ${divorceData.respondentName || '[RESPONDENT NAME]'} is hereby dissolved, and the parties are restored to the status of unmarried persons, effective ${this.getEffectiveDateText()}.`,
      type: 'dissolution'
    };
  }

  /**
   * Generate Wisconsin property division — community property with equal presumption
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    items.push({
      content: 'The Court has considered the factors set forth in Wis. Stat. §767.61 and, applying the presumption of an equal division of marital property, orders the following division:',
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
   * Generate Wisconsin child custody section — "Legal Custody" and "Physical Placement"
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Custody section
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court finds that the following custody and placement arrangement is in the best interests of the child(ren) pursuant to Wis. Stat. §767.41:',
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
        content: `IT IS ORDERED that the parties shall share joint legal custody of the minor child(ren). ${divorceData.primaryCustodian || divorceData.petitionerName || 'Petitioner'} shall have primary physical placement.`,
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
        content: `IT IS ORDERED that ${custodianName} shall have sole legal custody and primary physical placement of the minor child(ren).`,
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
      title: 'LEGAL CUSTODY AND PHYSICAL PLACEMENT',
      items,
      type: 'custody'
    };
  }

  /**
   * Get Wisconsin physical placement language
   * @param {Object} divorceData - Divorce data
   * @returns {string} Physical placement language
   */
  getVisitationLanguage(divorceData) {
    return `IT IS ORDERED that the non-primary-placement parent shall have periods of physical placement as set forth in the attached placement schedule, or as otherwise agreed by the parties and approved by the Court, pursuant to Wis. Stat. §767.41.`;
  }

  /**
   * Generate Wisconsin child support section — percentage of income
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
        content: `IT IS ORDERED that ${obligor} shall pay child support to ${obligee} in the amount of $${divorceData.childSupportAmount} per month, calculated in accordance with the Wisconsin Child Support percentage of income standard, Wis. Stat. §767.511.`,
        type: 'order'
      });
    } else {
      const numChildren = divorceData.children ? divorceData.children.length : 1;
      const percentages = { 1: '17%', 2: '25%', 3: '29%', 4: '31%' };
      const pct = percentages[numChildren] || '34%';
      items.push({
        content: `IT IS ORDERED that child support shall be paid in accordance with the Wisconsin percentage of income standard (Wis. Stat. §767.511). The standard percentage for ${numChildren} child${numChildren > 1 ? 'ren' : ''} is ${pct} of the paying parent's gross income. The parties shall complete a Child Support Worksheet.`,
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
   * Generate Wisconsin maintenance section — "Maintenance" not "Alimony"
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
        content: 'IT IS ORDERED that each party waives and relinquishes any claim for maintenance from the other party, now and forever.',
        type: 'order'
      });
    } else if (divorceData.spousalSupportAwarded) {
      const payor = divorceData.spousalSupportPayor || divorceData.respondentName || 'Respondent';
      const payee = divorceData.spousalSupportPayee || divorceData.petitionerName || 'Petitioner';

      items.push({
        content: `The Court, having considered the factors set forth in Wis. Stat. §767.56, including the length of the marriage, the age and health of the parties, the division of property, the educational level and earning capacity of each party, and other relevant factors, orders maintenance as follows:`,
        type: 'finding'
      });

      items.push({
        content: `IT IS ORDERED that ${payor} shall pay maintenance to ${payee} in the amount of $${divorceData.spousalSupportAmount || '[AMOUNT]'} per month for a period of ${divorceData.spousalSupportDuration || '[DURATION]'}.`,
        type: 'order'
      });
    }

    return {
      title: 'MAINTENANCE',
      items,
      type: 'spousal_support'
    };
  }

  /**
   * Generate Wisconsin judgment block
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Judgment block
   */
  generateJudgmentBlock(divorceData) {
    return {
      text: `SO ORDERED this _____ day of _______________, 20___.



_________________________________
JUDGE
${divorceData.county ? `${divorceData.county.toUpperCase()} COUNTY CIRCUIT COURT` : '[COUNTY] COUNTY CIRCUIT COURT'}
STATE OF WISCONSIN`,
      type: 'judgment'
    };
  }

  /**
   * Perform Wisconsin-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for Wisconsin Judgment of Divorce');
    }

    if (!divorceData.caseNumber) {
      errors.push('Case number is required for Wisconsin Judgment of Divorce');
    }

    warnings.push('Ensure 120 days have elapsed from service of the summons and petition (or filing of a joint petition) before entering the Judgment. (Wis. Stat. §767.335)');

    if (divorceData.hasMinorChildren === true && (!divorceData.children || divorceData.children.length === 0)) {
      warnings.push('You indicated there are minor children but did not provide child information.');
    }

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('A completed Child Support Worksheet must be attached per Wis. Stat. §767.511.');
      warnings.push('A physical placement schedule must be established per Wis. Stat. §767.41.');
    }

    return { errors, warnings };
  }
}

module.exports = WisconsinDivorceDecreeTemplate;
