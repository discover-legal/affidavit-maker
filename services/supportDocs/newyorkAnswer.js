// services/supportDocs/newyorkAnswer.js
// New York Verified Answer to Verified Complaint for Divorce.
//
// Substantive reference: NY CPLR § 3018 (denials and affirmative defenses),
// CPLR § 3020 (verification), CPLR § 320 (appearance and time to answer),
// and NY DRL § 170 et seq. (grounds and procedure). NY uses
// Plaintiff/Defendant, not Petitioner/Respondent.

'use strict';

const { createAnswerBuilder, BLANK_SHORT } = require('./BaseAnswerTemplate');

const NEW_YORK_VERIFICATION =
  'The undersigned affirms under penalty of perjury that the foregoing is true, ' +
  'except as to matters therein stated to be alleged on information and belief, ' +
  'and as to those matters the undersigned believes it to be true. (NY CPLR §§ 3020, 2106.)';

function normalizeCountyName(county) {
  return typeof county === 'string' ? county.replace(/\s+county$/i, '').trim() : county;
}

const answerToPetition = createAnswerBuilder({
  state: 'NY',
  filerLabel: 'Defendant',
  opposingLabel: 'Plaintiff',
  petitionTerm: 'Verified Complaint',
  answerTitle: 'VERIFIED ANSWER',
  answerWithCounterTitle: 'VERIFIED ANSWER AND COUNTERCLAIM FOR DIVORCE',
  counterTitle: 'COUNTERCLAIM FOR DIVORCE',
  noFaultGroundsRecital:
    'The relationship between Plaintiff and Defendant has broken down irretrievably ' +
    'for a period of at least six months. (NY DRL § 170(7).)',
  header(data) {
    const county = normalizeCountyName(String(data.county || '').trim()) || BLANK_SHORT;
    return `SUPREME COURT OF THE STATE OF NEW YORK\nCOUNTY OF ${county.toUpperCase()}`;
  },
  residencyClause() {
    return (
      'The residency requirements of NY DRL § 230 are satisfied because a party has ' +
      'resided in the State of New York for the required period immediately preceding ' +
      'the commencement of this action.'
    );
  },
  verification: {
    unsworn: NEW_YORK_VERIFICATION,
    notaryHeader: ['STATE OF NEW YORK', `COUNTY OF ${BLANK_SHORT}`],
  },
});

module.exports = { answerToPetition };
