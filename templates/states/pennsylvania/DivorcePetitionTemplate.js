// templates/states/pennsylvania/DivorcePetitionTemplate.js
// Pennsylvania-specific Complaint in Divorce template
// Complies with 23 Pa.C.S. § 3101 et seq. (Pennsylvania Divorce Code)

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Pennsylvania Complaint in Divorce Template
 *
 * Legal References:
 * - 23 Pa.C.S. § 3101 et seq. (Pennsylvania Divorce Code)
 * - 23 Pa.C.S. § 3104 (Jurisdiction — 6-month residency requirement)
 * - 23 Pa.C.S. § 3301 (Grounds for divorce)
 * - 23 Pa.C.S. § 3301(c) (Mutual consent — 90-day waiting period)
 * - 23 Pa.C.S. § 3301(d) (One-year separation — unilateral no-fault; amended Dec. 2016 from 2 years to 1 year)
 * - 23 Pa.C.S. § 3502 (Equitable distribution of marital property)
 * - 23 Pa.C.S. § 3701 (Alimony)
 * - 23 Pa.C.S. § 3702 (Alimony Pendente Lite)
 * - 23 Pa.C.S. § 4322 (Child support guidelines)
 * - 23 Pa.C.S. § 5321 et seq. (Child custody)
 *
 * Pennsylvania-Specific Notes:
 * - Document is called "COMPLAINT IN DIVORCE" (not Petition)
 * - Filed in Court of Common Pleas of the appropriate county
 * - Case number label: "DOCKET NO."
 * - 6-month state residency required
 * - Two no-fault grounds: mutual consent (90 days from service) or 1-year separation (§ 3301(d), as amended Dec. 2016)
 * - Equitable distribution state (not community property)
 * - Alimony Pendente Lite available during proceedings
 */
class PennsylvaniaDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'PA';
    this.stateName = 'Pennsylvania';
    this.documentTitle = 'COMPLAINT IN DIVORCE';

    // Load metadata if available
    try {
      this.metadata = require('./divorce-metadata.json');
    } catch (e) {
      this.metadata = null;
    }

    // Pennsylvania-specific required fields
    this.requiredFields = [
      'petitionerName',
      'respondentName',
      'state',
      'county',
      'marriageDate',
      'groundsForDivorce'
    ];

    // Pennsylvania residency requirements (23 Pa.C.S. § 3104(b))
    this.residencyRequirements = {
      stateMonths: 6,
      countyDays: 0,
      description: 'At least one party must have been a bona fide resident of Pennsylvania for at least six months before filing.'
    };

    // Pennsylvania waiting period depends on grounds
    this.waitingPeriod = {
      days: 90, // Minimum for mutual consent
      startsFrom: 'date_of_service',
      description: '90 days from service of Complaint for mutual consent divorce (§ 3301(c)). 1-year separation for unilateral no-fault (§ 3301(d), as amended effective December 2016).'
    };

    // Pennsylvania formatting requirements
    this.formatting = {
      fontSize: '12pt',
      fontFamily: 'Times New Roman',
      lineHeight: '2',
      margin: '1in',
      paperSize: '8.5in x 11in'
    };
  }

  /**
   * Get Pennsylvania case number label — "DOCKET NO."
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'DOCKET NO.';
  }

  /**
   * Get default court for Pennsylvania county
   * Pennsylvania divorce is filed in the Court of Common Pleas (23 Pa.C.S. § 3104)
   * Full court name includes "Pennsylvania" for self-contained identification
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `COURT OF COMMON PLEAS OF ${countyName.toUpperCase()} COUNTY, PENNSYLVANIA`;
  }

  /**
   * Generate Pennsylvania-style header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'COMMONWEALTH OF PENNSYLVANIA';
  }

  /**
   * Generate Pennsylvania venue
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyUpper = (county || '[COUNTY]').toUpperCase();
    return `COUNTY OF ${countyUpper}`;
  }

  /**
   * Generate Pennsylvania case caption
   * Pennsylvania uses plaintiff/defendant style for divorce complaints
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    let caption = '';

    const courtName = divorceData.court || this.getDefaultCourt(divorceData.county);
    caption += `IN THE ${courtName.toUpperCase()}\n\n`;

    // Pennsylvania uses "DOCKET NO."
    caption += `DOCKET NO. ${divorceData.caseNumber || '____________________'}\n\n`;

    // Pennsylvania uses Plaintiff/Defendant in divorce complaints
    const petitioner = (divorceData.petitionerName || '[PETITIONER NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();

    caption += `${petitioner},\n`;
    caption += `     Plaintiff,\n\n`;
    caption += `v.\n\n`;
    caption += `${respondent},\n`;
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
   * Generate Pennsylvania jurisdiction statement
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    const petitioner = divorceData.petitionerName || 'Plaintiff';
    return `${petitioner} has been a bona fide resident of the Commonwealth of Pennsylvania for a period of at least six (6) months immediately preceding the filing of this Complaint, satisfying the residency requirement of 23 Pa.C.S. § 3104.`;
  }

  /**
   * Get venue reason for Pennsylvania
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    return `the Plaintiff resides in ${divorceData.county || '[COUNTY]'} County, Pennsylvania`;
  }

  /**
   * Generate Pennsylvania grounds text
   * Pennsylvania has no-fault (mutual consent / separation) and fault-based grounds
   * @param {string} grounds - Grounds code
   * @param {Object} divorceData - Divorce data
   * @returns {string} Grounds text
   */
  getGroundsText(grounds, divorceData) {
    switch (grounds) {
      case 'mutual_consent':
        return 'The marriage is irretrievably broken, and both parties consent to the divorce. Pursuant to 23 Pa.C.S. § 3301(c), Plaintiff requests that after ninety (90) days from the date of service of this Complaint, both parties shall file Affidavits of Consent evidencing their desire to proceed with the divorce.';

      case 'separation':
        return `The parties have been living separate and apart for a period of at least one (1) year, and the marriage is irretrievably broken, pursuant to 23 Pa.C.S. § 3301(d). The parties separated on or about ${this.formatDate(divorceData.separationDate) || '[DATE OF SEPARATION]'}.`;

      case 'desertion':
        return 'Defendant has willfully and maliciously deserted Plaintiff, and has absented from Plaintiff\'s habitation, for and during the period of one or more years, pursuant to 23 Pa.C.S. § 3301(a)(1).';

      case 'adultery':
        return 'Defendant has committed adultery, pursuant to 23 Pa.C.S. § 3301(a)(2).';

      case 'cruelty':
        return 'Defendant has by cruel and barbarous treatment endangered the life or health of Plaintiff and rendered cohabitation unsafe, pursuant to 23 Pa.C.S. § 3301(a)(3).';

      case 'bigamy':
        return 'Defendant has knowingly entered into a bigamous marriage while a former marriage to another person was still subsisting, pursuant to 23 Pa.C.S. § 3301(a)(4).';

      case 'imprisonment':
        return 'Defendant has been sentenced to imprisonment for a term of two or more years upon conviction of crime, pursuant to 23 Pa.C.S. § 3301(a)(5).';

      case 'indignities':
        return 'Defendant has offered such indignities to the person of Plaintiff as to render Plaintiff\'s condition intolerable and life burdensome, pursuant to 23 Pa.C.S. § 3301(a)(6).';

      default:
        return 'The marriage is irretrievably broken, and both parties consent to the divorce pursuant to 23 Pa.C.S. § 3301(c).';
    }
  }

  /**
   * Generate Pennsylvania children section
   * Uses "Legal Custody" and "Physical Custody" terminology
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
        content: 'The following children were born of or adopted during this marriage:',
        type: 'children_info'
      });

      divorceData.children.forEach((child, index) => {
        const childName = typeof child === 'string' ? child : (child.name || '[CHILD NAME]');
        const birthDate = typeof child === 'object' ? this.formatDate(child.birthDate ?? child.dob ?? child.dateOfBirth) : null;
        items.push({
          number: paragraphNum++,
          content: birthDate
            ? `${childName}, born ${birthDate}`
            : childName,
          type: 'child_detail'
        });
      });

      items.push({
        number: paragraphNum++,
        content: 'Plaintiff requests that the Court enter appropriate orders regarding Legal Custody, Physical Custody, and partial physical custody of the minor child(ren) in the best interests of the child(ren), pursuant to 23 Pa.C.S. § 5321 et seq.',
        type: 'custody_request'
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
   * Generate Pennsylvania property section
   * Pennsylvania is an equitable distribution state
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
    let paragraphNum = divorceData._paragraphNum || 13;

    items.push({
      number: paragraphNum++,
      content: 'During the marriage, the parties acquired marital property and/or incurred marital debts.',
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: 'Plaintiff requests that the Court equitably divide the marital property pursuant to 23 Pa.C.S. § 3502, having due regard for the rights of each party.',
      type: 'property_request'
    });

    items.push({
      number: paragraphNum++,
      content: 'Plaintiff requests that the Court equitably allocate responsibility for the marital debts of the parties.',
      type: 'debt_request'
    });

    return {
      title: 'VI. PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Pennsylvania relief section
   * Uses Pennsylvania-specific terminology for alimony and custody
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

    reliefItems.push('Grant a Decree in Divorce dissolving the bonds of matrimony between Plaintiff and Defendant;');
    reliefItems.push('Equitably divide the marital property of the parties pursuant to 23 Pa.C.S. § 3502;');
    reliefItems.push('Equitably allocate marital debts between the parties;');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Determine Legal Custody and Physical Custody of the minor child(ren) in the best interests of the child(ren);');
      reliefItems.push('Establish a custody and partial physical custody schedule;');
      reliefItems.push('Order child support in accordance with the Pennsylvania Child Support Guidelines, 23 Pa.C.S. § 4322;');
      reliefItems.push('Order medical insurance coverage for the minor child(ren);');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award Alimony Pendente Lite to Plaintiff during the pendency of these proceedings, pursuant to 23 Pa.C.S. § 3702;');
      reliefItems.push('Award Alimony to Plaintiff, pursuant to 23 Pa.C.S. § 3701;');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`Restore Plaintiff's former name to: ${divorceData.previousName};`);
    }

    reliefItems.push('Award such other and further relief as the Court deems just and appropriate.');

    // Agreed corollary relief (agreed support amount, spousal-support

    // waiver, property agreement) — spliced before the final general prayer.

    this.appendAgreedReliefItems(reliefItems, divorceData);


    reliefItems.forEach((relief, index) => {
      const letter = String.fromCharCode(97 + index); // a, b, c...
      items.push({
        number: null,
        content: relief,
        type: 'relief_item',
        style: 'letter',
        letter
      });
    });

    return {
      title: 'VII. PRAYER FOR RELIEF',
      items,
      nextParagraphNumber: null
    };
  }

  /**
   * Get Pennsylvania verification text
   * Pennsylvania uses a statutory verification pursuant to 18 Pa.C.S. § 4904
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PETITIONER NAME]';
    return `I, ${name}, Plaintiff, verify that the statements made in this Complaint in Divorce are true and correct. I understand that false statements herein are made subject to the penalties of 18 Pa.C.S. § 4904, relating to unsworn falsification to authorities.

_________________________________
${name}, Plaintiff

Date: ___________________`;
  }

  /**
   * Perform Pennsylvania-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    // Pennsylvania requires county
    if (!divorceData.county) {
      errors.push('County is required for Pennsylvania divorce complaints');
    }

    // Warn about mutual consent procedure
    if (divorceData.groundsForDivorce === 'mutual_consent' || !divorceData.groundsForDivorce) {
      warnings.push('Pennsylvania mutual consent divorce (§ 3301(c)) requires both parties to file Affidavits of Consent after 90 days from service of the Complaint.');
    }

    // Warn about 1-year separation
    if (divorceData.groundsForDivorce === 'separation') {
      warnings.push('One-year separation ground (§ 3301(d), as amended effective December 2016) requires parties to have lived separate and apart for at least 1 full year.');
      if (!divorceData.separationDate) {
        warnings.push('Date of separation should be provided when relying on the one-year separation ground.');
      }
    }

    // Warn about Financial Information
    warnings.push('Pennsylvania courts typically require an Income and Expense Statement when alimony or support is claimed.');

    // Warn about local rules
    warnings.push('Pennsylvania divorce procedures vary by county. Check local county rules for additional filing requirements (some counties require a cover sheet, inventory form, etc.).');

    return { errors, warnings };
  }
}

module.exports = PennsylvaniaDivorcePetitionTemplate;
