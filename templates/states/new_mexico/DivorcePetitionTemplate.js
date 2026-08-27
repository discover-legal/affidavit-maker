// templates/states/new_mexico/DivorcePetitionTemplate.js
// New Mexico Petition for Dissolution of Marriage template
// Complies with NMSA §40-4 (Dissolution of Marriage)

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * New Mexico Petition for Dissolution of Marriage Template
 *
 * Legal References:
 * - NMSA §40-4 — Dissolution of Marriage
 * - NMSA §40-4-5 — Residency requirement (6 months domicile in NM)
 * - NMSA §40-4-1 — Grounds for dissolution (incompatibility, cruel treatment, adultery, abandonment)
 * - NMSA §40-4-7 — Community property division and spousal support
 * - NMSA §40-4-9 — Child custody (legal and physical custody)
 * - NMSA §40-4-9.1 — Joint custody presumption, parenting plan, timesharing/visitation
 * - NMSA §40-4-11.1 — New Mexico Child Support Guidelines (income shares)
 *
 * New Mexico-Specific Notes:
 * - Called "Dissolution of Marriage" — NOT divorce
 * - Both fault and no-fault — "incompatibility" is most common ground
 * - Fault grounds: cruel and inhuman treatment, adultery, abandonment
 * - 6-month domicile residency requirement (no county requirement)
 * - No mandatory waiting period (respondent's answer window is 30 days, Rule 1-012(A) NMRA)
 * - "Legal Custody" and "Physical Custody" (standard terminology)
 * - "Timesharing" / "Visitation" (per NMSA §40-4-9.1)
 * - Joint custody presumed to be in best interests
 * - Parenting plan REQUIRED when joint custody is ordered
 * - "Spousal Support" (not alimony or maintenance)
 * - Community property — equal 50/50 division
 * - Filed in District Court
 * - Case number label: "No."
 */
class NewMexicoDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'NM';
    this.stateName = 'New Mexico';
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

    // New Mexico — 6 months domicile
    this.residencyRequirements = {
      stateMonths: 6,
      countyMonths: 0,
      description: 'At least one party must have been domiciled in New Mexico for at least six (6) months immediately preceding the filing of this Petition. (NMSA §40-4-5)'
    };

    // New Mexico has no mandatory waiting period between filing and decree;
    // the 30 days is only the respondent's answer window (Rule 1-012(A) NMRA).
    this.waitingPeriod = {
      days: 0,
      startsFrom: null,
      exceptions: [],
      description: 'No mandatory waiting period between filing and final decree. A respondent has 30 days after service to answer (Rule 1-012(A) NMRA); default decrees become available only after that window runs.'
    };
  }

  /**
   * Get New Mexico case number label — "No."
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'No.';
  }

  /**
   * Get default court for New Mexico county — District Court
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `District Court, County of ${countyName}, State of New Mexico`;
  }

  /**
   * Generate New Mexico header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF NEW MEXICO';
  }

  /**
   * Generate New Mexico venue — uppercase per New Mexico practice
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    return `COUNTY OF ${countyName.toUpperCase()}`;
  }

  /**
   * Get New Mexico jurisdiction statement — 6-month domicile
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    return `Petitioner has been domiciled in the State of New Mexico for at least six (6) months immediately preceding the filing of this Petition. (NMSA §40-4-5)`;
  }

  /**
   * Get New Mexico venue reason
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    return `Petitioner or Respondent resides in ${divorceData.county || '[COUNTY]'} County, New Mexico`;
  }

  /**
   * Generate New Mexico grounds section — incompatibility (primary) plus fault grounds
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Grounds section
   */
  generateGroundsSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 8;

    const grounds = divorceData.groundsForDivorce || 'incompatibility';

    if (grounds === 'incompatibility' || grounds === 'no_fault') {
      items.push({
        number: paragraphNum++,
        content: 'The parties are incompatible due to discord or conflict of personalities that destroys the legitimate ends of the marriage relationship and prevents any reasonable expectation of reconciliation. (NMSA §40-4-1(A))',
        type: 'grounds'
      });
    } else if (grounds === 'cruel_inhuman_treatment') {
      items.push({
        number: paragraphNum++,
        content: 'Respondent has been guilty of cruel and inhuman treatment toward Petitioner. (NMSA §40-4-1(B))',
        type: 'grounds'
      });
    } else if (grounds === 'adultery') {
      items.push({
        number: paragraphNum++,
        content: 'Respondent has committed adultery. (NMSA §40-4-1(C))',
        type: 'grounds'
      });
    } else if (grounds === 'abandonment') {
      items.push({
        number: paragraphNum++,
        content: 'Respondent has abandoned Petitioner. (NMSA §40-4-1(D))',
        type: 'grounds'
      });
    } else {
      items.push({
        number: paragraphNum++,
        content: 'The parties are incompatible due to discord or conflict of personalities that destroys the legitimate ends of the marriage relationship and prevents any reasonable expectation of reconciliation. (NMSA §40-4-1(A))',
        type: 'grounds'
      });
    }

    return {
      title: 'IV. GROUNDS FOR DISSOLUTION',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate New Mexico children section — uses "legal custody" and "physical custody";
   * joint custody presumed (NMSA §40-4-9.1); parenting plan REQUIRED
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
        content: 'Petitioner requests the Court to determine legal custody and physical custody of the minor child(ren) in the best interests of the child(ren) pursuant to NMSA §40-4-9. Joint custody is presumed to be in the best interests of the child(ren) under NMSA §40-4-9.1. A parenting plan, including a timesharing schedule, is required when joint custody is ordered.',
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
   * Generate New Mexico property section — community property, equal 50/50 division
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
      content: 'The parties have accumulated community property and community debts during the marriage. Petitioner requests that the Court divide the community property and community debts equally pursuant to NMSA §40-4-7.',
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: 'Any separate property of either party — property acquired before the marriage, or during the marriage by gift, bequest, or inheritance — should be confirmed to the owning spouse as that party\'s sole and separate property.',
      type: 'property_info'
    });

    return {
      title: 'VI. COMMUNITY PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate New Mexico relief section — uses New Mexico-specific terminology
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
      'Enter a Final Decree of Dissolution of Marriage;',
      'Divide the community property and community debts equally pursuant to NMSA §40-4-7;',
      'Confirm each party\'s separate property to the owning spouse;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Award joint custody of the minor child(ren) and approve a parenting plan including a timesharing schedule pursuant to NMSA §40-4-9.1;');
      reliefItems.push('Order child support in accordance with the New Mexico Child Support Guidelines, NMSA §40-4-11.1;');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award spousal support to Petitioner pursuant to NMSA §40-4-7;');
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
   * Get New Mexico verification text
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PETITIONER NAME]';
    return `I, ${name}, declare under penalty of perjury under the laws of the State of New Mexico that the facts stated in this Petition are true and correct to the best of my knowledge and belief.

Date: ___________________

_________________________________
${name}
Petitioner`;
  }

  /**
   * Perform New Mexico-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for New Mexico dissolution petitions');
    }

    warnings.push('New Mexico requires 6 months domicile before filing. (NMSA §40-4-5)');
    warnings.push('The respondent has 30 days after service to answer (Rule 1-012(A) NMRA); a default decree is only available after that window runs.');
    warnings.push('New Mexico is a community property state — property acquired during marriage is divided equally. (NMSA §40-4-7)');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('Joint custody is presumed to be in the best interests of the child(ren). (NMSA §40-4-9.1)');
      warnings.push('A parenting plan is required when joint custody is ordered. (NMSA §40-4-9.1)');
      warnings.push('Child support must be calculated using the New Mexico Child Support Guidelines (NMSA §40-4-11.1).');
    }

    return { errors, warnings };
  }
}

module.exports = NewMexicoDivorcePetitionTemplate;
