// templates/states/louisiana/DivorcePetitionTemplate.js
// Louisiana Petition for Divorce template
// Complies with La. C.C. Art. 102-103 (Divorce)

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Louisiana Petition for Divorce Template
 *
 * Legal References:
 * - La. C.C. Art. 102 — No-fault divorce (file first, wait 180/365 days)
 * - La. C.C. Art. 103 — No-fault divorce (already separated) and fault grounds
 * - La. C.C.P. Art. 10 — Jurisdiction; six months' residence in a parish creates a rebuttable presumption of domicile
 * - La. C.C.P. Art. 3941 — Venue (parish of domicile)
 * - La. C.C. Art. 2336 et seq. — Community property regime
 * - La. R.S. 9:2801 — Partition of community property
 * - La. C.C. Art. 131 et seq. — Custody (joint custody; domiciliary parent)
 * - La. R.S. 9:335 — Joint custody implementation
 * - La. C.C. Art. 111-113 — Spousal support (interim and final periodic)
 * - La. R.S. 9:315 et seq. — Child support guidelines (income shares)
 * - La. R.S. 9:307 — Covenant marriage grounds
 *
 * Louisiana-Specific Notes:
 * - Called "Divorce" (not dissolution of marriage)
 * - Louisiana is the only U.S. civil law state (Napoleonic Code tradition)
 * - Louisiana uses PARISHES, not counties
 * - Two main paths: Article 102 (file first, then wait) and Article 103 (already separated)
 * - Community property state — equal 50/50 division
 * - "Joint Custody" with "Domiciliary Parent" and "Non-Domiciliary Parent"
 * - "Visitation" or "Custodial Time" (La. R.S. 9:335)
 * - "Spousal Support" — interim and final periodic (not alimony or maintenance)
 * - Covenant marriages have separate, stricter grounds
 * - Filed in District Court by judicial district and parish
 * - Case number label: "DOCKET NO."
 */
class LouisianaDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'LA';
    this.stateName = 'Louisiana';
    this.documentTitle = 'PETITION FOR DIVORCE';

    try {
      this.metadata = require('./divorce-metadata.json');
    } catch (e) {
      this.metadata = null;
    }

    this.requiredFields = [
      'petitionerName',
      'respondentName',
      'state',
      'parish',
      'marriageDate',
      'groundsForDivorce'
    ];

    // Louisiana — domicile required; 6-month parish residency creates a rebuttable presumption of domicile
    this.residencyRequirements = {
      domicile: true,
      parishMonths: 6,
      description: 'Petitioner must be domiciled in Louisiana. Six months of residence in a parish creates a rebuttable presumption of domicile. (La. C.C.P. Arts. 10, 3941)'
    };

    // Louisiana waiting period depends on divorce type and children
    this.waitingPeriod = {
      article102NoChildren: 180,
      article102WithChildren: 365,
      article103: 0,
      fault: 0,
      startsFrom: 'service_of_petition',
      description: 'Article 102: 180 days (no children) or 365 days (with children) after service of petition. Article 103: no additional wait if already separated for required period. Fault: no waiting period.'
    };
  }

  /**
   * Get Louisiana case number label — "DOCKET NO."
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'DOCKET NO.';
  }

  /**
   * Get default court for Louisiana parish — District Court
   * @param {string} parish - Parish name (may also receive county for compatibility)
   * @returns {string} Court name
   */
  getDefaultCourt(parish) {
    const parishName = parish || '[PARISH]';
    return `District Court, Parish of ${parishName}, State of Louisiana`;
  }

  /**
   * Generate Louisiana header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF LOUISIANA';
  }

  /**
   * Generate Louisiana venue — "Parish of [Parish]" (Louisiana uses parishes, not counties)
   * @param {string} county - Parish name (parameter named county for interface compatibility)
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const parishName = county || '[PARISH]';
    const parishFormatted = parishName.charAt(0).toUpperCase() + parishName.slice(1).toLowerCase();
    return `Parish of ${parishFormatted}`;
  }

  /**
   * Get Louisiana jurisdiction statement — domicile-based, parish residency
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    const parish = divorceData.parish || divorceData.county || '[PARISH]';
    return `Petitioner is domiciled in the State of Louisiana and has been domiciled in the Parish of ${parish} for at least six (6) months immediately preceding the filing of this Petition, establishing domicile for filing purposes. (La. C.C. Art. 10; La. C.C.P. Art. 3941)`;
  }

  /**
   * Get Louisiana venue reason
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    const parish = divorceData.parish || divorceData.county || '[PARISH]';
    return `Petitioner or Respondent is domiciled in the Parish of ${parish}, Louisiana`;
  }

  /**
   * Generate Louisiana grounds section — covers Article 102, Article 103, fault, and covenant marriage
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Grounds section
   */
  generateGroundsSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 8;

    const grounds = divorceData.groundsForDivorce || 'article_102';

    if (grounds === 'article_102' || grounds === 'no_fault') {
      items.push({
        number: paragraphNum++,
        content: 'Petitioner seeks a divorce pursuant to Louisiana Civil Code Article 102. Petitioner requests that the Court render a judgment of divorce after the parties have lived separate and apart for the period required by law: one hundred eighty (180) days if there are no minor children of the marriage, or three hundred sixty-five (365) days if there are minor children of the marriage, from the date of service of this Petition.',
        type: 'grounds'
      });
    } else if (grounds === 'article_103_separation' || grounds === 'article_103') {
      items.push({
        number: paragraphNum++,
        content: 'Petitioner seeks a divorce pursuant to Louisiana Civil Code Article 103(1). The parties have lived separate and apart continuously for the period required by law: one hundred eighty (180) days if there are no minor children of the marriage, or three hundred sixty-five (365) days if there are minor children of the marriage. Petitioner requests that the Court render a judgment of divorce.',
        type: 'grounds'
      });
    } else if (grounds === 'adultery') {
      items.push({
        number: paragraphNum++,
        content: 'Petitioner seeks a divorce pursuant to Louisiana Civil Code Article 103(2). The Respondent has committed adultery.',
        type: 'grounds'
      });
    } else if (grounds === 'felony_conviction') {
      items.push({
        number: paragraphNum++,
        content: 'Petitioner seeks a divorce pursuant to Louisiana Civil Code Article 103(3). The Respondent has been convicted of a felony and has been sentenced to death or imprisonment at hard labor.',
        type: 'grounds'
      });
    } else if (grounds === 'covenant_adultery') {
      items.push({
        number: paragraphNum++,
        content: 'The parties entered into a covenant marriage. Petitioner seeks a divorce on the ground that Respondent has committed adultery. (La. R.S. 9:307(A)(1))',
        type: 'grounds'
      });
    } else if (grounds === 'covenant_abuse') {
      items.push({
        number: paragraphNum++,
        content: 'The parties entered into a covenant marriage. Petitioner seeks a divorce on the ground that Respondent has physically or sexually abused Petitioner or a child of one of the spouses. (La. R.S. 9:307(A)(4))',
        type: 'grounds'
      });
    } else if (grounds === 'covenant_abandonment') {
      items.push({
        number: paragraphNum++,
        content: 'The parties entered into a covenant marriage. Petitioner seeks a divorce on the ground that Respondent has abandoned the matrimonial domicile for one year and constantly refuses to return. (La. R.S. 9:307(A)(3))',
        type: 'grounds'
      });
    } else if (grounds === 'covenant_separation') {
      items.push({
        number: paragraphNum++,
        content: 'The parties entered into a covenant marriage. The parties have lived separate and apart for at least two (2) years. (La. R.S. 9:307(A)(6))',
        type: 'grounds'
      });
    } else {
      // Default to Article 102
      items.push({
        number: paragraphNum++,
        content: 'Petitioner seeks a divorce pursuant to Louisiana Civil Code Article 102. Petitioner requests that the Court render a judgment of divorce after the parties have lived separate and apart for the period required by law from the date of service of this Petition.',
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
   * Generate Louisiana children section — uses "Joint Custody" with "Domiciliary Parent"
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Children section
   */
  generateChildrenSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 9;

    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      items.push({
        number: paragraphNum++,
        content: 'There are no minor children born of or adopted during this marriage, and none are expected.',
        type: 'children_info'
      });
    } else {
      items.push({
        number: paragraphNum++,
        content: 'The following minor children were born of or adopted during this marriage:',
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
        content: `Petitioner requests the Court to award joint custody of the minor child(ren) in the best interests of the child(ren) pursuant to Louisiana Civil Code Article 131 et seq., and to designate ${divorceData.domiciliaryParent || divorceData.petitionerName || 'Petitioner'} as the domiciliary parent and ${divorceData.nonDomiciliaryParent || divorceData.respondentName || 'Respondent'} as the non-domiciliary parent, with a custody implementation plan established pursuant to La. R.S. 9:335.`,
        type: 'children_info'
      });
    }

    return {
      title: 'V. CHILDREN',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Louisiana property section — community property / equal 50/50 partition
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property section
   */
  generatePropertySection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 12;

    items.push({
      number: paragraphNum++,
      content: 'The parties have accumulated community property and community debts during the marriage. Petitioner requests that the Court order an equal partition of the community property and community debts pursuant to Louisiana Civil Code Article 2336 et seq. and La. R.S. 9:2801.',
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: 'Petitioner further requests that each party be confirmed as the owner of their separate property, including property acquired before the marriage, property acquired during the marriage by gift or inheritance, and property designated as separate by valid matrimonial agreement.',
      type: 'property_info'
    });

    return {
      title: 'VI. COMMUNITY PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Louisiana relief section — uses Louisiana-specific terminology
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Relief section
   */
  generateReliefSection(divorceData) {
    const items = [];

    items.push({
      number: null,
      content: 'WHEREFORE, Petitioner prays that after all legal delays have elapsed and due proceedings have been had, that this Court:',
      type: 'relief_intro'
    });

    const reliefItems = [
      'Enter a Judgment of Divorce dissolving the marriage between Petitioner and Respondent;',
      'Order an equal partition of the community property and community debts pursuant to La. C.C. Art. 2336 et seq. and La. R.S. 9:2801;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push(`Award joint custody of the minor child(ren) and designate ${divorceData.domiciliaryParent || divorceData.petitionerName || 'Petitioner'} as domiciliary parent pursuant to La. C.C. Art. 131 et seq. and La. R.S. 9:335;`);
      reliefItems.push('Establish a custody implementation plan with appropriate visitation and custodial time for the non-domiciliary parent;');
      reliefItems.push('Order child support in accordance with the Louisiana Child Support Guidelines, La. R.S. 9:315 et seq.;');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award interim spousal support pending the divorce and/or final periodic spousal support to Petitioner pursuant to La. C.C. Art. 111-113;');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`Authorize Petitioner to resume use of the former name: ${divorceData.previousName};`);
    }

    reliefItems.push('Grant such other and further relief as the Court deems just and equitable.');

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
   * Get Louisiana verification text
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PETITIONER NAME]';
    return `I, ${name}, declare under penalty of perjury under the laws of the State of Louisiana that the facts stated in this Petition are true and correct to the best of my knowledge and belief.

Date: ___________________

_________________________________
${name}
Petitioner`;
  }

  /**
   * Perform Louisiana-specific validation
   * Accepts either parish or county field for compatibility
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    const parish = divorceData.parish || divorceData.county;
    if (!parish) {
      errors.push('Parish is required for Louisiana divorce petitions (Louisiana uses parishes, not counties)');
    }

    warnings.push('Louisiana requires domicile in the state. Six months of parish residency establishes domicile. (La. C.C. Art. 10; La. C.C.P. Art. 3941)');

    const grounds = divorceData.groundsForDivorce || 'article_102';
    if (grounds === 'article_102' || grounds === 'no_fault') {
      if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
        warnings.push('Article 102 with minor children: 365 days must elapse after service of petition before divorce can be granted.');
      } else {
        warnings.push('Article 102 without minor children: 180 days must elapse after service of petition before divorce can be granted.');
      }
    }

    warnings.push('Louisiana is a community property state. All community property is divided equally (50/50). (La. C.C. Art. 2336; La. R.S. 9:2801)');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('A custody implementation plan designating the domiciliary parent must be established per La. R.S. 9:335.');
      warnings.push('Child support must be calculated using the Louisiana Child Support Guidelines (La. R.S. 9:315 et seq.).');
    }

    return { errors, warnings };
  }
}

module.exports = LouisianaDivorcePetitionTemplate;
