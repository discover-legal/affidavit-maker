// templates/states/arkansas/DivorcePetitionTemplate.js
// Arkansas Complaint for Divorce template
// Complies with Ark. Code §9-12 (Divorce)

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Arkansas Complaint for Divorce Template
 *
 * Legal References:
 * - Ark. Code §9-12 — Divorce
 * - Ark. Code §9-12-307 — Residency (60 days before filing, 3 months before decree)
 * - Ark. Code §9-12-301 — Grounds (fault and no-fault)
 * - Ark. Code §9-12-307(b) — 30-day waiting period from filing
 * - Ark. Code §9-12-315 — Property division (equitable distribution)
 * - Ark. Code §9-12-312 — Alimony
 * - Ark. Code §9-13-101 — Child custody (joint custody presumption)
 * - Ark. Admin. Order No. 10 — Child support guidelines (income shares)
 *
 * Arkansas-Specific Notes:
 * - Called "Complaint for Divorce" — NOT petition
 * - Both fault and no-fault grounds; no-fault requires 18-month separation
 * - 60-day residency before filing; 3 months before decree
 * - 30-day waiting period from date of filing
 * - Presumption of joint custody (Act 906 of 2021)
 * - "Joint Custody" / "Sole Custody"
 * - "Visitation" terminology
 * - "Alimony" (not spousal support or maintenance)
 * - Equitable distribution — marital vs. non-marital property
 * - Filed in Circuit Court, Domestic Relations Division
 * - Case number label: "CASE NO."
 * - Parties: "Plaintiff" and "Defendant"
 */
class ArkansasDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'AR';
    this.stateName = 'Arkansas';
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

    // Arkansas — 60 days before filing, 3 months before decree
    this.residencyRequirements = {
      stateMonths: 2,
      countyMonths: 0,
      description: 'At least one party must have been a resident of Arkansas for at least sixty (60) days before filing and for three (3) months before the final decree is entered. (Ark. Code §9-12-307)'
    };

    // Arkansas waiting period — 30 days from filing
    this.waitingPeriod = {
      days: 30,
      startsFrom: 'filing_date',
      exceptions: [],
      description: 'No final decree of divorce shall be granted until at least thirty (30) days after the date the complaint is filed. (Ark. Code §9-12-307(b))'
    };
  }

  /**
   * Get Arkansas case number label — "CASE NO."
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'CASE NO.';
  }

  /**
   * Get default court for Arkansas county — Circuit Court
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `Circuit Court of ${countyName} County, Arkansas, Domestic Relations Division`;
  }

  /**
   * Generate Arkansas header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF ARKANSAS';
  }

  /**
   * Generate Arkansas venue — title case per Arkansas practice
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Get Arkansas jurisdiction statement — 60-day residency
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    return `Plaintiff has been a bona fide resident of the State of Arkansas for at least sixty (60) days immediately preceding the filing of this Complaint. (Ark. Code §9-12-307)`;
  }

  /**
   * Get Arkansas venue reason
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    return `Plaintiff resides in ${divorceData.county || '[COUNTY]'} County, Arkansas`;
  }

  /**
   * Generate Arkansas grounds section — both fault and no-fault
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Grounds section
   */
  generateGroundsSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 8;

    const grounds = divorceData.groundsForDivorce || 'separation_18_months';

    if (grounds === 'separation_18_months' || grounds === 'no_fault') {
      items.push({
        number: paragraphNum++,
        content: 'The parties have lived separate and apart for eighteen (18) consecutive months without cohabitation. (Ark. Code §9-12-301(b))',
        type: 'grounds'
      });
    } else if (grounds === 'adultery') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has committed adultery. (Ark. Code §9-12-301(a)(1))',
        type: 'grounds'
      });
    } else if (grounds === 'impotency') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant was impotent at the time of the marriage. (Ark. Code §9-12-301(a)(2))',
        type: 'grounds'
      });
    } else if (grounds === 'felony_conviction') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has been convicted of a felony or other infamous crime. (Ark. Code §9-12-301(a)(3))',
        type: 'grounds'
      });
    } else if (grounds === 'habitual_drunkenness') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has been habitually drunk for one (1) year. (Ark. Code §9-12-301(a)(4))',
        type: 'grounds'
      });
    } else if (grounds === 'cruel_treatment') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has been guilty of such cruel and barbarous treatment as to endanger the life of Plaintiff. (Ark. Code §9-12-301(a)(5))',
        type: 'grounds'
      });
    } else if (grounds === 'personal_indignities') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has offered such personal indignities to Plaintiff as to render Plaintiff\'s condition intolerable. (Ark. Code §9-12-301(a)(6))',
        type: 'grounds'
      });
    } else if (grounds === 'insanity') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has been incurably insane for a period of at least three (3) years. (Ark. Code §9-12-301(a)(7))',
        type: 'grounds'
      });
    } else {
      items.push({
        number: paragraphNum++,
        content: 'The parties have lived separate and apart for eighteen (18) consecutive months without cohabitation. (Ark. Code §9-12-301(b))',
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
   * Generate Arkansas children section — uses "joint custody" / "sole custody"
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
        content: 'Plaintiff requests the Court to determine custody of the minor child(ren) in the best interests of the child(ren) pursuant to Ark. Code §9-13-101. Arkansas law provides a presumption of joint custody.',
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
   * Generate Arkansas property section — equitable distribution
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
      content: 'The parties have accumulated marital property and debts during the marriage. Plaintiff requests that the Court equitably divide the marital property and debts pursuant to Ark. Code §9-12-315.',
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: 'Plaintiff requests the Court to consider the length of the marriage, the age and health of the parties, occupation and income, vocational skills, employability, the contribution of each party to the acquisition of property, and any other relevant factors.',
      type: 'property_info'
    });

    return {
      title: 'VI. PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Arkansas relief section — uses Arkansas-specific terminology
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Relief section
   */
  generateReliefSection(divorceData) {
    const items = [];

    items.push({
      number: null,
      content: 'WHEREFORE, Plaintiff prays that the Court:',
      type: 'relief_intro'
    });

    const reliefItems = [
      'Grant Plaintiff a Decree of Divorce;',
      'Equitably divide the marital property and debts pursuant to Ark. Code §9-12-315;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Determine custody of the minor child(ren) in the best interests of the child(ren) pursuant to Ark. Code §9-13-101;');
      reliefItems.push('Establish a visitation schedule;');
      reliefItems.push('Order child support in accordance with Ark. Admin. Order No. 10;');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award alimony to Plaintiff pursuant to Ark. Code §9-12-312;');
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
   * Get Arkansas verification text
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PLAINTIFF NAME]';
    return `I, ${name}, declare under penalty of perjury under the laws of the State of Arkansas that the facts stated in this Complaint are true and correct to the best of my knowledge and belief.

Date: ___________________

_________________________________
${name}
Plaintiff`;
  }

  /**
   * Perform Arkansas-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for Arkansas divorce complaints');
    }

    warnings.push('Arkansas requires 60 days of state residency before filing, and 3 months before the decree can be entered. (Ark. Code §9-12-307)');
    warnings.push('No final decree shall be granted until 30 days after the complaint is filed. (Ark. Code §9-12-307(b))');
    warnings.push('Arkansas law presumes joint custody. (Ark. Code §9-13-101)');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('A custody and visitation plan must be established per Ark. Code §9-13-101.');
      warnings.push('Child support must be calculated using Ark. Admin. Order No. 10.');
    }

    return { errors, warnings };
  }
}

module.exports = ArkansasDivorcePetitionTemplate;
