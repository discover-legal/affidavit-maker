// templates/states/tamil_nadu/DivorcePetitionTemplate.js
'use strict';
const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

class TamilNaduDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  // Indian terminology (see templates/core/terminology.js): the caption is the
  // court-name line (Family Court / District Court) + district; parties are
  // Petitioner/Respondent (HMA 1955 / SMA 1954). No "STATE OF"/"COUNTY OF"
  // caption lines and no "X County" body phrasing.
  constructor() {
    super();
    this.state = 'IN_TN'; this.stateName = 'Tamil Nadu'; this.countryCode = 'IN'; this.terminology = { ...this.terminology, jurisdictionLabel: null, districtLabel: null, districtStyle: 'plain', jurisdictionTerm: 'State', districtTerm: 'District', districtPlaceholder: '[DISTRICT]', filerLabel: 'Petitioner', responderLabel: 'Respondent', selfRepresentedLabel: 'Self-Represented' };
    this.documentTitle = 'PETITION FOR DIVORCE';
    try { this.metadata = require('./metadata.json'); } catch (e) { this.metadata = null; }
    this.requiredFields = ['petitionerName', 'respondentName', 'state', 'county', 'marriageDate', 'groundsForDivorce'];
    this.residencyRequirements = { stateMonths: 0, countyDays: 0, description: 'HMA s.19 / SMA s.31 jurisdiction rules.' };
    this.waitingPeriod = { days: 180, description: '6-month cooling-off (waivable per Amardeep Singh v. Harveen Kaur (2017)). Supreme Court may also grant divorce directly under Art. 142 on irretrievable breakdown (Shilpa Sailesh v. Varun Sreenivasan (2023)).' };
    this.formatting = { fontSize: '12pt', fontFamily: 'Times New Roman', lineHeight: '1.5', margin: '1in', paperSize: 'A4' };
  }
  // Chennai Family Court dockets divorce petitions as "O.P. No." (Original Petition)
  getCaseNumberLabel() { return 'O.P. No.'; }
  // Prefer the filer's own district/city over the hardcoded default court
  getDefaultCourt(county) {
    const loc = county && String(county).trim();
    if (loc && loc.toUpperCase() !== 'CHENNAI') return `FAMILY COURT, ${loc.toUpperCase()}`;
    return 'FAMILY COURT, CHENNAI';
  }
  generateCaseCaption(dd) {
    const cn = (dd.court || this.getDefaultCourt(dd.county || dd.city)).toUpperCase(); const no = dd.caseNumber || '[CASE NUMBER]';
    const p = (dd.petitionerName || '[PETITIONER NAME]').toUpperCase(); const r = (dd.respondentName || '[RESPONDENT NAME]').toUpperCase();
    const g = (dd.groundsForDivorce || 'mutual_consent').toLowerCase();
    // Mutual-consent petitions are presented jointly (HMA s.13B(1) / SMA s.28(1))
    const partyLines = (g.includes('mutual') || g.includes('consent'))
      ? [p, 'Petitioner No. 1', '', 'AND', '', r, 'Petitioner No. 2']
      : [p, 'Petitioner', '', 'VERSUS', '', r, 'Respondent'];
    return { courtName: cn, caseNumber: dd.caseNumber, petitioner: dd.petitionerName, respondent: dd.respondentName, formatted: [`IN THE ${cn}`, '', `${this.getCaseNumberLabel()} ${no}`, '', 'IN THE MATTER OF:', '', ...partyLines].join('\n') };
  }
  getJurisdictionStatement() { return `This Hon'ble Court has jurisdiction under HMA s.19 / SMA s.31.`; }
  getVenueReason(dd) { return `the Petitioner or Respondent resides at ${dd.county || 'Chennai'}`; }
  generateReliefSection(dd) {
    const items = []; items.push({ number: null, content: 'PRAYER: It is most respectfully prayed that this Hon\'ble Court may be pleased to:', type: 'relief_intro' });
    const r = ['Pass a decree of divorce;', 'Grant maintenance as deemed fit;'];
    if (dd.hasMinorChildren === true || dd.children?.length > 0) { r.push('Grant custody of the child(ren);'); r.push('Direct child maintenance under HMA s.26 / BNSS s.144;'); }
    if (dd.spousalSupportRequested) r.push('Grant maintenance pendente lite under HMA s.24;');
    r.push('Pass any other order(s) as deemed fit.'); r.forEach((x, i) => items.push({ number: null, content: x, type: 'relief_item', style: 'letter', letter: String.fromCharCode(97+i) }));
    return { title: 'PRAYER', items, nextParagraphNumber: dd._paragraphNum || 15 };
  }
  getVerificationText(dd) { return `Verified at Chennai on this _____ day of __________, _______. I, ${dd.petitionerName || '[PETITIONER NAME]'}, verify that the contents are true and correct.`; }
  getGroundsText(g) {
    const s = (g || 'mutual_consent').toLowerCase();
    if (s.includes('mutual') || s.includes('consent')) return 'The parties have mutually consented to dissolve the marriage (HMA s.13B / SMA s.28).';
    if (s.includes('adultery')) return 'The Respondent has committed adultery (HMA s.13(1)(i)).';
    if (s.includes('cruelty')) return 'The Respondent has treated the Petitioner with cruelty (HMA s.13(1)(ia)).';
    if (s.includes('desertion')) return 'The Respondent has deserted the Petitioner for not less than two years (HMA s.13(1)(ib)).';
    if (s.includes('judicial')) return 'There has been no resumption of cohabitation as between the parties to the marriage for a period of one year or upwards after the passing of a decree for judicial separation in a proceeding to which they were parties (HMA s.13(1A)(i)).';
    if (s.includes('restitution')) return 'There has been no restitution of conjugal rights as between the parties to the marriage for a period of one year or upwards after the passing of a decree for restitution of conjugal rights in a proceeding to which they were parties (HMA s.13(1A)(ii)).';
    if (s.includes('bigamy')) return 'The Respondent husband had married again before the commencement of the Hindu Marriage Act 1955 (18 May 1955), or another wife of the husband married before such commencement was alive at the time of the solemnization of the marriage of the Petitioner, and that other wife was alive at the presentation of this petition (HMA s.13(2)(i); wife only).';
    if (s.includes('rape') || s.includes('sodomy') || s.includes('bestiality')) return 'The Respondent husband has, since the solemnization of the marriage, been guilty of rape, sodomy or bestiality (HMA s.13(2)(ii); wife only).';
    if (s.includes('maintenance') && s.includes('cohabitation')) return 'A decree or order awarding maintenance to the Petitioner wife notwithstanding that she was living apart has been passed against the Respondent husband (Hindu Adoptions and Maintenance Act 1956 s.18, or CrPC s.125 — now BNSS s.144), and cohabitation between the parties has not been resumed for one year or upwards since (HMA s.13(2)(iii); wife only).';
    if (s.includes('puberty') || s.includes('repudiat')) return 'The marriage of the Petitioner (whether consummated or not) was solemnized before she attained the age of fifteen years, and she repudiated the marriage after attaining that age but before attaining the age of eighteen years (HMA s.13(2)(iv); wife only).';
    return 'The parties have mutually consented to dissolve the marriage (HMA s.13B / SMA s.28).';
  }
}
module.exports = TamilNaduDivorcePetitionTemplate;
