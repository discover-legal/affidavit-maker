// templates/states/maharashtra/DivorcePetitionTemplate.js
// Maharashtra divorce petition template
// Governing Law: Hindu Marriage Act 1955 / Special Marriage Act 1954 / Divorce Act, 1869

'use strict';

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

class MaharashtraDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();
    this.state = 'IN_MH';
    this.stateName = 'Maharashtra';
    this.countryCode = 'IN';
    this.documentTitle = 'PETITION FOR DIVORCE';
    try { this.metadata = require('./metadata.json'); } catch (e) { this.metadata = null; }
    this.requiredFields = ['petitionerName', 'respondentName', 'state', 'county', 'marriageDate', 'groundsForDivorce'];
    this.residencyRequirements = { stateMonths: 0, countyDays: 0, description: 'Filed where the marriage was solemnized, or where the parties last resided together, or where the respondent resides, or where the petitioner (wife) resides (HMA s.19).' };
    this.waitingPeriod = { days: 180, description: 'Mutual consent: 6-month cooling-off period (may be waived per Amardeep Singh v. Harveen Kaur (2017)). Supreme Court may also grant divorce directly under Art. 142 on irretrievable breakdown (Shilpa Sailesh v. Varun Sreenivasan (2023)).' };
    this.formatting = { fontSize: '12pt', fontFamily: 'Times New Roman', lineHeight: '1.5', margin: '1in', paperSize: 'A4' };
  }

  // Family Court, Mumbai dockets matrimonial matters as "Petition No. A-.../year"
  getCaseNumberLabel() { return 'Petition No.'; }
  // Prefer the filer's own district/city over the hardcoded default court
  getDefaultCourt(county) {
    const loc = county && String(county).trim();
    if (loc && loc.toUpperCase() !== 'MUMBAI') return `FAMILY COURT, ${loc.toUpperCase()}`;
    return 'FAMILY COURT, BANDRA, MUMBAI';
  }

  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county || divorceData.city)).toUpperCase();
    const caseNumber = divorceData.caseNumber || '[CASE NUMBER]';
    const petitioner = (divorceData.petitionerName || '[PETITIONER NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();
    // Mutual-consent petitions are presented jointly (HMA s.13B(1) / SMA s.28(1))
    const g = (divorceData.groundsForDivorce || 'mutual_consent').toLowerCase();
    const joint = g.includes('mutual') || g.includes('consent');
    const partyLines = joint
      ? [petitioner, 'Petitioner No. 1', '', 'AND', '', respondent, 'Petitioner No. 2']
      : [petitioner, 'Petitioner', '', 'VERSUS', '', respondent, 'Respondent'];
    const caption = [`IN THE ${courtName}`, '', `${this.getCaseNumberLabel()} ${caseNumber}`, '', 'IN THE MATTER OF:', '', ...partyLines].join('\n');
    return { courtName, caseNumber: divorceData.caseNumber, petitioner: divorceData.petitionerName, respondent: divorceData.respondentName, formatted: caption };
  }

  getJurisdictionStatement(divorceData) {
    return `This Hon'ble Court has jurisdiction to entertain this petition as the marriage was solemnized / the parties last resided together / the Respondent resides / the Petitioner (wife) resides within the jurisdiction of this Court, as required under Section 19 of the Hindu Marriage Act 1955 / Section 31 of the Special Marriage Act 1954 (as applicable).`;
  }

  getVenueReason(divorceData) {
    const location = divorceData.county || 'Mumbai';
    return `the Petitioner or Respondent resides within the jurisdiction of this Court at ${location}`;
  }

  generateReliefSection(divorceData) {
    const items = [];
    items.push({ number: null, content: 'PRAYER: It is, therefore, most respectfully prayed that this Hon\'ble Court may be pleased to:', type: 'relief_intro' });
    const reliefItems = ['Pass a decree of divorce dissolving the marriage between the Petitioner and the Respondent;', 'Grant permanent alimony / maintenance as this Hon\'ble Court deems fit and proper;'];
    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('Grant custody of the minor child(ren) to the Petitioner / Respondent as this Court deems appropriate;');
      reliefItems.push('Direct payment of maintenance for the minor child(ren) under Section 26 of the HMA / BNSS s.144;');
    }
    if (divorceData.spousalSupportRequested || divorceData.requestSpousalSupport) {
      reliefItems.push('Grant maintenance pendente lite and expenses of the proceedings under Section 24 of the HMA;');
    }
    reliefItems.push('Pass any other order(s) as this Hon\'ble Court may deem fit and proper.');
    reliefItems.forEach((relief, index) => { items.push({ number: null, content: relief, type: 'relief_item', style: 'letter', letter: String.fromCharCode(97 + index) }); });
    return { title: 'PRAYER', items, nextParagraphNumber: divorceData._paragraphNum || 15 };
  }

  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PETITIONER NAME]';
    return `Verified at Mumbai on this _____ day of __________, _______. I, ${name}, the Petitioner above-named, do hereby verify that the contents of the above petition are true and correct to the best of my knowledge and belief and nothing material has been concealed therefrom.`;
  }

  getGroundsText(groundsForDivorce) {
    const g = (groundsForDivorce || 'mutual_consent').toLowerCase();
    if (g.includes('mutual') || g.includes('consent')) return 'The Petitioner and Respondent have been living separately for more than one year and have mutually consented to dissolve the marriage under Section 13B of the Hindu Marriage Act 1955 / Section 28 of the Special Marriage Act 1954.';
    if (g.includes('adultery')) return 'The Respondent has had voluntary sexual intercourse with a person other than the Petitioner after solemnization of the marriage (HMA s.13(1)(i)).';
    if (g.includes('cruelty')) return 'The Respondent has treated the Petitioner with cruelty (HMA s.13(1)(ia)).';
    if (g.includes('desertion')) return 'The Respondent has deserted the Petitioner for a continuous period of not less than two years (HMA s.13(1)(ib)).';
    if (g.includes('judicial')) return 'There has been no resumption of cohabitation as between the parties to the marriage for a period of one year or upwards after the passing of a decree for judicial separation in a proceeding to which they were parties (HMA s.13(1A)(i)).';
    if (g.includes('restitution')) return 'There has been no restitution of conjugal rights as between the parties to the marriage for a period of one year or upwards after the passing of a decree for restitution of conjugal rights in a proceeding to which they were parties (HMA s.13(1A)(ii)).';
    if (g.includes('bigamy')) return 'The Respondent husband had married again before the commencement of the Hindu Marriage Act 1955 (18 May 1955), or another wife of the husband married before such commencement was alive at the time of the solemnization of the marriage of the Petitioner, and that other wife was alive at the presentation of this petition (HMA s.13(2)(i); wife only).';
    if (g.includes('rape') || g.includes('sodomy') || g.includes('bestiality')) return 'The Respondent husband has, since the solemnization of the marriage, been guilty of rape, sodomy or bestiality (HMA s.13(2)(ii); wife only).';
    if (g.includes('maintenance') && g.includes('cohabitation')) return 'A decree or order awarding maintenance to the Petitioner wife notwithstanding that she was living apart has been passed against the Respondent husband (Hindu Adoptions and Maintenance Act 1956 s.18, or CrPC s.125 — now BNSS s.144), and cohabitation between the parties has not been resumed for one year or upwards since (HMA s.13(2)(iii); wife only).';
    if (g.includes('puberty') || g.includes('repudiat')) return 'The marriage of the Petitioner (whether consummated or not) was solemnized before she attained the age of fifteen years, and she repudiated the marriage after attaining that age but before attaining the age of eighteen years (HMA s.13(2)(iv); wife only).';
    return 'The Petitioner and Respondent have been living separately for more than one year and have mutually consented to dissolve the marriage under Section 13B of the Hindu Marriage Act 1955 / Section 28 of the Special Marriage Act 1954.';
  }
}

module.exports = MaharashtraDivorcePetitionTemplate;
