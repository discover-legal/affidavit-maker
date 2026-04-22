// templates/states/south_africa/DivorcePetitionTemplate.js
// South Africa divorce summons template
// Governing Law: Divorce Act 70 of 1979; Matrimonial Property Act 88 of 1984

'use strict';

const BaseDivorcePetitionTemplate = require('../../core/BaseDivorcePetitionTemplate');

/**
 * South Africa Divorce Petition (Combined Summons) Template
 *
 * In South Africa, divorce proceedings are initiated by a "Combined Summons"
 * containing the "Particulars of Claim". The action is brought in the High Court
 * of South Africa (the division having jurisdiction over the parties' domicile).
 *
 * Key Legal References:
 * - Divorce Act 70 of 1979
 *   - s.2: Jurisdiction — domicile of either spouse in SA
 *   - s.4(1): Irretrievable breakdown of the marriage
 *   - s.5: Mental illness or continuous unconsciousness
 *   - s.6: Safeguards for children — court must be satisfied re arrangements
 *   - s.7: Division of assets, maintenance
 * - Matrimonial Property Act 88 of 1984
 *   - Governs property regimes: in community of property, out of community with/without accrual
 * - Children's Act 38 of 2005
 *   - s.18: Parental responsibilities and rights (guardianship, care, contact)
 *   - s.7: Best interests of the child standard
 * - Recognition of Customary Marriages Act 120 of 1998
 *   - s.7: Default in community of property
 * - Maintenance Act 99 of 1998
 *   - Governs spousal and child maintenance
 *
 * Jurisdiction (Divorce Act, s.2(1), as amended by Domicile Act 3 of 1992):
 * - Either spouse must be (a) domiciled in the court's area of jurisdiction, OR
 *   (b) ordinarily resident in the court's area and have been ordinarily resident
 *   in South Africa for at least one year immediately prior to instituting the action.
 *
 * South Africa-Specific:
 * - Parties are "Plaintiff" and "Defendant" (traditional adversarial terminology)
 * - Court is the High Court of South Africa (specific division)
 * - Filing fee: per High Court tariff schedule (sheriff's costs additional)
 * - Undefended divorce: Plaintiff applies for default judgment
 * - Case No. assigned by the Registrar of the High Court
 * - A4 paper size
 *
 * @class SouthAfricaDivorcePetitionTemplate
 * @extends BaseDivorcePetitionTemplate
 */
class SouthAfricaDivorcePetitionTemplate extends BaseDivorcePetitionTemplate {
  constructor() {
    super();

    this.state = 'ZA';
    this.stateName = 'South Africa';
    this.countryCode = 'ZA';
    this.documentTitle = 'COMBINED SUMMONS';

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

    // SA jurisdiction: domicile OR ordinary residence for 1+ year (Divorce Act s.2(1))
    this.residencyRequirements = {
      stateMonths: 12,
      countyDays: 0,
      description: 'Either spouse must be (a) domiciled in the court\'s area of jurisdiction, OR (b) ordinarily resident in the court\'s area and have been ordinarily resident in South Africa for at least one year immediately prior to instituting the action (Divorce Act 70 of 1979, s.2(1), as amended by the Domicile Act 3 of 1992).'
    };

    // No mandatory waiting period after filing
    this.waitingPeriod = {
      days: 0,
      description: 'No mandatory waiting period after filing. The decree takes effect immediately upon being granted.'
    };

    this.formatting = {
      fontSize: '12pt',
      fontFamily: 'Times New Roman',
      lineHeight: '1.5',
      margin: '2.54cm',
      paperSize: 'A4'
    };
  }

  getCaseNumberLabel() {
    return 'Case No.';
  }

  getDefaultCourt(county) {
    const division = (county || '[DIVISION]').toUpperCase();
    return `HIGH COURT OF SOUTH AFRICA (${division})`;
  }

