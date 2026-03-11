// templates/states/newyork/DivorceDecreeTemplate.js
// New York-specific Judgment of Divorce template
// Complies with New York Domestic Relations Law and CPLR

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');

/**
 * New York Judgment of Divorce Template
 *
 * Legal References:
 * - New York Domestic Relations Law (DRL)
 * - DRL § 170 (Grounds for divorce)
 * - DRL § 230 (Residence requirements)
 * - DRL § 236(B) (Equitable distribution and maintenance)
 * - DRL § 240 (Custody and child support)
 * - CPLR 2101 (Form of papers)
 * - 22 NYCRR 202.16 (Matrimonial Actions - Uniform Rules for Trial Courts)
 *
 * Formatting Requirements:
 * - 8.5" x 11" paper
 * - 1" margins minimum
 * - 12-point font minimum (10pt for footnotes)
 * - Double-spaced text
 * - Per CPLR 2101
 *
 * New York-Specific Terms:
 * - "Divorce" (not "Dissolution")
 * - "Judgment of Divorce" (not "Decree")
 * - "Index No.:" label
 * - "Plaintiff" and "Defendant" (not "Petitioner" and "Respondent")
 * - Standard "Custody" terminology
 * - "Maintenance" (statutory guideline with income cap)
 * - Equitable distribution state
 * - Supreme Court (trial court in NY)
 * - 6-month irretrievable breakdown for no-fault
 * - Child support to age 21
 */
class NewYorkDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'NY';
    this.stateName = 'New York';
    this.documentTitle = 'JUDGMENT OF DIVORCE';

    // Load metadata if available
    try {
      this.metadata = require('./divorce-metadata.json');
    } catch (e) {
      this.metadata = null;
    }

    // New York-specific required fields
    this.requiredFields = [
      'petitionerName', // Called "Plaintiff" in NY
      'respondentName', // Called "Defendant" in NY
      'state',
      'county',
      'caseNumber', // Called "Index Number" in NY
      'marriageDate'
    ];

    // New York formatting requirements
    this.formatting = {
      fontSize: '12pt',
      fontFamily: 'Times New Roman',
      lineHeight: '2',
      margin: '1in',
      paperSize: '8.5in x 11in'
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
    const countyUpper = (county || '[COUNTY]').toUpperCase();
    return `SUPREME COURT OF THE STATE OF NEW YORK, COUNTY OF ${countyUpper}`;
  }

  /**
   * Generate New York-style header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'SUPREME COURT OF THE STATE OF NEW YORK';
  }

  /**
   * Generate New York-style venue
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyUpper = (county || '[COUNTY]').toUpperCase();
    return `COUNTY OF ${countyUpper}`;
  }

  /**
   * Generate New York case caption
   * Note: NY uses "Plaintiff" and "Defendant" not "Petitioner" and "Respondent"
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    let caption = '';

    caption += `SUPREME COURT OF THE STATE OF NEW YORK\n`;
    caption += `COUNTY OF ${(divorceData.county || '[COUNTY]').toUpperCase()}\n`;
    caption += `-------------------------------------------------------------------X\n\n`;

    // NY uses Plaintiff/Defendant terminology
    const plaintiff = (divorceData.petitionerName || '[PLAINTIFF NAME]').toUpperCase();
    caption += `${plaintiff},\n`;
    caption += `Plaintiff,\n\n`;

    caption += `-against-\n\n`;

    const defendant = (divorceData.respondentName || '[DEFENDANT NAME]').toUpperCase();
    caption += `${defendant},\n`;
    caption += `Defendant.`;

    caption += `\n\n-------------------------------------------------------------------X`;

    const indexNumber = divorceData.caseNumber || '[INDEX NUMBER]';
    caption += `\n\nIndex No.: ${indexNumber}`;

    return {
      courtName: this.getDefaultCourt(divorceData.county),
      caseNumber: divorceData.caseNumber,
      petitioner: divorceData.petitionerName,
      respondent: divorceData.respondentName,
      plaintiff: divorceData.petitionerName, // NY terminology
      defendant: divorceData.respondentName, // NY terminology
      formatted: caption
    };
  }

  /**
   * Generate New York appearances section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Appearances section
   */
  generateAppearancesSection(divorceData) {
    let text = '';

    // NY terminology: Plaintiff/Defendant
    const plaintiff = divorceData.petitionerName || 'Plaintiff';
    const defendant = divorceData.respondentName || 'Defendant';

    text += `The above-entitled action having been brought on for trial on ${this.formatDate(divorceData.hearingDate) || '___________________'},`;

    if (divorceData.isUncontested || divorceData.appearanceType === 'agreed') {
      text += ` ${plaintiff} appearing ${divorceData.petitionerRepresentation === 'attorney' ? 'by counsel' : 'pro se'},`;

      if (divorceData.respondentAppeared) {
        text += ` and ${defendant} appearing and consenting,`;
      } else {
        text += ` and ${defendant} having defaulted,`;
      }
    } else {
      text += ` ${plaintiff} appearing ${divorceData.petitionerRepresentation === 'attorney' ? 'by counsel' : 'pro se'},`;
      text += ` and ${defendant} ${divorceData.respondentAppeared ? 'appearing' : 'not appearing after proper service'},`;
    }

    text += ` and proof having been duly made and filed, and the Court having considered the evidence and being fully advised,`;

    text += `\n\nNOW, on motion of ${plaintiff}, it is hereby`;

    return {
      title: '',
      text,
      type: 'appearances'
    };
  }

  /**
   * Generate New York findings of fact section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Jurisdiction section
   */
  generateJurisdictionSection(divorceData) {
    const plaintiff = divorceData.petitionerName || 'Plaintiff';
    const defendant = divorceData.respondentName || 'Defendant';

    // NY has complex residency requirements
    let residencyText = `The Court finds that the residency requirements of DRL § 230 have been satisfied.`;

    return {
      title: 'FINDINGS OF FACT',
      text: `ORDERED, ADJUDGED and DECREED as follows:\n\n1. The Court has jurisdiction over this action pursuant to DRL § 230.\n\n2. ${residencyText}\n\n3. The parties were married on ${this.formatDate(divorceData.marriageDate) || '[DATE]'} in ${divorceData.marriageLocation || '[LOCATION]'}.\n\n4. The relationship between ${plaintiff} and ${defendant} has broken down irretrievably for a period of at least six months. (DRL § 170(7))\n\n5. All economic issues have been resolved either by stipulation or by the Court's determination.`,
      type: 'jurisdiction'
    };
  }

  /**
   * Generate New York dissolution section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Dissolution section
   */
  generateDissolutionSection(divorceData) {
    const plaintiff = divorceData.petitionerName || 'Plaintiff';
    const defendant = divorceData.respondentName || 'Defendant';

    return {
      title: 'JUDGMENT',
      text: `That the marriage between ${plaintiff}, Plaintiff, and ${defendant}, Defendant, is hereby dissolved, and the parties are divorced.`,
      type: 'dissolution'
    };
  }

  /**
   * Generate New York property division with equitable distribution language
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];
    const plaintiff = divorceData.petitionerName || 'Plaintiff';
    const defendant = divorceData.respondentName || 'Defendant';

    items.push({
      content: 'Pursuant to DRL § 236(B)(5), the Court equitably distributes the marital property as follows:',
      type: 'finding'
    });

    // Property to Plaintiff
    items.push({
      content: `The following marital property is distributed to ${plaintiff}:`,
      type: 'order'
    });

    if (divorceData.petitionerProperty && divorceData.petitionerProperty.length > 0) {
      divorceData.petitionerProperty.forEach(prop => {
        items.push({ content: `• ${prop}`, type: 'property_item' });
      });
    } else {
      items.push({
        content: '• All personal property currently in Plaintiff\'s possession',
        type: 'property_item'
      });
    }

    // Property to Defendant
    items.push({
      content: `The following marital property is distributed to ${defendant}:`,
      type: 'order'
    });

    if (divorceData.respondentProperty && divorceData.respondentProperty.length > 0) {
      divorceData.respondentProperty.forEach(prop => {
        items.push({ content: `• ${prop}`, type: 'property_item' });
      });
    } else {
      items.push({
        content: '• All personal property currently in Defendant\'s possession',
        type: 'property_item'
      });
    }

    // Separate property
    items.push({
      content: 'Each party\'s separate property is confirmed to that party.',
      type: 'order'
    });

    return {
      title: 'EQUITABLE DISTRIBUTION',
      items,
      type: 'property'
    };
  }

  /**
   * Generate New York child custody section
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Custody section
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];
    const plaintiff = divorceData.petitionerName || 'Plaintiff';
    const defendant = divorceData.respondentName || 'Defendant';

    items.push({
      content: 'The Court finds that the following custody and parenting time arrangement is in the best interests of the child(ren):',
      type: 'finding'
    });

    items.push({
      content: 'The unemancipated child(ren) of the marriage are:',
      type: 'order'
    });

    divorceData.children.forEach((child, index) => {
      const childName = typeof child === 'string' ? child : (child.name || '[CHILD NAME]');
      const birthDate = typeof child === 'object' ? this.formatDate(child.birthDate) : null;
      items.push({
        content: birthDate ? `${index + 1}. ${childName}, born ${birthDate}` : `${index + 1}. ${childName}`,
        type: 'child_item'
      });
    });

    // Custody arrangement
    const custodyType = divorceData.custodyType || 'joint';
    const primaryParent = divorceData.primaryCustodian || plaintiff;

    if (custodyType === 'joint') {
      items.push({
        content: `${plaintiff} and ${defendant} shall have joint legal custody of the child(ren).`,
        type: 'order'
      });

      items.push({
        content: `${primaryParent} shall have primary physical custody of the child(ren).`,
        type: 'order'
      });
    } else {
      items.push({
        content: `${primaryParent} shall have sole legal and physical custody of the child(ren).`,
        type: 'order'
      });
    }

    // Parenting time/visitation
    items.push({
      content: this.getVisitationLanguage(divorceData),
      type: 'order'
    });

    return {
      title: 'CUSTODY AND PARENTING TIME',
      items,
      type: 'custody'
    };
  }

  /**
   * Get New York parenting time language
   * @param {Object} divorceData - Divorce data
   * @returns {string} Parenting time language
   */
  getVisitationLanguage(divorceData) {
    const primaryParent = divorceData.primaryCustodian || divorceData.petitionerName || 'Plaintiff';
    const nonCustodial = primaryParent === divorceData.petitionerName
      ? divorceData.respondentName
      : divorceData.petitionerName;

    return `${nonCustodial || 'The non-custodial parent'} shall have parenting time/visitation with the child(ren) as set forth in any agreement between the parties or, if none, reasonable parenting time upon reasonable notice.`;
  }

  /**
   * Generate New York child support section
   * Note: NY child support extends to age 21
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Child support section
   */
  generateChildSupportSection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    const obligor = divorceData.childSupportObligor || divorceData.respondentName || 'Defendant';
    const obligee = divorceData.childSupportObligee || divorceData.petitionerName || 'Plaintiff';

    if (divorceData.childSupportAmount) {
      items.push({
        content: `${obligor} shall pay child support to ${obligee} in the amount of $${divorceData.childSupportAmount} per month, calculated in accordance with the Child Support Standards Act (CSSA), DRL § 240.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `Child support shall be calculated and paid in accordance with the Child Support Standards Act (CSSA), DRL § 240.`,
        type: 'order'
      });
    }

    // NY child support to age 21
    items.push({
      content: 'Child support shall continue until each child reaches the age of 21 years or is otherwise emancipated.',
      type: 'order'
    });

    // Income deduction
    items.push({
      content: 'An Income Execution for Support is issued for the collection of child support through the Support Collection Unit.',
      type: 'order'
    });

    // Health insurance
    items.push({
      content: `${divorceData.healthInsuranceProvider || obligor} shall provide health insurance for the child(ren) if available at reasonable cost through an employer or other group plan.`,
      type: 'order'
    });

    // Unreimbursed expenses
    items.push({
      content: 'Unreimbursed medical, dental, and other health-related expenses for the child(ren) shall be divided between the parties in proportion to their respective incomes.',
      type: 'order'
    });

    // Child care/educational add-ons
    items.push({
      content: 'Child care expenses and educational expenses (as applicable) shall be divided between the parties in proportion to their respective incomes.',
      type: 'order'
    });

    return {
      title: 'CHILD SUPPORT',
      items,
      type: 'child_support'
    };
  }

  /**
   * Generate New York maintenance section (uses statutory guideline)
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Maintenance section
   */
  generateSpousalSupportSection(divorceData) {
    if (!divorceData.spousalSupportAwarded && !divorceData.spousalSupportWaived) {
      return null;
    }

    const items = [];
    const plaintiff = divorceData.petitionerName || 'Plaintiff';
    const defendant = divorceData.respondentName || 'Defendant';

    if (divorceData.spousalSupportWaived) {
      items.push({
        content: 'Each party waives any claim to maintenance from the other.',
        type: 'order'
      });
    } else if (divorceData.spousalSupportAwarded) {
      const payor = divorceData.spousalSupportPayor || defendant;
      const payee = divorceData.spousalSupportPayee || plaintiff;

      items.push({
        content: `The Court, having applied the Maintenance Guidelines pursuant to DRL § 236(B)(6), orders maintenance as follows:`,
        type: 'finding'
      });

      items.push({
        content: `${payor} shall pay maintenance to ${payee} in the amount of $${divorceData.spousalSupportAmount || '[AMOUNT]'} per month, beginning ${this.formatDate(divorceData.spousalSupportStartDate) || '[DATE]'}.`,
        type: 'order'
      });

      // Duration
      if (divorceData.spousalSupportDuration) {
        items.push({
          content: `Maintenance shall continue for ${divorceData.spousalSupportDuration} or until terminated by death, remarriage of the payee, or further order of the Court.`,
          type: 'order'
        });
      }

      // Income execution
      items.push({
        content: 'An Income Execution for Support is issued for the collection of maintenance through the Support Collection Unit.',
        type: 'order'
      });
    }

    return {
      title: 'MAINTENANCE',
      items,
      type: 'spousal_support'
    };
  }

  /**
   * Generate New York name change section
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Name change section
   */
  generateNameChangeSection(divorceData) {
    if (!divorceData.requestNameChange || !divorceData.previousName) {
      return null;
    }

    const person = divorceData.nameChangeParty || divorceData.petitionerName || 'Plaintiff';

    return {
      title: 'RESTORATION OF PRIOR SURNAME',
      text: `${person} is authorized to resume the use of the prior surname: ${divorceData.previousName}.`,
      type: 'name_change'
    };
  }

  /**
   * Generate New York final orders section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Final orders section
   */
  generateFinalOrdersSection(divorceData) {
    const items = [];

    items.push({
      content: 'Each party shall execute and deliver any documents necessary to effectuate this Judgment.',
      type: 'order'
    });

    items.push({
      content: 'All relief not specifically granted herein is denied.',
      type: 'order'
    });

    items.push({
      content: 'This Court retains jurisdiction over all ancillary matters.',
      type: 'order'
    });

    items.push({
      content: 'Unless otherwise ordered, each party shall bear their own attorney fees and costs.',
      type: 'order'
    });

    // Automatic orders termination
    items.push({
      content: 'The Automatic Orders issued pursuant to DRL § 236(B)(2) are hereby vacated.',
      type: 'order'
    });

    return {
      title: 'OTHER PROVISIONS',
      items,
      type: 'final_orders'
    };
  }

  /**
   * Generate New York judgment block
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Judgment block
   */
  generateJudgmentBlock(divorceData) {
    return {
      text: `E N T E R:

Dated: _____________________, New York
        _______________, 20___


_________________________________
J.S.C. (Justice of the Supreme Court)

${divorceData.judgeName ? `Hon. ${divorceData.judgeName.toUpperCase()}` : ''}

Judgment signed this _____ day of _______________, 20___.

Judgment entered this _____ day of _______________, 20___.

_________________________________
COUNTY CLERK`,
      type: 'judgment'
    };
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
      errors.push('County is required for New York divorce judgments');
    }

    // New York requires index number for judgment
    if (!divorceData.caseNumber) {
      errors.push('Index number is required for New York Judgment of Divorce');
    }

    // Warning about residency (NY has complex requirements)
    warnings.push('Verify that New York residency requirements (DRL § 230) have been met.');

    // Warning about 6-month breakdown for no-fault
    warnings.push('For no-fault divorce, the relationship must have been irretrievably broken for at least 6 months (DRL § 170(7)).');

    // Warning about children
    if (divorceData.hasMinorChildren === true && (!divorceData.children || divorceData.children.length === 0)) {
      warnings.push('You indicated there are unemancipated children but did not provide child information.');
    }

    // NY child support to 21
    if (divorceData.hasMinorChildren === true) {
      warnings.push('Note: In New York, child support generally continues until age 21.');
    }

    return { errors, warnings };
  }
}

module.exports = NewYorkDivorceDecreeTemplate;
