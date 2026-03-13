// templates/states/alabama/DivorcePetitionTemplate.js
// Alabama Complaint for Divorce template
// Complies with Ala. Code §30-2 (Divorce and Alimony)

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Alabama Complaint for Divorce Template
 *
 * Legal References:
 * - Ala. Code §30-2 — Divorce and Alimony
 * - Ala. Code §30-2-5 — Residency (both residents: no minimum; defendant non-resident: 6 months)
 * - Ala. Code §30-2-1 — Grounds for divorce (fault and no-fault)
 * - Ala. Code §30-2-8.1 — 30-day waiting period from filing
 * - Ala. Code §30-2-51 — Division of property and alimony (equitable distribution)
 * - Ala. Code §30-2-51 through §30-2-57 — Alimony (periodic, gross, rehabilitative)
 * - Ala. Code §30-3-150 et seq. — Joint custody, best interest standard
 * - Rule 32 ARJA — Child support guidelines (income shares model)
 *
 * Alabama-Specific Notes:
 * - Called "Complaint for Divorce" — Alabama uses "Complaint" not "Petition"
 * - Parties are "Plaintiff" and "Defendant"
 * - Both fault and no-fault grounds; incompatibility most common
 * - Residency: both in AL = no minimum; defendant non-resident = plaintiff 6 months
 * - 30-day waiting period from filing
 * - "Joint Custody" / "Sole Custody"
 * - "Visitation" (standard term)
 * - "Alimony" — periodic, gross (lump-sum), rehabilitative
 * - Equitable distribution (not equal)
 * - Filed in Circuit Court, Domestic Relations Division
 * - Case number label: "CASE NO."
 */
class AlabamaDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'AL';
    this.stateName = 'Alabama';
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

    // Alabama residency — varies based on whether both parties reside in state
    this.residencyRequirements = {
      bothResidents: 'No minimum residency when both spouses reside in Alabama.',
      oneNonResident: 'Plaintiff must be a bona fide resident of Alabama for at least 6 months.',
      stateMonths: 6,
      countyMonths: null,
      description: 'If both parties reside in Alabama, there is no minimum residency period. If the defendant is a non-resident, the plaintiff must be a bona fide resident of Alabama for at least 6 months before filing. (Ala. Code §30-2-5)'
    };

    // Alabama waiting period — 30 days from filing
    this.waitingPeriod = {
      days: 30,
      startsFrom: 'filing_date',
      exceptions: [],
      description: 'No final judgment of divorce may be entered until at least 30 days have elapsed from the date the complaint is filed. (Ala. Code §30-2-8.1)'
    };
  }

  /**
   * Get Alabama case number label — "CASE NO."
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'CASE NO.';
  }

  /**
   * Get default court for Alabama county — Circuit Court
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `Circuit Court of ${countyName} County, Alabama`;
  }

  /**
   * Generate Alabama header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF ALABAMA';
  }

  /**
   * Generate Alabama venue — uppercase per Alabama practice
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    return `IN THE CIRCUIT COURT OF ${countyName.toUpperCase()} COUNTY, ALABAMA`;
  }

  /**
   * Get Alabama jurisdiction statement — residency per Ala. Code §30-2-5
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    const county = divorceData.county || '[COUNTY]';
    if (divorceData.bothResidents) {
      return `Both Plaintiff and Defendant are bona fide residents of the State of Alabama. This Court has jurisdiction pursuant to Ala. Code §30-2-5. Plaintiff resides in ${county} County, Alabama.`;
    }
    return `Plaintiff has been a bona fide resident of the State of Alabama for at least six (6) months immediately preceding the filing of this Complaint and resides in ${county} County, Alabama. (Ala. Code §30-2-5)`;
  }

  /**
   * Get Alabama venue reason
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    return `Plaintiff resides in ${divorceData.county || '[COUNTY]'} County, Alabama`;
  }

  /**
   * Generate Alabama grounds section — fault and no-fault grounds
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
        content: 'There exists a complete incompatibility of temperament between the parties such that they can no longer live together as husband and wife. (Ala. Code §30-2-1(a)(7))',
        type: 'grounds'
      });
    } else if (grounds === 'irretrievable_breakdown') {
      items.push({
        number: paragraphNum++,
        content: 'The marriage of the parties is irretrievably broken and further attempts at reconciliation are impractical or futile. (Ala. Code §30-2-1(a)(9))',
        type: 'grounds'
      });
    } else if (grounds === 'voluntary_separation') {
      items.push({
        number: paragraphNum++,
        content: 'The Plaintiff has been voluntarily abandoned by the Defendant from bed and board for one (1) year next preceding the filing of this Complaint, with complete separation maintained throughout. (Ala. Code §30-2-1(a)(3))',
        type: 'grounds'
      });
    } else if (grounds === 'adultery') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has committed adultery. (Ala. Code §30-2-1(a)(2))',
        type: 'grounds'
      });
    } else if (grounds === 'abandonment') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has voluntarily abandoned the Plaintiff from bed and board for a period of one (1) year next preceding the filing of this Complaint. (Ala. Code §30-2-1(a)(3))',
        type: 'grounds'
      });
    } else if (grounds === 'imprisonment') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has been imprisoned in the penitentiary for two (2) years, having been sentenced for a term of seven (7) years or more. (Ala. Code §30-2-1(a)(4))',
        type: 'grounds'
      });
    } else if (grounds === 'habitual_drunkenness') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has become addicted after marriage to habitual drunkenness or habitual use of drugs. (Ala. Code §30-2-1(a)(6))',
        type: 'grounds'
      });
    } else if (grounds === 'crime_against_nature' || grounds === 'cruelty') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has committed the crime against nature, whether with mankind or beast. (Ala. Code §30-2-1(a)(5))',
        type: 'grounds'
      });
    } else if (grounds === 'insanity') {
      items.push({
        number: paragraphNum++,
        content: 'Defendant has been confined in a mental hospital for a period of five (5) successive years and is hopelessly and incurably insane at the time of the filing of this Complaint. (Ala. Code §30-2-1(a)(8))',
        type: 'grounds'
      });
    } else {
      // Default to incompatibility
      items.push({
        number: paragraphNum++,
        content: 'There exists a complete incompatibility of temperament between the parties such that they can no longer live together as husband and wife. (Ala. Code §30-2-1(a)(7))',
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
   * Generate Alabama children section — uses "joint custody" / "sole custody" and "visitation"
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
        content: 'Plaintiff requests the Court to determine custody of the minor child(ren) in the best interests of the child(ren) pursuant to Ala. Code §30-3-150 et seq., and to establish a reasonable visitation schedule for the non-custodial parent.',
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
   * Generate Alabama property section — equitable distribution
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property section
   */
  generatePropertySection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 12;

    items.push({
      number: paragraphNum++,
      content: 'The parties have accumulated marital property and debts during the marriage. Plaintiff requests that the Court equitably divide the marital property and debts pursuant to Ala. Code §30-2-51.',
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: 'Plaintiff requests the Court to consider the relevant factors in determining an equitable division, including the length of the marriage, each spouse\'s contribution to the acquisition of property, the value of each spouse\'s separate estate, the age and health of the parties, and the future prospects of each party.',
      type: 'property_info'
    });

    return {
      title: 'VI. PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Alabama relief section — uses Alabama-specific terminology
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
      'Grant Plaintiff a divorce from Defendant;',
      'Equitably divide the marital property and debts of the parties pursuant to Ala. Code §30-2-51;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Award custody of the minor child(ren) in the best interests of the child(ren) pursuant to Ala. Code §30-3-150 et seq.;');
      reliefItems.push('Establish a reasonable visitation schedule for the non-custodial parent;');
      reliefItems.push('Order child support in accordance with Rule 32 of the Alabama Rules of Judicial Administration;');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award alimony to Plaintiff pursuant to Ala. Code §30-2-51 through §30-2-57;');
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
   * Get Alabama verification text
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PLAINTIFF NAME]';
    return `I, ${name}, declare under penalty of perjury under the laws of the State of Alabama that the facts stated in this Complaint are true and correct to the best of my knowledge and belief.

Date: ___________________

_________________________________
${name}
Plaintiff`;
  }

  /**
   * Perform Alabama-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for Alabama Complaint for Divorce');
    }

    warnings.push('Alabama residency: if both parties reside in Alabama, there is no minimum residency requirement. If the defendant is a non-resident, the plaintiff must have been a bona fide resident for at least 6 months. (Ala. Code §30-2-5)');
    warnings.push('No final judgment may be entered until 30 days have elapsed from the date of filing. (Ala. Code §30-2-8.1)');
    warnings.push('Alabama follows equitable distribution of marital property. (Ala. Code §30-2-51)');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('A custody determination must be made in the best interests of the child(ren). (Ala. Code §30-3-150 et seq.)');
      warnings.push('Child support must be calculated using Rule 32 of the Alabama Rules of Judicial Administration (income shares model).');
    }

    return { errors, warnings };
  }
}

module.exports = AlabamaDivorcePetitionTemplate;
