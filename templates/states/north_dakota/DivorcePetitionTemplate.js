// templates/states/north_dakota/DivorcePetitionTemplate.js
// North Dakota Complaint for Divorce template
// Complies with NDCC Chapter 14-05 (Divorce)

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * North Dakota Complaint for Divorce Template
 *
 * Legal References:
 * - NDCC §14-05 — Divorce
 * - NDCC §14-05-17 — Residency (6 months state)
 * - NDCC §14-05-03 — Grounds for divorce (fault and no-fault)
 * - NDCC §14-05-24 — Property division (equitable distribution of all property)
 * - NDCC §14-05-24.1 — Spousal support
 * - NDCC §14-09-06.2 — Custody (primary residential responsibility, decision-making responsibility, parenting time)
 * - NDCC §14-09-09.7 — North Dakota Child Support Guidelines
 *
 * North Dakota-Specific Notes:
 * - Called "Divorce" — complaint titled "Complaint for Divorce"
 * - 6-month state residency required
 * - No mandatory waiting period
 * - No-fault: "irreconcilable differences"
 * - Fault: adultery, extreme cruelty, willful desertion (1 yr), willful neglect,
 *   habitual intemperance, felony conviction, insanity (5 yrs)
 * - "Primary Residential Responsibility" / "Decision-Making Responsibility"
 * - "Parenting Time" (NDCC §14-09-06.2)
 * - "Spousal Support" (NDCC §14-05-24.1)
 * - Equitable distribution — all property subject to division
 * - Filed in District Court
 * - Case number label: "CASE NO."
 * - Parties: "Plaintiff" and "Defendant"
 */
class NorthDakotaDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'ND';
    this.stateName = 'North Dakota';
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

    // North Dakota — 6 months state residency
    this.residencyRequirements = {
      stateMonths: 6,
      description: 'The plaintiff must have been a resident of North Dakota for at least six months before the commencement of the action. (NDCC §14-05-17)'
    };

    // North Dakota — no mandatory waiting period
    this.waitingPeriod = {
      days: 0,
      startsFrom: null,
      exceptions: [],
      description: 'North Dakota has no mandatory waiting period.'
    };
  }

  /**
   * Get North Dakota case number label — "CASE NO."
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'CASE NO.';
  }

  /**
   * Get default court for North Dakota county — District Court
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `District Court, ${countyName} County, State of North Dakota`;
  }

  /**
   * Generate North Dakota header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF NORTH DAKOTA';
  }

  /**
   * Generate North Dakota venue — title case per North Dakota practice
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Get North Dakota jurisdiction statement — 6-month state residency
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    return `Plaintiff has been a resident of the State of North Dakota for at least six (6) months immediately preceding the commencement of this action and is a resident of ${divorceData.county || '[COUNTY]'} County. (NDCC §14-05-17)`;
  }

  /**
   * Get North Dakota venue reason
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    return `Plaintiff or Defendant resides in ${divorceData.county || '[COUNTY]'} County, North Dakota`;
  }

  /**
   * Generate North Dakota grounds section — irreconcilable differences (primary) plus fault grounds
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
        content: 'There exist irreconcilable differences between the parties which have caused the irremediable breakdown of the marriage. (NDCC §14-05-03)',
        type: 'grounds'
      });
    } else if (grounds === 'adultery') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has committed adultery. (NDCC §14-05-03)',
        type: 'grounds'
      });
    } else if (grounds === 'extreme_cruelty') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has inflicted extreme cruelty upon the Plaintiff. (NDCC §14-05-05)',
        type: 'grounds'
      });
    } else if (grounds === 'willful_desertion') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has willfully deserted the Plaintiff for a period of one (1) year. (NDCC §14-05-06)',
        type: 'grounds'
      });
    } else if (grounds === 'willful_neglect') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has willfully neglected to provide the common necessities of life. (NDCC §14-05-07)',
        type: 'grounds'
      });
    } else if (grounds === 'felony_conviction') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has been convicted of a felony after the marriage. (NDCC §14-05-08)',
        type: 'grounds'
      });
    } else if (grounds === 'habitual_intemperance') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has been habitually intemperate. (NDCC §14-05-09)',
        type: 'grounds'
      });
    } else if (grounds === 'insanity') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has been insane for a period of five (5) years with confinement in a state institution. (NDCC §14-05-09.1)',
        type: 'grounds'
      });
    } else {
      items.push({
        number: paragraphNum++,
        content: 'There exist irreconcilable differences between the parties which have caused the irremediable breakdown of the marriage. (NDCC §14-05-03)',
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
   * Generate North Dakota children section — uses "primary residential responsibility" and "decision-making responsibility"
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
        content: 'Plaintiff requests the Court to allocate primary residential responsibility and decision-making responsibility for the minor child(ren) in the best interests of the child(ren) pursuant to NDCC §14-09-06.2, and to establish a parenting time schedule.',
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
   * Generate North Dakota property section — equitable distribution of all property
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property section
   */
  generatePropertySection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 12;

    items.push({
      number: paragraphNum++,
      content: 'The parties have accumulated property and debts during the marriage. Plaintiff requests that the Court divide the property and debts in a just and equitable manner pursuant to NDCC §14-05-24.',
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: 'Plaintiff requests the Court to consider the relevant factors, including the respective ages of the parties, their earning abilities, the duration of the marriage, the conduct of the parties, their station in life, and the circumstances and necessities of each party.',
      type: 'property_info'
    });

    return {
      title: 'VI. PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate North Dakota relief section — uses North Dakota-specific terminology
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
      'Enter a Judgment of Divorce;',
      'Divide the property and debts in a just and equitable manner pursuant to NDCC §14-05-24;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Allocate primary residential responsibility and decision-making responsibility for the minor child(ren) in the best interests of the child(ren) pursuant to NDCC §14-09-06.2;');
      reliefItems.push('Establish a parenting time schedule;');
      reliefItems.push('Order child support in accordance with the North Dakota Child Support Guidelines, NDCC §14-09-09.7;');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award spousal support to Plaintiff pursuant to NDCC §14-05-24.1;');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`Restore Plaintiff's former name to: ${divorceData.previousName};`);
    }

    reliefItems.push('Grant such other and further relief as the Court deems just and proper.');

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
   * Get North Dakota verification text
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PLAINTIFF NAME]';
    return `I, ${name}, declare under penalty of perjury under the laws of the State of North Dakota that the facts stated in this Complaint are true and correct to the best of my knowledge and belief.

Date: ___________________

_________________________________
${name}
Plaintiff`;
  }

  /**
   * Perform North Dakota-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for North Dakota divorce complaints');
    }

    warnings.push('North Dakota requires 6 months state residency before filing. (NDCC §14-05-17)');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('A parenting plan must be established per NDCC §14-09-06.2.');
      warnings.push('Child support must be calculated using the North Dakota Child Support Guidelines (NDCC §14-09-09.7).');
    }

    return { errors, warnings };
  }
}

module.exports = NorthDakotaDivorcePetitionTemplate;
