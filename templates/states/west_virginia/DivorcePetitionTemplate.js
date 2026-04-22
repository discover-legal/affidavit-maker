// templates/states/west_virginia/DivorcePetitionTemplate.js
// West Virginia Petition for Divorce template
// Complies with W. Va. Code §48-5-101 et seq. (Divorce)

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * West Virginia Petition for Divorce Template
 *
 * Legal References:
 * - W. Va. Code §48-5-101 et seq. — Divorce
 * - W. Va. Code §48-5-105 — Residency requirement (1 year; or no min if married in WV)
 * - W. Va. Code §48-5-201 — Grounds for divorce (fault and no-fault)
 * - W. Va. Code §48-7-101 et seq. — Equitable distribution of marital property
 * - W. Va. Code §48-6-301 et seq. — Spousal support
 * - W. Va. Code §48-9-101 et seq. — Child custody (allocation of custodial responsibility)
 * - W. Va. Code §48-13-101 et seq. — Child support guidelines
 *
 * West Virginia-Specific Notes:
 * - Both fault and no-fault grounds
 * - No-fault: irreconcilable differences (requires consent or 1-year separation)
 * - Fault: adultery, felony conviction, cruel treatment, desertion (6 months),
 *   habitual drunkenness/drugs, abuse/neglect of child, voluntary separation (1 year)
 * - 1-year state residency (no minimum if married in WV)
 * - No mandatory post-filing waiting period
 * - "Legal Custody" and "Physical Custody" / "Primary Residential Parent"
 * - "Custodial Responsibility" or "Parenting Time"
 * - "Spousal Support" (not alimony)
 * - Equitable distribution of marital property
 * - Filed in Family Court
 * - Case number label: "CIVIL ACTION NO."
 * - Parties: "Petitioner" and "Respondent"
 */
class WestVirginiaDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'WV';
    this.stateName = 'West Virginia';
    this.documentTitle = 'PETITION FOR DIVORCE';

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

    // West Virginia — 1 year state residency (or no min if married in WV)
    this.residencyRequirements = {
      stateMonths: 12,
      countyMonths: 0,
      description: 'At least one party must have been an actual bona fide resident of West Virginia for one year. If the parties were married in West Virginia and one party still resides there, no minimum residency duration is required. (W. Va. Code §48-5-105)'
    };

    // West Virginia — no mandatory post-filing waiting period
    this.waitingPeriod = {
      days: 0,
      startsFrom: 'not_applicable',
      exceptions: [],
      description: 'West Virginia has no mandatory post-filing waiting period. However, for no-fault divorce based on irreconcilable differences, both parties must consent or the parties must have been separated for one year prior to filing. (W. Va. Code §48-5-201)'
    };
  }

  /**
   * Get West Virginia case number label — "CIVIL ACTION NO."
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
   * Generate West Virginia venue — title case per West Virginia practice
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Get West Virginia jurisdiction statement — 1-year state residency
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    return `Petitioner has been an actual bona fide resident of the State of West Virginia for at least one (1) year immediately preceding the filing of this Petition. (W. Va. Code §48-5-105)`;
  }

  /**
   * Get West Virginia venue reason
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    return `Petitioner or Respondent resides in ${divorceData.county || '[COUNTY]'} County, West Virginia`;
  }

  /**
   * Generate West Virginia grounds section — fault and no-fault
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Grounds section
   */
  generateGroundsSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 8;

    const grounds = divorceData.groundsForDivorce || 'irreconcilable_differences';

    if (grounds === 'irreconcilable_differences' || grounds === 'no_fault') {
      items.push({
        number: paragraphNum++,
        content: 'Irreconcilable differences exist between the parties which have caused the irretrievable breakdown of the marriage. (W. Va. Code §48-5-201)',
        type: 'grounds'
      });
    } else if (grounds === 'voluntary_separation') {
      items.push({
        number: paragraphNum++,
        content: 'The parties have lived separate and apart without cohabitation for a period of one (1) year or more. (W. Va. Code §48-5-201(a)(8))',
        type: 'grounds'
      });
    } else if (grounds === 'adultery') {
      items.push({
        number: paragraphNum++,
        content: 'Respondent has committed adultery. (W. Va. Code §48-5-201(a)(1))',
        type: 'grounds'
      });
    } else if (grounds === 'felony_conviction') {
      items.push({
        number: paragraphNum++,
        content: 'Respondent has been convicted of a felony or infamous offense subsequent to the marriage. (W. Va. Code §48-5-201(a)(2))',
        type: 'grounds'
      });
    } else if (grounds === 'cruel_treatment') {
      items.push({
        number: paragraphNum++,
        content: 'Respondent has engaged in cruel or inhuman treatment that has endangered the life or health of Petitioner. (W. Va. Code §48-5-201(a)(3))',
        type: 'grounds'
      });
    } else if (grounds === 'desertion') {
      items.push({
        number: paragraphNum++,
        content: 'Respondent has deserted Petitioner for a period of six (6) months. (W. Va. Code §48-5-201(a)(4))',
        type: 'grounds'
      });
    } else if (grounds === 'habitual_drunkenness') {
      items.push({
        number: paragraphNum++,
        content: 'Respondent is habitually drunk or addicted to drugs. (W. Va. Code §48-5-201(a)(5))',
        type: 'grounds'
      });
    } else if (grounds === 'abuse_neglect_child') {
      items.push({
        number: paragraphNum++,
        content: 'Respondent has engaged in abuse or neglect of a child of the parties. (W. Va. Code §48-5-201(a)(6))',
        type: 'grounds'
      });
    } else {
      items.push({
        number: paragraphNum++,
        content: 'Irreconcilable differences exist between the parties which have caused the irretrievable breakdown of the marriage. (W. Va. Code §48-5-201)',
        type: 'grounds'
      });
    }

    return {
      title: 'IV. GROUNDS FOR DIVORCE',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate West Virginia children section — uses "legal custody" and "physical custody"
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
            : `${child.name || '[CHILD NAME]'}, born ${this.formatDate(child.birthDate) || '[BIRTH DATE]'}`;
          items.push({
            number: paragraphNum++,
            content: `Child ${index + 1}: ${childInfo}`,
            type: 'child_detail'
          });
        });
      }

      items.push({
        number: paragraphNum++,
        content: 'Petitioner requests the Court to allocate custodial responsibility for the minor child(ren) in the best interests of the child(ren) pursuant to W. Va. Code §48-9-101 et seq., and to establish a parenting time schedule.',
        type: 'children_info'
      });
    }

    return {
      title: 'V. CHILDREN',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate West Virginia property section — equitable distribution
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property section
   */
  generatePropertySection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 12;

    items.push({
      number: paragraphNum++,
      content: 'The parties have accumulated marital property and debts during the marriage. Petitioner requests that the Court divide the marital property and debts equitably pursuant to W. Va. Code §48-7-101 et seq.',
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: 'Petitioner requests the Court to consider the length of the marriage, the contributions of each spouse (including homemaking), the income and earning capacity of each party, and any other relevant factors in making an equitable distribution.',
      type: 'property_info'
    });

    return {
      title: 'VI. PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate West Virginia relief section — uses West Virginia-specific terminology
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
      'Enter a Final Divorce Order dissolving the marriage of the parties;',
      'Divide the marital property and debts equitably pursuant to W. Va. Code §48-7-101 et seq.;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Allocate custodial responsibility for the minor child(ren) in the best interests of the child(ren) pursuant to W. Va. Code §48-9-101 et seq.;');
      reliefItems.push('Establish a parenting time schedule;');
      reliefItems.push('Order child support in accordance with the West Virginia Child Support Guidelines, W. Va. Code §48-13-101 et seq.;');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award spousal support to Petitioner pursuant to W. Va. Code §48-6-301 et seq.;');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`Restore Petitioner's former name to: ${divorceData.previousName};`);
    }

    reliefItems.push('Grant such other and further relief as the Court deems just and equitable.');

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
   * Get West Virginia verification text
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PETITIONER NAME]';
    return `I, ${name}, declare under penalty of perjury under the laws of the State of West Virginia that the facts stated in this Petition are true and correct to the best of my knowledge and belief.

Date: ___________________

_________________________________
${name}
Petitioner`;
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
      errors.push('County is required for West Virginia divorce petitions');
    }

    warnings.push('West Virginia requires 1 year of state residency before filing (no minimum if married in WV). (W. Va. Code §48-5-105)');
    warnings.push('For no-fault divorce, both parties must consent to irreconcilable differences or have been separated for 1 year. (W. Va. Code §48-5-201)');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('A parenting plan must be filed with the court detailing allocation of custodial responsibility.');
      warnings.push('Child support must be calculated using the West Virginia Child Support Guidelines (W. Va. Code §48-13-101 et seq.).');
    }

    return { errors, warnings };
  }
}

module.exports = WestVirginiaDivorcePetitionTemplate;
