// templates/states/oregon/DivorcePetitionTemplate.js
// Oregon Petition for Dissolution of Marriage template
// Complies with ORS Chapter 107 (Dissolution of Marriage)

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Oregon Petition for Dissolution of Marriage Template
 *
 * Legal References:
 * - ORS Chapter 107 — Dissolution of Marriage
 * - ORS §107.075 — Residency requirement (conditional on where marriage was solemnized)
 * - ORS §107.025 — Grounds for dissolution (irreconcilable differences only)
 * - ORS §107.105(1)(f) — Property division (equitable, rebuttable presumption of equal contribution)
 * - ORS §107.105(1)(d) — Spousal support (transitional, compensatory, maintenance)
 * - ORS §107.169 — Joint custody (requires both parents' agreement)
 * - ORS §107.102 — Parenting plan required
 * - ORS §25.275 — Oregon Child Support Guidelines
 *
 * Oregon-Specific Notes:
 * - Called "Dissolution of Marriage" — NOT divorce
 * - Final order is "Judgment" — NOT decree
 * - Purely no-fault — irreconcilable differences only (ORS §107.025)
 * - NO waiting period (repealed 2011)
 * - Residency is conditional: married in OR = no minimum; married outside OR = 6 months
 * - "Custody" for legal decision-making (ORS §107.169)
 * - "Parenting Time" for visitation schedule (ORS §107.102)
 * - "Spousal Support" — 3 types: transitional, compensatory, maintenance
 * - Equitable distribution with rebuttable presumption of equal contribution
 * - Filed in Circuit Court
 * - Case number label: "CASE NO."
 * - Parties: "Petitioner" and "Respondent" (or "Co-Petitioners" if joint)
 */
class OregonDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'OR';
    this.stateName = 'Oregon';
    this.documentTitle = 'PETITION FOR DISSOLUTION OF MARRIAGE';

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
      'marriageDate',
      'groundsForDivorce'
    ];

    // Oregon residency — conditional on where marriage was solemnized
    this.residencyRequirements = {
      marriedInOregon: {
        stateMonths: 0,
        description: 'If the marriage was solemnized in Oregon, at least one party must be a resident of Oregon at the time of filing. No minimum duration is required.'
      },
      marriedOutsideOregon: {
        stateMonths: 6,
        description: 'If the marriage was not solemnized in Oregon, at least one party must have been a resident of Oregon continuously for at least 6 months immediately preceding the filing.'
      },
      statute: 'ORS §107.075'
    };

    // Oregon has NO waiting period — repealed in 2011
    this.waitingPeriod = {
      days: 0,
      startsFrom: null,
      exceptions: [],
      description: 'Oregon has no mandatory waiting period. The 90-day waiting period was repealed in 2011. A dissolution can be finalized as soon as the court is ready to enter judgment.'
    };
  }

  /**
   * Get Oregon case number label — "CASE NO."
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
   * Generate Oregon venue — "FOR THE COUNTY OF [County]"
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    return `FOR THE COUNTY OF ${countyName.toUpperCase()}`;
  }

  /**
   * Get Oregon jurisdiction statement — conditional residency
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    const marriedInOregon = divorceData.marriedInOregon;
    if (marriedInOregon === true) {
      return `The parties were married in Oregon. Petitioner is a resident of the State of Oregon and of ${divorceData.county || '[COUNTY]'} County at the time of filing this Petition. This Court has jurisdiction pursuant to ORS §107.075.`;
    }
    return `Petitioner has been a continuous resident of the State of Oregon for at least six (6) months immediately preceding the filing of this Petition and resides in ${divorceData.county || '[COUNTY]'} County. This Court has jurisdiction pursuant to ORS §107.075.`;
  }

  /**
   * Get Oregon venue reason
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    return `Petitioner or Respondent resides in ${divorceData.county || '[COUNTY]'} County, Oregon`;
  }

  /**
   * Generate Oregon grounds section — irreconcilable differences only (purely no-fault)
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Grounds section
   */
  generateGroundsSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 8;

    items.push({
      number: paragraphNum++,
      content: 'Irreconcilable differences have caused the irremediable breakdown of the marriage between Petitioner and Respondent. (ORS §107.025)',
      type: 'grounds'
    });

    return {
      title: 'IV. GROUNDS FOR DISSOLUTION',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Oregon children section — uses "Custody" and "Parenting Time";
   * parenting plan required (ORS §107.102)
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Children section
   */
  generateChildrenSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 9;

    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      items.push({
        number: paragraphNum++,
        content: 'There are no children born of or adopted during this marriage, and none are expected.',
        type: 'children_info'
      });
    } else {
      items.push({
        number: paragraphNum++,
        content: 'The following children were born of or adopted during this marriage:',
        type: 'children_info'
      });

      if (divorceData.children && divorceData.children.length > 0) {
        divorceData.children.forEach((child, index) => {
          const childInfo = typeof child === 'string'
            ? child
            : `${child.name || '[CHILD NAME]'}, born ${this.formatDate(child.birthDate ?? child.dob ?? child.dateOfBirth) || '[BIRTH DATE]'}`;
          items.push({
            number: paragraphNum++,
            content: `Child ${index + 1}: ${childInfo}`,
            type: 'child_detail'
          });
        });
      }

      items.push({
        number: paragraphNum++,
        content: 'Petitioner requests the Court to determine custody of the minor child(ren) in the best interests of the child(ren) pursuant to ORS §107.169, and to establish a parenting time schedule. A parenting plan detailing minimum parenting time is required pursuant to ORS §107.102.',
        type: 'children_info'
      });
    }

    // Agreed child arrangements (custody enum, primary residence, agreed
    // support) — pleaded via the base hooks, never silently dropped.
    paragraphNum = this.appendAgreedChildArrangementPleadings(items, paragraphNum, divorceData);

    return {
      title: 'V. CHILDREN',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Oregon property section — equitable distribution with rebuttable presumption of equal contribution
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property section
   */
  generatePropertySection(divorceData) {
    // An agreed division (or an explicit no-property case) pleads the
    // parties' actual agreement via the base hooks instead of the
    // generic boilerplate.
    if (divorceData.hasProperty === false || this.hasAgreedPropertyDivision(divorceData)) {
      return super.generatePropertySection(divorceData);
    }

    const items = [];
    let paragraphNum = divorceData._paragraphNum || 12;

    items.push({
      number: paragraphNum++,
      content: 'The parties have accumulated marital property and debts during the marriage. Petitioner requests that the Court divide the marital property and debts in a manner that is just and proper in all the circumstances pursuant to ORS §107.105(1)(f), which provides a rebuttable presumption that both spouses contributed equally to the acquisition of property during the marriage.',
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: 'Petitioner requests the Court to consider all relevant factors in making an equitable division, including the duration of the marriage, the contribution of each spouse to the marital estate, whether property was acquired before the marriage, any tax consequences of the division, and the economic circumstances of each spouse.',
      type: 'property_info'
    });

    return {
      title: 'VI. PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Oregon relief section — uses Oregon-specific terminology
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Relief section
   */
  generateReliefSection(divorceData) {
    const items = [];

    items.push({
      number: null,
      content: 'WHEREFORE, Petitioner requests that the Court:',
      type: 'relief_intro'
    });

    const reliefItems = [
      'Enter a Judgment of Dissolution of Marriage;',
      'Equitably divide the marital property and debts in a just and proper manner pursuant to ORS §107.105(1)(f);'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Award custody of the minor child(ren) in the best interests of the child(ren) pursuant to ORS §107.169;');
      reliefItems.push('Establish a parenting time schedule and approve a parenting plan pursuant to ORS §107.102;');
      reliefItems.push('Order child support in accordance with the Oregon Child Support Guidelines, ORS §25.275;');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award spousal support to Petitioner pursuant to ORS §107.105(1)(d);');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`Restore Petitioner's former name to: ${divorceData.previousName};`);
    }

    reliefItems.push('Grant such other and further relief as the Court deems just and proper.');

    // Agreed corollary relief (agreed support amount, spousal-support

    // waiver, property agreement) — spliced before the final general prayer.

    this.appendAgreedReliefItems(reliefItems, divorceData);


    reliefItems.forEach((relief, index) => {
      const letter = String.fromCharCode(97 + index);
      items.push({
        number: null,
        content: relief,
        type: 'relief_item',
        style: 'letter',
        letter
      });
    });

    return {
      title: 'VII. RELIEF REQUESTED',
      items,
      nextParagraphNumber: null
    };
  }

  /**
   * Get Oregon verification text
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PETITIONER NAME]';
    return `I, ${name}, declare under penalty of perjury under the laws of the State of Oregon that the facts stated in this Petition are true and correct to the best of my knowledge and belief.

Date: ___________________

_________________________________
${name}
Petitioner`;
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
      errors.push('County is required for Oregon dissolution petitions');
    }

    if (divorceData.marriedInOregon === true) {
      warnings.push('If married in Oregon, at least one spouse must be an Oregon resident at time of filing. (ORS §107.075)');
    } else {
      warnings.push('If married outside Oregon, at least one spouse must have lived in Oregon continuously for 6 months before filing. (ORS §107.075)');
    }

    warnings.push('Oregon has no waiting period. The dissolution can be finalized as soon as the court is ready.');
    warnings.push('Oregon divides marital property equitably with a rebuttable presumption of equal contribution. (ORS §107.105(1)(f))');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('A parenting plan is required pursuant to ORS §107.102.');
      warnings.push('Child support must be calculated using the Oregon Child Support Guidelines (ORS §25.275).');
    }

    return { errors, warnings };
  }
}

module.exports = OregonDivorcePetitionTemplate;
