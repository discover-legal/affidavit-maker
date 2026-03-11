// templates/states/new_hampshire/DivorcePetitionTemplate.js
// New Hampshire Petition for Divorce template
// Complies with RSA 458 (Annulment, Divorce, and Separation)

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * New Hampshire Petition for Divorce Template
 *
 * Legal References:
 * - RSA 458 — Annulment, Divorce, and Separation
 * - RSA 458:5 — Residency (both residents: no minimum; one non-resident: 1 year)
 * - RSA 458:7 — Fault grounds for divorce
 * - RSA 458:7-a — No-fault ground (irreconcilable differences)
 * - RSA 458:16-a — Property division (equitable distribution of ALL property)
 * - RSA 458:19 — Alimony
 * - RSA 461-A — Parental Rights and Responsibilities (custody and parenting time)
 * - RSA 458-C — New Hampshire Child Support Guidelines
 *
 * New Hampshire-Specific Notes:
 * - Called "Divorce" (standard terminology)
 * - Both fault and no-fault grounds available
 * - No-fault: "irreconcilable differences" (RSA 458:7-a)
 * - Fault: impotency, adultery, extreme cruelty, conviction, 2-year absence,
 *   habitual drunkenness, endangering treatment, joining religious sect (RSA 458:7)
 * - Both residents: no minimum residency; one non-resident: 1 year (RSA 458:5)
 * - No mandatory waiting period
 * - "Legal Custody" and "Physical Custody" (standard)
 * - "Parenting Time" or "Residential Responsibility" (RSA 461-A)
 * - "Alimony" (RSA 458:19)
 * - Equitable distribution of ALL property — including separate (RSA 458:16-a)
 * - Filed in Superior Court, Family Division
 * - Case number label: "CASE NO."
 * - Parties: "Petitioner" and "Respondent"
 */
class NewHampshireDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'NH';
    this.stateName = 'New Hampshire';
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

    // New Hampshire — both residents: no minimum; one non-resident: 1 year
    this.residencyRequirements = {
      stateMonths: 12,
      countyMonths: null,
      description: 'If both parties are New Hampshire residents, there is no minimum residency period. If one party is a non-resident, the filing spouse must have lived in New Hampshire for at least one year before filing. (RSA 458:5)'
    };

    // New Hampshire — no mandatory waiting period
    this.waitingPeriod = {
      days: 0,
      startsFrom: 'filing_date',
      exceptions: [],
      description: 'New Hampshire has no mandatory waiting period after filing for divorce.'
    };
  }

  /**
   * Get New Hampshire case number label — "CASE NO."
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'CASE NO.';
  }

  /**
   * Get default court for New Hampshire county — Superior Court, Family Division
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `${countyName} County Superior Court, Family Division, State of New Hampshire`;
  }

  /**
   * Generate New Hampshire header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF NEW HAMPSHIRE';
  }

  /**
   * Generate New Hampshire venue — title case per NH practice
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Get New Hampshire jurisdiction statement
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    return `Petitioner has been a resident of the State of New Hampshire and resides in ${divorceData.county || '[COUNTY]'} County. This Court has jurisdiction over this matter pursuant to RSA 458:5.`;
  }

  /**
   * Get New Hampshire venue reason
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    return `Petitioner or Respondent resides in ${divorceData.county || '[COUNTY]'} County, New Hampshire`;
  }

  /**
   * Generate New Hampshire grounds section — irreconcilable differences (primary) plus fault grounds
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
        content: 'Irreconcilable differences have caused the irremediable breakdown of the marriage. (RSA 458:7-a)',
        type: 'grounds'
      });
    } else if (grounds === 'adultery') {
      items.push({
        number: paragraphNum++,
        content: 'Respondent has committed adultery. (RSA 458:7(II))',
        type: 'grounds'
      });
    } else if (grounds === 'extreme_cruelty') {
      items.push({
        number: paragraphNum++,
        content: 'Respondent has been guilty of extreme cruelty to the Petitioner. (RSA 458:7(III))',
        type: 'grounds'
      });
    } else if (grounds === 'felony_conviction') {
      items.push({
        number: paragraphNum++,
        content: 'Respondent has been convicted of a crime punishable by imprisonment for more than one year and has been actually sentenced to imprisonment. (RSA 458:7(IV))',
        type: 'grounds'
      });
    } else if (grounds === 'habitual_drunkenness') {
      items.push({
        number: paragraphNum++,
        content: 'Respondent has been habitually drunk for a period of two years. (RSA 458:7(VII))',
        type: 'grounds'
      });
    } else if (grounds === 'absence') {
      items.push({
        number: paragraphNum++,
        content: 'Respondent has been absent for two years without consent and without the Petitioner knowing the Respondent\'s whereabouts. (RSA 458:7(VI))',
        type: 'grounds'
      });
    } else {
      items.push({
        number: paragraphNum++,
        content: 'Irreconcilable differences have caused the irremediable breakdown of the marriage. (RSA 458:7-a)',
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
   * Generate New Hampshire children section — uses "legal custody" and "physical custody"
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
        content: 'Petitioner requests the Court to determine legal custody and physical custody of the minor child(ren) and to establish a parenting plan in the best interests of the child(ren) pursuant to RSA 461-A.',
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
   * Generate New Hampshire property section — equitable distribution of ALL property
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property section
   */
  generatePropertySection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 12;

    items.push({
      number: paragraphNum++,
      content: 'The parties have accumulated property and debts. Petitioner requests that the Court divide all property of the parties in an equitable manner pursuant to RSA 458:16-a.',
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: 'Petitioner requests the Court to consider all relevant factors including the length of the marriage, the age and health of each party, the amount and sources of income, the occupation and employability of each party, the contribution of each spouse to the acquisition, preservation, or appreciation of property, and any other factor the Court deems relevant.',
      type: 'property_info'
    });

    return {
      title: 'VI. PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate New Hampshire relief section — uses NH-specific terminology
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
      'Grant a Decree of Divorce;',
      'Divide the property and debts of the parties equitably pursuant to RSA 458:16-a;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Determine legal custody and physical custody of the minor child(ren) in the best interests of the child(ren) pursuant to RSA 461-A;');
      reliefItems.push('Establish a parenting plan including parenting time pursuant to RSA 461-A;');
      reliefItems.push('Order child support in accordance with the New Hampshire Child Support Guidelines, RSA 458-C;');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award alimony to Petitioner pursuant to RSA 458:19;');
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
   * Get New Hampshire verification text
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PETITIONER NAME]';
    return `I, ${name}, declare under penalty of perjury under the laws of the State of New Hampshire that the facts stated in this Petition are true and correct to the best of my knowledge and belief.

Date: ___________________

_________________________________
${name}
Petitioner`;
  }

  /**
   * Perform New Hampshire-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for New Hampshire divorce petitions');
    }

    warnings.push('If one party is a non-resident, the filing spouse must have lived in New Hampshire for at least one year. (RSA 458:5)');
    warnings.push('New Hampshire divides ALL property equitably, including separate property. (RSA 458:16-a)');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('A parenting plan must be filed per RSA 461-A (Parental Rights and Responsibilities).');
      warnings.push('Child support must be calculated using the New Hampshire Child Support Guidelines (RSA 458-C).');
    }

    return { errors, warnings };
  }
}

module.exports = NewHampshireDivorcePetitionTemplate;
