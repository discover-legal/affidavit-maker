// templates/states/massachusetts/DivorceDecreeTemplate.js
// Massachusetts-specific Judgment of Divorce Nisi template
// Complies with M.G.L. c. 208 (Massachusetts divorce statutes)

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');

/**
 * Massachusetts Judgment of Divorce Nisi Template
 *
 * Legal References:
 * - M.G.L. c. 208, § 1 — Grounds for divorce (fault)
 * - M.G.L. c. 208, § 1A — Joint petition — irretrievable breakdown
 * - M.G.L. c. 208, § 1B — Complaint — irretrievable breakdown (unilateral)
 * - M.G.L. c. 208, § 21 — Nisi period — 90 days before divorce is absolute
 * - M.G.L. c. 208, § 28 — Custody of children
 * - M.G.L. c. 208, § 34 — Equitable distribution of all property
 * - M.G.L. c. 208, § 48 et seq. — Alimony Reform Act
 * - Massachusetts Child Support Guidelines
 *
 * Massachusetts-Specific Terms:
 * - "Judgment of Divorce Nisi" then "Judgment of Divorce Absolute" (90 days later)
 * - "DOCKET NO." label
 * - "Legal Custody" / "Physical Custody" (M.G.L. c. 208, § 28)
 * - "Alimony" (four types: general term, rehabilitative, reimbursement, transitional)
 * - "Commonwealth of Massachusetts" not "State of"
 * - Equitable distribution of ALL property (including pre-marital and inherited)
 * - Probate and Family Court Department
 */
class MassachusettsDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'MA';
    this.stateName = 'Massachusetts';
    this.documentTitle = 'JUDGMENT OF DIVORCE NISI';

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
      'caseNumber',
      'marriageDate'
    ];
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
   * Generate Massachusetts appearances section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Appearances section
   */
  generateAppearancesSection(divorceData) {
    let text = '';

    text += `This cause came on to be heard on ${this.formatDate(divorceData.hearingDate) || '___________________'}, `;
    text += `at the ${divorceData.county || '[COUNTY]'} Division of the Probate and Family Court, `;

    text += `${divorceData.petitionerName || 'Plaintiff'} appearing ${divorceData.petitionerRepresentation === 'attorney' ? 'by counsel' : 'pro se'}`;

    if (divorceData.respondentAppeared) {
      text += `, and ${divorceData.respondentName || 'Defendant'} appearing ${divorceData.respondentRepresentation === 'attorney' ? 'by counsel' : 'pro se'}`;
    } else {
      text += `, and ${divorceData.respondentName || 'Defendant'} ${divorceData.isUncontested ? 'having executed a Separation Agreement and waived appearance' : 'having been duly served and not appearing'}`;
    }

    text += ', and the Court having heard evidence and been fully advised in the premises;';
    text += '\n\nTHE COURT FINDS AND ORDERS:';

    return {
      title: '',
      text,
      type: 'appearances'
    };
  }

  /**
   * Generate Massachusetts jurisdiction section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Jurisdiction section
   */
  generateJurisdictionSection(divorceData) {
    return {
      title: 'FINDINGS',
      text: `1. The Court has jurisdiction over this action pursuant to M.G.L. c. 208.\n\n2. The jurisdictional requirements of M.G.L. c. 208, § 5 are satisfied.\n\n3. The parties were married on ${this.formatDate(divorceData.marriageDate) || '[DATE OF MARRIAGE]'}${divorceData.marriageLocation ? ` in ${divorceData.marriageLocation}` : ''}.\n\n4. There has been an irretrievable breakdown of the marriage, and a divorce should be granted.\n\n5. All financial disclosure requirements have been satisfied.`,
      type: 'jurisdiction'
    };
  }

  /**
   * Generate Massachusetts dissolution section — "Judgment of Divorce Nisi"
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Dissolution section
   */
  generateDissolutionSection(divorceData) {
    return {
      title: 'JUDGMENT OF DIVORCE NISI',
      text: `It is ADJUDGED that the marriage between ${divorceData.petitionerName || 'Plaintiff'} and ${divorceData.respondentName || 'Defendant'} be, and hereby is, dissolved, and that the parties be divorced. This Judgment of Divorce Nisi shall become absolute and a Judgment of Divorce Absolute shall enter ninety (90) days from the date hereof, unless cause is shown why the Judgment should not become absolute, pursuant to M.G.L. c. 208, § 21.`,
      type: 'dissolution'
    };
  }

  /**
   * Generate Massachusetts property division
   * MA divides ALL property equitably including pre-marital and inherited per M.G.L. c. 208, § 34
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    items.push({
      content: 'Having considered the factors set forth in M.G.L. c. 208, § 34, including the length of the marriage, the conduct of the parties during the marriage, the age, health, station, occupation, amount and sources of income, vocational skills, employability, estate, liabilities, and needs of each party:',
      type: 'finding'
    });

    if (divorceData.petitionerProperty && divorceData.petitionerProperty.length > 0) {
      items.push({
        content: `It is ORDERED that the following property is assigned to ${divorceData.petitionerName || 'Plaintiff'}:`,
        type: 'order'
      });
      divorceData.petitionerProperty.forEach(prop => {
        items.push({ content: `• ${prop}`, type: 'property_item' });
      });
    }

    if (divorceData.respondentProperty && divorceData.respondentProperty.length > 0) {
      items.push({
        content: `It is ORDERED that the following property is assigned to ${divorceData.respondentName || 'Defendant'}:`,
        type: 'order'
      });
      divorceData.respondentProperty.forEach(prop => {
        items.push({ content: `• ${prop}`, type: 'property_item' });
      });
    }

    if (!divorceData.petitionerProperty && !divorceData.respondentProperty) {
      items.push({
        content: 'It is ORDERED that each party shall retain the personal property in their possession and any financial accounts held in their sole name as their own property.',
        type: 'order'
      });
    }

    items.push({
      content: 'It is ORDERED that each party shall execute and deliver to the other any and all documents necessary to effectuate the transfer of property ordered herein.',
      type: 'order'
    });

    return {
      title: 'DIVISION OF PROPERTY',
      items,
      type: 'property'
    };
  }

  /**
   * Generate Massachusetts child custody section
   * Uses "legal custody" / "physical custody" per M.G.L. c. 208, § 28
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Custody section
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court, having considered the best interests of the minor child(ren) pursuant to M.G.L. c. 208, § 28, ORDERS:',
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
    const physicalCustodian = divorceData.primaryCustodian || divorceData.petitionerName || 'Plaintiff';
    const otherParent = physicalCustodian === divorceData.petitionerName
      ? (divorceData.respondentName || 'Defendant')
      : (divorceData.petitionerName || 'Plaintiff');

    if (custodyType === 'joint') {
      items.push({
        content: `It is ORDERED that the parties shall have joint legal custody of the minor child(ren).`,
        type: 'order'
      });
      items.push({
        content: `It is ORDERED that ${physicalCustodian} shall have primary physical custody of the minor child(ren).`,
        type: 'order'
      });
    } else {
      items.push({
        content: `It is ORDERED that ${physicalCustodian} shall have sole legal and physical custody of the minor child(ren).`,
        type: 'order'
      });
    }

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
   * Get Massachusetts parenting time language
   * @param {Object} divorceData - Divorce data
   * @returns {string} Parenting time language
   */
  getVisitationLanguage(divorceData) {
    const otherParent = divorceData.primaryCustodian === divorceData.petitionerName
      ? (divorceData.respondentName || 'Defendant')
      : (divorceData.petitionerName || 'Plaintiff');
    return `It is ORDERED that ${otherParent} shall have parenting time (visitation) with the minor child(ren) as follows: as agreed by the parties, or in accordance with the parenting plan filed herein.`;
  }

  /**
   * Generate Massachusetts child support section
   * Per Massachusetts Child Support Guidelines
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
        content: `It is ORDERED that ${obligor} shall pay child support to ${obligee} in the amount of $${divorceData.childSupportAmount} per week, calculated in accordance with the Massachusetts Child Support Guidelines.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `It is ORDERED that child support shall be paid in accordance with the Massachusetts Child Support Guidelines. The child support calculation worksheet is incorporated herein.`,
        type: 'order'
      });
    }

    items.push({
      content: 'It is ORDERED that child support payments shall be made through income withholding as provided by law.',
      type: 'order'
    });

    items.push({
      content: `It is ORDERED that ${divorceData.healthInsuranceProvider || obligor} shall maintain health insurance for the minor child(ren). Unreimbursed medical, dental, and prescription expenses shall be divided between the parties as follows: ${divorceData.medicalExpenseSplit || 'in proportion to their respective incomes'}.`,
      type: 'order'
    });

    return {
      title: 'CHILD SUPPORT',
      items,
      type: 'child_support'
    };
  }

  /**
   * Generate Massachusetts alimony section per M.G.L. c. 208, § 48 et seq.
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Alimony section
   */
  generateSpousalSupportSection(divorceData) {
    if (!divorceData.spousalSupportAwarded && !divorceData.spousalSupportWaived) {
      return null;
    }

    const items = [];

    if (divorceData.spousalSupportWaived) {
      items.push({
        content: 'It is ORDERED that each party waives any claim to alimony from the other party, now and forever.',
        type: 'order'
      });
    } else if (divorceData.spousalSupportAwarded) {
      const payor = divorceData.spousalSupportPayor || divorceData.respondentName || 'Defendant';
      const payee = divorceData.spousalSupportPayee || divorceData.petitionerName || 'Plaintiff';
      const alimonyType = divorceData.alimonyType || 'general_term';

      items.push({
        content: `The Court, having considered the factors set forth in M.G.L. c. 208, § 53, orders ${alimonyType.replace(/_/g, ' ')} alimony:`,
        type: 'finding'
      });

      items.push({
        content: `It is ORDERED that ${payor} shall pay ${alimonyType.replace(/_/g, ' ')} alimony to ${payee} in the amount of $${divorceData.spousalSupportAmount || '[AMOUNT]'} per month for a period of ${divorceData.spousalSupportDuration || '[DURATION]'}, pursuant to M.G.L. c. 208, § 48 et seq.`,
        type: 'order'
      });

      items.push({
        content: 'Alimony shall terminate upon the death of either party or the remarriage of the recipient, unless otherwise ordered.',
        type: 'order'
      });
    }

    return {
      title: 'ALIMONY',
      items,
      type: 'spousal_support'
    };
  }

  /**
   * Generate Massachusetts name change section
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
      text: `It is ORDERED that the former name of ${person} is restored to: ${divorceData.previousName}, effective upon the entry of the Judgment of Divorce Absolute.`,
      type: 'name_change'
    };
  }

  /**
   * Generate Massachusetts final orders section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Final orders section
   */
  generateFinalOrdersSection(divorceData) {
    const items = [];

    items.push({
      content: 'It is ORDERED that this Judgment of Divorce Nisi shall become a Judgment of Divorce Absolute ninety (90) days from the date hereof, unless cause is shown to the contrary, pursuant to M.G.L. c. 208, § 21.',
      type: 'order'
    });

    items.push({
      content: 'It is ORDERED that all relief not specifically granted herein is denied.',
      type: 'order'
    });

    items.push({
      content: 'It is ORDERED that each party shall execute and deliver any documents necessary to effectuate this Judgment.',
      type: 'order'
    });

    items.push({
      content: 'The Court retains jurisdiction to enforce and modify this Judgment as permitted by law.',
      type: 'order'
    });

    return {
      title: 'ADDITIONAL ORDERS',
      items,
      type: 'final_orders'
    };
  }

  /**
   * Generate Massachusetts judgment block
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Judgment block
   */
  generateJudgmentBlock(divorceData) {
    return {
      text: `ENTERED as a Judgment of Divorce Nisi this _____ day of _______________, 20___.

This Judgment shall become a Judgment of Divorce Absolute on _______________, 20___ (90 days from date of entry), unless cause is shown why it should not become absolute.


_________________________________
JUSTICE OF THE PROBATE AND FAMILY COURT
${divorceData.county ? `${divorceData.county.toUpperCase()} DIVISION` : '[COUNTY] DIVISION'}`,
      type: 'judgment'
    };
  }

  /**
   * Get Massachusetts effective date text
   * @returns {string} Effective date language — describes the nisi period
   */
  getEffectiveDateText() {
    return 'This Judgment of Divorce Nisi becomes a Judgment of Divorce Absolute ninety (90) days from the date of entry, pursuant to M.G.L. c. 208, § 21.';
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
      errors.push('County is required for Massachusetts divorce judgments');
    }

    if (!divorceData.caseNumber) {
      errors.push('Docket number is required for Massachusetts Judgment of Divorce');
    }

    warnings.push('Massachusetts Judgment of Divorce Nisi does not become absolute until 90 days after entry (M.G.L. c. 208, § 21). Neither party may remarry during the nisi period.');
    warnings.push('Massachusetts requires Financial Statements from both parties in cases involving property, support, or custody.');

    if (divorceData.hasMinorChildren === true) {
      warnings.push('Massachusetts requires a Child Support Guidelines Worksheet to accompany the Judgment.');
    }

    return { errors, warnings };
  }
}

module.exports = MassachusettsDivorceDecreeTemplate;
