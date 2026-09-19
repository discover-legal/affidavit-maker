/**
 * The divorce interview for one jurisdiction.
 *
 * Phases and their legal substance come from docs/spec/01 §5. Guidance is
 * plain legal substance — what to collect and why — and never turn
 * mechanics; those live in the engine's instructions. Jurisdiction-specific
 * rules (residency, grounds, separation, alternative pleading, waiting
 * period, vocabulary) are read from the JurisdictionProfile by `overlay`.
 */

import type { JsonObject } from '../../intelligence/types';
import type { JurisdictionProfile } from '../../jurisdictions/types';
import type { FieldSpec, MatterDefinition, PhaseSpec } from '../types';

export function getDivorceDefinition(profile: JurisdictionProfile): MatterDefinition {
  return {
    code: 'divorce',
    practiceArea: 'family',
    displayName: 'Divorce',
    familyProfile: true,
    roles: true,
    fields: divorceFields(profile),
    phases: divorcePhases(profile),
    overlay: (jurisdiction) => overlayFor(jurisdiction),
  };
}

// ─── Fields ─────────────────────────────────────────────────────────────────

function divorceFields(profile: JurisdictionProfile): FieldSpec[] {
  const grounds = profile.divorce?.grounds.map((g) => g.code) ?? [];
  const countyLabel = profile.lexicon.countyLabel;
  const string = (description?: string): JsonObject => (description ? { type: 'string', description } : { type: 'string' });
  const boolean = (description?: string): JsonObject => (description ? { type: 'boolean', description } : { type: 'boolean' });
  const number = (description?: string): JsonObject => (description ? { type: 'number', description } : { type: 'number' });
  const isoDate = (what: string): JsonObject => ({ type: 'string', description: `${what}, as an ISO date YYYY-MM-DD or partial YYYY-MM / YYYY` });

  return [
    // Role and parties
    { key: 'who_filed', target: 'whoFiled', schema: { type: 'string', enum: ['me', 'my_spouse', 'unknown'], description: 'Which spouse filed or will file the case.' } },
    { key: 'served_on_user', target: 'servedOnUser', schema: { type: 'string', enum: ['yes', 'no', 'unknown'], description: 'Whether the user has been served with the other spouse’s filing.' } },
    { key: 'petitioner_first_name', target: 'petitionerFirstName', schema: string('The user’s own legal first name.'), binds: 'self.firstName' },
    { key: 'petitioner_last_name', target: 'petitionerLastName', schema: string('The user’s own legal last name.'), binds: 'self.lastName' },
    { key: 'respondent_first_name', target: 'respondentFirstName', schema: string('The spouse’s legal first name (never a nickname).'), binds: 'other.firstName' },
    { key: 'respondent_last_name', target: 'respondentLastName', schema: string('The spouse’s legal last name.'), binds: 'other.lastName' },
    { key: 'county', target: 'county', schema: string(`The ${countyLabel} where the case is or will be filed.`), binds: 'county' },
    { key: 'case_number', target: 'caseNumber', schema: string('The court’s file number of an existing case, exactly as written.'), binds: 'caseNumber' },
    // Residency
    { key: 'residency_state_months', target: 'residencyStateMonths', schema: number(`Months the qualifying spouse has lived in the ${profile.lexicon.regionLabel.toLowerCase()}.`) },
    { key: 'residency_county_days', target: 'residencyCountyDays', schema: number(`Days the qualifying spouse has lived in the ${countyLabel}.`) },
    { key: 'residency_basis', target: 'residencyBasis', schema: string('The statutory residency basis relied on, where the jurisdiction lists alternatives.') },
    // Marriage and grounds
    { key: 'marriage_date', target: 'marriageDate', schema: isoDate('Date of marriage') },
    { key: 'marriage_place', target: 'marriagePlace', schema: string('City and region/state/country where the marriage took place.') },
    { key: 'separation_date', target: 'separationDate', schema: isoDate('Date the spouses began living separate and apart') },
    { key: 'grounds', target: 'groundsForDivorce', schema: { type: 'string', enum: grounds, description: 'The ground for divorce, as one of the jurisdiction’s codes. Omit when none fits.' } },
    // Children
    { key: 'has_minor_children', target: 'hasMinorChildren', schema: boolean('Whether there are children of the marriage under the age of majority.') },
    { key: 'number_of_children', target: 'numberOfChildren', schema: { type: 'integer', description: 'Number of children of the marriage, including adult children.' } },
    { key: 'custody_arrangement', target: 'custodyArrangement', schema: string('The current or proposed parenting arrangement, in the user’s words.') },
    { key: 'child_support_requested', target: 'childSupportRequested', schema: boolean('Whether child support is sought.') },
    // Property and debts
    { key: 'has_property', target: 'hasProperty', schema: boolean('Whether the spouses own property to divide.') },
    { key: 'has_debts', target: 'hasDebts', schema: boolean('Whether the spouses owe debts to divide.') },
    { key: 'property_description', target: 'propertyDescription', schema: string('The main property items, with the location of any real estate.') },
    { key: 'debts_description', target: 'debtsDescription', schema: string('The main debts.') },
    { key: 'property_division_agreed', target: 'propertyDivisionAgreed', schema: boolean('Whether the spouses have agreed how to divide property and debts.') },
    { key: 'prenup_signed', target: 'prenupSigned', schema: boolean('Whether a marriage contract or prenuptial agreement was signed.') },
    // Support
    { key: 'spousal_support_requested', target: 'spousalSupportRequested', schema: boolean('Whether the user asks for spousal support.') },
    { key: 'spousal_support_agreed', target: 'spousalSupportAgreed', schema: boolean('Whether the spouses have agreed on spousal support.') },
    { key: 'spousal_support_amount', target: 'spousalSupportAmount', schema: number('Monthly spousal support amount sought or agreed.') },
    { key: 'monthly_income', target: 'monthlyIncome', schema: number('The user’s own monthly income.') },
    { key: 'spouse_monthly_income', target: 'spouseMonthlyIncome', schema: number('The spouse’s monthly income, as far as the user knows.') },
    // Service
    { key: 'service_method', target: 'serviceMethod', schema: string('How the other spouse was or will be served.') },
    { key: 'service_date', target: 'serviceDate', schema: isoDate('Date the user was served, when the spouse filed') },
    { key: 'respondent_address', target: 'respondentAddress', schema: string('The spouse’s current residential address, only when the user can swear to it.') },
    { key: 'respondent_address_unknown', target: 'respondentAddressUnknown', schema: boolean('True only when the user says they do not know where the spouse lives.'), binds: 'other.whereaboutsUnknown' },
    { key: 'respondent_suspected_location', target: 'respondentSuspectedLocation', schema: string('Where the user thinks the spouse may be, hedges removed; a non-sworn guess.'), binds: 'other.suspectedLocation' },
    // Fee waiver
    { key: 'indigency_requested', target: 'indigencyRequested', schema: boolean('Whether the user wants to apply to waive court filing fees.') },
    { key: 'monthly_expenses', target: 'monthlyExpenses', schema: number('The user’s monthly expenses, for a fee waiver.') },
    { key: 'dependents_count', target: 'dependentsCount', schema: { type: 'integer', description: 'Number of dependants the user supports, for a fee waiver.' } },
    // Military
    { key: 'respondent_military_status', target: 'respondentMilitaryStatus', schema: { type: 'string', enum: ['active_duty', 'not_active_duty'], description: 'Whether the spouse is in active military service.' } },
    { key: 'military_search_planned', target: 'militarySearchPlanned', schema: { type: 'string', enum: ['completed', 'before_filing'], description: 'Whether a military-status (DMDC) search has been done or will be done before filing.' } },
    // Name and review
    { key: 'name_restoration_requested', target: 'nameRestorationRequested', schema: boolean('Whether the user asks to resume a former name.') },
    { key: 'former_name', target: 'formerName', schema: string('The former name to be restored.') },
    { key: 'user_confirmed_review', target: 'userConfirmedReview', schema: boolean('True only when the user confirms the summary is correct and complete.') },
  ];
}

