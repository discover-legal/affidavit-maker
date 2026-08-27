// templates/states/washington/DivorceDecreeTemplate.js
// Washington State Decree of Dissolution of Marriage template
// Complies with RCW 26.09 (Dissolution of Marriage, Legal Separation)

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');
const { resolveCustodyArrangement, resolvePrimaryResidenceName } = require('../../core/parenting');
const { asList } = require('../../core/dataShapes');

/**
 * Washington State Decree of Dissolution of Marriage Template
 *
 * Legal References:
 * - RCW 26.09 — Dissolution of Marriage, Legal Separation
 * - RCW 26.09.010 — Jurisdiction of Superior Court over dissolution proceedings
 * - RCW 26.09.020 — Residency requirement (resident of WA at time of filing)
 * - RCW 26.09.030 — Irretrievable breakdown; 90-day waiting period from date of filing
 * - RCW 26.09.080 — Disposition of property (community property)
 * - RCW 26.09.090 — Maintenance (spousal maintenance)
 * - RCW 26.09.181 — Parenting Plan required
 * - RCW 26.19 — Washington State Child Support Schedule
 *
 * Washington-Specific Terms:
 * - "Decree of Dissolution of Marriage"
 * - "NO." case number label
 * - "Spousal Maintenance" (not alimony)
 * - "Parenting Plan" / "Residential Schedule" (not custody / visitation)
 * - Community property state — just and equitable division
 * - Superior Court
 * - 90-day waiting period runs from DATE OF FILING (not from service) per RCW 26.09.030
 */
class WashingtonDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'WA';
    this.stateName = 'Washington';
    this.documentTitle = 'DECREE OF DISSOLUTION OF MARRIAGE';

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
      'caseNumber',
      'marriageDate'
    ];
  }

  /**
   * Get Washington case number label — "NO."
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'NO.';
  }

  /**
   * Get default court for Washington county — Superior Court
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    return `Superior Court of ${countyName} County, State of Washington`;
  }

  /**
   * Generate Washington header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF WASHINGTON';
  }

  /**
   * Generate Washington venue
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyUpper = (county || '[COUNTY]').toUpperCase();
    return `COUNTY OF ${countyUpper}`;
  }

  /**
   * Generate Washington case caption — "IN RE THE MARRIAGE OF" style
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    let caption = '';

    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county)).toUpperCase();
    caption += `IN THE ${courtName}\n\n`;

    const caseLabel = this.getCaseNumberLabel();
    const caseNumber = divorceData.caseNumber || '[CASE NUMBER]';
    caption += `${caseLabel} ${caseNumber}\n\n`;

    const petitioner = (divorceData.petitionerName || '[PETITIONER NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();

    caption += `IN RE THE MARRIAGE OF:\n\n`;
    caption += `${petitioner},\n`;
    caption += `    Petitioner,\n\n`;
    caption += `and\n\n`;
    caption += `${respondent},\n`;
    caption += `    Respondent.`;

    return {
      courtName,
      caseNumber: divorceData.caseNumber,
      petitioner: divorceData.petitionerName,
      respondent: divorceData.respondentName,
      formatted: caption
    };
  }

  /**
   * Generate Washington title
   * @returns {string} Title text
   */
  generateTitle() {
    return this.documentTitle;
  }

  /**
   * Get effective date text for Washington
   * @returns {string} Effective date text
   */
  getEffectiveDateText() {
    return 'the date this Decree is entered by the Court';
  }

  /**
   * Generate Washington appearances section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Appearances section
   */
  generateAppearancesSection(divorceData) {
    let text = '';

    text += `This matter came before the Court.\n\n`;

    if (divorceData.isUncontested || divorceData.appearanceType === 'agreed') {
      text += `Petitioner, ${divorceData.petitionerName || '[PETITIONER NAME]'}, appeared ${divorceData.petitionerRepresentation === 'attorney' ? 'with counsel' : 'pro se (self-represented)'}.\n\n`;
      text += `Respondent, ${divorceData.respondentName || '[RESPONDENT NAME]'}, ${divorceData.respondentAppeared ? 'appeared and announced agreement' : 'having been duly served, did not appear'}.`;
    } else {
      text += `Petitioner appeared ${divorceData.petitionerRepresentation === 'attorney' ? 'with counsel' : 'pro se'}.\n\n`;
      text += `Respondent ${divorceData.respondentAppeared ? 'appeared' : 'did not appear'}.`;
    }

    text += `\n\nThe Court, having considered the record, evidence, and applicable law, enters the following Decree of Dissolution of Marriage:`;

    return {
      title: 'APPEARANCES',
      text,
      type: 'appearances'
    };
  }

  /**
   * Generate Washington jurisdiction section — domicile; 90-day waiting period
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Jurisdiction section
   */
  generateJurisdictionSection(divorceData) {
    return {
      title: 'JURISDICTION',
      text: `The Court finds that it has jurisdiction over this proceeding pursuant to RCW 26.09.010. At least one party was a resident of Washington and intended to remain in the state at the time of filing, satisfying the residency requirement of RCW 26.09.020. The parties were married on ${this.formatDate(divorceData.marriageDate) || '[DATE]'}${divorceData.marriageLocation ? ` in ${divorceData.marriageLocation}` : ''}. The marriage is irretrievably broken. At least ninety (90) days have elapsed since the Petition was filed. (RCW 26.09.030)`,
      type: 'jurisdiction'
    };
  }

  /**
   * Generate Washington dissolution section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Dissolution section
   */
  generateDissolutionSection(divorceData) {
    return {
      title: 'DISSOLUTION',
      text: `IT IS ORDERED that the marriage of ${divorceData.petitionerName || '[PETITIONER NAME]'} and ${divorceData.respondentName || '[RESPONDENT NAME]'} is hereby dissolved, and the parties are restored to the status of single persons, effective ${this.getEffectiveDateText()}.`,
      type: 'dissolution'
    };
  }

  /**
   * Generate Washington property division — community property, just and equitable
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    items.push({
      content: 'The Court orders a just and equitable disposition of the community property and liabilities of the parties pursuant to RCW 26.09.080:',
      type: 'finding'
    });

    if (asList(divorceData.petitionerProperty).length > 0) {
      items.push({
        content: `IT IS ORDERED that the following community property is awarded to ${divorceData.petitionerName || 'Petitioner'} as that party's sole and separate property:`,
        type: 'order'
      });
      asList(divorceData.petitionerProperty).forEach(prop => {
        items.push({ content: `- ${prop}`, type: 'property_item' });
      });
    }

    if (asList(divorceData.respondentProperty).length > 0) {
      items.push({
        content: `IT IS ORDERED that the following community property is awarded to ${divorceData.respondentName || 'Respondent'} as that party's sole and separate property:`,
        type: 'order'
      });
      asList(divorceData.respondentProperty).forEach(prop => {
        items.push({ content: `- ${prop}`, type: 'property_item' });
      });
    }

    if (!divorceData.petitionerProperty && !divorceData.respondentProperty) {
      items.push({
        content: 'IT IS ORDERED that each party is awarded the personal property currently in that party\'s possession as that party\'s sole and separate property.',
        type: 'order'
      });
    }

    items.push({
      content: 'IT IS ORDERED that each party\'s separate property (property acquired before the marriage or acquired during the marriage by gift or inheritance) is confirmed to that party.',
      type: 'order'
    });

    items.push({
      content: 'IT IS ORDERED that each party shall indemnify and hold the other harmless from any debts assigned to that party under this Decree.',
      type: 'order'
    });

    return {
      title: 'DIVISION OF PROPERTY',
      items,
      type: 'property'
    };
  }

  /**
   * Generate Washington child custody/Parenting Plan section
   * Washington requires a Parenting Plan with Residential Schedule
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Parenting Plan section
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court enters the following Parenting Plan in the best interests of the minor child(ren) pursuant to RCW 26.09.181:',
      type: 'finding'
    });

    items.push({
      content: 'The minor child(ren) of this marriage:',
      type: 'order'
    });

    divorceData.children.forEach((child, index) => {
      const childInfo = typeof child === 'string'
        ? child
        : `${child.name || '[CHILD NAME]'}, born ${this.formatDate(child.birthDate ?? child.dob ?? child.dateOfBirth) || '[BIRTH DATE]'}`;
      items.push({
        content: `${index + 1}. ${childInfo}`,
        type: 'child_item'
      });
    });

    // Safety rule (mirrors the base class): only positively recognized
    // custody values render a joint or sole order. Legacy free text like
    // "joint decision making" maps to the joint branch; anything ambiguous
    // renders neutral as-agreed language with a placeholder — NEVER a sole
    // order (see templates/core/parenting.js).
    const custody = resolveCustodyArrangement(divorceData);
    const residenceName = resolvePrimaryResidenceName(divorceData);
    let soleCustodianName = null;
    const primaryParent =
      custody.kind === 'sole_petitioner'
        ? (divorceData.petitionerName || 'Petitioner')
        : custody.kind === 'sole_respondent'
          ? (divorceData.respondentName || 'Respondent')
          : (resolvePrimaryResidenceName(divorceData) || divorceData.petitionerName || 'Petitioner');

    if (custody.kind === 'joint') {
      items.push({
        content: `IT IS ORDERED that the parties shall share decision-making authority for the minor child(ren). The primary residence of the child(ren) shall be with ${primaryParent} pursuant to the Residential Schedule set forth in the Parenting Plan.`,
        type: 'order'
      });
    } else if (custody.kind === 'sole_petitioner' || custody.kind === 'sole_respondent' || custody.kind === 'legacy_sole') {
      soleCustodianName = primaryParent;
      items.push({
        content: `IT IS ORDERED that ${primaryParent} shall have primary residential responsibility for the minor child(ren) and sole decision-making authority pursuant to the Parenting Plan.`,
        type: 'order'
      });
    } else {
      // Unrecognized/undecided arrangement — neutral order with an explicit
      // placeholder for the parties' actual agreement. Never default to sole.
      items.push({
        content: 'IT IS ORDERED that the parties shall exercise legal custody and decision-making responsibility for the minor child(ren) as agreed by the parties: [ARRANGEMENT — set out the parties\' decision-making agreement].',
        type: 'order'
      });
    }

    // Primary residence: ordered whenever the case data says where the
    // child(ren) live, regardless of the custody branch. (The joint branch
    // keeps its historical wording and fallbacks unchanged.)
    if (custody.kind !== 'joint' && residenceName && residenceName !== soleCustodianName) {
      items.push({
        content: `IT IS ORDERED that the child(ren) shall primarily reside with ${residenceName}.`,
        type: 'order'
      });
    }

    items.push({
      content: this.getVisitationLanguage(divorceData),
      type: 'order'
    });

    return {
      title: 'PARENTING PLAN',
      items,
      type: 'custody'
    };
  }

  /**
   * Get Washington residential schedule / parenting time language
   * @param {Object} divorceData - Divorce data
   * @returns {string} Residential schedule language
   */
  getVisitationLanguage(divorceData) {
    return `IT IS ORDERED that the Residential Schedule for the minor child(ren) shall be as set forth in the final Parenting Plan attached hereto and incorporated herein by this reference. (RCW 26.09.181)`;
  }

  /**
   * Generate Washington child support section
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Child support section
   */
  generateChildSupportSection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];
    const obligor = divorceData.childSupportObligor || divorceData.respondentName || 'Respondent';
    const obligee = divorceData.childSupportObligee || divorceData.petitionerName || 'Petitioner';

    if (divorceData.childSupportAmount) {
      items.push({
        content: `IT IS ORDERED that ${obligor} shall pay child support to ${obligee} in the amount of $${divorceData.childSupportAmount} per month, calculated in accordance with the Washington State Child Support Schedule, RCW 26.19.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that child support shall be paid in accordance with the Washington State Child Support Schedule, RCW 26.19. The Child Support Worksheets are attached and incorporated herein.`,
        type: 'order'
      });
    }

    items.push({
      content: `IT IS ORDERED that ${obligor} shall maintain health insurance coverage for the minor child(ren) if available at a reasonable cost through employment or otherwise.`,
      type: 'order'
    });

    items.push({
      content: 'Uninsured and unreimbursed health care expenses for the minor child(ren) shall be allocated in accordance with the Child Support Order.',
      type: 'order'
    });

    return {
      title: 'CHILD SUPPORT',
      items,
      type: 'child_support'
    };
  }

  /**
   * Generate Washington spousal maintenance section
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Spousal maintenance section
   */
  generateSpousalSupportSection(divorceData) {
    if (!divorceData.spousalSupportAwarded && !divorceData.spousalSupportWaived) {
      return null;
    }

    const items = [];

    if (divorceData.spousalSupportWaived) {
      items.push({
        content: 'IT IS ORDERED that each party waives and relinquishes any claim for spousal maintenance from the other party, now and forever.',
        type: 'order'
      });
    } else if (divorceData.spousalSupportAwarded) {
      const payor = divorceData.spousalSupportPayor || divorceData.respondentName || 'Respondent';
      const payee = divorceData.spousalSupportPayee || divorceData.petitionerName || 'Petitioner';

      items.push({
        content: `The Court, having considered the factors set forth in RCW 26.09.090, orders spousal maintenance as follows:`,
        type: 'finding'
      });

      items.push({
        content: `IT IS ORDERED that ${payor} shall pay spousal maintenance to ${payee} in the amount of $${divorceData.spousalSupportAmount || '[AMOUNT]'} per month for a period of ${divorceData.spousalSupportDuration || '[DURATION]'}.`,
        type: 'order'
      });
    }

    return {
      title: 'SPOUSAL MAINTENANCE',
      items,
      type: 'spousal_support'
    };
  }

  /**
   * Generate Washington name change section
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Name change section
   */
  generateNameChangeSection(divorceData) {
    if (!divorceData.requestNameChange || !divorceData.previousName) {
      return null;
    }

    const person = divorceData.nameChangeParty || divorceData.petitionerName || 'Petitioner';

    return {
      title: 'RESTORATION OF FORMER NAME',
      text: `IT IS ORDERED that ${person}'s former name is restored to: ${divorceData.previousName}.`,
      type: 'name_change'
    };
  }

  /**
   * Generate Washington judgment block
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Judgment block
   */
  generateJudgmentBlock(divorceData) {
    return {
      text: `DONE IN OPEN COURT this _____ day of _______________, 20___.



_________________________________
SUPERIOR COURT JUDGE
${divorceData.county ? `${divorceData.county.toUpperCase()} COUNTY, WASHINGTON` : '[COUNTY] COUNTY, WASHINGTON'}`,
      type: 'judgment'
    };
  }

  /**
   * Perform Washington-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for Washington Decree of Dissolution of Marriage');
    }

    if (!divorceData.caseNumber) {
      errors.push('Case number is required for Washington dissolution decree');
    }

    warnings.push('Ensure 90 days have elapsed from the date the petition was filed before the decree is entered. (RCW 26.09.030)');
    warnings.push('Washington is a community property state. The court must make a just and equitable disposition of all community property and liabilities. (RCW 26.09.080)');

    if (divorceData.hasMinorChildren === true && (!divorceData.children || divorceData.children.length === 0)) {
      warnings.push('You indicated there are minor children but did not provide child information.');
    }

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('A final Parenting Plan must be attached when minor children are involved. (RCW 26.09.181)');
      warnings.push('Washington State Child Support Worksheets must be attached to the Child Support Order.');
    }

    return { errors, warnings };
  }
}

module.exports = WashingtonDivorceDecreeTemplate;