  /**
   * South Africa case caption uses "Plaintiff" and "Defendant".
   * Combined Summons format — "In the matter between" style.
   */
  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county) || '[COURT NAME]').toUpperCase();
    const caseLabel = this.getCaseNumberLabel();
    const caseNumber = divorceData.caseNumber || '[CASE NUMBER]';

    const plaintiff = (divorceData.petitionerName || '[PLAINTIFF NAME]').toUpperCase();
    const defendant = (divorceData.respondentName || '[DEFENDANT NAME]').toUpperCase();

    const caption = [
      `IN THE ${courtName}`,
      '',
      `${caseLabel} ${caseNumber}`,
      '',
      `In the matter between:`,
      '',
      `${plaintiff}`,
      `Plaintiff`,
      '',
      `and`,
      '',
      `${defendant}`,
      `Defendant`,
      '',
      `COMBINED SUMMONS`
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
   * South Africa jurisdiction statement — Divorce Act 70 of 1979, s.2(1).
   * Either spouse must be domiciled OR ordinarily resident for 1+ year in SA.
   * Uses "Plaintiff" (not "Applicant" or "Petitioner").
   */
  getJurisdictionStatement(divorceData) {
    return `The Plaintiff is domiciled (alternatively, ordinarily resident) within the area of jurisdiction of this Honourable Court and this Honourable Court has jurisdiction to hear this matter in terms of section 2(1) of the Divorce Act 70 of 1979.`;
  }

  /**
   * South Africa venue reason — domicile falls within the court's division.
   */
  getVenueReason(divorceData) {
    const division = divorceData.county || '[DIVISION]';
    return `the Plaintiff is domiciled within the area of jurisdiction of the ${division}`;
  }

  /**
   * South Africa relief section — uses Divorce Act and related statutes.
   * Combined Summons contains the "Prayer" (relief requested).
   * Property relief depends on the matrimonial property regime.
   */
  generateReliefSection(divorceData) {
    const items = [];
    let paragraphNum = divorceData._paragraphNum || 15;

    items.push({
      number: null,
      content: 'WHEREFORE the Plaintiff prays for:',
      type: 'relief_intro'
    });

    const reliefItems = [
      'A decree of divorce in terms of section 4(1) of the Divorce Act 70 of 1979;'
    ];

    // Property relief depends on matrimonial property regime
    const regime = (divorceData.propertyRegime || '').toLowerCase();
    if (regime.includes('community') || regime === '') {
      reliefItems.push('A division of the joint estate in terms of the Matrimonial Property Act 88 of 1984;');
    } else if (regime.includes('accrual')) {
      reliefItems.push('An order for the sharing of the accrual in terms of section 3 of the Matrimonial Property Act 88 of 1984;');
    }

    if (divorceData.hasMinorChildren === true || (divorceData.children && divorceData.children.length > 0)) {
      reliefItems.push('An order awarding primary care of the minor child(ren) to the Plaintiff, alternatively such care and contact arrangements as this Honourable Court may deem fit, in terms of the Children\'s Act 38 of 2005;');
      reliefItems.push('An order for the Defendant to pay maintenance in respect of the minor child(ren) in terms of the Maintenance Act 99 of 1998;');
    }

    if (divorceData.pensionSharing) {
      reliefItems.push('An order in terms of section 7(7) of the Divorce Act 70 of 1979, read with the Pension Funds Act 24 of 1956, directing the relevant pension fund to pay a portion of the member spouse\'s pension interest to the non-member spouse;');
    }

    if (divorceData.spousalSupportRequested || divorceData.requestSpousalSupport) {
      reliefItems.push('An order for spousal maintenance in terms of section 7(2) of the Divorce Act 70 of 1979;');
    }

    if (divorceData.requestNameChange && divorceData.previousName) {
      reliefItems.push(`An order restoring the Plaintiff's former surname: ${divorceData.previousName};`);
    }

    reliefItems.push('Costs of suit, in the event that this matter is defended;');
    reliefItems.push('Further and/or alternative relief.');

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
      title: 'PRAYER',
      items,
      nextParagraphNumber: paragraphNum
    };
  }

  /**
   * South Africa verification text.
   * Affidavits are sworn before a Commissioner of Oaths under the
   * Justices of the Peace and Commissioners of Oaths Act 16 of 1963.
   * "Plaintiff" label per SA practice.
   */
  getVerificationText(divorceData) {
    const name = divorceData.petitionerName || '[PLAINTIFF NAME]';
    return `I, ${name}, the Plaintiff in this action, do hereby make oath and state that the facts set out in the Particulars of Claim are true and correct to the best of my knowledge and belief.`;
  }

  /**
   * South Africa grounds for divorce.
   * Divorce Act 70 of 1979:
   *   - s.4(1): Irretrievable breakdown of the marriage
   *   - s.5: Mental illness or continuous unconsciousness
   */
  getGroundsText(groundsForDivorce) {
    const g = (groundsForDivorce || 'irretrievable_breakdown').toLowerCase();
    if (g.includes('mental') || g.includes('unconscious')) {
      return 'The Defendant has been admitted to a psychiatric hospital or similar institution and there is no reasonable prospect of recovery, as contemplated in section 5 of the Divorce Act 70 of 1979.';
    }
    // Default: irretrievable breakdown
    return 'The marriage relationship between the parties has broken down irretrievably with no reasonable prospect of the restoration of a normal marriage relationship, as contemplated in section 4(1) of the Divorce Act 70 of 1979.';
  }
}

module.exports = SouthAfricaDivorcePetitionTemplate;
