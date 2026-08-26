// templates/states/mississippi/DivorceDecreeTemplate.js
// Mississippi Final Judgment of Divorce template
// Complies with Miss. Code §93-5 (Divorce)

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');
const { resolveCustodyArrangement, resolvePrimaryResidenceName } = require('../../core/parenting');

/**
 * Mississippi Final Judgment of Divorce Template
 *
 * Legal References:
 * - Miss. Code §93-5 — Divorce
 * - Miss. Code §93-5-5 — Residency (6 months bona fide resident)
 * - Miss. Code §93-5-1 — Fault grounds
 * - Miss. Code §93-5-2 — No-fault ground (irreconcilable differences, 60-day waiting)
 * - Miss. Code §93-5-23 — Property division (equitable distribution); alimony
 * - Miss. Code §93-5-24 — Child custody (legal and physical custody, visitation)
 * - Miss. Code §43-19-101 et seq. — Child support guidelines (percentage of income)
 *
 * Mississippi-Specific Terms:
 * - "Final Judgment of Divorce" (not Decree of Divorce)
 * - "CAUSE NO." label
 * - "Legal Custody" / "Physical Custody"
 * - "Visitation"
 * - "Alimony" (periodic, lump-sum, rehabilitative)
 * - Dual classification: marital vs separate property
 * - CHANCERY COURT (unique to Mississippi for domestic matters)
 * - Parties: "Complainant" and "Defendant"
 */
class MississippiDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'MS';
    this.stateName = 'Mississippi';
    this.documentTitle = 'FINAL JUDGMENT OF DIVORCE';

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
   * Get Mississippi case number label
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'CAUSE NO.';
  }

  /**
   * Get default court for Mississippi county — Chancery Court
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `Chancery Court of ${countyName} County, Mississippi`;
  }

  /**
   * Generate Mississippi header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF MISSISSIPPI';
  }

  /**
   * Generate Mississippi venue — title case
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Generate Mississippi title
   * @returns {string} Title text
   */
  generateTitle() {
    return this.documentTitle;
  }

  /**
   * Get effective date text for Mississippi
   * @returns {string} Effective date text
   */
  getEffectiveDateText() {
    return 'the date this Final Judgment is entered by the Court';
  }

  /**
   * Generate Mississippi appearances section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Appearances section
   */
  generateAppearancesSection(divorceData) {
    let text = '';

    text += `This cause came on for hearing before the Court.\n\n`;

    if (divorceData.isUncontested || divorceData.appearanceType === 'agreed') {
      text += `Complainant, ${divorceData.petitionerName || '[COMPLAINANT NAME]'}, appeared ${divorceData.petitionerRepresentation === 'attorney' ? 'with counsel' : 'pro se (self-represented)'}.\n\n`;
      text += `Defendant, ${divorceData.respondentName || '[DEFENDANT NAME]'}, ${divorceData.respondentAppeared ? 'appeared and announced agreement' : 'having been duly served, did not appear'}.`;
    } else {
      text += `Complainant appeared ${divorceData.petitionerRepresentation === 'attorney' ? 'with counsel' : 'pro se'}.\n\n`;
      text += `Defendant ${divorceData.respondentAppeared ? 'appeared' : 'did not appear'}.`;
    }

    text += `\n\nThe Court, having considered the pleadings, evidence, and applicable law, enters the following Final Judgment:`;

    return {
      title: 'APPEARANCES',
      text,
      type: 'appearances'
    };
  }

  /**
   * Generate Mississippi jurisdiction section — 6-month bona fide residency
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Jurisdiction section
   */
  generateJurisdictionSection(divorceData) {
    const groundsText = divorceData.groundsForDivorce === 'irreconcilable_differences' || !divorceData.groundsForDivorce || divorceData.groundsForDivorce === 'no_fault'
      ? 'The parties have irreconcilable differences. At least sixty (60) days have elapsed since the date the complaint was filed. (Miss. Code §93-5-2)'
      : 'Sufficient grounds for divorce have been established.';

    return {
      title: 'JURISDICTION',
      text: `The Court finds that it has jurisdiction over this proceeding and the parties. At least one party has been a bona fide resident of the State of Mississippi for at least six (6) months preceding the filing of the complaint. (Miss. Code §93-5-5) The parties were married on ${this.formatDate(divorceData.marriageDate) || '[DATE]'}${divorceData.marriageLocation ? ` in ${divorceData.marriageLocation}` : ''}. ${groundsText}`,
      type: 'jurisdiction'
    };
  }

  /**
   * Generate Mississippi dissolution section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Dissolution section
   */
  generateDissolutionSection(divorceData) {
    return {
      title: 'FINAL JUDGMENT OF DIVORCE',
      text: `IT IS ORDERED, ADJUDGED, AND DECREED that the bonds of matrimony between ${divorceData.petitionerName || '[COMPLAINANT NAME]'} and ${divorceData.respondentName || '[DEFENDANT NAME]'} are hereby dissolved, and the parties are restored to the status of unmarried persons, effective ${this.getEffectiveDateText()}.`,
      type: 'dissolution'
    };
  }

  /**
   * Generate Mississippi property division — equitable distribution, dual classification
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    items.push({
      content: 'The Court has classified the property of the parties as marital or separate and, having considered the factors set forth in Miss. Code §93-5-23, orders the following equitable division of marital property:',
      type: 'finding'
    });

    if (divorceData.petitionerProperty && divorceData.petitionerProperty.length > 0) {
      items.push({
        content: `IT IS ORDERED that the following property is awarded to ${divorceData.petitionerName || 'Complainant'} as that party's sole and separate property:`,
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
   * Generate Mississippi child custody section — "Legal Custody" and "Physical Custody"
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Custody section
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court finds that the following custody arrangement is in the best interests of the child(ren) pursuant to Miss. Code §93-5-24:',
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
        content: `IT IS ORDERED that the parties shall share joint legal custody and joint physical custody of the minor child(ren). ${divorceData.primaryCustodian || divorceData.petitionerName || 'Complainant'} shall have primary physical custody.`,
        type: 'order'
      });
    } else if (custody.kind === 'sole_petitioner' || custody.kind === 'sole_respondent' || custody.kind === 'legacy_sole') {
      const custodianName =
        custody.kind === 'sole_petitioner'
          ? (divorceData.petitionerName || 'Complainant')
          : custody.kind === 'sole_respondent'
            ? (divorceData.respondentName || 'Defendant')
            : (divorceData.primaryCustodian || divorceData.petitionerName || 'Complainant');
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
      title: 'CUSTODY',
      items,
      type: 'custody'
    };
  }

  /**
   * Get Mississippi visitation language
   * @param {Object} divorceData - Divorce data
   * @returns {string} Visitation language
   */
  getVisitationLanguage(divorceData) {
    return `IT IS ORDERED that the non-custodial parent shall have visitation as agreed by the parties and approved by the Court, or as otherwise ordered by the Court.`;
  }

  /**
   * Generate Mississippi child support section
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Child support section
   */
  generateChildSupportSection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];
    const obligor = divorceData.childSupportObligor || divorceData.respondentName || 'Defendant';
    const obligee = divorceData.childSupportObligee || divorceData.petitionerName || 'Complainant';

    if (divorceData.childSupportAmount) {
      items.push({
        content: `IT IS ORDERED that ${obligor} shall pay child support to ${obligee} in the amount of $${divorceData.childSupportAmount} per month, calculated in accordance with the Mississippi Child Support Guidelines, Miss. Code §43-19-101 et seq.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that child support shall be paid in accordance with the Mississippi Child Support Guidelines, Miss. Code §43-19-101 et seq. The parties shall complete a Child Support Worksheet.`,
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
   * Generate Mississippi alimony section — "Alimony"
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
      const payee = divorceData.spousalSupportPayee || divorceData.petitionerName || 'Complainant';

      items.push({
        content: `The Court, having considered the factors set forth in Miss. Code §93-5-23, orders alimony as follows:`,
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
   * Generate Mississippi judgment block — Chancellor (Chancery Court)
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Judgment block
   */
  generateJudgmentBlock(divorceData) {
    return {
      text: `SO ORDERED this _____ day of _______________, 20___.



_________________________________
CHANCELLOR
${divorceData.county ? `CHANCERY COURT OF ${divorceData.county.toUpperCase()} COUNTY` : 'CHANCERY COURT OF [COUNTY] COUNTY'}
STATE OF MISSISSIPPI`,
      type: 'judgment'
    };
  }

  /**
   * Perform Mississippi-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for Mississippi Final Judgment of Divorce');
    }

    if (!divorceData.caseNumber) {
      errors.push('Cause number is required for Mississippi divorce judgment');
    }

    if (divorceData.groundsForDivorce === 'irreconcilable_differences' || !divorceData.groundsForDivorce || divorceData.groundsForDivorce === 'no_fault') {
      warnings.push('Ensure 60 days have elapsed from filing before entering the judgment (irreconcilable differences). (Miss. Code §93-5-2)');
    }

    if (divorceData.hasMinorChildren === true && (!divorceData.children || divorceData.children.length === 0)) {
      warnings.push('You indicated there are minor children but did not provide child information.');
    }

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('A completed Child Support Worksheet must be attached per Miss. Code §43-19-101 et seq.');
      warnings.push('Custody and visitation must be established per Miss. Code §93-5-24.');
    }

    return { errors, warnings };
  }
}

module.exports = MississippiDivorceDecreeTemplate;
