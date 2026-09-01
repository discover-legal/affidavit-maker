// services/supportDocs/georgiaAnswer.js
// Georgia Answer to Complaint for Divorce.
//
// Substantive reference: O.C.G.A. § 9-11-12 (answer to complaint) and
// O.C.G.A. § 9-11-13 (counterclaims). Filed in the Superior Court of the
// county where the defendant resides (O.C.G.A. § 19-5-2).

'use strict';

const { createAnswerBuilder, BLANK_SHORT } = require('./BaseAnswerTemplate');

const GEORGIA_UNSWORN =
  'I declare under penalty of perjury under the laws of the State of Georgia ' +
  'that the foregoing is true and correct. (O.C.G.A. § 9-10-113.)';

function normalizeCountyName(county) {
  return typeof county === 'string' ? county.replace(/\s+county$/i, '').trim() : county;
}

const answerToPetition = createAnswerBuilder({
  state: 'GA',
  filerLabel: 'Defendant',
  opposingLabel: 'Plaintiff',
  petitionTerm: 'Complaint for Divorce',
  answerTitle: 'ANSWER TO COMPLAINT FOR DIVORCE',
  answerWithCounterTitle: 'ANSWER AND COUNTERCLAIM FOR DIVORCE',
  counterTitle: 'COUNTERCLAIM FOR DIVORCE',
  counterPetitionForm: 'O.C.G.A. § 9-11-13 (counterclaim, filed with the Answer)',
  counterPetitionExamples: [
    'restoration of a former name (O.C.G.A. § 19-5-16)',
    "attorney's fees and expenses of litigation (O.C.G.A. § 19-6-2)",
    'equitable division of marital property',
    'alimony (O.C.G.A. § 19-6-1)',
    'a permanent parenting plan (O.C.G.A. § 19-9-1)',
  ],
  noFaultGroundsRecital:
    'The marriage between the parties is irretrievably broken. ' +
    '(O.C.G.A. § 19-5-3(13).)',
  header(data) {
    const county = normalizeCountyName(String(data.county || '').trim()) || BLANK_SHORT;
    return `IN THE SUPERIOR COURT OF ${county.toUpperCase()} COUNTY\nSTATE OF GEORGIA`;
  },
  residencyClause(data) {
    const county = normalizeCountyName(String(data.county || '').trim()) || BLANK_SHORT;
    return (
      `Defendant has been a bona fide resident of the State of Georgia for at least six months ` +
      `immediately preceding the filing of this Counterclaim, and this Court has jurisdiction ` +
      `of the parties and the subject matter. (O.C.G.A. § 19-5-2.) Venue is proper in ${county} County.`
    );
  },
  verification: {
    unsworn: GEORGIA_UNSWORN,
    notaryHeader: ['STATE OF GEORGIA', `COUNTY OF ${BLANK_SHORT}`],
  },
});

module.exports = { answerToPetition };
