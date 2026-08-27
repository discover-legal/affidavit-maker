// templates/states/cross_river/DivorcePetitionTemplate.js
'use strict';
const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

class CrossRiverDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  // Nigerian terminology (see templates/core/terminology.js): the caption is the
  // court-name line + suit number; parties are Petitioner/Respondent under the
  // Matrimonial Causes Act 1970; High Courts sit in judicial divisions, not
  // counties. No "STATE OF"/"COUNTY OF" caption lines, no "X County" body phrasing.
  constructor() {
    super();
    this.state = 'CR'; this.stateName = 'Cross River'; this.countryCode = 'NG'; this.terminology = { ...this.terminology, jurisdictionLabel: null, districtLabel: null, districtStyle: 'plain', jurisdictionTerm: 'State', districtTerm: 'Judicial division', districtPlaceholder: '[JUDICIAL DIVISION]', filerLabel: 'Petitioner', responderLabel: 'Respondent', selfRepresentedLabel: 'Self-Represented' };
    this.documentTitle = 'PETITION FOR DISSOLUTION OF MARRIAGE';
    try { this.metadata = require('./metadata.json'); } catch (e) { this.metadata = null; }
    this.requiredFields = ['petitionerName', 'respondentName', 'state', 'county', 'marriageDate', 'groundsForDivorce'];
    this.residencyRequirements = { stateMonths: 0, countyDays: 0, description: 'Either party must be domiciled in Nigeria (MCA s.2). A wife ordinarily resident for 3 years is deemed domiciled (MCA s.7(b)). Any person domiciled in Nigeria may file in the High Court of any state (MCA s.2(3)); the Cross River High Court is the usual venue when either party resides in the state.' };
    this.waitingPeriod = { days: 0, description: 'Decree Nisi -> 3 months -> Decree Absolute (MCA s.58; where children under 16, subject to the s.57 declaration). 2-year bar (MCA s.30; exceptions in s.30(2)).' };
    this.formatting = { fontSize: '12pt', fontFamily: 'Times New Roman', lineHeight: '1.5', margin: '1in', paperSize: 'A4' };
  }
  getCaseNumberLabel() { return 'Suit No.'; }
  getDefaultCourt(county) { return `HIGH COURT OF CROSS RIVER STATE — ${(county || '[JUDICIAL DIVISION]').toUpperCase()} JUDICIAL DIVISION`; }
  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county)).toUpperCase();
    const caseNumber = divorceData.caseNumber || '[SUIT NUMBER]';
    const petitioner = (divorceData.petitionerName || '[PETITIONER NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();
    const caption = [`IN THE ${courtName}`, '', `Suit No. ${caseNumber}`, '', 'IN THE MATTER OF THE MATRIMONIAL CAUSES ACT, CAP M7 LFN 2004', '', 'BETWEEN:', '', petitioner, 'Petitioner', '', 'AND', '', respondent, 'Respondent'].join('\n');
    return { courtName, caseNumber: divorceData.caseNumber, petitioner: divorceData.petitionerName, respondent: divorceData.respondentName, formatted: caption };
  }
  getJurisdictionStatement() { return 'The Petitioner/Respondent is domiciled in Nigeria as required by section 2 of the Matrimonial Causes Act, Cap M7 LFN 2004 (or, being a wife, has been ordinarily resident in Nigeria for not less than three years and is thereby deemed domiciled pursuant to section 7(b) of the said Act). By virtue of section 2(3) of the said Act, proceedings may be instituted in the High Court of any State; the Petitioner resides within Cross River State, and this Honourable Court is accordingly the appropriate venue.'; }
  getVenueReason(divorceData) { return `the Petitioner resides within the ${divorceData.county || '[JUDICIAL DIVISION]'} Judicial Division of Cross River State`; }
  generateReliefSection(divorceData) {
    const items = [];
    items.push({ number: null, content: 'THE PETITIONER HUMBLY PRAYS that the Honourable Court grant the following relief:', type: 'relief_intro' });
    const reliefItems = ['A Decree Nisi for the dissolution of the marriage pursuant to section 15 of the Matrimonial Causes Act, Cap M7 LFN 2004;', 'That the said Decree Nisi be made absolute after three months pursuant to section 58;'];
    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) { reliefItems.push('An order for custody of the child(ren) pursuant to section 71;'); reliefItems.push('An order for maintenance of the child(ren) pursuant to section 70;'); }
    if (divorceData.spousalSupportRequested || divorceData.requestSpousalSupport) reliefItems.push('An order for maintenance of the Petitioner pursuant to section 70;');
    if (divorceData.propertyRelief) reliefItems.push('An order for settlement of property pursuant to section 72;');
    reliefItems.push('Such further or other orders as this Honourable Court may deem just.');
    // Agreed corollary relief (agreed support amount, spousal-support
    // waiver, property agreement) — spliced before the final general prayer.
    this.appendAgreedReliefItems(reliefItems, divorceData);

    reliefItems.forEach((r, i) => { items.push({ number: null, content: r, type: 'relief_item', style: 'letter', letter: String.fromCharCode(97 + i) }); });
    return { title: 'RELIEF SOUGHT', items, nextParagraphNumber: divorceData._paragraphNum || 15 };
  }
  getVerificationText(divorceData) { return `I, ${divorceData.petitionerName || '[PETITIONER NAME]'}, the Petitioner herein, make oath and state that the facts deposed to in this Petition are true and correct to the best of my knowledge, information, and belief.`; }
  getGroundsText(groundsForDivorce) {
    const g = (groundsForDivorce || 'separation_consent').toLowerCase();
    if (g.includes('adultery')) return 'Since the celebration of the marriage, the Respondent has committed adultery and the Petitioner finds it intolerable to live with the Respondent (MCA s.15(2)(b)).';
    if (g.includes('intolerable') || g.includes('behaviour') || g.includes('cruelty')) return 'The Respondent has behaved in such a way that the Petitioner cannot reasonably be expected to live with the Respondent (MCA s.15(2)(c)).';
    if (g.includes('desertion')) return 'The Respondent has deserted the Petitioner for at least one continuous year immediately preceding the presentation of this Petition (MCA s.15(2)(d)).';
    if (g.includes('separation_no_consent') || g.includes('three')) return 'The parties have lived apart for at least three continuous years immediately preceding the presentation of this Petition (MCA s.15(2)(f)).';
    if (g.includes('refusal') || g.includes('consummate')) return 'The Respondent has wilfully and persistently refused to consummate the marriage (MCA s.15(2)(a)).';
    if (g.includes('restitution')) return 'The Respondent has, for a period of not less than one year, failed to comply with a decree of restitution of conjugal rights (MCA s.15(2)(g)).';
    if (g.includes('death') || g.includes('absent') || g.includes('presumption')) return 'The other party to the marriage has been absent for such time and in such circumstances as to provide reasonable grounds for presuming that he or she is dead (MCA s.15(2)(h)); absence for at least seven years with no reason to believe the other party alive is sufficient proof (MCA s.16(2)(a)).';
    return 'The parties have lived apart for at least two continuous years immediately preceding the presentation of this Petition and the Respondent does not object (MCA s.15(2)(e)).';
  }
}
module.exports = CrossRiverDivorcePetitionTemplate;
