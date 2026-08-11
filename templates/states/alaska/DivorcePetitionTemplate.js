// templates/states/alaska/DivorcePetitionTemplate.js
// Alaska Complaint for Divorce template
// Complies with AS 25.24 (Divorce and Dissolution)

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Alaska Complaint for Divorce Template
 *
 * Legal References:
 * - AS 25.24 — Divorce and Dissolution
 * - AS 25.24.090 — Residency (domicile in Alaska; 30-day wait after service)
 * - AS 25.24.050 — Grounds for divorce (fault and no-fault)
 * - AS 25.24.160 — Property division (equitable distribution); alimony
 * - AS 25.20.060 — Custody and visitation (shared custody)
 * - Civil Rule 90.3 — Alaska Child Support Guidelines
 * - AS 22.10 — Superior Court jurisdiction
 *
 * Alaska-Specific Notes:
 * - Called "Divorce" — complaint titled "Complaint for Divorce"
 * - Domicile required; no minimum residency duration
 * - 30-day waiting period after service
 * - No-fault: "incompatibility of temperament"
 * - Fault: adultery, felony, desertion (1 yr), cruel treatment, drunkenness,
 *   incurable mental illness (18+ mo), personal indignities, failure to consummate, drug addiction
 * - "Legal Custody" / "Physical Custody"; shared custody
 * - "Visitation" (AS 25.20.060)
 * - "Alimony" (AS 25.24.160)
 * - Equitable distribution — fair and just division
 * - Filed in Superior Court
 * - Case number label: "CASE NO."
 * - Parties: "Plaintiff" and "Defendant"
 */
class AlaskaDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'AK';
    this.stateName = 'Alaska';
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

    // Alaska — domicile required, no minimum duration
    this.residencyRequirements = {
      domicile: true,
      stateMonths: 0,
      description: 'The plaintiff must be domiciled in Alaska at the time of filing. There is no minimum duration of residency required. (AS 25.24.090)'
    };

    // Alaska waiting period — 30 days after service
    this.waitingPeriod = {
      days: 30,
      startsFrom: 'service_date',
      exceptions: [],
      description: 'The court may not enter a decree of divorce until at least 30 days after service of process on the defendant. (AS 25.24.090)'
    };
  }

  /**
   * Get Alaska case number label — "CASE NO."
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'CASE NO.';
  }

  /**
   * Get default court for Alaska — Superior Court
   * @param {string} county - Judicial district name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[JUDICIAL DISTRICT]';
    return `Superior Court for the State of Alaska, ${countyName} Judicial District`;
  }

  /**
   * Generate Alaska header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF ALASKA';
  }

  /**
   * Generate Alaska venue — title case per Alaska practice
   * @param {string} county - Judicial district name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[JUDICIAL DISTRICT]';
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `${countyFormatted} Judicial District`;
  }

  /**
   * Get Alaska jurisdiction statement — domicile required
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    return `Plaintiff is domiciled in the State of Alaska, ${divorceData.county || '[JUDICIAL DISTRICT]'} Judicial District, and has been domiciled in Alaska at the time of filing this Complaint. (AS 25.24.090)`;
  }

  /**
   * Get Alaska venue reason
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    return `Plaintiff or Defendant resides in the ${divorceData.county || '[JUDICIAL DISTRICT]'} Judicial District, Alaska`;
  }

  /**
   * Generate Alaska grounds section — incompatibility (primary) plus fault grounds
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
        content: 'There exists an incompatibility of temperament between the parties that has caused the irremediable breakdown of the marriage. (AS 25.24.050(5))',
        type: 'grounds'
      });
    } else if (grounds === 'adultery') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has committed adultery. (AS 25.24.050(1))',
        type: 'grounds'
      });
    } else if (grounds === 'felony_conviction') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has been convicted of a felony. (AS 25.24.050(1))',
        type: 'grounds'
      });
    } else if (grounds === 'willful_desertion') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has willfully deserted the Plaintiff for a period of one (1) year. (AS 25.24.050(1))',
        type: 'grounds'
      });
    } else if (grounds === 'cruel_treatment') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has engaged in cruel and inhuman treatment calculated to impair health or endanger life. (AS 25.24.050(1))',
        type: 'grounds'
      });
    } else if (grounds === 'habitual_drunkenness') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has been habitually and grossly intoxicated, contracted since the marriage and continuing for one year prior to the filing of this Complaint. (AS 25.24.050(2))',
        type: 'grounds'
      });
    } else if (grounds === 'incurable_mental_illness') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has been suffering from incurable mental illness and has been confined to an institution for at least eighteen (18) months. (AS 25.24.050(3))',
        type: 'grounds'
      });
    } else if (grounds === 'drug_addiction') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has an addiction to drugs. (AS 25.24.050(7))',
        type: 'grounds'
      });
    } else {
      items.push({
        number: paragraphNum++,
        content: 'There exists an incompatibility of temperament between the parties that has caused the irremediable breakdown of the marriage. (AS 25.24.050(5))',
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
   * Generate Alaska children section — uses "legal custody" and "physical custody"
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
        content: 'Plaintiff requests the Court to determine legal custody and physical custody of the minor child(ren) in the best interests of the child(ren) pursuant to AS 25.20.060, and to establish a visitation schedule for the non-custodial parent.',
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
   * Generate Alaska property section — equitable distribution
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property section
   */
  generatePropertySection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 12;

    items.push({
      number: paragraphNum++,
      content: 'The parties have accumulated marital property and debts during the marriage. Plaintiff requests that the Court divide the marital property and debts in a fair and just manner pursuant to AS 25.24.160.',
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: 'Plaintiff requests the Court to consider the relevant factors, including the length of the marriage, the earning capacity and financial condition of each party, the conduct of the parties, and the desirability of awarding the family home to the custodial parent.',
      type: 'property_info'
    });

    return {
      title: 'VI. PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Alaska relief section — uses Alaska-specific terminology
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
      'Divide the marital property and debts in a fair and just manner pursuant to AS 25.24.160;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Determine legal custody and physical custody of the minor child(ren) in the best interests of the child(ren) pursuant to AS 25.20.060;');
      reliefItems.push('Establish a visitation schedule for the non-custodial parent;');
      reliefItems.push('Order child support in accordance with the Alaska Child Support Guidelines, Civil Rule 90.3;');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award alimony to Plaintiff pursuant to AS 25.24.160;');
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
   * Get Alaska verification text
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PLAINTIFF NAME]';
    return `I, ${name}, declare under penalty of perjury under the laws of the State of Alaska that the facts stated in this Complaint are true and correct to the best of my knowledge and belief.

Date: ___________________

_________________________________
${name}
Plaintiff`;
  }

  /**
   * Perform Alaska-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('Judicial district is required for Alaska divorce complaints');
    }

    warnings.push('Alaska requires the plaintiff to be domiciled in Alaska at the time of filing. (AS 25.24.090)');
    warnings.push('The court may not enter a decree until 30 days after service of process. (AS 25.24.090)');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('A custody and visitation order must be established per AS 25.20.060.');
      warnings.push('Child support must be calculated using the Alaska Child Support Guidelines (Civil Rule 90.3).');
    }

    return { errors, warnings };
  }
}

module.exports = AlaskaDivorcePetitionTemplate;
