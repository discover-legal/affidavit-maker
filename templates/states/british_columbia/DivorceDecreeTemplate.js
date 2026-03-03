// templates/states/british_columbia/DivorceDecreeTemplate.js
// British Columbia divorce judgment template
// Governing Law: Divorce Act (RSC 1985, c. 3); BC Supreme Court Family Rules, BC Reg. 169/2009

'use strict';

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');

/**
 * British Columbia Divorce Judgment Template
 *
 * In BC, the final divorce order is a "Divorce Judgment" granted by the
 * Supreme Court of British Columbia. The BC Supreme Court Family Rules
 * provide for either contested or uncontested (desk order) divorce proceedings.
 *
 * Key Legal References:
 * - Divorce Act, RSC 1985, c. 3
 *   - s.10: Duty to consider reasonable arrangements for children
 *   - s.12: Divorce effective 31 days after judgment (unless waived)
 *   - s.13: Certificate of Divorce issued after effective date
 * - Family Law Act, SBC 2011, c. 25 (property, parenting, support)
 * - BC Supreme Court Family Rules, BC Reg. 169/2009
 *
 * @class BCDivorceDecreeTemplate
 * @extends BaseDivorceDecreeTemplate
 */
class BCDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'BC';
    this.stateName = 'British Columbia';
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
    const registry = (county || '[REGISTRY]').toUpperCase();
    return `SUPREME COURT OF BRITISH COLUMBIA — ${registry} REGISTRY`;
  }

  getEffectiveDateText() {
    return 'This Divorce Judgment takes effect on the 31st day after it is made, unless appealed or the effective date is varied by order (Divorce Act, s.12(1)).';
  }

  getCertificateNote() {
    return 'A Certificate of Divorce may be obtained from the court registry after the effective date of this Judgment, upon request (Divorce Act, s.13).';
  }
}

module.exports = BCDivorceDecreeTemplate;
