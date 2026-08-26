// templates/states/pennsylvania/DivorceDecreeTemplate.js
// Pennsylvania-specific Decree in Divorce template
// Complies with 23 Pa.C.S. § 3101 et seq. (Pennsylvania Divorce Code)

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');
const { resolveCustodyArrangement, resolvePrimaryResidenceName } = require('../../core/parenting');

/**
 * Pennsylvania Decree in Divorce Template
 *
 * Legal References:
 * - 23 Pa.C.S. § 3323 (Decree of court — requirements)
 * - 23 Pa.C.S. § 3301 (Grounds — no-fault and fault-based)
 * - 23 Pa.C.S. § 3502 (Equitable distribution of marital property)
 * - 23 Pa.C.S. § 3503 (Classification of property as marital or non-marital)
 * - 23 Pa.C.S. § 3701 (Alimony)
 * - 23 Pa.C.S. § 3702 (Alimony Pendente Lite)
 * - 23 Pa.C.S. § 3321 (Decree nisi — automatic final after 20 days)
 * - 23 Pa.C.S. § 4322 (Child support guidelines)
 * - 23 Pa.C.S. § 5321 et seq. (Child custody)
 *
 * Pennsylvania-Specific Terms:
 * - "Decree in Divorce" rather than "Final Decree of Divorce"
 * - "DOCKET NO." case number label
 * - Court of Common Pleas of [County] County
 * - "Plaintiff" / "Defendant" (not Petitioner/Respondent)
 * - "Alimony" and "Alimony Pendente Lite"
 * - "Legal Custody" / "Physical Custody"
 * - Equitable distribution state — not community property
 */
class PennsylvaniaDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'PA';
    this.stateName = 'Pennsylvania';
    this.documentTitle = 'DECREE IN DIVORCE';

    // Load metadata if available
    try {
      this.metadata = require('./divorce-metadata.json');
    } catch (e) {
      this.metadata = null;
    }

    // Pennsylvania-specific required fields
    this.requiredFields = [
      'petitionerName',
      'respondentName',
      'state',
      'county',
      'caseNumber',
      'marriageDate'
    ];

    // Pennsylvania formatting requirements
    this.formatting = {
      fontSize: '12pt',
      fontFamily: 'Times New Roman',
      lineHeight: '2',
      margin: '1in',
      paperSize: '8.5in x 11in'
    };
  }

  /**
   * Get Pennsylvania case number label — "DOCKET NO."
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'DOCKET NO.';
  }

  /**
   * Get default court for Pennsylvania county
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyName = (county || '[COUNTY]').toUpperCase();
    return `COURT OF COMMON PLEAS OF ${countyName} COUNTY`;
  }

  /**
   * Generate Pennsylvania header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'COMMONWEALTH OF PENNSYLVANIA';
  }

  /**
   * Generate Pennsylvania venue
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyUpper = (county || '[COUNTY]').toUpperCase();
    return `COUNTY OF ${countyUpper}`;
  }

  /**
   * Generate Pennsylvania case caption
   * Pennsylvania uses Plaintiff/Defendant in divorce
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    let caption = '';

    const countyUpper = (divorceData.county || '[COUNTY]').toUpperCase();
    caption += `IN THE COURT OF COMMON PLEAS OF ${countyUpper} COUNTY, PENNSYLVANIA\n\n`;

    // Pennsylvania uses DOCKET NO.
    const caseNumber = divorceData.caseNumber || '[CASE NUMBER]';
    caption += `DOCKET NO. ${caseNumber}\n\n`;

    // Pennsylvania uses Plaintiff/Defendant
    const petitioner = (divorceData.petitionerName || '[PLAINTIFF NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[DEFENDANT NAME]').toUpperCase();

    caption += `${petitioner},\n`;
    caption += `Plaintiff,\n\n`;
    caption += `v.\n\n`;
    caption += `${respondent},\n`;
    caption += `Defendant.`;

    return {
      courtName: this.getDefaultCourt(divorceData.county),
      caseNumber: divorceData.caseNumber,
      petitioner: divorceData.petitionerName,
      respondent: divorceData.respondentName,
      formatted: caption
    };
  }

  /**
   * Get effective date text for Pennsylvania
   * @returns {string} Effective date text
   */
  getEffectiveDateText() {
    return 'This Decree in Divorce shall become final upon entry by the Court. Pursuant to 23 Pa.C.S. § 3323, this decree resolves the bonds of matrimony between the parties.';
  }

  /**
   * Generate Pennsylvania appearances section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Appearances section
   */
  generateAppearancesSection(divorceData) {
    let text = '';

    if (divorceData.isUncontested || divorceData.appearanceType === 'agreed') {
      text += `AND NOW, this cause coming before the Court, Plaintiff, ${divorceData.petitionerName || '[PLAINTIFF]'}, ${divorceData.petitionerRepresentation === 'attorney' ? 'by and through counsel' : 'pro se'},`;
      text += ` and the Court having considered the Affidavit(s) of Consent and the record in this matter, and being fully advised in the premises;`;
    } else {
      text += `AND NOW, this cause coming before the Court for hearing, Plaintiff, ${divorceData.petitionerName || '[PLAINTIFF]'}, ${divorceData.petitionerRepresentation === 'attorney' ? 'appearing by and through counsel' : 'appearing pro se'},`;
      text += ` and Defendant, ${divorceData.respondentName || '[DEFENDANT]'}, ${divorceData.respondentAppeared ? 'appearing' : 'having been duly served but failing to appear'},`;
      text += ` and the Court having heard all testimony, reviewed the record, and considered the applicable law;`;
    }

    return {
      title: '',
      text,
      type: 'appearances'
    };
  }

  /**
   * Generate Pennsylvania jurisdiction section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Jurisdiction section
   */
  generateJurisdictionSection(divorceData) {
    return {
      title: 'FINDINGS',
      text: `The Court finds that it has jurisdiction over the parties and the subject matter of this action. At least one party has been a bona fide resident of the Commonwealth of Pennsylvania for a period in excess of six (6) months immediately preceding this action, as required by 23 Pa.C.S. § 3104. The parties were married on ${this.formatDate(divorceData.marriageDate) || '[DATE]'}${divorceData.separationDate ? ` and have been living separate and apart since ${this.formatDate(divorceData.separationDate)}` : ''}.`,
      type: 'jurisdiction'
    };
  }

  /**
   * Generate Pennsylvania dissolution section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Dissolution section
   */
  generateDissolutionSection(divorceData) {
    // Determine the Pennsylvania statutory ground (23 Pa.C.S. § 3301).
    // § 3301(c) — mutual consent (both parties file Affidavits of Consent after 90-day wait from service).
    // § 3301(d) — irretrievable breakdown with 1-year separation (as amended December 2016).
    let groundClause;
    if (divorceData.divorceGround === 'mutual_consent' || divorceData.isUncontested) {
      groundClause = 'pursuant to 23 Pa.C.S. § 3301(c) (mutual consent), both parties having filed Affidavits of Consent after the expiration of the ninety (90) day waiting period from the date of service of the divorce complaint,';
    } else {
      groundClause = 'pursuant to 23 Pa.C.S. § 3301(d) (irretrievable breakdown), the parties having been living separate and apart for a period in excess of one (1) year,';
    }

    return {
      title: 'DECREE',
      text: `IT IS HEREBY ORDERED AND DECREED that the bonds of matrimony existing between ${divorceData.petitionerName || 'Plaintiff'} and ${divorceData.respondentName || 'Defendant'} are hereby dissolved ${groundClause} and both parties are restored to the status of unmarried persons. This Decree in Divorce is granted pursuant to 23 Pa.C.S. § 3323.`,
      type: 'dissolution'
    };
  }

  /**
   * Generate Pennsylvania equitable distribution section
   * Pennsylvania classifies property as marital or non-marital (23 Pa.C.S. § 3503)
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    items.push({
      content: 'The Court, pursuant to 23 Pa.C.S. § 3502, has made an equitable distribution of the marital property of the parties, having due regard for the rights of each party and the factors set forth in Section 3502.',
      type: 'finding'
    });

    if (divorceData.hasProperty === false) {
      items.push({
        content: 'The Court finds there is no marital property requiring distribution.',
        type: 'finding'
      });
    } else {
      items.push({
        content: `IT IS ORDERED that the following property is awarded to ${divorceData.petitionerName || 'Plaintiff'} as that party's sole and separate property:`,
        type: 'order'
      });

      if (divorceData.petitionerProperty && divorceData.petitionerProperty.length > 0) {
        divorceData.petitionerProperty.forEach(prop => {
          items.push({ content: `• ${prop}`, type: 'property_item' });
        });
      } else {
        items.push({
          content: '• All personal property currently in Plaintiff\'s possession and control',
          type: 'property_item'
        });
      }

      items.push({
        content: `IT IS ORDERED that the following property is awarded to ${divorceData.respondentName || 'Defendant'} as that party's sole and separate property:`,
        type: 'order'
      });

      if (divorceData.respondentProperty && divorceData.respondentProperty.length > 0) {
        divorceData.respondentProperty.forEach(prop => {
          items.push({ content: `• ${prop}`, type: 'property_item' });
        });
      } else {
        items.push({
          content: '• All personal property currently in Defendant\'s possession and control',
          type: 'property_item'
        });
      }

      items.push({
        content: 'Each party\'s non-marital property, as defined by 23 Pa.C.S. § 3501, is confirmed to that party.',
        type: 'order'
      });
    }

    return {
      title: 'EQUITABLE DISTRIBUTION OF MARITAL PROPERTY',
      items,
      type: 'property'
    };
  }

  /**
   * Generate Pennsylvania custody section
   * Uses "Legal Custody" and "Physical Custody" terminology
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Custody section
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court finds that the following orders regarding Legal Custody and Physical Custody are in the best interests of the minor child(ren), pursuant to 23 Pa.C.S. § 5328.',
      type: 'finding'
    });

    items.push({
      content: 'The minor child(ren) of the marriage are:',
      type: 'order'
    });

    divorceData.children.forEach((child, index) => {
      const childName = typeof child === 'string' ? child : (child.name || '[CHILD NAME]');
      const birthDate = typeof child === 'object' ? this.formatDate(child.birthDate ?? child.dob ?? child.dateOfBirth) : null;
      items.push({
        content: birthDate
          ? `${index + 1}. ${childName}, born ${birthDate}`
          : `${index + 1}. ${childName}`,
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
        ? (divorceData.petitionerName || 'Plaintiff')
        : custody.kind === 'sole_respondent'
          ? (divorceData.respondentName || 'Defendant')
          : (divorceData.primaryCustodian || divorceData.petitionerName || 'Plaintiff');
    const otherParent = primaryParent === divorceData.petitionerName
      ? (divorceData.respondentName || 'Defendant')
      : (divorceData.petitionerName || 'Plaintiff');

    if (custody.kind === 'joint') {
      items.push({
        content: `IT IS ORDERED that the parties shall share Joint Legal Custody of the minor child(ren). ${primaryParent} shall have primary Physical Custody.`,
        type: 'order'
      });
    } else if (custody.kind === 'sole_petitioner' || custody.kind === 'sole_respondent' || custody.kind === 'legacy_sole') {
      soleCustodianName = primaryParent;
      items.push({
        content: `IT IS ORDERED that ${primaryParent} shall have Sole Legal Custody and primary Physical Custody of the minor child(ren).`,
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
      title: 'CUSTODY OF CHILD(REN)',
      items,
      type: 'custody'
    };
  }

  /**
   * Get Pennsylvania partial physical custody (visitation) language
   * @param {Object} divorceData - Divorce data
   * @returns {string} Visitation language
   */
  getVisitationLanguage(divorceData) {
    const otherParent = divorceData.primaryCustodian === divorceData.petitionerName
      ? (divorceData.respondentName || 'Defendant')
      : (divorceData.petitionerName || 'Plaintiff');
    return `IT IS ORDERED that ${otherParent} shall have partial physical custody and/or supervised physical custody at times as the parties may agree or as the Court may further order.`;
  }

  /**
   * Generate Pennsylvania child support section
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
        content: `IT IS ORDERED that ${obligor} shall pay child support to ${obligee} in the amount of $${divorceData.childSupportAmount} per month, calculated pursuant to the Pennsylvania Child Support Guidelines, 23 Pa.C.S. § 4322.`,
        type: 'order'
      });
    } else {
      items.push({
        content: 'IT IS ORDERED that child support shall be determined and paid in accordance with the Pennsylvania Child Support Guidelines, 23 Pa.C.S. § 4322.',
        type: 'order'
      });
    }

    items.push({
      content: 'IT IS ORDERED that an income withholding order shall be entered for the collection of child support.',
      type: 'order'
    });

    items.push({
      content: `IT IS ORDERED that ${obligor} shall maintain medical insurance coverage for the minor child(ren) if available at a reasonable cost through an employer or group plan.`,
      type: 'order'
    });

    return {
      title: 'CHILD SUPPORT',
      items,
      type: 'child_support'
    };
  }

  /**
   * Generate Pennsylvania alimony section
   * Pennsylvania has both Alimony and Alimony Pendente Lite
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
        content: 'Each party expressly waives any and all rights to alimony from the other party, now and forever. This waiver is incorporated into this Decree and shall be binding.',
        type: 'order'
      });
    } else if (divorceData.spousalSupportAwarded) {
      const payor = divorceData.spousalSupportPayor || divorceData.respondentName || 'Defendant';
      const payee = divorceData.spousalSupportPayee || divorceData.petitionerName || 'Plaintiff';

      items.push({
        content: `The Court, having considered the factors set forth in 23 Pa.C.S. § 3701, orders alimony as follows:`,
        type: 'finding'
      });

      items.push({
        content: `IT IS ORDERED that ${payor} shall pay alimony to ${payee} in the amount of $${divorceData.spousalSupportAmount || '[AMOUNT]'} per month for ${divorceData.spousalSupportDuration || 'a period to be determined'}.`,
        type: 'order'
      });

      items.push({
        content: 'This alimony award is subject to modification or termination upon a material and substantial change in circumstances, or upon the death or remarriage of the receiving party.',
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
   * Generate Pennsylvania name change section
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Name change section
   */
  generateNameChangeSection(divorceData) {
    if (!divorceData.requestNameChange || !divorceData.previousName) {
      return null;
    }

    const person = divorceData.nameChangeParty || divorceData.petitionerName || 'Plaintiff';
    return {
      title: 'RESTORATION OF FORMER NAME',
      text: `IT IS ORDERED that the former name of ${person} is hereby restored to: ${divorceData.previousName}.`,
      type: 'name_change'
    };
  }

  /**
   * Generate Pennsylvania final orders section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Final orders section
   */
  generateFinalOrdersSection(divorceData) {
    const items = [];

    items.push({
      content: 'IT IS FURTHER ORDERED that all relief requested and not expressly granted herein is denied.',
      type: 'order'
    });

    items.push({
      content: 'IT IS FURTHER ORDERED that each party shall execute and deliver any documents and instruments necessary to effectuate the terms of this Decree.',
      type: 'order'
    });

    items.push({
      content: 'IT IS FURTHER ORDERED that each party shall be responsible for their own attorney fees and costs, unless otherwise specifically ordered by the Court.',
      type: 'order'
    });

    items.push({
      content: 'This Court retains jurisdiction to enforce and, where appropriate, modify the provisions of this Decree.',
      type: 'order'
    });

    return {
      title: 'MISCELLANEOUS PROVISIONS',
      items,
      type: 'final_orders'
    };
  }

  /**
   * Generate Pennsylvania judgment block (judge signature)
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Judgment block
   */
  generateJudgmentBlock(divorceData) {
    const countyUpper = divorceData.county ? divorceData.county.toUpperCase() : '[COUNTY]';
    return {
      text: `BY THE COURT:

ENTERED this _____ day of _______________, 20___.


_________________________________
JUDGE OF THE COURT OF COMMON PLEAS
${countyUpper} COUNTY, PENNSYLVANIA

${divorceData.judgeName ? divorceData.judgeName.toUpperCase() : ''}`,
      type: 'judgment'
    };
  }

  /**
   * Perform Pennsylvania-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for Pennsylvania Decree in Divorce');
    }

    if (!divorceData.caseNumber) {
      errors.push('Docket number is required for Pennsylvania Decree in Divorce');
    }

    if (divorceData.hasMinorChildren === true && divorceData.children && divorceData.children.length > 0) {
      warnings.push('Pennsylvania requires a Parenting Plan or custody order when minor children are involved.');
    }

    warnings.push('Pennsylvania Decree in Divorce becomes effective upon entry. If proceeding by mutual consent under § 3301(c), ensure both Affidavits of Consent were filed after the 90-day waiting period from service. If proceeding under the 1-year separation ground (§ 3301(d), as amended December 2016), confirm parties have been separated for at least one full year.');

    // Pa. R.C.P. 1920.51: contested equitable distribution requires a hearing before a master
    // or a judge; parties must be notified of their right to a hearing before a master.
    if (divorceData.hasProperty !== false) {
      warnings.push('When equitable distribution is contested, Pennsylvania Rules of Civil Procedure Rule 1920.51 requires a hearing before a master or judge. Ensure an equitable distribution conference or master\'s hearing has been scheduled or waived before entry of this Decree.');
    }

    return { errors, warnings };
  }
}

module.exports = PennsylvaniaDecreeTemplate;
