// templates/states/michigan/DivorcePetitionTemplate.js
// Michigan-specific divorce complaint template
// Complies with MCL § 552.6 et seq. (Michigan divorce statutes)

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Michigan Complaint for Divorce Template
 *
 * Legal References:
 * - MCL § 552.6 — Ground for divorce — breakdown of marriage (ONLY ground)
 * - MCL § 552.9 — Residency requirements (180 days state, 10 days county)
 * - MCL § 552.9f — Waiting period (60 days no children; 180 days with minor children)
 * - MCL § 552.13 — Alimony/spousal support authority
 * - MCL § 552.19 et seq. — Property division
 * - MCL § 552.23 — Spousal support factors
 * - MCL § 722.26a — Child custody
 * - MCL § 722.3 — Best interests of the child (12 factors)
 * - MCL § 552.519 — Michigan Child Support Formula
 *
 * Official Forms:
 * - DC 100a (Complaint for Divorce — no children)
 * - DC 100c (Complaint for Divorce — with children)
 * - FOC 10/52 (Friend of the Court forms — required when minor children)
 *
 * Michigan-Specific Notes:
 * - Pure no-fault state — ONLY ground is "breakdown of marriage relationship"
 * - Filed in Circuit Court, Family Division
 * - Case number format: [year]-[number]-[county code]-DM
 * - Friend of the Court (FOC) is involved when minor children
 * - FOC 10/52 must be filed with complaint if minor children
 * - 60-day waiting period (no children); 180-day waiting period (minor children)
 * - "Spousal Support" (not alimony or maintenance)
 * - "Parenting Time" (not visitation)
 */
class MichiganDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'MI';
    this.stateName = 'Michigan';
    this.documentTitle = 'COMPLAINT FOR DIVORCE';

    // Load metadata if available
    try {
      this.metadata = require('./divorce-metadata.json');
    } catch (e) {
      this.metadata = null;
    }

    // Michigan-specific required fields
    this.requiredFields = [
      'petitionerName',
      'respondentName',
      'state',
      'county',
      'marriageDate'
    ];

    // Michigan residency requirements per MCL § 552.9
    this.residencyRequirements = {
      stateMonths: 6,
      stateDays: 180,
      countyDays: 10,
      description: 'Plaintiff must have been domiciled in Michigan for 180 days AND a resident of the county for at least 10 days before filing.'
    };

    // Michigan waiting period per MCL § 552.9f
    this.waitingPeriod = {
      days: 60,
      startsFrom: 'filing_date',
      exceptions: ['minor_children'],
      description: '60 days from filing if no minor children; 180 days from filing if parties have minor children.'
    };
  }

  /**
   * Get Michigan case number label
   * @returns {string} "CASE NO."
   */
  getCaseNumberLabel() {
    return 'CASE NO.';
  }

  /**
   * Get default court for Michigan county
   * Michigan Circuit Courts are numbered by judicial circuit
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyUpper = (county || '[COUNTY]').toUpperCase();
    return `IN THE [NUMBER] JUDICIAL CIRCUIT COURT FOR ${countyUpper} COUNTY, STATE OF MICHIGAN\nFAMILY DIVISION`;
  }

  /**
   * Generate Michigan case caption
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    let caption = '';

    const countyUpper = (divorceData.county || '[COUNTY]').toUpperCase();
    const circuit = divorceData.judicialCircuit || '[NUMBER]';

    caption += `IN THE ${circuit} JUDICIAL CIRCUIT COURT FOR ${countyUpper} COUNTY, STATE OF MICHIGAN\n`;
    caption += `FAMILY DIVISION\n\n`;

    const caseNumber = divorceData.caseNumber || `${new Date().getFullYear()}-______-${countyUpper.substring(0,2)}-DM`;
    caption += `CASE NO. ${caseNumber}\n\n`;

    const plaintiff = (divorceData.petitionerName || '[PLAINTIFF NAME]').toUpperCase();
    const defendant = (divorceData.respondentName || '[DEFENDANT NAME]').toUpperCase();

    caption += `${plaintiff},\n`;
    caption += `     Plaintiff,\n\n`;
    caption += `v.\n\n`;
    caption += `${defendant},\n`;
    caption += `     Defendant.\n\n`;

    caption += this.documentTitle;
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      caption += '\n(No Minor Children)';
    } else {
      caption += '\n(With Minor Children)';
    }

    return {
      courtName: `${circuit} Judicial Circuit Court, ${divorceData.county || '[County]'} County, Michigan, Family Division`,
      caseNumber: divorceData.caseNumber,
      petitioner: divorceData.petitionerName,
      respondent: divorceData.respondentName,
      formatted: caption
    };
  }

  /**
   * Generate Michigan jurisdiction statement per MCL § 552.9
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    const plaintiff = divorceData.petitionerName || 'Plaintiff';
    return `${plaintiff} has been domiciled in the State of Michigan for at least 180 days and a resident of ${divorceData.county || '[COUNTY]'} County for at least 10 days immediately preceding the filing of this Complaint, as required by MCL § 552.9.`;
  }

  /**
   * Get venue reason for Michigan
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    return 'Plaintiff has been a resident of this county for at least 10 days immediately preceding the filing of this Complaint, satisfying the venue requirements of MCL § 552.9';
  }

  /**
   * Get Michigan grounds text
   * Michigan has ONLY one ground — breakdown of marriage relationship (MCL § 552.6)
   * @param {string} grounds - Grounds type (ignored — only one ground in Michigan)
   * @param {Object} divorceData - Divorce data
   * @returns {string} Grounds text
   */
  getGroundsText(grounds, divorceData) {
    // Michigan is a pure no-fault state — only one ground exists
    return 'There has been a breakdown of the marriage relationship to the extent that the objects of matrimony have been destroyed and there remains no reasonable likelihood that the marriage can be preserved. (MCL § 552.6)';
  }

  /**
   * Generate Michigan children section
   * Michigan uses FOC (Friend of the Court) system for cases with minor children
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Children section
   */
  generateChildrenSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 9;

    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      items.push({
        number: paragraphNum++,
        content: 'There are no minor children born or adopted of this marriage.',
        type: 'children_info'
      });
    } else {
      items.push({
        number: paragraphNum++,
        content: 'The following minor children were born of or adopted during this marriage:',
        type: 'children_info'
      });

      divorceData.children.forEach((child, index) => {
        const childName = typeof child === 'string' ? child : (child.name || '[CHILD NAME]');
        const birthDate = typeof child === 'object' ? this.formatDate(child.birthDate ?? child.dob ?? child.dateOfBirth) : null;
        items.push({
          number: paragraphNum++,
          content: birthDate ? `${childName}, born ${birthDate}` : childName,
          type: 'child_detail'
        });
      });

      items.push({
        number: paragraphNum++,
        content: 'Plaintiff requests that the Court enter an Order regarding custody, parenting time, and child support for the minor child(ren), consistent with the best interests of the child(ren) as set forth in MCL § 722.23 and MCL § 722.26a.',
        type: 'custody_request'
      });

      items.push({
        number: paragraphNum++,
        content: 'Friend of the Court forms (FOC 10/52) are being filed simultaneously with this Complaint as required by Michigan Court Rule 3.204.',
        type: 'foc_notice'
      });
    }

    return {
      title: 'V. MINOR CHILDREN',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Michigan property section using equitable distribution language
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property section
   */
  generatePropertySection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 14;

    items.push({
      number: paragraphNum++,
      content: 'During the marriage, the parties have acquired marital property and may have incurred marital debt.',
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: 'Plaintiff requests that the Court divide the marital property equitably between the parties pursuant to MCL § 552.19 et seq., and allocate marital debts in an equitable manner.',
      type: 'property_request'
    });

    return {
      title: 'VI. PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Michigan relief section using Michigan terminology
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Relief section
   */
  generateReliefSection(divorceData) {
    const items = [];

    items.push({
      number: null,
      content: 'WHEREFORE, Plaintiff requests that this Court:',
      type: 'relief_intro'
    });

    const reliefItems = [];

    reliefItems.push('Enter a Judgment of Divorce dissolving the marriage between Plaintiff and Defendant;');
    reliefItems.push('Equitably divide the marital property and marital debt pursuant to MCL § 552.19 et seq.;');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Determine custody of the minor child(ren) pursuant to MCL § 722.26a and the best interests factors of MCL § 722.23;');
      reliefItems.push('Establish a parenting time schedule for the non-primary-residence parent;');
      reliefItems.push('Order child support in accordance with the Michigan Child Support Formula (MCL § 552.519);');
      reliefItems.push('Order the maintenance of health insurance for the minor child(ren);');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award spousal support to Plaintiff pursuant to MCL § 552.13 and MCL § 552.23;');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`Restore Plaintiff\'s former name to: ${divorceData.previousName};`);
    }

    reliefItems.push('Grant such other and further relief as the Court deems just and equitable.');

    reliefItems.forEach((relief, index) => {
      const letter = String.fromCharCode(97 + index);
      items.push({
        number: null,
        content: relief,
        type: 'relief_item',
        style: 'letter',
        letter: letter
      });
    });

    return {
      title: 'PRAYER FOR RELIEF',
      items,
      nextParagraphNumber: null
    };
  }

  /**
   * Get Michigan verification text
   * Michigan uses a standard verification; no separate perjury recitation required
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PLAINTIFF NAME]';
    return `I, ${name}, declare that the statements in this Complaint for Divorce are true to the best of my information, knowledge, and belief.


_________________________________
${name}, Plaintiff

Date: ___________________`;
  }

  /**
   * Perform Michigan-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for Michigan divorce complaints');
    }

    // Michigan is pure no-fault — warn if user tried to specify a fault ground
    if (divorceData.groundsForDivorce && divorceData.groundsForDivorce !== 'breakdown_of_marriage' && divorceData.groundsForDivorce !== 'irreconcilable_differences') {
      warnings.push('Michigan is a pure no-fault state. The only ground for divorce is breakdown of the marriage relationship (MCL § 552.6). All fault-based grounds will be replaced with the statutory language.');
    }

    const hasChildren = divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0);

    if (hasChildren) {
      warnings.push('Michigan requires Friend of the Court forms (FOC 10/52) to be filed simultaneously with a Complaint for Divorce when minor children are involved (Michigan Court Rule 3.204).');
      warnings.push('The waiting period when minor children are involved is 180 days (6 months) from the date of filing before a Judgment of Divorce may be entered (MCL § 552.9f).');
    } else {
      warnings.push('The waiting period when there are no minor children is 60 days from the date of filing before a Judgment of Divorce may be entered (MCL § 552.9f).');
    }

    return { errors, warnings };
  }
}

module.exports = MichiganDivorcePetitionTemplate;
