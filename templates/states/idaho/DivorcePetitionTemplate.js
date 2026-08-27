// templates/states/idaho/DivorcePetitionTemplate.js
// Idaho Complaint for Divorce template
// Complies with Idaho Code §32-601 et seq. (Divorce)

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Idaho Complaint for Divorce Template
 *
 * Legal References:
 * - Idaho Code §32-601 et seq. — Divorce
 * - Idaho Code §32-701 — Residency requirement (6 full weeks)
 * - Idaho Code §32-603 — Grounds for divorce
 * - Idaho Code §32-716 — 21-day waiting period after service
 * - Idaho Code §32-712 — Division of community property (substantially equal)
 * - Idaho Code §32-705 — Spousal maintenance
 * - Idaho Code §32-717B — Joint custody
 * - Idaho Code §32-717 — Custody of children (best interest standard)
 * - Idaho Code §32-706 — Idaho Child Support Guidelines (income shares)
 *
 * Idaho-Specific Notes:
 * - Called "Divorce" — Idaho uses "Complaint for Divorce" (not Petition)
 * - Parties are "Plaintiff" and "Defendant"
 * - Both fault and no-fault grounds (irreconcilable differences used in ~99% of cases)
 * - 6-week residency requirement (one of the shortest in the US)
 * - 21-day waiting period after service
 * - "Legal Custody" and "Physical Custody"; "Joint Custody" and "Sole Custody"
 * - "Visitation" or "Reasonable Visitation"
 * - "Spousal Maintenance" (not alimony)
 * - Community property — substantially equal division
 * - Filed in District Court
 * - Case number label: "CASE NO."
 */
class IdahoDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'ID';
    this.stateName = 'Idaho';
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
      'county',
      'marriageDate',
      'groundsForDivorce'
    ];

    // Idaho — 6 full weeks residency
    this.residencyRequirements = {
      stateWeeks: 6,
      countyMonths: 0,
      description: 'The plaintiff must have been a resident of Idaho for a full six (6) weeks immediately preceding the filing of the complaint. (Idaho Code §32-701)'
    };

    // Idaho waiting period — 21 days after service
    this.waitingPeriod = {
      days: 21,
      startsFrom: 'service_date',
      exceptions: [],
      description: 'A divorce cannot be granted until at least twenty-one (21) days after service of the summons and complaint on the defendant. (Idaho Code §32-716)'
    };
  }

  /**
   * Get Idaho case number label — "CASE NO."
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'CASE NO.';
  }

  /**
   * Get default court for Idaho county — District Court
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `District Court of the State of Idaho, in and for the County of ${countyName}`;
  }

  /**
   * Generate Idaho header — full District Court header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'IN THE DISTRICT COURT OF THE _____ JUDICIAL DISTRICT OF THE STATE OF IDAHO';
  }

  /**
   * Generate Idaho venue — "IN AND FOR THE COUNTY OF [COUNTY]"
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    return `IN AND FOR THE COUNTY OF ${countyName.toUpperCase()}`;
  }

  /**
   * Get Idaho jurisdiction statement — 6-week residency
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    return `Plaintiff has been a bona fide resident of the State of Idaho for a full six (6) weeks immediately preceding the filing of this Complaint, and resides in ${divorceData.county || '[COUNTY]'} County, Idaho. (Idaho Code §32-701)`;
  }

  /**
   * Get Idaho venue reason
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    return `Defendant resides in ${divorceData.county || '[COUNTY]'} County, Idaho, or if Defendant is not a resident of Idaho, Plaintiff resides in ${divorceData.county || '[COUNTY]'} County`;
  }

  /**
   * Generate Idaho grounds section — irreconcilable differences (primary) plus fault grounds
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
        content: 'Irreconcilable differences, which are substantial reasons for not continuing the marriage, have caused the irremediable breakdown of the marriage. (Idaho Code §§32-603(8), 32-616)',
        type: 'grounds'
      });
    } else if (grounds === 'adultery') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has committed adultery. (Idaho Code §32-603(1))',
        type: 'grounds'
      });
    } else if (grounds === 'extreme_cruelty') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has inflicted extreme cruelty upon Plaintiff. (Idaho Code §32-603(2))',
        type: 'grounds'
      });
    } else if (grounds === 'willful_desertion') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has willfully deserted Plaintiff. (Idaho Code §32-603(3))',
        type: 'grounds'
      });
    } else if (grounds === 'willful_neglect') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has willfully neglected to provide Plaintiff with the common necessaries of life. (Idaho Code §32-603(4))',
        type: 'grounds'
      });
    } else if (grounds === 'habitual_intemperance') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant is habitually intemperate. (Idaho Code §32-603(5))',
        type: 'grounds'
      });
    } else if (grounds === 'felony_conviction') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has been convicted of a felony. (Idaho Code §32-603(6))',
        type: 'grounds'
      });
    } else if (grounds === 'permanent_insanity') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant is permanently insane, as established by competent medical testimony. (Idaho Code §32-603(7))',
        type: 'grounds'
      });
    } else if (grounds === 'living_separate_5_years') {
      items.push({
        number: paragraphNum++,
        content: 'The parties have been living separate and apart without cohabitation for a period of five (5) years or more. (Idaho Code §32-610)',
        type: 'grounds'
      });
    } else {
      items.push({
        number: paragraphNum++,
        content: 'Irreconcilable differences, which are substantial reasons for not continuing the marriage, have caused the irremediable breakdown of the marriage. (Idaho Code §§32-603(8), 32-616)',
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
   * Generate Idaho children section — uses "legal custody" and "physical custody"
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
        content: 'Plaintiff requests the Court to determine legal custody and physical custody of the minor child(ren) in the best interests of the child(ren) pursuant to Idaho Code §32-717, and to establish a visitation schedule for the noncustodial parent.',
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
   * Generate Idaho property section — community property / substantially equal division
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
      content: 'The parties have accumulated community property and community debts during the marriage. Plaintiff requests that the Court divide the community property and community debts substantially equally pursuant to Idaho Code §32-712.',
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: 'Plaintiff requests that the separate property of each party be confirmed to that party. Separate property includes property acquired before the marriage, by gift, or by inheritance, and any property traceable thereto.',
      type: 'property_info'
    });

    return {
      title: 'VI. COMMUNITY PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Idaho relief section — uses Idaho-specific terminology
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Relief section
   */
  generateReliefSection(divorceData) {
    const items = [];

    items.push({
      number: null,
      content: 'WHEREFORE, Plaintiff prays for judgment against Defendant as follows:',
      type: 'relief_intro'
    });

    const reliefItems = [
      'Grant Plaintiff a Judgment and Decree of Divorce, dissolving the marriage between the parties;',
      'Divide the community property and community debts of the parties substantially equally pursuant to Idaho Code §32-712;',
      'Confirm the separate property of each party to that party;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Award custody of the minor child(ren) to the appropriate party in the best interests of the child(ren) pursuant to Idaho Code §32-717;');
      reliefItems.push('Establish a reasonable visitation schedule for the noncustodial parent;');
      reliefItems.push('Order child support in accordance with the Idaho Child Support Guidelines, Idaho Code §32-706;');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award spousal maintenance to Plaintiff pursuant to Idaho Code §32-705;');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`Restore Plaintiff's former name to: ${divorceData.previousName};`);
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
   * Get Idaho verification text
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PLAINTIFF NAME]';
    return `I, ${name}, declare under penalty of perjury under the laws of the State of Idaho that the facts stated in this Complaint are true and correct to the best of my knowledge and belief.

Date: ___________________

_________________________________
${name}
Plaintiff`;
  }

  /**
   * Perform Idaho-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for Idaho divorce complaints');
    }

    warnings.push('Idaho requires 6 full weeks of state residency before filing. (Idaho Code §32-701)');
    warnings.push('A divorce cannot be granted until 21 days after service of the summons and complaint. (Idaho Code §32-716)');
    warnings.push('Idaho is a community property state — community property is divided substantially equally. (Idaho Code §32-712)');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('Custody must be determined in the best interests of the child(ren). (Idaho Code §32-717)');
      warnings.push('Child support must be calculated using the Idaho Child Support Guidelines (Idaho Code §32-706).');
    }

    return { errors, warnings };
  }
}

module.exports = IdahoDivorcePetitionTemplate;
