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
 *   - Property division follows the Quebec Civil Code (CCQ) arts. 394-430
 *     (family patrimony) and arts. 448-484 (partnership of acquests by default)
 *   - Quebec notaries (notaires) can draft consent agreements (protocole d'entente)
 *     as authentic acts — binding without court approval in some cases
 *
 * Key Legal References:
 * - Divorce Act, RSC 1985, c. 3 (federal — grounds and divorce order)
 *   - s.8(2)(a): 1-year separation (séparation d'un an)
 *   - s.8(2)(b): Adultery or physical/mental cruelty
 * - Civil Code of Quebec, CQLR c. CCQ-1991 (provincial):
 *   - Arts. 394-430: Family patrimony (patrimoine familial) — mandatory equal division of:
 *     family residences, family vehicles, RRSPs/pension plans, furnishings
 *   - Arts. 448-484: Partnership of acquests (société d'acquêts) — default matrimonial regime
 *   - Arts. 524-540: Parental authority; arts. 605-612: Custody
 * - Code of Civil Procedure, CQLR c. C-25.01 (procedure)
 * - Federal Child Support Guidelines, SOR/97-175
 *
 * Residency Requirement (Divorce Act, s.3):
 * - Either spouse must have been ordinarily resident in Quebec for at least 1 year.
 *
 * Quebec-Specific:
 * - Parties: Petitioner (Demandeur/Demanderesse) and Respondent (Défendeur/Défenderesse)
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

  getGroundsStatement(groundsForDivorce) {
    const g = (groundsForDivorce || 'separation').toLowerCase();
    if (g.includes('adultery')) {
      return 'The Respondent has committed adultery within the meaning of paragraph 8(2)(b)(i) of the Divorce Act.';
    }
    if (g.includes('cruelty') || g.includes('violence')) {
      return 'The Respondent has treated the Petitioner with physical or mental cruelty of such a kind as to render intolerable the continued cohabitation of the spouses, within the meaning of paragraph 8(2)(b)(ii) of the Divorce Act.';
    }
    return 'The spouses have lived separate and apart for at least one year immediately preceding the determination of this proceeding, within the meaning of paragraph 8(2)(a) of the Divorce Act.';
  }
}

module.exports = QuebecDivorcePetitionTemplate;
