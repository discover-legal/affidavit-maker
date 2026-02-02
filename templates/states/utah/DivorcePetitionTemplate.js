// templates/states/utah/DivorcePetitionTemplate.js
// Utah-specific divorce petition template
// Complies with Utah Code and Utah Rules of Civil Procedure

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Utah Verified Petition for Divorce Template
 *
 * Legal References:
 * - Utah Code Title 30, Chapter 3 (Divorce)
 * - Utah Code § 30-3-1 (Procedure; residence requirements)
 * - Utah Code § 30-3-3 (Verification of complaint)
 * - Utah Rules of Civil Procedure Rule 10 (Form of pleadings)
 *
 * Formatting Requirements (URCP Rule 10):
 * - 8.5" x 11" paper
 * - 1" margins on all sides
 * - 12-point font minimum
 * - Double-spaced text
 * - Clearly legible
 *
 * Utah-Specific Requirements:
 * - Petition must be verified (sworn)
 * - 30-day waiting period
 * - 3-month county residency
 * - Mandatory divorce education class (with children)
 */
class UtahDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'UT';
    this.stateName = 'Utah';
    this.documentTitle = 'VERIFIED PETITION FOR DIVORCE';

    // Load metadata if available
    try {
      this.metadata = require('./divorce-metadata.json');
    } catch (e) {
      this.metadata = null;
    }

    // Utah-specific required fields
    this.requiredFields = [
      'petitionerName',
      'respondentName',
      'state',
      'county',
      'marriageDate',
      'groundsForDivorce'
    ];

    // Utah residency requirements
    this.residencyRequirements = {
      stateMonths: 0, // No state requirement, just county
      countyDays: 90, // 3 months = ~90 days
      description: 'The Petitioner must have been an actual and bona fide resident of the county for three months immediately prior to filing.'
    };

    // Utah waiting period
    this.waitingPeriod = {
      days: 30,
      startsFrom: 'filing_date',
      exceptions: ['extraordinary_circumstances'],
      description: 'Divorce may not be granted until 30 days after filing. Court may waive for extraordinary circumstances.'
    };

    // Utah formatting requirements (URCP Rule 10)
    this.formatting = {
      fontSize: '12pt',
      fontFamily: 'Times New Roman',
      lineHeight: '2',
      margin: '1in',
      paperSize: '8.5in x 11in'
    };
  }

  /**
   * Get Utah case number label
   * @returns {string} "Case No."
   */
  getCaseNumberLabel() {
    return 'Case No.';
  }

  /**
   * Get default court for Utah county
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    return `Third Judicial District Court, ${county || '[COUNTY]'} County, State of Utah`;
  }

  /**
   * Generate Utah-style header (sentence case per Utah Code § 46-1-6.5)
   * @returns {string} Header text
   */
  generateHeader() {
    return 'State of Utah';
  }

  /**
   * Generate Utah-style venue (title case)
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyFormatted = (county || '[County]')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
    return `County of ${countyFormatted}`;
  }

  /**
   * Generate Utah case caption
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    let caption = '';

    // Court header
    const courtName = divorceData.court || this.getDefaultCourt(divorceData.county);
    caption += `IN THE ${courtName.toUpperCase()}\n\n`;

    // Case number
    const caseNumber = divorceData.caseNumber || '____________________';
    caption += `Case No. ${caseNumber}\n\n`;

    // Judge assignment
    if (divorceData.judgeName) {
      caption += `Judge ${divorceData.judgeName}\n\n`;
    }

    // Parties
    const petitioner = divorceData.petitionerName || '[PETITIONER NAME]';
    const respondent = divorceData.respondentName || '[RESPONDENT NAME]';

    caption += `${petitioner.toUpperCase()},\n`;
    caption += `Petitioner,\n\n`;
    caption += `vs.\n\n`;
    caption += `${respondent.toUpperCase()},\n`;
    caption += `Respondent.`;

    return {
      courtName,
      caseNumber: divorceData.caseNumber,
      petitioner: divorceData.petitionerName,
      respondent: divorceData.respondentName,
      formatted: caption
    };
  }

  /**
   * Generate Utah jurisdiction statement
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    return `Petitioner has been an actual and bona fide resident of ${divorceData.county || '[COUNTY]'} County, State of Utah, for at least three months immediately prior to the commencement of this action.`;
  }

  /**
   * Get Utah grounds text
   * @param {string} grounds - Grounds type
   * @param {Object} divorceData - Divorce data
   * @returns {string} Grounds text
   */
  getGroundsText(grounds, divorceData) {
    switch (grounds) {
      case 'irreconcilable_differences':
      case 'no_fault':
        return 'There are irreconcilable differences between the parties which have caused the irremediable breakdown of the marriage.';

      case 'living_apart':
        return 'The parties have lived separate and apart under a decree of separate maintenance of any state for three consecutive years without cohabitation.';

      case 'desertion':
        return 'The Respondent willfully deserted the Petitioner for more than one year.';

      case 'neglect':
        return 'The Respondent has willfully neglected to provide the Petitioner with the common necessaries of life.';

      case 'habitual_drunkenness':
        return 'The Respondent is a habitual drunkard.';

      case 'conviction':
        return 'The Respondent has been convicted of a felony.';

      case 'cruel_treatment':
        return 'The Respondent has treated the Petitioner with cruel treatment causing bodily injury or great mental distress.';

      case 'incurable_insanity':
        return 'The Respondent has been adjudged insane, or incurably insane, as provided by law.';

      default:
        return 'There are irreconcilable differences between the parties which have caused the irremediable breakdown of the marriage.';
    }
  }

  /**
   * Generate Utah children section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Children section
   */
  generateChildrenSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 9;

    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      items.push({
        number: paragraphNum++,
        content: 'There are no minor children born of this marriage and no minor children are expected.',
        type: 'children_info'
      });
    } else {
      items.push({
        number: paragraphNum++,
        content: 'The following minor children have been born of or adopted during this marriage:',
        type: 'children_info'
      });

      divorceData.children.forEach((child, index) => {
        const childName = typeof child === 'string' ? child : (child.name || '[CHILD NAME]');
        const birthDate = typeof child === 'object' ? this.formatDate(child.birthDate) : null;
        items.push({
          number: paragraphNum++,
          content: birthDate ? `${childName}, born ${birthDate}` : childName,
          type: 'child_detail'
        });
      });

      items.push({
        number: paragraphNum++,
        content: 'No other children have been born of or adopted by the parties during this marriage, and the wife is not now pregnant.',
        type: 'children_info'
      });

      // Utah custody request
      items.push({
        number: paragraphNum++,
        content: 'Petitioner requests that the Court enter orders regarding custody, parent-time, and child support that are in the best interests of the minor child(ren).',
        type: 'custody_request'
      });

      // Utah mandatory divorce education
      items.push({
        number: paragraphNum++,
        content: 'Petitioner understands that attendance at a divorce education class is mandatory when minor children are involved, as required by Utah Code § 30-3-11.3.',
        type: 'education_acknowledgment'
      });
    }

    return {
      title: 'V. CHILDREN',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Utah property section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property section
   */
  generatePropertySection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 14;

    items.push({
      number: paragraphNum++,
      content: 'During the marriage, the parties have acquired certain real and personal property.',
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: 'Petitioner requests that the Court make an equitable division of the marital property and debts.',
      type: 'property_request'
    });

    return {
      title: 'VI. PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Utah relief section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Relief section
   */
  generateReliefSection(divorceData) {
    const items = [];

    items.push({
      number: null,
      content: 'WHEREFORE, Petitioner respectfully requests that the Court:',
      type: 'relief_intro'
    });

    const reliefItems = [];

    reliefItems.push('Grant Petitioner a decree of divorce from Respondent, dissolving the bonds of matrimony;');
    reliefItems.push('Make an equitable division of the marital property and debts;');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Award custody of the minor child(ren) in accordance with the best interests of the child(ren);');
      reliefItems.push('Establish a reasonable parent-time schedule;');
      reliefItems.push('Order child support in accordance with the Utah Child Support Guidelines;');
      reliefItems.push('Order both parties to maintain health insurance for the minor child(ren);');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award alimony to Petitioner;');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`Restore Petitioner's former name to: ${divorceData.previousName};`);
    }

    reliefItems.push('Award such other and further relief as the Court deems just and equitable.');

    reliefItems.forEach((relief, index) => {
      items.push({
        number: index + 1,
        content: relief,
        type: 'relief_item'
      });
    });

    return {
      title: 'PRAYER FOR RELIEF',
      items,
      nextParagraphNumber: null
    };
  }

  /**
   * Get Utah verification text (required - petition must be verified)
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PETITIONER NAME]';
    const county = divorceData.county || '[COUNTY]';

    return `VERIFICATION

State of Utah
County of ${county}

I, ${name}, being first duly sworn upon oath, depose and state:

I am the Petitioner in the above-entitled action. I have read the foregoing Verified Petition for Divorce and know the contents thereof. The same is true of my own knowledge, except as to those matters stated on information and belief, and as to those matters, I believe them to be true.

_________________________________
${name}, Petitioner

SUBSCRIBED AND SWORN to before me on _____________________, 20___.

_________________________________
Notary Public
Residing at: ___________________
My Commission Expires: ___________`;
  }

  /**
   * Perform Utah-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    // Utah requires county residence
    if (!divorceData.county) {
      errors.push('County is required for Utah divorce petitions');
    }

    // Utah-specific grounds
    const validGrounds = [
      'irreconcilable_differences', 'no_fault', 'living_apart',
      'desertion', 'neglect', 'habitual_drunkenness', 'conviction',
      'cruel_treatment', 'incurable_insanity'
    ];

    if (divorceData.groundsForDivorce && !validGrounds.includes(divorceData.groundsForDivorce)) {
      warnings.push(`"${divorceData.groundsForDivorce}" may not be a recognized ground in Utah.`);
    }

    // Warning about mandatory divorce education
    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('Utah requires both parents to complete a divorce education class when minor children are involved (Utah Code § 30-3-11.3).');
    }

    return { errors, warnings };
  }
}

module.exports = UtahDivorcePetitionTemplate;
