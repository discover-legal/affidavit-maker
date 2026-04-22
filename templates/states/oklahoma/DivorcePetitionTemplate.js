// templates/states/oklahoma/DivorcePetitionTemplate.js
// Oklahoma Petition for Divorce template
// Complies with 43 O.S. §101–§121 (Divorce)

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Oklahoma Petition for Divorce Template
 *
 * Legal References:
 * - 43 O.S. §101 — Grounds for divorce (fault and no-fault)
 * - 43 O.S. §102 — Residency requirement (6 months state, 30 days county)
 * - 43 O.S. §107.1 — Waiting period (90 days with children, 10 days without)
 * - 43 O.S. §109 — Joint custody
 * - 43 O.S. §112 — Best interests of the child
 * - 43 O.S. §118D, §119 — Oklahoma Child Support Guidelines (income shares)
 * - 43 O.S. §121 — Property division (equitable distribution) and alimony
 *
 * Oklahoma-Specific Notes:
 * - Called "Divorce" — also "Dissolution of Marriage" is accepted
 * - Both fault and no-fault grounds; "incompatibility" is most common
 * - 6-month state / 30-day county residency requirement
 * - 90-day waiting period with minor children; 10-day without
 * - "Joint Custody" / "Sole Custody" (standard terminology)
 * - "Visitation" (standard Oklahoma term)
 * - "Alimony" (support and maintenance)
 * - Equitable distribution of jointly-acquired property
 * - Filed in District Court
 * - Case number label: "CASE NO."
 * - Parties: "Petitioner" and "Respondent"
 */
class OklahomaDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'OK';
    this.stateName = 'Oklahoma';
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

    // Oklahoma — 6 months state, 30 days county
    this.residencyRequirements = {
      stateMonths: 6,
      countyDays: 30,
      description: 'The petitioner must have been a resident and actual inhabitant of the State of Oklahoma for at least six (6) months and a resident of the county of filing for at least thirty (30) days immediately preceding the filing. (43 O.S. §102)'
    };

    // Oklahoma waiting period — 90 days with children, 10 days without
    this.waitingPeriod = {
      daysWithChildren: 90,
      daysWithoutChildren: 10,
      startsFrom: 'filing_date',
      exceptions: [],
      description: 'The final decree cannot be entered until at least ninety (90) days have elapsed after filing if the parties have minor children, or ten (10) days if there are no minor children. (43 O.S. §107.1)'
    };
  }

  /**
   * Get Oklahoma case number label — "CASE NO."
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'CASE NO.';
  }

  /**
   * Get default court for Oklahoma county — District Court
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `District Court of ${countyName} County, State of Oklahoma`;
  }

  /**
   * Generate Oklahoma header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'IN THE DISTRICT COURT OF [COUNTY] COUNTY';
  }

  /**
   * Generate Oklahoma subheader
   * @returns {string} Subheader text
   */
  generateSubheader() {
    return 'STATE OF OKLAHOMA';
  }

  /**
   * Generate Oklahoma venue — title case per Oklahoma practice
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Get Oklahoma jurisdiction statement — 6-month state, 30-day county
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    return `Petitioner has been a bona fide resident and actual inhabitant of the State of Oklahoma for at least six (6) months and a resident of ${divorceData.county || '[COUNTY]'} County for at least thirty (30) days immediately preceding the filing of this Petition. (43 O.S. §102)`;
  }

  /**
   * Get Oklahoma venue reason
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    return `Petitioner resides in ${divorceData.county || '[COUNTY]'} County, Oklahoma`;
  }

  /**
   * Generate Oklahoma grounds section — incompatibility (primary) plus fault grounds
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Grounds section
   */
  generateGroundsSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 8;

    const grounds = divorceData.groundsForDivorce || 'incompatibility';

    if (grounds === 'incompatibility' || grounds === 'no_fault') {
      items.push({
        number: paragraphNum++,
        content: 'The parties are incompatible. (43 O.S. §101)',
        type: 'grounds'
      });
    } else if (grounds === 'abandonment') {
      items.push({
        number: paragraphNum++,
        content: 'Respondent abandoned Petitioner for a period of one (1) year or more. (43 O.S. §101)',
        type: 'grounds'
      });
    } else if (grounds === 'adultery') {
      items.push({
        number: paragraphNum++,
        content: 'Respondent committed adultery. (43 O.S. §101)',
        type: 'grounds'
      });
    } else if (grounds === 'impotency') {
      items.push({
        number: paragraphNum++,
        content: 'Respondent is impotent. (43 O.S. §101)',
        type: 'grounds'
      });
    } else if (grounds === 'wife_pregnant_at_marriage') {
      items.push({
        number: paragraphNum++,
        content: 'The wife at the time of marriage was pregnant by another person. (43 O.S. §101)',
        type: 'grounds'
      });
    } else if (grounds === 'extreme_cruelty') {
      items.push({
        number: paragraphNum++,
        content: 'Respondent has been guilty of extreme cruelty toward Petitioner. (43 O.S. §101)',
        type: 'grounds'
      });
    } else if (grounds === 'fraudulent_contract') {
      items.push({
        number: paragraphNum++,
        content: 'The marriage was procured by fraud. (43 O.S. §101)',
        type: 'grounds'
      });
    } else if (grounds === 'habitual_drunkenness') {
      items.push({
        number: paragraphNum++,
        content: 'Respondent is habitually drunk. (43 O.S. §101)',
        type: 'grounds'
      });
    } else if (grounds === 'gross_neglect_of_duty') {
      items.push({
        number: paragraphNum++,
        content: 'Respondent has been guilty of gross neglect of duty. (43 O.S. §101)',
        type: 'grounds'
      });
    } else if (grounds === 'imprisonment') {
      items.push({
        number: paragraphNum++,
        content: 'Respondent has been imprisoned in a state or federal penal institution under sentence at the time this petition was filed. (43 O.S. §101)',
        type: 'grounds'
      });
    } else if (grounds === 'insanity') {
      items.push({
        number: paragraphNum++,
        content: 'Respondent has been insane for a period of five (5) years, having been an inmate of a state institution for the insane for such period. (43 O.S. §101)',
        type: 'grounds'
      });
    } else if (grounds === 'living_apart') {
      items.push({
        number: paragraphNum++,
        content: 'The parties have lived separate and apart without cohabitation for a continuous period of two (2) or more years by reason of incompatibility. (43 O.S. §101)',
        type: 'grounds'
      });
    } else {
      items.push({
        number: paragraphNum++,
        content: 'The parties are incompatible. (43 O.S. §101)',
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
   * Generate Oklahoma children section — uses "joint custody" / "sole custody"
   * and "visitation"
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
            : `${child.name || '[CHILD NAME]'}, born ${this.formatDate(child.birthDate) || '[BIRTH DATE]'}`;
          items.push({
            number: paragraphNum++,
            content: `Child ${index + 1}: ${childInfo}`,
            type: 'child_detail'
          });
        });
      }

      items.push({
        number: paragraphNum++,
        content: 'Petitioner requests the Court to determine custody of the minor child(ren), whether joint or sole, in the best interests of the child(ren) pursuant to 43 O.S. §109 and §112, and to establish a visitation schedule for the non-custodial parent.',
        type: 'children_info'
      });

      items.push({
        number: paragraphNum++,
        content: 'Because there are minor children of this marriage, the mandatory waiting period is ninety (90) days from the date of filing. (43 O.S. §107.1)',
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
   * Generate Oklahoma property section — equitable distribution of jointly-acquired property
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property section
   */
  generatePropertySection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 12;

    items.push({
      number: paragraphNum++,
      content: 'The parties have accumulated jointly-acquired property and debts during the marriage. Petitioner requests that the Court equitably divide the jointly-acquired property and debts of the parties in a just and reasonable manner pursuant to 43 O.S. §121.',
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: 'Petitioner requests the Court to consider the contribution of each party to the acquisition of the jointly-acquired property, the duration of the marriage, the economic circumstances of each party, and all other relevant factors in determining an equitable division.',
      type: 'property_info'
    });

    return {
      title: 'VI. PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Oklahoma relief section — uses Oklahoma-specific terminology
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Relief section
   */
  generateReliefSection(divorceData) {
    const items = [];

    items.push({
      number: null,
      content: 'WHEREFORE, Petitioner respectfully requests that the Court:',
      type: 'relief_intro'
    });

    const reliefItems = [
      'Grant Petitioner a divorce from Respondent;',
      'Equitably divide the jointly-acquired property and debts of the parties pursuant to 43 O.S. §121;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Award custody of the minor child(ren), whether joint or sole, in the best interests of the child(ren) pursuant to 43 O.S. §109 and §112;');
      reliefItems.push('Establish a visitation schedule for the non-custodial parent;');
      reliefItems.push('Order child support in accordance with the Oklahoma Child Support Guidelines, 43 O.S. §118D and §119;');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award alimony (support and maintenance) to Petitioner pursuant to 43 O.S. §121;');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`Restore Petitioner's former name to: ${divorceData.previousName};`);
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
   * Get Oklahoma verification text
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PETITIONER NAME]';
    return `I, ${name}, being first duly sworn upon oath, state that I am the Petitioner in the above-entitled action, and that the facts stated in this Petition are true and correct to the best of my knowledge and belief.

Date: ___________________

_________________________________
${name}
Petitioner

Subscribed and sworn to before me this _____ day of _______________, 20___.

_________________________________
Notary Public, State of Oklahoma
My commission number: ____________
My commission expires: ___________`;
  }

  /**
   * Perform Oklahoma-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for Oklahoma divorce petitions');
    }

    warnings.push('Oklahoma requires 6 months state residency and 30 days county residency before filing. (43 O.S. §102)');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('The final decree cannot be entered until 90 days have elapsed after filing because there are minor children. (43 O.S. §107.1)');
      warnings.push('Custody must be determined in the best interests of the child(ren). (43 O.S. §109, §112)');
      warnings.push('Child support must be calculated using the Oklahoma Child Support Guidelines (43 O.S. §118D, §119).');
    } else {
      warnings.push('The final decree cannot be entered until 10 days have elapsed after filing. (43 O.S. §107.1)');
    }

    warnings.push('Oklahoma uses equitable distribution of jointly-acquired property. (43 O.S. §121)');

    return { errors, warnings };
  }
}

module.exports = OklahomaDivorcePetitionTemplate;
