// templates/states/quebec/DivorceDecreeTemplate.js
// Quebec divorce judgment template
// Governing Law: Divorce Act (RSC 1985, c. 3); Code of Civil Procedure, CQLR c. C-25.01

'use strict';

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');

/**
 * Quebec Divorce Judgment Template
 *
 * Quebec's Superior Court (Cour supérieure) issues the final divorce judgment.
 * Quebec follows the federal Divorce Act for the divorce itself, but provincial
 * law governs property division, custody, and support procedures.
 *
 * Quebec civil law creates important distinctions:
 *   - Family patrimony (patrimoine familial) is MANDATORY — the court MUST partition
 *     certain assets equally regardless of ownership or agreement between spouses
 *   - Partnership of acquests (société d'acquêts) is the default matrimonial regime
 *     and divides property acquired during the marriage
 *   - The court must verify that adequate arrangements exist for any children
 *
 * Key Legal References:
 * - Divorce Act, RSC 1985, c. 3
 *   - s.10: Duty of court regarding reasonable arrangements for children
 *   - s.12: Divorce effective 31 days after judgment
 *   - s.13: Certificate of Divorce issued after effective date
 * - Civil Code of Quebec, CQLR c. CCQ-1991
 *   - Arts. 394-430: Family patrimony (mandatory equal partition)
 *   - Arts. 448-484: Partnership of acquests (default matrimonial regime)
 * - Code of Civil Procedure, CQLR c. C-25.01 (procedure)
 *
 * @class QuebecDivorceDecreeTemplate
 * @extends BaseDivorceDecreeTemplate
 */
class QuebecDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'QC';
    this.stateName = 'Quebec';
    this.countryCode = 'CA';
    this.documentTitle = 'DIVORCE JUDGMENT\n(JUGEMENT EN DIVORCE)';

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
    return 'No. :';
  }

  getDefaultCourt(county) {
    const district = (county || '[JUDICIAL DISTRICT]').toUpperCase();
    return `SUPERIOR COURT (COUR SUPÉRIEURE) — DISTRICT OF ${district}`;
  }

  getEffectiveDateText() {
    return 'This Divorce Judgment takes effect on the 31st day after it is pronounced, unless appealed or the effective date is varied (Divorce Act, s.12(1)).';
  }

  getCertificateNote() {
    return 'A Certificate of Divorce (Certificat de divorce) may be obtained from the court clerk after the effective date (Divorce Act, s.13).';
  }

  /**
   * Quebec-specific note about mandatory family patrimony partition.
   * This must appear in any Quebec divorce decree where applicable.
   */
  getFamilyPatrimonyNote() {
    return 'IMPORTANT — FAMILY PATRIMONY (PATRIMOINE FAMILIAL): Under articles 394-430 of the Civil Code of Quebec, the family patrimony must be partitioned equally between the spouses regardless of ownership. The family patrimony includes: the family residences and rights conferred by a lease, the furnishings in the family residences, motor vehicles used for family travel, and retirement plans and pension plans accumulated during the marriage. This partition is mandatory and cannot be waived except as permitted by law.';
  }
}

module.exports = QuebecDivorceDecreeTemplate;
