// templates/states/nevada/DivorceDecreeTemplate.js
// Nevada Decree of Divorce template
// Complies with NRS 125 (Divorce)

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');
const { resolveCustodyArrangement, resolvePrimaryResidenceName } = require('../../core/parenting');
const { asList } = require('../../core/dataShapes');

/**
 * Nevada Decree of Divorce Template
 *
 * Legal References:
 * - NRS 125 — Divorce
 * - NRS 125.020 — Residency (6 weeks state; Resident Witness Affidavit)
 * - NRS 125.010 — Grounds (incompatibility, 1-year separation, insanity)
 * - NRS 125.150(1)(b) — Community property — equal 50/50 division
 * - NRS 125.150(1)(a) — Alimony
 * - NRS 125C.002, 125C.0025, 125C.0035 — Custody (joint legal, joint physical; best interest)
 * - NAC 425.140 et seq. — Child support guidelines (tiered percentage of income, eff. 2020)
 *
 * Nevada-Specific Terms:
 * - "Decree of Divorce" (not Decree of Dissolution)
 * - "CASE NO." label
 * - "Joint Legal Custody" / "Joint Physical Custody"
 * - "Visitation" (NRS 125C)
 * - "Alimony" (not spousal maintenance)
 * - Community property — equal 50/50 division
 * - Family Court (Clark/Washoe) or District Court (rural)
 * - Plaintiff / Defendant
 * - No mandatory waiting period
 */
class NevadaDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'NV';
    this.stateName = 'Nevada';
    this.documentTitle = 'DECREE OF DIVORCE';

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
   * Get Nevada case number label
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
   * Generate Nevada venue — uppercase
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    return `IN AND FOR THE COUNTY OF ${countyName.toUpperCase()}`;
  }

  /**
   * Generate Nevada title
   * @returns {string} Title text
   */
  generateTitle() {
    return this.documentTitle;
  }

  /**
   * Get effective date text for Nevada
   * @returns {string} Effective date text
   */
  getEffectiveDateText() {
    return 'the date this Decree is entered by the Court';
  }

  /**
   * Generate Nevada appearances section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Appearances section
   */
  generateAppearancesSection(divorceData) {
    let text = '';

    text += `This matter came before the Court for hearing.\n\n`;

    if (divorceData.isUncontested || divorceData.appearanceType === 'agreed') {
      text += `Plaintiff, ${divorceData.petitionerName || '[PLAINTIFF NAME]'}, appeared ${divorceData.petitionerRepresentation === 'attorney' ? 'with counsel' : 'pro se (self-represented)'}.\n\n`;
      text += `Defendant, ${divorceData.respondentName || '[DEFENDANT NAME]'}, ${divorceData.respondentAppeared ? 'appeared and announced agreement' : 'having been duly served, did not appear'}.`;
    } else {
      text += `Plaintiff appeared ${divorceData.petitionerRepresentation === 'attorney' ? 'with counsel' : 'pro se'}.\n\n`;
      text += `Defendant ${divorceData.respondentAppeared ? 'appeared' : 'did not appear'}.`;
    }

    text += `\n\nThe Court, having considered the evidence, the Complaint, the Resident Witness Affidavit, and applicable law, enters the following Decree:`;

    return {
      title: 'APPEARANCES',
      text,
      type: 'appearances'
    };
  }

  /**
   * Generate Nevada jurisdiction section — 6-week residency, no waiting period
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Jurisdiction section
   */
  generateJurisdictionSection(divorceData) {
    return {
      title: 'JURISDICTION',
      text: `The Court finds that it has jurisdiction over this proceeding and the parties. At least one party has been a bona fide resident of the State of Nevada for at least six (6) weeks immediately preceding the filing of the Complaint, and resides in ${divorceData.county || '[COUNTY]'} County, Nevada. Residency has been established by Resident Witness Affidavit pursuant to NRS 125.020. The parties were married on ${this.formatDate(divorceData.marriageDate) || '[DATE]'}${divorceData.marriageLocation ? ` in ${divorceData.marriageLocation}` : ''}. The parties are incompatible.`,
      type: 'jurisdiction'
    };
  }

  /**
   * Generate Nevada dissolution section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Dissolution section
   */
  generateDissolutionSection(divorceData) {
    return {
      title: 'DECREE OF DIVORCE',
      text: `IT IS ORDERED, ADJUDGED, AND DECREED that the marriage of ${divorceData.petitionerName || '[PLAINTIFF NAME]'} and ${divorceData.respondentName || '[DEFENDANT NAME]'} is hereby dissolved, and each party is restored to the status of an unmarried person, effective ${this.getEffectiveDateText()}.`,
      type: 'dissolution'
    };
  }

  /**
   * Generate Nevada property division — community property, equal 50/50 division
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    items.push({
      content: 'The Court has considered the community property and community debts of the parties. Pursuant to NRS 125.150(1)(b), the Court orders an equal disposition of all community property and community debts as follows:',
      type: 'finding'
    });

    if (asList(divorceData.petitionerProperty).length > 0) {
      items.push({
        content: `IT IS ORDERED that the following community property is awarded to ${divorceData.petitionerName || 'Plaintiff'} as that party's sole and separate property:`,
        type: 'order'
      });
      asList(divorceData.petitionerProperty).forEach(prop => {
        items.push({ content: `- ${prop}`, type: 'property_item' });
      });
    }

    if (asList(divorceData.respondentProperty).length > 0) {
      items.push({
        content: `IT IS ORDERED that the following community property is awarded to ${divorceData.respondentName || 'Defendant'} as that party's sole and separate property:`,
        type: 'order'
      });
      asList(divorceData.respondentProperty).forEach(prop => {
        items.push({ content: `- ${prop}`, type: 'property_item' });
      });
    }

    if (!divorceData.petitionerProperty && !divorceData.respondentProperty) {
      items.push({
        content: `IT IS ORDERED that each party is awarded the personal property currently in that party's possession as that party's sole and separate property. All community property and community debts shall be divided equally between the parties.`,
        type: 'order'
      });
    }

    items.push({
      content: 'IT IS FURTHER ORDERED that each party is awarded their respective separate property (property acquired before the marriage, by gift, or by inheritance).',
      type: 'order'
    });

    return {
      title: 'DIVISION OF COMMUNITY PROPERTY',
      items,
      type: 'property'
    };
  }

  /**
   * Generate Nevada child custody section — "Joint Legal Custody" and "Joint Physical Custody"
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Custody section
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court finds that the following custody arrangement is in the best interests of the child(ren) pursuant to NRS 125C.0035:',
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

    if (custody.kind === 'joint') {
      items.push({
        content: `IT IS ORDERED that the parties shall share joint legal custody and joint physical custody of the minor child(ren). ${resolvePrimaryResidenceName(divorceData) || divorceData.petitionerName || 'Plaintiff'} shall be the primary physical custodian.`,
        type: 'order'
      });
    } else if (custody.kind === 'sole_petitioner' || custody.kind === 'sole_respondent' || custody.kind === 'legacy_sole') {
      const custodianName =
        custody.kind === 'sole_petitioner'
          ? (divorceData.petitionerName || 'Plaintiff')
          : custody.kind === 'sole_respondent'
            ? (divorceData.respondentName || 'Defendant')
            : (resolvePrimaryResidenceName(divorceData) || divorceData.petitionerName || 'Plaintiff');
      soleCustodianName = custodianName;
      items.push({
        content: `IT IS ORDERED that ${custodianName} shall have sole legal and physical custody of the minor child(ren).`,
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
      title: 'CUSTODY AND VISITATION',
      items,
      type: 'custody'
    };
  }

  /**
   * Get Nevada visitation language
   * @param {Object} divorceData - Divorce data
   * @returns {string} Visitation language
   */
  getVisitationLanguage(divorceData) {
    return `IT IS ORDERED that the non-custodial parent shall have reasonable visitation with the minor child(ren) pursuant to NRS 125C, or as otherwise agreed by the parties and approved by the Court.`;
  }

  /**
   * Generate Nevada child support section
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Child support section
   */
  generateChildSupportSection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];
    const obligor = divorceData.childSupportObligor || divorceData.respondentName || 'Defendant';
    const obligee = divorceData.childSupportObligee || divorceData.petitionerName || 'Plaintiff';

    if (divorceData.childSupportAmount) {
      items.push({
        content: `IT IS ORDERED that ${obligor} shall pay child support to ${obligee} in the amount of $${divorceData.childSupportAmount} per month, calculated in accordance with the Nevada Child Support Guidelines, NAC 425.140 et seq..`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that child support shall be paid in accordance with the Nevada Child Support Guidelines, NAC 425.140 et seq.. The parties shall complete a Child Support Worksheet.`,
        type: 'order'
      });
    }

    items.push({
      content: `IT IS ORDERED that ${obligor} shall maintain health insurance coverage for the minor child(ren) if available at a reasonable cost through employment or otherwise.`,
      type: 'order'
    });

    return {
      title: 'CHILD SUPPORT',
      items,
      type: 'child_support'
    };
  }

  /**
   * Generate Nevada alimony section — "Alimony" not "Maintenance"
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Alimony section
   */
  generateSpousalSupportSection(divorceData) {
    if (!divorceData.spousalSupportAwarded && !divorceData.spousalSupportWaived) {
      return null;
    }

    const items = [];

    if (divorceData.spousalSupportWaived) {
      items.push({
        content: 'IT IS ORDERED that each party waives and relinquishes any claim for alimony from the other party, now and forever.',
        type: 'order'
      });
    } else if (divorceData.spousalSupportAwarded) {
      const payor = divorceData.spousalSupportPayor || divorceData.respondentName || 'Defendant';
      const payee = divorceData.spousalSupportPayee || divorceData.petitionerName || 'Plaintiff';

      items.push({
        content: `The Court, having considered the factors set forth in NRS 125.150(1)(a), including the financial condition of each party, the duration of the marriage, each party's earning capacity, and the standard of living during the marriage, orders alimony as follows:`,
        type: 'finding'
      });

      items.push({
        content: `IT IS ORDERED that ${payor} shall pay alimony to ${payee} in the amount of $${divorceData.spousalSupportAmount || '[AMOUNT]'} per month for a period of ${divorceData.spousalSupportDuration || '[DURATION]'}.`,
        type: 'order'
      });
    }

    return {
      title: 'ALIMONY',
      items,
      type: 'spousal_support'
    };
  }

  /**
   * Generate Nevada judgment block
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Judgment block
   */
  generateJudgmentBlock(divorceData) {
    const countyUpper = divorceData.county ? divorceData.county.toUpperCase() : '[COUNTY]';
    const upperCounty = countyUpper;
    const courtType = (upperCounty === 'CLARK' || upperCounty === 'WASHOE') ? 'FAMILY COURT' : 'DISTRICT COURT';

    return {
      text: `SO ORDERED this _____ day of _______________, 20___.



_________________________________
JUDGE, ${courtType}
COUNTY OF ${countyUpper}, STATE OF NEVADA`,
      type: 'judgment'
    };
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
      errors.push('County is required for Nevada Decree of Divorce');
    }

    if (!divorceData.caseNumber) {
      errors.push('Case number is required for Nevada Decree of Divorce');
    }

    warnings.push('Ensure a Resident Witness Affidavit has been filed to establish 6-week residency. (NRS 125.020)');

    if (divorceData.hasMinorChildren === true && (!divorceData.children || divorceData.children.length === 0)) {
      warnings.push('You indicated there are minor children but did not provide child information.');
    }

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('A completed Child Support Worksheet must be filed per the Nevada Child Support Guidelines (NAC ch. 425).');
      warnings.push('Custody and visitation must be determined in the best interests of the child(ren). (NRS 125C.0035)');
    }

    return { errors, warnings };
  }
}

module.exports = NevadaDivorceDecreeTemplate;
