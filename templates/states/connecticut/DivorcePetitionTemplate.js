// templates/states/connecticut/DivorcePetitionTemplate.js
// Connecticut Complaint for Dissolution of Marriage template
// Complies with Conn. Gen. Stat. §46b-40 et seq. (Dissolution of Marriage)

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Connecticut Complaint for Dissolution of Marriage Template
 *
 * Legal References:
 * - Conn. Gen. Stat. §46b-40 — Grounds for dissolution of marriage
 * - Conn. Gen. Stat. §46b-44 — Residency requirement (12 months)
 * - Conn. Gen. Stat. §46b-67 — 90-day waiting period from return date
 * - Conn. Gen. Stat. §46b-81 — Assignment of property (ALL property subject to division)
 * - Conn. Gen. Stat. §46b-82 — Alimony
 * - Conn. Gen. Stat. §46b-56 — Custody and visitation (legal custody, physical custody, access)
 * - Conn. Gen. Stat. §46b-84 — Child support obligations
 * - Conn. Gen. Stat. §46b-215a-1 et seq. — CT Child Support and Arrearage Guidelines
 *
 * Connecticut-Specific Notes:
 * - Called "Dissolution of Marriage" — the filing document is a "Complaint"
 * - Uses "Plaintiff" and "Defendant" (not Petitioner/Respondent)
 * - 12-month state residency requirement (no county requirement)
 * - 90-day waiting period from return date of service
 * - No-fault: irretrievable breakdown OR living apart 18+ months
 * - Fault: adultery, fraudulent contract, willful desertion (1 yr), 7 yrs absence,
 *   habitual intemperance, intolerable cruelty, life imprisonment, infamous crime
 * - ALL property (marital AND separate) is subject to equitable division — unique
 * - "Legal Custody" and "Physical Custody" (§46b-56)
 * - "Visitation" or "Access" (§46b-56)
 * - "Alimony" (§46b-82) — not "maintenance" or "spousal support"
 * - Filed in Superior Court, Family Division
 * - Case number label: "DOCKET NO." (family actions use "FA-" prefix)
 * - Court venue is by judicial district, not just county
 */
class ConnecticutDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'CT';
    this.stateName = 'Connecticut';
    this.documentTitle = 'COMPLAINT FOR DISSOLUTION OF MARRIAGE';

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

    // Connecticut — 12 months state residency, no county requirement
    this.residencyRequirements = {
      stateMonths: 12,
      countyMonths: null,
      description: 'One spouse must have been a resident of Connecticut for at least 12 months before the dissolution is granted, or the parties were married in Connecticut and one spouse returned with intent to permanently reside. (Conn. Gen. Stat. §46b-44)'
    };

    // Connecticut waiting period — 90 days from return date of service
    this.waitingPeriod = {
      days: 90,
      startsFrom: 'return_date',
      exceptions: [],
      description: 'The court cannot enter a judgment of dissolution until at least 90 days have elapsed after the return date. (Conn. Gen. Stat. §46b-67)'
    };
  }

  /**
   * Get Connecticut case number label — "DOCKET NO."
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'DOCKET NO.';
  }

  /**
   * Get default court for Connecticut judicial district — Superior Court, Family Division
   * @param {string} county - Judicial district name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const districtName = county || '[JUDICIAL DISTRICT]';
    return `Superior Court, Family Division, Judicial District of ${districtName}, State of Connecticut`;
  }

  /**
   * Generate Connecticut header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF CONNECTICUT, SUPERIOR COURT';
  }

  /**
   * Generate Connecticut venue — judicial district (not county)
   * @param {string} county - Judicial district name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const districtName = county || '[JUDICIAL DISTRICT]';
    const districtFormatted = districtName.charAt(0).toUpperCase() + districtName.slice(1).toLowerCase();
    return `Judicial District of ${districtFormatted}`;
  }

  /**
   * Get Connecticut jurisdiction statement — 12-month residency
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    return `Plaintiff has been a resident of the State of Connecticut for at least twelve (12) months immediately preceding the date of the filing of this Complaint, or the parties were married in Connecticut and the Plaintiff has returned with the intent to permanently reside. This Court has jurisdiction over this matter pursuant to Conn. Gen. Stat. §46b-44.`;
  }

  /**
   * Get Connecticut venue reason
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    return `Plaintiff or Defendant resides in the Judicial District of ${divorceData.county || '[JUDICIAL DISTRICT]'}, Connecticut`;
  }

  /**
   * Generate Connecticut grounds section — no-fault and fault grounds
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Grounds section
   */
  generateGroundsSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 8;

    const grounds = divorceData.groundsForDivorce || 'irretrievable_breakdown';

    if (grounds === 'irretrievable_breakdown' || grounds === 'no_fault') {
      items.push({
        number: paragraphNum++,
        content: 'The marriage of the parties has broken down irretrievably. (Conn. Gen. Stat. §46b-40(c)(1))',
        type: 'grounds'
      });
    } else if (grounds === 'living_apart_18_months') {
      items.push({
        number: paragraphNum++,
        content: 'The parties have lived apart for a continuous period of at least eighteen (18) months and there is no reasonable prospect of reconciliation. (Conn. Gen. Stat. §46b-40(c)(2))',
        type: 'grounds'
      });
    } else if (grounds === 'adultery') {
      items.push({
        number: paragraphNum++,
        content: 'The Defendant has committed adultery. (Conn. Gen. Stat. §46b-40(c)(3))',
        type: 'grounds'
      });
    } else if (grounds === 'fraudulent_contract') {
      items.push({
        number: paragraphNum++,
        content: 'The marriage was entered into by reason of a fraudulent contract. (Conn. Gen. Stat. §46b-40(c)(4))',
        type: 'grounds'
      });
    } else if (grounds === 'willful_desertion') {
      items.push({
        number: paragraphNum++,
        content: 'The Defendant has willfully deserted the Plaintiff for one year with total neglect of duty. (Conn. Gen. Stat. §46b-40(c)(5))',
        type: 'grounds'
      });
    } else if (grounds === 'seven_years_absence') {
      items.push({
        number: paragraphNum++,
        content: 'The Defendant has been absent for seven years and has not been heard from during that time. (Conn. Gen. Stat. §46b-40(c)(6))',
        type: 'grounds'
      });
    } else if (grounds === 'habitual_intemperance') {
      items.push({
        number: paragraphNum++,
        content: 'The Defendant is habitually intemperate. (Conn. Gen. Stat. §46b-40(c)(7))',
        type: 'grounds'
      });
    } else if (grounds === 'intolerable_cruelty') {
      items.push({
        number: paragraphNum++,
        content: 'The Defendant has engaged in intolerable cruelty. (Conn. Gen. Stat. §46b-40(c)(8))',
        type: 'grounds'
      });
    } else if (grounds === 'life_imprisonment') {
      items.push({
        number: paragraphNum++,
        content: 'The Defendant has been sentenced to imprisonment for life. (Conn. Gen. Stat. §46b-40(c)(9))',
        type: 'grounds'
      });
    } else if (grounds === 'infamous_crime') {
      items.push({
        number: paragraphNum++,
        content: 'The Defendant has committed an infamous crime involving a violation of conjugal duty punishable by imprisonment for more than one year. (Conn. Gen. Stat. §46b-40(c)(10))',
        type: 'grounds'
      });
    } else {
      // Default to irretrievable breakdown
      items.push({
        number: paragraphNum++,
        content: 'The marriage of the parties has broken down irretrievably. (Conn. Gen. Stat. §46b-40(c)(1))',
        type: 'grounds'
      });
    }

    return {
      title: 'IV. GROUNDS FOR DISSOLUTION',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Connecticut children section — uses "legal custody" and "physical custody"
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
        content: 'Plaintiff requests the Court to enter orders regarding legal custody and physical custody of the minor child(ren) in the best interests of the child(ren) pursuant to Conn. Gen. Stat. §46b-56, and to establish a visitation or access schedule for the non-custodial parent.',
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
   * Generate Connecticut property section — ALL property subject to division (unique CT rule)
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property section
   */
  generatePropertySection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 12;

    items.push({
      number: paragraphNum++,
      content: 'The parties have accumulated property and debts. Plaintiff requests that the Court equitably divide all property of both parties pursuant to Conn. Gen. Stat. §46b-81. Under Connecticut law, the Court has authority to assign to either spouse all or any part of the estate of the other spouse, including property acquired before the marriage, inherited property, and gifts.',
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: 'Plaintiff requests the Court to consider the statutory factors in making the property division, including the length of the marriage, the causes for the dissolution, the age, health, station, occupation, amount and sources of income, vocational skills, employability, estate, liabilities, and needs of each of the parties.',
      type: 'property_info'
    });

    return {
      title: 'VI. PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Connecticut relief section — uses Connecticut-specific terminology
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Relief section
   */
  generateReliefSection(divorceData) {
    const items = [];

    items.push({
      number: null,
      content: 'WHEREFORE, the Plaintiff requests that the Court:',
      type: 'relief_intro'
    });

    const reliefItems = [
      'Enter a Judgment of Dissolution of Marriage;',
      'Equitably divide all property of the parties pursuant to Conn. Gen. Stat. §46b-81;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Enter orders regarding legal custody and physical custody of the minor child(ren) in the best interests of the child(ren) pursuant to Conn. Gen. Stat. §46b-56;');
      reliefItems.push('Establish a visitation or access schedule for the non-custodial parent;');
      reliefItems.push('Order child support in accordance with the Connecticut Child Support and Arrearage Guidelines, Conn. Gen. Stat. §46b-84 and §46b-215a-1 et seq.;');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award alimony to the Plaintiff pursuant to Conn. Gen. Stat. §46b-82;');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`Restore the Plaintiff's former name to: ${divorceData.previousName};`);
    }

    reliefItems.push('Grant such other and further relief as the Court deems fair and equitable.');

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
   * Get Connecticut verification text
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PLAINTIFF NAME]';
    return `I, ${name}, the Plaintiff in this action, declare under penalty of perjury under the laws of the State of Connecticut that the facts stated in this Complaint are true and correct to the best of my knowledge and belief.

Date: ___________________

_________________________________
${name}
Plaintiff`;
  }

  /**
   * Perform Connecticut-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('Judicial district is required for Connecticut dissolution complaints');
    }

    warnings.push('Connecticut requires 12 months state residency before the dissolution can be granted. (Conn. Gen. Stat. §46b-44)');
    warnings.push('The court cannot enter a judgment until 90 days have elapsed after the return date. (Conn. Gen. Stat. §46b-67)');
    warnings.push('Connecticut courts may divide ALL property of either spouse, including separate property. (Conn. Gen. Stat. §46b-81)');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('A parenting plan must be submitted to the court addressing custody and visitation.');
      warnings.push('Child support must be calculated using the Connecticut Child Support and Arrearage Guidelines (Conn. Gen. Stat. §46b-215a-1 et seq.).');
    }

    return { errors, warnings };
  }
}

module.exports = ConnecticutDivorcePetitionTemplate;
