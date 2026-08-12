// templates/states/washington/DivorcePetitionTemplate.js
// Washington State Petition for Dissolution of Marriage template
// Complies with RCW 26.09 (Dissolution of Marriage, Legal Separation)

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Washington State Petition for Dissolution of Marriage Template
 *
 * Legal References:
 * - RCW 26.09 — Dissolution of Marriage, Legal Separation
 * - RCW 26.09.010 — Jurisdiction of Superior Court over dissolution proceedings
 * - RCW 26.09.030 — Residency requirement (resident of WA at time of filing with intent to remain)
 * - RCW 26.09.030 — Irretrievable breakdown; 90-day waiting period from date of filing
 * - RCW 26.09.080 — Disposition of property (community property)
 * - RCW 26.09.090 — Maintenance (spousal maintenance)
 * - RCW 26.09.181 — Parenting plan required
 * - RCW 26.19 — Washington State Child Support Schedule
 *
 * Washington-Specific Notes:
 * - Called "Dissolution of Marriage" — NOT divorce
 * - Pure no-fault state — only ground is "irretrievable breakdown"
 * - No minimum residency period — must be domiciled in WA at time of filing
 * - 90-day mandatory waiting period from date of filing (RCW 26.09.030)
 * - Community property state
 * - "Spousal Maintenance" (not alimony)
 * - "Parenting Plan" required — includes "Residential Schedule"
 * - Case number label is simply "NO."
 * - Filed in Superior Court
 */
class WashingtonDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'WA';
    this.stateName = 'Washington';
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

    // Washington — no minimum residency period; at least one party must be a WA resident at filing
    this.residencyRequirements = {
      stateMonths: 0,
      countyDays: 0,
      description: 'At least one party must be a resident of Washington with intent to remain at the time of filing. There is no minimum residency period. (RCW 26.09.030)'
    };

    // Washington waiting period — 90 days from filing (RCW 26.09.030)
    // RCW 26.09.030: no decree shall be granted until 90 days after the filing of the petition
    this.waitingPeriod = {
      days: 90,
      startsFrom: 'filing_date',
      exceptions: [],
      description: 'Washington requires that at least 90 days have elapsed after both the filing of the petition and the service of the summons (or joining of the respondent) before a final decree may be entered. (RCW 26.09.030)'
    };
  }

  /**
   * Get Washington case number label — "NO."
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'NO.';
  }

  /**
   * Get default court for Washington county — Superior Court
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `Superior Court of ${countyName} County, State of Washington`;
  }

  /**
   * Generate Washington header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF WASHINGTON';
  }

  /**
   * Generate Washington venue
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyUpper = (county || '[COUNTY]').toUpperCase();
    return `COUNTY OF ${countyUpper}`;
  }

  /**
   * Generate Washington case caption — "IN RE THE MARRIAGE OF" style
   * @param {Object} divorceData - The divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    let caption = '';

    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county)).toUpperCase();
    caption += `IN THE ${courtName}\n\n`;

    const caseLabel = this.getCaseNumberLabel();
    const caseNumber = divorceData.caseNumber || '[CASE NUMBER]';
    caption += `${caseLabel} ${caseNumber}\n\n`;

    const petitioner = (divorceData.petitionerName || '[PETITIONER NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();

    caption += `IN RE THE MARRIAGE OF:\n\n`;
    caption += `${petitioner},\n`;
    caption += `    Petitioner,\n\n`;
    caption += `and\n\n`;
    caption += `${respondent},\n`;
    caption += `    Respondent.`;

    return {
      courtName,
      caseNumber: divorceData.caseNumber,
      petitioner: divorceData.petitionerName,
      respondent: divorceData.respondentName,
      formatted: caption
    };
  }

  /**
   * Get Washington jurisdiction statement — domicile-based, no minimum period
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    return `Petitioner is a resident of the State of Washington and intends to remain in the State of Washington, satisfying the residency requirement of RCW 26.09.030. This Court has jurisdiction over this proceeding pursuant to RCW 26.09.010.`;
  }

  /**
   * Get Washington venue reason
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    return `Petitioner or Respondent resides in ${divorceData.county || '[COUNTY]'} County, Washington`;
  }

  /**
   * Generate Washington grounds section — irretrievable breakdown only
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Grounds section
   */
  generateGroundsSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 8;

    items.push({
      number: paragraphNum++,
      content: 'The marriage of the parties is irretrievably broken. (RCW 26.09.030)',
      type: 'grounds'
    });

    return {
      title: 'IV. GROUNDS FOR DISSOLUTION',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Washington children section — requires Parenting Plan
   * Uses "Parenting Plan" and "Residential Schedule" terminology
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
        content: 'The following minor children were born of or adopted during this marriage:',
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
        content: 'Petitioner requests that the Court enter a Parenting Plan, including a Residential Schedule, in the best interests of the child(ren) pursuant to RCW 26.09.181. A proposed Parenting Plan is attached hereto.',
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
   * Generate Washington property section — community property language
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property section
   */
  generatePropertySection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 12;

    items.push({
      number: paragraphNum++,
      content: 'The parties have accumulated community property and debts during the marriage. Petitioner requests that the Court make a just and equitable disposition of the community property and liabilities pursuant to RCW 26.09.080.',
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: 'Each party is entitled to their separate property, being property acquired before the marriage or acquired during the marriage by gift or inheritance.',
      type: 'property_info'
    });

    return {
      title: 'VI. PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Washington relief section — uses Washington-specific terminology
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
      'Enter a Decree of Dissolution of Marriage;',
      'Make a just and equitable disposition of the parties\' community property and liabilities pursuant to RCW 26.09.080;',
      'Confirm each party\'s separate property to that party;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Enter a Parenting Plan, including a Residential Schedule, in the best interests of the child(ren) pursuant to RCW 26.09.181;');
      reliefItems.push('Order child support in accordance with the Washington State Child Support Schedule, RCW 26.19;');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award spousal maintenance to Petitioner pursuant to RCW 26.09.090;');
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
   * Get Washington verification text — declaration under penalty of perjury per RCW 9A.72.085
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PETITIONER NAME]';
    return `I, ${name}, declare under penalty of perjury under the laws of the State of Washington that the facts stated in this Petition are true and correct to the best of my knowledge and belief.

Signed at _______________, Washington, this _____ day of _______________, 20___.

_________________________________
${name}
Petitioner`;
  }

  /**
   * Perform Washington-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for Washington dissolution petitions');
    }

    warnings.push('Washington requires that at least one party be a resident of Washington with intent to remain at time of filing. There is no minimum residency period. (RCW 26.09.030)');
    warnings.push('Washington requires a mandatory 90-day waiting period from the date the petition is filed before a decree may be entered. (RCW 26.09.030)');
    warnings.push('Washington is a community property state. The court will divide community property in a just and equitable manner. (RCW 26.09.080)');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('A Parenting Plan is REQUIRED for all cases involving minor children. (RCW 26.09.181)');
      warnings.push('Child support must be calculated using the Washington State Child Support Schedule. (RCW 26.19)');
    }

    return { errors, warnings };
  }
}

module.exports = WashingtonDivorcePetitionTemplate;