// ─── Phases ─────────────────────────────────────────────────────────────────

function divorcePhases(profile: JurisdictionProfile): PhaseSpec[] {
  const usOnly = profile.country === 'US';
  const phases: PhaseSpec[] = [
    {
      id: 'INTAKE',
      displayName: 'Getting Started',
      guidance:
        'Collect the user’s own full legal name first, then the spouse’s full legal name (a nickname is recorded only as a fact and the legal name is still needed). ' +
        'Establish which spouse filed or will file: that decides who the petitioner and the respondent are, since the caption describes who filed, not who is speaking. ' +
        'If the spouse filed, collect whether and when the user was served and any court file number. Collect where the case is or will be filed. ' +
        'A request to change or enforce an existing divorce order is still handled here.',
      requiredFields: ['petitionerFirstName', 'petitionerLastName', 'respondentFirstName', 'respondentLastName', 'county'],
      factCategory: 'identity',
    },
    {
      id: 'RESIDENCY',
      displayName: 'Residency',
      guidance:
        'A court may grant a divorce only when the jurisdiction’s residency requirement is met. Collect how long the qualifying spouse has lived in the jurisdiction, in months, and how long in the place of filing where a local rule applies. ' +
        'Residency is never assumed: record the durations the user states, and note when the user is unsure.',
      requiredFields: ['residencyStateMonths'],
      factCategory: 'residence',
    },
    {
      id: 'GROUNDS',
      displayName: 'Marriage & Grounds',
      guidance:
        'Collect the date and place of marriage, the date the spouses began living separate and apart, and the ground for divorce from the jurisdiction’s closed set. ' +
        'A no-fault ground is preferred where one exists. Fault grounds such as adultery, cruelty or abandonment are recorded only when the user raises them, with the supporting facts in the user’s own words; a contested or safety-related situation is a reason to recommend a lawyer once and continue. ' +
        'Record the ground code, never a paraphrase; when the user’s description matches no available ground, ask rather than choose.',
      requiredFields: ['marriageDate', 'groundsForDivorce'],
      factCategory: 'relationship',
    },
    {
      id: 'CHILDREN',
      displayName: 'Children',
      guidance:
        'Ask whether there are children of the marriage, including adult children. For each child collect the name, date of birth or age, and who the child lives with. ' +
        'Adult children only means no parenting or child-support orders are requested. Where a child is a minor, collect the current arrangement, the proposed arrangement, whether child support is sought, and where the child has lived for the past five years (the court needs it to decide parenting matters). ' +
        'A statement that there are no children is dispositive only when the user says so explicitly.',
      requiredFields: ['hasMinorChildren'],
      factCategory: 'children',
      confirmations: ['no_children'],
    },
    {
      id: 'PROPERTY',
      displayName: 'Property & Debts',
      guidance:
        'Collect whether the spouses own property or owe debts, together or separately; the main items (real estate with its location, vehicles, accounts, pensions, businesses); any agreement on how to divide them; and whether a marriage contract or prenuptial agreement exists and when it was signed. ' +
        'A draft may state that there is no property or no debts only when the user explicitly says so. Silence, “nothing much” or not mentioning property is not a finding.',
      requiredFields: ['hasProperty', 'hasDebts'],
      factCategory: 'property',
      confirmations: ['no_property', 'no_debts'],
    },
    {
      id: 'SUPPORT',
      displayName: 'Spousal Support',
      guidance:
        'Ask whether the user seeks spousal support (also called maintenance or alimony), whether the spouses have agreed, and any amount or duration. Note each spouse’s approximate income when support is in issue. ' +
        'Not asking for support is not a waiver. A waiver is recorded only when the user explicitly says they give up the right to claim support; otherwise the draft stays silent on waiver.',
      requiredFields: ['spousalSupportRequested'],
      factCategory: 'support',
      confirmations: ['support_waived'],
    },
    {
      id: 'SERVICE',
      displayName: 'Service',
      guidance:
        'Establish how the other spouse was or will be served and the spouse’s current residential address. When the user does not know where the spouse lives, record that explicitly, with any suspected location kept separate as a non-sworn guess; a sworn address is never inferred from a hedge such as “maybe” or “I think”. ' +
        'When the user is the respondent, collect the date of service and any deadline to respond.',
      requiredFields: [],
      factCategory: 'procedure',
    },
    {
      id: 'INDIGENCY',
      displayName: 'Filing Fees',
      guidance:
        'Ask whether the user wants to apply to waive court filing fees because they cannot afford them. If so, collect monthly income and its sources, monthly expenses, assets and the number of dependants. ' +
        'A user who prefers to pay the fee, or to decide later, is not asked further financial questions.',
      requiredFields: [],
      factCategory: 'finances',
    },
    {
      id: 'MILITARY',
      displayName: 'Military Status',
      guidance:
        'The Servicemembers Civil Relief Act (50 U.S.C. §3931) requires a statement whether the other spouse is in active military service before a default judgment may be entered. Ask whether the spouse is on active duty and how the user knows or will confirm it; a Department of Defense (DMDC) search before filing satisfies this. ' +
        'A statement that the spouse is not in the military is dispositive only when the user says so explicitly.',
      requiredFields: [],
      factCategory: 'procedure',
      confirmations: ['not_military'],
    },
    {
      id: 'REVIEW',
      displayName: 'Review & Confirm',
      guidance:
        'Summarise what has been collected: the parties and who filed, residency, marriage and separation dates, the ground, children, property and debts, support, and service. Point out anything still absent; the draft leaves it blank with a note rather than guessing. ' +
        'Ask the user to confirm the summary is correct and complete. Only an explicit confirmation completes the interview.',
      requiredFields: ['userConfirmedReview'],
      factCategory: 'general',
      confirmations: ['review_confirmed'],
    },
  ];
  // The fee-waiver affidavit and the SCRA military affidavit are US court instruments; Canada omits both phases (spec §5).
  return usOnly ? phases : phases.filter((p) => p.id !== 'INDIGENCY' && p.id !== 'MILITARY');
}

