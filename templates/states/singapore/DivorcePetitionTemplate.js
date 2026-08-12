// templates/states/singapore/DivorcePetitionTemplate.js
// Singapore Originating Application for Divorce template
// Governing Law: Women's Charter 1961, Part X; Family Justice (General) Rules 2024

'use strict';

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Singapore Originating Application for Divorce Template
 *
 * Since 15 October 2024 (Family Justice (General) Rules 2024), Singapore uses an
 * "Originating Application" to initiate divorce proceedings, replacing the former
 * Writ for Divorce, Statement of Claim, and Statement of Particulars.
 *
 * Key Legal References:
 * - Women's Charter 1961, Part X — governs divorce for non-Muslim marriages
 *   - s.93: Jurisdiction — domicile or 3-year habitual residence
 *   - s.94: 3-year bar — no filing within 3 years of marriage unless leave granted
 *   - s.95: Irretrievable breakdown — sole ground
 *   - s.95A(1): Six facts proving irretrievable breakdown (6th added 1 July 2024)
 *   - s.112: Division of matrimonial assets — "just and equitable"
 *   - s.113-114: Maintenance of wife (gender-specific)
 * - Guardianship of Infants Act 1934 — welfare of child paramount
 * - Family Justice (General) Rules 2024 — procedural rules (effective 15 Oct 2024)
 *
 * IMPORTANT: Muslim marriages solemnized under the Administration of Muslim Law Act
 * 1966 (AMLA) are handled by the Syariah Court, not the Family Justice Courts.
 * This template applies ONLY to non-Muslim divorces.
 *
 * Residency Requirement (Women's Charter, s.93):
 * - Either party domiciled in Singapore at time of filing, OR
 * - Either party habitually resident in Singapore for 3 years before filing
 *
 * 3-Year Bar (Women's Charter, s.94):
 * - Cannot file within 3 years of marriage date unless court grants leave
 *   on grounds of exceptional hardship or exceptional depravity
 *
 * Singapore-Specific:
 * - Parties are "Applicant" and "Respondent" for filings from 15 October 2024
 *   ("Plaintiff/Defendant" only for pre-15-Oct-2024 writ filings)
 * - Court is the Family Justice Courts (established 2014)
 * - Filing fee: approx. SGD $200-$350 (legal aid available via Legal Aid Bureau)
 * - A4 paper size
 * - Case number: "No. FC/OA [number]/[year]" (the writ-era "Divorce Suit No." is obsolete)
 *
 * @class SingaporeDivorcePetitionTemplate
 * @extends BaseDivorcePetitionTemplate
 */
class SingaporeDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'SG';
    this.stateName = 'Singapore';
    this.countryCode = 'SG';
    this.documentTitle = 'ORIGINATING APPLICATION FOR DIVORCE';

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

    // Singapore jurisdiction: domicile OR 3-year habitual residence (Women's Charter s.93)
    this.residencyRequirements = {
      stateMonths: 36,
      countyDays: 0,
      description: 'Either party must be domiciled in Singapore at the time of filing, OR either party must have been habitually resident in Singapore for at least 3 years immediately before filing (Women\'s Charter, s.93).'
    };

    // No mandatory waiting period after filing; but 3-year bar from marriage date (s.94)
    this.waitingPeriod = {
      days: 0,
      description: 'No mandatory waiting period after filing. However, an application for divorce cannot be filed within 3 years of the date of marriage unless the court grants leave (Women\'s Charter, s.94).'
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
    return 'No. FC/OA';
  }

  getDefaultCourt(county) {
    return 'FAMILY JUSTICE COURTS';
  }

  /**
   * Singapore case caption uses "Applicant" and "Respondent" (filings from 15 Oct 2024).
   * Women's Charter proceedings use Originating Application filed in Family Justice Courts.
   */
  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county) || '[COURT NAME]').toUpperCase();
    const caseLabel = this.getCaseNumberLabel();
    const caseNumber = divorceData.caseNumber || '[NUMBER]/[YEAR]';

    const applicant = (divorceData.petitionerName || '[APPLICANT NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();

    const caption = [
      `IN THE ${courtName}`,
      `OF THE REPUBLIC OF SINGAPORE`,
      '',
      `${caseLabel} ${caseNumber}`,
      '',
      `BETWEEN:`,
      '',
      `${applicant}`,
      `Applicant`,
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
   * Singapore header.
   */
  generateHeader() {
    return 'REPUBLIC OF SINGAPORE';
  }

  /**
   * Singapore venue — Family Justice Courts (no sub-jurisdiction for a city-state).
   */
  generateVenue(county) {
    return 'IN THE FAMILY JUSTICE COURTS';
  }

  /**
   * Singapore jurisdiction statement — Women's Charter, s.93.
   */
  getJurisdictionStatement(divorceData) {
    return 'Either the Applicant or the Respondent is domiciled in Singapore at the date of this application, or has been habitually resident in Singapore for a period of at least 3 years immediately preceding the date of filing, as required by section 93 of the Women\'s Charter 1961.';
  }

  /**
   * Singapore venue reason — Family Justice Courts.
   */
  getVenueReason(divorceData) {
    return 'the Family Justice Courts have jurisdiction over divorce proceedings in Singapore';
  }

  /**
   * Singapore parties section uses "Applicant" and "Respondent".
   */
  generatePartiesSection(divorceData) {
    const items = [];
    let paragraphNum = 1;

    items.push({
      number: paragraphNum++,
      content: `The Applicant, ${divorceData.petitionerName || '[APPLICANT NAME]'}, is domiciled in or habitually resident in the Republic of Singapore.`,
      type: 'party_identification'
    });

    items.push({
      number: paragraphNum++,
      content: `The Respondent, ${divorceData.respondentName || '[RESPONDENT NAME]'}, is ${divorceData.respondentAddress ? `resident at ${divorceData.respondentAddress}` : 'a resident of Singapore'}.`,
      type: 'party_identification'
    });

    items.push({
      number: paragraphNum++,
      content: 'The marriage between the parties was not solemnized under Muslim law. This proceeding is brought under the Women\'s Charter 1961.',
      type: 'personal_law_declaration'
    });

    return {
      title: 'I. PARTIES',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Singapore relief section — Women's Charter terminology.
   * Uses "Applicant" / "Respondent" and Singapore-specific statutory references.
   */
  generateReliefSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 15;

    items.push({
      number: null,
      content: 'THE APPLICANT CLAIMS:',
      type: 'relief_intro'
    });

    const reliefItems = [
      'That the marriage between the Applicant and the Respondent be dissolved pursuant to section 95 of the Women\'s Charter 1961;',
      'That the matrimonial assets of the parties be divided in a just and equitable manner pursuant to section 112 of the Women\'s Charter 1961;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('That orders be made for custody, care and control, and access in respect of the child(ren) of the marriage, with the welfare of the child(ren) as the paramount consideration (Guardianship of Infants Act 1934);');
      reliefItems.push('That the Respondent pay maintenance for the child(ren) of the marriage pursuant to section 69 of the Women\'s Charter 1961;');
    }

    if (divorceData.spousalSupportRequested || divorceData.requestSpousalSupport) {
      reliefItems.push('That the Respondent pay maintenance to the Applicant pursuant to sections 113-114 of the Women\'s Charter 1961;');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`That the Applicant's former name, ${divorceData.previousName}, be restored;`);
    }

    reliefItems.push('Such further or other relief as this Honourable Court deems fit.');

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
      title: 'RELIEF CLAIMED',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Singapore verification text.
   * Affidavits in Singapore are sworn/affirmed under the Oaths and Declarations Act 2000.
   * Perjury is an offence under the Penal Code 1871, s.181/191.
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[APPLICANT NAME]';
    return `I, ${name}, the Applicant, do solemnly swear (or affirm) that the facts stated in this Originating Application for Divorce are true to the best of my knowledge, information, and belief.`;
  }

  /**
   * Singapore grounds for divorce.
   * Women's Charter, s.95: The sole ground is irretrievable breakdown, proved by one of six facts:
   *   (a) adultery — s.95A(1)(a)
   *   (b) unreasonable behaviour — s.95A(1)(b)
   *   (c) desertion for 2 years — s.95A(1)(c)
   *   (d) 3-year separation with consent — s.95A(1)(d)
   *   (e) 4-year separation without consent — s.95A(1)(e)
   *   (f) mutual agreement — s.95A(1)(f) (added 1 July 2024)
   *
   * Note: s.95 was repealed and re-enacted by the Women's Charter (Amendment) Act 2022.
   * The six facts are now in s.95A(1)(a)-(f), not the former s.95(3)(a)-(e).
   */
  getGroundsText(groundsForDivorce) {
    const g = (groundsForDivorce || 'separation_consent').toLowerCase();
    if (g.includes('adultery')) {
      return 'The Respondent has committed adultery and the Applicant finds it intolerable to live with the Respondent, within the meaning of section 95A(1)(a) of the Women\'s Charter 1961.';
    }
    if (g.includes('unreasonable') || g.includes('behaviour') || g.includes('cruelty')) {
      return 'The Respondent has behaved in such a way that the Applicant cannot reasonably be expected to live with the Respondent, within the meaning of section 95A(1)(b) of the Women\'s Charter 1961.';
    }
    if (g.includes('desertion')) {
      return 'The Respondent has deserted the Applicant for a continuous period of at least 2 years immediately preceding the filing of this application, within the meaning of section 95A(1)(c) of the Women\'s Charter 1961.';
    }
    if (g.includes('4') || g.includes('four') || g.includes('no_consent') || g.includes('without_consent')) {
      return 'The parties have lived apart for a continuous period of at least 4 years immediately preceding the filing of this application, within the meaning of section 95A(1)(e) of the Women\'s Charter 1961.';
    }
    if (g.includes('mutual') || g.includes('agreement')) {
      return 'Both parties agree that the marriage has broken down irretrievably, within the meaning of section 95A(1)(f) of the Women\'s Charter 1961.';
    }
    // Default: 3-year separation with consent
    return 'The parties have lived apart for a continuous period of at least 3 years immediately preceding the filing of this application, and the Respondent consents to a judgment being granted, within the meaning of section 95A(1)(d) of the Women\'s Charter 1961.';
  }

  /**
   * Singapore signature block uses "Applicant" label.
   */
  generateSignatureBlock(petitionerName) {
    const name = petitionerName || '[APPLICANT NAME]';
    return {
      line: '_________________________________',
      name,
      title: 'Applicant',
      date: 'Date: _____________________',
      formatted: `_________________________________\n${name}\nApplicant\n\nDate: _____________________`
    };
  }
}

module.exports = SingaporeDivorcePetitionTemplate;
