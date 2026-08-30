// services/supportDocs/ontarioAnswer.js
// Ontario Answer to Application for Divorce.
//
// Substantive reference: Family Law Rules, O. Reg. 114/99, Form 10 (Answer).
// Ontario parties are Applicant / Respondent (see
// templates/states/ontario/DivorcePetitionTemplate.js). Divorce ground:
// Divorce Act, RSC 1985, c. 3 (2nd Supp.), s. 8.

'use strict';

const { createAnswerBuilder, BLANK_SHORT } = require('./BaseAnswerTemplate');

const ONTARIO_AFFIRMATION =
  'I affirm that the information set out above is true, to the best of my ' +
  'knowledge and belief. (Family Law Rules, O. Reg. 114/99, Rule 14.)';

const answerToPetition = createAnswerBuilder({
  state: 'ON',
  filerLabel: 'Respondent',
  opposingLabel: 'Applicant',
  petitionTerm: 'Application',
  answerTitle: 'ANSWER (Form 10)',
  answerWithCounterTitle: 'ANSWER AND CLAIM (Form 10)',
  counterTitle: 'RESPONDENT’S CLAIM',
  noFaultGroundsRecital:
    'The Applicant and Respondent have lived separate and apart for at least one year ' +
    'immediately preceding the determination of the divorce proceeding. ' +
    '(Divorce Act, s. 8(2)(a).)',
  header(data) {
    const location = String(data.county || data.courtLocation || '').trim() || BLANK_SHORT;
    const fileNo = String(data.caseNumber || '').trim() || BLANK_SHORT;
    return (
      `ONTARIO SUPERIOR COURT OF JUSTICE — ${location.toUpperCase()}\n` +
      `Court File No.: ${fileNo}`
    );
  },
  residencyClause() {
    return (
      'Either the Applicant or the Respondent has been habitually resident in the Province of ' +
      'Ontario for at least one year immediately preceding the commencement of this proceeding. ' +
      '(Divorce Act, s. 3(1).)'
    );
  },
  certificateOfService(data) {
    return (
      'AFFIDAVIT OF SERVICE (Form 6B): the Respondent will serve this Answer on the Applicant ' +
      'or the Applicant’s lawyer of record in accordance with Rule 6 of the Family Law Rules, ' +
      `on ${BLANK_SHORT} (date), and file proof of service with the court.`
    );
  },
  verification: {
    unsworn: ONTARIO_AFFIRMATION,
    notaryHeader: ['PROVINCE OF ONTARIO', `MUNICIPALITY OF ${BLANK_SHORT}`],
  },
});

module.exports = { answerToPetition };
