// templates/states/quebec/DivorcePetitionTemplate.js
// Quebec divorce application template
// Governing Law: Divorce Act (RSC 1985, c. 3); Code of Civil Procedure, CQLR c. C-25.01

'use strict';

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Quebec Divorce Application Template
 *
 * Quebec divorce follows the federal Divorce Act but is procedurally governed
 * by Quebec's Code of Civil Procedure. Quebec is a CIVIL LAW province, which
 * creates unique considerations:
 *   - Property division follows the Quebec Civil Code (CCQ) arts. 414-426
 *     (family patrimony / patrimoine familial) and arts. 448-484 (partnership of acquests by default)
 *   - Quebec notaries (notaires) can draft consent agreements (protocole d'entente)
 *     as authentic acts — binding without court approval in some cases
 *
 * Key Legal References:
 * - Divorce Act, RSC 1985, c. 3 (federal — grounds and divorce order)
 *   - s.8(2)(a): 1-year separation (séparation d'un an)
 *   - s.8(2)(b)(i): Adultery (adultère)
 *   - s.8(2)(b)(ii): Physical or mental cruelty (cruauté physique ou mentale)
 * - Civil Code of Quebec, CQLR c. CCQ-1991 (provincial):
 *   - Arts. 414-426: Family patrimony (patrimoine familial) — mandatory equal division of:
 *     family residences, family vehicles, RRSPs/pension plans, furnishings
 *   - Arts. 448-484: Partnership of acquests (société d'acquêts) — default matrimonial regime
 *   - Arts. 597-612: Parental authority (autorité parentale) and custody
 * - Code of Civil Procedure, CQLR c. C-25.01 (procedure)
 * - Federal Child Support Guidelines, SOR/97-175
 *
 * Residency Requirement (Divorce Act, s.3):
 * - Either spouse must have been ordinarily resident in Quebec for at least 1 year.
 *
 * Quebec-Specific:
 * - Parties: Plaintiff (Demandeur/Demanderesse) and Defendant (Défendeur/Défenderesse)
 *   (Quebec civil law terminology — not common-law "Petitioner/Respondent")
 * - Court: Superior Court (Cour supérieure) — the only court with jurisdiction for divorce
 * - Judicial districts: Montréal, Québec, Longueuil, Laval, Gatineau, Sherbrooke, Trois-Rivières, etc.
 * - No. de dossier (court file number) instead of "Court File No."
 * - Bilingual court forms available (French/English)
 * - Quebec's family patrimony regime is MANDATORY — cannot be waived by contract
 *
 * @class QuebecDivorcePetitionTemplate
 * @extends BaseDivorcePetitionTemplate
 */
class QuebecDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'QC';
    this.stateName = 'Quebec';
    this.countryCode = 'CA';
    this.documentTitle = 'APPLICATION FOR DIVORCE\n(DEMANDE EN DIVORCE)';

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

    this.residencyRequirements = {
      stateMonths: 12,
      countyDays: 0,
      description: 'Either spouse must have been ordinarily resident in Quebec for at least one year immediately before the application (Divorce Act, s.3(1)).'
    };

    this.waitingPeriod = {
      days: 0,
      description: 'No mandatory waiting period after filing. The 1-year separation must be complete before judgment.'
    };

    this.formatting = {
      fontSize: '12pt',
      fontFamily: 'Times New Roman',
      lineHeight: '1.5',
      margin: '1in',
      paperSize: '8.5in x 11in'
    };
  }

  getCaseNumberLabel() {
    return 'No. :';
  }

  getDefaultCourt(county) {
    const district = (county || '[JUDICIAL DISTRICT]').toUpperCase();
    return `SUPERIOR COURT (COUR SUPÉRIEURE) — DISTRICT OF ${district}`;
  }

  /**
   * Quebec case caption uses "Plaintiff" (Demandeur/Demanderesse) and "Defendant"
   * (Défendeur/Défenderesse) per Quebec civil law (Code of Civil Procedure, CQLR c. C-25.01).
   * Quebec is a civil law jurisdiction — not "Petitioner/Respondent".
   */
  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county) || '[COURT NAME]').toUpperCase();
    const caseLabel = this.getCaseNumberLabel();
    const caseNumber = divorceData.caseNumber || '[FILE NUMBER]';

    const plaintiff = (divorceData.petitionerName || '[PLAINTIFF NAME]').toUpperCase();
    const defendant = (divorceData.respondentName || '[DEFENDANT NAME]').toUpperCase();

    const caption = [
      `${courtName}`,
      '',
      `${caseLabel} ${caseNumber}`,
      '',
      `${plaintiff},`,
      `Plaintiff (Demandeur/Demanderesse)`,
      '',
      `v.`,
      '',
      `${defendant},`,
      `Defendant (Défendeur/Défenderesse)`
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
   * Quebec jurisdiction statement — Divorce Act, s.3(1).
   * Either spouse must have been ordinarily resident in Quebec for 1 year.
   * Quebec civil law tradition: parties are "Plaintiff" (Demandeur/Demanderesse) and
   * "Defendant" (Défendeur/Défenderesse) — not "Petitioner/Respondent".
   * Quebec Code of Civil Procedure, CQLR c. C-25.01.
   */
  getJurisdictionStatement(divorceData) {
    return `Either the Plaintiff or the Defendant has been ordinarily resident in the Province of Quebec for at least one year immediately preceding the filing of this Application, as required by section 3(1) of the Divorce Act, RSC 1985, c. 3 / La Loi sur le divorce, LRC 1985, c. 3.`;
  }

  /**
   * Quebec venue reason — Plaintiff or Defendant resides in this judicial district.
   */
  getVenueReason(divorceData) {
    const district = divorceData.county || '[JUDICIAL DISTRICT]';
    return `the Plaintiff or Defendant resides in the judicial district of ${district}`;
  }

  getGroundsText(groundsForDivorce) {
    const g = (groundsForDivorce || 'separation').toLowerCase();
    if (g.includes('adultery')) {
      // Quebec civil law: parties are Plaintiff (Demandeur/Demanderesse) and Defendant (Défendeur/Défenderesse)
      return 'The Defendant has committed adultery within the meaning of paragraph 8(2)(b)(i) of the Divorce Act.';
    }
    if (g.includes('cruelty') || g.includes('violence')) {
      return 'The Defendant has treated the Plaintiff with physical or mental cruelty of such a kind as to render intolerable the continued cohabitation of the spouses, within the meaning of paragraph 8(2)(b)(ii) of the Divorce Act.';
    }
    return 'The spouses have lived separate and apart for at least one year immediately preceding the determination of this proceeding, within the meaning of paragraph 8(2)(a) of the Divorce Act.';
  }

  /**
   * Quebec relief section — uses Canadian Divorce Act corollary relief terminology.
   * "Corollary relief" (not "ancillary relief") is the correct term under the Divorce Act.
   * Post-March 1, 2021 amendments (Bill C-78): "parenting time" and
   * "decision-making responsibility" replace "custody" and "access" (Divorce Act, ss.16.1-16.92).
   * Quebec CCQ arts. 414-426 (family patrimony) and arts. 448-484 (partnership of acquests)
   * govern property division — both mandatory (family patrimony cannot be waived).
   * Plaintiff/Defendant labels per Quebec Code of Civil Procedure, CQLR c. C-25.01.
   */
  generateReliefSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 15;

    items.push({
      number: null,
      content: 'THE PLAINTIFF SEEKS / LA DEMANDERESSE DEMANDE:',
      type: 'relief_intro'
    });

    const reliefItems = [
      'A divorce order pursuant to section 8 of the Divorce Act, RSC 1985, c. 3 / en vertu de l\'article 8 de la Loi sur le divorce, LRC 1985, c. 3;',
      'Partition of the family patrimony pursuant to articles 414-426 of the Civil Code of Quebec, CQLR c. CCQ-1991 (patrimoine familial — mandatory equal division);',
      'Settlement of the matrimonial regime pursuant to articles 448-484 of the Civil Code of Quebec (société d\'acquêts by default — partnership of acquests);',
      'An order allocating responsibility for joint debts in an equitable manner;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('A parenting order specifying parenting time (temps parental) and decision-making responsibility (responsabilité décisionnelle) pursuant to section 16.1 of the Divorce Act;');
      reliefItems.push('A child support order pursuant to section 15.1 of the Divorce Act and the Federal Child Support Guidelines, SOR/97-175 / Lignes directrices fédérales sur les pensions alimentaires pour enfants, DORS/97-175;');
    }

    if (divorceData.spousalSupportRequested || divorceData.requestSpousalSupport) {
      reliefItems.push('A spousal support order pursuant to section 15.2 of the Divorce Act, as corollary relief / à titre de mesure accessoire en vertu de l\'article 15.2 de la Loi sur le divorce;');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`An order restoring the Plaintiff's former name: ${divorceData.previousName};`);
    }

    reliefItems.push('Such further and other relief as this Court deems just and appropriate / Tout autre redressement que le Tribunal jugera juste et approprié.');

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
      title: 'RELIEF REQUESTED / CONCLUSIONS RECHERCHÉES',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Quebec verification text.
   * Quebec uses a solemn affirmation under the Code of Civil Procedure, CQLR c. C-25.01.
   * "Penalty of perjury" is a US concept; false declarations in Quebec are an offence
   * under Criminal Code, RSC 1985, c. C-46, s.131 (perjury) or s.137 (fabricating evidence).
   * Correct party label is "Plaintiff" (Demandeur/Demanderesse) per Quebec civil law.
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PLAINTIFF NAME]';
    return `I, ${name}, Plaintiff (Demandeur/Demanderesse), solemnly affirm that the facts stated in this Application for Divorce are true, to the best of my knowledge, information, and belief.`;
  }
}

module.exports = QuebecDivorcePetitionTemplate;
