import type { StateProcedure } from './index';

/**
 * Ontario divorce procedure metadata for self-represented litigants.
 *
 * INFORMATION about procedure only — never advice. Statutory citations
 * are kept in these comments so legal review can audit the source of each
 * field; the user-facing text stays plain language and hedged
 * ("generally", "may", "the court decides").
 *
 * Ontario uses federal Divorce-Act divorce (all provinces) plus the
 * Ontario Family Law Rules, O. Reg. 114/99. Terminology differs from US
 * states: Applicant / Respondent (not Petitioner / Respondent), Answer
 * (not "answer to petition"), Divorce Order (not decree), and the venue
 * is a court location rather than a county — but the StateProcedure
 * shape is jurisdiction-neutral enough to reuse.
 */
export const ON_PROCEDURE: StateProcedure = {
  stateCode: 'ON',
  stateName: 'Ontario',

  // Divorce Act, RSC 1985, c. 3, s.3(1): the applicant or the respondent
  // must have been ordinarily resident in Ontario for the year immediately
  // before the divorce application. 12 months → 12 in the months field;
  // the plain-language text explains it as a one-year period.
  residency: {
    months: 12,
    text:
      'Generally, either you or your spouse must have been ordinarily resident in Ontario for at least one year immediately before the divorce application is started.',
  },

  // Divorce Act, s.12(1): a Divorce Order takes effect on the 31st day
  // after it is made, unless the court varies the date or both spouses
  // waive the appeal period under s.12(2). Modelled here as a 31-day
  // effective-date "waiting period" so the What's-next panel can compute
  // when the divorce becomes final. Waivable per s.12(2).
  waitingPeriodDays: 31,
  waitingPeriodText:
    'A Divorce Order granted in Ontario generally takes effect on the 31st day after it is made — an appeal period built into the Divorce Act (s.12(1)). The parties may waive that period by written agreement so the divorce takes effect immediately (s.12(2)).',
  waitingWaivable: true,

  // Ontario Family Law Rules, O. Reg. 114/99, R. 10: an Answer (Form 10)
  // is generally due 30 days after service inside Canada or the United
  // States, and 60 days when the respondent was served outside Canada and
  // the U.S. For service by newspaper publication under R. 6(19), the
  // clock runs from the date of the LAST publication.
  //
  // The self-rep-litigant guidance published by the Ontario courts
  // (Family Law Rules Practice Direction) treats service in Ontario as
  // "in Ontario" for the 30-day figure — service anywhere else in Canada
  // or in the U.S. is treated the same 30 days by R. 10(1). This field's
  // shape only supports two buckets; the plain-language text calls out
  // the newspaper-publication case explicitly so users served that way
  // aren't misled by the numeric fields alone.
  answerDeadlineDays: { inState: 30, outOfState: 60 },

  // Ontario has no province-mandated pre-decree parenting-education
  // course as a condition of granting a divorce (unlike Utah). Some
  // court locations offer or strongly encourage a Mandatory Information
  // Program for family-law matters, but it is not a divorce-decree
  // prerequisite, so we leave the field null.
  educationRequirement: null,

  // Ontario Family Law Rules R. 17: parties in most family-law matters
  // must attend a case conference before a contested motion or trial;
  // R. 8.1 (Mandatory Information Program) applies to many family cases
  // at the Superior Court of Justice — Family Court. There is no strict
  // "attempt mediation before trial" requirement equivalent to Utah
  // Code § 81-4-403, so this field stays null and the What's-next panel
  // does not surface a mediation step for Ontario cases.
  mediation: null,

  // Ontario Family Law Rules R. 6: how documents are served. R. 6(2)
  // permits special service (personal service is the archetype for
  // originating documents like Form 8); R. 6(9) allows service by an
  // acknowledgment-of-service form the respondent signs and returns;
  // R. 6(15)-(19) authorise substituted service and, in narrow
  // circumstances, service by newspaper publication.
  serviceMethods: [
    {
      key: 'acceptance',
      title: 'Acknowledgment of service',
      steps: [
        'Give or send the Application (Form 8) to your spouse along with an Acknowledgment of Service (Form 6).',
        'Your spouse signs the Form 6 confirming they received the Application — no process server needed.',
        'File the signed Acknowledgment of Service with the court.',
      ],
    },
    {
      key: 'personal',
      title: 'Special service (personal service)',
      steps: [
        'Have any adult who is not a party to the case hand-deliver the Application (Form 8) to your spouse.',
        'The person who served the papers completes an Affidavit of Service (Form 6B).',
        'File the Affidavit of Service with the court.',
      ],
    },
    {
      key: 'publication',
      title: 'Substituted service or service by publication (R. 6(15)-(19))',
      steps: [
        'When your spouse cannot be located after reasonable efforts, ask the court for an order for substituted service or service by newspaper publication.',
        'If publication is ordered, publish notice as the court directs; the response clock runs from the date of the last publication.',
        'File proof of publication (or of the substituted service the court ordered) with the court.',
      ],
    },
  ],

  // Family Law Rules R. 1(8) + R. 10: when a served respondent files no
  // Answer within the response period, the case proceeds as uncontested
  // and the applicant may bring it forward for divorce on the papers
  // (Affidavit for Divorce, Form 36).
  defaultJudgment: {
    eligibleAfterText:
      'If your spouse does not file an Answer by the deadline, the case may proceed as uncontested.',
    steps: [
      'File the paperwork the court requires to move an uncontested case forward (typically an Affidavit for Divorce, Form 36, together with the draft Divorce Order in Form 25A).',
      'Uncontested Ontario divorces are generally decided on the papers, without a hearing.',
      'The court decides whether to grant the Divorce Order.',
    ],
  },

  // Ontario Evidence Act, RSO 1990, c. E.23, s.45: affidavits sworn
  // before a Commissioner for Taking Oaths. Ontario does not have an
  // unsworn-declaration statute equivalent to Utah's, so this field
  // records that the declaration option is unavailable and the sworn
  // affidavit path is what applies.
  unswornDeclaration: {
    allowed: false,
    statute: 'Evidence Act, RSO 1990, c. E.23, s.45',
    wording:
      'SWORN before me at the [City/Town] of ___, in the Province of Ontario, this ___ day of ___, [Year]. — Commissioner for Taking Oaths in and for the Province of Ontario.',
  },

  // Family Law Rules R. 13: parties in most family-law cases must serve
  // and file a Financial Statement (Form 13 for support-only claims,
  // Form 13.1 for support-plus-property).
  financialDisclosure: {
    required: true,
    rule: 'Family Law Rules R. 13',
    text:
      'In most Ontario family-law cases each party must complete, exchange, and file a Financial Statement (Form 13 for support-only claims, Form 13.1 when property claims are included), attaching the supporting documents the rule requires.',
  },

  // Ontario court fees are set by regulation and change periodically.
  // A fee waiver is available through Form 26B (Family Law Rules).
  filing: {
    feeText:
      'The Application filing fee is set by the court (roughly CAD $224), plus additional fees at later steps (setting the case down for divorce, and a Certificate of Divorce). Fee waivers are available (Form 26B).',
    whereText:
      'File at the Superior Court of Justice (Family Court branch where one exists) in the court location that serves where you or your spouse lives.',
    copiesText:
      'File the original plus the copies the court location requires — the clerk keeps the original; bring at least two additional copies.',
  },
};
