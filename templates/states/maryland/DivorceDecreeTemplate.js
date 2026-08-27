// templates/states/maryland/DivorceDecreeTemplate.js
// Maryland Judgment of Absolute Divorce template
// Complies with Md. Code, Fam. Law § 7-101 et seq.

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');
const { resolveCustodyArrangement, resolvePrimaryResidenceName } = require('../../core/parenting');
const { asList } = require('../../core/dataShapes');

/**
 * Maryland Judgment of Absolute Divorce Template
 *
 * Legal References:
 * - Md. Code, Fam. Law § 7-101 et seq. — Divorce jurisdiction and residency
 * - Md. Code, Fam. Law § 7-103 — Grounds for absolute divorce
 * - Md. Code, Fam. Law § 8-205 — Disposition of marital property (equitable distribution)
 * - Md. Code, Fam. Law § 11-106 — Alimony
 * - Md. Code, Fam. Law § 9-101 et seq. — Child custody
 * - Md. Code, Fam. Law § 12-204 — Child support guidelines
 *
 * Maryland-Specific Terms:
 * - "Judgment of Absolute Divorce" (not Final Decree of Divorce)
 * - "CASE NO." label
 * - "Legal Custody" / "Physical Custody" (not parental responsibilities)
 * - "Visitation" (not parenting time)
 * - "Alimony" (not maintenance or spousal support)
 * - Equitable distribution (NOT community property)
 * - Circuit Court
 */
class MarylandDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'MD';
    this.stateName = 'Maryland';
    this.documentTitle = 'JUDGMENT OF ABSOLUTE DIVORCE';

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
   * Get Maryland case number label
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'CASE NO.';
  }

  /**
   * Get default court for Maryland county — Circuit Court
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = county || '[COUNTY]';
    if (countyName.toLowerCase().includes('baltimore city')) {
      return 'Circuit Court for Baltimore City, Maryland';
    }
    return `Circuit Court for ${countyName} County, Maryland`;
  }

  /**
   * Generate Maryland header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF MARYLAND';
  }

  /**
   * Generate Maryland venue — title case
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyName = county || '[COUNTY]';
    if (countyName.toLowerCase().includes('baltimore city')) {
      return 'Baltimore City';
    }
    const countyFormatted = countyName.charAt(0).toUpperCase() + countyName.slice(1).toLowerCase();
    return `County of ${countyFormatted}`;
  }

  /**
   * Generate Maryland title
   * @returns {string} Title text
   */
  generateTitle() {
    return this.documentTitle;
  }

  /**
   * Get effective date text for Maryland
   * @returns {string} Effective date text
   */
  getEffectiveDateText() {
    return 'the date this Judgment is entered by the Court';
  }

  /**
   * Generate Maryland appearances section
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

    text += `\n\nThe Court, having considered the testimony, evidence, and applicable law, enters the following Judgment:`;

    return {
      title: 'APPEARANCES',
      text,
      type: 'appearances'
    };
  }

  /**
   * Generate Maryland jurisdiction section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Jurisdiction section
   */
  generateJurisdictionSection(divorceData) {
    return {
      title: 'JURISDICTION',
      text: `The Court finds that it has jurisdiction over this proceeding and the parties. Plaintiff has been a resident of the State of Maryland as required by Md. Code, Fam. Law § 7-101. The parties were married on ${this.formatDate(divorceData.marriageDate) || '[DATE]'}${divorceData.marriageLocation ? ` in ${divorceData.marriageLocation}` : ''}. The Court finds that the grounds for absolute divorce have been established.`,
      type: 'jurisdiction'
    };
  }

  /**
   * Generate Maryland dissolution section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Dissolution section
   */
  generateDissolutionSection(divorceData) {
    return {
      title: 'JUDGMENT OF ABSOLUTE DIVORCE',
      text: `IT IS ORDERED AND ADJUDGED that the marriage of ${divorceData.petitionerName || '[PLAINTIFF NAME]'} and ${divorceData.respondentName || '[DEFENDANT NAME]'} is hereby absolutely divorced, and the parties are restored to the status of unmarried persons, effective ${this.getEffectiveDateText()}.`,
      type: 'dissolution'
    };
  }

  /**
   * Generate Maryland property division — equitable distribution; "marital property"
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    items.push({
      content: 'The Court has considered the factors set forth in Md. Code, Fam. Law § 8-205 and orders an equitable distribution of marital property as follows:',
      type: 'finding'
    });

    if (asList(divorceData.petitionerProperty).length > 0) {
      items.push({
        content: `IT IS ORDERED that the following marital property is awarded to ${divorceData.petitionerName || 'Plaintiff'} as that party's sole and separate property:`,
        type: 'order'
      });
      asList(divorceData.petitionerProperty).forEach(prop => {
        items.push({ content: `- ${prop}`, type: 'property_item' });
      });
    }

    if (asList(divorceData.respondentProperty).length > 0) {
      items.push({
        content: `IT IS ORDERED that the following marital property is awarded to ${divorceData.respondentName || 'Defendant'} as that party's sole and separate property:`,
        type: 'order'
      });
      asList(divorceData.respondentProperty).forEach(prop => {
        items.push({ content: `- ${prop}`, type: 'property_item' });
      });
    }

    if (!divorceData.petitionerProperty && !divorceData.respondentProperty) {
      items.push({
        content: `IT IS ORDERED that each party is awarded the marital personal property currently in that party's possession as that party's sole and separate property.`,
        type: 'order'
      });
    }

    items.push({
      content: `IT IS ORDERED that each party's non-marital (separate) property is confirmed to that party.`,
      type: 'order'
    });

    return {
      title: 'DISTRIBUTION OF MARITAL PROPERTY',
      items,
      type: 'property'
    };
  }

  /**
   * Generate Maryland child custody section — uses "Legal Custody" and "Physical Custody"
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Custody section
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court finds that the following custody arrangement is in the best interests of the child(ren) pursuant to Md. Code, Fam. Law § 9-101 et seq.:',
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
        content: `IT IS ORDERED that the parties shall share joint legal custody of the minor child(ren). Primary physical custody is awarded to ${resolvePrimaryResidenceName(divorceData) || divorceData.petitionerName || 'Plaintiff'}.`,
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
        content: `IT IS ORDERED that ${custodianName} shall have sole legal custody and sole physical custody of the minor child(ren).`,
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
      title: 'CHILD CUSTODY',
      items,
      type: 'custody'
    };
  }

  /**
   * Get Maryland visitation language
   * @param {Object} divorceData - Divorce data
   * @returns {string} Visitation language
   */
  getVisitationLanguage(divorceData) {
    return `IT IS ORDERED that the non-custodial parent shall have reasonable and liberal visitation with the minor child(ren) as agreed by the parties or, in the absence of agreement, as set forth in the visitation schedule attached hereto and incorporated herein by reference.`;
  }

  /**
   * Generate Maryland child support section
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
        content: `IT IS ORDERED that ${obligor} shall pay child support to ${obligee} in the amount of $${divorceData.childSupportAmount} per month, calculated in accordance with the Maryland Child Support Guidelines, Md. Code, Fam. Law § 12-204.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that child support shall be paid in accordance with the Maryland Child Support Guidelines, Md. Code, Fam. Law § 12-204. The parties shall complete a Child Support Guidelines Worksheet.`,
        type: 'order'
      });
    }

    items.push({
      content: `IT IS ORDERED that ${obligor} shall maintain health insurance coverage for the minor child(ren) if available at a reasonable cost.`,
      type: 'order'
    });

    return {
      title: 'CHILD SUPPORT',
      items,
      type: 'child_support'
    };
  }

  /**
   * Generate Maryland alimony section — "Alimony" not "Maintenance"
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
        content: `The Court, having considered the factors set forth in Md. Code, Fam. Law § 11-106, orders alimony as follows:`,
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
   * Generate Maryland judgment block
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Judgment block
   */
  generateJudgmentBlock(divorceData) {
    const county = divorceData.county || '[COUNTY]';
    let courtLine;
    if (county.toLowerCase().includes('baltimore city')) {
      courtLine = 'CIRCUIT COURT FOR BALTIMORE CITY, MARYLAND';
    } else {
      courtLine = `CIRCUIT COURT FOR ${county.toUpperCase()} COUNTY, MARYLAND`;
    }

    return {
      text: `DONE AND ORDERED this _____ day of _______________, 20___.



_________________________________
JUDGE
${courtLine}`,
      type: 'judgment'
    };
  }

  /**
   * Perform Maryland-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County (or Baltimore City) is required for Maryland Judgment of Absolute Divorce');
    }

    if (!divorceData.caseNumber) {
      errors.push('Case number is required for Maryland divorce judgment');
    }

    const grounds = divorceData.groundsForDivorce || '';
    if (grounds === 'mutual_consent') {
      warnings.push('Mutual consent divorce requires a signed settlement agreement and both parties must appear at the hearing.');
    }

    if (divorceData.hasMinorChildren === true && (!divorceData.children || divorceData.children.length === 0)) {
      warnings.push('You indicated there are minor children but did not provide child information.');
    }

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('A completed Child Support Guidelines Worksheet must be attached when minor children are involved. (Md. Code, Fam. Law § 12-204)');
    }

    return { errors, warnings };
  }
}

module.exports = MarylandDivorceDecreeTemplate;
