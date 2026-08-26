// templates/states/hong_kong/DivorcePetitionTemplate.js
// Hong Kong divorce petition template
// Governing Law: Matrimonial Causes Ordinance (Cap 179); Matrimonial Causes Rules (Cap 179A)

'use strict';

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Hong Kong Divorce Petition Template
 *
 * Hong Kong retains the traditional English-style "Petition" for divorce.
 * The standard form is Form 2 under the Matrimonial Causes Rules (Cap 179A).
 *
 * Key Legal References:
 * - Matrimonial Causes Ordinance (Cap 179) — grounds for divorce, procedure
 *   - s.11: sole ground is irretrievable breakdown of marriage
 *   - s.11A(2): five facts proving irretrievable breakdown (adultery, unreasonable
 *     behaviour, desertion 1 yr, separation 1 yr with consent, separation 2 yr)
 *   - s.11B: joint application by mutual agreement (1-yr separation or 1-yr prior notice)
 *   - s.12: 1-year bar — no petition within first year of marriage
 *   - s.3: domicile, 3-year habitual residence, or substantial connection requirement
 * - Matrimonial Proceedings and Property Ordinance (Cap 192) — financial provision,
 *   property adjustment, maintenance
 * - Guardianship of Minors Ordinance (Cap 13) — custody, care and control of children
 * - Matrimonial Causes Rules (Cap 179A) — prescribed forms and procedure
 *
 * Domicile / Residency (MCO s.3):
 * - Either party domiciled in HK, OR
 * - Either party habitually resident in HK for 3 continuous years before filing, OR
 * - Either party has a substantial connection with HK at the date of the petition
 *
 * One-Year Bar (MCO s.12):
 * - Cannot present a petition within 1 year of marriage (leave required for
 *   exceptional hardship or depravity of respondent)
 *
 * Process:
 * - Petition (Form 2) -> Acknowledgment of Service (Form 4) -> Decree Nisi ->
 *   6 weeks -> Application for Decree Absolute -> Decree Absolute
 *
 * Hong Kong-Specific:
 * - Parties are "Petitioner" and "Respondent" (traditional terminology)
 * - Court is Family Court (District Court level)
 * - Complex cases may be transferred to Court of First Instance (High Court)
 * - Filing fee: HKD $630 (uncontested) / HKD $1,045 (contested)
 * - A4 paper size
 * - Currency: HKD
 *
 * @class HongKongDivorcePetitionTemplate
 * @extends BaseDivorcePetitionTemplate
 */
class HongKongDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'HK';
    this.stateName = 'Hong Kong';
    this.countryCode = 'HK';

    // Hong Kong terminology (see templates/core/terminology.js): the caption is the
    // court-name line (Family Court / District Court); parties are
    // Petitioner/Respondent (Matrimonial Causes Ordinance, Cap 179). No "STATE
    // OF"/"COUNTY OF" caption lines and no "X County" body phrasing.
    this.terminology = {
      ...this.terminology,
      jurisdictionLabel: null,
      districtLabel: null,
      districtStyle: 'plain',
      jurisdictionTerm: 'Jurisdiction',
      districtTerm: 'Court location',
      districtPlaceholder: '[COURT LOCATION]',
      filerLabel: 'Petitioner',
      responderLabel: 'Respondent',
      selfRepresentedLabel: 'Self-Represented',
    };
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

    // HK jurisdiction: domicile, 3 years habitual residence, or substantial connection (MCO s.3)
    this.residencyRequirements = {
      stateMonths: 36,
      countyDays: 0,
      description: 'Either party must be domiciled in Hong Kong, have been habitually resident in Hong Kong for a continuous period of at least 3 years immediately before the presentation of the petition, OR have a substantial connection with Hong Kong at the date of the petition (Matrimonial Causes Ordinance, s.3).'
    };

    // No waiting period after filing, but 1-year bar on petitions within first year of marriage
    this.waitingPeriod = {
      days: 0,
      description: 'No mandatory waiting period after filing. However, no petition may be presented within the first year of marriage (MCO s.12). After Decree Nisi, 6 weeks must elapse before Decree Absolute.'
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
    return 'Number FCMC';
  }

  getDefaultCourt(county) {
    return 'DISTRICT COURT OF THE HONG KONG SPECIAL ADMINISTRATIVE REGION';
  }

  /**
   * Hong Kong case caption uses "Petitioner" and "Respondent".
   * Form 2 (Petition for Divorce) under the Matrimonial Causes Rules (Cap 179A).
   */
  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county) || '[COURT NAME]').toUpperCase();
    const caseLabel = this.getCaseNumberLabel();
    const caseNumber = divorceData.caseNumber || '[CASE NUMBER]';

    const petitioner = (divorceData.petitionerName || '[PETITIONER NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();

    const caption = [
      `IN THE ${courtName}`,
      `MATRIMONIAL CAUSES`,
      '',
      `${caseLabel} ${caseNumber}`,
      '',
      `IN THE MATTER OF THE MATRIMONIAL CAUSES ORDINANCE (CAP 179)`,
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
   * Hong Kong jurisdiction statement — Matrimonial Causes Ordinance, s.3.
   * Either party must be domiciled in HK, habitually resident for 3 years,
   * or have a substantial connection with HK at the date of the petition.
   */
  getJurisdictionStatement(divorceData) {
    return 'The Petitioner states that this Honourable Court has jurisdiction to hear this Petition by reason of the fact that [the Petitioner/the Respondent] is domiciled in Hong Kong / has been habitually resident in Hong Kong for a continuous period of at least three years immediately preceding the presentation of this Petition / had a substantial connection with Hong Kong at the date of the presentation of this Petition, as required by section 3 of the Matrimonial Causes Ordinance (Cap 179).';
  }

  /**
   * Hong Kong venue reason — Petitioner or Respondent connected with HK.
   */
  getVenueReason(divorceData) {
    return 'the Petitioner or Respondent is domiciled in, habitually resident in, or has a substantial connection with Hong Kong';
  }

  /**
   * Hong Kong relief section — uses traditional English-style relief requests.
   * Financial provision under Matrimonial Proceedings and Property Ordinance (Cap 192).
   * Custody under Guardianship of Minors Ordinance (Cap 13).
   */
  generateReliefSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 15;

    items.push({
      number: null,
      content: 'THE PETITIONER PRAYS:',
      type: 'relief_intro'
    });

    const reliefItems = [
      'That the said marriage be dissolved;',
      'That the Respondent do pay the costs of this suit;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('That the Petitioner be granted custody, care and control of the child(ren) of the family pursuant to the Guardianship of Minors Ordinance (Cap 13);');
      reliefItems.push('That the Respondent be ordered to pay periodical payments for the maintenance of the child(ren) of the family pursuant to section 5 of the Matrimonial Proceedings and Property Ordinance (Cap 192);');
    }

    if (divorceData.spousalSupportRequested || divorceData.requestSpousalSupport) {
      reliefItems.push('That the Respondent be ordered to pay periodical payments and/or a lump sum for the maintenance of the Petitioner pursuant to sections 3 and 4 of the Matrimonial Proceedings and Property Ordinance (Cap 192);');
    }

    if (divorceData.hasProperty !== false) {
      reliefItems.push('That such orders be made for the adjustment of property and financial provision as this Honourable Court thinks fit pursuant to sections 6 and 6A of the Matrimonial Proceedings and Property Ordinance (Cap 192);');
    }

    reliefItems.push('Such further or other relief as this Honourable Court deems just and expedient.');

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
      title: 'PRAYER',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Hong Kong verification text.
   * Hong Kong uses a sworn affidavit verifying the petition.
   * The Petitioner swears before a Commissioner for Oaths.
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PETITIONER NAME]';
    return `I, ${name}, the Petitioner named in this Petition, make oath and say that the facts stated in this Petition are true to the best of my knowledge, information and belief.`;
  }

  /**
   * Hong Kong grounds for divorce.
   * Matrimonial Causes Ordinance, s.11A(2) provides five facts proving irretrievable breakdown:
   *   (a) adultery + intolerability
   *   (b) unreasonable behaviour
   *   (c) desertion for 1 year
   *   (d) separation 1 year with consent
   *   (e) separation 2 years without consent
   * Additionally, s.11B provides for joint application by mutual agreement.
   */
  getGroundsText(groundsForDivorce) {
    const g = (groundsForDivorce || 'separation_consent').toLowerCase();
    if (g.includes('adultery')) {
      return 'The marriage has irretrievably broken down in that the Respondent has committed adultery and the Petitioner finds it intolerable to live with the Respondent (Matrimonial Causes Ordinance (Cap 179), s.11A(2)(a)).';
    }
    if (g.includes('unreasonable') || g.includes('behaviour') || g.includes('cruelty') || g.includes('violence')) {
      return 'The marriage has irretrievably broken down in that the Respondent has behaved in such a way that the Petitioner cannot reasonably be expected to live with the Respondent (Matrimonial Causes Ordinance (Cap 179), s.11A(2)(b)).';
    }
    if (g.includes('desertion')) {
      return 'The marriage has irretrievably broken down in that the Respondent has deserted the Petitioner for a continuous period of at least one year immediately preceding the presentation of this Petition (Matrimonial Causes Ordinance (Cap 179), s.11A(2)(c)).';
    }
    if (g.includes('mutual') || g.includes('joint') || g.includes('agreement')) {
      return 'Both parties jointly apply for divorce by mutual agreement. The parties have lived apart for a continuous period of at least one year, or have given at least one year\'s prior written notice of their intention to jointly apply (Matrimonial Causes Ordinance (Cap 179), s.11B).';
    }
    if (g.includes('no_consent') || g.includes('no consent') || g.includes('two')) {
      return 'The marriage has irretrievably broken down in that the parties to the marriage have lived apart for a continuous period of at least two years immediately preceding the presentation of this Petition (Matrimonial Causes Ordinance (Cap 179), s.11A(2)(e)).';
    }
    // Default: 1-year separation with consent
    return 'The marriage has irretrievably broken down in that the parties to the marriage have lived apart for a continuous period of at least one year immediately preceding the presentation of this Petition and the Respondent consents to the grant of a decree (Matrimonial Causes Ordinance (Cap 179), s.11A(2)(d)).';
  }
}

module.exports = HongKongDivorcePetitionTemplate;
