// templates/states/scotland/DivorceDecreeTemplate.js
// Scotland decree of divorce template
// Governing Law: Divorce (Scotland) Act 1976; Family Law (Scotland) Act 1985

'use strict';

const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');
const { resolveCustodyArrangement, resolvePrimaryResidenceName } = require('../../core/parenting');
const { asList } = require('../../core/dataShapes');

// The six sheriffdoms of Scotland (for the "SHERIFFDOM OF ... AT ..." heading, per Form G1 style)
const SCOTTISH_SHERIFFDOMS = [
  'GLASGOW AND STRATHKELVIN',
  'GRAMPIAN, HIGHLAND AND ISLANDS',
  'LOTHIAN AND BORDERS',
  'NORTH STRATHCLYDE',
  'SOUTH STRATHCLYDE, DUMFRIES AND GALLOWAY',
  'TAYSIDE, CENTRAL AND FIFE'
];

/**
 * Scotland Decree of Divorce Template
 *
 * In Scotland, the final divorce order is a "decree of divorce" granted by the
 * Sheriff Court (or Court of Session). It takes effect immediately — there is no
 * waiting period after the decree (unlike England's Decree Nisi / Conditional Order system).
 *
 * An "extract decree" is the certified copy that serves as proof of divorce.
 *
 * Key Legal References:
 * - Divorce (Scotland) Act 1976 — grounds for divorce
 * - Family Law (Scotland) Act 2006 — modernisation of divorce grounds
 * - Family Law (Scotland) Act 1985 — financial provision on divorce
 *   - s.9: Five principles of financial provision
 *   - s.10: Valuation of matrimonial property (date of separation or final hearing)
 * - Children (Scotland) Act 1995 — parental responsibilities and rights
 *
 * @class ScotlandDivorceDecreeTemplate
 * @extends BaseDivorceDecreeTemplate
 */
class ScotlandDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();

    this.state = 'SCO';
    this.stateName = 'Scotland';
    this.countryCode = 'UK';

    // Scottish terminology (see templates/core/terminology.js): the caption is the
    // court-name line (Sheriff Court / Court of Session); parties are
    // Pursuer/Defender (Divorce (Scotland) Act 1976); venue is the sheriffdom;
    // self-represented parties are "Party Litigants". No US caption furniture.
    this.terminology = {
      ...this.terminology,
      jurisdictionLabel: null,
      districtLabel: null,
      districtStyle: 'plain',
      jurisdictionTerm: 'Jurisdiction',
      districtTerm: 'Sheriffdom',
      districtPlaceholder: '[SHERIFFDOM]',
      filerLabel: 'Pursuer',
      responderLabel: 'Defender',
      selfRepresentedLabel: 'Party Litigant',
    };
    this.documentTitle = 'DECREE OF DIVORCE';

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
      margin: '2.54cm',
      paperSize: 'A4'
    };
  }

  getCaseNumberLabel() {
    return 'Court Ref. No.';
  }

  /**
   * Sheriff-court process is headed "SHERIFFDOM OF [sheriffdom] AT [place]"
   * (Ordinary Cause Rules 1993, Form G1 style). Whichever slot the interview did
   * not capture keeps a placeholder for the filer to complete.
   */
  getDefaultCourt(county) {
    const value = (county || '').trim().toUpperCase();
    if (!value) {
      return 'SHERIFFDOM OF [SHERIFFDOM] AT [PLACE]';
    }
    if (SCOTTISH_SHERIFFDOMS.includes(value)) {
      return `SHERIFFDOM OF ${value} AT [PLACE]`;
    }
    return `SHERIFFDOM OF [SHERIFFDOM] AT ${value}`;
  }

  /**
   * Scotland header.
   */
  generateHeader() {
    return 'IN SCOTLAND';
  }

  /**
   * Scotland venue — sheriffdom / court district.
   */
  generateVenue(county) {
    const location = (county || '[SHERIFFDOM]').toUpperCase();
    return `${location}`;
  }

  /**
   * Scotland case caption uses Pursuer/Defender labels.
   */
  generateCaseCaption(divorceData) {
    const courtName = (divorceData.court || this.getDefaultCourt(divorceData.county)).toUpperCase();
    const caseLabel = this.getCaseNumberLabel();
    const caseNumber = divorceData.caseNumber || '[COURT REF. NUMBER]';
    const pursuer = (divorceData.petitionerName || '[PURSUER NAME]').toUpperCase();
    const defender = (divorceData.respondentName || '[DEFENDER NAME]').toUpperCase();

    // Form G1-style headings begin "SHERIFFDOM OF ..." with no "IN THE" prefix.
    const heading = courtName.startsWith('SHERIFFDOM') ? courtName : `IN THE ${courtName}`;

    const formatted = (
      `${heading}\n\n` +
      `${caseLabel} ${caseNumber}\n\n` +
      `DECREE OF DIVORCE\n\n` +
      `${pursuer}\n` +
      `Pursuer\n\n` +
      `— against —\n\n` +
      `${defender}\n` +
      `Defender`
    );

    return {
      courtName,
      caseNumber: divorceData.caseNumber,
      petitioner: divorceData.petitionerName,
      respondent: divorceData.respondentName,
      formatted
    };
  }

  /**
   * Scotland property division — Family Law (Scotland) Act 1985, s.9-10.
   * Five principles of financial provision:
   *   s.9(1)(a): Fair sharing of matrimonial property (default: equal division)
   *   s.9(1)(b): Fair account of economic advantage/disadvantage
   *   s.9(1)(c): Fair sharing of child-caring burden for up to 3 years
   *   s.9(1)(d): Adjustment from financial dependence (up to 3 years)
   *   s.9(1)(e): Relief of serious financial hardship (up to 3 years)
   * Matrimonial property = acquired during marriage (not before, not gifts/inheritance).
   */
  generatePropertyDivisionSection(divorceData) {
    const items = [];

    if (divorceData.hasProperty === false) {
      items.push({
        content: 'The Court finds there is no matrimonial property requiring division under the Family Law (Scotland) Act 1985.',
        type: 'finding'
      });
    } else {
      items.push({
        content: 'The Court has considered the fair sharing of matrimonial property in terms of the principles set out in section 9 of the Family Law (Scotland) Act 1985, and the factors in section 10.',
        type: 'finding'
      });

      if (divorceData.capitalSum) {
        items.push({
          content: `THE COURT ORDERS that ${divorceData.capitalSumPayor || divorceData.respondentName || 'the Defender'} shall pay a capital sum of £${divorceData.capitalSum} to ${divorceData.capitalSumPayee || divorceData.petitionerName || 'the Pursuer'} in terms of section 8(1)(a) of the Family Law (Scotland) Act 1985.`,
          type: 'order'
        });
      }

      if (asList(divorceData.petitionerProperty).length > 0) {
        items.push({
          content: `THE COURT ORDERS that the following property is transferred to ${divorceData.petitionerName || 'the Pursuer'}:`,
          type: 'order'
        });
        asList(divorceData.petitionerProperty).forEach(prop => {
          items.push({ content: `- ${prop}`, type: 'property_item' });
        });
      }

      if (asList(divorceData.respondentProperty).length > 0) {
        items.push({
          content: `THE COURT ORDERS that the following property is transferred to ${divorceData.respondentName || 'the Defender'}:`,
          type: 'order'
        });
        asList(divorceData.respondentProperty).forEach(prop => {
          items.push({ content: `- ${prop}`, type: 'property_item' });
        });
      }

      if (!divorceData.petitionerProperty && !divorceData.respondentProperty && !divorceData.capitalSum) {
        items.push({
          content: 'THE COURT ORDERS that each party shall retain the property currently in that party\'s possession, subject to the principle of fair sharing under section 9(1)(a) of the Family Law (Scotland) Act 1985.',
          type: 'order'
        });
      }
    }

    return { title: 'FINANCIAL PROVISION', items, type: 'property' };
  }

  /**
   * Scotland child custody — "parental responsibilities and rights" (PRRs)
   * under Children (Scotland) Act 1995, s.11.
   */
  generateChildCustodySection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    items.push({
      content: 'The Court, treating the welfare of the child(ren) as its paramount consideration (Children (Scotland) Act 1995, s.11(7)), makes the following order regarding parental responsibilities and rights:',
      type: 'finding'
    });

    items.push({ content: 'The child(ren) subject to this order:', type: 'order' });

    divorceData.children.forEach((child, index) => {
      const childInfo = typeof child === 'string'
        ? child
        : `${child.name || '[CHILD NAME]'}, born ${this.formatDate(child.birthDate ?? child.dob ?? child.dateOfBirth) || '[BIRTH DATE]'}`;
      items.push({ content: `${index + 1}. ${childInfo}`, type: 'child_item' });
    });

    // Safety rule (mirrors the base class): only positively recognized
    // custody values render a joint or sole order. Legacy free text like
    // "joint decision making" maps to the joint branch; anything ambiguous
    // renders neutral as-agreed language with a placeholder — NEVER a sole
    // order (see templates/core/parenting.js).
    const custody = resolveCustodyArrangement(divorceData);
    const residenceName = resolvePrimaryResidenceName(divorceData);
    let soleCustodianName = null;
    if (custody.kind === 'joint') {
      items.push({
        content: `THE COURT ORDERS that ${divorceData.petitionerName || 'the Pursuer'} and ${divorceData.respondentName || 'the Defender'} shall have shared parental responsibilities and rights in respect of the child(ren) in terms of section 11 of the Children (Scotland) Act 1995.`,
        type: 'order'
      });
      items.push({
        content: `THE COURT ORDERS that the child(ren) shall reside primarily with ${resolvePrimaryResidenceName(divorceData) || divorceData.petitionerName || 'the Pursuer'}.`,
        type: 'order'
      });
    } else if (custody.kind === 'sole_petitioner' || custody.kind === 'sole_respondent' || custody.kind === 'legacy_sole') {
      const custodianName =
        custody.kind === 'sole_petitioner'
          ? (divorceData.petitionerName || 'the Pursuer')
          : custody.kind === 'sole_respondent'
            ? (divorceData.respondentName || 'the Defender')
            : (resolvePrimaryResidenceName(divorceData) || divorceData.petitionerName || 'the Pursuer');
      const otherParentName =
        custody.kind === 'sole_respondent'
          ? (divorceData.petitionerName || 'the Pursuer')
          : (divorceData.respondentName || 'the Defender');
      soleCustodianName = custodianName;
      items.push({
        content: `THE COURT ORDERS that ${custodianName} shall have sole parental responsibilities and rights in respect of the child(ren) in terms of section 11 of the Children (Scotland) Act 1995.`,
        type: 'order'
      });
      items.push({
        content: `THE COURT ORDERS that ${otherParentName} shall have contact with the child(ren) as agreed by the parties or as set out in a contact schedule annexed to this decree.`,
        type: 'order'
      });
    } else {
      // Unrecognized/undecided arrangement — neutral order with an explicit
      // placeholder for the parties' actual agreement. Never default to sole.
      items.push({
        content: 'IT IS ORDERED that the parties shall exercise legal custody and decision-making responsibility for the minor child(ren) as agreed by the parties: [ARRANGEMENT — set out the parties\' decision-making agreement].',
        type: 'order'
      });
    }

    // Primary residence: ordered whenever the case data says where the
    // child(ren) live, regardless of the custody branch. (The joint branch
    // keeps its historical wording and fallbacks unchanged.)
    if (custody.kind !== 'joint' && residenceName && residenceName !== soleCustodianName) {
      items.push({
        content: `IT IS ORDERED that the child(ren) shall primarily reside with ${residenceName}.`,
        type: 'order'
      });
    }

    items.push({ content: this.getVisitationLanguage(divorceData), type: 'order' });

    return { title: 'PARENTAL RESPONSIBILITIES AND RIGHTS', items, type: 'custody' };
  }

  /**
   * Scotland contact language.
   */
  getVisitationLanguage(divorceData) {
    return 'THE COURT ORDERS that each party shall facilitate the child(ren)\'s relationship with the other parent and shall not act in any way intended to alienate the child(ren) from the other parent. Both parties shall cooperate in making arrangements for the welfare of the child(ren).';
  }

  /**
   * Scotland child maintenance — aliment under Family Law (Scotland) Act 1985 / CMS.
   */
  generateChildSupportSection(divorceData) {
    if (divorceData.hasMinorChildren === false || !divorceData.children || divorceData.children.length === 0) {
      return null;
    }

    const items = [];

    if (divorceData.childSupportAmount) {
      items.push({
        content: `THE COURT ORDERS that ${divorceData.childSupportObligor || divorceData.respondentName || 'the Defender'} shall pay to ${divorceData.childSupportObligee || divorceData.petitionerName || 'the Pursuer'} aliment for the child(ren) in the sum of £${divorceData.childSupportAmount} per month in terms of the Family Law (Scotland) Act 1985.`,
        type: 'order'
      });
    } else {
      items.push({
        content: 'THE COURT ORDERS that child maintenance shall be payable in accordance with the Child Maintenance Service calculation or as privately agreed between the parties.',
        type: 'order'
      });
    }

    return { title: 'CHILD MAINTENANCE (ALIMENT)', items, type: 'child_support' };
  }

  /**
   * Scotland spousal support — periodical allowance under FL(S)A 1985, s.9(1)(d)-(e).
   */
  generateSpousalSupportSection(divorceData) {
    if (!divorceData.spousalSupportAwarded && !divorceData.spousalSupportWaived) {
      return null;
    }

    const items = [];

    if (divorceData.spousalSupportWaived) {
      items.push({
        content: 'THE COURT ORDERS that neither party shall be entitled to periodical allowance from the other, and each party renounces any claim for such allowance under the Family Law (Scotland) Act 1985.',
        type: 'order'
      });
    } else if (divorceData.spousalSupportAwarded) {
      items.push({
        content: `THE COURT ORDERS that ${divorceData.spousalSupportPayor || divorceData.respondentName || 'the Defender'} shall pay periodical allowance to ${divorceData.spousalSupportPayee || divorceData.petitionerName || 'the Pursuer'} in the sum of £${divorceData.spousalSupportAmount || '[AMOUNT]'} per month for a period of ${divorceData.spousalSupportDuration || '[DURATION]'}, in terms of section 9(1)(d) of the Family Law (Scotland) Act 1985.`,
        type: 'order'
      });
    }

    return { title: 'PERIODICAL ALLOWANCE', items, type: 'spousal_support' };
  }

  /**
   * Scotland final orders section.
   */
  generateFinalOrdersSection(divorceData) {
    const items = [];

    items.push({
      content: 'THE COURT GRANTS decree of divorce dissolving the marriage between the parties.',
      type: 'order'
    });

    items.push({
      content: 'THE COURT ORDERS that all claims for financial provision not expressly granted are dismissed.',
      type: 'order'
    });

    items.push({
      content: 'THE COURT ORDERS that each party shall execute and deliver such further documents and do such further acts as may be necessary to give effect to the terms of this decree.',
      type: 'order'
    });

    items.push({
      content: this.getEffectiveDateText(),
      type: 'order'
    });

    items.push({
      content: this.getCertificateNote(),
      type: 'order'
    });

    return { title: 'FINAL ORDERS', items, type: 'final_orders' };
  }

  /**
   * Scotland decree takes effect immediately.
   */
  getEffectiveDateText() {
    return 'This decree of divorce takes effect on the date it is granted. There is no further waiting period.';
  }

  /**
   * Scotland — extract decree serves as proof.
   */
  getCertificateNote() {
    return 'An extract decree of divorce may be obtained from the court and serves as proof that the marriage has been dissolved.';
  }
}

module.exports = ScotlandDivorceDecreeTemplate;
