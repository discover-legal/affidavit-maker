// templates/states/georgia/DivorcePetitionTemplate.js
// Georgia Complaint for Divorce (Petition) template
// Complies with O.C.G.A. § 19-5-1 et seq. (Divorce) and Georgia Superior Court rules

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Georgia Complaint for Divorce Template
 *
 * Legal References:
 * - O.C.G.A. § 19-5-1 et seq. — Divorce proceedings
 * - O.C.G.A. § 19-5-3 — Grounds for divorce (13 grounds total: grounds 1-5 are voidability grounds; 6-12 are fault grounds; 13 is irretrievably broken no-fault)
 * - O.C.G.A. § 19-5-2 — Residency requirements (6 months)
 * - O.C.G.A. § 19-5-8 — 30-day waiting period after service
 * - O.C.G.A. § 19-6-1 — Alimony
 * - O.C.G.A. § 19-7-1 — Child custody — best interests standard
 * - O.C.G.A. § 19-6-15 — Child support guidelines
 *
 * Georgia-Specific Notes:
 * - Filed in Superior Court of the county where respondent resides
 * - 6-month state residency required (no county residency requirement)
 * - 30-day waiting period after service before final judgment
 * - 13 fault grounds plus no-fault (irretrievably broken)
 * - Equitable distribution (NOT community property)
 * - "Alimony" (not maintenance or spousal support)
 * - "Legal Custody" / "Physical Custody" (not parenting responsibilities)
 * - Document titled "COMPLAINT FOR DIVORCE" (not petition in some courts)
 */
class GeorgiaDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'GA';
    this.stateName = 'Georgia';
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

    // Georgia residency — 6 months state, no county requirement
    this.residencyRequirements = {
      stateMonths: 6,
      countyDays: 0,
      description: 'Petitioner must have been a bona fide resident of Georgia for at least six months immediately preceding the filing of this Complaint. (O.C.G.A. § 19-5-2)'
    };

    // Georgia waiting period — 30 days from service (cannot be waived for no-fault)
    this.waitingPeriod = {
      days: 30,
      startsFrom: 'service_date',
      exceptions: ['May not apply to fault-based grounds other than irretrievably broken (O.C.G.A. § 19-5-3(13))'],
      description: 'Georgia requires a mandatory 30-day waiting period after service of process before the court may enter a final judgment for no-fault (irretrievably broken) divorces. This period cannot be waived by agreement. (O.C.G.A. § 19-5-3(13))'
    };
  }

  /**
   * Get Georgia case number label — "CIVIL ACTION FILE NO."
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'CIVIL ACTION FILE NO.';
  }

  /**
   * Get default court for Georgia county — Superior Court
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `Superior Court of ${countyName} County, Georgia`;
  }

  /**
   * Generate Georgia header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF GEORGIA';
  }

  /**
   * Generate Georgia venue
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyUpper = (county || '[COUNTY]').toUpperCase();
    return `COUNTY OF ${countyUpper}`;
  }

  /**
   * Generate Georgia case caption — uses plaintiff/defendant style
   * Georgia divorce complaints use Plaintiff and Defendant designations
   * @param {Object} divorceData - The divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    let caption = '';

    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county)).toUpperCase();
    caption += `IN THE ${courtName}\n\n`;

    const caseLabel = this.getCaseNumberLabel();
    const caseNumber = divorceData.caseNumber || '[CASE NUMBER]';
    caption += `${caseLabel} ${caseNumber}\n\n`;

    const petitioner = (divorceData.petitionerName || '[PLAINTIFF NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[DEFENDANT NAME]').toUpperCase();

    caption += `${petitioner},\n`;
    caption += `    Plaintiff,\n\n`;
    caption += `v.\n\n`;
    caption += `${respondent},\n`;
    caption += `    Defendant.`;

    return {
      courtName,
      caseNumber: divorceData.caseNumber,
      petitioner: divorceData.petitionerName,
      respondent: divorceData.respondentName,
      formatted: caption
    };
  }

  /**
   * Get Georgia jurisdiction statement
   * @param {Object} divorceData - Divorce data
   * @returns {string} Jurisdiction statement
   */
  getJurisdictionStatement(divorceData) {
    return `Plaintiff has been a bona fide resident of the State of Georgia for more than six (6) months immediately preceding the filing of this Complaint. (O.C.G.A. § 19-5-2)`;
  }

  /**
   * Get Georgia venue reason
   * @param {Object} divorceData - Divorce data
   * @returns {string} Venue reason
   */
  getVenueReason(divorceData) {
    return `Defendant resides in ${divorceData.county || '[COUNTY]'} County, Georgia, or, in the alternative, Plaintiff resides in this county`;
  }

  /**
   * Generate Georgia grounds section — supports all 13+ Georgia grounds
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Grounds section
   */
  generateGroundsSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 8;

    const groundsText = this.getGroundsText(divorceData.groundsForDivorce);

    items.push({
      number: paragraphNum++,
      content: groundsText,
      type: 'grounds'
    });

    return {
      title: 'IV. GROUNDS FOR DIVORCE',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Get Georgia-specific grounds statement
   * @param {string} grounds - Grounds code
   * @returns {string} Grounds text
   */
  getGroundsText(grounds) {
    switch (grounds) {
      case 'irretrievably_broken':
      case 'irreconcilable_differences':
      case 'no_fault':
        return 'The marriage of the parties is irretrievably broken. (O.C.G.A. § 19-5-3(13))';
      case 'adultery':
        return 'Defendant has committed adultery after the marriage. (O.C.G.A. § 19-5-3(6))';
      case 'wilful_desertion':
      case 'desertion':
        return 'Defendant has wilfully and continuously deserted Plaintiff for a term of one (1) year. (O.C.G.A. § 19-5-3(7))';
      case 'cruel_treatment':
      case 'cruelty':
        return 'Defendant has engaged in cruel treatment toward Plaintiff, consisting of the willful infliction of pain, bodily or mental, upon Plaintiff, such as reasonably justifies apprehension of danger to life, limb, or health. (O.C.G.A. § 19-5-3(10))';
      case 'habitual_intoxication':
        return 'Defendant is guilty of habitual intoxication. (O.C.G.A. § 19-5-3(9))';
      case 'habitual_drug_use':
        return 'Defendant is guilty of habitual addiction to controlled substances. (O.C.G.A. § 19-5-3(12))';
      case 'conviction_of_crime':
        return 'Defendant has been convicted of an offense involving moral turpitude and sentenced to imprisonment in a penal institution for a term of two (2) years or longer. (O.C.G.A. § 19-5-3(8))';
      case 'incurable_mental_illness':
        return 'Defendant suffers from an incurable mental illness, as established by the testimony of two (2) physicians. (O.C.G.A. § 19-5-3(11))';
      case 'fraud_duress':
        return 'The marriage was obtained by force, menace, duress, or fraud. (O.C.G.A. § 19-5-3(4))';
      case 'impotency':
        return 'Defendant was impotent at the time of the marriage. (O.C.G.A. § 19-5-3(3))';
      case 'mental_incapacity_at_marriage':
        return 'Defendant was mentally incapacitated at the time of the marriage. (O.C.G.A. § 19-5-3(2))';
      default:
        return 'The marriage of the parties is irretrievably broken. (O.C.G.A. § 19-5-3(13))';
    }
  }

  /**
   * Generate Georgia children section — uses "custody" not "parental responsibilities"
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
        content: 'No other children were born of or adopted by the parties during this marriage, and none are expected.',
        type: 'children_info'
      });
    }

    return {
      title: 'V. MINOR CHILDREN',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Georgia property section — equitable distribution language
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property section
   */
  generatePropertySection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 12;

    items.push({
      number: paragraphNum++,
      content: 'The parties have accumulated marital property during the marriage. Plaintiff requests that the Court equitably divide the marital property of the parties, having due regard for the contribution of each party to the acquisition of such property and the other relevant factors.',
      type: 'property_info'
    });

    items.push({
      number: paragraphNum++,
      content: 'The parties have accumulated marital debts. Plaintiff requests that the Court equitably allocate the marital debts of the parties.',
      type: 'debt_info'
    });

    return {
      title: 'VI. PROPERTY AND DEBTS',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Generate Georgia relief section — uses Georgia-specific terminology
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Relief section
   */
  generateReliefSection(divorceData) {
    const items = [];

    items.push({
      number: null,
      content: 'WHEREFORE, Plaintiff prays that this Court:',
      type: 'relief_intro'
    });

    const reliefItems = [
      'Grant a total divorce between the parties, dissolving the bonds of matrimony;',
      'Equitably divide the marital property of the parties;',
      'Equitably allocate the marital debts of the parties;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Award legal and physical custody of the minor child(ren) in their best interests;');
      reliefItems.push('Establish a parenting time schedule;');
      reliefItems.push('Order child support in accordance with O.C.G.A. § 19-6-15 guidelines;');
    }

    if (divorceData.requestSpousalSupport) {
      reliefItems.push('Award alimony to Plaintiff pursuant to O.C.G.A. § 19-6-1;');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`Restore Plaintiff's former name to: ${divorceData.previousName};`);
    }

    reliefItems.push('Award attorney fees and costs as the Court deems appropriate;');
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
      title: 'VII. PRAYER FOR RELIEF',
      items,
      nextParagraphNumber: null
    };
  }

  /**
   * Get Georgia verification text
   * @param {Object} divorceData - Divorce data
   * @returns {string} Verification text
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PLAINTIFF NAME]';
    return `I, ${name}, Plaintiff, being duly sworn, state that the allegations of the foregoing Complaint for Divorce are true and correct to the best of my knowledge and belief.

_________________________________
${name}
Plaintiff

Sworn to and subscribed before me this _____ day of _______________, 20___.

_________________________________
Notary Public, _______________ County, Georgia
My commission expires: ___________`;
  }

  /**
   * Perform Georgia-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for Georgia divorce complaints — file in county where Defendant resides');
    }

    warnings.push('Georgia requires 6 months state residency before filing. (O.C.G.A. § 19-5-2)');
    warnings.push('Georgia requires a 30-day waiting period after service before final judgment. (O.C.G.A. § 19-5-8)');

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('If minor children are involved, the court will require a parenting plan and child support calculation per O.C.G.A. § 19-6-15.');
    }

    return { errors, warnings };
  }
}

module.exports = GeorgiaDivorcePetitionTemplate;
