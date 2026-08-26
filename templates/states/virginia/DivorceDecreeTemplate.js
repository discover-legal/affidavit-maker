// templates/states/virginia/DivorceDecreeTemplate.js
// Virginia-specific Final Decree of Divorce template
// Complies with Va. Code § 20-91 et seq.

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');
const { resolveCustodyArrangement, resolvePrimaryResidenceName } = require('../../core/parenting');

/**
 * Virginia Final Decree of Divorce Template
 *
 * Legal References:
 * - Va. Code § 20-91 (Grounds for divorce from the bond of matrimony)
 * - Va. Code § 20-107.1 (Spousal support and maintenance)
 * - Va. Code § 20-107.3 (Equitable distribution — marital vs. separate property)
 * - Va. Code § 20-107.4 (Name change upon divorce)
 * - Va. Code § 20-108.2 (Child support guidelines)
 * - Va. Code § 20-124.1 et seq. (Child custody)
 * - Va. Code § 20-97 (Residency requirements)
 *
 * Virginia-Specific Terms:
 * - "FINAL DECREE OF DIVORCE" (Circuit Court equity tradition)
 * - "CASE NO." case number label
 * - "IN THE CIRCUIT COURT OF [COUNTY/CITY], VIRGINIA"
 * - "Complainant" / "Defendant" (equity court tradition)
 * - "Spousal Support and Maintenance" (not "Alimony")
 * - "Legal Custody" / "Physical Custody"
 * - Equitable distribution: separate property vs. marital property distinction
 * - Virginia has independent cities — court is Circuit Court of County or City
 * - No-fault divorce: decree may be entered by Commissioner in Chancery on affidavit
 */
class VirginiaDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'VA';
    this.stateName = 'Virginia';
    this.documentTitle = 'FINAL DECREE OF DIVORCE';

    // Load metadata if available
    try {
      this.metadata = require('./divorce-metadata.json');
    } catch (e) {
      this.metadata = null;
    }

    // Virginia-specific required fields
    this.requiredFields = [
      'petitionerName',
      'respondentName',
      'state',
      'county',
      'caseNumber',
      'marriageDate'
    ];

    // Virginia formatting requirements
    this.formatting = {
      fontSize: '12pt',
      fontFamily: 'Times New Roman',
      lineHeight: '2',
      margin: '1in',
      paperSize: '8.5in x 11in'
    };
  }

  /**
   * Get Virginia case number label — "CASE NO."
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'CASE NO.';
  }

  /**
   * Get default court for Virginia county or independent city
   * @param {string} county - County or independent city name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const jurisdictionName = county || '[COUNTY/CITY]';
    const upper = jurisdictionName.toUpperCase();
    if (upper.startsWith('CITY OF')) {
      return `CIRCUIT COURT OF THE ${upper}`;
    }
    return `CIRCUIT COURT OF ${upper} COUNTY`;
  }

  /**
   * Generate Virginia header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'COMMONWEALTH OF VIRGINIA';
  }

  /**
   * Generate Virginia venue
   * @param {string} county - County or city name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const upper = (county || '[COUNTY]').toUpperCase();
    if (upper.startsWith('CITY OF')) {
      return upper;
    }
    return `COUNTY OF ${upper}`;
  }

  /**
   * Generate Virginia case caption
   * Virginia equity tradition uses Complainant/Defendant
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    let caption = '';

    const courtName = divorceData.court || this.getDefaultCourt(divorceData.county);
    caption += `IN THE ${courtName.toUpperCase()}, VIRGINIA\n\n`;

    const caseNumber = divorceData.caseNumber || '[CASE NUMBER]';
    caption += `CASE NO. ${caseNumber}\n\n`;

    const petitioner = (divorceData.petitionerName || '[COMPLAINANT NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[DEFENDANT NAME]').toUpperCase();

    caption += `${petitioner},\n`;
    caption += `Complainant,\n\n`;
    caption += `v.\n\n`;
    caption += `${respondent},\n`;
    caption += `Defendant.`;

    return {
      courtName,
      caseNumber: divorceData.caseNumber,
      petitioner: divorceData.petitionerName,
      respondent: divorceData.respondentName,
      formatted: caption
    };
  }

  /**
   * Get effective date text for Virginia
   * @returns {string} Effective date text
   */
  getEffectiveDateText() {
    return 'This Final Decree of Divorce is effective upon entry by the Court. The parties are thereby divorced from the bond of matrimony.';
  }

  /**
   * Generate Virginia appearances section
   * Virginia no-fault divorce often proceeds by Commissioner in Chancery affidavit
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Appearances section
   */
  generateAppearancesSection(divorceData) {
    let text = '';

    if (divorceData.isUncontested && divorceData.byAffidavit) {
      text += `This cause came before the Court on the Report of the Commissioner in Chancery and the Affidavit of Complainant, ${divorceData.petitionerName || '[COMPLAINANT]'}, there being no exceptions thereto filed by either party. The Court, having reviewed and considered said Report and Affidavit and being fully advised in the premises,`;
    } else if (divorceData.isUncontested || divorceData.appearanceType === 'agreed') {
      text += `This cause came on for hearing, Complainant, ${divorceData.petitionerName || '[COMPLAINANT]'}, ${divorceData.petitionerRepresentation === 'attorney' ? 'appearing by and through counsel' : 'appearing pro se'},`;
      text += ` Defendant, ${divorceData.respondentName || '[DEFENDANT]'}, ${divorceData.respondentAppeared ? 'appearing and announcing agreement' : 'having been duly served and not appearing'},`;
      text += ` and the Court, having heard the evidence, reviewed the record, and being fully advised in the premises,`;
    } else {
      text += `This cause came on for hearing, Complainant, ${divorceData.petitionerName || '[COMPLAINANT]'}, ${divorceData.petitionerRepresentation === 'attorney' ? 'appearing by and through counsel' : 'appearing pro se'},`;
      text += ` and Defendant, ${divorceData.respondentName || '[DEFENDANT]'}, ${divorceData.respondentAppeared ? 'appearing' : 'although duly served with process, not appearing'},`;
      text += ` and the Court, having heard the evidence, examined the witnesses, reviewed the record, and being fully advised in the premises,`;
    }

    return {
      title: '',
      text,
      type: 'appearances'
    };
  }

  /**
   * Generate Virginia jurisdiction section
   * Must confirm Virginia domicile requirement and separation period
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Jurisdiction section
   */
  generateJurisdictionSection(divorceData) {
    const marriageDate = this.formatDate(divorceData.marriageDate) || '[DATE]';
    const separationDate = this.formatDate(divorceData.separationDate) || '[DATE]';
    const county = divorceData.county || '[COUNTY/CITY]';
    const hasChildren = divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0);
    const hasSeparationAgreement = divorceData.hasSeparationAgreement === true;

    let separationText = '';
    if (!hasChildren && hasSeparationAgreement) {
      separationText = `The parties have lived separate and apart without any cohabitation and without interruption for a period in excess of six (6) months, and there are no minor children born of or adopted during the marriage, and the parties have a written separation agreement, satisfying the requirements of Va. Code § 20-91(9)(a).`;
    } else {
      separationText = `The parties have lived separate and apart without any cohabitation and without interruption for a period in excess of one (1) year, satisfying the requirements of Va. Code § 20-91(9)(b).`;
    }

    return {
      title: 'FINDINGS OF THE COURT',
      text: `The Court finds:\n\n1. The Court has jurisdiction over the subject matter and the parties to this action.\n\n2. At least one of the parties has been domiciled in the Commonwealth of Virginia for more than six (6) months immediately preceding the commencement of this suit, satisfying the requirements of Va. Code § 20-97.\n\n3. The parties were married on ${marriageDate}.\n\n4. The parties last cohabited in ${county}, Virginia.\n\n5. The parties have been living separate and apart since on or about ${separationDate}. ${separationText}\n\n6. There are no meritorious defenses to the entry of this Final Decree of Divorce.`,
      type: 'jurisdiction'
    };
  }

  /**
   * Generate Virginia dissolution section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Dissolution section
   */
  generateDissolutionSection(divorceData) {
    return {
      title: 'ADJUDICATION',
      text: `IT IS ADJUDGED, ORDERED, AND DECREED that ${divorceData.petitionerName || 'Complainant'} and ${divorceData.respondentName || 'Defendant'} be, and hereby are, DIVORCED FROM THE BOND OF MATRIMONY, and each is hereby declared to be an unmarried person, free to marry according to law.`,
      type: 'dissolution'
    };
  }

  /**
   * Generate Virginia property division section
   * Virginia distinguishes marital property, separate property, and hybrid property
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    if (divorceData.propertyResolvedBySeparationAgreement) {
      items.push({
        content: 'The parties have resolved all matters relating to the equitable distribution of marital property pursuant to a written Property Settlement Agreement, which is incorporated herein by reference but not merged into this Decree. Each party retains the property, assets, and accounts specifically assigned to them under that Agreement.',
        type: 'finding'
      });
    } else if (divorceData.hasProperty === false) {
      items.push({
        content: 'The Court finds there is no marital property requiring equitable distribution.',
        type: 'finding'
      });
    } else {
      items.push({
        content: 'The Court, pursuant to Va. Code § 20-107.3, has classified the parties\' property as marital, separate, or hybrid and orders an equitable distribution thereof.',
        type: 'finding'
      });

      items.push({
        content: `IT IS ORDERED that the following property is confirmed and awarded to ${divorceData.petitionerName || 'Complainant'} as that party's sole and separate property:`,
        type: 'order'
      });

      if (divorceData.petitionerProperty && divorceData.petitionerProperty.length > 0) {
        divorceData.petitionerProperty.forEach(prop => {
          items.push({ content: `• ${prop}`, type: 'property_item' });
        });
      } else {
        items.push({
          content: '• All personal property currently in Complainant\'s possession',
          type: 'property_item'
        });
      }

      items.push({
        content: `IT IS ORDERED that the following property is confirmed and awarded to ${divorceData.respondentName || 'Defendant'} as that party's sole and separate property:`,
        type: 'order'
      });

      if (divorceData.respondentProperty && divorceData.respondentProperty.length > 0) {
        divorceData.respondentProperty.forEach(prop => {
          items.push({ content: `• ${prop}`, type: 'property_item' });
        });
      } else {
        items.push({
          content: '• All personal property currently in Defendant\'s possession',
          type: 'property_item'
        });
      }

      items.push({
        content: 'Each party\'s separate property, as defined by Va. Code § 20-107.3(A)(1), is confirmed to that party.',
        type: 'order'
      });
    }

    return {
      title: 'EQUITABLE DISTRIBUTION OF PROPERTY',
      items,
      type: 'property'
    };
  }

  /**
   * Generate Virginia child custody section
   * Uses "Legal Custody" and "Physical Custody" under Va. Code § 20-124.1
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Custody section
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court finds, pursuant to the best interests of the child(ren) standard of Va. Code § 20-124.3, that the following custody and visitation arrangements serve the best interests of the minor child(ren):',
      type: 'finding'
    });

    items.push({
      content: 'The minor child(ren) of this marriage are:',
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
        ? (divorceData.petitionerName || 'Complainant')
        : custody.kind === 'sole_respondent'
          ? (divorceData.respondentName || 'Defendant')
          : (divorceData.primaryCustodian || divorceData.petitionerName || 'Complainant');

    if (custody.kind === 'joint') {
      items.push({
        content: `IT IS ORDERED that the parties shall share Joint Legal Custody of the minor child(ren), and ${primaryParent} shall have primary Physical Custody, pursuant to Va. Code § 20-124.1 et seq.`,
        type: 'order'
      });
    } else if (custody.kind === 'sole_petitioner' || custody.kind === 'sole_respondent' || custody.kind === 'legacy_sole') {
      soleCustodianName = primaryParent;
      items.push({
        content: `IT IS ORDERED that ${primaryParent} shall have Sole Legal Custody and primary Physical Custody of the minor child(ren), pursuant to Va. Code § 20-124.1 et seq.`,
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
      title: 'LEGAL AND PHYSICAL CUSTODY',
      items,
      type: 'custody'
    };
  }

  /**
   * Get Virginia visitation language
   * @param {Object} divorceData - Divorce data
   * @returns {string} Visitation language
   */
  getVisitationLanguage(divorceData) {
    const primaryParent = divorceData.primaryCustodian || divorceData.petitionerName || 'Complainant';
    const otherParent = primaryParent === divorceData.petitionerName
      ? (divorceData.respondentName || 'Defendant')
      : (divorceData.petitionerName || 'Complainant');
    return `IT IS ORDERED that ${otherParent} shall have visitation with the minor child(ren) at such times as the parties shall agree, or as further ordered by the Court.`;
  }

  /**
   * Generate Virginia child support section
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Child support section
   */
  generateChildSupportSection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];
    const obligor = divorceData.childSupportObligor || divorceData.respondentName || 'Defendant';
    const obligee = divorceData.childSupportObligee || divorceData.petitionerName || 'Complainant';

    if (divorceData.childSupportAmount) {
      items.push({
        content: `IT IS ORDERED that ${obligor} shall pay child support to ${obligee} in the amount of $${divorceData.childSupportAmount} per month, calculated pursuant to the Virginia Child Support Guidelines, Va. Code § 20-108.2.`,
        type: 'order'
      });
    } else {
      items.push({
        content: 'IT IS ORDERED that child support shall be determined and paid in accordance with the Virginia Child Support Guidelines, Va. Code § 20-108.2.',
        type: 'order'
      });
    }

    items.push({
      content: 'IT IS ORDERED that an order for income withholding shall be entered for enforcement of the child support obligation.',
      type: 'order'
    });

    items.push({
      content: `IT IS ORDERED that ${obligor} shall maintain health insurance coverage for the minor child(ren) if available at a reasonable cost through an employer or group plan.`,
      type: 'order'
    });

    return {
      title: 'CHILD SUPPORT',
      items,
      type: 'child_support'
    };
  }

  /**
   * Generate Virginia spousal support section
   * Virginia uses "Spousal Support and Maintenance" not "Alimony"
   * Adultery by the payee-party bars spousal support (Va. Code § 20-107.1)
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
        content: 'Each party expressly waives any and all rights to spousal support and maintenance from the other party, now and forever, pursuant to Va. Code § 20-107.1.',
        type: 'order'
      });
    } else if (divorceData.spousalSupportAwarded) {
      const payor = divorceData.spousalSupportPayor || divorceData.respondentName || 'Defendant';
      const payee = divorceData.spousalSupportPayee || divorceData.petitionerName || 'Complainant';

      items.push({
        content: `The Court, having considered the factors set forth in Va. Code § 20-107.1, orders spousal support and maintenance as follows:`,
        type: 'finding'
      });

      items.push({
        content: `IT IS ORDERED that ${payor} shall pay spousal support and maintenance to ${payee} in the amount of $${divorceData.spousalSupportAmount || '[AMOUNT]'} per month${divorceData.spousalSupportStartDate ? `, beginning ${this.formatDate(divorceData.spousalSupportStartDate)}` : ''}.`,
        type: 'order'
      });

      if (divorceData.spousalSupportDuration) {
        items.push({
          content: `This spousal support obligation shall continue for ${divorceData.spousalSupportDuration}, or until further order of the Court.`,
          type: 'order'
        });
      }

      items.push({
        content: 'This spousal support award shall terminate upon the death of either party, the remarriage of the receiving party, or upon such further order of the Court as may be appropriate.',
        type: 'order'
      });
    }

    return {
      title: 'SPOUSAL SUPPORT AND MAINTENANCE',
      items,
      type: 'spousal_support'
    };
  }

  /**
   * Generate Virginia name change section
   * Va. Code § 20-107.4 authorizes name change as part of divorce decree
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Name change section
   */
  generateNameChangeSection(divorceData) {
    if (!divorceData.requestNameChange || !divorceData.previousName) {
      return null;
    }

    const person = divorceData.nameChangeParty || divorceData.petitionerName || 'Complainant';
    return {
      title: 'RESTORATION OF FORMER NAME',
      text: `IT IS ORDERED that ${person} is hereby authorized to resume use of the former name ${divorceData.previousName}, pursuant to Va. Code § 20-107.4. This Court expressly authorizes the change of name from the name used during the marriage to the former name stated above.`,
      type: 'name_change'
    };
  }

  /**
   * Generate Virginia final orders section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Final orders section
   */
  generateFinalOrdersSection(divorceData) {
    const items = [];

    items.push({
      content: 'IT IS FURTHER ORDERED that all other relief not specifically granted herein is denied.',
      type: 'order'
    });

    items.push({
      content: 'IT IS FURTHER ORDERED that each party shall execute and deliver any deeds, assignments, or other instruments necessary to effectuate the terms of this Decree.',
      type: 'order'
    });

    items.push({
      content: 'IT IS FURTHER ORDERED that each party shall be responsible for their own attorney fees and costs, unless otherwise specifically ordered.',
      type: 'order'
    });

    items.push({
      content: 'The Court retains jurisdiction to enforce and, where appropriate, modify the provisions of this Decree.',
      type: 'order'
    });

    return {
      title: 'MISCELLANEOUS PROVISIONS',
      items,
      type: 'final_orders'
    };
  }

  /**
   * Generate Virginia judgment block (judge signature)
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Judgment block
   */
  generateJudgmentBlock(divorceData) {
    const courtName = divorceData.court || this.getDefaultCourt(divorceData.county);
    return {
      text: `ENTERED this _____ day of _______________, 20___.


_________________________________
JUDGE, ${courtName.toUpperCase()}
COMMONWEALTH OF VIRGINIA

${divorceData.judgeName ? divorceData.judgeName.toUpperCase() : ''}`,
      type: 'judgment'
    };
  }

  /**
   * Perform Virginia-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County or independent city is required for Virginia Final Decree of Divorce');
    }

    if (!divorceData.caseNumber) {
      errors.push('Case number is required for Virginia Final Decree of Divorce');
    }

    // Warn about independent cities
    if (divorceData.county && !divorceData.county.toUpperCase().startsWith('CITY OF')) {
      warnings.push('Virginia has independent cities not within any county (e.g., Richmond, Alexandria, Virginia Beach). If the suit was filed in an independent city, the county field should read "City of [Name]".');
    }

    // Separation period check for no-fault
    if (divorceData.separationDate) {
      const separationDate = new Date(divorceData.separationDate);
      const hasChildren = divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0);
      const hasSeparationAgreement = divorceData.hasSeparationAgreement === true;
      const now = new Date();

      if (!hasChildren && hasSeparationAgreement) {
        const sixMonthsAgo = new Date(now);
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        if (separationDate > sixMonthsAgo) {
          errors.push('The 6-month separation requirement has not been met (Va. Code § 20-91(9)(a)). The parties have not been separated for 6 months based on the provided separation date.');
        }
      } else {
        const oneYearAgo = new Date(now);
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        if (separationDate > oneYearAgo) {
          errors.push('The 1-year separation requirement has not been met (Va. Code § 20-91(9)(b)). The parties have not been separated for one full year based on the provided separation date.');
        }
      }
    }

    // Adultery and spousal support warning
    if (divorceData.groundsForDivorce === 'adultery' && divorceData.spousalSupportAwarded) {
      warnings.push('Note: Under Va. Code § 20-107.1, a party who commits adultery is generally barred from receiving spousal support. Verify that the adultery ground does not bar the spousal support award.');
    }

    warnings.push('Virginia no-fault divorce decrees may be entered by a Commissioner in Chancery based on the Complainant\'s sworn affidavit, without a formal hearing, if the divorce is uncontested.');

    return { errors, warnings };
  }
}

module.exports = VirginiaDecreeTemplate;
