import type { StateProcedure } from './index';

/**
 * Utah divorce procedure metadata for self-represented litigants.
 *
 * INFORMATION about procedure only — never advice. Statutory citations
 * are kept in these comments so legal review can audit the source of each
 * field; the user-facing text stays plain language and hedged
 * ("generally", "may", "the court decides").
 */
export const UT_PROCEDURE: StateProcedure = {
  stateCode: 'UT',
  stateName: 'Utah',

  // Utah Code § 30-3-1: the petitioner or respondent must be an actual and
  // bona fide resident of the state AND of the county where the action is
  // brought for the 3 months immediately before filing.
  residency: {
    months: 3,
    text:
      'Generally, you or your spouse must have been a genuine resident of Utah — and of the county where you file — for at least 3 months right before filing.',
  },

  // Utah Code § 30-3-18: a decree may not be entered until 30 days after
  // filing; the court may waive the period for extraordinary circumstances.
  waitingPeriodDays: 30,
  waitingPeriodText:
    'Utah generally has a 30-day waiting period: a court may not sign the final decree until 30 days after the petition is filed. The court may waive this for extraordinary circumstances.',
  waitingWaivable: true,

  // Utah R. Civ. P. 12(a): an answer is generally due 21 days after service
  // when served inside Utah, and 30 days when served outside Utah.
  answerDeadlineDays: { inState: 21, outOfState: 30 },

  // Utah Code § 30-3-11.3 (divorce orientation) and § 30-3-11.4 (divorce
  // education course): required for parties with minor children before the
  // decree may be entered, unless the court excuses attendance.
  educationRequirement:
    'Parents of minor children generally must complete two short courses — the divorce orientation and the divorce education course — before the court will sign the decree. The court may excuse attendance in some situations.',

  // Utah Code § 30-3-39 (mediation in divorce actions): when an answer is
  // filed, the parties must participate in good faith in at least one
  // mediation session before trial. Either party may ask the court to excuse
  // mediation for good cause, and courts routinely do where there are
  // domestic-violence or other safety concerns.
  // LEGAL REVIEW: Utah's 2024–25 Title 81 recodification may have moved this
  // provision (possibly to the § 81-4-403 area). Both cites kept here until
  // counsel confirms the current section number.
  mediation: {
    required: true,
    text:
      'Once an answer has been filed in a Utah divorce, both sides generally must attempt at least one mediation session in good faith before the case can go to trial. Either side may ask the court to excuse mediation for good cause — courts take safety and domestic-violence concerns seriously here. Court-qualified mediators are available, and reduced-fee mediation programs exist for people who qualify.',
  },

  // Utah R. Civ. P. 4: who may serve process and how; proof of service must
  // be filed with the court. Acceptance of service substitutes for formal
  // service when the respondent signs.
  serviceMethods: [
    {
      key: 'acceptance',
      title: 'Acceptance of Service',
      steps: [
        'Give or send the papers to your spouse along with an Acceptance of Service form.',
        'Your spouse signs the form confirming they received the papers — no process server is needed.',
        'File the signed Acceptance of Service with the court.',
      ],
    },
    {
      key: 'personal',
      title: 'Personal service',
      steps: [
        'Have a sheriff, constable, private process server, or any adult who is not a party to the case hand-deliver the papers to your spouse.',
        'The person who served the papers completes a proof of service.',
        'File the proof of service with the court.',
      ],
    },
  ],

  // Utah R. Civ. P. 55 (default) as applied in divorce practice: when no
  // answer is filed by the Rule 12(a) deadline, the petitioner may seek
  // default; uncontested Utah divorces are generally decided on the papers.
  defaultJudgment: {
    eligibleAfterText:
      'If your spouse does not file an answer by the deadline, you may ask the court to enter their default.',
    steps: [
      'File the default paperwork the court requires.',
      'Submit your final documents with a declaration in support — uncontested Utah divorces are generally finished on the papers, without a hearing.',
      'The court decides whether to enter the default and sign the decree.',
    ],
  },

  // Utah Code § 78B-18a (Uniform Unsworn Declarations Act): an unsworn
  // declaration under criminal penalty may substitute for a notarized
  // affidavit in most court filings.
  unswornDeclaration: {
    allowed: true,
    statute: 'Utah Code 78B-18a',
    wording:
      'I declare under criminal penalty of the State of Utah that the foregoing is true and correct.',
  },

  // Utah R. Civ. P. 26.1: parties in domestic relations actions must serve
  // a Financial Declaration (income, expenses, assets, debts) with
  // supporting attachments.
  financialDisclosure: {
    required: true,
    rule: 'Utah R. Civ. P. 26.1',
    text:
      'In a Utah divorce, each side generally must complete and exchange a Financial Declaration — a court form listing income, expenses, assets, and debts, with supporting documents attached.',
  },

  // Fee amount is set by the courts and changes periodically; fee waiver
  // (impecuniosity) is available under Utah Code § 78A-2-302.
  filing: {
    feeText:
      'The divorce filing fee is set by the court (roughly $325–$350); fee waivers are available.',
    whereText:
      'File in the district court in the county where you or your spouse lives.',
    copiesText: 'Bring the original plus two copies; the clerk keeps the original.',
  },
};
