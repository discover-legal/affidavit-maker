// templates/states/scotland/DivorcePetitionTemplate.js
// Scotland divorce petition (Initial Writ) template
// Governing Law: Divorce (Scotland) Act 1976; Family Law (Scotland) Act 2006

'use strict';

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Scotland Divorce Petition Template (Initial Writ)
 *
 * Scottish divorce proceedings are initiated by an "Initial Writ" in the Sheriff Court
 * (or a Summons in the Court of Session for complex cases). The party raising the action
 * is the "Pursuer" and the other party is the "Defender".
 *
 * Scotland has NOT adopted no-fault divorce. The sole ground is "irretrievable breakdown"
 * but it must be proved by one of four facts:
 *   (a) Adultery — Divorce (Scotland) Act 1976, s.1(2)(a)
 *   (b) Unreasonable behaviour — s.1(2)(b)
 *   (c) 1-year separation with consent — s.1(2)(d) (reduced from 2 years by 2006 Act)
 *   (d) 2-year separation without consent — s.1(2)(e) (reduced from 5 years by 2006 Act)
 *
 * Note: Desertion was removed as a ground by the Family Law (Scotland) Act 2006.
 *
 * Residency (Domicile and Matrimonial Proceedings Act 1973, s.7):
 * - Either party domiciled in Scotland, OR
 * - Either party habitually resident in Scotland for 40 days before action raised
 *
 * Filing fee: approx. GBP £185 (Sheriff Court ordinary cause); simplified: approx. £151
 * Paper size: A4
 *
 * @class ScotlandDivorcePetitionTemplate
 * @extends BaseDivorcePetitionTemplate
 */
class ScotlandDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'SCO';
    this.stateName = 'Scotland';
    this.countryCode = 'UK';
    this.documentTitle = 'INITIAL WRIT FOR DIVORCE';

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

    // Scotland residency: domicile or 40 days habitual residence
    this.residencyRequirements = {
      stateMonths: 0,
      countyDays: 40,
      description: 'Either party must be domiciled in Scotland, or have been habitually resident in Scotland for at least 40 days immediately before the action is raised (Domicile and Matrimonial Proceedings Act 1973, s.7).'
    };

    this.waitingPeriod = {
      days: 0,
      description: 'No mandatory waiting period after filing beyond the separation periods required by the chosen ground (1-year with consent or 2-year without consent).'
    };

    this.formatting = {
      fontSize: '12pt',
      fontFamily: 'Times New Roman',
      lineHeight: '1.5',
      margin: '2.54cm',
      paperSize: 'A4'
    };
  }

  getCaseNumberLabel() {
    return 'Court Ref. No.';
  }

  getDefaultCourt(county) {
    const location = (county || '[LOCATION]').toUpperCase();
    return `SHERIFF COURT AT ${location}`;
  }

  /**
   * Scotland case caption uses "Pursuer" and "Defender".
   */
  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county) || '[COURT NAME]').toUpperCase();
    const caseLabel = this.getCaseNumberLabel();
    const caseNumber = divorceData.caseNumber || '[COURT REF. NUMBER]';

    const pursuer = (divorceData.petitionerName || '[PURSUER NAME]').toUpperCase();
    const defender = (divorceData.respondentName || '[DEFENDER NAME]').toUpperCase();

    const caption = [
      `IN THE ${courtName}`,
      '',
      `${caseLabel} ${caseNumber}`,
      '',
      `INITIAL WRIT FOR DIVORCE`,
      '',
      `${pursuer}`,
      `Pursuer`,
      '',
      `against`,
      '',
      `${defender}`,
      `Defender`
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
   * Scotland jurisdiction statement — domicile or 40 days habitual residence.
   */
  getJurisdictionStatement(divorceData) {
    return 'The Pursuer avers that either the Pursuer or the Defender is domiciled in Scotland, or has been habitually resident in Scotland for a period of not less than 40 days immediately preceding the raising of this action, in terms of section 7 of the Domicile and Matrimonial Proceedings Act 1973.';
  }

  /**
   * Scotland venue reason.
   */
  getVenueReason(divorceData) {
    const location = divorceData.county || '[COURT LOCATION]';
    return `the Pursuer or Defender resides within the sheriffdom of ${location}`;
  }

  /**
   * Scotland relief section — "craves" in Scottish procedure.
   */
  generateReliefSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 15;

    items.push({
      number: null,
      content: 'THE PURSUER CRAVES the Court:',
      type: 'relief_intro'
    });

    const reliefItems = [
      'To grant decree of divorce dissolving the marriage between the Pursuer and the Defender, in terms of the Divorce (Scotland) Act 1976;'
    ];

    if (divorceData.requestFinancialProvision !== false) {
      reliefItems.push('To make an order for financial provision in terms of the Family Law (Scotland) Act 1985, including such order for the payment of a capital sum, transfer of property, and/or periodical allowance as may be just;');
    }

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('To make such order in respect of the parental responsibilities and rights relating to the child(ren) of the marriage as the Court considers appropriate, in terms of section 11 of the Children (Scotland) Act 1995;');
      reliefItems.push('To make an order for aliment (child maintenance) in respect of the child(ren) of the marriage, in terms of the Family Law (Scotland) Act 1985 and/or the Child Support Act 1991;');
    }

    if (divorceData.spousalSupportRequested || divorceData.requestSpousalSupport) {
      reliefItems.push('To make an order for periodical allowance in favour of the Pursuer, in terms of section 9(1)(d) or (e) of the Family Law (Scotland) Act 1985;');
    }

    reliefItems.push('To find the Defender liable in the expenses of this action, or to make such order as to expenses as the Court considers just;');
    reliefItems.push('To grant such further or other orders as the Court considers just and appropriate.');

    reliefItems.forEach((relief, index) => {
      const number = index + 1;
      items.push({
        number: null,
        content: relief,
        type: 'relief_item',
        style: 'number',
        letter: String(number)
      });
    });

    return {
      title: 'CRAVES',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Scotland verification — sworn affidavit, not Statement of Truth.
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PURSUER NAME]';
    return `I, ${name}, Pursuer, do solemnly and sincerely declare that the facts stated in this Initial Writ and the accompanying affidavit are true, to the best of my knowledge, information, and belief.`;
  }

  /**
   * Scotland grounds for divorce.
   * Unlike England, Scotland STILL requires proof of one of four facts:
   *   (a) Adultery — s.1(2)(a)
   *   (b) Unreasonable behaviour — s.1(2)(b)
   *   (c) 1-year separation with consent — s.1(2)(d)
   *   (d) 2-year separation without consent — s.1(2)(e)
   */
  getGroundsText(groundsForDivorce) {
    const g = (groundsForDivorce || 'separation_1yr_consent').toLowerCase();
    if (g.includes('adultery')) {
      return 'The marriage has broken down irretrievably by reason of the Defender\'s adultery, in terms of section 1(2)(a) of the Divorce (Scotland) Act 1976.';
    }
    if (g.includes('behaviour') || g.includes('unreasonable')) {
      return 'The marriage has broken down irretrievably by reason of the Defender\'s behaviour, which is such that the Pursuer cannot reasonably be expected to cohabit with the Defender, in terms of section 1(2)(b) of the Divorce (Scotland) Act 1976.';
    }
    if (g.includes('2') || g.includes('two') || g.includes('without_consent') || g.includes('no_consent')) {
      return 'The marriage has broken down irretrievably in that the parties have not cohabited for a continuous period of at least two years, in terms of section 1(2)(e) of the Divorce (Scotland) Act 1976 as amended by the Family Law (Scotland) Act 2006.';
    }
    // Default: 1-year separation with consent
    return 'The marriage has broken down irretrievably in that the parties have not cohabited for a continuous period of at least one year and the Defender consents to the granting of decree of divorce, in terms of section 1(2)(d) of the Divorce (Scotland) Act 1976 as amended by the Family Law (Scotland) Act 2006.';
  }
}

module.exports = ScotlandDivorcePetitionTemplate;
