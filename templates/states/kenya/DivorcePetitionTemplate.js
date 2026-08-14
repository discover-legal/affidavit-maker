// templates/states/kenya/DivorcePetitionTemplate.js
// Kenya divorce petition template
// Governing Law: Marriage Act, 2014 (No. 4 of 2014); Matrimonial Property Act, 2013

'use strict';

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Kenya Divorce Petition Template
 *
 * Kenya uses the term "Petition" for divorce proceedings under the Marriage Act, 2014.
 * The petition is filed in the magistrates' court ('court' means a resident
 * magistrate's court, Marriage Act, 2014, s.2) for civil, Christian, customary,
 * and Hindu marriages, or in the Kadhi's Court for Islamic marriages. The High
 * Court hears appeals.
 *
 * Key Legal References:
 * - Marriage Act, 2014 (No. 4 of 2014)
 *   - s.2: "court" means a resident magistrate's court
 *   - s.6: Types of marriage recognized (civil, Christian, customary, Hindu, Islamic)
 *   - s.65: Grounds for dissolution of Christian marriages (Part III marriages)
 *   - s.66(2): Civil-marriage grounds — (a) adultery, (b) cruelty, (c) exceptional
 *              depravity, (d) desertion 3+ years, (e) irretrievable breakdown
 *   NOTE: The 3-year bar on filing (formerly s.66(1)) was declared unconstitutional
 *   by the Court of Appeal in 2022 (National Assembly of Kenya v Kina & another,
 *   Civil Appeal 166 of 2019, [2022] KECA 548). The grace period for
 *   Parliament to legislate lapsed June 2025. No minimum marriage duration applies.
 *   - s.66(6): Irretrievable breakdown deemed on eight limbs — adultery; cruelty;
 *              willful neglect 2+ years; separation 2+ years; desertion 3+ years;
 *              imprisonment for life or 7+ years; certified incurable insanity;
 *              any other ground the court deems appropriate
 *   - ss.64, 66(4), 68: Voluntary/discretionary conciliation (marriage-type specific);
 *              s.67 governs recognition of foreign divorce decrees
 *   - s.77-80: Maintenance
 * - Matrimonial Property Act, 2013 (No. 49 of 2013) — contribution-based property division
 * - Children Act, 2022 (No. 29 of 2022) — best interests of child, parenting plan
 * - Constitution of Kenya, 2010, Art. 170 — Kadhi's Courts for Islamic marriages
 *
 * Residency:
 * - The Marriage Act, 2014 contains no express residency requirement — petitions
 *   are in practice filed at the magistrates' court station where the parties reside
 *
 * Kenya-Specific:
 * - Parties are "Petitioner" and "Respondent"
 * - Court is the magistrates' court (s.2) or Kadhi's Court (Islamic marriages);
 *   the High Court hears appeals
 * - Filing fee: approx KES 2,000-45,000 (varies by court and claim value)
 * - Process: Petition -> Hearing -> Decree Nisi -> Decree Absolute (the nisi/absolute
 *   stages are court practice; the 2014 Act is silent)
 * - A4 paper size, KES currency
 *
 * @class KenyaDivorcePetitionTemplate
 * @extends BaseDivorcePetitionTemplate
 */
class KenyaDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'KE';
    this.stateName = 'Kenya';
    this.countryCode = 'KE';
    this.documentTitle = 'PETITION FOR DIVORCE';

    try {
      this.metadata = require('./metadata.json');
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

    // Kenya residency: the Marriage Act, 2014 has no express residency requirement
    this.residencyRequirements = {
      stateMonths: 0,
      countyDays: 0,
      description: 'The Marriage Act, 2014 contains no express residency requirement. Petitions are in practice filed at the magistrates\' court station where the parties reside.'
    };

    // No mandatory waiting period after filing — conciliation is voluntary/discretionary, then Decree Nisi → Absolute (court practice)
    this.waitingPeriod = {
      days: 0,
      description: 'No statutory waiting period after filing. Conciliation is voluntary/discretionary (Marriage Act, 2014, ss.64, 66(4), 68). In practice the Decree Nisi becomes the Decree Absolute after a prescribed period (typically 30 days); the 2014 Act itself is silent on the nisi/absolute stages.'
    };

    this.formatting = {
      fontSize: '12pt',
      fontFamily: 'Times New Roman',
      lineHeight: '1.5',
      margin: '1in',
      paperSize: 'A4'
    };
  }

  getCaseNumberLabel() {
    return 'Divorce Cause No.';
  }

  getDefaultCourt(county) {
    const station = (county || '[STATION]').toUpperCase();
    return `CHIEF MAGISTRATE'S COURT AT ${station}`;
  }

  /**
   * Kenya case caption uses "Petitioner" and "Respondent".
   * Filed in the magistrates' court ('court' = resident magistrate's court,
   * Marriage Act, 2014, s.2) or Kadhi's Court (Islamic marriages).
   */
  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county) || '[COURT NAME]').toUpperCase();
    const caseLabel = this.getCaseNumberLabel();
    const caseNumber = divorceData.caseNumber || '[CASE NUMBER]';

    const petitioner = (divorceData.petitionerName || '[PETITIONER NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();

    const caption = [
      `IN THE ${courtName}`,
      '',
      `${caseLabel} ${caseNumber}`,
      '',
      `IN THE MATTER OF A PETITION FOR DIVORCE`,
      `UNDER THE MARRIAGE ACT, 2014`,
      '',
      `BETWEEN:`,
      '',
      `${petitioner}`,
      `Petitioner`,
      '',
      `AND`,
      '',
      `${respondent}`,
      `Respondent`
    ].join('\n');

    return {
      courtName,
      caseNumber: divorceData.caseNumber,
      petitioner: divorceData.petitionerName,
      respondent: divorceData.respondentName,
      formatted: caption
    };
  }

  /**
   * Kenya jurisdiction statement — Marriage Act, 2014, s.2.
   * Divorce causes are heard by the magistrates' courts; the Act contains
   * no express residency requirement.
   */
  getJurisdictionStatement(divorceData) {
    return `This Honourable Court has jurisdiction to hear and determine this Petition, being a resident magistrate's court within the meaning of section 2 of the Marriage Act, 2014 (No. 4 of 2014), and the parties reside within the local limits of its jurisdiction.`;
  }

  /**
   * Kenya venue reason — Petitioner or Respondent resides in this court station.
   */
  getVenueReason(divorceData) {
    const location = divorceData.county || '[COURT STATION]';
    return `the Petitioner or Respondent resides within the jurisdiction of the court station at ${location}`;
  }

  /**
   * Kenya relief section — Marriage Act, 2014 terminology.
   * Property division under Matrimonial Property Act, 2013 (contribution-based).
   * Maintenance under Marriage Act, 2014, s.77-80.
   */
  generateReliefSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 15;

    items.push({
      number: null,
      content: 'THE PETITIONER PRAYS that the Honourable Court be pleased to grant the following orders:',
      type: 'relief_intro'
    });

    const reliefItems = [
      'A Decree Nisi dissolving the marriage between the Petitioner and the Respondent, and thereafter a Decree Absolute, pursuant to section 66 of the Marriage Act, 2014;',
      'An order for the division of matrimonial property in accordance with the Matrimonial Property Act, 2013, taking into account the contribution (financial and non-financial) of each party;',
      'An order for the division of household effects and personal property;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('An order granting custody and parental responsibility for the minor child(ren) of the marriage to the Petitioner, with reasonable access to the Respondent, pursuant to the Children Act, 2022;');
      reliefItems.push('An order for child maintenance payable by the Respondent, in an amount to be determined by this Honourable Court;');
    }

    if (divorceData.spousalSupportRequested || divorceData.requestSpousalSupport) {
      reliefItems.push('An order for maintenance in favour of the Petitioner pursuant to sections 77-80 of the Marriage Act, 2014;');
    }

    reliefItems.push('Costs of this Petition;');
    reliefItems.push('Such further and other relief as this Honourable Court deems just and expedient to grant.');

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
      title: 'PRAYER',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Kenya verification text.
   * Kenya uses a sworn affidavit (supporting affidavit filed with the petition).
   * Oaths and Statutory Declarations Act (Cap 15).
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PETITIONER NAME]';
    return `I, ${name}, the Petitioner herein, make oath and say that the contents of this Petition are true to the best of my knowledge, information, and belief.`;
  }

  /**
   * Kenya grounds for divorce (civil marriages).
   * Marriage Act, 2014, s.66(2) — a party may petition on one of these grounds:
   *   (a) adultery
   *   (b) cruelty (physical or mental)
   *   (c) exceptional depravity
   *   (d) desertion for 3+ years
   *   (e) irretrievable breakdown of the marriage (particularised by s.66(6))
   * There is no overarching breakdown requirement. Grounds are marriage-type
   * specific: s.65 (Christian), s.69 (customary), s.70 (Hindu), s.71 (Islamic).
   */
  getGroundsText(groundsForDivorce) {
    const g = (groundsForDivorce || 'irretrievable_breakdown').toLowerCase();
    if (g.includes('adultery')) {
      return 'The Respondent has committed one or more acts of adultery and the Petitioner finds it intolerable to continue living with the Respondent, within the meaning of section 66(2)(a) of the Marriage Act, 2014.';
    }
    if (g.includes('desertion')) {
      return 'The Respondent has deserted the Petitioner for a continuous period of at least three years immediately preceding the presentation of this Petition, within the meaning of section 66(2)(d) of the Marriage Act, 2014.';
    }
    if (g.includes('depravity') || g.includes('exceptional')) {
      return 'The Respondent has exhibited exceptional depravity such that the Petitioner cannot reasonably be expected to continue living with the Respondent, within the meaning of section 66(2)(c) of the Marriage Act, 2014.';
    }
    if (g.includes('cruelty')) {
      return 'The Respondent has inflicted cruelty, whether mental or physical, on the Petitioner or on the children of the marriage, within the meaning of section 66(2)(b) of the Marriage Act, 2014.';
    }
    // Default: irretrievable breakdown
    return 'The marriage between the Petitioner and the Respondent has broken down irretrievably with no reasonable prospect of reconciliation, within the meaning of section 66(2)(e) of the Marriage Act, 2014.';
  }
}

module.exports = KenyaDivorcePetitionTemplate;
