// templates/states/minnesota/DivorcePetitionTemplate.js
// Minnesota Petition for Dissolution of Marriage template
// Complies with Minn. Stat. § 518.06 et seq. (Marriage Dissolution)

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Minnesota Petition for Dissolution of Marriage Template
 *
 * Legal References:
 * - Minn. Stat. § 518.06 — Grounds (irretrievable breakdown)
 * - Minn. Stat. § 518.07 — Jurisdiction (180-day residency)
 * - Minn. Stat. § 518.58 — Disposition of marital property (equitable distribution)
 * - Minn. Stat. § 518.552 — Spousal maintenance
 * - Minn. Stat. § 518.17 — Best interests of child / custody
 * - Minn. Stat. § 518.003 — Definitions (legal custody, physical custody)
 * - Minn. Stat. § 518A.26 et seq. — Child support guidelines
 *
 * Minnesota-Specific Notes:
 * - Called "Dissolution of Marriage" — petition is "Petition for Dissolution of Marriage"
 * - Pure no-fault state — only ground is "irretrievable breakdown"
 * - 180-day residency requirement (approximately 6 months)
 * - No mandatory waiting period
 * - "Spousal Maintenance" (not alimony)
 * - "Legal Custody" and "Physical Custody" (joint custody common)
 * - "Parenting Time" (not visitation)
 * - Equitable distribution (NOT community property)
 * - Filed in District Court (Family Court Division)
 * - Case number label: "COURT FILE NO."
 */
class MinnesotaDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'MN';
    this.stateName = 'Minnesota';
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

    // Minnesota — 180 days (approx. 6 months), no county requirement
    this.residencyRequirements = {
      stateMonths: 6,
      countyDays: 0,
      description: 'At least one party must have resided in Minnesota for at least 180 days immediately preceding the filing of the petition. (Minn. Stat. § 518.07)'
    };

    // Minnesota — no mandatory waiting period
    this.waitingPeriod = {
      days: 0,
      startsFrom: 'filing_date',
      exceptions: [],
      description: 'Minnesota has no mandatory post-filing waiting period.'
    };
  }

  /**
   * Get Minnesota case number label — "COURT FILE NO."
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'COURT FILE NO.';
  }

  /**
   * Get default court for Minnesota county — District Court
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `District Court, ${countyName} County, Minnesota`;
  }

  /**
   * Generate Minnesota header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF MINNESOTA';
  }

  /**
   * Generate Minnesota venue — title case per Minnesota practice
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Get Minnesota jurisdiction statement — 180-day residency
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    return `Petitioner has resided in the State of Minnesota for at least one hundred eighty (180) days immediately preceding the filing of this Petition. (Minn. Stat. § 518.07)`;
  }

  /**
   * Get Minnesota venue reason
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    return `Petitioner or Respondent resides in ${divorceData.county || '[COUNTY]'} County, Minnesota`;
  }

  /**
   * Generate Minnesota grounds section — irretrievable breakdown only
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Grounds section
   */
  generateGroundsSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 8;

    items.push({
      number: paragraphNum++,
      content: 'There has been an irretrievable breakdown of the marriage relationship, and there is no reasonable prospect of reconciliation. (Minn. Stat. § 518.06)',
      type: 'grounds'
    });

    return {
      title: 'IV. GROUNDS FOR DISSOLUTION',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Minnesota children section — uses "legal custody," "physical custody," and "parenting time"
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
        content: 'Petitioner requests that the Court award legal custody, physical custody, and parenting time in the best interests of the child(ren) pursuant to Minn. Stat. § 518.17.',
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
   * Generate Minnesota property section — marital property / equitable distribution
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
      content: 'The parties have accumulated marital property and debts during the marriage. Petitioner requests that the Court make a just and equitable division of the marital property and debts pursuant to Minn. Stat. § 518.58.',
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: 'Each party is entitled to their non-marital (separate) property, being property acquired before the marriage, acquired during the marriage by gift or inheritance, or excluded by valid prenuptial agreement.',
      type: 'property_info'
    });

    return {
      title: 'VI. PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Minnesota relief section — uses Minnesota-specific terminology
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
      'Enter a Judgment and Decree dissolving the marriage of the parties;',
      'Make a just and equitable division of the marital property and debts pursuant to Minn. Stat. § 518.58;',
      'Confirm each party\'s non-marital property;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Award legal custody and physical custody and establish parenting time in the best interests of the child(ren) pursuant to Minn. Stat. § 518.17;');
      reliefItems.push('Order child support in accordance with the Minnesota Child Support Guidelines, Minn. Stat. § 518A.26;');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award spousal maintenance to Petitioner pursuant to Minn. Stat. § 518.552;');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`Restore Petitioner's former name to: ${divorceData.previousName};`);
    }

    reliefItems.push('Grant such other and further relief as the Court deems just and equitable.');

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
   * Get Minnesota verification text
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PETITIONER NAME]';
    return `I, ${name}, declare under penalty of perjury under the laws of the State of Minnesota that the facts stated in this Petition are true and correct to the best of my knowledge and belief.

Date: ___________________

_________________________________
${name}
Petitioner`;
  }

  /**
   * Perform Minnesota-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for Minnesota dissolution petitions');
    }

    warnings.push('At least one party must have resided in Minnesota for 180 days before filing. (Minn. Stat. § 518.07)');
    warnings.push('Minnesota is a pure no-fault state. The only ground for dissolution is irretrievable breakdown.');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('A Parenting Plan is required when minor children are involved.');
      warnings.push('Child support must be calculated using the Minnesota Child Support Guidelines (Minn. Stat. § 518A.26).');
    }

    return { errors, warnings };
  }
}

module.exports = MinnesotaDivorcePetitionTemplate;
