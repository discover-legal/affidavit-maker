// templates/states/scotland/DivorcePetitionTemplate.js
// Scotland divorce petition (Initial Writ) template
// Governing Law: Divorce (Scotland) Act 1976; Family Law (Scotland) Act 2006

'use strict';

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

// The six sheriffdoms of Scotland (for the Form G1 "SHERIFFDOM OF ... AT ..." heading)
const SCOTTISH_SHERIFFDOMS = [
  'GLASGOW AND STRATHKELVIN',
  'GRAMPIAN, HIGHLAND AND ISLANDS',
  'LOTHIAN AND BORDERS',
  'NORTH STRATHCLYDE',
  'SOUTH STRATHCLYDE, DUMFRIES AND GALLOWAY',
  'TAYSIDE, CENTRAL AND FIFE'
];

/**
 * Scotland Divorce Petition Template (Initial Writ)
 *
 * Scottish divorce proceedings are initiated by an "Initial Writ" in the Sheriff Court
 * (or a Summons in the Court of Session for complex cases). The party raising the action
 * is the "Pursuer" and the other party is the "Defender".
 *
 * Scotland has NOT adopted no-fault divorce. The principal ground is "irretrievable
 * breakdown" (s.1(1)(a)), which must be proved by one of four facts:
 *   (a) Adultery — Divorce (Scotland) Act 1976, s.1(2)(a)
 *   (b) Unreasonable behaviour — s.1(2)(b)
 *   (c) 1-year separation with consent — s.1(2)(d) (reduced from 2 years by 2006 Act)
 *   (d) 2-year separation without consent — s.1(2)(e) (reduced from 5 years by 2006 Act)
 * There is a second, free-standing ground: an interim gender recognition certificate
 * under the Gender Recognition Act 2004 issued to either party after the date of the
 * marriage — s.1(1)(b) (inserted by GRA 2004, Sch.2 para.6).
 *
 * Note: Desertion was removed as a ground by the Family Law (Scotland) Act 2006.
 *
 * Jurisdiction (Domicile and Matrimonial Proceedings Act 1973, s.8(2); Court of Session: s.7(2A)):
 * - Either party domiciled in Scotland on the date the action is begun, OR
 * - Either party habitually resident in Scotland throughout the one year ending with that date
 * - Sheriff court venue: either party resident in the sheriffdom for 40 days ending with that date (s.8(2)(b))
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

    // Scottish terminology (see templates/core/terminology.js): the caption is the
    // court-name line (Sheriff Court / Court of Session); parties are
    // Pursuer/Defender (Divorce (Scotland) Act 1976); venue is the sheriffdom;
    // self-represented parties are "Party Litigants". No US caption furniture.
    this.terminology = {
      ...this.terminology,
      jurisdictionLabel: null,
      districtLabel: null,
      districtStyle: 'plain',
      jurisdictionTerm: 'Jurisdiction',
      districtTerm: 'Sheriffdom',
      districtPlaceholder: '[SHERIFFDOM]',
      filerLabel: 'Pursuer',
      responderLabel: 'Defender',
      selfRepresentedLabel: 'Party Litigant',
    };
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

    // Scotland jurisdiction: domicile or 1-year habitual residence; 40-day sheriffdom residence is the venue limb
    this.residencyRequirements = {
      stateMonths: 12,
      countyDays: 40,
      description: 'Either party must be domiciled in Scotland on the date the action is begun, or have been habitually resident in Scotland throughout the one year ending with that date (Domicile and Matrimonial Proceedings Act 1973, s.8(2)(a); Court of Session: s.7(2A)). For sheriff court actions, either party must additionally have been resident in the sheriffdom for at least 40 days ending with that date (s.8(2)(b)).'
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

  /**
   * Sheriff-court initial writs are headed "SHERIFFDOM OF [sheriffdom] AT [place]"
   * (Ordinary Cause Rules 1993, Form G1). The interview usually captures either the
   * sheriffdom or the court town in `county`; whichever slot is unknown keeps a
   * placeholder for the filer to complete.
   */
  getDefaultCourt(county) {
    const value = (county || '').trim().toUpperCase();
    if (!value) {
      return 'SHERIFFDOM OF [SHERIFFDOM] AT [PLACE]';
    }
    if (SCOTTISH_SHERIFFDOMS.includes(value)) {
      return `SHERIFFDOM OF ${value} AT [PLACE]`;
    }
    return `SHERIFFDOM OF [SHERIFFDOM] AT ${value}`;
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

    // Form G1 headings begin "SHERIFFDOM OF ..." with no "IN THE" prefix.
    const heading = courtName.startsWith('SHERIFFDOM') ? courtName : `IN THE ${courtName}`;

    const caption = [
      heading,
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
   * Scotland jurisdiction statement — domicile or 1-year habitual residence,
   * plus the 40-day sheriffdom residence venue limb (DMPA 1973, s.8(2)).
   */
  getJurisdictionStatement(divorceData) {
    return 'The Pursuer avers that either the Pursuer or the Defender is domiciled in Scotland on the date this action is begun, or has been habitually resident in Scotland throughout the period of one year ending with that date, in terms of section 8(2)(a) of the Domicile and Matrimonial Proceedings Act 1973; and further that either party has been resident in the sheriffdom for a period of not less than 40 days ending with that date, in terms of section 8(2)(b) of the said Act.';
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
   * Separate second ground: interim gender recognition certificate issued to either
   * party after the date of the marriage — s.1(1)(b) (Gender Recognition Act 2004).
   */
  getGroundsText(groundsForDivorce) {
    const g = (groundsForDivorce || 'separation_1yr_consent').toLowerCase();
    if (g.includes('gender') || g.includes('recognition') || g.includes('grc')) {
      return 'An interim gender recognition certificate under the Gender Recognition Act 2004 has, after the date of the marriage, been issued to a party to the marriage, in terms of section 1(1)(b) of the Divorce (Scotland) Act 1976.';
    }
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
