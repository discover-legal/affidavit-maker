// services/supportDocs/albertaAnswer.js
// Alberta Statement of Defence to Statement of Claim for Divorce (with
// optional Counterclaim).
//
// Substantive reference: Alberta Rules of Court, Alta. Reg. 124/2010,
// Part 3 (Statement of Defence, Rule 3.30 et seq.; Counterclaim, Rule 3.56).
// Alberta divorce is commenced as a civil action in the Court of King's
// Bench of Alberta; parties are Plaintiff / Defendant (see
// templates/states/alberta/DivorcePetitionTemplate.js).

'use strict';

const { createAnswerBuilder, BLANK_SHORT } = require('./BaseAnswerTemplate');

const ALBERTA_AFFIRMATION =
  'I affirm that the facts stated in this Statement of Defence are true to the best of ' +
  'my knowledge, information, and belief. (Alberta Rules of Court, Rule 13.18.)';

const answerToPetition = createAnswerBuilder({
  state: 'AB',
  filerLabel: 'Defendant',
  opposingLabel: 'Plaintiff',
  petitionTerm: 'Statement of Claim for Divorce',
  answerTitle: 'STATEMENT OF DEFENCE',
  answerWithCounterTitle: 'STATEMENT OF DEFENCE AND COUNTERCLAIM',
  counterTitle: 'COUNTERCLAIM FOR DIVORCE',
  noFaultGroundsRecital:
    'The Plaintiff and Defendant have lived separate and apart for at least one year ' +
    'immediately preceding the determination of the divorce proceeding. ' +
    '(Divorce Act, RSC 1985, c. 3 (2nd Supp.), s. 8(2)(a).)',
  header(data) {
    const centre = String(data.county || data.judicialCentre || '').trim() || BLANK_SHORT;
    const actionNumber = String(data.caseNumber || '').trim() || BLANK_SHORT;
    return (
      `IN THE COURT OF KING'S BENCH OF ALBERTA\n` +
      `JUDICIAL CENTRE OF ${centre.toUpperCase()}\n` +
      `Action No.: ${actionNumber}`
    );
  },
  residencyClause() {
    return (
      'Either the Plaintiff or the Defendant has been habitually resident in Alberta for at ' +
      'least one year immediately preceding the commencement of this proceeding. ' +
      '(Divorce Act, s. 3(1).)'
    );
  },
  certificateOfService(data) {
    return (
      'AFFIDAVIT OF SERVICE: the Defendant will serve this Statement of Defence on the ' +
      "Plaintiff or the Plaintiff's lawyer of record in accordance with Part 11 of the " +
      `Alberta Rules of Court on ${BLANK_SHORT} (date), and file proof of service.`
    );
  },
  verification: {
    unsworn: ALBERTA_AFFIRMATION,
    notaryHeader: ['PROVINCE OF ALBERTA', `JUDICIAL CENTRE OF ${BLANK_SHORT}`],
  },
});

module.exports = { answerToPetition };
