// templates/states/ontario/DivorceDecreeTemplate.js
// Ontario divorce judgment template
// Governing Law: Divorce Act (RSC 1985, c. 3); Family Law Rules, O. Reg. 114/99

'use strict';

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');

/**
 * Ontario Divorce Judgment Template
 *
 * In Ontario, the final divorce order is called a "Divorce Order" (not "Decree").
 * It is issued by the Superior Court of Justice. In uncontested cases, it is typically
 * granted on the papers without a hearing (using a Divorce Order Endorsement form).
 *
 * The Divorce Order becomes effective 31 days after it is made (Divorce Act, s.12(1))
 * unless both spouses waive that period or the court reduces it.
 *
 * Key Legal References:
 * - Divorce Act, RSC 1985, c. 3
 *   - s.10: Duty of court — consider possibility of reconciliation, ensure reasonable
 *     arrangements for children
 *   - s.12: Effective date of divorce — 31 days after judgment unless varied
 *   - s.13: Certificate of divorce — issued by registrar after effective date
 * - Family Law Act, RSO 1990, c. F.3 (property and spousal support)
 * - Family Law Rules, O. Reg. 114/99 (Form 25A — Divorce Order)
 *
 * @class OntarioDivorceDecreeTemplate
 * @extends BaseDivorceDecreeTemplate
 */
class OntarioDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'ON';
    this.stateName = 'Ontario';
    this.countryCode = 'CA';
    this.documentTitle = 'DIVORCE ORDER';

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
    const city = (county || '[CITY]').toUpperCase();
    return `SUPERIOR COURT OF JUSTICE — ${city}`;
  }

  /**
   * Ontario divorce effective date: 31 days after judgment (Divorce Act s.12(1)).
   * Parties may waive this period by written agreement (s.12(2)).
   */
  getEffectiveDateText() {
    return 'This Divorce Order takes effect on the 31st day after it is made, unless appealed or the effective date is varied by order (Divorce Act, s.12(1)).';
  }

  /**
   * Ontario uses "Certificate of Divorce" issued by the court registrar
   * after the effective date (Divorce Act, s.13).
   */
  getCertificateNote() {
    return 'A Certificate of Divorce may be obtained from the court office after the effective date of this Order, upon application by either party (Divorce Act, s.13).';
  }
}

module.exports = OntarioDivorceDecreeTemplate;
