// templates/states/lagos/DivorcePetitionTemplate.js
// Lagos State divorce petition template
// Governing Law: Matrimonial Causes Act 1970, Cap M7 LFN 2004

'use strict';

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Lagos State Divorce Petition Template
 *
 * Governs statutory marriages (under the Marriage Act) only.
 * Customary and Islamic marriages are dissolved in different courts.
 *
 * Key Legal References:
 * - Matrimonial Causes Act 1970, Cap M7 LFN 2004 (MCA)
 *   - s.15: Sole ground is irretrievable breakdown, proved by one of eight facts (s.15(2)(a)-(h))
 *   - s.30: 2-year bar — cannot file within 2 years of marriage without leave (inapplicable to s.15(2)(a)/(b) or s.16(1)(a) petitions, s.30(2))
 *   - s.58: Decree Nisi becomes Decree Absolute after 3 months (s.57 declaration required where children under 16)
 *   - s.70-73: Ancillary relief (maintenance, property, custody)
 * - Marriage Act, Cap M6 LFN 2004 (governs statutory marriages)
 * - Child Rights Act 2003 (adopted by Lagos State)
 * - High Court of Lagos State (Civil Procedure) Rules
 *
 * Residency (MCA s.2, s.7(b)):
 * - Either party must be domiciled in Nigeria; a wife resident for 3 years is deemed domiciled (s.7(b))
 *
 * @class LagosDivorcePetitionTemplate
 * @extends BaseDivorcePetitionTemplate
 */
class LagosDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'LA_NG';
    this.stateName = 'Lagos';
    this.countryCode = 'NG';
    this.documentTitle = 'PETITION FOR DISSOLUTION OF MARRIAGE';

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

    // MCA s.2 — domicile in Nigeria; s.7(b) — wife resident 3 years deemed domiciled
    this.residencyRequirements = {
      stateMonths: 0,
      countyDays: 0,
      description: 'Either party must be domiciled in Nigeria (MCA s.2). A wife ordinarily resident in Nigeria for three years is deemed domiciled (MCA s.7(b)). Any person domiciled in Nigeria may file in the High Court of any state (MCA s.2(3)); the Lagos High Court is the usual venue when either party resides within the state.'
    };

    // MCA s.30 — 2-year bar from date of marriage
    this.waitingPeriod = {
      days: 0,
      description: 'No mandatory waiting period after filing. However, a petition cannot be filed within 2 years of marriage unless the court grants leave on grounds of exceptional hardship (MCA s.30); the bar does not apply to petitions based on wilful refusal to consummate or adultery (MCA s.30(2)). Decree Nisi becomes Decree Absolute after 3 months (MCA s.58); where there are children under 16, subject to the s.57 declaration as to arrangements for them.'
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
    return 'Suit No.';
  }

  getDefaultCourt(county) {
    const division = (county || '[JUDICIAL DIVISION]').toUpperCase();
    return `HIGH COURT OF LAGOS STATE — ${division} JUDICIAL DIVISION`;
  }

  /**
   * Lagos case caption uses "Petitioner" and "Respondent".
   */
  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county) || '[COURT NAME]').toUpperCase();
    const caseLabel = this.getCaseNumberLabel();
    const caseNumber = divorceData.caseNumber || '[SUIT NUMBER]';

    const petitioner = (divorceData.petitionerName || '[PETITIONER NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();

    const caption = [
      `IN THE ${courtName}`,
      '',
      `${caseLabel} ${caseNumber}`,
      '',
      `IN THE MATTER OF THE MATRIMONIAL CAUSES ACT, CAP M7 LFN 2004`,
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
   * Jurisdiction statement — MCA s.2.
   */
  getJurisdictionStatement(divorceData) {
    return `The Petitioner/Respondent is domiciled in Nigeria as required by section 2 of the Matrimonial Causes Act, Cap M7 LFN 2004 (or, being a wife, has been ordinarily resident in Nigeria for a continuous period of not less than three years immediately preceding the date of this Petition and is thereby deemed domiciled pursuant to section 7(b) of the said Act). By virtue of section 2(3) of the said Act, proceedings may be instituted in the High Court of any State; the Petitioner resides within Lagos State, and this Honourable Court is accordingly the appropriate venue.`;
  }

  /**
   * Lagos venue reason.
   */
  getVenueReason(divorceData) {
    const location = divorceData.county || '[JUDICIAL DIVISION]';
    return `the Petitioner resides within the ${location} Judicial Division of Lagos State`;
  }

  /**
   * Relief section — MCA s.70-73 for ancillary relief.
   */
  generateReliefSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 15;

    items.push({
      number: null,
      content: 'THE PETITIONER HUMBLY PRAYS that the Honourable Court grant the following relief:',
      type: 'relief_intro'
    });

    const reliefItems = [
      'A Decree Nisi for the dissolution of the marriage between the Petitioner and the Respondent, pursuant to section 15 of the Matrimonial Causes Act, Cap M7 LFN 2004;',
      'That the said Decree Nisi be made absolute after the expiration of three months pursuant to section 58 of the said Act;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('An order for the custody of the child(ren) of the marriage pursuant to section 71 of the Matrimonial Causes Act;');
      reliefItems.push('An order for the maintenance of the child(ren) of the marriage pursuant to section 70 of the Matrimonial Causes Act;');
    }

    if (divorceData.spousalSupportRequested || divorceData.requestSpousalSupport) {
      reliefItems.push('An order for the maintenance of the Petitioner pursuant to section 70 of the Matrimonial Causes Act;');
    }

    if (divorceData.propertyRelief) {
      reliefItems.push('An order for settlement of property pursuant to section 72 of the Matrimonial Causes Act;');
    }

    reliefItems.push('Such further or other orders as this Honourable Court may deem just and expedient in the circumstances.');

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
      title: 'RELIEF SOUGHT',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Verification text — sworn affidavit under Nigerian Oaths Act.
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PETITIONER NAME]';
    return `I, ${name}, the Petitioner herein, make oath and state that the facts deposed to in this Petition are true and correct to the best of my knowledge, information, and belief.`;
  }

  /**
   * Grounds for divorce — MCA s.15(2).
   * Sole ground: irretrievable breakdown, proved by one of eight facts (s.15(2)(a)-(h)).
   */
  getGroundsText(groundsForDivorce) {
    const g = (groundsForDivorce || 'separation_consent').toLowerCase();

    if (g.includes('adultery')) {
      return 'Since the celebration of the marriage, the Respondent has committed adultery and the Petitioner finds it intolerable to live with the Respondent, within the meaning of section 15(2)(b) of the Matrimonial Causes Act, Cap M7 LFN 2004.';
    }
    if (g.includes('intolerable') || g.includes('behaviour') || g.includes('cruelty')) {
      return 'Since the celebration of the marriage, the Respondent has behaved in such a way that the Petitioner cannot reasonably be expected to live with the Respondent, within the meaning of section 15(2)(c) of the Matrimonial Causes Act, Cap M7 LFN 2004.';
    }
    if (g.includes('desertion')) {
      return 'The Respondent has deserted the Petitioner for a continuous period of at least one year immediately preceding the presentation of this Petition, within the meaning of section 15(2)(d) of the Matrimonial Causes Act, Cap M7 LFN 2004.';
    }
    if (g.includes('separation_no_consent') || g.includes('3') || g.includes('three')) {
      return 'The parties to the marriage have lived apart for a continuous period of at least three years immediately preceding the presentation of this Petition, within the meaning of section 15(2)(f) of the Matrimonial Causes Act, Cap M7 LFN 2004.';
    }
    if (g.includes('refusal') || g.includes('consummate')) {
      return 'Since the celebration of the marriage, the Respondent has wilfully and persistently refused to consummate the marriage, within the meaning of section 15(2)(a) of the Matrimonial Causes Act, Cap M7 LFN 2004.';
    }
    if (g.includes('restitution')) {
      return 'The Respondent has, for a period of not less than one year, failed to comply with a decree of restitution of conjugal rights made under the Act, within the meaning of section 15(2)(g) of the Matrimonial Causes Act, Cap M7 LFN 2004.';
    }
    if (g.includes('death') || g.includes('absent') || g.includes('presumption')) {
      return 'The other party to the marriage has been absent from the Petitioner for such time and in such circumstances as to provide reasonable grounds for presuming that he or she is dead, within the meaning of section 15(2)(h) of the Matrimonial Causes Act, Cap M7 LFN 2004; the other party has been continually absent from the Petitioner for a period of not less than seven years and the Petitioner has no reason to believe that the other party has been alive at any time within that period, which is sufficient proof of that fact pursuant to section 16(2)(a) of the said Act.';
    }
    // Default: 2-year separation with consent
    return 'The parties to the marriage have lived apart for a continuous period of at least two years immediately preceding the presentation of this Petition, and the Respondent does not object to the grant of a decree, within the meaning of section 15(2)(e) of the Matrimonial Causes Act, Cap M7 LFN 2004.';
  }
}

module.exports = LagosDivorcePetitionTemplate;
