// templates/states/south_dakota/DivorcePetitionTemplate.js
// South Dakota Complaint for Divorce template
// Complies with SDCL Chapter 25-4 (Divorce)

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * South Dakota Complaint for Divorce Template
 *
 * Legal References:
 * - SDCL §25-4 — Divorce
 * - SDCL §25-4-30 — Residency (resident at time of filing)
 * - SDCL §25-4-2 — Fault grounds for divorce
 * - SDCL §25-4-17.1 — Irreconcilable differences (no-fault)
 * - SDCL §25-4-44 — Property division (equitable distribution)
 * - SDCL §25-4-41 — Alimony
 * - SDCL §25-4A — Joint custody; legal and physical custody
 * - SDCL §25-4A-11 — Visitation
 * - SDCL §25-7-6.2 — South Dakota Child Support Guidelines
 *
 * South Dakota-Specific Notes:
 * - Called "Divorce" — complaint titled "Complaint for Divorce"
 * - Resident at time of filing; no minimum duration if events occurred in SD
 * - 60-day waiting period from service (SDCL §25-4-34)
 * - No-fault: "irreconcilable differences"
 * - Fault: adultery, extreme cruelty, willful desertion, willful neglect,
 *   habitual intemperance, felony conviction
 * - "Legal Custody" / "Physical Custody"; joint custody (SDCL §25-4A)
 * - "Visitation" (SDCL §25-4A-11)
 * - "Alimony" (SDCL §25-4-41)
 * - Equitable distribution — all property subject to division
 * - Filed in Circuit Court
 * - Case number label: "CIV. NO."
 * - Parties: "Plaintiff" and "Defendant"
 */
class SouthDakotaDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'SD';
    this.stateName = 'South Dakota';
    this.documentTitle = 'COMPLAINT FOR DIVORCE';

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

    // South Dakota — resident at time of filing
    this.residencyRequirements = {
      resident: true,
      stateMonths: 0,
      description: 'The plaintiff must be a resident of South Dakota at the time of filing. There is no minimum duration of residency if the cause of action arose in South Dakota. (SDCL §25-4-30)'
    };

    // South Dakota — 60-day waiting period from service (SDCL §25-4-34)
    this.waitingPeriod = {
      days: 60,
      startsFrom: 'service_date',
      exceptions: [],
      description: 'No hearing, trial, or final judgment can occur until 60 days have elapsed from completed service of the summons and complaint on the defendant. SDCL §25-4-34.'
    };
  }

  /**
   * Get South Dakota case number label — "CIV. NO."
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'CIV. NO.';
  }

  /**
   * Get default court for South Dakota county — Circuit Court
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `Circuit Court, ${countyName} County, State of South Dakota`;
  }

  /**
   * Generate South Dakota header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF SOUTH DAKOTA';
  }

  /**
   * Generate South Dakota venue — title case per South Dakota practice
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Get South Dakota jurisdiction statement — resident at time of filing
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    return `Plaintiff is a resident of the State of South Dakota, ${divorceData.county || '[COUNTY]'} County, at the time of filing this Complaint. (SDCL §25-4-30)`;
  }

  /**
   * Get South Dakota venue reason
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    return `Plaintiff or Defendant resides in ${divorceData.county || '[COUNTY]'} County, South Dakota`;
  }

  /**
   * Generate South Dakota grounds section — irreconcilable differences (primary) plus fault grounds
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
        content: 'There exist irreconcilable differences between the parties which have caused the irremediable breakdown of the marriage. (SDCL §25-4-17.1)',
        type: 'grounds'
      });
    } else if (grounds === 'adultery') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has committed adultery. (SDCL §25-4-2)',
        type: 'grounds'
      });
    } else if (grounds === 'extreme_cruelty') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has inflicted extreme cruelty upon the Plaintiff. (SDCL §25-4-2)',
        type: 'grounds'
      });
    } else if (grounds === 'willful_desertion') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has willfully deserted the Plaintiff. (SDCL §25-4-2)',
        type: 'grounds'
      });
    } else if (grounds === 'willful_neglect') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has willfully neglected to provide the common necessities of life. (SDCL §25-4-2)',
        type: 'grounds'
      });
    } else if (grounds === 'habitual_intemperance') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has been habitually intemperate. (SDCL §25-4-2)',
        type: 'grounds'
      });
    } else if (grounds === 'felony_conviction') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has been convicted of a felony. (SDCL §25-4-2)',
        type: 'grounds'
      });
    } else {
      items.push({
        number: paragraphNum++,
        content: 'There exist irreconcilable differences between the parties which have caused the irremediable breakdown of the marriage. (SDCL §25-4-17.1)',
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
   * Generate South Dakota children section — uses "legal custody" and "physical custody"
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
        content: 'Plaintiff requests the Court to determine legal custody and physical custody of the minor child(ren) in the best interests of the child(ren) pursuant to SDCL §25-4A, and to establish a visitation schedule for the non-custodial parent pursuant to SDCL §25-4A-11.',
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
   * Generate South Dakota property section — equitable distribution
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
      content: 'The parties have accumulated property and debts during the marriage. Plaintiff requests that the Court divide the property and debts in an equitable manner pursuant to SDCL §25-4-44.',
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: 'Plaintiff requests the Court to consider the relevant factors, including the duration of the marriage, the value of property, the ages and health of the parties, the competency to earn a living, and the contribution of each party to the accumulation of property.',
      type: 'property_info'
    });

    return {
      title: 'VI. PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate South Dakota relief section — uses South Dakota-specific terminology
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Relief section
   */
  generateReliefSection(divorceData) {
    const items = [];

    items.push({
      number: null,
      content: 'WHEREFORE, Plaintiff requests that the Court:',
      type: 'relief_intro'
    });

    const reliefItems = [
      'Enter a Decree of Divorce;',
      'Divide the property and debts in an equitable manner pursuant to SDCL §25-4-44;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Determine legal custody and physical custody of the minor child(ren) in the best interests of the child(ren) pursuant to SDCL §25-4A;');
      reliefItems.push('Establish a visitation schedule for the non-custodial parent pursuant to SDCL §25-4A-11;');
      reliefItems.push('Order child support in accordance with the South Dakota Child Support Guidelines, SDCL §25-7-6.2;');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award alimony to Plaintiff pursuant to SDCL §25-4-41;');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`Restore Plaintiff's former name to: ${divorceData.previousName};`);
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
   * Get South Dakota verification text
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PLAINTIFF NAME]';
    return `I, ${name}, declare under penalty of perjury under the laws of the State of South Dakota that the facts stated in this Complaint are true and correct to the best of my knowledge and belief.

Date: ___________________

_________________________________
${name}
Plaintiff`;
  }

  /**
   * Perform South Dakota-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for South Dakota divorce complaints');
    }

    warnings.push('South Dakota requires the plaintiff to be a resident at the time of filing. (SDCL §25-4-30)');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('A custody and visitation arrangement must be established per SDCL §25-4A.');
      warnings.push('Child support must be calculated using the South Dakota Child Support Guidelines (SDCL §25-7-6.2).');
    }

    return { errors, warnings };
  }
}

module.exports = SouthDakotaDivorcePetitionTemplate;
