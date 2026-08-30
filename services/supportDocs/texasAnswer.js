// services/supportDocs/texasAnswer.js
// Texas Respondent's Original Answer to Original Petition for Divorce.
//
// Substantive reference: Tex. R. Civ. P. 92 (general denial) and Tex. R.
// Civ. P. 15/16 & 97 (counter-petitions / counterclaims). Texas practice
// uses a bare general denial as the standard responsive pleading; specific
// admissions or affirmative defenses are appended when the respondent has
// them. The counter-petition invokes the residency requirements of
// Tex. Fam. Code § 6.301.

'use strict';

const { createAnswerBuilder, BLANK_SHORT } = require('./BaseAnswerTemplate');

const TEXAS_UNSWORN =
  'I declare under penalty of perjury that the foregoing is true and correct. ' +
  '(Tex. Civ. Prac. & Rem. Code § 132.001.)';

function normalizeCountyName(county) {
  return typeof county === 'string' ? county.replace(/\s+county$/i, '').trim() : county;
}

const answerToPetition = createAnswerBuilder({
  state: 'TX',
  filerLabel: 'Respondent',
  opposingLabel: 'Petitioner',
  petitionTerm: 'Original Petition for Divorce',
  answerTitle: "RESPONDENT'S ORIGINAL ANSWER",
  answerWithCounterTitle:
    "RESPONDENT'S ORIGINAL ANSWER AND COUNTERPETITION FOR DIVORCE",
  counterTitle: 'COUNTERPETITION FOR DIVORCE',
  counterPetitionForm: 'Tex. R. Civ. P. 97 (counterpetition, filed with the Answer)',
  counterPetitionExamples: [
    'change of name (Tex. Fam. Code § 6.706)',
    "attorney's fees and costs (Tex. Fam. Code § 106.002)",
    'a just and right division of the community estate (Tex. Fam. Code § 7.001)',
    'spousal maintenance (Tex. Fam. Code § 8.051)',
    'conservatorship and possession of children (Tex. Fam. Code § 153.002)',
  ],
  noFaultGroundsRecital:
    'The marriage has become insupportable because of discord or conflict of ' +
    'personalities between Petitioner and Respondent that destroys the legitimate ' +
    'ends of the marriage relationship and prevents any reasonable expectation of ' +
    'reconciliation. (Tex. Fam. Code § 6.001.)',
  header(data) {
    const county = normalizeCountyName(String(data.county || '').trim()) || BLANK_SHORT;
    const caseNumber = String(data.caseNumber || '').trim() || BLANK_SHORT;
    return (
      `CAUSE NO. ${caseNumber}\n` +
      `IN THE DISTRICT COURT OF ${county.toUpperCase()} COUNTY, TEXAS\n` +
      `___ JUDICIAL DISTRICT`
    );
  },
  // Texas convention: state a general denial first; positions and requests
  // follow. We inject the general-denial recital before the position sentences
  // by overriding `introduction`.
  introduction(data, parties) {
    return (
      `Respondent, ${parties.respondent}, files this Original Answer to the Original Petition ` +
      `for Divorce filed by ${parties.petitioner} and, pursuant to Tex. R. Civ. P. 92, generally ` +
      'denies each and every allegation contained in the Petition and demands strict proof thereof. ' +
      'Respondent further states as follows:'
    );
  },
  residencyClause() {
    return (
      'Respondent has been a domiciliary of Texas for the preceding six-month period and a resident ' +
      'of the county of filing for the preceding 90-day period. (Tex. Fam. Code § 6.301.)'
    );
  },
  verification: {
    unsworn: TEXAS_UNSWORN,
    notaryHeader: ['STATE OF TEXAS', `COUNTY OF ${BLANK_SHORT}`],
  },
});

module.exports = { answerToPetition };
