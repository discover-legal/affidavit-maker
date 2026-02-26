// templates/states/newyork/DivorcePetitionTemplate.js
// New York-specific divorce petition (Verified Complaint) template
// Complies with New York Domestic Relations Law and CPLR

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * New York Summons with Notice and Verified Complaint for Divorce
 *
 * Legal References:
 * - New York Domestic Relations Law (DRL)
 * - Civil Practice Law and Rules (CPLR)
 * - DRL § 170 (Grounds for divorce)
 * - DRL § 230 (Residence requirements)
 *
 * Official Forms (UD Series - Uncontested Divorce):
 * - UD-1/UD-1a: Summons with Notice
 * - UD-2: Verified Complaint
 * - UD-3: Affidavit of Service
 * - UD-4: Sworn Statement (Barriers to Remarriage)
 * - UD-5: Affirmation of Regularity
 * - UD-6: Affidavit of Plaintiff
 * - UD-7: Affidavit of Defendant
 * - UD-8 series: Support worksheets
 * - UD-10: Findings of Fact/Conclusions of Law
 * - UD-11: Judgment of Divorce
 *
 * Formatting Requirements (CPLR 2101):
 * - 8.5" x 11" paper
 * - 1" margins minimum
 * - 12-point font minimum
 * - Double-spaced
 *
 * New York-Specific Notes:
 * - Complex residency requirements (1-2 years depending on circumstances)
 * - Uses "Plaintiff" and "Defendant" not "Petitioner" and "Respondent"
 * - "Irretrievable breakdown" for 6+ months is no-fault ground
 * - Joint filing available as of January 2025
 */
class NewYorkDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'NY';
    this.stateName = 'New York';
    this.documentTitle = 'VERIFIED COMPLAINT FOR DIVORCE';

    // Load metadata if available
    try {
      this.metadata = require('./divorce-metadata.json');
    } catch (e) {
      this.metadata = null;
    }

    // New York uses different terminology
    this.petitionerLabel = 'Plaintiff';
    this.respondentLabel = 'Defendant';

    // New York-specific required fields
    this.requiredFields = [
      'petitionerName', // Called Plaintiff in NY
      'respondentName', // Called Defendant in NY
      'state',
      'county',
      'marriageDate'
    ];

    // New York residency requirements (complex)
    this.residencyRequirements = {
      options: [
        {
          yearsRequired: 2,
          description: 'Either spouse lived in New York for 2 continuous years before filing'
        },
        {
          yearsRequired: 1,
          additionalRequirement: 'married_in_ny',
          description: 'Either spouse lived in NY for 1 year AND were married in NY'
        },
        {
          yearsRequired: 1,
          additionalRequirement: 'lived_as_married_in_ny',
          description: 'Either spouse lived in NY for 1 year AND once lived as married couple in NY'
        },
        {
          yearsRequired: 1,
          additionalRequirement: 'cause_in_ny',
          description: 'Either spouse lived in NY for 1 year AND grounds arose in NY'
        },
        {
          yearsRequired: 0,
          additionalRequirement: 'cause_in_ny_both_live',
          description: 'Grounds arose in NY AND both currently live in state'
        }
      ],
      description: 'New York has complex residency requirements. One of the above conditions must be met.'
    };

    // New York waiting period
    this.waitingPeriod = {
      days: 0,
      irretrievablyBrokenPeriod: 6, // months
      description: 'No mandatory waiting period, but for no-fault divorce, marriage must be irretrievably broken for at least 6 months.'
    };

    // New York formatting requirements (CPLR 2101)
    this.formatting = {
      fontSize: '12pt',
      fontFamily: 'Times New Roman',
      lineHeight: '2',
      margin: '1in',
      paperSize: '8.5in x 11in'
    };

    // New York form numbers (UD series)
    this.formNumbers = {
      summons: 'UD-1',
      complaint: 'UD-2',
      affidavitOfService: 'UD-3',
      barriersStatement: 'UD-4',
      affirmationOfRegularity: 'UD-5',
      affidavitOfPlaintiff: 'UD-6',
      affidavitOfDefendant: 'UD-7',
      incomeWorksheet: 'UD-8(1)',
      maintenanceWorksheet: 'UD-8(2)',
      childSupportWorksheet: 'UD-8(3)',
      findingsOfFact: 'UD-10',
      judgment: 'UD-11'
    };
  }

  /**
   * Get New York case number label
   * @returns {string} "Index No.:"
   */
  getCaseNumberLabel() {
    return 'Index No.:';
  }

  /**
   * Get default court for New York county
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    return `Supreme Court of the State of New York, County of ${county || '[COUNTY]'}`;
  }

  /**
   * Generate New York-style header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'SUPREME COURT OF THE STATE OF NEW YORK';
  }

  /**
   * Generate New York case caption
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    let caption = '';

    // Court
    caption += `SUPREME COURT OF THE STATE OF NEW YORK\n`;
    caption += `COUNTY OF ${(divorceData.county || '[COUNTY]').toUpperCase()}\n`;
    caption += `- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -x\n\n`;

    // Parties (NY uses Plaintiff/Defendant)
    const plaintiff = divorceData.petitionerName || '[PLAINTIFF NAME]';
    const defendant = divorceData.respondentName || '[DEFENDANT NAME]';

    caption += `${plaintiff.toUpperCase()},\n`;
    caption += `                                              Plaintiff,\n\n`;
    caption += `        -against-\n\n`;
    caption += `${defendant.toUpperCase()},\n`;
    caption += `                                              Defendant.\n\n`;

    caption += `- - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - - -x\n\n`;

    // Index number
    caption += `Index No.: ${divorceData.caseNumber || '____________________'}\n\n`;

    // Document title
    caption += this.documentTitle;

    return {
      courtName: this.getDefaultCourt(divorceData.county),
      caseNumber: divorceData.caseNumber,
      petitioner: divorceData.petitionerName,
      respondent: divorceData.respondentName,
      formatted: caption
    };
  }

  /**
   * Generate New York jurisdiction statement
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    const plaintiff = divorceData.petitionerName || 'Plaintiff';

    // Determine which residency basis applies
    if (divorceData.residencyBasis === 'two_years') {
      return `${plaintiff} has resided in the State of New York for a continuous period of at least two years immediately preceding the commencement of this action.`;
    }
    if (divorceData.residencyBasis === 'one_year_married_in_ny') {
      return `${plaintiff} has resided in the State of New York for a continuous period of at least one year immediately preceding the commencement of this action, and the parties were married in New York.`;
    }
    if (divorceData.residencyBasis === 'one_year_lived_in_ny') {
      return `${plaintiff} has resided in the State of New York for a continuous period of at least one year immediately preceding the commencement of this action, and the parties have resided in this State as husband and wife.`;
    }
    if (divorceData.residencyBasis === 'one_year_cause_in_ny') {
      return `${plaintiff} has resided in the State of New York for a continuous period of at least one year immediately preceding the commencement of this action, and the cause of action arose in New York.`;
    }
    // Default
    return `The parties meet the residency requirements set forth in Domestic Relations Law § 230.`;
  }

  /**
   * Get New York grounds text
   * @param {string} grounds - Grounds type
   * @param {Object} divorceData - Divorce data
   * @returns {string} Grounds text
   */
  getGroundsText(grounds, divorceData) {
    switch (grounds) {
      case 'irretrievable_breakdown':
      case 'no_fault':
        return 'The relationship between husband and wife has broken down irretrievably for a period of at least six months. (Domestic Relations Law § 170(7))';

      case 'cruel_inhuman_treatment':
        return 'The Defendant\'s conduct so endangers the physical or mental well being of the Plaintiff as renders it unsafe or improper for the Plaintiff to cohabit with the Defendant. (Domestic Relations Law § 170(1))';

      case 'abandonment':
        return 'The Defendant has abandoned the Plaintiff for a period of one or more years. (Domestic Relations Law § 170(2))';

      case 'imprisonment':
        return 'The Defendant has been confined in prison for a period of three or more consecutive years after the marriage. (Domestic Relations Law § 170(3))';

      case 'adultery':
        return 'The Defendant has committed adultery. (Domestic Relations Law § 170(4))';

      case 'separation_judgment':
        return 'The husband and wife have lived apart pursuant to a decree or judgment of separation for a period of one or more years. (Domestic Relations Law § 170(5))';

      case 'separation_agreement':
        return 'The husband and wife have lived separate and apart pursuant to a written agreement of separation for a period of one or more years. (Domestic Relations Law § 170(6))';

      default:
        return 'The relationship between husband and wife has broken down irretrievably for a period of at least six months. (Domestic Relations Law § 170(7))';
    }
  }

  /**
   * Generate New York children section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Children section
   */
  generateChildrenSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 9;

    // New York considers children under 21 for support purposes
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      items.push({
        number: paragraphNum++,
        content: 'There are no children of the marriage under the age of 21 years.',
        type: 'children_info'
      });
    } else {
      items.push({
        number: paragraphNum++,
        content: 'The following are the children of the marriage under the age of 21 years:',
        type: 'children_info'
      });

      divorceData.children.forEach((child, index) => {
        const childName = typeof child === 'string' ? child : (child.name || '[CHILD NAME]');
        const birthDate = typeof child === 'object' ? this.formatDate(child.birthDate) : null;
        const residence = typeof child === 'object' ? child.residence : null;

        let childInfo = birthDate ? `${childName}, born ${birthDate}` : childName;
        if (residence) {
          childInfo += `, residing with ${residence}`;
        }

        items.push({
          number: paragraphNum++,
          content: childInfo,
          type: 'child_detail'
        });
      });

      // Custody request
      items.push({
        number: paragraphNum++,
        content: 'Plaintiff requests that the Court determine custody of the child(ren) and establish an appropriate parenting schedule.',
        type: 'custody_request'
      });

      // Child support request
      items.push({
        number: paragraphNum++,
        content: 'Plaintiff requests that the Court order child support in accordance with the Child Support Standards Act.',
        type: 'support_request'
      });
    }

    return {
      title: 'CHILDREN',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate New York relief section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Relief section
   */
  generateReliefSection(divorceData) {
    const items = [];

    items.push({
      number: null,
      content: 'WHEREFORE, Plaintiff demands judgment against Defendant as follows:',
      type: 'relief_intro'
    });

    const reliefItems = [];

    reliefItems.push('Dissolving the marriage between the parties;');
    reliefItems.push('Equitably distributing the marital property;');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Awarding custody of the child(ren) to the appropriate party;');
      reliefItems.push('Ordering child support in accordance with the Child Support Standards Act;');
      reliefItems.push('Ordering maintenance of health insurance for the child(ren);');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Awarding maintenance (spousal support) to Plaintiff;');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`Authorizing Plaintiff to resume use of the prior surname: ${divorceData.previousName};`);
    }

    reliefItems.push('Granting such other and further relief as to this Court seems just and proper.');

    reliefItems.forEach((relief, index) => {
      const letter = String.fromCharCode(97 + index); // a, b, c format
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
   * Get New York verification text
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PLAINTIFF NAME]';
    const county = divorceData.county || '[COUNTY]';

    return `VERIFICATION

STATE OF NEW YORK      )
                       ) ss.:
COUNTY OF ${county.toUpperCase()}   )

${name}, being duly sworn, deposes and says:

I am the Plaintiff in the above entitled action. I have read the foregoing Verified Complaint and know the contents thereof. The same is true to my own knowledge, except as to the matters therein stated to be alleged on information and belief, and as to those matters I believe them to be true.

_________________________________
${name}

Sworn to before me this
_____ day of _____________, 20___.

_________________________________
Notary Public`;
  }

  /**
   * Perform New York-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    // New York requires county
    if (!divorceData.county) {
      errors.push('County is required for New York divorce actions');
    }

    // Complex residency requirement warning
    warnings.push('New York has complex residency requirements. Verify that one of the DRL § 230 residency conditions is met.');

    // Barriers to remarriage (UD-4)
    warnings.push('If the parties were married in a religious ceremony, the Sworn Statement of Removal of Barriers to Remarriage (UD-4) must be served.');

    // Children under 21
    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('In New York, child support obligations generally continue until the child reaches age 21.');
    }

    // Index number warning
    warnings.push('You must purchase an Index Number before filing. The current fee is approximately $210 plus an additional fee for Request for Judicial Intervention.');

    return { errors, warnings };
  }
}

module.exports = NewYorkDivorcePetitionTemplate;
