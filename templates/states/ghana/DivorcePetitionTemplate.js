// templates/states/ghana/DivorcePetitionTemplate.js
// Ghana divorce petition template
// Governing Law: Matrimonial Causes Act 1971 (Act 367)

'use strict';

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * Ghana Divorce Petition Template
 *
 * Ghana uses the term "Petition" for divorce proceedings under the
 * Matrimonial Causes Act 1971 (Act 367).
 *
 * Key Legal References:
 * - Matrimonial Causes Act 1971 (Act 367) — sole ground: marriage has broken down
 *   beyond reconciliation (s.2)
 *   - s.2(1)(a): adultery + intolerability
 *   - s.2(1)(b): unreasonable behaviour
 *   - s.2(1)(c): desertion for 2+ years
 *   - s.2(1)(d): no cohabitation for 5+ years
 *   - s.2(1)(e): 2-year separation with consent
 * - Marriage Ordinance (Cap 127) — ordinance marriages
 * - Customary Marriage and Divorce (Registration) Act 1985 (PNDCL 112) — customary marriages
 * - Marriage of Mohammedans Ordinance (Cap 129) — Mohammedan marriages
 * - Children's Act 1998 (Act 560) — best interests of the child
 * - 1992 Constitution, Art. 22 — spouse's property rights
 *
 * Residency Requirement (MCA s.23):
 * - Either party must be domiciled in Ghana OR resident for at least 3 years before filing.
 *
 * Two-Year Bar (MCA s.1):
 * - No petition within 2 years of marriage except by leave of court in exceptional circumstances.
 *
 * Mandatory Reconciliation (MCA s.2(3)):
 * - Court MUST refer parties to conciliation before proceeding.
 *
 * Process: Petition -> Reconciliation -> Hearing -> Decree Nisi -> Decree Absolute
 *
 * Ghana-Specific:
 * - Parties are "Petitioner" and "Respondent"
 * - Court is the High Court of Justice (Matrimonial/Family Division)
 * - Court filing fee: approx. GHS 50 (lawyer professional fees are separate)
 * - Suit No. instead of Case No.
 * - A4 paper size
 *
 * @class GhanaDivorcePetitionTemplate
 * @extends BaseDivorcePetitionTemplate
 */
class GhanaDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'GH';
    this.stateName = 'Ghana';
    this.countryCode = 'GH';
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
      'groundsForDivorce',
      'marriageType'
    ];

    // Ghana residency: domicile OR 3 years resident (MCA s.23)
    this.residencyRequirements = {
      stateMonths: 36,
      countyDays: 0,
      description: 'Either party must be domiciled in Ghana OR have been resident in Ghana for at least 3 years immediately before filing the petition (Matrimonial Causes Act 1971, s.23).'
    };

    // No mandatory waiting period after filing, but reconciliation is required
    this.waitingPeriod = {
      days: 0,
      description: 'No mandatory waiting period after filing. However, the court MUST refer parties to conciliation before proceeding (MCA s.2(3)). Petition cannot be filed within 2 years of marriage except by leave of court (MCA s.1).'
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
    return 'Suit No.';
  }

  getDefaultCourt(county) {
    const city = (county || '[CITY]').toUpperCase();
    return `HIGH COURT OF JUSTICE, ${city}`;
  }

  /**
   * Ghana case caption uses "Petitioner" and "Respondent".
   * High Court uses "Suit No." and the Matrimonial Causes Act heading.
   */
  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county) || '[COURT NAME]').toUpperCase();
    const caseLabel = this.getCaseNumberLabel();
    const caseNumber = divorceData.caseNumber || '[SUIT NUMBER]';

    const petitioner = (divorceData.petitionerName || '[PETITIONER NAME]').toUpperCase();
    const respondent = (divorceData.respondentName || '[RESPONDENT NAME]').toUpperCase();

    const caption = [
      `IN THE ${courtName}`,
      '',
      `${caseLabel} ${caseNumber}`,
      '',
      `IN THE MATTER OF THE MATRIMONIAL CAUSES ACT 1971 (ACT 367)`,
      '',
      `AND`,
      '',
      `IN THE MATTER OF A PETITION FOR DIVORCE`,
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
   * Ghana jurisdiction statement — MCA s.23.
   * Either party must be domiciled in Ghana or resident for 3 years.
   */
  getJurisdictionStatement(divorceData) {
    return `The Petitioner (or the Respondent) is domiciled in Ghana or has been resident in Ghana for at least three years immediately preceding the filing of this Petition, as required by section 23 of the Matrimonial Causes Act 1971 (Act 367). The parties were married under ${divorceData.marriageType || '[MARRIAGE TYPE]'} law.`;
  }

  /**
   * Ghana venue reason — Petitioner or Respondent resides in this court location.
   */
  getVenueReason(divorceData) {
    const location = divorceData.county || '[COURT LOCATION]';
    return `the Petitioner or Respondent resides within the jurisdiction of the High Court at ${location}`;
  }

  /**
   * Ghana header uses Republic designation.
   */
  generateHeader() {
    return 'REPUBLIC OF GHANA';
  }

  /**
   * Ghana venue uses city/district of filing.
   */
  generateVenue(county) {
    const location = (county || '[CITY/DISTRICT]').toUpperCase();
    return `IN THE HIGH COURT OF JUSTICE, ${location}`;
  }

  /**
   * Ghana relief section — uses Matrimonial Causes Act terminology.
   * MCA s.20 for maintenance, s.2 for divorce.
   * Children's Act 1998 (Act 560) for children matters.
   * 1992 Constitution Art. 22 for property.
   */
  generateReliefSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 15;

    items.push({
      number: null,
      content: 'THE PETITIONER PRAYS that the Court grant the following relief:',
      type: 'relief_intro'
    });

    const reliefItems = [
      'A decree dissolving the marriage between the Petitioner and the Respondent pursuant to section 2 of the Matrimonial Causes Act 1971 (Act 367);',
      'An equitable division of the matrimonial property pursuant to Article 22 of the 1992 Constitution of the Republic of Ghana;',
      'An order allocating responsibility for debts in an equitable manner;'
    ];

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('An order for custody of the child(ren) of the marriage in the best interests of the child(ren) pursuant to the Children\'s Act 1998 (Act 560);');
      reliefItems.push('An order for child maintenance pursuant to the Children\'s Act 1998 (Act 560);');
    }

    if (divorceData.spousalSupportRequested || divorceData.requestSpousalSupport) {
      reliefItems.push('An order for maintenance of the Petitioner pursuant to section 20 of the Matrimonial Causes Act 1971 (Act 367);');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`An order restoring the Petitioner's former name: ${divorceData.previousName};`);
    }

    reliefItems.push('Such further and other relief as this Honourable Court may deem just and equitable.');

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
      title: 'RELIEF SOUGHT',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * Ghana verification text.
   * Ghana uses a sworn affidavit under the Oaths Act 1972 (NRCD 6).
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PETITIONER NAME]';
    return `I, ${name}, Petitioner, make oath and say that the contents of this Petition are true to the best of my knowledge, information, and belief.`;
  }

  /**
   * Ghana grounds for divorce.
   * Matrimonial Causes Act 1971, s.2(1) — sole ground is that the marriage
   * has broken down beyond reconciliation, proved by one of five facts.
   */
  getGroundsStatement(groundsForDivorce) {
    const g = (groundsForDivorce || 'consent_separation').toLowerCase();
    if (g.includes('adultery')) {
      return 'The Respondent has committed adultery and the Petitioner finds it intolerable to live with the Respondent, within the meaning of section 2(1)(a) of the Matrimonial Causes Act 1971 (Act 367). The marriage has accordingly broken down beyond reconciliation.';
    }
    if (g.includes('unreasonable') || g.includes('behaviour') || g.includes('cruelty')) {
      return 'The Respondent has behaved in such a way that the Petitioner cannot reasonably be expected to live with the Respondent, within the meaning of section 2(1)(b) of the Matrimonial Causes Act 1971 (Act 367). The marriage has accordingly broken down beyond reconciliation.';
    }
    if (g.includes('desertion')) {
      return 'The Respondent has deserted the Petitioner for a continuous period of at least two years immediately preceding the filing of this Petition, within the meaning of section 2(1)(c) of the Matrimonial Causes Act 1971 (Act 367). The marriage has accordingly broken down beyond reconciliation.';
    }
    if (g.includes('five') || g.includes('5')) {
      return 'The parties have not cohabited for a continuous period of at least five years immediately preceding the filing of this Petition, within the meaning of section 2(1)(d) of the Matrimonial Causes Act 1971 (Act 367). The marriage has accordingly broken down beyond reconciliation.';
    }
    // Default: 2-year separation with consent
    return 'The parties have not cohabited for a continuous period of at least two years immediately preceding the filing of this Petition, and the Respondent consents to the divorce, within the meaning of section 2(1)(e) of the Matrimonial Causes Act 1971 (Act 367). The marriage has accordingly broken down beyond reconciliation.';
  }

  /**
   * Override base getGroundsText to use Ghana-specific getGroundsStatement.
   */
  getGroundsText(grounds, divorceData) {
    return this.getGroundsStatement(grounds);
  }

  /**
   * Ghana-specific validation.
   */
  performStateSpecificValidation(divorceData) {
    const errors = [];
    const warnings = [];

    if (!divorceData.county && !divorceData.city) {
      errors.push('City or district is required for Ghana divorce petitions.');
    }

    if (!divorceData.marriageType) {
      warnings.push('Marriage type (ordinance, customary, or Mohammedan) should be specified for Ghana divorce petitions.');
    }

    return { errors, warnings };
  }
}

module.exports = GhanaDivorcePetitionTemplate;