// ─── Overlay ────────────────────────────────────────────────────────────────

/** Jurisdiction rules that change the questions, read from the profile's data. */
function overlayFor(profile: JurisdictionProfile): Partial<Record<string, string>> {
  const { divorce, name, lexicon } = profile;
  if (!divorce) return {};
  const cite = (citation?: string) => (citation ? ` (${citation})` : '');

  const residency = [
    `${name}: ${divorce.residency.text}${cite(divorce.residency.citation)}`,
    divorce.residency.months !== undefined ? `Confirm the qualifying spouse has been resident for at least ${divorce.residency.months} months and record the actual number of months stated.` : '',
    `Collect the ${lexicon.countyLabel} of filing and how long the user has lived there.`,
    divorce.waitingPeriod ? `Waiting period before the divorce can be granted: ${divorce.waitingPeriod.text}${cite(divorce.waitingPeriod.citation)}` : '',
  ];

  const separationRule = divorce.separationMonthsRequired
    ? `The separation ground may be pleaded as satisfied only once the spouses have lived separate and apart for ${divorce.separationMonthsRequired} months; always collect the separation date. ` +
      'If the separation is shorter, do not record that ground: explain that the application can be started now, that the separation period must be complete by the time the divorce is granted, and ask whether adultery or cruelty applies instead.'
    : 'Collect the separation date when the spouses have separated.';

  const grounds = [
    `Grounds available in ${name}, a closed set; record the code only:`,
    ...divorce.grounds.map((g) => `- ${g.code}: ${g.label}${cite(g.citation)}${g.noFault ? ' [no-fault]' : ''}${g.alternative ? `; when pleaded, ${g.alternative} must also be pleaded in the alternative so the case does not fail if proof of fault is thin` : ''}`),
    separationRule,
    `The initiating document is the ${divorce.instrument.petition}; the responding document is the ${divorce.instrument.answer}; the final order is the ${divorce.instrument.decree}.`,
  ];

  // Federal Divorce Act vocabulary applies in every Canadian jurisdiction.
  const children = profile.country === 'CA'
    ? 'Use Divorce Act (2021) vocabulary: parenting time and decision-making responsibility, not custody and access.'
    : undefined;

  return {
    RESIDENCY: residency.filter(Boolean).join(' '),
    GROUNDS: grounds.join('\n'),
    ...(children ? { CHILDREN: children } : {}),
    PROPERTY: `Use the terms “${lexicon.maritalProperty}” and “${lexicon.maritalDebts}”.`,
  };
}
