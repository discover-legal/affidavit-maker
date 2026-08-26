// templates/states/oregon/DivorceDecreeTemplate.js
// Oregon Judgment of Dissolution of Marriage template
// Complies with ORS Chapter 107 (Dissolution of Marriage)

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');
const { resolveCustodyArrangement, resolvePrimaryResidenceName } = require('../../core/parenting');

/**
 * Oregon Judgment of Dissolution of Marriage Template
 *
 * Legal References:
 * - ORS Chapter 107 — Dissolution of Marriage
 * - ORS §107.075 — Residency (conditional on where marriage was solemnized)
 * - ORS §107.025 — Grounds (irreconcilable differences only — purely no-fault)
 * - ORS §107.105(1)(f) — Property division (equitable, rebuttable presumption of equal contribution)
 * - ORS §107.105(1)(d) — Spousal support (transitional, compensatory, maintenance)
 * - ORS §107.169 — Custody (joint requires both parents' agreement)
 * - ORS §107.102 — Parenting plan required
 * - ORS §25.275 — Oregon Child Support Guidelines
 *
 * Oregon-Specific Terms:
 * - "Judgment of Dissolution of Marriage" (Oregon uses "Judgment" not "Decree")
 * - "CASE NO." label
 * - "Custody" for legal decision-making
 * - "Parenting Time" (with required parenting plan)
 * - "Spousal Support" (transitional, compensatory, maintenance)
 * - Equitable distribution with rebuttable presumption of equal contribution
 * - Circuit Court
 * - No waiting period
 */
class OregonDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'OR';
    this.stateName = 'Oregon';
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
   * Get Oregon case number label
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'CASE NO.';
  }

  /**
   * Get default court for Oregon county — Circuit Court
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `Circuit Court of the State of Oregon for the County of ${countyName}`;
  }

  /**
   * Generate Oregon header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'IN THE CIRCUIT COURT OF THE STATE OF OREGON';
  }

  /**
   * Generate Oregon venue — uppercase
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    return `FOR THE COUNTY OF ${countyName.toUpperCase()}`;
  }

  /**
   * Generate Oregon title
   * @returns {string} Title text
   */
  generateTitle() {
    return this.documentTitle;
  }

  /**
   * Get effective date text for Oregon
   * @returns {string} Effective date text
   */
  getEffectiveDateText() {
    return 'the date this Judgment is signed by the Court';
  }

  /**
   * Generate Oregon appearances section
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
   * Generate Oregon jurisdiction section — conditional residency, no waiting period
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Jurisdiction section
   */
  generateJurisdictionSection(divorceData) {
    let residencyText;
    if (divorceData.marriedInOregon === true) {
      residencyText = `The parties were married in Oregon. At least one party is a resident of the State of Oregon. (ORS §107.075)`;
    } else {
      residencyText = `At least one party has been a continuous resident of the State of Oregon for at least six (6) months preceding the filing of the petition. (ORS §107.075)`;
    }

    return {
      title: 'JURISDICTION',
      text: `The Court finds that it has jurisdiction over this proceeding and the parties. ${residencyText} The parties were married on ${this.formatDate(divorceData.marriageDate) || '[DATE]'}${divorceData.marriageLocation ? ` in ${divorceData.marriageLocation}` : ''}. Irreconcilable differences have caused the irremediable breakdown of the marriage. (ORS §107.025)`,
      type: 'jurisdiction'
    };
  }

  /**
   * Generate Oregon dissolution section — "Judgment of Dissolution"
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Dissolution section
   */
  generateDissolutionSection(divorceData) {
    return {
      title: 'JUDGMENT OF DISSOLUTION',
      text: `IT IS ORDERED AND ADJUDGED that the marriage of ${divorceData.petitionerName || '[PETITIONER NAME]'} and ${divorceData.respondentName || '[RESPONDENT NAME]'} is hereby dissolved, and the parties are restored to the status of unmarried persons, effective ${this.getEffectiveDateText()}.`,
      type: 'dissolution'
    };
  }

  /**
   * Generate Oregon property division — equitable distribution with rebuttable presumption of equal contribution
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    items.push({
      content: 'The Court has considered the factors set forth in ORS §107.105(1)(f) and, applying the rebuttable presumption that both spouses contributed equally to the acquisition of property during the marriage, orders the following division:',
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
   * Generate Oregon child custody section — "Custody" and "Parenting Time" with parenting plan
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Custody section
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court finds that the following custody arrangement is in the best interests of the child(ren):',
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
    // Historically this template defaulted to a sole order when no custody
    // type was stored — exactly the unsafe fall-through this refactor removes.
    // Absent data now renders the neutral as-agreed placeholder instead.
    const custodyKind = custody.explicit ? custody.kind : 'unspecified';
    let soleCustodianName = null;

    if (custodyKind === 'joint') {
      items.push({
        content: `IT IS ORDERED that the parties shall share joint custody of the minor child(ren) pursuant to ORS §107.169, both parties having agreed to joint custody. ${divorceData.primaryCustodian || divorceData.petitionerName || 'Petitioner'} shall be the primary residential parent.`,
        type: 'order'
      });
    } else if (custodyKind === 'sole_petitioner' || custodyKind === 'sole_respondent' || custodyKind === 'legacy_sole') {
      const custodianName =
        custodyKind === 'sole_petitioner'
          ? (divorceData.petitionerName || 'Petitioner')
          : custodyKind === 'sole_respondent'
            ? (divorceData.respondentName || 'Respondent')
            : (divorceData.primaryCustodian || divorceData.petitionerName || 'Petitioner');
      soleCustodianName = custodianName;
      items.push({
        content: `IT IS ORDERED that ${custodianName} shall have sole custody of the minor child(ren).`,
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
    if (custodyKind !== 'joint' && residenceName && residenceName !== soleCustodianName) {
      items.push({
        content: `IT IS ORDERED that the child(ren) shall primarily reside with ${residenceName}.`,
        type: 'order'
      });
    }

    items.push({
      content: this.getVisitationLanguage(divorceData),
      type: 'order'
    });

    items.push({
      content: 'The parenting plan filed with the Court is incorporated by reference into this Judgment pursuant to ORS §107.102.',
      type: 'order'
    });

    return {
      title: 'CUSTODY AND PARENTING TIME',
      items,
      type: 'custody'
    };
  }

  /**
   * Get Oregon parenting time language
   * @param {Object} divorceData - Divorce data
   * @returns {string} Parenting time language
   */
  getVisitationLanguage(divorceData) {
    return `IT IS ORDERED that the non-custodial parent shall have parenting time as set forth in the parenting plan filed with and approved by the Court, or as otherwise agreed by the parties and approved by the Court.`;
  }

  /**
   * Generate Oregon child support section
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
        content: `IT IS ORDERED that ${obligor} shall pay child support to ${obligee} in the amount of $${divorceData.childSupportAmount} per month, calculated in accordance with the Oregon Child Support Guidelines, ORS §25.275.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that child support shall be paid in accordance with the Oregon Child Support Guidelines, ORS §25.275. The parties shall complete the Oregon Child Support Worksheets.`,
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
   * Generate Oregon spousal support section — "Spousal Support" with 3 types
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

      const supportType = divorceData.spousalSupportType || 'spousal maintenance';

      items.push({
        content: `The Court, having considered the factors set forth in ORS §107.105(1)(d), orders ${supportType} as follows:`,
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
   * Generate Oregon judgment block — "JUDGE, CIRCUIT COURT"
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Judgment block
   */
  generateJudgmentBlock(divorceData) {
    return {
      text: `SO ORDERED this _____ day of _______________, 20___.



_________________________________
JUDGE, CIRCUIT COURT
${divorceData.county ? `${divorceData.county.toUpperCase()} COUNTY` : '[COUNTY] COUNTY'}
STATE OF OREGON`,
      type: 'judgment'
    };
  }

  /**
   * Perform Oregon-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for Oregon Judgment of Dissolution of Marriage');
    }

    if (!divorceData.caseNumber) {
      errors.push('Case number is required for Oregon dissolution judgment');
    }

    warnings.push('Oregon has no waiting period. The judgment may be entered as soon as the court is ready.');

    if (divorceData.hasMinorChildren === true && (!divorceData.children || divorceData.children.length === 0)) {
      warnings.push('You indicated there are minor children but did not provide child information.');
    }

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('A parenting plan is required and must be filed with the judgment per ORS §107.102.');
      warnings.push('Child support must be calculated using the Oregon Child Support Guidelines (ORS §25.275).');
      // Matches the render gate: absent custodyType renders the neutral
      // placeholder (never Oregon's historical sole default), so the joint
      // warning fires only for an explicitly recognized joint arrangement.
      const custody = resolveCustodyArrangement(divorceData);
      if (custody.explicit && custody.kind === 'joint') {
        warnings.push('Joint custody in Oregon requires the agreement of both parents. (ORS §107.169)');
      }
    }

    return { errors, warnings };
  }
}

module.exports = OregonDivorceDecreeTemplate;
