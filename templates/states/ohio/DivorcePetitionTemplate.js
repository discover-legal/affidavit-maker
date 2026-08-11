// templates/states/ohio/DivorcePetitionTemplate.js
// Ohio-specific divorce complaint template
// Complies with R.C. § 3105.01 et seq. (Ohio Divorce statutes)

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Ohio Complaint for Divorce Template
 *
 * Legal References:
 * - R.C. § 3105.01 — Grounds for divorce
 * - R.C. § 3105.03 — Residency requirements (6 months state, 90 days county)
 * - R.C. § 3105.10 — Waiting period (42 days from service)
 * - R.C. § 3105.171 — Division of marital and separate property (equitable distribution)
 * - R.C. § 3105.18 — Spousal support
 * - R.C. § 3109.04 — Parental rights and responsibilities
 * - R.C. § 3119.021 — Ohio Child Support Guidelines
 *
 * Ohio-Specific Notes:
 * - Court of Common Pleas, Domestic Relations Division
 * - 42-day waiting period from service of process
 * - Equitable (not community) property state
 * - "Spousal Support" (not alimony)
 * - "Parental Rights and Responsibilities" / "Shared Parenting"
 * - Ohio also offers Dissolution of Marriage (R.C. § 3105.61) — no-fault, mutual consent alternative
 * - Incompatibility ground (R.C. § 3105.01(K)) is barred if denied by either party; both must decline to contest it
 */
class OhioDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'OH';
    this.stateName = 'Ohio';
    this.documentTitle = 'COMPLAINT FOR DIVORCE';

    // Load metadata if available
    try {
      this.metadata = require('./divorce-metadata.json');
    } catch (e) {
      this.metadata = null;
    }

    // Ohio-specific required fields
    this.requiredFields = [
      'petitionerName',
      'respondentName',
      'state',
      'county',
      'marriageDate',
      'groundsForDivorce'
    ];

    // Ohio residency requirements per R.C. § 3105.03
    this.residencyRequirements = {
      stateMonths: 6,
      countyDays: 90,
      description: 'Plaintiff or Defendant must have been a resident of Ohio for at least 6 months AND a resident of the county for at least 90 days immediately before filing.'
    };

    // Ohio waiting period per R.C. § 3105.10
    this.waitingPeriod = {
      days: 42,
      startsFrom: 'service_of_process',
      exceptions: [],
      description: 'The court may not hear a divorce action sooner than 42 days after service of process on the defendant.'
    };
  }

  /**
   * Get Ohio case number label
   * @returns {string} "CASE NO."
   */
  getCaseNumberLabel() {
    return 'CASE NO.';
  }

  /**
   * Get default court for Ohio county
   * Ohio Revised Code § 3105.03 — Court of Common Pleas, Domestic Relations Division
   * Standard Ohio court caption format: Division before county name
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyUpper = (county || '[COUNTY]').toUpperCase();
    return `COURT OF COMMON PLEAS, DOMESTIC RELATIONS DIVISION, ${countyUpper} COUNTY, OHIO`;
  }

  /**
   * Generate Ohio case caption
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    let caption = '';

    const courtName = divorceData.court || this.getDefaultCourt(divorceData.county);
    caption += `IN THE ${courtName.toUpperCase()}\n\n`;

    const caseNumber = divorceData.caseNumber || '[CASE NUMBER]';
    caption += `CASE NO. ${caseNumber}\n\n`;

    const petitioner = (divorceData.petitionerName || '[PETITIONER NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();

    caption += `${petitioner},\n`;
    caption += `     Plaintiff,\n\n`;
    caption += `v.\n\n`;
    caption += `${respondent},\n`;
    caption += `     Defendant.`;

    return {
      courtName,
      caseNumber: divorceData.caseNumber,
      petitioner: divorceData.petitionerName,
      respondent: divorceData.respondentName,
      formatted: caption
    };
  }

  /**
   * Generate Ohio jurisdiction statement per R.C. § 3105.03
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    const petitioner = divorceData.petitionerName || 'Plaintiff';
    return `${petitioner} has been a resident of the State of Ohio for at least six (6) months and a resident of ${divorceData.county || '[COUNTY]'} County, Ohio for at least ninety (90) days immediately preceding the filing of this Complaint, as required by R.C. § 3105.03.`;
  }

  /**
   * Get venue reason for Ohio
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    return 'Plaintiff resides in this county and has satisfied the 90-day county residency requirement of R.C. § 3105.03';
  }

  /**
   * Get Ohio grounds text
   * Maps ground codes to Ohio statutory language per R.C. § 3105.01
   * @param {string} grounds - Grounds type
   * @param {Object} divorceData - Divorce data
   * @returns {string} Grounds text
   */
  getGroundsText(grounds, divorceData) {
    // Statute subsection letters per R.C. § 3105.01:
    // (A) prior undissolved marriage, (B) willful absence, (C) adultery,
    // (D) extreme cruelty, (E) fraudulent contract, (F) gross neglect,
    // (G) habitual drunkenness, (H) imprisonment, (I) out-of-state divorce,
    // (J) separation one year, (K) incompatibility
    switch (grounds) {
      case 'incompatibility':
        return 'The parties are incompatible. (R.C. § 3105.01(K))';
      case 'separation':
        return 'The parties have lived separate and apart without cohabitation for a continuous period of one (1) year. (R.C. § 3105.01(J))';
      case 'prior_undissolved_marriage':
        return 'Either party had a husband or wife living at the time of the marriage from which the divorce is sought. (R.C. § 3105.01(A))';
      case 'willful_absence':
        return 'The Defendant has been willfully absent from the marital home for a continuous period of one (1) year. (R.C. § 3105.01(B))';
      case 'adultery':
        return 'The Defendant has committed adultery. (R.C. § 3105.01(C))';
      case 'extreme_cruelty':
        return 'The Defendant has been guilty of extreme cruelty toward the Plaintiff. (R.C. § 3105.01(D))';
      case 'fraudulent_contract':
        return 'The marriage was entered into by fraudulent contract. (R.C. § 3105.01(E))';
      case 'gross_neglect':
        return 'The Defendant has been guilty of gross neglect of duty toward the Plaintiff. (R.C. § 3105.01(F))';
      case 'habitual_drunkenness':
        return 'The Defendant has been guilty of habitual drunkenness. (R.C. § 3105.01(G))';
      case 'imprisonment':
        return 'The Defendant has been imprisoned in a state or federal correctional institution at the time of the filing of this Complaint. (R.C. § 3105.01(H))';
      case 'out_of_state_divorce':
        return 'The Defendant has procured a divorce outside the State of Ohio. (R.C. § 3105.01(I))';
      case 'irreconcilable_differences':
      default:
        return 'The parties are incompatible. (R.C. § 3105.01(K))';
    }
  }

  /**
   * Generate Ohio children section using Ohio custody terminology
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Children section
   */
  generateChildrenSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 9;

    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      items.push({
        number: paragraphNum++,
        content: 'There are no minor children born of or adopted during this marriage.',
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
        content: 'Plaintiff requests that the Court allocate parental rights and responsibilities for the care of the minor child(ren) pursuant to R.C. § 3109.04.',
        type: 'custody_request'
      });
    }

    return {
      title: 'V. MINOR CHILDREN',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Ohio property section using equitable distribution language
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property section
   */
  generatePropertySection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 14;

    items.push({
      number: paragraphNum++,
      content: 'During the marriage, the parties have acquired marital property and may have incurred marital debts.',
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: 'Plaintiff requests that the Court divide and distribute the marital property and marital debt in an equitable manner pursuant to R.C. § 3105.171, with each party retaining their respective separate property.',
      type: 'property_request'
    });

    return {
      title: 'VI. PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Ohio relief section
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

    reliefItems.push('Grant a divorce dissolving the marriage between Plaintiff and Defendant;');
    reliefItems.push('Make an equitable division of the marital property and marital debt pursuant to R.C. § 3105.171;');
    reliefItems.push('Confirm each party\'s separate property to that party;');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Allocate parental rights and responsibilities for the care of the minor child(ren) pursuant to R.C. § 3109.04;');
      reliefItems.push('Order child support in accordance with the Ohio Child Support Guidelines (R.C. § 3119.021);');
      reliefItems.push('Order the parties to maintain health insurance for the minor child(ren);');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award spousal support to Plaintiff pursuant to R.C. § 3105.18;');
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
        letter: letter
      });
    });

    return {
      title: 'VII. PRAYER FOR RELIEF',
      items,
      nextParagraphNumber: null
    };
  }

  /**
   * Get Ohio verification text
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PLAINTIFF NAME]';
    return `I, ${name}, Plaintiff, being first duly sworn, state that the allegations of this Complaint are true and correct to the best of my knowledge and belief.


_________________________________
${name}, Plaintiff

Sworn to before me and subscribed in my presence this ___ day of _______________, 20___.


_________________________________
Notary Public, State of Ohio

My commission expires: ___________`;
  }

  /**
   * Perform Ohio-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for Ohio divorce complaints');
    }

    if (divorceData.groundsForDivorce === 'incompatibility') {
      warnings.push('Ohio\'s incompatibility ground (R.C. § 3105.01(K)) requires that both parties do not deny incompatibility. If Defendant denies incompatibility, a different ground must be asserted.');
    }

    warnings.push('Ohio has a 42-day waiting period from service of process before the court may hear a divorce action (R.C. § 3105.10).');
    warnings.push('Consider whether a Dissolution of Marriage (R.C. § 3105.61) may be more appropriate if both parties are in agreement.');

    return { errors, warnings };
  }
}

module.exports = OhioDivorcePetitionTemplate;
