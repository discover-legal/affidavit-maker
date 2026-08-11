// templates/states/new_jersey/DivorcePetitionTemplate.js
// New Jersey-specific divorce complaint template
// Complies with N.J.S.A. 2A:34-2 et seq. (New Jersey divorce statutes)

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * New Jersey Complaint for Divorce Template
 *
 * Legal References:
 * - N.J.S.A. 2A:34-2 — Grounds for divorce
 * - N.J.S.A. 2A:34-10 — Residency requirements (1 year; 18 months for irreconcilable differences)
 * - N.J.S.A. 2A:34-23 — Alimony — types and factors
 * - N.J.S.A. 2A:34-23.1 — Equitable distribution of property
 * - N.J.S.A. 9:2-4 — Child custody — legal and residential custody
 * - N.J. Court Rule 5:6A — New Jersey Child Support Guidelines
 * - N.J. Court Rule 5:5-2 — Case Information Statement (required)
 *
 * Official Forms:
 * - Complaint for Divorce (no children) — Form A
 * - Complaint for Divorce (with children) — Form B
 * - Case Information Statement (CIS) — required filing
 *
 * New Jersey-Specific Notes:
 * - Filed in Superior Court, Chancery Division, Family Part
 * - Docket number format: FM-[county code]-[number]-[year]
 * - Case Information Statement (CIS) required with filing
 * - No mandatory waiting period; irreconcilable differences requires 6 months of irreconcilable differences
 * - 1-year residency (or 18 months for irreconcilable differences)
 * - Equitable distribution state (not community property)
 * - "Alimony" (several types) — not "maintenance" or "spousal support"
 */
class NewJerseyDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'NJ';
    this.stateName = 'New Jersey';
    this.documentTitle = 'COMPLAINT FOR DIVORCE';

    // Load metadata if available
    try {
      this.metadata = require('./divorce-metadata.json');
    } catch (e) {
      this.metadata = null;
    }

    // New Jersey-specific required fields
    this.requiredFields = [
      'petitionerName',
      'respondentName',
      'state',
      'county',
      'marriageDate',
      'groundsForDivorce'
    ];

    // New Jersey residency requirements per N.J.S.A. 2A:34-10
    this.residencyRequirements = {
      stateMonths: 12,
      countyDays: 0,
      description: 'One party must have been a bona fide resident of New Jersey for at least one (1) year immediately before filing, unless the ground is adultery committed in New Jersey or irreconcilable differences (which requires 18 months residency).'
    };

    // New Jersey waiting period — none for most grounds
    this.waitingPeriod = {
      days: 0,
      startsFrom: 'filing_date',
      exceptions: [],
      description: 'New Jersey has no mandatory waiting period. Irreconcilable differences requires an allegation of 6+ months of such differences.'
    };
  }

  /**
   * Get New Jersey case number label
   * @returns {string} "DOCKET NO."
   */
  getCaseNumberLabel() {
    return 'DOCKET NO.';
  }

  /**
   * Get default court for New Jersey county
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyUpper = (county || '[COUNTY]').toUpperCase();
    return `SUPERIOR COURT OF NEW JERSEY, CHANCERY DIVISION, FAMILY PART, ${countyUpper} COUNTY`;
  }

  /**
   * Generate New Jersey case caption
   * NJ uses Plaintiff/Defendant (not Petitioner/Respondent) in divorce
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    let caption = '';

    const courtName = divorceData.court || this.getDefaultCourt(divorceData.county);
    caption += `${courtName.toUpperCase()}\n\n`;

    const docketNum = divorceData.caseNumber || `FM-[COUNTY CODE]-______-${new Date().getFullYear()}`;
    caption += `DOCKET NO. ${docketNum}\n\n`;

    const plaintiff = (divorceData.petitionerName || '[PLAINTIFF NAME]').toUpperCase();
    const defendant = (divorceData.respondentName || '[DEFENDANT NAME]').toUpperCase();

    caption += `${plaintiff},\n`;
    caption += `     Plaintiff,\n\n`;
    caption += `v.\n\n`;
    caption += `${defendant},\n`;
    caption += `     Defendant.\n\n`;
    caption += this.documentTitle;

    return {
      courtName,
      caseNumber: divorceData.caseNumber,
      petitioner: divorceData.petitionerName,
      respondent: divorceData.respondentName,
      formatted: caption
    };
  }

  /**
   * Generate New Jersey jurisdiction statement per N.J.S.A. 2A:34-10
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    const plaintiff = divorceData.petitionerName || 'Plaintiff';
    const grounds = divorceData.groundsForDivorce || 'irreconcilable_differences';

    if (grounds === 'irreconcilable_differences') {
      return `${plaintiff} has been a bona fide resident of the State of New Jersey for at least eighteen (18) months immediately preceding the commencement of this action, as required by N.J.S.A. 2A:34-10, and continues to reside in ${divorceData.county || '[COUNTY]'} County.`;
    }
    if (grounds === 'adultery' && divorceData.adulteryCommittedInNJ) {
      return `The ground for divorce occurred within the State of New Jersey. Plaintiff resides in ${divorceData.county || '[COUNTY]'} County, New Jersey.`;
    }
    return `${plaintiff} has been a bona fide resident of the State of New Jersey for at least one (1) year immediately preceding the commencement of this action, as required by N.J.S.A. 2A:34-10, and resides in ${divorceData.county || '[COUNTY]'} County.`;
  }

  /**
   * Get venue reason for New Jersey
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    return 'Plaintiff resides in this county';
  }

  /**
   * Get New Jersey grounds text
   * Maps ground codes to New Jersey statutory language per N.J.S.A. 2A:34-2
   * @param {string} grounds - Grounds type
   * @param {Object} divorceData - Divorce data
   * @returns {string} Grounds text
   */
  getGroundsText(grounds, divorceData) {
    switch (grounds) {
      case 'irreconcilable_differences':
        return `Irreconcilable differences have caused the breakdown of the marriage for a period of at least six (6) months, and there is no reasonable prospect of reconciliation. (N.J.S.A. 2A:34-2(i))`;
      case 'separation':
        return `The parties have voluntarily lived separate and apart in different habitations for a period of at least eighteen (18) consecutive months immediately prior to the filing of this Complaint, and there is no reasonable prospect of reconciliation. (N.J.S.A. 2A:34-2(d))`;
      case 'adultery':
        return 'Defendant has committed adultery. (N.J.S.A. 2A:34-2(a))';
      case 'willful_desertion':
        return 'Defendant has willfully deserted Plaintiff for twelve (12) or more months, and Plaintiff has not consented to such desertion. (N.J.S.A. 2A:34-2(b))';
      case 'extreme_cruelty':
        return 'Defendant has been guilty of such extreme cruelty as to endanger the safety or health of Plaintiff, or to render it improper to require Plaintiff to continue to cohabit with Defendant. (N.J.S.A. 2A:34-2(c))';
      case 'addiction':
        return 'Defendant has been voluntarily addicted to or habituated to the use of narcotic drugs or habitually drunk since the marriage, beginning after the date of the marriage. (N.J.S.A. 2A:34-2(e))';
      case 'institutionalization':
        return `Defendant has been institutionalized for mental illness for a period of twenty-four (24) or more consecutive months after the marriage. (N.J.S.A. 2A:34-2(f))`;
      case 'imprisonment':
        return 'Defendant has been imprisoned for eighteen (18) or more consecutive months after the marriage, and the parties have not resumed cohabitation following the initial imprisonment. (N.J.S.A. 2A:34-2(g))';
      case 'deviant_sexual_conduct':
        return 'Defendant has engaged in deviant sexual conduct voluntarily performed by the Defendant without the consent of Plaintiff. (N.J.S.A. 2A:34-2(h))';
      default:
        return 'Irreconcilable differences have caused the breakdown of the marriage for a period of at least six (6) months, and there is no reasonable prospect of reconciliation. (N.J.S.A. 2A:34-2(i))';
    }
  }

  /**
   * Generate New Jersey children section
   * NJ uses "legal custody" / "residential custody" / "parenting time"
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Children section
   */
  generateChildrenSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 9;

    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      items.push({
        number: paragraphNum++,
        content: 'There are no children born of or adopted during this marriage who are unemancipated.',
        type: 'children_info'
      });
    } else {
      items.push({
        number: paragraphNum++,
        content: 'The following unemancipated children were born of or adopted during this marriage:',
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
        content: 'Plaintiff requests that the Court determine legal custody and residential custody of the unemancipated child(ren) in accordance with the best interests of the child(ren) pursuant to N.J.S.A. 9:2-4.',
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
   * Generate New Jersey property section using equitable distribution language
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property section
   */
  generatePropertySection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 14;

    items.push({
      number: paragraphNum++,
      content: 'During the marriage, the parties have acquired marital assets and may have incurred marital debts.',
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: 'Plaintiff requests that the Court make an equitable distribution of the marital assets and debts pursuant to N.J.S.A. 2A:34-23.1, considering the factors set forth therein.',
      type: 'property_request'
    });

    items.push({
      number: paragraphNum++,
      content: 'A Case Information Statement (CIS) is being filed simultaneously with this Complaint as required by N.J. Court Rule 5:5-2.',
      type: 'financial_disclosure'
    });

    return {
      title: 'VI. PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate New Jersey relief section using NJ terminology
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Relief section
   */
  generateReliefSection(divorceData) {
    const items = [];

    items.push({
      number: null,
      content: 'WHEREFORE, Plaintiff demands judgment:',
      type: 'relief_intro'
    });

    const reliefItems = [];

    reliefItems.push('Dissolving the marriage between Plaintiff and Defendant and granting a divorce;');
    reliefItems.push('Making an equitable distribution of the marital assets and debts pursuant to N.J.S.A. 2A:34-23.1;');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Determining legal and residential custody of the unemancipated child(ren) pursuant to N.J.S.A. 9:2-4;');
      reliefItems.push('Establishing a parenting time schedule for the non-residential parent;');
      reliefItems.push('Ordering child support in accordance with the New Jersey Child Support Guidelines (N.J. Court Rule 5:6A);');
      reliefItems.push('Ordering the maintenance of health insurance for the unemancipated child(ren);');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Awarding alimony to Plaintiff pursuant to N.J.S.A. 2A:34-23;');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`Restoring Plaintiff's former name to: ${divorceData.previousName};`);
    }

    reliefItems.push('Such other and further relief as the Court may deem equitable and just, together with costs of suit.');

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
   * Get New Jersey verification text
   * NJ uses a Certification per N.J. Court Rule 1:4-4(b)
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PLAINTIFF NAME]';
    return `CERTIFICATION

I, ${name}, Plaintiff, hereby certify that the foregoing statements made by me are true. I am aware that if any of the foregoing statements made by me are willfully false, I am subject to punishment.


_________________________________
${name}, Plaintiff

Date: ___________________`;
  }

  /**
   * Perform New Jersey-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for New Jersey divorce complaints');
    }

    const grounds = divorceData.groundsForDivorce || 'irreconcilable_differences';

    if (grounds === 'irreconcilable_differences') {
      warnings.push('New Jersey\'s irreconcilable differences ground (N.J.S.A. 2A:34-2(i)) requires one party to have been a bona fide NJ resident for 18 months (not just 12 months) and requires an allegation that the differences have existed for at least 6 months.');
    }

    warnings.push('New Jersey requires a Case Information Statement (CIS) to be filed simultaneously with the Complaint (N.J. Court Rule 5:5-2).');

    if (divorceData.hasMinorChildren === true) {
      warnings.push('New Jersey requires a parenting plan or custody agreement when minor children are involved.');
    }

    return { errors, warnings };
  }
}

module.exports = NewJerseyDivorcePetitionTemplate;
