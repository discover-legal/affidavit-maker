// templates/states/[statename]/AffidavitTemplate.js
// TODO: Replace [statename] with actual state name (lowercase)

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * [State Name] Affidavit Template
 *
 * Governing Law: [Primary statute citation]
 *
 * CRITICAL COMPLIANCE NOTES:
 * - TODO: List critical legal requirements
 * - TODO: Document perjury statement requirements
 * - TODO: Document notary block requirements
 * - TODO: Document any other state-specific rules
 *
 * @class [StateName]AffidavitTemplate
 * @extends BaseAffidavitTemplate
 * @version 1.0
 */
class StateAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    // Load metadata from same directory
    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // Configure sections based on metadata
    this.sections.perjuryStatement = this.metadata.features.perjuryStatement;
  }

  /**
   * TODO: Override this method if your state requires specific header format
   *
   * Examples:
   * - Most states: `return 'STATE OF ${this.stateName.toUpperCase()}';`
   * - Utah: `return 'State of Utah';` (sentence case per statute)
   *
   * @returns {string} Header text
   */
  // generateHeader() {
  //   return `STATE OF ${this.stateName.toUpperCase()}`;
  // }

  /**
   * TODO: Override this method if your state requires specific venue format
   *
   * Examples:
   * - Sentence case: `return 'County of ${countyName}';` (most common)
   * - All caps: `return 'COUNTY OF ${county.toUpperCase()}';` (Texas)
   *
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  // generateVenue(county) {
  //   const countyName = county
  //     .split(' ')
  //     .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
  //     .join(' ');
  //   return `County of ${countyName}`;
  // }

  /**
   * TODO: Override this method if your state uses different case number terminology
   *
   * Most states use "CASE NO." but Texas uses "CAUSE NO."
   * Check your state's court rules and local practices.
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {Object} Case caption with formatted text
   */
  // generateCaseCaption(affidavitData) {
  //   let caption = '';
  //
  //   const courtName = (affidavitData.court || '[COURT NAME]').toUpperCase();
  //   caption += `IN THE ${courtName}\n\n`;
  //
  //   const caseNumber = affidavitData.caseNumber || '[CASE NUMBER]';
  //   caption += `${this.metadata.features.caseNumberLabel} ${caseNumber}\n\n`;
  //
  //   const plaintiff = affidavitData.plaintiff || '[PLAINTIFF NAME]';
  //   const defendant = affidavitData.defendant || '[DEFENDANT NAME]';
  //   caption += `${plaintiff.toUpperCase()}\nV.\n${defendant.toUpperCase()}`;
  //
  //   return {
  //     courtName,
  //     caseNumber: affidavitData.caseNumber,
  //     plaintiff: affidavitData.plaintiff,
  //     defendant: affidavitData.defendant,
  //     formatted: caption
  //   };
  // }

  /**
   * REQUIRED: Implement state-specific notary block
   *
   * CRITICAL: This must comply with your state's notary laws!
   * Research your state's statutory jurat requirements.
   *
   * Resources:
   * - State notary statute
   * - State court rules
   * - Sample affidavit forms
   *
   * @param {Object} affidavitData - The affidavit data
   * @returns {string} Notary block text
   */
  generateNotaryBlock(affidavitData) {
    // TODO: Replace this with your state's statutory jurat format!
    return `Subscribed and sworn to before me this _____ day of _____________, 20___.


_________________________________
Notary Public

My commission expires: ___________`;
  }

  /**
   * TODO: Implement perjury statement if required by your state
   *
   * Check if your state requires a perjury statement in the document text.
   * Some states (Texas, Utah) rely on the oath alone.
   * Others (Arizona) require explicit perjury statement.
   *
   * @returns {string|null} Perjury statement or null
   */
  generatePerjuryStatement() {
    if (this.metadata.features.perjuryStatement) {
      // TODO: Update with state-specific language
      return `I declare under penalty of perjury under the laws of the State of ${this.stateName} that the foregoing is true and correct.`;
    }
    return null;
  }

  /**
   * TODO: Add state-specific validation rules
   *
   * Common validations:
   * - County requirement
   * - Case number format
   * - Court name format
   * - Any state-specific field requirements
   *
   * @param {Object} affidavitData - The affidavit data to validate
   * @returns {Object} Validation result with errors and warnings
   */
  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    // TODO: Add your state-specific validation rules

    // Example: Enforce county requirement
    // if (this.requiredFields.includes('county')) {
    //   if (!affidavitData.county || affidavitData.county.trim().length === 0) {
    //     errors.push(`County is required for ${this.stateName} affidavits`);
    //   }
    // }

    return { errors, warnings };
  }

  /**
   * TODO: Override if your state requires enhanced competency language
   *
   * Some states (Utah, Arizona) require explicit "competent to testify" language.
   * Most states use the default implementation.
   *
   * @param {string} affiantName - Name of affiant
   * @returns {Object} Competency statement fact object
   */
  // generateCompetencyStatement(affiantName) {
  //   const name = affiantName || 'I';
  //   return {
  //     number: 1,
  //     content: `${name} am over the age of eighteen (18) years, of sound mind, and otherwise competent to make this affidavit. The facts stated herein are within my personal knowledge and are true and correct. I am competent to testify to the matters stated in this affidavit.`,
  //     type: 'competency'
  //   };
  // }

  /**
   * TODO: Override if your state has specific exhibit rules
   *
   * Most of this can be configured in metadata.json, but override if you need
   * custom logic for exhibit formatting.
   *
   * @returns {Object} Exhibit formatting rules
   */
  // getExhibitRules() {
  //   return {
  //     labelStyle: this.metadata.exhibitRules.labelStyle,
  //     requireCoverPage: this.metadata.exhibitRules.requireCoverPage,
  //     coverPageFormat: {
  //       title: 'EXHIBIT [LABEL]',
  //       centered: true,
  //       description: true
  //     },
  //     allowedFormats: ['PDF', 'JPG', 'PNG'],
  //     maxFileSize: 25 * 1024 * 1024,
  //     maxTotalSize: 100 * 1024 * 1024,
  //     instructions: this.metadata.exhibitRules.instructions
  //   };
  // }
}

// TODO: Update the export name to match your state
module.exports = StateAffidavitTemplate;
