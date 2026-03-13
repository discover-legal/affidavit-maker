// templates/states/nevada/DivorcePetitionTemplate.js
// Nevada Complaint for Divorce template
// Complies with NRS 125 (Divorce)

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Nevada Complaint for Divorce Template
 *
 * Legal References:
 * - NRS 125 — Divorce
 * - NRS 125.020 — Residency requirement (6 weeks; Resident Witness Affidavit required)
 * - NRS 125.010 — Grounds for divorce (incompatibility, 1-year separation, insanity)
 * - NRS 125.150(1)(b) — Community property — equal 50/50 division
 * - NRS 125.150(1)(a) — Alimony
 * - NRS 125C.001, 125C.0035 — Custody (joint legal, joint physical; best interest standard)
 * - NRS 125B — Nevada Child Support Guidelines (percentage of income)
 *
 * Nevada-Specific Notes:
 * - Called "Divorce" — not dissolution of marriage
 * - Initiating document is a "Complaint for Divorce" (not Petition)
 * - Parties are "Plaintiff" and "Defendant"
 * - Only 6 weeks residency required (one of the shortest in the US)
 * - Resident Witness Affidavit required to prove 6-week residency
 * - NO mandatory waiting period after filing
 * - Community property state — equal 50/50 division (NRS 125.150(1)(b))
 * - "Joint Legal Custody" and "Joint Physical Custody" (NRS 125C)
 * - "Visitation" (NRS 125C)
 * - "Alimony" (NRS 125.150(1)(a))
 * - Filed in Family Court (Clark/Washoe) or District Court (rural counties)
 * - Case number label: "CASE NO."
 */
class NevadaDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'NV';
    this.stateName = 'Nevada';
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

    // Nevada — 6 weeks state residency, no county requirement
    this.residencyRequirements = {
      stateWeeks: 6,
      countyMonths: null,
      description: 'At least one party must have been a resident of the State of Nevada for at least six (6) weeks immediately preceding the filing of this Complaint. A Resident Witness Affidavit is required to establish residency. (NRS 125.020)'
    };

    // Nevada — NO waiting period
    this.waitingPeriod = {
      days: 0,
      startsFrom: null,
      exceptions: [],
      description: 'Nevada has no mandatory waiting period. The divorce may be finalized as soon as all papers are processed and any required hearing is held.'
    };
  }

  /**
   * Get Nevada case number label — "CASE NO."
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'CASE NO.';
  }

  /**
   * Get default court for Nevada county — Family Court or District Court
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    const upperCounty = countyName.toUpperCase();
    // Clark and Washoe counties have Family Court; other counties use District Court
    if (upperCounty === 'CLARK' || upperCounty === 'WASHOE') {
      return `Family Court, ${countyName} County, State of Nevada`;
    }
    return `District Court, ${countyName} County, State of Nevada`;
  }

  /**
   * Generate Nevada header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'IN THE FAMILY COURT OF THE STATE OF NEVADA';
  }

  /**
   * Generate Nevada venue — "IN AND FOR THE COUNTY OF [COUNTY]" (uppercase)
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    return `IN AND FOR THE COUNTY OF ${countyName.toUpperCase()}`;
  }

  /**
   * Get Nevada jurisdiction statement — 6-week residency with Resident Witness Affidavit
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    return `Plaintiff has been a bona fide resident of the State of Nevada for at least six (6) weeks immediately preceding the filing of this Complaint, and is a resident of ${divorceData.county || '[COUNTY]'} County, Nevada. A Resident Witness Affidavit establishing Plaintiff's residency will be filed concurrently or has been filed with this Complaint. (NRS 125.020)`;
  }

  /**
   * Get Nevada venue reason
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    return `Plaintiff or Defendant resides in ${divorceData.county || '[COUNTY]'} County, Nevada`;
  }

  /**
   * Generate Nevada grounds section — incompatibility (primary), 1-year separation, insanity
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
        content: 'The parties are incompatible. (NRS 125.010(2))',
        type: 'grounds'
      });
    } else if (grounds === 'separation_one_year') {
      items.push({
        number: paragraphNum++,
        content: 'The parties have lived separate and apart for one (1) year without cohabitation. (NRS 125.010(3))',
        type: 'grounds'
      });
    } else if (grounds === 'insanity') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has been insane for a period of two (2) years prior to the commencement of this action, as established by competent medical evidence. (NRS 125.010(1))',
        type: 'grounds'
      });
    } else {
      items.push({
        number: paragraphNum++,
        content: 'The parties are incompatible. (NRS 125.010(2))',
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
   * Generate Nevada children section — uses "joint legal custody" and "joint physical custody"
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
        content: 'Plaintiff requests the Court to determine joint legal custody and physical custody of the minor child(ren) in the best interests of the child(ren) pursuant to NRS 125C.0035, and to establish a visitation schedule.',
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
   * Generate Nevada property section — community property / equal 50/50 division
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property section
   */
  generatePropertySection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 12;

    items.push({
      number: paragraphNum++,
      content: 'The parties have accumulated community property and community debts during the marriage. Plaintiff requests the Court to make an equal disposition of all community property and community debts pursuant to NRS 125.150(1)(b).',
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: 'Plaintiff requests that each party be awarded their respective separate property. Separate property includes property acquired before the marriage, by gift, or by inheritance.',
      type: 'property_info'
    });

    return {
      title: 'VI. COMMUNITY PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Nevada relief section — uses Nevada-specific terminology
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
      'Grant Plaintiff a Decree of Divorce dissolving the marriage between the parties;',
      'Equally divide all community property and community debts pursuant to NRS 125.150(1)(b);'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Award joint legal custody and determine physical custody of the minor child(ren) in the best interests of the child(ren) pursuant to NRS 125C.0035;');
      reliefItems.push('Establish a visitation schedule pursuant to NRS 125C;');
      reliefItems.push('Order child support in accordance with the Nevada Child Support Guidelines, NRS 125B;');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award alimony to Plaintiff pursuant to NRS 125.150(1)(a);');
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
   * Get Nevada verification text
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PLAINTIFF NAME]';
    return `I, ${name}, declare under penalty of perjury under the laws of the State of Nevada that the facts stated in this Complaint are true and correct to the best of my knowledge and belief.

Date: ___________________

_________________________________
${name}
Plaintiff`;
  }

  /**
   * Perform Nevada-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for Nevada Complaint for Divorce');
    }

    warnings.push('Nevada requires only 6 weeks of state residency before filing. A Resident Witness Affidavit must be filed to prove residency. (NRS 125.020)');
    warnings.push('Nevada has NO mandatory waiting period. The divorce can be finalized as soon as papers are processed.');
    warnings.push('Nevada is a community property state. Community property is divided equally (50/50). (NRS 125.150(1)(b))');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('Custody must be determined in the best interests of the child(ren). Nevada has a presumption favoring joint custody. (NRS 125C.0035)');
      warnings.push('Child support must be calculated using the Nevada Child Support Guidelines (NRS 125B).');
    }

    return { errors, warnings };
  }
}

module.exports = NevadaDivorcePetitionTemplate;
