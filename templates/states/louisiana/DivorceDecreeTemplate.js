// templates/states/louisiana/DivorceDecreeTemplate.js
// Louisiana Judgment of Divorce template
// Complies with La. C.C. Art. 102-103 (Divorce)

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');

/**
 * Louisiana Judgment of Divorce Template
 *
 * Legal References:
 * - La. C.C. Art. 102 — No-fault divorce (file first, wait 180/365 days)
 * - La. C.C. Art. 103 — No-fault divorce (already separated); fault grounds
 * - La. C.C. Art. 10 — Domicile
 * - La. C.C.P. Art. 3941 — Venue (parish of domicile)
 * - La. C.C. Art. 2336 et seq. — Community property regime
 * - La. R.S. 9:2801 — Partition of community property
 * - La. C.C. Art. 131 et seq. — Custody (joint custody; domiciliary parent)
 * - La. R.S. 9:335 — Joint custody implementation
 * - La. C.C. Art. 111-113 — Spousal support (interim and final periodic)
 * - La. R.S. 9:315 et seq. — Child support guidelines (income shares)
 *
 * Louisiana-Specific Terms:
 * - "Judgment of Divorce" (not Decree of Dissolution)
 * - "DOCKET NO." label
 * - "Joint Custody" with "Domiciliary Parent" / "Non-Domiciliary Parent"
 * - "Visitation" / "Custodial Time" (La. R.S. 9:335)
 * - "Spousal Support" — interim and final periodic (not alimony or maintenance)
 * - Community property — equal 50/50 partition
 * - District Court (organized by judicial district and parish)
 * - Louisiana uses PARISHES, not counties
 */
class LouisianaDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'LA';
    this.stateName = 'Louisiana';
    this.documentTitle = 'JUDGMENT OF DIVORCE';

    try {
      this.metadata = require('./divorce-metadata.json');
    } catch (e) {
      this.metadata = null;
    }

    this.requiredFields = [
      'petitionerName',
      'respondentName',
      'state',
      'parish',
      'caseNumber',
      'marriageDate'
    ];
  }

  /**
   * Get Louisiana case number label
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'DOCKET NO.';
  }

  /**
   * Get default court for Louisiana parish — District Court
   * @param {string} parish - Parish name (may also receive county for compatibility)
   * @returns {string} Court name
   */
  getDefaultCourt(parish) {
    const parishName = parish || '[PARISH]';
    return `District Court, Parish of ${parishName}, State of Louisiana`;
  }

  /**
   * Generate Louisiana header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF LOUISIANA';
  }

  /**
   * Generate Louisiana venue — "Parish of [Parish]"
   * Louisiana uses parishes, not counties.
   * @param {string} county - Parish name (parameter named county for interface compatibility)
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const parishName = county || '[PARISH]';
    const parishFormatted = parishName.charAt(0).toUpperCase() + parishName.slice(1).toLowerCase();
    return `Parish of ${parishFormatted}`;
  }

  /**
   * Generate Louisiana title
   * @returns {string} Title text
   */
  generateTitle() {
    return this.documentTitle;
  }

  /**
   * Get effective date text for Louisiana
   * @returns {string} Effective date text
   */
  getEffectiveDateText() {
    return 'the date this Judgment is signed by the Court';
  }

  /**
   * Generate Louisiana appearances section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Appearances section
   */
  generateAppearancesSection(divorceData) {
    let text = '';

    text += `This matter came before the Court for hearing.\n\n`;

    if (divorceData.isUncontested || divorceData.appearanceType === 'agreed') {
      text += `Petitioner, ${divorceData.petitionerName || '[PETITIONER NAME]'}, appeared ${divorceData.petitionerRepresentation === 'attorney' ? 'with counsel' : 'in proper person (self-represented)'}.\n\n`;
      text += `Respondent, ${divorceData.respondentName || '[RESPONDENT NAME]'}, ${divorceData.respondentAppeared ? 'appeared and announced agreement' : 'having been duly served with citation, did not appear'}.`;
    } else {
      text += `Petitioner appeared ${divorceData.petitionerRepresentation === 'attorney' ? 'with counsel' : 'in proper person'}.\n\n`;
      text += `Respondent ${divorceData.respondentAppeared ? 'appeared' : 'did not appear'}.`;
    }

    text += `\n\nThe Court, having considered the pleadings, evidence, and applicable law, renders the following Judgment:`;

    return {
      title: 'APPEARANCES',
      text,
      type: 'appearances'
    };
  }

  /**
   * Generate Louisiana jurisdiction section — domicile-based, parish residency
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Jurisdiction section
   */
  generateJurisdictionSection(divorceData) {
    const parish = divorceData.parish || divorceData.county || '[PARISH]';
    const grounds = divorceData.groundsForDivorce || 'article_102';

    let groundsText = '';
    if (grounds === 'article_102' || grounds === 'no_fault') {
      groundsText = 'The required period of living separate and apart has elapsed since service of the Petition pursuant to Louisiana Civil Code Article 102.';
    } else if (grounds === 'article_103_separation' || grounds === 'article_103') {
      groundsText = 'The parties have lived separate and apart continuously for the period required by Louisiana Civil Code Article 103(1).';
    } else if (grounds === 'adultery') {
      groundsText = 'The Court finds that Respondent has committed adultery as provided in Louisiana Civil Code Article 103(2).';
    } else if (grounds === 'felony_conviction') {
      groundsText = 'The Court finds that Respondent has been convicted of a felony and sentenced to death or imprisonment at hard labor as provided in Louisiana Civil Code Article 103(3).';
    } else {
      groundsText = 'The required period of living separate and apart has elapsed pursuant to the applicable provisions of the Louisiana Civil Code.';
    }

    return {
      title: 'JURISDICTION',
      text: `The Court finds that it has jurisdiction over this proceeding and the parties. Petitioner is domiciled in the State of Louisiana and has been domiciled in the Parish of ${parish} for at least six (6) months preceding the filing of the petition. (La. C.C. Art. 10; La. C.C.P. Art. 3941) The parties were married on ${this.formatDate(divorceData.marriageDate) || '[DATE]'}${divorceData.marriageLocation ? ` in ${divorceData.marriageLocation}` : ''}. ${groundsText}`,
      type: 'jurisdiction'
    };
  }

  /**
   * Generate Louisiana dissolution section — "Judgment of Divorce"
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Dissolution section
   */
  generateDissolutionSection(divorceData) {
    return {
      title: 'JUDGMENT OF DIVORCE',
      text: `IT IS ORDERED, ADJUDGED, AND DECREED that a Judgment of Divorce is hereby rendered in favor of ${divorceData.petitionerName || '[PETITIONER NAME]'} and against ${divorceData.respondentName || '[RESPONDENT NAME]'}, dissolving the bonds of matrimony between the parties, effective ${this.getEffectiveDateText()}.`,
      type: 'dissolution'
    };
  }

  /**
   * Generate Louisiana property division — community property equal partition
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    items.push({
      content: 'The Court orders an equal partition of the community property and community debts of the parties pursuant to Louisiana Civil Code Article 2336 et seq. and La. R.S. 9:2801. Each party is confirmed as the owner of their separate property.',
      type: 'finding'
    });

    if (divorceData.petitionerProperty && divorceData.petitionerProperty.length > 0) {
      items.push({
        content: `IT IS ORDERED that the following community property is awarded to ${divorceData.petitionerName || 'Petitioner'} as that party's share of the community:`,
        type: 'order'
      });
      divorceData.petitionerProperty.forEach(prop => {
        items.push({ content: `- ${prop}`, type: 'property_item' });
      });
    }

    if (divorceData.respondentProperty && divorceData.respondentProperty.length > 0) {
      items.push({
        content: `IT IS ORDERED that the following community property is awarded to ${divorceData.respondentName || 'Respondent'} as that party's share of the community:`,
        type: 'order'
      });
      divorceData.respondentProperty.forEach(prop => {
        items.push({ content: `- ${prop}`, type: 'property_item' });
      });
    }

    if (!divorceData.petitionerProperty && !divorceData.respondentProperty) {
      items.push({
        content: `IT IS ORDERED that each party is awarded the community property currently in that party's possession as that party's share of the community. The Court reserves the right of either party to seek a judicial partition of any remaining community property.`,
        type: 'order'
      });
    }

    return {
      title: 'PARTITION OF COMMUNITY PROPERTY',
      items,
      type: 'property'
    };
  }

  /**
   * Generate Louisiana child custody section — "Joint Custody" with "Domiciliary Parent"
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Custody section
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court finds that the following custody arrangement is in the best interests of the child(ren) pursuant to Louisiana Civil Code Article 131 et seq.:',
      type: 'finding'
    });

    items.push({
      content: 'The minor child(ren) of this marriage:',
      type: 'order'
    });

    divorceData.children.forEach((child, index) => {
      const childInfo = typeof child === 'string'
        ? child
        : `${child.name || '[CHILD NAME]'}, born ${this.formatDate(child.birthDate) || '[BIRTH DATE]'}`;
      items.push({
        content: `${index + 1}. ${childInfo}`,
        type: 'child_item'
      });
    });

    const custodyType = divorceData.custodyType || 'joint';
    const domiciliaryParent = divorceData.domiciliaryParent || divorceData.primaryCustodian || divorceData.petitionerName || 'Petitioner';
    const nonDomiciliaryParent = divorceData.nonDomiciliaryParent || divorceData.respondentName || 'Respondent';

    if (custodyType === 'joint') {
      items.push({
        content: `IT IS ORDERED that the parties shall share joint custody of the minor child(ren). ${domiciliaryParent} is designated as the domiciliary parent. ${nonDomiciliaryParent} is designated as the non-domiciliary parent. (La. C.C. Art. 131 et seq.; La. R.S. 9:335)`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that ${domiciliaryParent} shall have sole custody of the minor child(ren).`,
        type: 'order'
      });
    }

    items.push({
      content: this.getVisitationLanguage(divorceData),
      type: 'order'
    });

    return {
      title: 'CUSTODY',
      items,
      type: 'custody'
    };
  }

  /**
   * Get Louisiana visitation / custodial time language
   * @param {Object} divorceData - Divorce data
   * @returns {string} Visitation language
   */
  getVisitationLanguage(divorceData) {
    return `IT IS ORDERED that the non-domiciliary parent shall have reasonable visitation and custodial time with the minor child(ren) as set forth in the custody implementation plan, or as otherwise agreed by the parties and approved by the Court. (La. R.S. 9:335)`;
  }

  /**
   * Generate Louisiana child support section
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
        content: `IT IS ORDERED that ${obligor} shall pay child support to ${obligee} in the amount of $${divorceData.childSupportAmount} per month, calculated in accordance with the Louisiana Child Support Guidelines, La. R.S. 9:315 et seq.`,
        type: 'order'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that child support shall be paid in accordance with the Louisiana Child Support Guidelines, La. R.S. 9:315 et seq. The parties shall complete a Child Support Obligation Worksheet.`,
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
   * Generate Louisiana spousal support section — "Spousal Support" (interim and final periodic)
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Spousal support section
   */
  generateSpousalSupportSection(divorceData) {
    if (!divorceData.spousalSupportAwarded && !divorceData.spousalSupportWaived) {
      return null;
    }

    const items = [];

    if (divorceData.spousalSupportWaived) {
      items.push({
        content: 'IT IS ORDERED that each party waives and relinquishes any claim for spousal support from the other party, now and forever.',
        type: 'order'
      });
    } else if (divorceData.spousalSupportAwarded) {
      const payor = divorceData.spousalSupportPayor || divorceData.respondentName || 'Respondent';
      const payee = divorceData.spousalSupportPayee || divorceData.petitionerName || 'Petitioner';

      items.push({
        content: `The Court, having considered the factors set forth in Louisiana Civil Code Articles 111 through 113, orders spousal support as follows:`,
        type: 'finding'
      });

      items.push({
        content: `IT IS ORDERED that ${payor} shall pay final periodic spousal support to ${payee} in the amount of $${divorceData.spousalSupportAmount || '[AMOUNT]'} per month for a period of ${divorceData.spousalSupportDuration || '[DURATION]'}, subject to modification upon a material change in circumstances.`,
        type: 'order'
      });
    }

    return {
      title: 'SPOUSAL SUPPORT',
      items,
      type: 'spousal_support'
    };
  }

  /**
   * Generate Louisiana judgment block — signed by Judge of the District Court, Parish of [Parish]
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Judgment block
   */
  generateJudgmentBlock(divorceData) {
    const parish = divorceData.parish || divorceData.county || '[PARISH]';
    return {
      text: `THUS DONE AND SIGNED in open court in the Parish of ${parish}, State of Louisiana, this _____ day of _______________, 20___.



_________________________________
JUDGE
DISTRICT COURT, PARISH OF ${parish.toUpperCase()}
STATE OF LOUISIANA`,
      type: 'judgment'
    };
  }

  /**
   * Perform Louisiana-specific validation
   * Accepts either parish or county field for compatibility
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    const parish = divorceData.parish || divorceData.county;
    if (!parish) {
      errors.push('Parish is required for Louisiana Judgment of Divorce (Louisiana uses parishes, not counties)');
    }

    if (!divorceData.caseNumber) {
      errors.push('Docket number is required for Louisiana divorce judgment');
    }

    const grounds = divorceData.groundsForDivorce || 'article_102';
    if (grounds === 'article_102' || grounds === 'no_fault') {
      if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
        warnings.push('Ensure 365 days have elapsed from service of the Article 102 petition before entering judgment (minor children present).');
      } else {
        warnings.push('Ensure 180 days have elapsed from service of the Article 102 petition before entering judgment.');
      }
    }

    if (divorceData.hasMinorChildren === true && (!divorceData.children || divorceData.children.length === 0)) {
      warnings.push('You indicated there are minor children but did not provide child information.');
    }

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      warnings.push('A completed Child Support Obligation Worksheet must be attached per La. R.S. 9:315 et seq.');
      warnings.push('A custody implementation plan designating the domiciliary parent must be included per La. R.S. 9:335.');
    }

    return { errors, warnings };
  }
}

module.exports = LouisianaDivorceDecreeTemplate;
