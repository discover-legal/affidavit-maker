'use strict';

/**
 * DivorceDocumentGenerator
 *
 * Generates `{ sections, metadata }` objects for all divorce document types
 * across all 27 supported jurisdictions (17 US states + 10 Canadian provinces).
 *
 * The returned `sections` shape is consumed directly by pdfService.buildPDF()
 * and the /api/documents/preview HTML renderer.
 *
 * Usage:
 *   const gen = require('./DivorceDocumentGenerator');
 *   const doc = gen.generate('TX', 'divorce_petition', affidavitData);
 *   // doc.sections → passed to pdfService
 *   // doc.metadata → passed to pdfService
 */

// ─── State configuration ──────────────────────────────────────────────────────

const normalizeCountyName = (county) =>
  typeof county === 'string' ? county.replace(/\s+county$/i, '').trim() : county;

const STATE_CONFIG = {
  TX: {
    name: 'Texas',
    court: (county) => `IN THE DISTRICT COURT\n${county ? county.toUpperCase() + ' COUNTY, TEXAS' : '__________ COUNTY, TEXAS'}`,
    caseLabel: 'CAUSE NO.',
    petitionTitle: 'ORIGINAL PETITION FOR DIVORCE',
    decreeTitle: "FINAL DECREE OF DIVORCE",
    grounds: (data) => data.grounds || 'insupportability',
    residencyReq: '6 months in state, 90 days in county',
    notary: (county) => `STATE OF TEXAS\nCOUNTY OF ${county ? county.toUpperCase() : '__________'}\n\nBefore me, the undersigned authority, personally appeared the above-named Petitioner, known to me to be a credible person, and who, being duly sworn by me, stated that the facts contained herein are true and correct.\n\n_______________________________\nNotary Public, State of Texas\nMy Commission Expires: __________`,
    perjury: 'I declare under penalty of perjury under the laws of the State of Texas that the foregoing is true and correct.',
  },
  AZ: {
    name: 'Arizona',
    court: (county) => `IN THE SUPERIOR COURT OF THE STATE OF ARIZONA\nIN AND FOR THE COUNTY OF ${county ? county.toUpperCase() : '__________'}`,
    caseLabel: 'CASE NO.',
    petitionTitle: 'PETITION FOR DISSOLUTION OF MARRIAGE',
    decreeTitle: 'DECREE OF DISSOLUTION OF MARRIAGE',
    grounds: () => 'irretrievable breakdown of the marriage',
    residencyReq: '90 days in state',
    notary: (county) => `STATE OF ARIZONA\nCOUNTY OF ${county ? county.toUpperCase() : '__________'}\n\nSubscribed and sworn to before me this ______ day of __________, 20____.\n\n_______________________________\nNotary Public\nMy Commission Expires: __________`,
    perjury: 'I declare under penalty of perjury that the foregoing is true and correct to the best of my knowledge and belief.',
  },
  CA: {
    name: 'California',
    court: (county) => `SUPERIOR COURT OF CALIFORNIA\nCOUNTY OF ${county ? county.toUpperCase() : '__________'}`,
    caseLabel: 'CASE NO.',
    petitionTitle: 'PETITION FOR DISSOLUTION OF MARRIAGE',
    decreeTitle: 'JUDGMENT OF DISSOLUTION OF MARRIAGE',
    grounds: () => 'irreconcilable differences',
    residencyReq: '6 months in state, 3 months in county',
    notary: (county) => `STATE OF CALIFORNIA\nCOUNTY OF ${county ? county.toUpperCase() : '__________'}\n\nSubscribed and sworn to before me this ______ day of __________, 20____.\n\n_______________________________\nNotary Public\nMy Commission Expires: __________`,
    perjury: 'I declare under penalty of perjury under the laws of the State of California that the foregoing is true and correct.',
  },
  FL: {
    name: 'Florida',
    // Florida circuit courts are numbered (1st through 20th), not named after counties.
    // A county-to-circuit mapping is required for an exact number; use a placeholder when
    // the circuit number is not supplied by the caller.
    court: (county) => `IN THE CIRCUIT COURT OF THE ${county ? '_____ JUDICIAL CIRCUIT,\nIN AND FOR ' + county.toUpperCase() + ' COUNTY' : '______ JUDICIAL CIRCUIT'}, FLORIDA`,
    caseLabel: 'CASE NO.',
    petitionTitle: 'PETITION FOR DISSOLUTION OF MARRIAGE',
    decreeTitle: 'FINAL JUDGMENT OF DISSOLUTION OF MARRIAGE',
    grounds: () => 'irretrievably broken',
    residencyReq: '6 months in state',
    notary: (county) => `STATE OF FLORIDA\nCOUNTY OF ${county ? county.toUpperCase() : '__________'}\n\nSworn to and subscribed before me this ______ day of __________, 20____.\n\n_______________________________\nNotary Public, State of Florida\nMy Commission Expires: __________`,
    perjury: 'I declare under penalty of perjury under the laws of the State of Florida that the foregoing is true and correct.',
  },
  IL: {
    name: 'Illinois',
    court: (county) => `IN THE CIRCUIT COURT OF ${county ? county.toUpperCase() + ' COUNTY' : '__________COUNTY'}\nSTATE OF ILLINOIS`,
    caseLabel: 'CASE NO.',
    petitionTitle: 'PETITION FOR DISSOLUTION OF MARRIAGE',
    decreeTitle: 'JUDGMENT FOR DISSOLUTION OF MARRIAGE',
    grounds: () => 'irreconcilable differences',
    residencyReq: '90 days in state',
    notary: (county) => `STATE OF ILLINOIS\nCOUNTY OF ${county ? county.toUpperCase() : '__________'}\n\nSubscribed and sworn to before me this ______ day of __________, 20____.\n\n_______________________________\nNotary Public\nMy Commission Expires: __________`,
    perjury: 'I declare under penalty of perjury that the foregoing is true and correct.',
  },
  NY: {
    name: 'New York',
    court: (county) => `SUPREME COURT OF THE STATE OF NEW YORK\nCOUNTY OF ${county ? county.toUpperCase() : '__________'}`,
    caseLabel: 'Index No.',
    petitionTitle: 'VERIFIED COMPLAINT FOR DIVORCE',
    decreeTitle: 'JUDGMENT OF DIVORCE',
    grounds: (data) => data.grounds || 'irretrievable breakdown of the marriage for a period of at least six months',
    residencyReq: 'Varies — see DRL § 230',
    notary: (county) => `STATE OF NEW YORK\nCOUNTY OF ${county ? county.toUpperCase() : '__________'}\n\n________________________________ being duly sworn, deposes and says that the foregoing is true to the best of deponent's knowledge.\n\n_______________________________\nNotary Public, State of New York\nMy Commission Expires: __________`,
    perjury: 'I affirm under penalty of perjury that the foregoing is true and correct.',
  },
  UT: {
    name: 'Utah',
    court: (county) => `IN THE DISTRICT COURT OF ${county ? county.toUpperCase() + ' COUNTY' : '__________COUNTY'}\nSTATE OF UTAH`,
    caseLabel: 'Case No.',
    petitionTitle: 'PETITION FOR DIVORCE',
    decreeTitle: 'DECREE OF DIVORCE',
    grounds: (data) => data.grounds || 'irreconcilable differences',
    residencyReq: '3 months in state',
    notary: (county) => `STATE OF UTAH\nCOUNTY OF ${county ? county.toUpperCase() : '__________'}\n\nSubscribed and sworn to before me this ______ day of __________, 20____.\n\n_______________________________\nNotary Public, State of Utah\nMy Commission Expires: __________`,
    perjury: 'I declare under penalty of perjury under the laws of the State of Utah that the foregoing is true and correct.',
  },
  CO: {
    name: 'Colorado',
    court: (county) => `IN THE DISTRICT COURT IN AND FOR ${county ? county.toUpperCase() + ' COUNTY' : '__________COUNTY'}\nSTATE OF COLORADO`,
    caseLabel: 'CASE NO.',
    petitionTitle: 'PETITION FOR DISSOLUTION OF MARRIAGE',
    decreeTitle: 'DECREE OF DISSOLUTION OF MARRIAGE',
    grounds: () => 'irretrievable breakdown of the marriage',
    residencyReq: '91 days in state',
    notary: (county) => `STATE OF COLORADO\nCOUNTY OF ${county ? county.toUpperCase() : '__________'}\n\nSubscribed and sworn to before me this ______ day of __________, 20____.\n\n_______________________________\nNotary Public\nMy Commission Expires: __________`,
    perjury: 'I declare under penalty of perjury under the laws of the State of Colorado that the foregoing is true and correct.',
  },
  GA: {
    name: 'Georgia',
    court: (county) => `IN THE SUPERIOR COURT OF ${county ? county.toUpperCase() + ' COUNTY' : '__________COUNTY'}\nSTATE OF GEORGIA`,
    caseLabel: 'CIVIL ACTION FILE NO.',
    petitionTitle: 'COMPLAINT FOR DIVORCE',
    decreeTitle: 'FINAL JUDGMENT AND DECREE OF DIVORCE',
    grounds: (data) => data.grounds || 'irretrievably broken',
    residencyReq: '6 months in state',
    notary: (county) => `STATE OF GEORGIA\nCOUNTY OF ${county ? county.toUpperCase() : '__________'}\n\nSworn to and subscribed before me this ______ day of __________, 20____.\n\n_______________________________\nNotary Public\nMy Commission Expires: __________`,
    perjury: 'I declare under penalty of perjury under the laws of the State of Georgia that the foregoing is true and correct.',
  },
  MA: {
    name: 'Massachusetts',
    court: (county) => `COMMONWEALTH OF MASSACHUSETTS\n${county ? county.toUpperCase() + ' DIVISION' : '__________DIVISION'}, PROBATE AND FAMILY COURT`,
    caseLabel: 'DOCKET NO.',
    petitionTitle: 'COMPLAINT FOR DIVORCE',
    decreeTitle: 'JUDGMENT OF DIVORCE NISI',
    grounds: (data) => data.grounds || 'irretrievable breakdown of the marriage',
    residencyReq: '1 year in state (or marriage occurred in MA and one party still resides there)',
    notary: (county) => `COMMONWEALTH OF MASSACHUSETTS\nCOUNTY OF ${county ? county.toUpperCase() : '__________'}\n\nSubscribed and sworn to before me this ______ day of __________, 20____.\n\n_______________________________\nNotary Public\nMy Commission Expires: __________`,
    perjury: 'I declare under penalty of perjury under the laws of the Commonwealth of Massachusetts that the foregoing is true and correct.',
  },
  MI: {
    name: 'Michigan',
    court: (county) => `STATE OF MICHIGAN\n${county ? county.toUpperCase() + ' COUNTY' : '__________COUNTY'} CIRCUIT COURT\nFAMILY DIVISION`,
    caseLabel: 'Case No.',
    petitionTitle: 'COMPLAINT FOR DIVORCE',
    decreeTitle: 'JUDGMENT OF DIVORCE',
    grounds: () => 'breakdown of the marriage relationship to the extent that the objects of matrimony have been destroyed and there remains no reasonable likelihood that the marriage can be preserved',
    residencyReq: '180 days in state, 10 days in county',
    notary: (county) => `STATE OF MICHIGAN\nCOUNTY OF ${county ? county.toUpperCase() : '__________'}\n\nSubscribed and sworn to before me this ______ day of __________, 20____.\n\n_______________________________\nNotary Public, State of Michigan\nMy Commission Expires: __________`,
    perjury: 'I declare under penalty of perjury that the foregoing is true and correct.',
  },
  NC: {
    name: 'North Carolina',
    court: (county) => `STATE OF NORTH CAROLINA\nIN THE GENERAL COURT OF JUSTICE\nDISTRICT COURT DIVISION\n${county ? county.toUpperCase() + ' COUNTY' : '__________COUNTY'}`,
    caseLabel: 'FILE NO.',
    petitionTitle: 'COMPLAINT FOR ABSOLUTE DIVORCE',
    decreeTitle: 'JUDGMENT OF ABSOLUTE DIVORCE',
    grounds: () => 'one year separation',
    residencyReq: '6 months in state',
    notary: (county) => `NORTH CAROLINA\n${county ? county.toUpperCase() + ' COUNTY' : '__________COUNTY'}\n\nSworn to and subscribed before me this ______ day of __________, 20____.\n\n_______________________________\nNotary Public\nMy Commission Expires: __________`,
    perjury: 'I declare under penalty of perjury under the laws of the State of North Carolina that the foregoing is true and correct.',
  },
  NJ: {
    name: 'New Jersey',
    court: (county) => `SUPERIOR COURT OF NEW JERSEY\nCHANCERY DIVISION, FAMILY PART\n${county ? county.toUpperCase() + ' COUNTY' : '__________COUNTY'}`,
    caseLabel: 'Docket No.',
    petitionTitle: 'COMPLAINT FOR DIVORCE',
    decreeTitle: 'FINAL JUDGMENT OF DIVORCE',
    grounds: (data) => data.grounds || 'irreconcilable differences',
    residencyReq: '1 year in state',
    notary: (county) => `STATE OF NEW JERSEY\nCOUNTY OF ${county ? county.toUpperCase() : '__________'}\n\nSubscribed and sworn to before me this ______ day of __________, 20____.\n\n_______________________________\nNotary Public of New Jersey\nMy Commission Expires: __________`,
    perjury: 'I certify that the foregoing statements made by me are true. I am aware that if any of the foregoing statements made by me are willfully false, I am subject to punishment.',
  },
  OH: {
    name: 'Ohio',
    court: (county) => `IN THE COURT OF COMMON PLEAS\n${county ? county.toUpperCase() + ' COUNTY' : '__________COUNTY'}, OHIO\nDOMESTIC RELATIONS DIVISION`,
    caseLabel: 'CASE NO.',
    petitionTitle: 'COMPLAINT FOR DIVORCE',
    decreeTitle: 'JUDGMENT ENTRY DECREE OF DIVORCE',
    grounds: (data) => data.grounds || 'incompatibility',
    residencyReq: '6 months in state, 90 days in county',
    notary: (county) => `STATE OF OHIO\nCOUNTY OF ${county ? county.toUpperCase() : '__________'}\n\nSworn to and subscribed before me this ______ day of __________, 20____.\n\n_______________________________\nNotary Public, State of Ohio\nMy Commission Expires: __________`,
    perjury: 'I declare under penalty of perjury under the laws of the State of Ohio that the foregoing is true and correct.',
  },
  PA: {
    name: 'Pennsylvania',
    court: (county) => `IN THE COURT OF COMMON PLEAS OF ${county ? county.toUpperCase() + ' COUNTY' : '__________COUNTY'}\nCOMMONWEALTH OF PENNSYLVANIA\nFAMILY COURT DIVISION`,
    caseLabel: 'DOCKET NO.',
    petitionTitle: 'COMPLAINT IN DIVORCE',
    decreeTitle: 'DECREE IN DIVORCE',
    grounds: (data) => data.grounds || 'irretrievable breakdown of the marriage',
    residencyReq: '6 months in state',
    notary: (county) => `COMMONWEALTH OF PENNSYLVANIA\nCOUNTY OF ${county ? county.toUpperCase() : '__________'}\n\nSubscribed and sworn to before me this ______ day of __________, 20____.\n\n_______________________________\nNotary Public\nMy Commission Expires: __________`,
    perjury: 'I verify that the statements made in this complaint are true and correct. I understand that false statements herein are made subject to the penalties of 18 Pa.C.S. § 4904 relating to unsworn falsification to authorities.',
  },
  VA: {
    name: 'Virginia',
    court: (county) => `COMMONWEALTH OF VIRGINIA\nIN THE CIRCUIT COURT OF ${county ? county.toUpperCase() + ' COUNTY' : '__________COUNTY'}`,
    caseLabel: 'CASE NO.',
    petitionTitle: 'BILL OF COMPLAINT FOR DIVORCE',
    decreeTitle: 'FINAL DECREE OF DIVORCE',
    grounds: (data) => data.grounds || 'no-fault separation',
    residencyReq: '6 months domicile in state',
    notary: (county) => `COMMONWEALTH OF VIRGINIA\n${county ? county.toUpperCase() + ' COUNTY' : 'COUNTY OF __________'} to-wit:\n\nSubscribed and sworn to before me this ______ day of __________, 20____.\n\n_______________________________\nNotary Public\nMy Commission Expires: __________`,
    perjury: 'I declare under penalty of perjury under the laws of the Commonwealth of Virginia that the foregoing is true and correct.',
  },
  WA: {
    name: 'Washington',
    court: (county) => `IN THE SUPERIOR COURT OF THE STATE OF WASHINGTON\nIN AND FOR ${county ? county.toUpperCase() + ' COUNTY' : '__________COUNTY'}`,
    caseLabel: 'NO.',
    petitionTitle: 'PETITION FOR DISSOLUTION OF MARRIAGE',
    decreeTitle: 'DECREE OF DISSOLUTION OF MARRIAGE',
    grounds: () => 'irretrievable breakdown of the marriage',
    residencyReq: 'No minimum residency requirement (but must file in county where either party resides)',
    notary: (county) => `STATE OF WASHINGTON\nCOUNTY OF ${county ? county.toUpperCase() : '__________'}\n\nSubscribed and sworn to before me this ______ day of __________, 20____.\n\n_______________________________\nNotary Public\nMy Commission Expires: __________`,
    perjury: 'I declare under penalty of perjury under the laws of the State of Washington that the foregoing is true and correct.',
  },
  // ─── Canadian provinces (federal Divorce Act, RSC 1985 c. 3) ─────────────────
  ON: {
    name: 'Ontario',
    court: (county) => `ONTARIO\nSUPERIOR COURT OF JUSTICE\n${county ? '(' + county + ')' : '(__________)'}\nFAMILY COURT`,
    caseLabel: 'Court File No.',
    petitionTitle: 'APPLICATION FOR DIVORCE',
    decreeTitle: 'DIVORCE ORDER',
    grounds: () => 'separation for at least one year (Divorce Act, s.8(2)(a))',
    residencyReq: 'One spouse must have been ordinarily resident in Ontario for at least 1 year',
    notary: (county) => `I, the undersigned, make oath (or solemn affirmation) and say:\n\nThe contents of this document are true to the best of my knowledge, information and belief.\n\nSworn (or affirmed) before me at ${county || '__________'}, Ontario\nthis ______ day of __________, 20____.\n\n_______________________________\nA Commissioner for taking Affidavits`,
    perjury: 'I make this solemn declaration conscientiously believing it to be true and knowing that it is of the same force and effect as if made under oath.',
  },
  BC: {
    name: 'British Columbia',
    court: () => `IN THE SUPREME COURT OF BRITISH COLUMBIA`,
    caseLabel: 'Court File No.',
    petitionTitle: 'NOTICE OF FAMILY CLAIM (DIVORCE)',
    decreeTitle: 'DIVORCE ORDER',
    grounds: () => 'separation for at least one year (Divorce Act, s.8(2)(a))',
    residencyReq: 'One spouse must have been ordinarily resident in British Columbia for at least 1 year',
    notary: (county) => `I, the undersigned, make oath and say:\n\nThe contents of this document are true to the best of my knowledge, information and belief.\n\nSworn before me at ${county || '__________'}, British Columbia\nthis ______ day of __________, 20____.\n\n_______________________________\nA Notary Public or Commissioner for taking Affidavits in British Columbia`,
    perjury: 'I make this solemn declaration conscientiously believing it to be true and knowing that it is of the same force and effect as if made under oath.',
  },
  AB: {
    name: 'Alberta',
    court: () => `IN THE COURT OF KING'S BENCH OF ALBERTA\nJUDICIAL DISTRICT OF __________`,
    caseLabel: 'Action No.',
    petitionTitle: 'STATEMENT OF CLAIM FOR DIVORCE',
    decreeTitle: 'DIVORCE JUDGMENT',
    grounds: () => 'separation for at least one year (Divorce Act, s.8(2)(a))',
    residencyReq: 'One spouse must have been ordinarily resident in Alberta for at least 1 year',
    notary: () => `I, the undersigned, make oath and say:\n\nThe contents of this document are true to the best of my knowledge, information and belief.\n\nSworn before me at __________, Alberta\nthis ______ day of __________, 20____.\n\n_______________________________\nA Commissioner for Oaths`,
    perjury: 'I make this solemn declaration conscientiously believing it to be true and knowing that it is of the same force and effect as if made under oath.',
  },
  QC: {
    name: 'Quebec',
    court: () => `SUPERIOR COURT\nPROVINCE OF QUEBEC\nDISTRICT OF __________`,
    caseLabel: 'No.',
    petitionTitle: 'APPLICATION FOR DIVORCE',
    decreeTitle: 'DIVORCE JUDGMENT',
    grounds: () => 'separation for at least one year (Divorce Act, s.8(2)(a))',
    residencyReq: 'One spouse must have been ordinarily resident in Quebec for at least 1 year',
    notary: () => `PROVINCE OF QUÉBEC\n\nI, the undersigned, solemnly declare that the contents of this document are true to the best of my knowledge, information and belief.\n\nSolemnly declared at __________, Québec\nthis ______ day of __________, 20____.\n\n_______________________________\nNotary or Commissioner for Oaths`,
    perjury: 'Je certifie que les renseignements contenus dans le présent document sont vrais et exacts à ma connaissance.',
  },
  MB: {
    name: 'Manitoba',
    court: () => `IN THE COURT OF KING'S BENCH OF MANITOBA\nCENTRE: __________`,
    caseLabel: 'Court File No.',
    petitionTitle: 'PETITION FOR DIVORCE',
    decreeTitle: 'DIVORCE ORDER',
    grounds: () => 'separation for at least one year (Divorce Act, s.8(2)(a))',
    residencyReq: 'One spouse must have been ordinarily resident in Manitoba for at least 1 year',
    notary: () => `I, the undersigned, make oath and say:\n\nThe contents of this document are true to the best of my knowledge, information and belief.\n\nSworn before me at __________, Manitoba\nthis ______ day of __________, 20____.\n\n_______________________________\nA Commissioner for Oaths`,
    perjury: 'I make this solemn declaration conscientiously believing it to be true and knowing that it is of the same force and effect as if made under oath.',
  },
  NB: {
    name: 'New Brunswick',
    court: () => `IN THE COURT OF KING'S BENCH OF NEW BRUNSWICK\nJUDICIAL DISTRICT OF __________`,
    caseLabel: 'Court File No.',
    petitionTitle: 'PETITION FOR DIVORCE',
    decreeTitle: 'DIVORCE ORDER',
    grounds: () => 'separation for at least one year (Divorce Act, s.8(2)(a))',
    residencyReq: 'One spouse must have been ordinarily resident in New Brunswick for at least 1 year',
    notary: () => `I, the undersigned, make oath and say:\n\nThe contents of this document are true to the best of my knowledge, information and belief.\n\nSworn before me at __________, New Brunswick\nthis ______ day of __________, 20____.\n\n_______________________________\nA Commissioner for Oaths`,
    perjury: 'I make this solemn declaration conscientiously believing it to be true and knowing that it is of the same force and effect as if made under oath.',
  },
  NL: {
    name: 'Newfoundland and Labrador',
    court: () => `IN THE SUPREME COURT OF NEWFOUNDLAND AND LABRADOR\n(TRIAL DIVISION)`,
    caseLabel: 'Court File No.',
    petitionTitle: 'PETITION FOR DIVORCE',
    decreeTitle: 'DIVORCE ORDER',
    grounds: () => 'separation for at least one year (Divorce Act, s.8(2)(a))',
    residencyReq: 'One spouse must have been ordinarily resident in Newfoundland and Labrador for at least 1 year',
    notary: () => `I, the undersigned, make oath and say:\n\nThe contents of this document are true to the best of my knowledge, information and belief.\n\nSworn before me at __________, Newfoundland and Labrador\nthis ______ day of __________, 20____.\n\n_______________________________\nA Commissioner for Oaths`,
    perjury: 'I make this solemn declaration conscientiously believing it to be true and knowing that it is of the same force and effect as if made under oath.',
  },
  NS: {
    name: 'Nova Scotia',
    court: () => `IN THE SUPREME COURT OF NOVA SCOTIA\n(FAMILY DIVISION)`,
    caseLabel: 'Court File No.',
    petitionTitle: 'PETITION FOR DIVORCE',
    decreeTitle: 'DIVORCE ORDER',
    grounds: () => 'separation for at least one year (Divorce Act, s.8(2)(a))',
    residencyReq: 'One spouse must have been ordinarily resident in Nova Scotia for at least 1 year',
    notary: () => `I, the undersigned, make oath and say:\n\nThe contents of this document are true to the best of my knowledge, information and belief.\n\nSworn before me at __________, Nova Scotia\nthis ______ day of __________, 20____.\n\n_______________________________\nA Commissioner for Oaths`,
    perjury: 'I make this solemn declaration conscientiously believing it to be true and knowing that it is of the same force and effect as if made under oath.',
  },
  PE: {
    name: 'Prince Edward Island',
    court: () => `IN THE SUPREME COURT OF PRINCE EDWARD ISLAND\n(FAMILY SECTION)`,
    caseLabel: 'Court File No.',
    petitionTitle: 'PETITION FOR DIVORCE',
    decreeTitle: 'DIVORCE ORDER',
    grounds: () => 'separation for at least one year (Divorce Act, s.8(2)(a))',
    residencyReq: 'One spouse must have been ordinarily resident in Prince Edward Island for at least 1 year',
    notary: () => `I, the undersigned, make oath and say:\n\nThe contents of this document are true to the best of my knowledge, information and belief.\n\nSworn before me at __________, Prince Edward Island\nthis ______ day of __________, 20____.\n\n_______________________________\nA Commissioner for Oaths`,
    perjury: 'I make this solemn declaration conscientiously believing it to be true and knowing that it is of the same force and effect as if made under oath.',
  },
  SK: {
    name: 'Saskatchewan',
    court: () => `IN THE COURT OF KING'S BENCH FOR SASKATCHEWAN\nJUDICIAL CENTRE OF __________`,
    caseLabel: 'Court File No.',
    petitionTitle: 'PETITION FOR DIVORCE',
    decreeTitle: 'DIVORCE ORDER',
    grounds: () => 'separation for at least one year (Divorce Act, s.8(2)(a))',
    residencyReq: 'One spouse must have been ordinarily resident in Saskatchewan for at least 1 year',
    notary: () => `I, the undersigned, make oath and say:\n\nThe contents of this document are true to the best of my knowledge, information and belief.\n\nSworn before me at __________, Saskatchewan\nthis ______ day of __________, 20____.\n\n_______________________________\nA Commissioner for Oaths`,
    perjury: 'I make this solemn declaration conscientiously believing it to be true and knowing that it is of the same force and effect as if made under oath.',
  },
};

