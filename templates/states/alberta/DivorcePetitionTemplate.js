// templates/states/alberta/DivorcePetitionTemplate.js
// Alberta divorce petition template
// Governing Law: Divorce Act (RSC 1985, c. 3); Alberta Rules of Court, Alta Reg 124/2010

'use strict';

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Alberta Divorce Petition Template
 *
 * Alberta retains the term "Petition" for divorce proceedings in the Court of King's Bench.
 *
 * Key Legal References:
 * - Divorce Act, RSC 1985, c. 3 (federal)
 *   - s.8(2)(a): 1-year separation (primary ground)
 *   - s.8(2)(b): Adultery or physical/mental cruelty
 * - Matrimonial Property Act, RSA 2000, c. M-8 (provincial — equal division of matrimonial property)
 * - Family Law Act, SA 2003, c. F-4.5 (provincial — guardianship, parenting, support)
 * - Alberta Rules of Court, Alta Reg 124/2010 (procedure)
 * - Federal Child Support Guidelines, SOR/97-175
 *
 * Residency Requirement (Divorce Act, s.3):
 * - Either spouse must have been ordinarily resident in Alberta for at least 1 year.
 *
 * Alberta-Specific:
 * - Parties are "Petitioner" and "Respondent"
 * - Court is Court of King's Bench of Alberta (note: changed from "Queen's Bench" upon
 *   accession of King Charles III in September 2022)
 * - Judicial districts: Calgary, Edmonton, Red Deer, Lethbridge, Medicine Hat, Grande Prairie, etc.
 * - Joint petition (Statement of Claim for Divorce) available for uncontested divorces
 * - Alberta Matrimonial Property Act mandates equal division of net family property
 *   unless the court orders otherwise based on the factors in s.8
 *
 * @class AlbertaDivorcePetitionTemplate
 * @extends BaseDivorcePetitionTemplate
 */
class AlbertaDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'AB';
    this.stateName = 'Alberta';
    this.countryCode = 'CA';
    this.documentTitle = 'STATEMENT OF CLAIM FOR DIVORCE';

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
      description: 'Either spouse must have been ordinarily resident in Alberta for at least one year immediately before the divorce application (Divorce Act, s.3(1)).'
    };

    this.waitingPeriod = {
      days: 0,
      description: 'No mandatory waiting period after filing. The 1-year separation must be complete before or at the time of judgment.'
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
    return 'Court File No.';
  }

  getDefaultCourt(county) {
    const district = (county || '[JUDICIAL DISTRICT]').toUpperCase();
    return `COURT OF KING'S BENCH OF ALBERTA — JUDICIAL DISTRICT OF ${district}`;
  }

  getGroundsStatement(groundsForDivorce) {
    const g = (groundsForDivorce || 'separation').toLowerCase();
    if (g.includes('adultery')) {
      return 'The Respondent has committed adultery within the meaning of paragraph 8(2)(b)(i) of the Divorce Act.';
    }
    if (g.includes('cruelty') || g.includes('violence')) {
      return 'The Respondent has treated the Petitioner with physical or mental cruelty of such a kind as to render intolerable the continued cohabitation of the spouses, within the meaning of paragraph 8(2)(b)(ii) of the Divorce Act.';
    }
    return 'The spouses have lived separate and apart for at least one year immediately preceding the determination of the divorce action, within the meaning of paragraph 8(2)(a) of the Divorce Act.';
  }
}

module.exports = AlbertaDivorcePetitionTemplate;
