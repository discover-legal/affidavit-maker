// services/supportDocs/californiaAnswer.js
// California Response to Petition for Dissolution of Marriage.
//
// Substantive reference: Cal. Fam. Code §§ 2020 et seq.; the Judicial Council
// form for this pleading is FL-120 (Response — Marriage/Domestic Partnership).
// Discover.legal does NOT reproduce the official FL-120 form itself — the
// UI links the user to the Judicial Council form (see lib/officialForms.ts)
// and this builder drafts the substance the respondent will need to plead.

'use strict';

const { createAnswerBuilder, BLANK_SHORT } = require('./BaseAnswerTemplate');

const CALIFORNIA_UNSWORN =
  'I declare under penalty of perjury under the laws of the State of California ' +
  'that the foregoing is true and correct. (Cal. Code Civ. Proc. § 2015.5.)';

function normalizeCountyName(county) {
  return typeof county === 'string' ? county.replace(/\s+county$/i, '').trim() : county;
}

const answerToPetition = createAnswerBuilder({
  state: 'CA',
  filerLabel: 'Respondent',
  opposingLabel: 'Petitioner',
  petitionTerm: 'Petition for Dissolution of Marriage',
  answerTitle: 'RESPONSE TO PETITION FOR DISSOLUTION OF MARRIAGE',
  answerWithCounterTitle:
    'RESPONSE TO PETITION FOR DISSOLUTION OF MARRIAGE (AFFIRMATIVE RELIEF REQUESTED)',
  // California uses the Response itself to request affirmative relief —
  // there is no separate counterclaim. We keep the interior heading to
  // signal the affirmative-relief section but do not call it a counterclaim.
  counterTitle: 'AFFIRMATIVE RELIEF REQUESTED BY RESPONDENT',
  noFaultGroundsRecital:
    'Irreconcilable differences have caused the irremediable breakdown of the marriage. ' +
    '(Cal. Fam. Code §§ 2310(a), 2311.)',
  header(data) {
    const county = normalizeCountyName(String(data.county || '').trim()) || BLANK_SHORT;
    return `SUPERIOR COURT OF CALIFORNIA, COUNTY OF ${county.toUpperCase()}`;
  },
  residencyClause() {
    return (
      'A party to this proceeding has been a resident of California for at least six months and of ' +
      'the county of filing for at least three months immediately preceding this request for ' +
      'affirmative relief. (Cal. Fam. Code § 2320.)'
    );
  },
  certificateOfService(data) {
    // California uses Proof of Service — POS-030 (mail) or POS-040 (personal).
    return (
      'PROOF OF SERVICE (to be completed on Judicial Council form POS-030 or POS-040): ' +
      `served on ${BLANK_SHORT} (date), by ${BLANK_SHORT} (method), on Petitioner or ` +
      "Petitioner's attorney of record."
    );
  },
  verification: {
    unsworn: CALIFORNIA_UNSWORN,
    notaryHeader: ['STATE OF CALIFORNIA', `COUNTY OF ${BLANK_SHORT}`],
  },
});

module.exports = { answerToPetition };
