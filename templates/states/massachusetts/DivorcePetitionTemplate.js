// templates/states/massachusetts/DivorcePetitionTemplate.js
// Massachusetts-specific divorce complaint template
// Complies with M.G.L. c. 208 (Massachusetts divorce statutes)

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Massachusetts Complaint for Divorce Template
 *
 * Legal References:
 * - M.G.L. c. 208, § 1 — Grounds for divorce (fault)
 * - M.G.L. c. 208, § 1A — Joint petition for divorce (irretrievable breakdown, mutual consent)
 * - M.G.L. c. 208, § 1B — Unilateral complaint for divorce (irretrievable breakdown)
 * - M.G.L. c. 208, § 5 — Residency requirements
 * - M.G.L. c. 208, § 21 — Nisi period (90 days before divorce absolute)
 * - M.G.L. c. 208, § 28 — Custody of children
 * - M.G.L. c. 208, § 34 — Property division (equitable distribution of all property)
 * - M.G.L. c. 208, § 48 et seq. — Alimony Reform Act
 * - Massachusetts Child Support Guidelines
 *
 * Official Forms:
 * - CJD-101 (Complaint for Divorce — fault grounds or § 1B)
 * - CJD-101A (Joint Petition for Divorce — § 1A)
 * - Financial Statement (Short Form CJD-301A or Long Form CJD-301)
 *
 * Massachusetts-Specific Notes:
 * - Filed in Probate and Family Court in county where either party lives
 * - "Commonwealth of Massachusetts" not "State of"
 * - 90-day nisi period after judgment before divorce is absolute
 * - § 1A (joint petition) — requires signed separation agreement at filing; one hearing
 * - § 1B (unilateral) — 6-month waiting period from filing before hearing
 * - Massachusetts divides ALL property equitably including pre-marital and inherited property
 * - Financial Statement required in all cases involving finances
 * - "Alimony" — types include general term, rehabilitative, reimbursement, transitional
 */
class MassachusettsDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'MA';
    this.stateName = 'Massachusetts';
    this.documentTitle = 'COMPLAINT FOR DIVORCE';

    // Load metadata if available
    try {
      this.metadata = require('./divorce-metadata.json');
    } catch (e) {
      this.metadata = null;
    }

    // Massachusetts-specific required fields
    this.requiredFields = [
      'petitionerName',
      'respondentName',
      'state',
      'county',
      'marriageDate',
      'groundsForDivorce'
    ];

    // Massachusetts residency requirements per M.G.L. c. 208, § 5
    this.residencyRequirements = {
      stateMonths: 0,
      countyDays: 0,
      description: 'If the cause of action arose in Massachusetts, plaintiff must be domiciled in Massachusetts. If the cause arose outside Massachusetts, one party must have been domiciled in Massachusetts for one (1) year preceding the complaint.'
    };

    // Massachusetts waiting period per M.G.L. c. 208, § 1B (for unilateral complaints)
    this.waitingPeriod = {
      days: 180,
      startsFrom: 'filing_date',
      exceptions: ['section_1a_joint_petition'],
      description: 'For unilateral complaints under § 1B, no hearing may be held until 6 months after the complaint is filed. For joint petitions under § 1A, there is no waiting period. Additionally, 90 days elapse between Judgment Nisi and the divorce becoming Absolute.'
    };
  }

  /**
   * Get Massachusetts case number label
   * @returns {string} "DOCKET NO."
   */
  getCaseNumberLabel() {
    return 'DOCKET NO.';
  }

  /**
   * Get default court for Massachusetts county
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `PROBATE AND FAMILY COURT DEPARTMENT, ${countyName.toUpperCase()} DIVISION`;
  }

  /**
   * Generate Massachusetts header — "COMMONWEALTH OF MASSACHUSETTS"
   * @returns {string} Header text
   */
  generateHeader() {
    return 'COMMONWEALTH OF MASSACHUSETTS';
  }

  /**
   * Generate Massachusetts venue
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    return `${(county || '[COUNTY]').toUpperCase()} COUNTY`;
  }

  /**
   * Generate Massachusetts case caption
   * Probate and Family Court format
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    let caption = '';

    const courtName = divorceData.court || this.getDefaultCourt(divorceData.county);
    caption += `${courtName.toUpperCase()}\n\n`;

    const docketNum = divorceData.caseNumber || '[DOCKET NUMBER]';
    caption += `DOCKET NO. ${docketNum}\n\n`;

    const plaintiff = (divorceData.petitionerName || '[PLAINTIFF NAME]').toUpperCase();
    const defendant = (divorceData.respondentName || '[DEFENDANT NAME]').toUpperCase();

    caption += `${plaintiff},\n`;
    caption += `     Plaintiff,\n\n`;
    caption += `v.\n\n`;
    caption += `${defendant},\n`;
    caption += `     Defendant.\n\n`;
    caption += this.documentTitle;

    // Indicate § 1A or § 1B
    const grounds = divorceData.groundsForDivorce || '';
    if (grounds === 'irretrievable_breakdown_joint') {
      caption += '\n(Joint Petition — M.G.L. c. 208, § 1A)';
    } else if (grounds === 'irretrievable_breakdown_unilateral' || grounds === 'irretrievable_breakdown') {
      caption += '\n(M.G.L. c. 208, § 1B)';
    }

    return {
      courtName,
      caseNumber: divorceData.caseNumber,
      petitioner: divorceData.petitionerName,
      respondent: divorceData.respondentName,
      formatted: caption
    };
  }

  /**
   * Generate Massachusetts jurisdiction statement per M.G.L. c. 208, § 5
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    const plaintiff = divorceData.petitionerName || 'Plaintiff';
    const county = divorceData.county || '[COUNTY]';

    return `${plaintiff} is domiciled in ${county} County, Commonwealth of Massachusetts, and has the requisite domicile and residency to maintain this action pursuant to M.G.L. c. 208, § 5. The Probate and Family Court for ${county} County has jurisdiction over this action.`;
  }

  /**
   * Get venue reason for Massachusetts
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    return 'Plaintiff is domiciled in this county';
  }

  /**
   * Get Massachusetts grounds text
   * Maps ground codes to Massachusetts statutory language
   * @param {string} grounds - Grounds type
   * @param {Object} divorceData - Divorce data
   * @returns {string} Grounds text
   */
  getGroundsText(grounds, divorceData) {
    switch (grounds) {
      case 'irretrievable_breakdown_joint':
      case 'irretrievable_breakdown':
      case 'irreconcilable_differences':
        return 'There has been an irretrievable breakdown of the marriage, and there is no reasonable likelihood that the marriage can be preserved. (M.G.L. c. 208, § 1B)';
      case 'irretrievable_breakdown_unilateral':
        return 'There has been an irretrievable breakdown of the marriage. (M.G.L. c. 208, § 1B) Plaintiff requests that no hearing be scheduled for 6 months from the date this Complaint is filed.';
      case 'adultery':
        return 'The Defendant has committed adultery. (M.G.L. c. 208, § 1)';
      case 'impotency':
        return 'The Defendant was impotent at the time of the marriage. (M.G.L. c. 208, § 1)';
      case 'utter_desertion':
        return 'The Defendant has utterly deserted Plaintiff for a period of five (5) years. (M.G.L. c. 208, § 1)';
      case 'gross_intoxication':
        return 'The Defendant has gross and confirmed habits of intoxication caused by the voluntary use of intoxicating liquor, opium, or other drug. (M.G.L. c. 208, § 1)';
      case 'cruel_abusive_treatment':
        return 'The Defendant has been guilty of cruel and abusive treatment of Plaintiff. (M.G.L. c. 208, § 1)';
      case 'imprisonment':
        return 'The Defendant has been sentenced to confinement in a correctional facility for five (5) or more years. (M.G.L. c. 208, § 1)';
      case 'nonsupport':
        return 'The Defendant has grossly, wantonly, and cruelly refused or neglected to provide suitable maintenance for Plaintiff. (M.G.L. c. 208, § 1)';
      default:
        return 'There has been an irretrievable breakdown of the marriage. (M.G.L. c. 208, § 1B)';
    }
  }

  /**
   * Generate Massachusetts children section
   * MA uses "legal custody" / "physical custody" terminology
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Children section
   */
  generateChildrenSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 9;

    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      items.push({
        number: paragraphNum++,
        content: 'There are no minor children of this marriage.',
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
        const birthDate = typeof child === 'object' ? this.formatDate(child.birthDate) : null;
        items.push({
          number: paragraphNum++,
          content: birthDate ? `${childName}, born ${birthDate}` : childName,
          type: 'child_detail'
        });
      });

      items.push({
        number: paragraphNum++,
        content: 'Plaintiff requests that the Court award custody of the minor child(ren) in the best interests of the child(ren) pursuant to M.G.L. c. 208, § 28, and establish appropriate child support in accordance with the Massachusetts Child Support Guidelines.',
        type: 'custody_request'
      });
    }

    return {
      title: 'V. CHILDREN',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Massachusetts property section
   * MA divides ALL property equitably — including pre-marital and inherited
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property section
   */
  generatePropertySection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 14;

    items.push({
      number: paragraphNum++,
      content: 'During the marriage, the parties have accumulated property and may have incurred debts.',
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: 'Plaintiff requests that the Court make an equitable division of all property, both marital and separate, pursuant to M.G.L. c. 208, § 34, considering all relevant factors including the length of the marriage, the conduct of the parties, the contribution of each party, the age, health, station, occupation, amount and sources of income, vocational skills, employability, estate, liabilities, and needs of each party.',
      type: 'property_request'
    });

    items.push({
      number: paragraphNum++,
      content: 'The parties are required to file a Financial Statement in this matter. Plaintiff\'s Financial Statement is being filed herewith.',
      type: 'financial_disclosure'
    });

    return {
      title: 'VI. PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Massachusetts relief section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Relief section
   */
  generateReliefSection(divorceData) {
    const items = [];

    items.push({
      number: null,
      content: 'WHEREFORE, Plaintiff respectfully requests that this Court:',
      type: 'relief_intro'
    });

    const reliefItems = [];

    reliefItems.push('Issue a Judgment of Divorce Nisi, and after 90 days, a Judgment of Divorce Absolute, dissolving the marriage between Plaintiff and Defendant;');
    reliefItems.push('Make an equitable division of all property of the parties pursuant to M.G.L. c. 208, § 34;');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Award legal and physical custody of the minor child(ren) in the best interests of the child(ren) pursuant to M.G.L. c. 208, § 28;');
      reliefItems.push('Order child support in accordance with the Massachusetts Child Support Guidelines;');
      reliefItems.push('Order the maintenance of health insurance for the minor child(ren);');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award alimony to Plaintiff pursuant to M.G.L. c. 208, § 48 et seq.;');
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
   * Get Massachusetts verification text
   * Uses the Massachusetts "signed under the penalties of perjury" formulation
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PLAINTIFF NAME]';
    return `I, ${name}, Plaintiff, hereby state under the penalties of perjury that the foregoing is true and correct to the best of my knowledge and belief.

Signed under the penalties of perjury this ___ day of _______________, 20___.


_________________________________
${name}, Plaintiff`;
  }

  /**
   * Perform Massachusetts-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for Massachusetts divorce complaints');
    }

    const grounds = divorceData.groundsForDivorce || '';

    if (grounds === 'irretrievable_breakdown_joint' || grounds === 'irretrievable_breakdown') {
      warnings.push('A § 1A Joint Petition requires a signed Separation Agreement to be filed simultaneously with the Joint Petition.');
    }

    if (grounds === 'irretrievable_breakdown_unilateral') {
      warnings.push('A § 1B Complaint requires a 6-month waiting period from filing before a hearing may be held on the complaint.');
    }

    warnings.push('Massachusetts requires all parties to file a Financial Statement (short or long form) in cases involving property, support, or custody.');
    warnings.push('The 90-day nisi period begins when the Judgment of Divorce Nisi enters. The divorce is not absolute until 90 days later (M.G.L. c. 208, § 21).');

    return { errors, warnings };
  }
}

module.exports = MassachusettsDivorcePetitionTemplate;
