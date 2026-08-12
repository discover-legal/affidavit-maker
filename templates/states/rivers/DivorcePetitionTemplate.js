// templates/states/rivers/DivorcePetitionTemplate.js
// Rivers State divorce petition template
// Governing Law: Matrimonial Causes Act 1970, Cap M7 LFN 2004

'use strict';

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

class RiversDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();
    this.state = 'RV';
    this.stateName = 'Rivers';
    this.countryCode = 'NG';
    this.documentTitle = 'PETITION FOR DISSOLUTION OF MARRIAGE';
    try { this.metadata = require('./metadata.json'); } catch (e) { this.metadata = null; }

    this.requiredFields = ['petitionerName', 'respondentName', 'state', 'county', 'marriageDate', 'groundsForDivorce'];
    this.residencyRequirements = { stateMonths: 0, countyDays: 0, description: 'Either party must be domiciled in Nigeria (MCA s.2). A wife ordinarily resident in Nigeria for 3 years is deemed domiciled (MCA s.7(b)). Rivers State High Court has jurisdiction if either party resides within the state.' };
    this.waitingPeriod = { days: 0, description: 'Decree Nisi becomes Decree Absolute after 3 months (MCA s.58). Cannot petition within 2 years of marriage without leave (MCA s.30).' };
    this.formatting = { fontSize: '12pt', fontFamily: 'Times New Roman', lineHeight: '1.5', margin: '1in', paperSize: 'A4' };
  }

  getCaseNumberLabel() { return 'Suit No.'; }
  getDefaultCourt(county) { return `HIGH COURT OF RIVERS STATE — ${(county || '[JUDICIAL DIVISION]').toUpperCase()} JUDICIAL DIVISION`; }

  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county)).toUpperCase();
    const caseNumber = divorceData.caseNumber || '[SUIT NUMBER]';
    const petitioner = (divorceData.petitionerName || '[PETITIONER NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();
    const caption = [`IN THE ${courtName}`, '', `Suit No. ${caseNumber}`, '', `IN THE MATTER OF THE MATRIMONIAL CAUSES ACT, CAP M7 LFN 2004`, '', `BETWEEN:`, '', `${petitioner}`, `Petitioner`, '', `AND`, '', `${respondent}`, `Respondent`].join('\n');
    return { courtName, caseNumber: divorceData.caseNumber, petitioner: divorceData.petitionerName, respondent: divorceData.respondentName, formatted: caption };
  }

  getJurisdictionStatement(divorceData) {
    return `The Petitioner/Respondent is domiciled in Nigeria as required by section 2 of the Matrimonial Causes Act, Cap M7 LFN 2004 (or, being a wife, has been ordinarily resident in Nigeria for a continuous period of not less than three years immediately preceding the date of this Petition and is thereby deemed domiciled pursuant to section 7(b) of the said Act). The Petitioner resides within the jurisdiction of the High Court of Rivers State.`;
  }

  getVenueReason(divorceData) {
    const location = divorceData.county || '[JUDICIAL DIVISION]';
    return `the Petitioner resides within the ${location} Judicial Division of Rivers State`;
  }

  generateReliefSection(divorceData) {
    const items = [];
    items.push({ number: null, content: 'THE PETITIONER HUMBLY PRAYS that the Honourable Court grant the following relief:', type: 'relief_intro' });
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
      items.push({ number: null, content: relief, type: 'relief_item', style: 'letter', letter: String.fromCharCode(97 + index) });
    });
    return { title: 'RELIEF SOUGHT', items, nextParagraphNumber: divorceData._paragraphNum || 15 };
  }

  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PETITIONER NAME]';
    return `I, ${name}, the Petitioner herein, make oath and state that the facts deposed to in this Petition are true and correct to the best of my knowledge, information, and belief.`;
  }

  getGroundsText(groundsForDivorce) {
    const g = (groundsForDivorce || 'separation_consent').toLowerCase();
    if (g.includes('adultery')) return 'Since the celebration of the marriage, the Respondent has committed adultery and the Petitioner finds it intolerable to live with the Respondent, within the meaning of section 15(2)(b) of the Matrimonial Causes Act, Cap M7 LFN 2004.';
    if (g.includes('intolerable') || g.includes('behaviour') || g.includes('cruelty')) return 'Since the celebration of the marriage, the Respondent has behaved in such a way that the Petitioner cannot reasonably be expected to live with the Respondent, within the meaning of section 15(2)(c) of the Matrimonial Causes Act, Cap M7 LFN 2004.';
    if (g.includes('desertion')) return 'The Respondent has deserted the Petitioner for a continuous period of at least one year immediately preceding the presentation of this Petition, within the meaning of section 15(2)(d) of the Matrimonial Causes Act, Cap M7 LFN 2004.';
    if (g.includes('separation_no_consent') || g.includes('three')) return 'The parties to the marriage have lived apart for a continuous period of at least three years immediately preceding the presentation of this Petition, within the meaning of section 15(2)(f) of the Matrimonial Causes Act, Cap M7 LFN 2004.';
    if (g.includes('refusal') || g.includes('consummate')) return 'Since the celebration of the marriage, the Respondent has wilfully and persistently refused to consummate the marriage, within the meaning of section 15(2)(a) of the Matrimonial Causes Act, Cap M7 LFN 2004.';
    if (g.includes('restitution')) return 'The Respondent has, for a period of not less than one year, failed to comply with a decree of restitution of conjugal rights made under the Act, within the meaning of section 15(2)(g) of the Matrimonial Causes Act, Cap M7 LFN 2004.';
    if (g.includes('death') || g.includes('absent') || g.includes('presumption')) return 'The other party to the marriage has, for a period of not less than seven years, been absent from the Petitioner and the Petitioner has no reason to believe that the other party has been alive at any time within that period, within the meaning of section 15(2)(h) of the Matrimonial Causes Act, Cap M7 LFN 2004.';
    return 'The parties to the marriage have lived apart for a continuous period of at least two years immediately preceding the presentation of this Petition, and the Respondent does not object to the grant of a decree, within the meaning of section 15(2)(e) of the Matrimonial Causes Act, Cap M7 LFN 2004.';
  }
}

module.exports = RiversDivorcePetitionTemplate;
