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
