// templates/states/alberta/DivorceDecreeTemplate.js
// Alberta divorce judgment template
// Governing Law: Divorce Act (RSC 1985, c. 3); Alberta Rules of Court, Alta Reg 124/2010

'use strict';

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');

/**
 * Alberta Divorce Judgment Template
 *
 * Alberta's Court of King's Bench issues a "Divorce Judgment" as the final order.
 * Uncontested divorces may proceed by way of desk application (without a hearing).
 *
 * Key Legal References:
 * - Divorce Act, RSC 1985, c. 3
 *   - s.10: Duty to consider children's arrangements
 *   - s.12: Effective date 31 days after judgment
 *   - s.13: Certificate of Divorce after effective date
 * - Matrimonial Property Act, RSA 2000, c. M-8 (equal division of matrimonial property)
 * - Family Law Act, SA 2003, c. F-4.5 (parenting, support)
 * - Alberta Rules of Court, Alta Reg 124/2010
 *
 * Note: The court title changed from "Court of Queen's Bench" to
 * "Court of King's Bench of Alberta" in September 2022 upon accession of King Charles III.
 *
 * @class AlbertaDivorceDecreeTemplate
 * @extends BaseDivorceDecreeTemplate
 */
class AlbertaDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'AB';
    this.stateName = 'Alberta';
    this.countryCode = 'CA';
    this.documentTitle = 'DIVORCE JUDGMENT';

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
      'caseNumber',
      'marriageDate'
    ];

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

  getEffectiveDateText() {
    return 'This Divorce Judgment takes effect on the 31st day after it is made, unless appealed or the effective date is varied by order (Divorce Act, s.12(1)).';
  }

  getCertificateNote() {
    return 'A Certificate of Divorce may be obtained from the court office after the effective date, upon application by either party (Divorce Act, s.13).';
  }
}

module.exports = AlbertaDivorceDecreeTemplate;
