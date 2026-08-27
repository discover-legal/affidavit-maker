// templates/states/mississippi/DivorcePetitionTemplate.js
// Mississippi Complaint for Divorce template
// Complies with Miss. Code §93-5 (Divorce)

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Mississippi Complaint for Divorce Template
 *
 * Legal References:
 * - Miss. Code §93-5 — Divorce
 * - Miss. Code §93-5-5 — Residency requirement (6 months bona fide resident)
 * - Miss. Code §93-5-1 — Fault grounds for divorce
 * - Miss. Code §93-5-2 — No-fault ground (irreconcilable differences, 60-day waiting)
 * - Miss. Code §93-5-23 — Property division (equitable distribution); alimony
 * - Miss. Code §93-5-24 — Child custody (legal and physical custody, visitation)
 * - Miss. Code §43-19-101 et seq. — Mississippi Child Support Guidelines (percentage of income)
 *
 * Mississippi-Specific Notes:
 * - Called "Complaint for Divorce" — NOT petition
 * - Both fault and no-fault grounds available
 * - No-fault requires consent of both parties or 60-day waiting; fault has no waiting
 * - 6-month bona fide residency requirement
 * - Filed in CHANCERY COURT (unique to Mississippi)
 * - Case number label: "CAUSE NO."
 * - Parties: "Complainant" and "Defendant" (unique to Mississippi)
 * - "Legal Custody" / "Physical Custody"
 * - "Visitation" terminology
 * - "Alimony" (periodic, lump-sum, rehabilitative)
 * - Dual classification: marital vs separate property
 * - Filing fee ~$148–$158 (varies by county)
 */
class MississippiDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'MS';
    this.stateName = 'Mississippi';
    this.documentTitle = 'COMPLAINT FOR DIVORCE';

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

    // Mississippi — 6 months bona fide resident
    this.residencyRequirements = {
      stateMonths: 6,
      countyMonths: 0,
      description: 'At least one party must have been a bona fide resident of Mississippi for at least six (6) months immediately preceding the filing of the complaint. (Miss. Code §93-5-5)'
    };

    // Mississippi waiting period — 60 days for irreconcilable differences; none for fault
    this.waitingPeriod = {
      days: 60,
      startsFrom: 'filing_date',
      exceptions: ['No waiting period for fault-based divorce'],
      description: 'For irreconcilable differences (no-fault), a 60-day waiting period from filing applies. No waiting period for fault-based divorce. (Miss. Code §93-5-2)'
    };
  }

  /**
   * Get Mississippi case number label — "CAUSE NO."
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'CAUSE NO.';
  }

  /**
   * Get default court for Mississippi county — Chancery Court
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `Chancery Court of ${countyName} County, Mississippi`;
  }

  /**
   * Generate Mississippi header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF MISSISSIPPI';
  }

  /**
   * Generate Mississippi venue — title case per Mississippi practice
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Get Mississippi jurisdiction statement — 6-month bona fide residency
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    return `Complainant has been a bona fide resident of the State of Mississippi for at least six (6) months immediately preceding the filing of this Complaint. (Miss. Code §93-5-5)`;
  }

  /**
   * Get Mississippi venue reason
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    return `Complainant resides in ${divorceData.county || '[COUNTY]'} County, Mississippi`;
  }

  /**
   * Generate Mississippi grounds section — both fault and no-fault
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Grounds section
   */
  generateGroundsSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 8;

    const grounds = divorceData.groundsForDivorce || 'irreconcilable_differences';

    if (grounds === 'irreconcilable_differences' || grounds === 'no_fault') {
      items.push({
        number: paragraphNum++,
        content: 'The parties have irreconcilable differences which have caused the breakdown of the marriage. (Miss. Code §93-5-2)',
        type: 'grounds'
      });
    } else if (grounds === 'adultery') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has committed adultery. (Miss. Code §93-5-1(a))',
        type: 'grounds'
      });
    } else if (grounds === 'habitual_cruel_treatment') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has been guilty of habitual cruel and inhuman treatment toward Complainant. (Miss. Code §93-5-1(c))',
        type: 'grounds'
      });
    } else if (grounds === 'habitual_drunkenness') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has been habitually drunk. (Miss. Code §93-5-1(d))',
        type: 'grounds'
      });
    } else if (grounds === 'drug_use') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has been habitually and excessively using opium, morphine, or other such drug. (Miss. Code §93-5-1(e))',
        type: 'grounds'
      });
    } else if (grounds === 'natural_impotency') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant was naturally impotent at the time of the marriage. (Miss. Code §93-5-1(b))',
        type: 'grounds'
      });
    } else if (grounds === 'imprisonment') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has been sentenced to imprisonment in a state or federal penal institution. (Miss. Code §93-5-1(f))',
        type: 'grounds'
      });
    } else if (grounds === 'desertion') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has been guilty of willful, continued, and obstinate desertion for one (1) year. (Miss. Code §93-5-1(g))',
        type: 'grounds'
      });
    } else if (grounds === 'insanity') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant was insane or idiotic at the time of the marriage, which was unknown to Complainant. (Miss. Code §93-5-1(h))',
        type: 'grounds'
      });
    } else if (grounds === 'pregnancy_by_another') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant was pregnant at the time of marriage by another person, without the knowledge of Complainant. (Miss. Code §93-5-1(i))',
        type: 'grounds'
      });
    } else if (grounds === 'incurable_insanity') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has been incurably insane at the time of filing, having been confined for at least three (3) years. (Miss. Code §93-5-1(l))',
        type: 'grounds'
      });
    } else {
      items.push({
        number: paragraphNum++,
        content: 'The parties have irreconcilable differences which have caused the breakdown of the marriage. (Miss. Code §93-5-2)',
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
   * Generate Mississippi children section — uses "legal custody" and "physical custody"
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Children section
   */
  generateChildrenSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 9;

    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      items.push({
        number: paragraphNum++,
        content: 'There are no children born of or adopted during this marriage, and none are expected.',
        type: 'children_info'
      });
    } else {
      items.push({
        number: paragraphNum++,
        content: 'The following children were born of or adopted during this marriage:',
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
        content: 'Complainant requests the Court to determine legal custody and physical custody of the minor child(ren) in the best interests of the child(ren) pursuant to Miss. Code §93-5-24, and to establish a visitation schedule.',
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
   * Generate Mississippi property section — equitable distribution, dual classification
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
      content: 'The parties have accumulated marital property and debts during the marriage. Complainant requests that the Court equitably divide the marital property and debts pursuant to Miss. Code §93-5-23.',
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: 'Complainant requests the Court to classify the property of the parties as marital or separate, and to consider the substantial contribution of each party to the accumulation of the property, the use of marital property for non-marital purposes, the dissipation of assets, the market and emotional value of the property, and the needs of each party.',
      type: 'property_info'
    });

    return {
      title: 'VI. PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Mississippi relief section — uses Mississippi-specific terminology
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Relief section
   */
  generateReliefSection(divorceData) {
    const items = [];

    items.push({
      number: null,
      content: 'WHEREFORE, PREMISES CONSIDERED, Complainant prays that the Court:',
      type: 'relief_intro'
    });

    const reliefItems = [
      'Enter a Final Judgment of Divorce dissolving the bonds of matrimony;',
      'Equitably divide the marital property and debts pursuant to Miss. Code §93-5-23;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Determine legal custody and physical custody of the minor child(ren) in the best interests of the child(ren) pursuant to Miss. Code §93-5-24;');
      reliefItems.push('Establish a visitation schedule;');
      reliefItems.push('Order child support in accordance with the Mississippi Child Support Guidelines, Miss. Code §43-19-101 et seq.;');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award alimony to Complainant pursuant to Miss. Code §93-5-23;');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`Restore Complainant's former name to: ${divorceData.previousName};`);
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
   * Get Mississippi verification text
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[COMPLAINANT NAME]';
    return `I, ${name}, declare under penalty of perjury under the laws of the State of Mississippi that the facts stated in this Complaint are true and correct to the best of my knowledge and belief.

Date: ___________________

_________________________________
${name}
Complainant`;
  }

  /**
   * Perform Mississippi-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for Mississippi divorce complaints');
    }

    warnings.push('Mississippi requires 6 months of bona fide state residency before filing. (Miss. Code §93-5-5)');
    warnings.push('For irreconcilable differences, a 60-day waiting period applies from filing. No waiting period for fault-based divorce. (Miss. Code §93-5-2)');
    warnings.push('Mississippi uses Chancery Court (not Circuit Court) for divorce cases.');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('A custody and visitation plan must be established per Miss. Code §93-5-24.');
      warnings.push('Child support must be calculated using the Mississippi Child Support Guidelines (Miss. Code §43-19-101 et seq.).');
    }

    return { errors, warnings };
  }
}

module.exports = MississippiDivorcePetitionTemplate;