// ─── Helper utilities ─────────────────────────────────────────────────────────

class DivorceDocumentGenerator {
  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Generate a document for the given state and type.
   * @param {string} state  - 2-letter state code
   * @param {string} docType - document type slug (e.g. 'divorce_petition')
   * @param {Object} data   - affidavitData collected by the orchestrator
   * @returns {{ sections: Object, metadata: Object }}
   */
  generate(state, docType, data) {
    const cfg = STATE_CONFIG[state] || STATE_CONFIG['TX'];
    // Conversations and county catalogs may return either "Salt Lake" or
    // "Salt Lake County". State captions add the legal label themselves.
    data = { ...data, county: normalizeCountyName(data?.county) };

    switch (docType) {
      case 'divorce_petition':
      case 'petition_dissolution':
        return this._generatePetition(cfg, state, data);

      case 'divorce_decree':
      case 'judgment_dissolution':
      case 'final_judgment':
        return this._generateDecree(cfg, state, data);

      case 'proposed_judgment':
        return this._generateProposedJudgment(cfg, state, data);

      case 'waiver_of_service':
        return this._generateWaiverOfService(cfg, state, data);

      case 'acknowledgment_of_receipt':
      case 'acknowledgment_of_service':
        return this._generateAcknowledgmentOfService(cfg, state, data);

      case 'cert_last_known_address':
        return this._generateCertLastKnownAddress(cfg, state, data);

      case 'prove_up_affidavit':
        return this._generateProveUpAffidavit(cfg, state, data);

      case 'military_status_affidavit':
        return this._generateMilitaryStatusAffidavit(cfg, state, data);

      case 'indigency_affidavit':
        return this._generateIndigencyAffidavit(cfg, state, data);

      case 'parenting_plan':
        return this._generateParentingPlan(cfg, state, data);

      case 'child_support_worksheet':
        return this._generateChildSupportWorksheet(cfg, state, data);

      case 'child_support_order':
        return this._generateChildSupportOrder(cfg, state, data);

      case 'spousal_support_order':
        return this._generateSpousalSupportOrder(cfg, state, data);

      case 'child_custody_order':
        return this._generateChildCustodyOrder(cfg, state, data);

      case 'summons_with_notice':
        return this._generateSummonsWithNotice(cfg, state, data);

      case 'verified_complaint':
        return this._generateVerifiedComplaint(cfg, state, data);

      default:
        // Fallback: render as a generic divorce document
        return this._generatePetition(cfg, state, data);
    }
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  _petitionerName(data) {
    return data.petitionerName
      || [data.petitionerFirstName, data.petitionerLastName].filter(Boolean).join(' ')
      || 'Petitioner';
  }

  _respondentName(data) {
    return data.respondentName
      || [data.respondentFirstName, data.respondentLastName].filter(Boolean).join(' ')
      || 'Respondent';
  }

  _caseCaption(cfg, data) {
    const petitioner = this._petitionerName(data);
    const respondent = this._respondentName(data);
    const caseNo = data.caseNumber || `${cfg.caseLabel} __________`;
    return {
      formatted: `IN RE THE MARRIAGE OF:\n\n${petitioner},\n    Petitioner,\n\n    vs.\n\n${respondent},\n    Respondent.\n\n${caseNo}`,
      // pdfService lays this out as the conventional two-column caption.
      structured: {
        left: [
          'IN RE THE MARRIAGE OF:',
          '',
          `${petitioner},`,
          '          Petitioner,',
          '',
          'vs.',
          '',
          `${respondent},`,
          '          Respondent.',
        ],
        right: [
          data.caseNumber ? `${cfg.caseLabel} ${data.caseNumber}` : `${cfg.caseLabel} _______________`,
          '',
          'Judge _______________',
        ],
      },
    };
  }

  /** Pro se filer contact block for the top-left of page one. */
  _filerBlock(data, roleLine) {
    const name = /^Respondent/.test(roleLine || '')
      ? this._respondentName(data)
      : this._petitionerName(data);
    const address = data.petitionerAddress || data.address || data.mailingAddress || '';
    const phone = data.petitionerPhone || data.phone || data.phoneNumber || '';
    const email = data.petitionerEmail || data.email || '';
    return {
      lines: [
        name,
        `Address: ${address || '_________________________________'}`,
        `Phone: ${phone || '____________________'}`,
        `Email: ${email || '____________________'}`,
        roleLine || 'Petitioner, Pro Se',
      ],
    };
  }

  _hasChildren(data) {
    return Array.isArray(data.children) && data.children.length > 0;
  }

  _childrenList(data) {
    if (!this._hasChildren(data)) return 'No minor children are expected.';
    return data.children.map(c => `• ${c.name || 'Child'}${c.dob ? ` (DOB: ${c.dob})` : c.age ? ` (Age: ${c.age})` : ''}`).join('\n');
  }

  _residencyStatement(cfg, state, data) {
    const months = data.residencyStateMonths;
    const days = data.residencyCountyDays;
    const county = data.county || '__________';
    const name = this._petitionerName(data);

    let stmt = `${name} is a resident of ${cfg.name}`;
    if (months) stmt += ` and has been a resident of the State of ${cfg.name} for at least ${months} months`;
    if (days && state !== 'CA' && state !== 'FL') stmt += ` and a resident of ${county} County for at least ${days} days`;
    stmt += `, meeting the residency requirements for filing in this jurisdiction.`;
    return stmt;
  }

  _groundsStatement(cfg, data) {
    const grounds = cfg.grounds(data);
    return `The marriage has become insupportable due to ${grounds}, and there is no reasonable expectation of reconciliation.`;
  }

  _childrenSection(cfg, state, data) {
    if (!this._hasChildren(data)) {
      return 'There are no minor children born to or adopted by the parties during the marriage.';
    }
    const list = this._childrenList(data);
    const custody = data.custodyArrangement || 'to be determined by the Court';
    const childWord = state === 'AZ' ? 'legal decision-making and parenting time' :
                      state === 'IL' ? 'parental responsibilities and parenting time' :
                      'custody and visitation';
    return `The following minor children were born to or adopted by the parties during the marriage:\n\n${list}\n\nThe parties request that the Court determine ${childWord} arrangements. The proposed custody arrangement is: ${custody}.`;
  }

  _propertySection(data) {
    const agreement = data.propertyAgreement || 'agreed';
    if (agreement === 'agreed') {
      return 'The parties have agreed upon the division of all marital property and debts. The agreed division is set forth in the parties\' settlement agreement, which is incorporated herein by reference.';
    }
    return 'The division of marital property and debts is contested. The parties request the Court divide all community property and debts in a just and right manner, having due regard for the rights of each party.';
  }

  _supportSection(data) {
    if (!data.spousalSupportRequested) {
      return 'Neither party is requesting spousal support (alimony) at this time.';
    }
    const amount = data.supportAmount ? `$${data.supportAmount.toLocaleString()} per month` : 'an amount to be determined';
    const duration = data.supportDuration || 'a period to be determined by the Court';
    return `Petitioner requests that the Court award spousal support in the amount of ${amount} for ${duration}. ${data.supportBasis ? data.supportBasis : ''}`;
  }

  _serviceSection(data) {
    if (data.serviceMethod === 'waiver') {
      return 'Respondent has agreed to waive formal service of process. A signed Waiver of Service is attached hereto.';
    }
    const addr = data.respondentAddress || 'an address to be provided to the Court';
    return `Respondent may be served with process at: ${addr}.`;
  }

  _signatureBlock(data, title) {
    const signerName = /^Respondent\b/i.test(title || '')
      ? this._respondentName(data)
      : this._petitionerName(data);
    return {
      line: '_'.repeat(40),
      name: signerName,
      title: title || 'Petitioner, Pro Se',
      date: `Date: __________`,
    };
  }

  // ── Document generators ───────────────────────────────────────────────────

  _generatePetition(cfg, state, data) {
    const petitioner = this._petitionerName(data);
    const respondent = this._respondentName(data);
    const county = data.county || '__________';
    const marriageDate = data.marriageDate || '__________';
    const marriageCity = data.marriageCity || '__________';
    const marriageStateName = data.marriageStateName || '__________';
    const separationDate = data.separationDate || '__________';

    const facts = {
      items: [
        {
          number: 1,
          content: `Petitioner, ${petitioner}, is an individual residing in ${county} County, ${cfg.name}.`
        },
        {
          number: 2,
          content: this._residencyStatement(cfg, state, data)
        },
        {
          number: 3,
          content: `Respondent, ${respondent}, is an individual who may be served with process as stated herein.`
        },
        {
          number: 4,
          content: `The parties were lawfully married on ${marriageDate} in ${marriageCity}, ${marriageStateName}.`
        },
        {
          number: 5,
          content: `The parties separated on or about ${separationDate}.`
        },
        {
          number: 6,
          content: this._groundsStatement(cfg, data)
        },
        {
          number: 7,
          content: this._childrenSection(cfg, state, data)
        },
        {
          number: 8,
          content: this._propertySection(data)
        },
        {
          number: 9,
          content: this._supportSection(data)
        },
        {
          number: 10,
          content: this._serviceSection(data)
        },
      ],
    };

    const conclusion = `WHEREFORE, Petitioner respectfully requests that this Court:\n\n1. Grant a divorce dissolving the marriage between the parties;\n2. Make a just and equitable division of the marital property and debts;\n${this._hasChildren(data) ? '3. Establish conservatorship, custody, visitation, and child support;\n4. Award such other relief as the Court deems just and proper.\n' : '3. Award such other relief as the Court deems just and proper.\n'}`;

    return {
      sections: {
        filerBlock: this._filerBlock(data, 'Petitioner, Pro Se'),
        header: cfg.court(county),
        caseCaption: this._caseCaption(cfg, data),
        title: cfg.petitionTitle,
        introduction: `COMES NOW, ${petitioner}, Petitioner, and files this ${cfg.petitionTitle}, and in support thereof respectfully shows the Court the following:`,
        facts,
        conclusion,
        perjuryStatement: cfg.perjury,
        signatureBlock: this._signatureBlock(data),
        notaryInstruction: 'This document must be signed before a notary public.',
        notaryBlock: cfg.notary(county),
      },
      metadata: {
        documentType: state === 'NY' ? 'verified_complaint' : 'divorce_petition',
        documentTitle: cfg.petitionTitle,
        state,
        estimatedPages: 3,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  _generateDecree(cfg, state, data) {
    const petitioner = this._petitionerName(data);
    const respondent = this._respondentName(data);
    const county = data.county || '__________';

    const facts = {
      items: [
        {
          number: 1,
          content: `This matter came on for final hearing on __________, and the Court, having considered the pleadings, evidence, and argument of counsel, finds as follows:`
        },
        {
          number: 2,
          content: `The Court has jurisdiction over the parties and subject matter herein. Both parties meet the residency requirements of ${cfg.name}.`
        },
        {
          number: 3,
          content: `The marriage between ${petitioner} and ${respondent} is hereby DISSOLVED, and the parties are restored to the status of single persons.`
        },
        {
          number: 4,
          content: this._hasChildren(data)
            ? `Regarding the minor children of the marriage:\n\n${this._childrenList(data)}\n\nCustody, visitation, and support are as set forth in the attached Order.`
            : 'There are no minor children of the marriage.'
        },
        {
          number: 5,
          content: this._propertySection(data)
        },
        {
          number: 6,
          content: data.spousalSupportRequested
            ? this._supportSection(data)
            : 'Spousal support is DENIED.'
        },
        {
          number: 7,
          content: `Each party is ORDERED to execute all documents necessary to carry out the terms of this Decree.`
        },
        {
          number: 8,
          content: `This Decree shall be effective immediately upon entry by the Court.`
        },
      ],
    };

    return {
      sections: {
        header: cfg.court(county),
        caseCaption: this._caseCaption(cfg, data),
        title: cfg.decreeTitle,
        introduction: `The Court, having considered the matter, enters the following Decree:`,
        facts,
        conclusion: `IT IS SO ORDERED, ADJUDGED, AND DECREED.\n\n_______________________________\nJudge Presiding\nDate: __________`,
        signatureBlock: this._signatureBlock(data, 'Petitioner'),
      },
      metadata: {
        documentType: 'divorce_decree',
        documentTitle: cfg.decreeTitle,
        state,
        estimatedPages: 3,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  _generateProposedJudgment(cfg, state, data) {
    const base = this._generateDecree(cfg, state, data);
    return {
      sections: {
        ...base.sections,
        title: `PROPOSED ${cfg.decreeTitle}`,
        introduction: `Petitioner submits this Proposed ${cfg.decreeTitle} for the Court's review and entry:`,
      },
      metadata: {
        ...base.metadata,
        documentType: 'proposed_judgment',
        documentTitle: `Proposed ${cfg.decreeTitle}`,
      },
    };
  }

  _generateWaiverOfService(cfg, state, data) {
    const petitioner = this._petitionerName(data);
    const respondent = this._respondentName(data);
    const county = data.county || '__________';

    const facts = {
      items: [
        {
          number: 1,
          content: `I, ${respondent}, am the Respondent in the above-entitled action.`
        },
        {
          number: 2,
          content: `I have received a copy of the ${cfg.petitionTitle} filed by ${petitioner}.`
        },
        {
          number: 3,
          content: `I hereby WAIVE formal service of process and acknowledge receipt of all pleadings filed in this matter.`
        },
        {
          number: 4,
          content: `I understand that by signing this Waiver, I am waiving my right to be formally served with process as provided by law.`
        },
        {
          number: 5,
          content: `This waiver is made voluntarily and without coercion.`
        },
      ],
    };

    return {
      sections: {
        header: cfg.court(county),
        caseCaption: this._caseCaption(cfg, data),
        title: 'WAIVER OF SERVICE OF PROCESS',
        introduction: `I, ${respondent}, Respondent in the above-styled cause, do hereby state as follows:`,
        facts,
        perjuryStatement: cfg.perjury,
        signatureBlock: this._signatureBlock(data, 'Respondent'),
        notaryInstruction: 'This document must be signed before a notary public.',
        notaryBlock: cfg.notary(county),
      },
      metadata: {
        documentType: 'waiver_of_service',
        documentTitle: 'Waiver of Service of Process',
        state,
        estimatedPages: 2,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  _generateAcknowledgmentOfService(cfg, state, data) {
    const petitioner = this._petitionerName(data);
    const respondent = this._respondentName(data);
    const county = data.county || '__________';

    const facts = {
      items: [
        {
          number: 1,
          content: `I, ${respondent}, am the Respondent in the above-entitled action.`
        },
        {
          number: 2,
          content: `I acknowledge that I have received copies of the following documents in this proceeding: (a) ${cfg.petitionTitle}; (b) Summons / Citation; (c) all other documents filed herewith.`
        },
        {
          number: 3,
          content: `I acknowledge that service of process has been completed as of the date of my signature below.`
        },
        {
          number: 4,
          content: `The Petitioner in this action is ${petitioner}.`
        },
      ],
    };

    return {
      sections: {
        header: cfg.court(county),
        caseCaption: this._caseCaption(cfg, data),
        title: 'ACKNOWLEDGMENT OF RECEIPT OF SERVICE',
        introduction: `The undersigned Respondent acknowledges receipt of service as follows:`,
        facts,
        perjuryStatement: cfg.perjury,
        signatureBlock: this._signatureBlock(data, 'Respondent'),
        notaryInstruction: 'This document must be signed before a notary public.',
        notaryBlock: cfg.notary(county),
      },
      metadata: {
        documentType: 'acknowledgment_of_service',
        documentTitle: 'Acknowledgment of Receipt of Service',
        state,
        estimatedPages: 2,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  _generateCertLastKnownAddress(cfg, state, data) {
    const petitioner = this._petitionerName(data);
    const respondent = this._respondentName(data);
    const county = data.county || '__________';
    const respondentAddress = data.respondentAddress || 'Address Unknown';

    const facts = {
      items: [
        {
          number: 1,
          content: `I, ${petitioner}, am the Petitioner in the above-entitled action.`
        },
        {
          number: 2,
          content: `The last known address of Respondent, ${respondent}, is:\n\n${respondentAddress}`
        },
        {
          number: 3,
          content: `I have made diligent efforts to ascertain the current address of Respondent and believe the above to be Respondent's last known address.`
        },
        {
          number: 4,
          content: `I am certifying this information for the purpose of service of process in the above-captioned matter.`
        },
      ],
    };

    return {
      sections: {
        header: cfg.court(county),
        caseCaption: this._caseCaption(cfg, data),
        title: 'CERTIFICATE OF LAST KNOWN ADDRESS',
        introduction: `I, ${petitioner}, do hereby certify under penalty of perjury as follows:`,
        facts,
        perjuryStatement: cfg.perjury,
        signatureBlock: this._signatureBlock(data, 'Petitioner'),
        notaryInstruction: 'This document must be notarized.',
        notaryBlock: cfg.notary(county),
      },
      metadata: {
        documentType: 'cert_last_known_address',
        documentTitle: 'Certificate of Last Known Address',
        state,
        estimatedPages: 1,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  _generateProveUpAffidavit(cfg, state, data) {
    const petitioner = this._petitionerName(data);
    const respondent = this._respondentName(data);
    const county = data.county || '__________';
    const marriageDate = data.marriageDate || '__________';

    const facts = {
      items: [
        {
          number: 1,
          content: `My name is ${petitioner}. I am the Petitioner in the above-styled cause. I am over 18 years of age and competent to testify.`
        },
        {
          number: 2,
          content: this._residencyStatement(cfg, state, data)
        },
        {
          number: 3,
          content: `I was lawfully married to ${respondent} on ${marriageDate}. We are still legally married as of the date of this affidavit.`
        },
        {
          number: 4,
          content: this._groundsStatement(cfg, data)
        },
        {
          number: 5,
          content: this._hasChildren(data)
            ? `The following minor children were born to or adopted by the parties during the marriage:\n\n${this._childrenList(data)}`
            : 'There are no minor children born to or adopted by the parties during the marriage.'
        },
        {
          number: 6,
          content: `All allegations in the ${cfg.petitionTitle} on file herein are true and correct.`
        },
        {
          number: 7,
          content: `I am requesting that the Court grant the divorce/dissolution as prayed for in the Petition.`
        },
      ],
    };

    return {
      sections: {
        header: cfg.court(county),
        caseCaption: this._caseCaption(cfg, data),
        title: 'PROVE-UP AFFIDAVIT',
        introduction: `I, ${petitioner}, being first duly sworn, depose and state as follows:`,
        facts,
        perjuryStatement: cfg.perjury,
        signatureBlock: this._signatureBlock(data),
        notaryInstruction: 'This affidavit must be sworn to before a notary public.',
        notaryBlock: cfg.notary(county),
      },
      metadata: {
        documentType: 'prove_up_affidavit',
        documentTitle: 'Prove-Up Affidavit',
        state,
        estimatedPages: 2,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  _generateMilitaryStatusAffidavit(cfg, state, data) {
    const petitioner = this._petitionerName(data);
    const respondent = this._respondentName(data);
    const county = data.county || '__________';
    const militaryStatus = data.respondentMilitaryStatus || 'unknown';
    const searchDate = data.militarySearchDate || '__________';
    const searchMethod = data.militarySearchMethod || 'the Defense Manpower Data Center (DMDC) website';

    const statusStatement = militaryStatus === 'not_military'
      ? `Based on my investigation, Respondent ${respondent} is NOT on active duty with any branch of the United States Armed Forces.`
      : militaryStatus === 'military'
      ? `Based on my investigation, Respondent ${respondent} IS on active duty with the United States Armed Forces.`
      : `I was unable to definitively determine whether Respondent ${respondent} is currently on active military duty.`;

    const facts = {
      items: [
        {
          number: 1,
          content: `I, ${petitioner}, am the Petitioner in the above-styled cause and am over 18 years of age.`
        },
        {
          number: 2,
          content: `I have made diligent efforts to determine the military status of Respondent, ${respondent}.`
        },
        {
          number: 3,
          content: `On ${searchDate}, I investigated Respondent's military status through ${searchMethod}.`
        },
        {
          number: 4,
          content: statusStatement
        },
        {
          number: 5,
          content: `I am providing this affidavit in compliance with the Servicemembers Civil Relief Act (SCRA), 50 U.S.C. § 3931.`
        },
      ],
    };

    return {
      sections: {
        header: cfg.court(county),
        caseCaption: this._caseCaption(cfg, data),
        title: 'MILITARY STATUS AFFIDAVIT\n(Servicemembers Civil Relief Act)',
        introduction: `I, ${petitioner}, being first duly sworn, depose and state as follows:`,
        facts,
        perjuryStatement: cfg.perjury,
        signatureBlock: this._signatureBlock(data),
        notaryInstruction: 'This affidavit must be sworn to before a notary public.',
        notaryBlock: cfg.notary(county),
      },
      metadata: {
        documentType: 'military_status_affidavit',
        documentTitle: 'Military Status Affidavit',
        state,
        estimatedPages: 2,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  _generateIndigencyAffidavit(cfg, state, data) {
    const petitioner = this._petitionerName(data);
    const county = data.county || '__________';
    const monthlyIncome = data.monthlyIncome != null ? `$${Number(data.monthlyIncome).toLocaleString()}` : '$__________';
    const monthlyExpenses = data.monthlyExpenses != null ? `$${Number(data.monthlyExpenses).toLocaleString()}` : '$__________';
    const dependents = data.dependentsCount != null ? data.dependentsCount : '__';
    const assets = data.assetsDescription || 'None of significant value';

    const facts = {
      items: [
        {
          number: 1,
          content: `I, ${petitioner}, am the Petitioner in the above-styled cause. I am requesting waiver of court filing fees and costs based on my financial inability to pay.`
        },
        {
          number: 2,
          content: `My gross monthly income from all sources is approximately ${monthlyIncome}.`
        },
        {
          number: 3,
          content: `My monthly expenses total approximately ${monthlyExpenses}.`
        },
        {
          number: 4,
          content: `I have ${dependents} dependent(s) who rely on me for financial support.`
        },
        {
          number: 5,
          content: `My assets include: ${assets}.`
        },
        {
          number: 6,
          content: `Based on my financial circumstances, I am unable to pay the court filing fees and costs required to pursue this action.`
        },
        {
          number: 7,
          content: `I respectfully request that the Court waive all filing fees and costs associated with this proceeding.`
        },
      ],
    };

    return {
      sections: {
        header: cfg.court(county),
        caseCaption: this._caseCaption(cfg, data),
        title: 'AFFIDAVIT OF INDIGENCY\n(Application to Waive Filing Fees)',
        introduction: `I, ${petitioner}, being first duly sworn, depose and state as follows in support of my application to waive court costs:`,
        facts,
        perjuryStatement: cfg.perjury,
        signatureBlock: this._signatureBlock(data),
        notaryInstruction: 'This affidavit must be sworn to before a notary public.',
        notaryBlock: cfg.notary(county),
      },
      metadata: {
        documentType: 'indigency_affidavit',
        documentTitle: 'Affidavit of Indigency',
        state,
        estimatedPages: 2,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  _generateParentingPlan(cfg, state, data) {
    const petitioner = this._petitionerName(data);
    const respondent = this._respondentName(data);
    const county = data.county || '__________';
    const childWord = state === 'AZ' ? 'Legal Decision-Making and Parenting Time Plan' :
                      state === 'IL' ? 'Parental Responsibilities Agreement' :
                      'Parenting Plan';
    const custodyArrangement = data.custodyArrangement || 'joint custody with equal parenting time';

    const children = this._hasChildren(data)
      ? data.children.map((c, i) => `${i + 1}. ${c.name || 'Child'}${c.dob ? ` (DOB: ${c.dob})` : c.age ? ` (Age: ${c.age})` : ''}`)
      : ['No children listed'];

    const facts = {
      items: [
        {
          number: 1,
          content: `This ${childWord} is entered into between ${petitioner} ("Petitioner") and ${respondent} ("Respondent") for the following minor children:\n\n${children.join('\n')}`
        },
        {
          number: 2,
          content: `The parties agree that the primary custody arrangement shall be: ${custodyArrangement}.`
        },
        {
          number: 3,
          content: `RESIDENTIAL SCHEDULE: The children shall reside with each parent according to a schedule to be agreed upon by the parties or as ordered by the Court.`
        },
        {
          number: 4,
          content: `HOLIDAYS AND SPECIAL OCCASIONS: The parties shall alternate major holidays, including but not limited to Thanksgiving, Christmas/Hanukkah, Spring Break, and Summer vacation. The specific schedule shall be agreed upon by the parties.`
        },
        {
          number: 5,
          content: `DECISION-MAKING: The parties shall share in major decisions affecting the children, including education, healthcare, and religious upbringing${state === 'AZ' ? ', as required under A.R.S. § 25-403' : ''}.`
        },
        {
          number: 6,
          content: `COMMUNICATION: The parties agree to communicate respectfully regarding the children and shall not disparage the other parent in the presence of the children.`
        },
        {
          number: 7,
          content: `MODIFICATIONS: This plan may be modified by written agreement of both parties or by order of the Court upon showing of a material change in circumstances.`
        },
      ],
    };

    return {
      sections: {
        header: cfg.court(county),
        caseCaption: this._caseCaption(cfg, data),
        title: childWord.toUpperCase(),
        introduction: `The parties, ${petitioner} and ${respondent}, hereby agree to the following ${childWord}:`,
        facts,
        conclusion: `The parties certify that this ${childWord} is in the best interests of the children.`,
        perjuryStatement: cfg.perjury,
        signatureBlock: this._signatureBlock(data, 'Petitioner'),
      },
      metadata: {
        documentType: 'parenting_plan',
        documentTitle: childWord,
        state,
        estimatedPages: 3,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  _generateChildSupportWorksheet(cfg, state, data) {
    const petitioner = this._petitionerName(data);
    const respondent = this._respondentName(data);
    const county = data.county || '__________';

    const facts = {
      items: [
        {
          number: 1,
          content: `This Child Support Worksheet is submitted in the above-captioned matter for the minor children of ${petitioner} and ${respondent}.`
        },
        {
          number: 2,
          content: `Children Subject to Order:\n\n${this._childrenList(data)}`
        },
        {
          number: 3,
          content: `PETITIONER'S MONTHLY GROSS INCOME: $__________\nSource(s): __________`
        },
        {
          number: 4,
          content: `RESPONDENT'S MONTHLY GROSS INCOME: $__________\nSource(s): __________`
        },
        {
          number: 5,
          content: `COMBINED MONTHLY GROSS INCOME: $__________`
        },
        {
          number: 6,
          content: `BASIC CHILD SUPPORT OBLIGATION (per ${cfg.name} guidelines): $__________`
        },
        {
          number: 7,
          content: `ADJUSTMENTS:\n• Health insurance premiums for children: $__________\n• Work-related childcare costs: $__________\n• Other adjustments: $__________`
        },
        {
          number: 8,
          content: `TOTAL CHILD SUPPORT OBLIGATION: $__________ per month`
        },
        {
          number: 9,
          content: `OBLIGOR (paying parent): __________\nOBLIGEE (receiving parent): __________`
        },
      ],
    };

    return {
      sections: {
        header: cfg.court(county),
        caseCaption: this._caseCaption(cfg, data),
        title: 'CHILD SUPPORT WORKSHEET',
        introduction: `The following child support worksheet is submitted pursuant to ${cfg.name} child support guidelines:`,
        facts,
        perjuryStatement: cfg.perjury,
        signatureBlock: this._signatureBlock(data),
      },
      metadata: {
        documentType: 'child_support_worksheet',
        documentTitle: 'Child Support Worksheet',
        state,
        estimatedPages: 2,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  _generateChildSupportOrder(cfg, state, data) {
    const petitioner = this._petitionerName(data);
    const respondent = this._respondentName(data);
    const county = data.county || '__________';

    const facts = {
      items: [
        {
          number: 1,
          content: `IT IS HEREBY ORDERED that child support be established for the following minor children:\n\n${this._childrenList(data)}`
        },
        {
          number: 2,
          content: `THE OBLIGOR (paying parent) SHALL BE: __________`
        },
        {
          number: 3,
          content: `CHILD SUPPORT AMOUNT: $__________ per month, due and payable on the ______ day of each month.`
        },
        {
          number: 4,
          content: `PAYMENT METHOD: Payment shall be made through the ${cfg.name} State Disbursement Unit unless otherwise ordered.`
        },
        {
          number: 5,
          content: `HEALTH INSURANCE: The __________ shall maintain health insurance coverage for the minor children. Uninsured medical expenses shall be divided: __________% Petitioner / __________% Respondent.`
        },
        {
          number: 6,
          content: `EFFECTIVE DATE: This Order is effective as of __________.`
        },
        {
          number: 7,
          content: `INCOME WITHHOLDING: An Income Withholding Order shall issue immediately per applicable law.`
        },
      ],
    };

    return {
      sections: {
        header: cfg.court(county),
        caseCaption: this._caseCaption(cfg, data),
        title: 'ORDER FOR CHILD SUPPORT',
        introduction: `The Court, having considered the evidence, enters the following Order for Child Support:`,
        facts,
        conclusion: `IT IS SO ORDERED.\n\n_______________________________\nJudge Presiding\nDate: __________`,
        signatureBlock: this._signatureBlock(data, 'Petitioner'),
      },
      metadata: {
        documentType: 'child_support_order',
        documentTitle: 'Order for Child Support',
        state,
        estimatedPages: 2,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  _generateSpousalSupportOrder(cfg, state, data) {
    const petitioner = this._petitionerName(data);
    const respondent = this._respondentName(data);
    const county = data.county || '__________';
    const amount = data.supportAmount ? `$${Number(data.supportAmount).toLocaleString()}` : '$__________';
    const duration = data.supportDuration || '__________';
    const alimonyTerm = state === 'CA' ? 'spousal support' :
                        state === 'FL' ? 'alimony' :
                        state === 'NY' ? 'maintenance' :
                        state === 'IL' ? 'maintenance' :
                        state === 'AZ' ? 'spousal maintenance' :
                        'spousal support';

    const facts = {
      items: [
        {
          number: 1,
          content: `IT IS HEREBY ORDERED that ${alimonyTerm} is awarded as follows:`
        },
        {
          number: 2,
          content: `PAYOR: __________\nPAYEE: __________`
        },
        {
          number: 3,
          content: `AMOUNT: ${amount} per month.`
        },
        {
          number: 4,
          content: `DURATION: ${duration}.`
        },
        {
          number: 5,
          content: `PAYMENT DUE DATE: On the ______ day of each month.`
        },
        {
          number: 6,
          content: `TERMINATION: This ${alimonyTerm} obligation shall terminate upon: (a) death of either party; (b) remarriage of the payee; (c) as otherwise ordered by the Court.`
        },
        {
          number: 7,
          content: data.supportBasis ? `BASIS FOR AWARD: ${data.supportBasis}` : `BASIS FOR AWARD: As determined by the Court considering the parties\' standard of living, earning capacity, and other relevant factors.`
        },
      ],
    };

    return {
      sections: {
        header: cfg.court(county),
        caseCaption: this._caseCaption(cfg, data),
        title: `ORDER FOR ${alimonyTerm.toUpperCase()}`,
        introduction: `The Court, having considered the evidence and arguments, enters the following Order:`,
        facts,
        conclusion: `IT IS SO ORDERED.\n\n_______________________________\nJudge Presiding\nDate: __________`,
        signatureBlock: this._signatureBlock(data, 'Petitioner'),
      },
      metadata: {
        documentType: 'spousal_support_order',
        documentTitle: `Order for ${alimonyTerm.charAt(0).toUpperCase() + alimonyTerm.slice(1)}`,
        state,
        estimatedPages: 2,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  _generateChildCustodyOrder(cfg, state, data) {
    const county = data.county || '__________';
    const custodyTerm = state === 'AZ' ? 'Legal Decision-Making and Parenting Time Order' :
                        state === 'IL' ? 'Allocation of Parental Responsibilities Order' :
                        'Child Custody Order';

    const facts = {
      items: [
        {
          number: 1,
          content: `IT IS HEREBY ORDERED regarding the minor children:\n\n${this._childrenList(data)}`
        },
        {
          number: 2,
          content: state === 'AZ'
            ? `LEGAL DECISION-MAKING: The parties shall share joint legal decision-making authority regarding major decisions affecting the children, including education, healthcare, and religious upbringing, pursuant to A.R.S. § 25-403.`
            : state === 'IL'
            ? `SIGNIFICANT DECISION-MAKING RESPONSIBILITY: The parties shall share joint significant decision-making responsibility regarding major decisions affecting the children pursuant to 750 ILCS 5/602.5.`
            : `LEGAL CUSTODY: The parties shall share joint legal custody of the minor children.`
        },
        {
          number: 3,
          content: state === 'AZ'
            ? `PARENTING TIME: Each parent shall have parenting time as follows: ${data.custodyArrangement || 'as set forth in the attached Parenting Plan'}.`
            : `PHYSICAL CUSTODY: Primary physical custody shall be as follows: ${data.custodyArrangement || 'as set forth in the Parenting Plan'}.`
        },
        {
          number: 4,
          content: `HOLIDAY SCHEDULE: The parties shall follow the holiday and vacation schedule set forth in the attached Parenting Plan, or as otherwise agreed upon by the parties in writing.`
        },
        {
          number: 5,
          content: `RELOCATION: Neither party shall relocate with the children outside of __________ without prior written consent of the other party or order of the Court.`
        },
        {
          number: 6,
          content: `BEST INTERESTS: All decisions regarding the children shall be made with the children's best interests as the paramount consideration.`
        },
      ],
    };

    return {
      sections: {
        header: cfg.court(county),
        caseCaption: this._caseCaption(cfg, data),
        title: custodyTerm.toUpperCase(),
        introduction: `The Court, having considered the best interests of the children, enters the following Order:`,
        facts,
        conclusion: `IT IS SO ORDERED.\n\n_______________________________\nJudge Presiding\nDate: __________`,
        signatureBlock: this._signatureBlock(data, 'Petitioner'),
      },
      metadata: {
        documentType: 'child_custody_order',
        documentTitle: custodyTerm,
        state,
        estimatedPages: 2,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  _generateSummonsWithNotice(cfg, state, data) {
    // NY-specific document
    const petitioner = this._petitionerName(data);
    const respondent = this._respondentName(data);
    const county = data.county || '__________';

    const facts = {
      items: [
        {
          number: 1,
          content: `TO THE ABOVE-NAMED RESPONDENT, ${respondent.toUpperCase()}:`
        },
        {
          number: 2,
          content: `YOU ARE HEREBY SUMMONED to serve a notice of appearance or demand for complaint on the Plaintiff's attorney within 20 days after service of this Summons, exclusive of the day of service.`
        },
        {
          number: 3,
          content: `The nature of this action is: Action for Divorce pursuant to New York Domestic Relations Law.`
        },
        {
          number: 4,
          content: `The grounds for divorce are: ${cfg.grounds(data)}.`
        },
        {
          number: 5,
          content: `The relief sought includes: (a) Absolute divorce; (b) Equitable distribution of marital property; ${this._hasChildren(data) ? '(c) Custody and child support; (d) Such other relief as the Court deems just and proper.' : '(c) Such other relief as the Court deems just and proper.'}`
        },
        {
          number: 6,
          content: `IF YOU FAIL TO APPEAR, a judgment may be taken against you by default for the relief demanded in the Verified Complaint.`
        },
        {
          number: 7,
          content: `Plaintiff: ${petitioner}\nPlaintiff's Address: __________`
        },
      ],
    };

    return {
      sections: {
        header: cfg.court(county),
        caseCaption: `${petitioner},\n    Plaintiff,\n\n    -against-\n\n${respondent},\n    Defendant.\n\n${cfg.caseLabel} __________`,
        title: 'SUMMONS WITH NOTICE',
        introduction: '',
        facts,
        signatureBlock: this._signatureBlock(data, 'Plaintiff, Pro Se'),
      },
      metadata: {
        documentType: 'summons_with_notice',
        documentTitle: 'Summons with Notice',
        state: 'NY',
        estimatedPages: 2,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  _generateVerifiedComplaint(cfg, state, data) {
    // NY uses "Verified Complaint" as the petition equivalent
    const petitioner = this._petitionerName(data);
    const respondent = this._respondentName(data);
    const county = data.county || '__________';
    const marriageDate = data.marriageDate || '__________';
    const marriageCity = data.marriageCity || '__________';
    const marriageStateName = data.marriageStateName || '__________';
    const separationDate = data.separationDate || '__________';

    const facts = {
      items: [
        {
          number: 1,
          // NY DRL § 230 provides multiple residency bases (1-year or 2-year depending on circumstances).
          // The most common basis — when the cause of action arose in New York — requires only 1 year.
          // Using 1-year language here covers the majority of cases; attorneys should confirm the
          // applicable basis under DRL § 230 for the specific facts.
          content: `Plaintiff, ${petitioner}, is a resident of the State of New York and has been a resident of the State for at least one year immediately preceding the commencement of this action, satisfying the residency requirements of New York Domestic Relations Law § 230.`
        },
        {
          number: 2,
          content: `The parties were married on ${marriageDate} in ${marriageCity}, ${marriageStateName}.`
        },
        {
          number: 3,
          content: `The parties separated on or about ${separationDate}.`
        },
        {
          number: 4,
          content: `The grounds for divorce are: ${cfg.grounds(data)}, pursuant to New York Domestic Relations Law § 170.`
        },
        {
          number: 5,
          content: this._childrenSection(cfg, state, data)
        },
        {
          number: 6,
          content: this._propertySection(data)
        },
        {
          number: 7,
          content: this._supportSection(data)
        },
      ],
    };

    const conclusion = `WHEREFORE, Plaintiff demands judgment against Defendant as follows:\n\n1. Granting an absolute divorce to Plaintiff;\n2. Equitable distribution of all marital property and debts;\n${this._hasChildren(data) ? '3. Custody and child support as set forth herein;\n4. Such other relief as the Court deems just and proper.\n' : '3. Such other relief as the Court deems just and proper.\n'}`;

    return {
      sections: {
        header: cfg.court(county),
        caseCaption: `${petitioner},\n    Plaintiff,\n\n    -against-\n\n${respondent},\n    Defendant.\n\n${cfg.caseLabel} __________`,
        title: 'VERIFIED COMPLAINT FOR DIVORCE',
        introduction: `Plaintiff, ${petitioner}, by and through this Verified Complaint, alleges as follows:`,
        facts,
        conclusion,
        perjuryStatement: 'I, the undersigned, being duly sworn, depose and say that I am the Plaintiff in this action; that I have read the foregoing Complaint and know the contents thereof; and that the same is true to my knowledge, except as to those matters stated upon information and belief, and as to those matters, I believe them to be true.',
        signatureBlock: this._signatureBlock(data, 'Plaintiff'),
        notaryInstruction: 'This Verified Complaint must be sworn to before a notary public.',
        notaryBlock: cfg.notary(county),
      },
      metadata: {
        documentType: 'verified_complaint',
        documentTitle: 'Verified Complaint for Divorce',
        state: 'NY',
        estimatedPages: 3,
        generatedAt: new Date().toISOString(),
      },
    };
  }
}

module.exports = new DivorceDocumentGenerator();
