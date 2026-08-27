// templates/states/vermont/DivorcePetitionTemplate.js
// Vermont Complaint for Divorce template
// Complies with 15 V.S.A. § 551 et seq.

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Vermont Complaint for Divorce Template
 *
 * Legal References:
 * - 15 V.S.A. § 551 — Grounds for divorce (no-fault and fault-based)
 * - 15 V.S.A. § 592 — Residency requirement (6 months)
 * - 15 V.S.A. § 665 — Legal Responsibility, Physical Responsibility, Parent-Child Contact
 * - 15 V.S.A. § 656 — Child support guidelines (income shares model)
 * - 15 V.S.A. § 751 — Property disposition (equitable distribution)
 * - 15 V.S.A. § 752 — Maintenance
 * - 4 V.S.A. § 31 — Family Division of the Superior Court
 *
 * Vermont-Specific Notes:
 * - Called "Complaint for Divorce" and "Final Divorce Order"
 * - Both no-fault and fault grounds available (15 V.S.A. § 551)
 * - 6-month residency requirement
 * - No mandatory statutory waiting period
 * - "Legal Responsibility" (NOT legal custody)
 * - "Physical Responsibility" (NOT physical custody)
 * - "Parent-Child Contact" (NOT visitation)
 * - "Maintenance" (NOT alimony or spousal support)
 * - Equitable distribution (NOT community property)
 * - Filed in Family Division of the Superior Court
 */
class VermontDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'VT';
    this.stateName = 'Vermont';
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

    // Vermont — 6-month residency, no county requirement
    this.residencyRequirements = {
      stateMonths: 6,
      countyDays: 0,
      description: 'One party must have resided in the State of Vermont for at least six (6) months immediately preceding the filing of this Complaint. (15 V.S.A. § 592)'
    };

    // Vermont decrees issue nisi and become absolute three months after entry
    this.waitingPeriod = {
      days: 90,
      startsFrom: 'decree_entry',
      exceptions: ['court_may_set_earlier_date'],
      description: 'Vermont decrees are issued nisi and become absolute three months after entry unless the court fixes an earlier date (15 V.S.A. § 554). A final hearing also requires one year of Vermont residency (15 V.S.A. § 592).'
    };
  }

  /**
   * Get Vermont case number label — "DOCKET NO."
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'DOCKET NO.';
  }

  /**
   * Get default court for Vermont county — Family Division of the Superior Court
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `Family Division of the Superior Court, ${countyName} Unit`;
  }

  /**
   * Generate Vermont header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF VERMONT';
  }

  /**
   * Generate Vermont venue — "[County] Unit" per Vermont judicial structure
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `${countyFormatted} Unit`;
  }

  /**
   * Get Vermont jurisdiction statement — 6-month residency
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    return `Plaintiff has resided in the State of Vermont for at least six (6) months immediately preceding the filing of this Complaint for Divorce. (15 V.S.A. § 592)`;
  }

  /**
   * Get Vermont venue reason
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    return `Plaintiff or Defendant resides in ${divorceData.county || '[COUNTY]'} County, Vermont`;
  }

  /**
   * Generate Vermont grounds section — no-fault and fault grounds per 15 V.S.A. § 551
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Grounds section
   */
  generateGroundsSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 8;

    const grounds = divorceData.groundsForDivorce || 'irretrievable_breakdown';

    if (grounds === 'lived_apart') {
      items.push({
        number: paragraphNum++,
        content: 'The parties have lived apart for six (6) consecutive months and the resumption of marital relations is not reasonably probable. (15 V.S.A. § 551)',
        type: 'grounds'
      });
    } else if (grounds === 'adultery') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has committed adultery. (15 V.S.A. § 551(1))',
        type: 'grounds'
      });
    } else if (grounds === 'imprisonment') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has been sentenced to confinement at hard labor for three years or more and is actually confined. (15 V.S.A. § 551(2))',
        type: 'grounds'
      });
    } else if (grounds === 'intolerable_severity') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has treated Plaintiff with intolerable severity. (15 V.S.A. § 551(3))',
        type: 'grounds'
      });
    } else if (grounds === 'willful_desertion') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has willfully deserted Plaintiff for seven consecutive years. (15 V.S.A. § 551(4))',
        type: 'grounds'
      });
    } else if (grounds === 'persistent_refusal_to_provide') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has persistently refused or neglected to provide suitable maintenance for Plaintiff when able to do so. (15 V.S.A. § 551(5))',
        type: 'grounds'
      });
    } else if (grounds === 'incurable_insanity') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has been confined to a mental institution for at least five years and has been adjudged incurably insane. (15 V.S.A. § 551(6))',
        type: 'grounds'
      });
    } else {
      items.push({
        number: paragraphNum++,
        content: 'The marriage of the parties is irretrievably broken. (15 V.S.A. § 551)',
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
   * Generate Vermont children section — uses "Legal Responsibility," "Physical Responsibility,"
   * and "Parent-Child Contact" per 15 V.S.A. § 665
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
        content: 'Plaintiff requests the Court to allocate Legal Responsibility (decision-making authority) and Physical Responsibility (where the child resides) in the best interests of the child(ren) pursuant to 15 V.S.A. § 665.',
        type: 'children_info'
      });

      items.push({
        number: paragraphNum++,
        content: 'Plaintiff requests the Court to establish a Parent-Child Contact schedule (time with the non-residential parent) in the best interests of the child(ren) pursuant to 15 V.S.A. § 665.',
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
   * Generate Vermont property section — equitable distribution per 15 V.S.A. § 751
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
      content: 'The parties have accumulated marital property and debts during the marriage. Plaintiff requests that the Court equitably divide the marital property and debts pursuant to 15 V.S.A. § 751.',
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: 'Each party is entitled to their separate property, being property acquired before the marriage or acquired during the marriage by gift or inheritance.',
      type: 'property_info'
    });

    return {
      title: 'VI. PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Vermont relief section — uses Vermont-specific terminology
   * "Final Divorce Order," "maintenance," "Legal Responsibility," "Physical Responsibility,"
   * "Parent-Child Contact," child support per 15 V.S.A. § 656
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
      'Enter a Final Divorce Order dissolving the marriage of the parties;',
      'Equitably divide the marital property and debts pursuant to 15 V.S.A. § 751;',
      'Confirm each party\'s separate property;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Allocate Legal Responsibility and Physical Responsibility for the minor child(ren) in their best interests pursuant to 15 V.S.A. § 665;');
      reliefItems.push('Establish a Parent-Child Contact schedule in the best interests of the child(ren) pursuant to 15 V.S.A. § 665;');
      reliefItems.push('Order child support in accordance with the Vermont Child Support Guidelines, 15 V.S.A. § 656;');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award maintenance to Plaintiff pursuant to 15 V.S.A. § 752;');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`Restore Plaintiff's former name to: ${divorceData.previousName};`);
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
   * Get Vermont verification text
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PLAINTIFF NAME]';
    return `I, ${name}, declare under penalty of perjury under the laws of the State of Vermont that the facts stated in this Complaint are true and correct to the best of my knowledge and belief.

Date: ___________________

_________________________________
${name}
Plaintiff`;
  }

  /**
   * Perform Vermont-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for Vermont Complaint for Divorce');
    }

    warnings.push('Vermont requires 6 months residency in the state before filing. (15 V.S.A. § 592)');
    warnings.push('Vermont has no mandatory statutory waiting period, though the process typically takes several months.');
    warnings.push('Vermont has both no-fault and fault-based grounds for divorce. No-fault: lived apart 6 months or irretrievable breakdown. Fault: adultery, imprisonment 3+ years, intolerable severity, willful desertion 7 years, persistent refusal to provide, incurable insanity. (15 V.S.A. § 551)');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('Vermont uses "Legal Responsibility" and "Physical Responsibility" instead of custody, and "Parent-Child Contact" instead of visitation. (15 V.S.A. § 665)');
      warnings.push('A Parenting Plan and Child Support Guideline Worksheet are required for all cases involving minor children.');
    }

    return { errors, warnings };
  }
}

module.exports = VermontDivorcePetitionTemplate;
