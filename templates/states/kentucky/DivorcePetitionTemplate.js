// templates/states/kentucky/DivorcePetitionTemplate.js
// Kentucky Petition for Dissolution of Marriage template
// Complies with KRS 403.140 et seq. (Dissolution of Marriage)

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Kentucky Petition for Dissolution of Marriage Template
 *
 * Legal References:
 * - KRS 403.140 — Jurisdiction (180-day residency)
 * - KRS 403.170 — Grounds (irretrievable breakdown); 60-day waiting period
 * - KRS 403.190 — Disposition of marital property (equitable distribution)
 * - KRS 403.200 — Maintenance
 * - KRS 403.270 — Child custody (joint and sole)
 * - KRS 403.320 — Timesharing and visitation
 * - KRS 403.211 et seq. — Child support guidelines (income shares model)
 *
 * Kentucky-Specific Notes:
 * - Called "Dissolution of Marriage" — petition is "Petition for Dissolution of Marriage"
 * - Pure no-fault state — only ground is "irretrievable breakdown"
 * - 180-day residency requirement (approximately 6 months)
 * - 60-day mandatory waiting period from date petition is filed
 * - "Maintenance" (not alimony or spousal support)
 * - "Joint Custody" and "Sole Custody" (not parental responsibilities)
 * - "Timesharing" / "Visitation" (not parenting time)
 * - Equitable distribution (NOT community property)
 * - Filed in Family Court (where established) or Circuit Court
 * - Kentucky is a Commonwealth — header uses "COMMONWEALTH OF KENTUCKY"
 */
class KentuckyDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'KY';
    this.stateName = 'Kentucky';
    this.documentTitle = 'PETITION FOR DISSOLUTION OF MARRIAGE';

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

    // Kentucky — 180 days (approx. 6 months), no county requirement
    this.residencyRequirements = {
      stateMonths: 6,
      countyDays: 0,
      description: 'At least one party must have been a resident of Kentucky for at least 180 days immediately preceding the filing of the petition. (KRS 403.140)'
    };

    // Kentucky — 60-day waiting period from filing
    this.waitingPeriod = {
      days: 60,
      startsFrom: 'separation',
      exceptions: [],
      description: 'A decree cannot be entered until the parties have lived apart for 60 days; living apart includes living under the same roof without sexual cohabitation. (KRS 403.170(1))'
    };
  }

  /**
   * Get Kentucky case number label — "CASE NO."
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'CASE NO.';
  }

  /**
   * Get default court for Kentucky county — Family Court or Circuit Court
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `Family Court, ${countyName} County, Kentucky`;
  }

  /**
   * Generate Kentucky header — Commonwealth
   * @returns {string} Header text
   */
  generateHeader() {
    return 'COMMONWEALTH OF KENTUCKY';
  }

  /**
   * Generate Kentucky venue — title case per Kentucky practice
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Get Kentucky jurisdiction statement — 180-day residency
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    return `Petitioner has been a resident of the Commonwealth of Kentucky for at least one hundred eighty (180) days immediately preceding the filing of this Petition. (KRS 403.140)`;
  }

  /**
   * Get Kentucky venue reason
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    return `Petitioner resides in ${divorceData.county || '[COUNTY]'} County, Kentucky`;
  }

  /**
   * Generate Kentucky grounds section — irretrievable breakdown only
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Grounds section
   */
  generateGroundsSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 8;

    items.push({
      number: paragraphNum++,
      content: 'The marriage of the parties is irretrievably broken and there is no reasonable prospect of reconciliation. (KRS 403.170)',
      type: 'grounds'
    });

    return {
      title: 'IV. GROUNDS FOR DISSOLUTION',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Kentucky children section — uses "joint custody," "sole custody," and "timesharing"
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
        content: 'Petitioner requests that the Court award custody of the minor child(ren) and establish a timesharing schedule in the best interests of the child(ren) pursuant to KRS 403.270 and KRS 403.320.',
        type: 'children_info'
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
   * Generate Kentucky property section — marital property / equitable distribution
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
    let paragraphNum = divorceData._paragraphNum || 12;

    items.push({
      number: paragraphNum++,
      content: 'The parties have accumulated marital property and debts during the marriage. Petitioner requests that the Court divide the marital property and debts in just proportions pursuant to KRS 403.190.',
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: 'Each party is entitled to their non-marital (separate) property, being property acquired before the marriage, acquired during the marriage by gift or inheritance, or acquired in exchange for non-marital property.',
      type: 'property_info'
    });

    return {
      title: 'VI. PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Kentucky relief section — uses Kentucky-specific terminology
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Relief section
   */
  generateReliefSection(divorceData) {
    const items = [];

    items.push({
      number: null,
      content: 'WHEREFORE, Petitioner requests that the Court:',
      type: 'relief_intro'
    });

    const reliefItems = [
      'Enter a Decree of Dissolution of Marriage;',
      'Divide the marital property and debts in just proportions pursuant to KRS 403.190;',
      'Confirm each party\'s non-marital property;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Award custody of the minor child(ren) and establish a timesharing schedule in the best interests of the child(ren) pursuant to KRS 403.270 and KRS 403.320;');
      reliefItems.push('Order child support in accordance with the Kentucky Child Support Guidelines, KRS 403.211;');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award maintenance to Petitioner pursuant to KRS 403.200;');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`Restore Petitioner's former name to: ${divorceData.previousName};`);
    }

    reliefItems.push('Grant such other and further relief as the Court deems just and proper.');

    // Agreed corollary relief (agreed support amount, spousal-support

    // waiver, property agreement) — spliced before the final general prayer.

    this.appendAgreedReliefItems(reliefItems, divorceData);


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
   * Get Kentucky verification text
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PETITIONER NAME]';
    return `I, ${name}, declare under penalty of perjury under the laws of the Commonwealth of Kentucky that the facts stated in this Petition are true and correct to the best of my knowledge and belief.

Date: ___________________

_________________________________
${name}
Petitioner`;
  }

  /**
   * Perform Kentucky-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for Kentucky dissolution petitions');
    }

    warnings.push('At least one party must have resided in Kentucky for 180 days before filing. (KRS 403.140)');
    warnings.push('A decree cannot be entered until 60 days have elapsed after the filing of the petition. (KRS 403.170(1))');
    warnings.push('Kentucky is a pure no-fault state. The only ground for dissolution is irretrievable breakdown.');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('A Child Support Worksheet (AOC-238) must be completed when minor children are involved. (KRS 403.211)');
      warnings.push('A timesharing/visitation schedule must be proposed or agreed upon. (KRS 403.320)');
    }

    return { errors, warnings };
  }
}

module.exports = KentuckyDivorcePetitionTemplate;
