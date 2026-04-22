// templates/states/quebec/AffidavitTemplate.js
// Quebec affidavit template — déclaration sous serment
// Governing Law: Code of Civil Procedure, CQLR c. C-25.01; Civil Code of Quebec

'use strict';

const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * Quebec Affidavit Template (Déclaration sous serment)
 *
 * Key compliance notes:
 * - Quebec is a CIVIL LAW province — affidavits follow a different tradition than common-law provinces
 * - Sworn before a Commissioner for Oaths (Commissaire à l'assermentation) or Notary (Notaire)
 * - Quebec notaries (notaires) have broader powers than common-law notaries — they can draft
 *   legally binding notarial acts (actes authentiques)
 * - Uses "Province de Québec / Province of Quebec"
 * - Superior Court uses judicial districts (Montréal, Québec, Longueuil, etc.)
 * - No. de dossier / Court File No. instead of Case No.
 * - Family proceedings: Plaintiff (Demandeur/Demanderesse) / Defendant (Défendeur/Défenderesse)
 *   (Quebec civil law terminology — not "Petitioner/Respondent" as in common-law provinces)
 *
 * @class QuebecAffidavitTemplate
 * @extends BaseAffidavitTemplate
 */
class QuebecAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;       // "QC"
    this.stateName = this.metadata.stateName;   // "Quebec"
    this.countryCode = 'CA';
    this.requiredFields = this.metadata.requiredFields;

    this.sections.perjuryStatement = false;
  }

  /**
   * Quebec header uses province designation.
   */
  generateHeader() {
    return 'PROVINCE OF QUEBEC';
  }

  /**
   * Quebec venue — judicial district of filing.
   * Quebec uses judicial districts, not counties.
   */
  generateVenue(county) {
    const district = (county || '[JUDICIAL DISTRICT]').toUpperCase();
    return `DISTRICT OF ${district}`;
  }

  /**
   * Quebec case caption.
   * Superior Court (Cour supérieure) uses judicial district and "No. :" file number.
   */
  generateCaseCaption(affidavitData) {
    const district = (affidavitData.county || affidavitData.city || '[JUDICIAL DISTRICT]').toUpperCase();
    const fileNo = affidavitData.caseNumber || '[FILE NUMBER]';
    const plaintiff = affidavitData.plaintiff || affidavitData.petitionerName || '[PLAINTIFF / DEMANDEUR]';
    const defendant = affidavitData.defendant || affidavitData.respondentName || '[DEFENDANT / DÉFENDEUR]';

    const formatted =
      `SUPERIOR COURT\n` +
      `(COUR SUPÉRIEURE)\n` +
      `PROVINCE OF QUEBEC\n` +
      `DISTRICT OF ${district}\n\n` +
      `No. : ${fileNo}\n\n` +
      `${plaintiff.toUpperCase()},\n` +
      `Plaintiff (Demandeur/Demanderesse)\n\n` +
      `v.\n\n` +
      `${defendant.toUpperCase()},\n` +
      `Defendant (Défendeur/Défenderesse)`;

    return {
      courtName: `Superior Court — District of ${district}`,
      caseNumber: affidavitData.caseNumber,
      plaintiff: plaintiff,
      defendant: defendant,
      formatted
    };
  }

  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    if (!affidavitData.county && !affidavitData.city) {
      errors.push('Judicial district (city) is required for Quebec Superior Court filings.');
    }

    return { errors, warnings };
  }

  /**
   * Quebec jurat — sworn before Commissioner for Oaths or Notary.
   * Bilingual format (English/French).
   */
  generateNotaryBlock(affidavitData) {
    const city = affidavitData.county || affidavitData.city || '_______________';
    return (
      `SWORN / DÉCLARÉ SOUS SERMENT before me / devant moi\n` +
      `at / à ${city}, in the Province of Quebec / dans la Province de Québec,\n` +
      `this / le _____ day of / jour de _________________, _______.\n\n` +
      `________________________________\n` +
      `Commissioner for Oaths / Commissaire à l'assermentation\n` +
      `in and for the Province of Quebec / dans et pour la Province de Québec`
    );
  }
}

module.exports = QuebecAffidavitTemplate;
