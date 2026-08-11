// templates/states/michigan/DivorceDecreeTemplate.js
// Michigan-specific Judgment of Divorce template
// Complies with MCL § 552.6 et seq. (Michigan divorce statutes)

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');

/**
 * Michigan Judgment of Divorce Template
 *
 * Legal References:
 * - MCL § 552.6 — Ground for divorce — breakdown of marriage (sole ground)
 * - MCL § 552.9f — Waiting period (60 days no children; 180 days minor children)
 * - MCL § 552.13 — Spousal support authority
 * - MCL § 552.19 et seq. — Property division — equitable distribution
 * - MCL § 552.23 — Spousal support factors
 * - MCL § 552.627 — Income withholding for support
 * - MCL § 722.26a — Custody — legal and physical; best interests
 * - MCL § 722.23 — Best interests of the child — 12 statutory factors
 * - MCL § 552.519 — Michigan Child Support Formula
 *
 * Michigan-Specific Terms:
 * - "Judgment of Divorce" (not Decree)
 * - "CASE NO." label; docket format: [year]-[number]-[county]-DM
 * - "Legal Custody" / "Physical Custody" (MCL § 722.26a)
 * - "Parenting Time" (not visitation)
 * - "Spousal Support" (not alimony or maintenance)
 * - Pure no-fault — breakdown of marriage is the only ground
 * - Equitable distribution — not community property
 * - Circuit Court, Family Division
 * - Friend of the Court (FOC) involved in cases with minor children
 */
class MichiganDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'MI';
    this.stateName = 'Michigan';
    this.documentTitle = 'JUDGMENT OF DIVORCE';

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
      'caseNumber',
      'marriageDate'
    ];
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
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyUpper = (county || '[COUNTY]').toUpperCase();
    return `STATE OF MICHIGAN, ${countyUpper} COUNTY CIRCUIT COURT, FAMILY DIVISION`;
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

    const caseNumber = divorceData.caseNumber || '[CASE NUMBER]';
    caption += `CASE NO. ${caseNumber}\n\n`;

    const plaintiff = (divorceData.petitionerName || '[PLAINTIFF NAME]').toUpperCase();
    const defendant = (divorceData.respondentName || '[DEFENDANT NAME]').toUpperCase();

    caption += `${plaintiff},\n`;
    caption += `     Plaintiff,\n\n`;
    caption += `v.\n\n`;
    caption += `${defendant},\n`;
    caption += `     Defendant.`;

    return {
      courtName: `${circuit} Judicial Circuit Court, ${divorceData.county || '[County]'} County, Michigan, Family Division`,
      caseNumber: divorceData.caseNumber,
      petitioner: divorceData.petitionerName,
      respondent: divorceData.respondentName,
      formatted: caption
    };
  }

  /**
   * Generate Michigan appearances section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Appearances section
   */
  generateAppearancesSection(divorceData) {
    let text = '';

    text += `This matter came before the Court on ${this.formatDate(divorceData.hearingDate) || '___________________'}, `;
    text += `${divorceData.petitionerName || 'Plaintiff'} appearing ${divorceData.petitionerRepresentation === 'attorney' ? 'by and through counsel' : 'in propria persona'}`;

    if (divorceData.respondentAppeared) {
      text += `, and ${divorceData.respondentName || 'Defendant'} appearing ${divorceData.respondentRepresentation === 'attorney' ? 'by and through counsel' : 'in propria persona'}`;
    } else if (divorceData.isUncontested) {
      text += `, and ${divorceData.respondentName || 'Defendant'} having been duly served, having executed a Consent to Entry of Judgment / Waiver of Service`;
    } else {
      text += `, and ${divorceData.respondentName || 'Defendant'} having been duly served and failing to appear`;
    }

    text += `. The Court having reviewed the record, heard testimony, and being otherwise fully advised in the premises;`;

    text += '\n\nTHE COURT FINDS:';

    return {
      title: '',
      text,
      type: 'appearances'
    };
  }

  /**
   * Generate Michigan jurisdiction section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Jurisdiction section
   */
  generateJurisdictionSection(divorceData) {
    const hasChildren = divorceData.hasMinorChildren === true && divorceData.children && divorceData.children.length > 0;
    const waitingDays = hasChildren ? 180 : 60;

    return {
      title: 'FINDINGS OF FACT',
      text: `1. The Court has jurisdiction over the parties and the subject matter of this action.\n\n2. Plaintiff has been domiciled in Michigan for at least 180 days and a resident of ${divorceData.county || '[COUNTY]'} County for at least 10 days immediately preceding the filing of the Complaint, satisfying MCL § 552.9.\n\n3. The requisite waiting period of ${waitingDays} days from the date of filing has elapsed as required by MCL § 552.9f.\n\n4. There has been a breakdown of the marriage relationship to the extent that the objects of matrimony have been destroyed and there remains no reasonable likelihood that the marriage can be preserved. (MCL § 552.6)\n\n5. The parties were married on ${this.formatDate(divorceData.marriageDate) || '[DATE OF MARRIAGE]'}${divorceData.marriageLocation ? ` in ${divorceData.marriageLocation}` : ''}.`,
      type: 'jurisdiction'
    };
  }

  /**
   * Generate Michigan dissolution section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Dissolution section
   */
  generateDissolutionSection(divorceData) {
    return {
      title: 'JUDGMENT OF DIVORCE',
      text: `IT IS ORDERED AND ADJUDGED that the marriage between ${divorceData.petitionerName || 'Plaintiff'} and ${divorceData.respondentName || 'Defendant'} is dissolved, and the parties are divorced.`,
      type: 'dissolution'
    };
  }

  /**
   * Generate Michigan property division with equitable distribution language
   * MCL § 552.19 et seq.
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    items.push({
      content: 'Having considered the equitable division of property pursuant to MCL § 552.19 et seq.:',
      type: 'finding'
    });

    if (divorceData.petitionerProperty && divorceData.petitionerProperty.length > 0) {
      items.push({
        content: `IT IS ORDERED that the following property is awarded to ${divorceData.petitionerName || 'Plaintiff'} as Plaintiff\'s sole and separate property:`,
        type: 'order'
      });
      divorceData.petitionerProperty.forEach(prop => {
        items.push({ content: `• ${prop}`, type: 'property_item' });
      });
    }

    if (divorceData.respondentProperty && divorceData.respondentProperty.length > 0) {
      items.push({
        content: `IT IS ORDERED that the following property is awarded to ${divorceData.respondentName || 'Defendant'} as Defendant\'s sole and separate property:`,
        type: 'order'
      });
      divorceData.respondentProperty.forEach(prop => {
        items.push({ content: `• ${prop}`, type: 'property_item' });
      });
    }

    if (!divorceData.petitionerProperty && !divorceData.respondentProperty) {
      items.push({
        content: 'IT IS ORDERED that each party is awarded the personal property currently in their possession as their sole and separate property. Each party is awarded any bank or financial accounts held in their sole name.',
        type: 'order'
      });
    }

    items.push({
      content: 'IT IS ORDERED that each party shall hold the other harmless from any liabilities allocated to that party herein.',
      type: 'order'
    });

    return {
      title: 'PROPERTY DIVISION',
      items,
      type: 'property'
    };
  }

  /**
   * Generate Michigan child custody section
   * Uses MCL § 722.26a legal/physical custody terminology
   * Friend of the Court (FOC) enforcement referenced
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Custody section
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court having considered the best interests of the minor child(ren) pursuant to the factors set forth in MCL § 722.23, ORDERS:',
      type: 'finding'
    });

    items.push({
      content: 'The minor child(ren) of the marriage are:',
      type: 'order'
    });

    divorceData.children.forEach((child, index) => {
      const childName = typeof child === 'string' ? child : (child.name || '[CHILD NAME]');
      const birthDate = typeof child === 'object' ? this.formatDate(child.birthDate ?? child.dob ?? child.dateOfBirth) : null;
      items.push({
        content: birthDate ? `${index + 1}. ${childName}, born ${birthDate}` : `${index + 1}. ${childName}`,
        type: 'child_item'
      });
    });

    const custodyType = divorceData.custodyType || 'joint';
    const primaryParent = divorceData.primaryCustodian || divorceData.petitionerName || 'Plaintiff';
    const otherParent = primaryParent === divorceData.petitionerName
      ? (divorceData.respondentName || 'Defendant')
      : (divorceData.petitionerName || 'Plaintiff');

    if (custodyType === 'joint') {
      items.push({
        content: `IT IS ORDERED that the parties shall have joint legal custody of the minor child(ren). (MCL § 722.26a)`,
        type: 'order'
      });
      items.push({
        content: `IT IS ORDERED that ${primaryParent} shall have primary physical custody of the minor child(ren), and ${primaryParent}\'s home shall be the child(ren)\'s primary residence.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that ${primaryParent} shall have sole legal and primary physical custody of the minor child(ren). (MCL § 722.26a)`,
        type: 'order'
      });
    }

    items.push({
      content: this.getVisitationLanguage(divorceData),
      type: 'order'
    });

    items.push({
      content: 'The Friend of the Court is directed to enforce this Order and the Parenting Time Order entered herein.',
      type: 'order'
    });

    return {
      title: 'CHILD CUSTODY AND PARENTING TIME',
      items,
      type: 'custody'
    };
  }

  /**
   * Get Michigan parenting time language
   * @param {Object} divorceData - Divorce data
   * @returns {string} Parenting time language
   */
  getVisitationLanguage(divorceData) {
    const nonPrimary = divorceData.primaryCustodian === divorceData.petitionerName
      ? (divorceData.respondentName || 'Defendant')
      : (divorceData.petitionerName || 'Plaintiff');
    return `IT IS ORDERED that ${nonPrimary} shall have parenting time with the minor child(ren) in accordance with the Parenting Time Order entered simultaneously herewith, or as otherwise agreed by the parties in writing and approved by the Court.`;
  }

  /**
   * Generate Michigan child support section per MCL § 552.519
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
        content: `IT IS ORDERED that ${obligor} shall pay child support to ${obligee} in the amount of $${divorceData.childSupportAmount} per month, calculated in accordance with the Michigan Child Support Formula (MCL § 552.519), as set forth in the Child Support Order entered simultaneously herewith.`,
        type: 'order'
      });
    } else {
      items.push({
        content: 'IT IS ORDERED that child support shall be calculated and paid in accordance with the Michigan Child Support Formula (MCL § 552.519), as set forth in the Child Support Order entered simultaneously herewith.',
        type: 'order'
      });
    }

    items.push({
      content: 'IT IS ORDERED that child support payments shall be made through income withholding pursuant to MCL § 552.627, through the Michigan State Disbursement Unit (MiSDU) as directed by the Friend of the Court.',
      type: 'order'
    });

    items.push({
      content: `IT IS ORDERED that ${divorceData.healthInsuranceProvider || obligor} shall maintain health insurance for the minor child(ren) if available at a reasonable cost. Uninsured medical expenses shall be divided as follows: ${divorceData.medicalExpenseSplit || '50% by each party'}.`,
      type: 'order'
    });

    return {
      title: 'CHILD SUPPORT',
      items,
      type: 'child_support'
    };
  }

  /**
   * Generate Michigan spousal support section per MCL § 552.13 and § 552.23
   * Michigan uses "Spousal Support" (not alimony or maintenance)
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Spousal support section
   */
  generateSpousalSupportSection(divorceData) {
    if (!divorceData.spousalSupportAwarded && !divorceData.spousalSupportWaived) {
      return null;
    }

    const items = [];

    if (divorceData.spousalSupportWaived) {
      items.push({
        content: 'IT IS ORDERED that each party waives any and all claims to spousal support from the other party, now and forever, and the Court shall not retain jurisdiction to award spousal support in the future.',
        type: 'order'
      });
    } else if (divorceData.spousalSupportAwarded) {
      const payor = divorceData.spousalSupportPayor || divorceData.respondentName || 'Defendant';
      const payee = divorceData.spousalSupportPayee || divorceData.petitionerName || 'Plaintiff';

      items.push({
        content: 'The Court, having considered the factors set forth in MCL § 552.23 for spousal support, finds that an award of spousal support is appropriate:',
        type: 'finding'
      });

      items.push({
        content: `IT IS ORDERED that ${payor} shall pay spousal support to ${payee} in the amount of $${divorceData.spousalSupportAmount || '[AMOUNT]'} per month, commencing ${this.formatDate(divorceData.spousalSupportStartDate) || '[DATE]'}, and continuing for a period of ${divorceData.spousalSupportDuration || '[DURATION]'}.`,
        type: 'order'
      });

      if (!divorceData.nonModifiable) {
        items.push({
          content: 'The Court retains jurisdiction to modify spousal support upon a showing of changed circumstances.',
          type: 'order'
        });
      }

      items.push({
        content: 'Spousal support shall terminate upon the death of either party or the remarriage of the recipient party.',
        type: 'order'
      });
    }

    return {
      title: 'SPOUSAL SUPPORT',
      items,
      type: 'spousal_support'
    };
  }

  /**
   * Generate Michigan name change section
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Name change section
   */
  generateNameChangeSection(divorceData) {
    if (!divorceData.requestNameChange || !divorceData.previousName) {
      return null;
    }

    const person = divorceData.nameChangeParty || divorceData.petitionerName || 'Plaintiff';

    return {
      title: 'RESTORATION OF FORMER NAME',
      text: `IT IS ORDERED that the former name of ${person} is restored to: ${divorceData.previousName}.`,
      type: 'name_change'
    };
  }

  /**
   * Generate Michigan final orders section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Final orders section
   */
  generateFinalOrdersSection(divorceData) {
    const items = [];

    items.push({
      content: 'IT IS ORDERED that all relief not specifically granted in this Judgment is denied.',
      type: 'order'
    });

    items.push({
      content: 'IT IS ORDERED that this Judgment of Divorce is a final judgment disposing of all claims and all parties in this action.',
      type: 'order'
    });

    items.push({
      content: 'IT IS ORDERED that each party shall execute and deliver to the other any and all documents necessary to effectuate the terms of this Judgment.',
      type: 'order'
    });

    if (divorceData.hasMinorChildren === true && divorceData.children && divorceData.children.length > 0) {
      items.push({
        content: 'IT IS ORDERED that the Friend of the Court is authorized to review and enforce the child support, custody, and parenting time provisions of this Judgment.',
        type: 'order'
      });
    }

    items.push({
      content: 'The Court retains jurisdiction to enforce and, where permitted by law, to modify the terms of this Judgment.',
      type: 'order'
    });

    return {
      title: 'MISCELLANEOUS PROVISIONS',
      items,
      type: 'final_orders'
    };
  }

  /**
   * Generate Michigan judgment block
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Judgment block
   */
  generateJudgmentBlock(divorceData) {
    const countyUpper = (divorceData.county || '[COUNTY]').toUpperCase();
    return {
      text: `IT IS SO ORDERED.

Date: ___________________


_________________________________
Circuit Court Judge
${divorceData.county ? `${divorceData.judicialCircuit || '[NUMBER]'} Judicial Circuit Court\n${countyUpper} County, Michigan` : '[NUMBER] Judicial Circuit Court\n[COUNTY] County, Michigan'}`,
      type: 'judgment'
    };
  }

  /**
   * Generate Michigan effective date text
   * @returns {string} Effective date language
   */
  getEffectiveDateText() {
    return 'This Judgment of Divorce is effective immediately upon entry by the Court.';
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
      errors.push('County is required for Michigan Judgments of Divorce');
    }

    if (!divorceData.caseNumber) {
      errors.push('Case number is required for Michigan Judgment of Divorce');
    }

    const hasChildren = divorceData.hasMinorChildren === true && divorceData.children && divorceData.children.length > 0;

    if (hasChildren) {
      warnings.push('Michigan requires a separate Uniform Child Support Order (FOC 10) and Parenting Time Order to be entered simultaneously with the Judgment of Divorce.');
      warnings.push('The Michigan Child Support Formula Worksheet must be filed. Friend of the Court will review child support.');
      warnings.push('The 180-day waiting period must have elapsed from the date of filing when minor children are involved (MCL § 552.9f).');
    } else {
      warnings.push('The 60-day waiting period must have elapsed from the date of filing before this Judgment may be entered (MCL § 552.9f).');
    }

    return { errors, warnings };
  }
}

module.exports = MichiganDivorceDecreeTemplate;
