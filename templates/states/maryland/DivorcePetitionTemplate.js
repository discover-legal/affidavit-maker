// templates/states/maryland/DivorcePetitionTemplate.js
// Maryland Complaint for Absolute Divorce template
// Complies with Md. Code, Fam. Law § 7-101 et seq.

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Maryland Complaint for Absolute Divorce Template
 *
 * Legal References:
 * - Md. Code, Fam. Law § 7-101 et seq. — Divorce jurisdiction and residency
 * - Md. Code, Fam. Law § 7-103 — Grounds for absolute divorce
 * - Md. Code, Fam. Law § 8-205 — Disposition of marital property (equitable distribution)
 * - Md. Code, Fam. Law § 11-106 — Alimony
 * - Md. Code, Fam. Law § 9-101 et seq. — Child custody (legal and physical)
 * - Md. Code, Fam. Law § 12-204 — Child support guidelines (income shares model)
 *
 * Maryland-Specific Notes:
 * - Called "Absolute Divorce" — complaint is "Complaint for Absolute Divorce"
 * - No-fault grounds: mutual consent (no waiting), irreconcilable differences (Oct 2023), 6-month separation
 * - ALL fault grounds ELIMINATED effective October 1, 2023 (HB 380) — Maryland is now purely no-fault
 * - "Alimony" (not maintenance or spousal support)
 * - "Legal Custody" and "Physical Custody" (not parental responsibilities)
 * - Equitable distribution (NOT community property)
 * - Filed in Circuit Court
 */
class MarylandDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'MD';
    this.stateName = 'Maryland';
    this.documentTitle = 'COMPLAINT FOR ABSOLUTE DIVORCE';

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

    // Maryland — 6 months if grounds arose outside MD; no minimum if grounds arose in MD
    this.residencyRequirements = {
      stateMonths: 6,
      countyDays: 0,
      description: 'If the grounds for divorce occurred outside Maryland, at least one party must have been a resident of Maryland for at least 6 months before filing. If the grounds occurred in Maryland, the filing party need only be a current resident. (Md. Code, Fam. Law § 7-101)'
    };

    // Maryland — no mandatory post-filing waiting period for mutual consent
    this.waitingPeriod = {
      days: 0,
      startsFrom: 'filing_date',
      exceptions: ['Mutual consent ground requires a signed settlement agreement; 6-month separation ground requires living apart for 6 months before filing'],
      description: 'Maryland has no mandatory post-filing waiting period for mutual consent divorces.'
    };
  }

  /**
   * Get Maryland case number label — "CASE NO."
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'CASE NO.';
  }

  /**
   * Get default court for Maryland county — Circuit Court
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    if (countyName.toLowerCase().includes('baltimore city')) {
      return 'Circuit Court for Baltimore City, Maryland';
    }
    return `Circuit Court for ${countyName} County, Maryland`;
  }

  /**
   * Generate Maryland header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF MARYLAND';
  }

  /**
   * Generate Maryland venue — title case per Maryland practice
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    if (countyName.toLowerCase().includes('baltimore city')) {
      return 'Baltimore City';
    }
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Get Maryland jurisdiction statement
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    return `Plaintiff has been a resident of the State of Maryland for at least six (6) months immediately preceding the filing of this Complaint, or the grounds for divorce arose in Maryland. (Md. Code, Fam. Law § 7-101)`;
  }

  /**
   * Get Maryland venue reason
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    const county = divorceData.county || '[COUNTY]';
    if (county.toLowerCase().includes('baltimore city')) {
      return 'Plaintiff or Defendant resides in Baltimore City, Maryland';
    }
    return `Plaintiff or Defendant resides in ${county} County, Maryland`;
  }

  /**
   * Generate Maryland grounds section — supports both no-fault and fault grounds
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Grounds section
   */
  generateGroundsSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 8;
    const grounds = divorceData.groundsForDivorce || 'mutual_consent';

    // Maryland eliminated ALL fault grounds effective October 1, 2023 (HB 380).
    // Only no-fault grounds remain: mutual consent, irreconcilable differences, 6-month separation.
    if (grounds === 'mutual_consent') {
      items.push({
        number: paragraphNum++,
        content: 'The parties mutually consent to the divorce and have executed a written settlement agreement resolving all issues of alimony, property distribution, and, if applicable, child custody, visitation, and child support. (Md. Code, Fam. Law § 7-103(a)(3))',
        type: 'grounds'
      });
    } else if (grounds === 'irreconcilable_differences' || grounds === 'no_fault') {
      items.push({
        number: paragraphNum++,
        content: 'The differences between the parties are irreconcilable and there is no reasonable prospect of reconciliation. (Md. Code, Fam. Law § 7-103(a)(2))',
        type: 'grounds'
      });
    } else if (grounds === 'six_month_separation' || grounds === 'separation') {
      items.push({
        number: paragraphNum++,
        content: 'The parties have lived separate and apart without cohabitation for at least six (6) months prior to the filing of this Complaint. Under the October 2023 amendments, spouses may be considered "separate" while living under the same roof if they pursue separate lives. (Md. Code, Fam. Law § 7-103(a)(3))',
        type: 'grounds'
      });
    } else {
      // Default to irreconcilable differences (most common)
      items.push({
        number: paragraphNum++,
        content: 'The differences between the parties are irreconcilable and there is no reasonable prospect of reconciliation. (Md. Code, Fam. Law § 7-103(a)(2))',
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
   * Generate Maryland children section — uses "legal custody" and "physical custody"
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
        content: 'Plaintiff requests that the Court award legal custody and physical custody of the minor child(ren) in the best interests of the child(ren) pursuant to Md. Code, Fam. Law § 9-101 et seq.',
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
   * Generate Maryland property section — marital property / equitable distribution
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property section
   */
  generatePropertySection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 12;

    items.push({
      number: paragraphNum++,
      content: 'The parties have accumulated marital property and debts during the marriage. Plaintiff requests that the Court equitably distribute the marital property and debts and grant a monetary award if necessary to achieve equity, pursuant to Md. Code, Fam. Law § 8-205.',
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: 'Each party is entitled to their non-marital (separate) property, being property acquired before the marriage or acquired during the marriage by gift or inheritance.',
      type: 'property_info'
    });

    return {
      title: 'VI. PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Maryland relief section — uses Maryland-specific terminology
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Relief section
   */
  generateReliefSection(divorceData) {
    const items = [];

    items.push({
      number: null,
      content: 'WHEREFORE, Plaintiff requests that the Court:',
      type: 'relief_intro'
    });

    const reliefItems = [
      'Grant an Absolute Divorce to the Plaintiff;',
      'Equitably distribute the marital property and debts and grant a monetary award if necessary pursuant to Md. Code, Fam. Law § 8-205;',
      'Confirm each party\'s non-marital property;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Award legal custody and physical custody of the minor child(ren) in the best interests of the child(ren) pursuant to Md. Code, Fam. Law § 9-101 et seq.;');
      reliefItems.push('Order child support in accordance with the Maryland Child Support Guidelines, Md. Code, Fam. Law § 12-204;');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award alimony to Plaintiff pursuant to Md. Code, Fam. Law § 11-106;');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`Restore Plaintiff's former name to: ${divorceData.previousName};`);
    }

    reliefItems.push('Grant such other and further relief as the Court deems just and proper.');

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
   * Get Maryland verification text
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PLAINTIFF NAME]';
    return `I, ${name}, solemnly affirm under the penalties of perjury that the contents of this Complaint are true and correct to the best of my knowledge, information, and belief.

Date: ___________________

_________________________________
${name}
Plaintiff`;
  }

  /**
   * Perform Maryland-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County (or Baltimore City) is required for Maryland Complaint for Absolute Divorce');
    }

    const grounds = divorceData.groundsForDivorce || '';
    if (grounds === 'mutual_consent') {
      warnings.push('Mutual consent divorce requires a signed written settlement agreement resolving all issues. Both parties must appear at the hearing.');
    } else if (grounds === 'six_month_separation' || grounds === 'separation') {
      warnings.push('The parties must have lived separate and apart without cohabitation for at least 6 months before filing. Under the October 2023 amendments, spouses may be considered "separate" while living under the same roof if they pursue separate lives. (Md. Code, Fam. Law § 7-103(a)(3))');
    }

    warnings.push('Maryland eliminated ALL fault-based grounds effective October 1, 2023 (HB 380). Only no-fault grounds are available: mutual consent, irreconcilable differences, or 6-month separation.');
    warnings.push('If the grounds occurred outside Maryland, at least one party must have resided in Maryland for at least 6 months before filing. (Md. Code, Fam. Law § 7-101)');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('A Child Support Guidelines Worksheet must be completed when minor children are involved. (Md. Code, Fam. Law § 12-204)');
    }

    return { errors, warnings };
  }
}

module.exports = MarylandDivorcePetitionTemplate;
