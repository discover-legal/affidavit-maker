// templates/states/hawaii/DivorcePetitionTemplate.js
// Hawaii Complaint for Divorce template
// Complies with HRS §580 (Annulment, Divorce, and Separation)

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Hawaii Complaint for Divorce Template
 *
 * Legal References:
 * - HRS §580 — Annulment, Divorce, and Separation
 * - HRS §580-1 — Jurisdiction (domicile in Hawaii required; no minimum duration)
 * - HRS §580-41 — Grounds for divorce (no-fault only)
 * - HRS §580-47 — Property division and spousal support (fair and equitable)
 * - HRS §571-46 — Child custody (best interests; joint custody encouraged)
 * - HRS §576D, §576E — Hawaii Child Support Guidelines
 *
 * Hawaii-Specific Notes:
 * - No-fault only state
 * - Grounds: irretrievably broken, lived apart 2+ years, irreconcilable differences
 * - Must be domiciled in Hawaii — NO minimum duration
 * - No mandatory waiting period
 * - "Legal Custody" and "Physical Custody"
 * - "Visitation" (HRS §571-46)
 * - "Spousal Support" or "Alimony" (HRS §580-47)
 * - Equitable distribution (fair and equitable, not necessarily equal)
 * - Filed in Family Court
 * - Case number label: "FC-D NO."
 * - Parties: "Plaintiff" and "Defendant"
 */
class HawaiiDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'HI';
    this.stateName = 'Hawaii';
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

    // Hawaii — domicile required, no minimum duration
    this.residencyRequirements = {
      stateMonths: 0,
      countyMonths: 0,
      description: 'The plaintiff must be domiciled in the State of Hawaii at the time the complaint is filed. There is no minimum duration of domicile required. (HRS §580-1)'
    };

    // Hawaii — no mandatory waiting period
    this.waitingPeriod = {
      days: 0,
      startsFrom: 'not_applicable',
      exceptions: [],
      description: 'Hawaii has no mandatory waiting period after filing. The court may schedule a hearing at any time after proper service.'
    };
  }

  /**
   * Get Hawaii case number label — "FC-D NO."
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'FC-D NO.';
  }

  /**
   * Get default court for Hawaii county — Family Court
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `Family Court of the ${this.getCircuit(countyName)} Circuit, State of Hawaii`;
  }

  /**
   * Get Hawaii circuit for a given county
   * @param {string} county - County name
   * @returns {string} Circuit name
   */
  getCircuit(county) {
    const circuits = {
      'honolulu': 'First',
      'maui': 'Second',
      'hawaii': 'Third',
      'kauai': 'Fifth'
    };
    return circuits[(county || '').toLowerCase()] || '[CIRCUIT]';
  }

  /**
   * Generate Hawaii header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF HAWAII';
  }

  /**
   * Generate Hawaii venue — title case per Hawaii practice
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Get Hawaii jurisdiction statement — domicile, no minimum duration
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    return `Plaintiff is domiciled in the State of Hawaii and is a resident of ${divorceData.county || '[COUNTY]'} County. (HRS §580-1)`;
  }

  /**
   * Get Hawaii venue reason
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    return `Plaintiff is domiciled in ${divorceData.county || '[COUNTY]'} County, Hawaii`;
  }

  /**
   * Generate Hawaii grounds section — no-fault only
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Grounds section
   */
  generateGroundsSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 8;

    const grounds = divorceData.groundsForDivorce || 'irretrievably_broken';

    if (grounds === 'irretrievably_broken' || grounds === 'no_fault') {
      items.push({
        number: paragraphNum++,
        content: 'The marriage of the parties is irretrievably broken. (HRS §580-41)',
        type: 'grounds'
      });
    } else if (grounds === 'lived_apart_two_years') {
      items.push({
        number: paragraphNum++,
        content: 'The parties have lived apart for a continuous period of two (2) or more years. (HRS §580-41)',
        type: 'grounds'
      });
    } else if (grounds === 'irreconcilable_differences') {
      items.push({
        number: paragraphNum++,
        content: 'There exist irreconcilable differences which have caused the irretrievable breakdown of the marriage. (HRS §580-41)',
        type: 'grounds'
      });
    } else {
      items.push({
        number: paragraphNum++,
        content: 'The marriage of the parties is irretrievably broken. (HRS §580-41)',
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
   * Generate Hawaii children section — uses "legal custody" and "physical custody"
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
        content: 'Plaintiff requests the Court to determine legal custody and physical custody of the minor child(ren) in the best interests of the child(ren) pursuant to HRS §571-46, and to establish a visitation schedule.',
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
   * Generate Hawaii property section — equitable distribution
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property section
   */
  generatePropertySection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 12;

    items.push({
      number: paragraphNum++,
      content: 'The parties have accumulated marital property and debts during the marriage. Plaintiff requests that the Court divide the property and debts in a just and equitable manner pursuant to HRS §580-47.',
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: 'Plaintiff requests the Court to consider the respective merits of the parties, the relative abilities of the parties, the condition in which each party will be left, the burdens imposed upon either party for the benefit of the children, and all other relevant circumstances.',
      type: 'property_info'
    });

    return {
      title: 'VI. PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Hawaii relief section — uses Hawaii-specific terminology
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
      'Enter a Decree Granting Divorce;',
      'Divide the property and debts of the parties in a just and equitable manner pursuant to HRS §580-47;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Determine legal custody and physical custody of the minor child(ren) in the best interests of the child(ren) pursuant to HRS §571-46;');
      reliefItems.push('Establish a visitation schedule;');
      reliefItems.push('Order child support in accordance with the Hawaii Child Support Guidelines, HRS §576D and §576E;');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award spousal support to Plaintiff pursuant to HRS §580-47;');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`Restore Plaintiff's former name to: ${divorceData.previousName};`);
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
   * Get Hawaii verification text
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PLAINTIFF NAME]';
    return `I, ${name}, declare under penalty of perjury under the laws of the State of Hawaii that the facts stated in this Complaint are true and correct to the best of my knowledge and belief.

Date: ___________________

_________________________________
${name}
Plaintiff`;
  }

  /**
   * Perform Hawaii-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for Hawaii divorce complaints');
    }

    warnings.push('Plaintiff must be domiciled in Hawaii at the time of filing. No minimum duration of domicile is required. (HRS §580-1)');
    warnings.push('Hawaii is a no-fault only state. (HRS §580-41)');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('A custody and visitation plan should be submitted to the court.');
      warnings.push('Child support must be calculated using the Hawaii Child Support Guidelines (HRS §576D, §576E).');
    }

    return { errors, warnings };
  }
}

module.exports = HawaiiDivorcePetitionTemplate;
