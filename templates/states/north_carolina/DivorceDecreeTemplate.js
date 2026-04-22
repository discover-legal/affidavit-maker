// templates/states/north_carolina/DivorceDecreeTemplate.js
// North Carolina-specific Judgment of Absolute Divorce template
// Complies with N.C.G.S. § 50-1 et seq.

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');

/**
 * North Carolina Judgment of Absolute Divorce Template
 *
 * Legal References:
 * - N.C.G.S. § 50-6 (Grounds — one-year separation)
 * - N.C.G.S. § 50-11 (Effect of judgment of absolute divorce)
 * - N.C.G.S. § 50-20 (Equitable distribution — must be resolved separately)
 * - N.C.G.S. § 50-13.1 (Child custody)
 * - N.C.G.S. § 50-13.4 (Child support)
 * - N.C.G.S. § 50-16.1A (Alimony)
 * - N.C.G.S. § 50-16.2A (Post-separation support)
 *
 * North Carolina-Specific Terms:
 * - "JUDGMENT OF ABSOLUTE DIVORCE" rather than "Final Decree of Divorce"
 * - "FILE NO." case number label
 * - General Court of Justice, District Court Division
 * - "Plaintiff" / "Defendant" (not Petitioner/Respondent)
 * - CRITICAL: Equitable distribution, alimony, and custody are SEPARATE proceedings
 *   and must have been claimed before the divorce judgment was entered or the right is waived
 * - The divorce judgment itself dissolves the marriage ONLY
 */
class NorthCarolinaDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'NC';
    this.stateName = 'North Carolina';
    this.documentTitle = 'JUDGMENT OF ABSOLUTE DIVORCE';

    // Load metadata if available
    try {
      this.metadata = require('./divorce-metadata.json');
    } catch (e) {
      this.metadata = null;
    }

    // North Carolina-specific required fields
    this.requiredFields = [
      'petitionerName',
      'respondentName',
      'state',
      'county',
      'caseNumber',
      'marriageDate',
      'separationDate' // Required — one-year separation is the ground
    ];

    // North Carolina formatting requirements
    this.formatting = {
      fontSize: '12pt',
      fontFamily: 'Times New Roman',
      lineHeight: '2',
      margin: '1in',
      paperSize: '8.5in x 11in'
    };
  }

  /**
   * Get North Carolina case number label — "FILE NO."
   * @returns {string} Case number label
   */
  getCaseNumberLabel() {
    return 'FILE NO.';
  }

  /**
   * Get default court for North Carolina county
   * @param {string} county - County name
   * @returns {string} Court name
   */
  getDefaultCourt(county) {
    const countyUpper = (county || '[COUNTY]').toUpperCase();
    return `GENERAL COURT OF JUSTICE, DISTRICT COURT DIVISION, ${countyUpper} COUNTY`;
  }

  /**
   * Generate North Carolina header
   * @returns {string} Header text
   */
  generateHeader() {
    return 'STATE OF NORTH CAROLINA';
  }

  /**
   * Generate North Carolina venue
   * @param {string} county - County name
   * @returns {string} Venue text
   */
  generateVenue(county) {
    const countyUpper = (county || '[COUNTY]').toUpperCase();
    return `${countyUpper} COUNTY`;
  }

  /**
   * Generate North Carolina case caption
   * NC uses Plaintiff/Defendant in divorce matters
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Case caption
   */
  generateCaseCaption(divorceData) {
    let caption = '';

    const countyUpper = (divorceData.county || '[COUNTY]').toUpperCase();
    caption += `STATE OF NORTH CAROLINA\n`;
    caption += `IN THE GENERAL COURT OF JUSTICE\n`;
    caption += `DISTRICT COURT DIVISION\n`;
    caption += `${countyUpper} COUNTY\n\n`;

    const caseNumber = divorceData.caseNumber || '[CASE NUMBER]';
    caption += `FILE NO. ${caseNumber}\n\n`;

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
   * Get effective date text for North Carolina
   * @returns {string} Effective date text
   */
  getEffectiveDateText() {
    return 'This Judgment of Absolute Divorce is effective upon entry by the Court and dissolves the bonds of matrimony between the parties. All other claims (equitable distribution, alimony, custody) must be addressed in separate proceedings if not already resolved.';
  }

  /**
   * Generate North Carolina appearances section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Appearances section
   */
  generateAppearancesSection(divorceData) {
    let text = '';

    text += `This cause came on for hearing on ${this.formatDate(divorceData.hearingDate) || '___________________'},`;

    if (divorceData.isUncontested || !divorceData.respondentAppeared) {
      text += ` Plaintiff, ${divorceData.petitionerName || '[PLAINTIFF]'}, ${divorceData.petitionerRepresentation === 'attorney' ? 'by and through counsel' : 'appearing pro se'},`;
      text += ` Defendant having been duly served and not appearing,`;
    } else {
      text += ` Plaintiff, ${divorceData.petitionerName || '[PLAINTIFF]'}, ${divorceData.petitionerRepresentation === 'attorney' ? 'by and through counsel' : 'appearing pro se'},`;
      text += ` and Defendant, ${divorceData.respondentName || '[DEFENDANT]'}, ${divorceData.respondentRepresentation === 'attorney' ? 'by and through counsel' : 'appearing pro se'},`;
    }

    text += ` and the Court having heard the evidence and the testimony of the Plaintiff, and being fully advised in the premises:`;

    return {
      title: '',
      text,
      type: 'appearances'
    };
  }

  /**
   * Generate North Carolina jurisdiction section
   * Must confirm one-year separation under § 50-6
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Jurisdiction section
   */
  generateJurisdictionSection(divorceData) {
    const separationDate = this.formatDate(divorceData.separationDate) || '[DATE]';
    const marriageDate = this.formatDate(divorceData.marriageDate) || '[DATE]';
    const county = divorceData.county || '[COUNTY]';

    return {
      title: 'FINDINGS OF FACT',
      text: `1. The Court has jurisdiction over the subject matter and the parties to this action.\n\n2. Plaintiff has been a resident of the State of North Carolina for at least six (6) months immediately preceding the filing of this action, as required by N.C.G.S. § 50-8.\n\n3. The parties were married on ${marriageDate}.\n\n4. The parties have lived separate and apart without cohabitation since on or about ${separationDate}, a period in excess of one (1) year, with at least one party intending the separation to be permanent. The parties have not resumed cohabitation. These facts establish grounds for absolute divorce pursuant to N.C.G.S. § 50-6.\n\n5. Venue is proper in ${county} County, North Carolina.`,
      type: 'jurisdiction'
    };
  }

  /**
   * Generate North Carolina dissolution section
   * NC divorce judgment dissolves the marriage ONLY — other issues are separate
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Dissolution section
   */
  generateDissolutionSection(divorceData) {
    return {
      title: 'CONCLUSIONS OF LAW AND JUDGMENT',
      text: `Based upon the foregoing findings of fact, the Court concludes that the parties are entitled to an absolute divorce.\n\nIT IS THEREFORE ORDERED, ADJUDGED, AND DECREED that the bonds of matrimony heretofore existing between ${divorceData.petitionerName || 'Plaintiff'} and ${divorceData.respondentName || 'Defendant'} are hereby dissolved, and the parties are restored to the status of unmarried persons.\n\nThis judgment does not adjudicate any rights to equitable distribution, alimony, or custody. Those matters must be addressed in separate proceedings if not already resolved. Claims for equitable distribution not raised prior to or simultaneously with this action are permanently waived. (N.C.G.S. § 50-20(k)). Claims for alimony and post-separation support not raised prior to or at the time of entry of this judgment are permanently barred. (N.C.G.S. § 50-11(e))`,
      type: 'dissolution'
    };
  }

  /**
   * Generate North Carolina property division section
   * CRITICAL: NC divorce judgment does NOT automatically divide property
   * The equitable distribution claim must be a separate proceeding
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Property division section
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    if (divorceData.propertyResolvedBySeparationAgreement) {
      items.push({
        content: 'The parties have resolved all matters relating to the division of marital property by written separation agreement, which is incorporated herein by reference but not merged into this Judgment.',
        type: 'finding'
      });
    } else if (divorceData.hasProperty === false) {
      items.push({
        content: 'The Court finds there is no marital property requiring distribution.',
        type: 'finding'
      });
    } else {
      items.push({
        content: 'NOTE: A claim for equitable distribution of marital property was asserted in this action. This Judgment of Absolute Divorce does not resolve the equitable distribution claim, which remains pending before the Court as a separate matter pursuant to N.C.G.S. § 50-20.',
        type: 'finding'
      });

      if (divorceData.petitionerProperty || divorceData.respondentProperty) {
        items.push({
          content: 'IT IS ORDERED that each party shall retain possession of personal property currently in their respective possession pending final resolution of equitable distribution.',
          type: 'order'
        });
      }
    }

    return {
      title: 'PROPERTY',
      items,
      type: 'property'
    };
  }

  /**
   * Generate North Carolina debt allocation section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Debt allocation section
   */
  generateDebtAllocationSection(divorceData) {
    const items = [];

    items.push({
      content: 'Debt allocation, if contested, shall be resolved in the equitable distribution proceeding. Each party is responsible for debts solely in their name pending further order of the Court.',
      type: 'order'
    });

    return {
      title: 'DEBTS',
      items,
      type: 'debts'
    };
  }

  /**
   * Generate North Carolina custody section
   * NC custody is a SEPARATE proceeding from the divorce
   * @param {Object} divorceData - Divorce data
   * @returns {Object|null} Custody section
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The parties have minor children. Child custody and visitation have been or will be addressed by separate order of the Court pursuant to N.C.G.S. § 50-13.1 et seq.',
      type: 'finding'
    });

    if (divorceData.custodyResolvedBySeparationAgreement) {
      items.push({
        content: 'The parties have resolved custody and visitation by written agreement, which is incorporated herein by reference.',
        type: 'order'
      });
    } else if (divorceData.custodyType) {
      const primaryParent = divorceData.primaryCustodian || divorceData.petitionerName || 'Plaintiff';

      if (divorceData.custodyType === 'joint') {
        items.push({
          content: `IT IS ORDERED that the parties shall share joint legal custody of the minor child(ren). ${primaryParent} shall have primary physical custody, subject to the other parent's visitation rights.`,
          type: 'order'
        });
      } else {
        items.push({
          content: `IT IS ORDERED that ${primaryParent} shall have primary legal and physical custody of the minor child(ren).`,
          type: 'order'
        });
      }

      items.push({
        content: this.getVisitationLanguage(divorceData),
        type: 'order'
      });
    }

    return {
      title: 'CUSTODY AND VISITATION OF CHILD(REN)',
      items,
      type: 'custody'
    };
  }

  /**
   * Get North Carolina visitation language
   * @param {Object} divorceData - Divorce data
   * @returns {string} Visitation language
   */
  getVisitationLanguage(divorceData) {
    const primaryParent = divorceData.primaryCustodian || divorceData.petitionerName || 'Plaintiff';
    const otherParent = primaryParent === divorceData.petitionerName
      ? (divorceData.respondentName || 'Defendant')
      : (divorceData.petitionerName || 'Plaintiff');
    return `IT IS ORDERED that ${otherParent} shall have secondary physical custody and visitation rights with the minor child(ren) at such times as the parties shall agree or as further ordered by the Court.`;
  }

  /**
   * Generate North Carolina child support section
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
        content: `IT IS ORDERED that ${obligor} shall pay child support to ${obligee} in the amount of $${divorceData.childSupportAmount} per month, pursuant to the North Carolina Child Support Guidelines, N.C.G.S. § 50-13.4.`,
        type: 'order'
      });
    } else {
      items.push({
        content: 'IT IS ORDERED that child support shall be determined and paid in accordance with the North Carolina Child Support Guidelines, N.C.G.S. § 50-13.4, pursuant to separate order of the Court.',
        type: 'order'
      });
    }

    items.push({
      content: `IT IS ORDERED that ${obligor} shall maintain health insurance for the minor child(ren) if available at a reasonable cost.`,
      type: 'order'
    });

    return {
      title: 'CHILD SUPPORT',
      items,
      type: 'child_support'
    };
  }

  /**
   * Generate North Carolina alimony/post-separation support section
   * Alimony is a SEPARATE proceeding and must have been claimed before divorce judgment
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
        content: 'Each party expressly waives any claim for alimony and post-separation support from the other party, now and forever. This waiver is made voluntarily and constitutes a full and final settlement of any claim for support.',
        type: 'order'
      });
    } else if (divorceData.spousalSupportAwarded) {
      const payor = divorceData.spousalSupportPayor || divorceData.respondentName || 'Defendant';
      const payee = divorceData.spousalSupportPayee || divorceData.petitionerName || 'Plaintiff';

      items.push({
        content: `The Court, having found that ${payee} is a dependent spouse and that ${payor} is a supporting spouse as defined by N.C.G.S. § 50-16.1A, and having considered the factors set forth in N.C.G.S. § 50-16.3A(b), orders alimony as follows:`,
        type: 'finding'
      });

      items.push({
        content: `IT IS ORDERED that ${payor} shall pay alimony to ${payee} in the amount of $${divorceData.spousalSupportAmount || '[AMOUNT]'} per month${divorceData.spousalSupportDuration ? ` for ${divorceData.spousalSupportDuration}` : ''}, pursuant to N.C.G.S. § 50-16.3A.`,
        type: 'order'
      });

      items.push({
        content: 'This alimony award shall terminate upon the death of either party, the remarriage of the receiving party, or upon cohabitation by the receiving party in accordance with N.C.G.S. § 50-16.9.',
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
   * Generate North Carolina name change section
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
      text: `IT IS ORDERED that ${person} is hereby authorized to resume use of the former name: ${divorceData.previousName}.`,
      type: 'name_change'
    };
  }

  /**
   * Generate North Carolina final orders section
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Final orders section
   */
  generateFinalOrdersSection(divorceData) {
    const items = [];

    items.push({
      content: 'IT IS FURTHER ORDERED that all relief not specifically granted herein is denied.',
      type: 'order'
    });

    items.push({
      content: 'IT IS FURTHER ORDERED that each party shall bear their own costs and attorney fees, unless otherwise ordered.',
      type: 'order'
    });

    items.push({
      content: 'NOTE: This Judgment of Absolute Divorce dissolves the bonds of matrimony ONLY. Claims for equitable distribution not raised prior to or simultaneously with this action are permanently waived pursuant to N.C.G.S. § 50-20(k). Claims for alimony and post-separation support not raised prior to entry of this Judgment are permanently barred pursuant to N.C.G.S. § 50-11(e).',
      type: 'order'
    });

    return {
      title: 'FINAL ORDERS',
      items,
      type: 'final_orders'
    };
  }

  /**
   * Generate North Carolina judgment block (judge signature)
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Judgment block
   */
  generateJudgmentBlock(divorceData) {
    const countyUpper = divorceData.county ? divorceData.county.toUpperCase() : '[COUNTY]';
    return {
      text: `This the _____ day of _______________, 20___.


_________________________________
DISTRICT COURT JUDGE PRESIDING
${countyUpper} COUNTY DISTRICT COURT

${divorceData.judgeName ? divorceData.judgeName.toUpperCase() : ''}`,
      type: 'judgment'
    };
  }

  /**
   * Perform North Carolina-specific validation
   * @param {Object} divorceData - Divorce data
   * @returns {Object} Validation result
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county) {
      errors.push('County is required for North Carolina Judgment of Absolute Divorce');
    }

    if (!divorceData.caseNumber) {
      errors.push('File number is required for North Carolina Judgment of Absolute Divorce');
    }

    if (!divorceData.separationDate) {
      errors.push('Date of separation is required — one-year separation is the ground for absolute divorce in North Carolina (N.C.G.S. § 50-6)');
    } else {
      const separationDate = new Date(divorceData.separationDate);
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
      if (separationDate > oneYearAgo) {
        errors.push('The parties have not yet been separated for one full year, which is required for absolute divorce in North Carolina (N.C.G.S. § 50-6).');
      }
    }

    warnings.push('CRITICAL: This Judgment of Absolute Divorce dissolves only the marriage. Claims for equitable distribution not raised prior to or simultaneously with this action are permanently waived per N.C.G.S. § 50-20(k). Claims for alimony and post-separation support not raised before entry of this Judgment are permanently barred per N.C.G.S. § 50-11(e).');

    return { errors, warnings };
  }
}

module.exports = NorthCarolinaDecreeTemplate;
