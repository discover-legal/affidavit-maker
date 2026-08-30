// services/supportDocs/floridaAnswer.js
// Florida Answer to Petition for Dissolution of Marriage.
//
// Substantive reference (not a form reproduction):
//   Fla. Fam. L.R.P. Form 12.903(a) — Answer, Waiver, and Request for Copy
//     of Final Judgment of Dissolution of Marriage
//   Fla. Fam. L.R.P. Form 12.903(c) — Answer and Counterpetition
// This builder DRAFTS the substance the respondent needs to plead; the
// official Florida Supreme Court Approved Family Law Form remains the
// filing conduit (see lib/officialForms.ts).

'use strict';

const { createAnswerBuilder, BLANK_SHORT } = require('./BaseAnswerTemplate');

const FLORIDA_UNSWORN =
  'Under penalty of perjury, I declare that I have read the foregoing, and that ' +
  'the facts stated in it are true. (Fla. Fam. L.R.P. 12.020; Fla. Stat. § 92.525.)';

function normalizeCountyName(county) {
  return typeof county === 'string' ? county.replace(/\s+county$/i, '').trim() : county;
}

function fromData(data) {
  return {
    county: normalizeCountyName(String(data.county || '').trim()) || BLANK_SHORT,
  };
}

const answerToPetition = createAnswerBuilder({
  state: 'FL',
  filerLabel: 'Respondent',
  opposingLabel: 'Petitioner',
  petitionTerm: 'Petition for Dissolution of Marriage',
  answerTitle: 'ANSWER TO PETITION FOR DISSOLUTION OF MARRIAGE',
  answerWithCounterTitle:
    'ANSWER TO PETITION FOR DISSOLUTION OF MARRIAGE AND COUNTERPETITION',
  counterTitle: 'COUNTERPETITION FOR DISSOLUTION OF MARRIAGE',
  counterPetitionForm: 'Fla. Fam. L.R.P. Form 12.903(b)',
  counterPetitionExamples: [
    'restoration of a former name (Fla. Stat. § 68.07)',
    "attorney's fees, suit money, and costs (Fla. Stat. § 61.16)",
    'declaration enforcing a prenuptial or postnuptial agreement',
    'equitable distribution of specific assets or debts (Fla. Stat. § 61.075)',
    'alimony (Fla. Stat. § 61.08) or a specific parenting plan (Fla. Stat. § 61.13)',
  ],
  noFaultGroundsRecital:
    'The marriage between the parties is irretrievably broken. ' +
    '(Fla. Stat. § 61.052(1)(a).)',
  header(data) {
    const { county } = fromData(data);
    return (
      `IN THE CIRCUIT COURT OF THE ___ JUDICIAL CIRCUIT, ` +
      `IN AND FOR ${county.toUpperCase()} COUNTY, FLORIDA`
    );
  },
  /**
   * FL-specific prenup affirmative defense (attorney round-2, Tavita,
   * 2026-08-30). Cites Fla. Stat. § 61.079 (Florida Uniform Premarital
   * Agreement Act) as the governing enforcement statute and § 61.075 as
   * the equitable-distribution frame the prenup displaces. Also
   * expressly denies the "marital" characterization of assets identified
   * in the Petition, which round-2 flagged as lumped in Answer ¶8.
   */
  prenupDefense(data, { year, dateFragment }) {
    void year;
    return (
      'PRENUPTIAL AGREEMENT. Respondent affirmatively pleads a prenuptial ' +
      `agreement${dateFragment} executed with independent counsel on both sides, which ` +
      'governs property division and precludes alimony. Respondent will seek ' +
      'enforcement of the prenuptial agreement pursuant to Fla. Stat. § 61.079 ' +
      '(Florida Uniform Premarital Agreement Act) and § 61.075 (equitable ' +
      'distribution). Respondent specifically denies that the assets and debts ' +
      'identified in the Petition are marital to the extent the prenuptial ' +
      'agreement characterizes them as separate property, and any claim ' +
      'inconsistent with the prenuptial agreement is barred.'
    );
  },
  answerWherefore(data, parties) {
    void data;
    void parties;
    return (
      'WHEREFORE, Respondent respectfully requests that the Court: (a) dismiss or ' +
      "deny the relief sought in the Petition for Dissolution of Marriage to the extent " +
      "inconsistent with the parties' prenuptial agreement; (b) enforce the parties' " +
      'prenuptial agreement pursuant to Fla. Stat. §§ 61.079 and 61.075; (c) preserve ' +
      'all affirmative defenses and rights not expressly waived; and (d) grant such ' +
      'other and further relief as the Court deems just and proper.'
    );
  },
  residencyClause(data) {
    const { county } = fromData(data);
    return (
      `Respondent (or Petitioner) has been a resident of Florida for at least six months ` +
      `immediately before the filing of this Counterpetition, and this action is properly ` +
      `venued in ${county} County. (Fla. Stat. §§ 61.021, 47.011.)`
    );
  },
  verification: {
    unsworn: FLORIDA_UNSWORN,
    notaryHeader: ['STATE OF FLORIDA', `COUNTY OF ${BLANK_SHORT}`],
  },
});

module.exports = { answerToPetition };
