'use strict';

/**
 * BaseDivorceOrchestrator
 *
 * Shared orchestration engine for all state divorce interview agents.
 * Each state creates one instance:
 *
 *   module.exports = new BaseDivorceOrchestrator({
 *     stateCode:  'CA',
 *     stateName:  'California',
 *     phases:     PHASES,      // from prompts/caDivorce/index.js
 *     phaseOrder: PHASE_ORDER,
 *   });
 *
 * The state-specific prompt files are the ONLY thing that differs between
 * states. All interview mechanics (tool calling, field extraction, phase
 * advancement, fact organization, document selection) live here.
 */

const logger = require('../../utils/logger');
const { DEFAULT_LLM_MODEL } = require('../llmConfig');
const { mergeFacts } = require('./FactOrganizer');
const documentSelectionAgent = require('./DocumentSelectionAgent');
const { mergeChildren, removeChildrenByName, summarizeChildren, hasMinors } = require('../../utils/childrenMerge');
const { mergeLabeledAmounts, totalOf } = require('../../utils/labeledAmounts');
const {
  EXTRACTION_QUALITY,
  FIRST_NAME_DESCRIPTION,
  LAST_NAME_DESCRIPTION,
  FACT_CONTENT_DESCRIPTION,
  PROPERTY_ITEM_DESCRIPTION,
  DEBT_ITEM_DESCRIPTION,
  SUPERSEDED_FACTS_DESCRIPTION,
} = require('./extractionQuality');
const { retireFacts, sanitizeSupersededStatements } = require('./factRetirement');

// v23: canonical statutory-ground name tokens. Mirrors STATUTORY_GROUND_TOKENS
// in lib/api/profile.ts. Used by the companion promoter's isGroundsTag so a
// fact tagged with, e.g., {category:'evidence', subcategory:'cruel_treatment'}
// still qualifies as a grounds fact and gets its grounds_value companion
// backfilled — Amara (GA, cruel treatment) v23 replay.
const STATUTORY_GROUND_TOKENS = [
  'cruel_treatment',
  'cruelty',
  'adultery',
  'abandonment',
  'desertion',
  'insupportability',
  'irretrievable_breakdown',
  'irreconcilable_differences',
  'felony',
  'conviction',
  'imprisonment',
  'mental_incapacity',
  'mental_confinement',
  'separation_agreement',
  'separation_judgment',
  'breakdown_of_marriage',
];

// ─── Shared tool definition ───────────────────────────────────────────────────
// One flexible tool covers all phases across all states.
// Phase-specific system prompts tell the LLM which subset of fields to fill.

function buildPhaseTool(stateCode, { nameMissing = false } = {}) {
  // When the user's own full legal name is still missing, the `response`
  // description carries a HARD constraint. Prompt-and-schema signal (not a
  // deterministic string check) — the model still decides the wording, but
  // the schema-level demand markedly raises the odds Luna/GPT obey it,
  // because tool-parameter descriptions are the surface these models attend
  // to most reliably.
  const responseDescription = nameMissing
    ? 'Your conversational response to the user. Warm, professional, concise. HARD REQUIREMENT for THIS turn: the user\'s own full legal name is NOT yet captured, so this response MUST end with a direct request for the user\'s own full legal name (e.g. "What is your full legal name?"). Do NOT ask any other question this turn. Briefly acknowledge whatever else the user just said in one short sentence, then ask for their full legal name. This overrides the current phase\'s COLLECT list.'
    : 'Your conversational response to the user. Warm, professional, concise.';
  return {
    type: 'function',
    function: {
      name: 'process_phase_data',
      description: `Extract information collected during this ${stateCode} divorce interview phase and provide a conversational response to the user.`,
      parameters: {
        type: 'object',
        // respondent_address_unknown is required so the LLM is forced to emit
        // it every turn (default false) rather than sparsely omitting it when
        // the user narrates hedged whereabouts — Mari v9-D replay: the model
        // skipped the field despite NEVER-OMIT prose, and the TX petition
        // template read a nullish flag and dropped the alt-service caveat.
        // Schema-level required is the enforcement that prose alone was not.
        // v14-C: promote respondent_suspected_location to required alongside
        // respondent_address_unknown. Same lesson as the v9-D flag promotion:
        // schema-level required is the only enforcement Luna reliably obeys
        // — prose-only "NEVER OMIT" rules keep getting sparsely omitted, and
        // the downstream TX alt-service caveat ("Petitioner has heard, but
        // cannot swear") depends on this field. Description tells the model
        // to emit "" when the topic is not in question this turn (safe
        // default; never overwrites a real value in profile-merge).
        required: ['response', 'phase_complete', 'respondent_address_unknown', 'respondent_suspected_location'],
        properties: {
          // ── Response shown to the user ──
          response: {
            type: 'string',
            description: responseDescription,
          },
          phase_complete: {
            type: 'boolean',
            description: 'Set to true ONLY when all required fields for the current phase have been collected and confirmed.'
          },

          // ── INTAKE ──
          petitioner_first_name: { type: 'string', description: `Filing party: ${FIRST_NAME_DESCRIPTION} Which HUMAN is the petitioner is a ROLE question — the one who FILED, regardless of whether the user speaking is that person. If the user says their spouse filed the case, the SPOUSE'S name goes here.` },
          petitioner_last_name:  { type: 'string', description: `Filing party (the one who FILED): ${LAST_NAME_DESCRIPTION}` },
          respondent_first_name: { type: 'string', description: `Responding party (the one who was SERVED / did NOT file): ${FIRST_NAME_DESCRIPTION} Extract it from ANY mention of the non-filing spouse, even when this phase did not ask for it. If the user says they themselves were served with divorce papers, the USER'S name goes here. NICKNAME GUARD: when the user gives ONLY a nickname, a quoted name, or a "known as X" / "goes by X" / "we all call him X" phrasing for the respondent (e.g. "his name is Slick", "she goes by Junebug", "everyone calls him \\"Doc\\""), do NOT populate this field with the nickname — leave it empty this turn and use the response to ask for the respondent\'s FULL LEGAL NAME (e.g. "What is Slick\'s full legal name?"). A nickname in a sworn petition is a defect; the field must hold a legal name.` },
          respondent_last_name:  { type: 'string', description: `Responding party: ${LAST_NAME_DESCRIPTION} Same NICKNAME GUARD as respondent_first_name — never populate from a nickname or "known as" phrasing; ask for the full legal name instead.` },
          who_filed: {
            type: 'string',
            enum: ['me', 'my_spouse', 'unknown'],
            description: 'MACHINE-READ role signal: who filed the divorce case. Extract as SOON as the user makes it clear (e.g. "I filed", "my wife filed", "she started this", "I got served"). "me" → the user is the petitioner. "my_spouse" → the user is the respondent; the spouse who filed is the petitioner. Set once and only re-emit if the user corrects it. Independent of the *_first_name / *_last_name fields, which name the parties by their court role, not by who is speaking.'
          },
          served_on_user: {
            type: 'string',
            enum: ['yes', 'no', 'unknown'],
            description: 'MACHINE-READ role signal: was the USER personally served with the divorce papers? "yes" (the user received the papers) implies who_filed = my_spouse and the USER is the respondent. Extract from phrasings like "I was served last week" / "the process server handed it to me". Do NOT set this when the user is describing serving papers ON their spouse.'
          },

          // ── RESIDENCY ──
          state:                 { type: 'string', description: '2-letter state code' },
          county:                { type: 'string', description: 'County (or parish/district) where petition is filed, in proper name case with typos corrected (e.g. "simcoe county" → "Simcoe"). Extract from ANY mention ("I live in simcoe county"), even when the phase did not ask for it.' },
          residency_state_months: { type: 'number', description: 'Months lived in the state. Convert stated durations to months ("5 years" → 60; "18 months" → 18).' },
          residency_county_days:  { type: 'number', description: 'Days lived in the filing county. Convert stated durations to days ("3 months" → 90).' },
          residency_basis:        { type: 'string', description: 'NY only: which DRL § 230 jurisdictional basis applies (e.g., both_residents, married_in_ny_1yr, last_lived_together_1yr, grounds_arose_1yr, 2yr_residence)' },
          has_protective_order:   { type: 'boolean' },

          // ── GROUNDS & MARRIAGE ──
          marriage_date:   { type: 'string' },
          marriage_duration: { type: 'string', description: 'Length of the marriage when the user states a duration instead of (or before) a date, normalized with the unit spelled out and typos fixed (e.g. "married 2928 days" → "2928 days (approximately 8 years)"; "35 yeRs" → "35 years"). Still ask for the marriage date itself.' },
          marriage_city:   { type: 'string' },
          marriage_state:  { type: 'string' },
          separation_date: {
            type: 'string',
            // s.8(2)(a) grounds gate (Canadian Divorce Act): the one-year
            // separation ground is only pleadable when the parties will
            // have been separated for at least a year by the time the
            // court makes the divorce order. When you extract a separation
            // date, INTERNALLY compute months since separation from today:
            //   * If it is < 12 months, DO NOT emit `breakdown_of_marriage`
            //     (Canada) or any other one-year-separation ground on the
            //     `grounds` field — the template will fall back to
            //     prospective language plus a drafter warning, or the
            //     user must supply cruelty / adultery.
            //   * If it is ≥ 12 months, the one-year ground is fine.
            // Applies to Canadian jurisdictions (Divorce Act, s.8(2)(a));
            // US no-fault grounds do not have a fixed one-year separation
            // period and are unaffected.
            description:
              'Date the spouses began living separate and apart, ISO YYYY-MM-DD when known. GROUNDS GATE (Canada, Divorce Act s.8(2)(a)): compute months-since-separation against today\'s date; if less than 12 months, DO NOT emit `breakdown_of_marriage` (or any other one-year-separation ground) on the `grounds` field — the ground is not yet pleadable. Either omit `grounds` (the template pleads prospective language plus a drafter warning) or use the fault grounds the user stated (cruelty, adultery). US jurisdictions are unaffected.',
          },
          grounds: {
            type: 'string',
            // CLOSED-SET enum with NO "other" sentinel. Mari v9-D showed the
            // model defaulting to a placeholder "other" whenever grounds were
            // unclear, which the downstream resolver could not map onto a real
            // ground. Remove the escape hatch: if the user has not stated
            // grounds, OMIT this field — the v9-A resolver falls back to facts
            // inference (and, for TX, insupportability as the statutory default
            // when nothing else applies).
            description: 'MACHINE-READ code for the ground for divorce, as a snake_case slug matching the target jurisdiction\'s statutory vocabulary. If the user has not stated grounds — OR you are unsure which jurisdictional slug applies — OMIT this field entirely. NEVER emit any of these forbidden placeholder strings: "other", "unknown", "unclear", "none", "n/a", "na", "not_sure". They are NOT statutory grounds; they poison the profile and force the merge layer to overwrite you from the companion promoter. When in doubt, OMIT — the profile then stays absent and a downstream promoter fills the slug from the grounds fact. The v9-A resolver falls back to facts inference and jurisdiction-appropriate defaults. Examples of valid codes: insupportability (TX §6.001 no-fault); irreconcilable_differences (CA Fam. Code §2310); irretrievable_breakdown (NY DRL §170(7) no-fault, six months); breakdown_of_marriage (ON Divorce Act s.8, one-year separation); cruelty (TX §6.002 / ON s.8(2)(b)(i)); cruel_treatment (NY DRL §170(1) / GA §19-5-3(10) / Utah §30-3-1(3)(g)); adultery (TX §6.003 / ON s.8(2)(b)(ii) / NY DRL §170(4)); felony (TX §6.004); abandonment (TX §6.005 / NY DRL §170(2)); imprisonment (NY DRL §170(3), three consecutive years); living_apart (TX §6.006 / CA "separate for statutory period"); separation_agreement (NY DRL §170(6)); separation_judgment (NY DRL §170(5)); mental_confinement (TX §6.007). Emit whichever slug the jurisdiction and the user\'s stated ground call for; the resolver and template map from there.',
          },

          // ── CHILDREN ──
          children_confirmed: { type: 'boolean', description: 'true = section complete (no minor children or data collected)' },
          children: {
            type: 'array',
            description: 'Children mentioned in THIS message only. Entries are MERGED into the already-collected list by name (or dob when unnamed) — previously recorded children are never removed by this field, so DO NOT re-send children already in ALREADY COLLECTED. To correct a child, re-send that child with the same name and the corrected details. ONE ENTRY PER DISTINCT CHILD — "kids are 24 and 21" is TWO entries ([{age:24},{age:21}]), NOT 25 (age concatenation is a bug); "we have three kids ages 7, 9, and 12" is THREE entries; the array LENGTH is the count of children, never a sum or concatenation of ages. Always attach a name so merge dedup works across turns: if the user did not name the child, synthesize a stable placeholder ("Child 1", "Child 2", …) — nameless age-only entries cannot be matched on the next turn and will duplicate.',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string', description: 'Child\'s given name (or "Child 1"/"Child 2" placeholder when the user has not named the child). Required for stable dedup across turns.' },
                dob:  { type: 'string', description: 'Date of birth in ISO YYYY-MM-DD when the user gives a birth date. Never derive from age.' },
                age:  { type: 'number', description: 'Age in whole years — ONE child\'s age, never a joined multi-digit string of several children\'s ages ("24 and 21" → two entries with age 24 and age 21, NEVER a single entry with age 2421 or 25).' }
              }
            }
          },
          remove_children: {
            type: 'array',
            description: 'Names of previously recorded children to remove, ONLY when the user says a recorded child should not be on the record.',
            items: { type: 'string' }
          },
          number_of_children: {
            type: 'integer',
            minimum: 0,
            // Live Mari v9-B replay: after the model recorded the children
            // once, it stopped re-emitting children[] on later turns (correctly
            // — the "don't re-send" rule). The template then had no way to
            // read the count because it depended on children.length. First-
            // class number_of_children detaches the count from list
            // repetition and lets the model volunteer the count even when it
            // omits individual children rows.
            description: 'Count of children of THIS marriage as a whole integer (>= 0). Emit whenever the user states or enumerates children: "kids are 24 and 21" → 2; "we have three kids ages 7, 9, and 12" → 3; "no children" → 0. MANDATORY when has_minor_children is false: any turn where the user says there are no children of the marriage ("no kids", "no children", "we don\'t have kids", "childless") REQUIRES BOTH has_minor_children: false AND number_of_children: 0 on that same turn — recording only the boolean is a bug (Tavita FL replay: numberOfChildren stayed null in the story page). Emit alongside the children[] array whenever you record specific children, and re-emit this count on any later turn where the count is discussed even if you do not re-send the children[] rows. Never sum or concatenate ages ("24 and 21" is 2, not 45 and not 2421).',
          },
          custody_arrangement: {
            type: 'string',
            enum: ['joint', 'sole_petitioner', 'sole_respondent', 'shared', 'split', 'contested', 'undecided'],
            description: 'Decision-making/custody arrangement as a MACHINE-READ code — templates branch on this exact value, so map the user\'s natural phrasing onto the closest code and put their exact wording in a fact instead. "joint decision making" / "we decide together" / "joint custody" → joint; "I have sole custody" → sole_petitioner; "my spouse has sole custody" → sole_respondent; "50/50" / "equal time" → shared; "each of us keeps one child" → split; "we disagree about custody" → contested; not yet decided → undecided. Where the children mainly LIVE goes in primary_custodian, not here — "kids live with me, we decide together" → joint here plus primary_custodian.'
          },
          primary_custodian: { type: 'string', description: "Who the children primarily LIVE with (primary physical custody/residence): 'petitioner', 'respondent', 'shared', or the parent's name. Extract from phrasings like \"the children live mainly with me\" (→ 'petitioner' when the user is the petitioner). Separate from custody_arrangement — record both when the message covers both." },
          parent_time_plan: {
            type: 'string',
            enum: ['statutory_minimum', 'expanded', 'equal', 'custom'],
            description: "How the non-custodial parent's time is set: 'statutory_minimum' (the state's standard schedule), 'expanded' (the optional expanded statutory schedule), 'equal' (50/50), or 'custom'. Extract ONLY the user's explicit choice."
          },
          parent_time_details: { type: 'string', description: "The custom schedule in the user's words, ONLY when parent_time_plan is 'custom'." },
          child_support_amount: { type: 'number', description: 'Monthly child support amount in dollars, if agreed or known' },
          child_support_payor: {
            type: 'string',
            enum: ['petitioner', 'respondent'],
            description: "Who pays child support: 'petitioner' or 'respondent' (map \"I pay\" / \"my spouse pays\" onto the correct role)."
          },

          // ── PROPERTY ──
          property_confirmed: { type: 'boolean' },
          property_agreement: {
            type: 'string',
            enum: ['agreed', 'contested', 'pending'],
            description: 'MACHINE-READ code for the property-division posture: "we have a separation agreement" / "we\'ve worked it all out" → agreed; "we disagree" / "fighting over the house" → contested; "still working on it" → pending. Put the user\'s exact wording in a fact, not here.'
          },
          has_property: { type: 'boolean', description: 'true if the parties accumulated community/marital property during the marriage, false if none' },
          has_debts:    { type: 'boolean', description: 'true if the parties accumulated community/marital debts during the marriage, false if none' },
          petitioner_property: { type: 'array', items: { type: 'string' }, description: `Assets the petitioner keeps. Extract ONLY assets the user explicitly assigned to the petitioner. ${PROPERTY_ITEM_DESCRIPTION}` },
          respondent_property: { type: 'array', items: { type: 'string' }, description: `Assets the respondent keeps. Extract ONLY assets the user explicitly assigned to the respondent. ${PROPERTY_ITEM_DESCRIPTION}` },
          petitioner_debts: { type: 'array', items: { type: 'string' }, description: `Debts the petitioner takes responsibility for. Extract ONLY debts the user explicitly assigned to the petitioner. ${DEBT_ITEM_DESCRIPTION}` },
          respondent_debts: { type: 'array', items: { type: 'string' }, description: `Debts the respondent takes responsibility for. Extract ONLY debts the user explicitly assigned to the respondent. ${DEBT_ITEM_DESCRIPTION}` },

          // ── EQUALIZATION PAYMENT (property, not debt) ──
          equalization_amount: {
            type: 'number',
            description: 'Dollar figure of a cash equalization payment one spouse pays the other to equalize the property division. Emit this dedicated field — NEVER list the equalization payment as an entry in petitioner_debts or respondent_debts (a live California decree once buried $80,000 under ALLOCATION OF DEBTS this way). The decree renders equalization as its own ordered clause under DIVISION OF PROPERTY when this field is set.'
          },
          equalization_schedule: {
            type: 'string',
            description: 'Human-readable payment schedule for the equalization payment, in the user\'s words with typos cleaned (e.g. "in equal monthly installments of $2,222.22 over 36 months beginning October 1, 2026"). Free-form — the decree renders this fragment verbatim after "payable ". Omit if the user has not stated a schedule.'
          },
          equalization_payor: {
            type: 'string',
            enum: ['petitioner', 'respondent'],
            description: 'MACHINE-READ role of the party who PAYS the equalization sum. Map natural phrasings ("I owe him $80k to equalize" → the user\'s own role; "the petitioner shall pay the respondent" → petitioner).'
          },
          equalization_payee: {
            type: 'string',
            enum: ['petitioner', 'respondent'],
            description: 'MACHINE-READ role of the party who RECEIVES the equalization sum. Always the opposite side of equalization_payor — emit whichever the user names; the other is derived if omitted.'
          },

          // ── PRENUPTIAL / PREMARITAL AGREEMENT ──
          prenup_signed: {
            type: 'boolean',
            description: 'true when the user mentions the parties signed a prenuptial/premarital agreement before the marriage. Extract from ANY mention ("we signed a prenup in 2001", "there is a premarital agreement", "the prenup says…") — the decree adds a WHEREAS-style recital when this is true.'
          },
          prenup_signed_year: {
            type: 'number',
            minimum: 1900,
            maximum: 2100,
            description: 'Calendar year the prenuptial agreement was signed, when the user states it ("we signed a prenup in 2001" → 2001). Optional; omit if the user has not stated a year.'
          },
          prenup_governs_after_divorce: {
            type: 'boolean',
            description: 'true when the user states the prenuptial agreement continues to govern the characterization or disposition of property after the divorce (e.g. "the prenup still applies", "we\'re dividing property per the prenup"). Signals the decree to add the "continues to govern" recital.'
          },

          // ── SPOUSAL SUPPORT ──
          spousal_support_confirmed: { type: 'boolean' },
          spousal_support_requested: { type: 'boolean' },
          support_amount:   { type: 'number' },
          support_duration: { type: 'string' },
          support_basis:    { type: 'string' },

          // ── SERVICE OF PROCESS ──
          service_method: {
            type: 'string',
            enum: ['waiver', 'formal', 'publication', 'undecided'],
            description: 'MACHINE-READ code for how the respondent will be served — document selection branches on this exact value. Map natural phrasings: "spouse will sign the waiver/acknowledgment" / "they\'ll accept the papers" / "acknowledged service" → waiver; "process server" / "sheriff" / "personal service" / "someone will hand-deliver" → formal; "I can\'t find my spouse" / "substituted service" / "service by publication" → publication; not yet decided → undecided. Put the user\'s exact wording in a fact, not here.'
          },
          service_date: {
            type: 'string',
            description: 'MACHINE-READ ISO date (YYYY-MM-DD) — when the user describes when they were served (or when their spouse was served) with the divorce papers, emit service_date as an ISO date. NEVER OMIT THIS FIELD when the user narrates a service event: any served-date phrase — "served May 12", "she filed on the 3rd", "the process server showed up last Tuesday", "I got served yesterday", "papers arrived June 24" — REQUIRES service_date this turn, even when the user did not name a year. Recording only a free-text fact ("she served me May 12") is a bug: rule 18 year-inference and the /respond deadline banner both branch on the STRUCTURED field. Apply rule 18 year-inference against today\'s date and any file-number signal to fill in the year; if no signal exists, use the CURRENT calendar year and record a fact noting the assumption. Year inference is LOAD-BEARING: the /respond deadline banner reads this field directly, and a wrong-year date tells a real respondent their deadline passed a year ago when it has not. When the user gives a partial date (month + day, no year), INFER the year from surrounding context — the case-filing year visible in a file number ("FS-25-…" implies 2025, "FS-24-…" implies 2024), other dates already discussed in this or an earlier turn (the spouse\'s filing date, the separation date, prior court dates), or an explicit "recent past" description ("last week", "a few days ago") measured against today\'s date. NEVER silently default to the separation-date year, the marriage-date year, or any single stored year without a real signal. If the year truly cannot be inferred with confidence, emit the date using the CURRENT calendar year AND record a fact noting the year was assumed so the user can correct it. Examples: "process server handed it to me at my house on june 24" with an earlier "case number FS-25-…" → service_date "2025-06-24" (the FS-25- file number is the year signal); "I served him last Tuesday" with today = 2026-08-28 → the corresponding Tuesday in 2026. Marcus persona failure (Ontario acceptance v6): spouse filed 2025-06-17 with file number FS-25-…; user typed "june 24"; the correct service_date is 2025-06-24, NOT 2024-06-24 — defaulting to the separation-date year (2024) is the exact bug this rule exists to prevent. Never emit a partial or fuzzy date ("last month", "sometime in June") here; leave those in a fact instead.'
          },
          respondent_address: { type: 'string', description: 'Respondent\'s current residence, sworn as verbatim text in the petition ("is a resident of <this>"). Only populate when the user gives a real address (street, or a firm city/state statement) they can swear to. If the user hedges ("possibly", "maybe", "I think", "not sure", "I don\'t know", "somewhere in X"), leave this EMPTY and set respondent_address_unknown: true + respondent_suspected_location instead — see rule 17 in DATA QUALITY RULES.' },
          respondent_address_unknown: { type: 'boolean', description: 'MACHINE-READ flag: REQUIRED every turn (schema-level), DEFAULT false. Emit true when the user does NOT know the respondent\'s current residence with sworn certainty (e.g., "I don\'t know where he is", "no current address", "haven\'t seen him in months", "he moved out X months ago and I have no address for him", "possibly in <place>") — any turn describing hedged whereabouts REQUIRES respondent_address_unknown: true THIS SAME TURN. Emit false otherwise (including turns that do not discuss the respondent\'s whereabouts at all — false is the safe default). The TX petition template renders the alternative-service clause instead of a "is a resident of ..." sentence when this is true — an unset flag emits an EMPTY residence clause and drops the alt-service caveat entirely. NEVER OMIT this field; the STRUCTURED field is what the template reads, not the fact log. Recording only a fact is a bug. See rule 17 in DATA QUALITY RULES; the Mari v8b failure was exactly this omission.' },
          respondent_suspected_location: { type: 'string', description: 'NON-SWORN, hedge-stripped guess at where the respondent might be. Emit "" (empty string) when the respondent\'s whereabouts are not in question this turn or the user named no place; emit the verbatim place — with leading hedges stripped — whenever the user hedged a location for the respondent ("possibly in Louisiana or Mississippi" → "Louisiana or Mississippi"; "maybe with his brother in Ohio" → "Ohio, possibly with his brother"). Strip leading hedge words ("possibly", "maybe", "perhaps", "somewhere in", "I think", "it might be", "around", "probably", "could be", "not sure", "I don\'t know") before emitting per rule 19; the field name already conveys uncertainty so double-hedging in the value is wrong. Templates keep this OUT of the sworn residence clause. NEVER OMIT this field when the user names ANY place for the respondent — always emit it alongside respondent_address_unknown: true whenever a hedged place is named.' },

          // ── INDIGENCY / FEE WAIVER (all states) ──
          indigency_confirmed: { type: 'boolean' },
          indigency_requested: { type: 'boolean' },
          monthly_income:      { type: 'number', description: "The USER'S OWN total monthly income in dollars — one person's income only, NEVER a combined or household total. When the user reports both incomes, put each in petitioner_monthly_income / respondent_monthly_income instead." },
          monthly_expenses:    { type: 'number', description: "The user's own total monthly expenses in dollars." },
          petitioner_monthly_income: { type: 'number', description: "The PETITIONER's own gross monthly income in dollars (the filing party per this interview's role convention) — one person's income only, never a combined total." },
          respondent_monthly_income: { type: 'number', description: "The RESPONDENT's own gross monthly income in dollars (the responding spouse per this interview's role convention) — one person's income only, never a combined total." },
          income_breakdown: {
            type: 'array',
            description: 'Itemized monthly income. REPLACE-PER-PERSON: the entries you send for a person REPLACE everything previously recorded for that person, so whenever you mention ANY income for a person this turn you MUST emit the COMPLETE list of income items for that person — restate the existing items EXACTLY as summarized in ALREADY COLLECTED (same label, same amount) plus the new or corrected ones. Persons you do not mention are untouched; omit the field entirely when this message has no income information. label examples: "Your wages", "Child support received"; person: petitioner | respondent | joint | other.',
            items: {
              type: 'object',
              properties: {
                label:  { type: 'string' },
                amount: { type: 'number', description: 'Dollars per month' },
                person: { type: 'string', description: 'petitioner | respondent | joint | other' }
              },
              required: ['label', 'amount']
            }
          },
          expense_breakdown: {
            type: 'array',
            description: 'Itemized monthly expenses. REPLACE semantics: the list you send REPLACES the previously recorded expense list, so whenever this message mentions ANY expense you MUST emit the user\'s COMPLETE current expense list — restate the existing items EXACTLY as summarized in ALREADY COLLECTED (same label, same amount) plus the new or corrected ones. Omit the field entirely when this message has no expense information. label examples: "Housing", "Utilities", "Food", "Childcare", "Transportation", "Medical", "Debt payments".',
            items: {
              type: 'object',
              properties: {
                label:  { type: 'string' },
                amount: { type: 'number', description: 'Dollars per month' }
              },
              required: ['label', 'amount']
            }
          },
          assets_description:  { type: 'string' },
          dependents_count:    { type: 'number' },

          // ── MILITARY STATUS ──
          military_status_confirmed:  { type: 'boolean' },
          respondent_military_status: {
            type: 'string',
            enum: ['not_military', 'military', 'unknown'],
            description: 'MACHINE-READ code: "not in the military" → not_military; "on active duty" / "serving" → military; "I don\'t know" → unknown.'
          },
          military_search_date:       { type: 'string', description: 'Calendar date the DMDC/SCRA search was (or will be) run, when the user gives one.' },
          military_search_method:     { type: 'string' },
          military_search_planned: {
            type: 'string',
            enum: ['before_filing', 'date_scheduled', 'already_completed'],
            description: 'How the user has committed to the DMDC/SCRA search. A non-date commitment like "I\'ll look at it before I file" → before_filing, and that answer fully SATISFIES the DMDC search question — record it and move on; never keep demanding a calendar date. A specific date (also record military_search_date) → date_scheduled; a search already run → already_completed.'
          },

          // ── RECONCILIATION (Ghana — MCA s.2(3)) ──
          reconciliation_acknowledged: { type: 'boolean', description: 'true = user acknowledges mandatory reconciliation requirement' },

          // ── MARRIAGE TYPE (Ghana — ordinance/customary/Mohammedan) ──
          marriage_type: {
            type: 'string',
            enum: ['ordinance', 'customary', 'mohammedan'],
            description: 'Type of marriage (Ghana): ordinance, customary, or mohammedan'
          },

          // ── FORMER-NAME RESTORATION (any phase) ──
          restore_previous_name: { type: 'boolean', description: 'true ONLY when the user affirmatively says they (or their spouse) want a former name restored as part of the divorce; false ONLY when they explicitly decline. NEVER suggest, recommend, or imply that anyone should change their name — record this only when the user raises it themselves.' },
          previous_name: { type: 'string', description: 'The exact former name to be restored, in the user\'s words, ONLY when the user affirmatively provided it. Never guess, propose, or construct a name (e.g., never assume a maiden name).' },
          name_change_party: {
            type: 'string',
            enum: ['petitioner', 'respondent'],
            description: "Whose former name is restored: 'petitioner' or 'respondent'. Record ONLY when the user stated whose name it is; if unstated, ask instead of assuming."
          },

          // ── REVIEW ──
          user_confirmed_review: { type: 'boolean' },

          // ── CORRECTIONS (any phase) ──
          superseded_facts: {
            type: 'array',
            items: { type: 'string' },
            description: SUPERSEDED_FACTS_DESCRIPTION
          },

          // ── FACTS (any phase) ──
          // Schema-typed companion values (numeric_value, place_value) let the
          // model surface a fact's machine-readable payload alongside the
          // sworn-prose content string, so downstream promotion can route the
          // quantity or place into the structured scalar the templates read
          // without ever string-parsing the content. v11-B mirror of v11-A's
          // subcategory-based boolean promotion: Mari's "respondent possibly in
          // Louisiana or Mississippi" was emitted only as prose + subcategory,
          // and Alison's "two adults" only as prose — the structured
          // respondentSuspectedLocation and numberOfChildren stayed null. The
          // fields are optional; the model populates them when the fact
          // actually carries a number or a place.
          extracted_facts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                content:     { type: 'string', description: FACT_CONTENT_DESCRIPTION },
                category:    { type: 'string' },
                subcategory: { type: 'string' },
                numeric_value: {
                  type: ['number', 'null'],
                  description: 'When the fact carries a numeric quantity the templates might need (child count, income, expense, days/months of residency, dollar amounts), ALSO populate this field with that number. Use the raw number — no units, no currency symbol. For CHILDREN facts (any subcategory: children / adult_children / minor_children), ALWAYS emit numeric_value = the count of children the fact references — adult-only facts count adult children ("two adult kids" → 2), minor-only facts count minor children, general/unspecified facts count the total. Even when the fact prose spells the number in words, emit the digit here ("we have three kids" → 3). Omitting numeric_value on a children fact is a bug (Alison CA replay: an adult_children fact carried the prose "two adult children" but no numeric_value, and numberOfChildren stayed null in the story page). When the fact has no numeric quantity, omit the field (or set null).'
                },
                place_value: {
                  type: ['string', 'null'],
                  description: 'When the fact names a place (city, state/province, region, or a hedged "possibly in X or Y" location for the respondent), ALSO populate this field with just the place name(s) — hedge words stripped ("possibly in Louisiana or Mississippi" → "Louisiana or Mississippi"), no leading articles, no surrounding sentence. When the fact does not name a place, omit the field (or set null).'
                },
                grounds_value: {
                  type: ['string', 'null'],
                  description: 'When a fact narrates the grounds for divorce, emit the canonical snake_case grounds slug matching the target jurisdiction (e.g. irretrievable_breakdown for NY §170(7), cruel_treatment for GA §19-5-3(10), cruelty for TX §6.002, irreconcilable_differences for CA Fam. Code §2310, insupportability for TX §6.001 no-fault, breakdown_of_marriage for ON Divorce Act s.8, adultery for TX §6.003 / NY §170(4), abandonment for TX §6.005 / NY §170(2)). Only populate when the fact category or subcategory is grounds AND the user explicitly narrated the ground. Return null if uncertain — NEVER invent a slug the user did not narrate.'
                }
              },
              required: ['content', 'category']
            }
          }
        }
      }
    }
  };
}

// ─── Field mapping (snake_case → camelCase) ───────────────────────────────────
const FIELD_MAP = {
  petitioner_first_name:       'petitionerFirstName',
  petitioner_last_name:        'petitionerLastName',
  respondent_first_name:       'respondentFirstName',
  respondent_last_name:        'respondentLastName',
  state:                       'state',
  county:                      'county',
  residency_state_months:      'residencyStateMonths',
  residency_county_days:       'residencyCountyDays',
  residency_basis:             'residencyBasis',
  has_protective_order:        'hasProtectiveOrder',
  marriage_date:               'marriageDate',
  marriage_duration:           'marriageDuration',
  marriage_city:               'marriageCity',
  marriage_state:              'marriageStateName',
  separation_date:             'separationDate',
  grounds:                     'groundsForDivorce',
  children_confirmed:          'childrenConfirmed',
  children:                    'children',
  number_of_children:          'numberOfChildren',
  custody_arrangement:         'custodyArrangement',
  primary_custodian:           'primaryCustodian',
  parent_time_plan:            'parentTimePlan',
  parent_time_details:         'parentTimeDetails',
  child_support_amount:        'childSupportAmount',
  child_support_payor:         'childSupportPayor',
  property_confirmed:          'propertyConfirmed',
  property_agreement:          'propertyAgreement',
  has_property:                'hasProperty',
  has_debts:                   'hasDebts',
  petitioner_property:         'petitionerProperty',
  respondent_property:         'respondentProperty',
  petitioner_debts:            'petitionerDebts',
  respondent_debts:            'respondentDebts',
  equalization_amount:         'equalizationAmount',
  equalization_schedule:       'equalizationSchedule',
  // equalization_payor / equalization_payee are NOT here — they map role-aware
  // in _applyFieldUpdates (resolved to the actual party name so the decree
  // reads "Alison Rae McPherson shall pay Devin McPherson" rather than
  // "petitioner shall pay respondent").
  prenup_signed:               'prenupSigned',
  prenup_signed_year:          'prenupSignedYear',
  prenup_governs_after_divorce: 'prenupGovernsAfterDivorce',
  spousal_support_confirmed:   'spousalSupportConfirmed',
  spousal_support_requested:   'spousalSupportRequested',
  spousal_support_waived:      'spousalSupportWaived',
  spousal_support_agreed:      'spousalSupportAgreed',
  spousal_support_awarded:     'spousalSupportAwarded',
  support_amount:              'supportAmount',
  support_duration:            'supportDuration',
  support_basis:               'supportBasis',
  service_method:              'serviceMethod',
  service_date:                'serviceDate',
  respondent_address:          'respondentAddress',
  respondent_address_unknown:  'respondentAddressUnknown',
  respondent_suspected_location: 'respondentSuspectedLocation',
  indigency_confirmed:         'indigencyConfirmed',
  indigency_requested:         'indigencyRequested',
  monthly_income:              'monthlyIncome',
  monthly_expenses:            'monthlyExpenses',
  income_breakdown:            'incomeBreakdown',
  expense_breakdown:           'expenseBreakdown',
  assets_description:          'assetsDescription',
  dependents_count:            'dependentsCount',
  military_status_confirmed:   'militaryStatusConfirmed',
  respondent_military_status:  'respondentMilitaryStatus',
  military_search_date:        'militarySearchDate',
  military_search_method:      'militarySearchMethod',
  military_search_planned:     'dmdcSearchPlanned',
  // petitioner_monthly_income / respondent_monthly_income are deliberately
  // NOT here: they map role-aware in _applyFieldUpdates (the USER's own
  // income → monthlyIncome, the spouse's → spouseMonthlyIncome).
  user_confirmed_review:       'userConfirmedReview',
  reconciliation_acknowledged: 'reconciliationAcknowledged',
  marriage_type:               'marriageType',
  restore_previous_name:       'restorePreviousName',
  previous_name:               'previousName',
  name_change_party:           'nameChangeParty',
  // TX legacy compat
  residency_tx_months:         'residencyStateMonths',
};


// ─── Property/debt same-turn dedup ────────────────────────────────────────────
// Even with REPLACE-PER-PERSON, within ONE incoming list the model may still
// restate the same asset under a slightly different label ("$18k dog-grooming
// business" and "the mobile dog-grooming business worth $18k"). Templates
// render each element verbatim, so a same-turn restatement would double the
// item in the decree. Pure plumbing — no fuzzy matching: strip whitespace,
// punctuation, dollar amounts, and a small closed set of articles/qualifiers
// ("the", "a", "worth", "approximately", ...), then compare. Two entries whose
// normalized cores collide (equal, or one contained in the other) collapse to
// the LONGER original wording (the longer string almost always carries the
// larger set of identifying details — address, creditor, refi disposition).
// Never merges across parties: this function only sees a single party's list.
const PROPERTY_ITEM_STOPWORDS = new Set([
  'the', 'a', 'an', 'my', 'our', 'their', 'his', 'her', 'your',
  'and', 'or', 'of', 'in', 'on', 'at', 'for', 'to', 'with',
  'worth', 'valued', 'value', 'approximately', 'approx', 'about', 'around',
  // "the marital home at 1418 Willow Glen" vs "the house at 1418 Willow Glen
  // assigned to the petitioner" — descriptor-only tokens that never carry
  // identity get dropped so the identifying tokens (address, account number)
  // decide the collision. Live CA acceptance run, 2026-08.
  'marital', 'family', 'primary', 'former', 'main', 'joint', 'community',
  'total', 'currently', 'shall', 'be', 'is',
]);

// Same-meaning synonyms collapse to one token so a "house at 1418…" and a
// "home at 1418…" collide on identity. Kept small and closed — this is not a
// thesaurus; only the pairs a live decree run actually produced go here.
const PROPERTY_ITEM_SYNONYMS = new Map([
  ['house', 'home'],
  ['residence', 'home'],
  ['dwelling', 'home'],
  ['property', 'home'],   // "the property at 1418 Willow Glen" ≈ "the home at 1418 Willow Glen"
  ['auto', 'vehicle'],
  ['car', 'vehicle'],
  ['truck', 'vehicle'],
  ['suv', 'vehicle'],
]);

function _propertyItemCore(raw) {
  return String(raw)
    .toLowerCase()
    // Strip currency amounts ($6,400 / $18k / $22,000.50 / 45,000 dollars).
    .replace(/\$\s*\d[\d,]*(?:\.\d+)?\s*[km]?\b/g, ' ')
    .replace(/\b\d[\d,]*(?:\.\d+)?\s*(?:dollars?|usd|cad)\b/g, ' ')
    // Punctuation → space (hyphens too, so "dog-grooming" ≈ "dog grooming").
    .replace(/[^\w\s]/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((t) => t && !PROPERTY_ITEM_STOPWORDS.has(t))
    .map((t) => PROPERTY_ITEM_SYNONYMS.get(t) || t)
    .join(' ');
}

// Token-set containment: every meaningful token of the shorter (by token
// count) core appears in the longer. Catches "the house at 1418 Willow Glen
// … assigned to the petitioner" ≈ "the marital home at 1418 Willow Glen …
// valued at approximately $1,200,000 with $340,000 mortgage assigned to the
// petitioner" — substring alone missed this because the shorter phrase's
// tokens are interleaved. Requires at least 3 shared meaningful tokens so a
// two-word restatement never eats an unrelated item.
function _isTokenSubset(shorter, longer) {
  const sTokens = shorter.split(' ').filter(Boolean);
  const lTokens = new Set(longer.split(' ').filter(Boolean));
  if (sTokens.length < 3) return false;
  return sTokens.every((t) => lTokens.has(t));
}

function dedupePropertyItems(items) {
  if (!Array.isArray(items) || items.length < 2) return items.slice();
  // Preserve original order; when a collision is detected, keep the longer
  // wording (or the earlier one on tie) and drop the shorter/later.
  const kept = [];
  const cores = [];
  for (const item of items) {
    const core = _propertyItemCore(item);
    if (!core) { // an entry whose meaningful tokens were all stripped is noise
      kept.push(item);
      cores.push(core);
      continue;
    }
    let collision = -1;
    for (let j = 0; j < kept.length; j++) {
      const other = cores[j];
      if (!other) continue;
      if (core === other || core.includes(other) || other.includes(core)) {
        collision = j;
        break;
      }
      // Token-set containment: catches the CA acceptance case where the
      // model restated the same asset with the identifying tokens in a
      // different order ("house … assigned to the petitioner" vs "marital
      // home … valued at … mortgage assigned to the petitioner").
      const shorter = core.length <= other.length ? core : other;
      const longer  = core.length <= other.length ? other : core;
      if (_isTokenSubset(shorter, longer)) {
        collision = j;
        break;
      }
    }
    if (collision === -1) {
      kept.push(item);
      cores.push(core);
    } else if (item.length > kept[collision].length) {
      kept[collision] = item;
      cores[collision] = core;
    }
    // else: shorter/equal — drop the incoming duplicate.
  }
  return kept;
}

// ─── Phase → fact category ────────────────────────────────────────────────────
const PHASE_CATEGORY = {
  INTAKE:          'general',
  RESIDENCY:       'residency',
  GROUNDS:         'grounds',
  RECONCILIATION:  'grounds',
  CHILDREN:        'children',
  PROPERTY:        'property',
  SUPPORT:         'support',
  SERVICE:         'service',
  INDIGENCY:       'indigency',
  MILITARY:        'military',
  REVIEW:          'general',
};

// ─── Orchestrator behavior rules ──────────────────────────────────────────────
// Injected into every system prompt to enforce consistent UX across all states.

// Injected only when the user's own full legal name is not yet in captured
// data. A live Texas persona ("Mari") ran 14 turns without ever being asked
// for her name because the interview waited for it to fall out of natural
// conversation; the generator then rendered the petition with literal
// `[PETITIONER NAME]` in the PDF. Turn-1 rule + phase-advance gate below.
const NAME_FIRST_RULE = `
TURN 1 RULE — USER'S OWN NAME IS MISSING: The user's own full legal name is not yet in ALREADY COLLECTED. Your VERY NEXT question MUST be exactly: "What is your full legal name?" — regardless of what the current phase's COLLECT list says. Do NOT extract other facts in preference to the name. Do NOT skip this question because the user shared other information. Do NOT accept vague answers ("me", "the petitioner", "just call me by my first name") without a follow-up asking for the full first + last name. Do NOT set phase_complete: true until the user's own full legal name is captured.
`;

// RESPONDENT_NAME_RULE — TX Mari acceptance v7: user said "his name is Slick"
// and the orchestrator silently accepted "Slick" as the respondent's legal
// name. A nickname in a sworn petition is a defect. This rule fires ALWAYS
// (the check is qualitative — is the given name a nickname? — and belongs
// to the model, not to a regex).
const RESPONDENT_NAME_RULE = `
RESPONDENT NAME — NICKNAME GUARD: When the user gives a nickname, a quoted name, or a "known as X" / "goes by X" / "we all call him X" phrasing for the respondent (or the opposing spouse) — e.g. "his name is Slick", "she goes by Junebug", "everyone calls him \\"Doc\\"" — DO NOT persist the nickname as the respondent's legal name in respondent_first_name / respondent_last_name. Instead, this turn's response MUST ask directly for the respondent's full legal name (e.g. "What is Slick's full legal name?"). Record the nickname in a fact for provenance. Do NOT advance to the next phase (do NOT set phase_complete: true) while the respondent's known identifier is only a nickname. A single-word first name the user typed as a nickname counts too — if in doubt, ask.
`;

const ORCHESTRATOR_BEHAVIOR = `
CONVERSATION RULES (you MUST follow these strictly):
1. Ask exactly ONE question per message. The COLLECT list above shows everything to gather in this phase, but you MUST ask them one at a time across multiple messages. Never combine two or more questions.
2. When you set phase_complete: true, your response MUST naturally transition to the next topic and ask the first relevant question about it. Never say "let's proceed" or "we're ready to move on" without immediately asking the next question. Never wait for the user to say "proceed."
3. Keep each response to 1-3 sentences. Acknowledge what the user said briefly, then ask the next question.
4. Never repeat information the user already provided, and never re-ask for anything shown in ALREADY COLLECTED or stated in an earlier message — acknowledge it and ask only for what is missing.
5. Extract ONLY information the user explicitly stated. Never guess, infer, or fill in a value the user did not provide — if something is unclear or missing, ask about it instead. (Correcting an obvious typo or normalizing casing is NOT guessing.)
6. If the user indicates a contested issue (custody, property, support) or a safety risk, acknowledge once that advice from a lawyer is recommended for that issue, then continue helping.
7. Respond in the same language the user writes in. Extract field VALUES with the user's meaning but in clean form — obvious typos corrected and names in proper name case — with field names and dates in the structured formats requested.
8. When the user's message does NOT answer your pending question, first acknowledge and record what they DID share — that information is never wasted. Do NOT tack the pending question onto every reply: re-ask it AT MOST once every other turn, and vary the phrasing each time (never repeat a question word-for-word). On the in-between turns, simply acknowledge their information and let the conversation continue — you can return to the open question later, including at the end of the phase.
`;

// No first-message disclaimer — the app UI already disclaims elsewhere.
// The AI disclaimer appears only at REVIEW completion (see REVIEW_COMPLETION).

// MILITARY phase: the DMDC/SCRA search is a soft gate. A live persona run
// showed the interview repeating "What date will you run the DMDC search?"
// verbatim and refusing to proceed on "I'll look at it before I file".
const MILITARY_SOFT_GATE = `
DMDC SEARCH — SOFT GATE: The DMDC/SCRA search date is NOT a hard requirement for this interview.
- A commitment WITHOUT a calendar date ("I'll look at it before I file", "I'll check it later") fully satisfies the DMDC question: record military_search_planned: 'before_filing', acknowledge it, and complete the phase when the other military fields are collected. Do NOT ask again for a date.
- If the user gives a date, record military_search_date (and military_search_planned: 'date_scheduled'); if they already ran the search, record military_search_planned: 'already_completed'.
- Never repeat a question word-for-word. If you genuinely must revisit a topic, rephrase and briefly say why.`;

// INDIGENCY (fee-waiver) phase: also a SOFT gate. A live California
// persona ("Alison") replayed the same "do you want the court to waive
// your filing fees?" question across turns because "I'll come back to
// this" / "skip for now" / "just generate the docs" never landed as an
// answer. A clear defer/skip fully satisfies the phase — the user can
// return to fee waiver later on /profile.
const INDIGENCY_SOFT_GATE = `
FILING-FEE WAIVER — SOFT GATE: The fee-waiver phase is OPTIONAL. Complete it as soon as the user's intent is clear, in any of these directions:
- YES, wants a waiver: collect monthly_income, monthly_expenses, assets_description, dependents_count, and set indigency_requested: true + indigency_confirmed: true.
- NO, will pay the filing fee: set indigency_requested: false + indigency_confirmed: true and move on. Do NOT then ask financial questions.
- SKIP / DEFER — any of "skip this", "come back to it", "I'll decide later", "just generate the documents", "not sure yet", "move on": treat as SATISFIED. Set indigency_confirmed: true (leave indigency_requested undecided), acknowledge that they can revisit the fee waiver on their profile page, and advance to the next phase. Do NOT re-ask the fee-waiver question after that.
- Never repeat a question word-for-word. If a required financial detail is still missing on a YES answer, rephrase and briefly say why it's needed.`;

// Shared name-missing check — the "user's own name" is present when any of
// affiantName / firstName / petitionerFirstName is set. The orchestrator's
// _applyFieldUpdates already back-derives affiantName from the correct side
// once role is known, so this one predicate suffices for both roles.
function _userNameMissing(data) {
  if (!data || typeof data !== 'object') return true;
  return !data.affiantName && !data.firstName && !data.petitionerFirstName;
}

const REVIEW_COMPLETION = `
COMPLETION INSTRUCTIONS: When the user confirms all information is correct and you set user_confirmed_review: true, your response MUST:
1. Provide a brief summary confirmation (2-3 sentences)
2. Include this notice: "Important: These documents were generated with AI assistance. While we strive for accuracy, they may contain errors or omissions. We strongly recommend having them reviewed by a licensed attorney in your jurisdiction before filing."
3. End with a clear call to action: "Your divorce documents are ready! Click the Download or Purchase button below to get your completed package."
`;

// ─── BaseDivorceOrchestrator ─────────────────────────────────────────────────

class BaseDivorceOrchestrator {
  /**
   * @param {Object} config
   * @param {string}   config.stateCode  - 2-letter code, e.g. 'CA'
   * @param {string}   config.stateName  - Full name, e.g. 'California'
   * @param {Object}   config.phases     - Phase definitions (name → { prompt, optional, ... })
   * @param {string[]} config.phaseOrder - Ordered list of phase names
   */
  constructor({ stateCode, stateName, phases, phaseOrder }) {
    this.stateCode  = stateCode;
    this.stateName  = stateName;
    this.phases     = phases;
    this.phaseOrder = phaseOrder;
    this.tool       = buildPhaseTool(stateCode);
  }

  /**
   * Main entry point. Called by routes/chat.js for divorce_package documents.
   */
  async processMessage(message, conversationHistory, divorceData, userId, sessionId) {
    const openAIService = global.openAIService;
    if (!openAIService) throw new Error('LLM service not available');

    const state = this._initState(divorceData);

    if (!this.phases[state.currentPhase]) {
      logger.warn(`${this.stateCode}DivorceOrchestrator: unknown phase, resetting to INTAKE`, { phase: state.currentPhase });
      state.currentPhase = 'INTAKE';
    }

    logger.info(`${this.stateCode}DivorceOrchestrator: processing message`, {
      phase: state.currentPhase,
      completedPhases: state.completedPhases?.length ?? 0,
      userId,
      sessionId
    });

    const systemPrompt = this._buildSystemPrompt(state, divorceData);
    const userPrompt   = this._buildUserPrompt(message, divorceData, state);

    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-16),
      { role: 'user', content: userPrompt }
    ];

    // Rebuild the phase tool per turn so the `response` field description can
    // carry a HARD name-required signal at the schema layer while the user's
    // own name is missing. Static this.tool would embed the rule permanently
    // and cache-poison later turns.
    const tool = _userNameMissing(divorceData)
      ? buildPhaseTool(this.stateCode, { nameMissing: true })
      : this.tool;

    const completion = await openAIService.chat(messages, {
      model:       DEFAULT_LLM_MODEL,
      tools:       [tool],
      tool_choice: { type: 'function', function: { name: 'process_phase_data' } },
      temperature: 0.3,
      max_tokens:  1500
    });

    const toolCall = completion.choices[0].message.tool_calls?.[0];
    if (!toolCall) throw new Error(`${this.stateCode}DivorceOrchestrator: LLM did not call the required function`);

    let extracted;
    try {
      extracted = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      throw new Error(`${this.stateCode}DivorceOrchestrator: Failed to parse function arguments: ${e.message}`);
    }

    const { response, phase_complete, extracted_facts, superseded_facts, ...fieldUpdates } = extracted;

    const updatedData = this._applyFieldUpdates(divorceData, fieldUpdates);

    // Corrections retire the superseded fact cards BEFORE this turn's facts
    // merge, so a corrected fact never sits beside its replacement.
    this._applySupersededFacts(updatedData, superseded_facts);

    const newFacts = this._buildFacts(extracted_facts || [], fieldUpdates, state.currentPhase, message);
    // v12-B: post-turn companion promoter. Luna via Responses API sparsely
    // omits schema-typed place_value / numeric_value companions even when the
    // narrative content in the fact clearly carries a place or a count. Run
    // ONE focused, cheap LLM call to backfill just those companions from the
    // fact prose — LLM-first, no regex. Fail-open so the existing v11-A
    // boolean promotion in lib/api/profile.ts still fires on the raw facts.
    if (newFacts.length > 0) {
      try {
        await this._promoteFactCompanions(newFacts, openAIService);
      } catch (err) {
        logger.warn(`${this.stateCode}DivorceOrchestrator: companion promoter failed, continuing`, {
          error: err && err.message,
        });
      }
    }
    if (newFacts.length > 0) {
      // Upsert only — never re-sort. A wholesale organizeFacts() here would
      // silently undo the user's manual fact ordering on every chat turn.
      updatedData.facts = mergeFacts(updatedData.facts || [], newFacts);
    }

    // Phase-advance gate: no phase past INTAKE is satisfied while the user's
    // own name is missing. This is plumbing — even if the LLM sets
    // phase_complete: true, we refuse to advance until any of
    // affiantName / firstName / petitionerFirstName is present in captured
    // data (task blocker: TX Mari, 14 turns without a name, then a petition
    // rendered with literal [PETITIONER NAME]).
    let resolvedPhaseComplete = phase_complete;
    if (resolvedPhaseComplete && _userNameMissing(updatedData)) {
      resolvedPhaseComplete = false;
      logger.info(`${this.stateCode}DivorceOrchestrator: blocked phase_complete — user name missing`, {
        phase: state.currentPhase,
      });
    }

    if (resolvedPhaseComplete) {
      state.completedPhases = [...(state.completedPhases || []), state.currentPhase];
      state.phaseHistory    = [
        ...(state.phaseHistory || []),
        { phase: state.currentPhase, completedAt: new Date().toISOString() }
      ];
      const nextPhase = this._getNextPhase(state.currentPhase, updatedData);
      logger.info(`${this.stateCode}DivorceOrchestrator: phase advanced`, {
        from: state.currentPhase, to: nextPhase
      });
      state.currentPhase = nextPhase;
    }

    updatedData.orchestratorState = state;

    const { requiredDocuments, selectionReasons } = documentSelectionAgent.select(updatedData, 'family');
    updatedData.requiredDocuments = requiredDocuments;
    updatedData.selectionReasons  = selectionReasons;

    return { response, affidavitData: updatedData, newFacts, orchestratorState: state };
  }

  // ─── Private helpers ───────────────────────────────────────────────────────

  /**
   * Build the enhanced system prompt with behavioral rules and phase context.
   */
  _buildSystemPrompt(state, divorceData) {
    const parts = [];

    // TODAY anchor — load-bearing for rule 18 year-inference.
    // Without an explicit "today", the model falls back to whatever its
    // pretraining thinks the year is (typically stale) and silently defaults
    // partial dates ("served May 12") to the previous year. Marcus v14
    // regression: today is 2026 but the LLM inferred 2025-05-12. Every
    // interview turn now stamps TODAY at the very top of the system prompt so
    // "the CURRENT calendar year" in the rule and schema descriptions
    // resolves against a real signal, not the model's memory of a training cutoff.
    const todayISO = new Date().toISOString().slice(0, 10);
    const currentYear = todayISO.slice(0, 4);
    parts.push(
      `TODAY: ${todayISO} (current year: ${currentYear}).\n` +
      `When the user narrates a partial date (month + day, no year) — "served May 12", "he filed on the 3rd", "papers arrived June 24" — infer the year per rule 18 against THIS date. NEVER default to a prior year, the separation-date year, or the marriage-date year without an explicit year signal. If no signal exists, use ${currentYear} and record a fact noting the assumption.`,
    );

    // Front-load the turn-1 name rule BEFORE the phase prompt when name is
    // missing, so the rule owns the top of the developer message on Luna
    // (where system→developer and long phase COLLECT lists downstream would
    // otherwise bury it). A live TX Mari run — persona that never volunteers
    // her name — regressed here when the rule sat below the phase prompt.
    if (_userNameMissing(divorceData)) {
      parts.push(NAME_FIRST_RULE);
    }

    parts.push(this.phases[state.currentPhase].prompt);

    // Core behavior rules (one question at a time, auto-transition)
    parts.push(ORCHESTRATOR_BEHAVIOR);

    // Repeat the name rule AFTER the phase prompt too — belt + suspenders,
    // because Luna sometimes weighs later-in-context instructions more
    // heavily than earlier ones (recency effect on long developer messages).
    if (_userNameMissing(divorceData)) {
      parts.push(NAME_FIRST_RULE);
    }

    // Extraction-quality rules (full names, casing, typo cleanup,
    // extract-everything, never re-ask, duration conversion)
    parts.push(EXTRACTION_QUALITY);

    // Respondent-name nickname guard — always injected. Live TX Mari
    // acceptance v7 accepted "Slick" as the respondent's legal name.
    parts.push(RESPONDENT_NAME_RULE);

    // Progress indicator
    const currentIdx = this.phaseOrder.indexOf(state.currentPhase);
    const totalPhases = this.phaseOrder.length;
    parts.push(`PROGRESS: Step ${currentIdx + 1} of ${totalPhases}.`);

    // Tell the LLM what the next phase is so it can transition naturally
    if (state.currentPhase !== 'REVIEW') {
      const nextPhase = this._getNextPhase(state.currentPhase, divorceData);
      if (nextPhase && this.phases[nextPhase]) {
        parts.push(`WHEN PHASE IS COMPLETE: Transition to "${this.phases[nextPhase].displayName}" and immediately ask the first relevant question about that topic.`);
      }
    }

    // Military phase: DMDC search is a soft gate — a "before I file"
    // commitment satisfies it (state prompt files say the date is required;
    // this central rule overrides them without touching ~60 prompt files).
    if (state.currentPhase === 'MILITARY') {
      parts.push(MILITARY_SOFT_GATE);
    }

    // INDIGENCY phase: also a soft gate — a defer/skip reply must not
    // trap the interview in a fee-waiver loop.
    if (state.currentPhase === 'INDIGENCY') {
      parts.push(INDIGENCY_SOFT_GATE);
    }

    // Review phase: CTA + AI disclaimer
    if (state.currentPhase === 'REVIEW') {
      parts.push(REVIEW_COMPLETION);
    }

    return parts.join('\n');
  }

  _initState(divorceData) {
    if (divorceData.orchestratorState?.currentPhase) {
      return { ...divorceData.orchestratorState };
    }
    return {
      currentPhase:    this._determineStartingPhase(divorceData),
      completedPhases: [],
      phaseHistory:    [],
      caseId:          divorceData.caseId || null,
      stateCode:       this.stateCode
    };
  }

  _determineStartingPhase(divorceData) {
    // Accept both split fields (new orchestrator) and combined name (legacy documents)
    const hasPetitioner = divorceData.petitionerFirstName || divorceData.petitionerName;
    const hasRespondent = divorceData.respondentFirstName || divorceData.respondentName;
    if (hasPetitioner && hasRespondent) {
      if (divorceData.state && divorceData.county) {
        if (divorceData.marriageDate) return 'CHILDREN';
        return 'GROUNDS';
      }
      return 'RESIDENCY';
    }
    return 'INTAKE';
  }

  _buildUserPrompt(message, divorceData, state) {
    const collected = this._summarizeCollected(divorceData);
    const currentIdx = this.phaseOrder.indexOf(state.currentPhase);
    const completedCount = state.completedPhases?.length || 0;
    // When the user's own name is missing, the developer/system message
    // already carries the turn-1 rule; the user prompt gets a matching
    // REQUIRED-NEXT-QUESTION line so the closest-to-message layer also
    // demands it. Third signal (schema + system + user) is what carried the
    // TX Mari fix over models that hedge on any single one.
    const requiredNext = _userNameMissing(divorceData)
      ? '\nREQUIRED NEXT QUESTION: The user\'s own full legal name is not yet captured. Your reply this turn MUST end with a direct request for the USER\'S OWN full legal name. Do not ask anything else this turn.'
      : '';
    return [
      `CURRENT PHASE: ${state.currentPhase} (${this.phases[state.currentPhase]?.displayName || state.currentPhase})`,
      `PROGRESS: Phase ${currentIdx + 1} of ${this.phaseOrder.length} | ${completedCount} completed`,
      collected ? `\nALREADY COLLECTED (do NOT ask for any of this again — acknowledge it and ask only for what is missing):\n${collected}` : '',
      requiredNext,
      `\nUSER MESSAGE: ${message}`
    ].filter(Boolean).join('\n');
  }

  _summarizeCollected(d) {
    // States that use Plaintiff/Defendant in divorce complaints:
    //   NY, PA — traditional plaintiff/defendant style
    //   GA, MA, MI, NC, NJ, OH — also use Plaintiff/Defendant in divorce complaints
    // All other states (CO, WA, VA, TX, AZ, CA, FL, IL, UT, and Canadian provinces)
    //   use Petitioner/Respondent (or Complainant/Defendant for VA).
    const usesPlaintiff = ['NY', 'PA', 'GA', 'MA', 'MI', 'NC', 'NJ', 'OH'].includes(this.stateCode);
    const filingPartyLabel   = usesPlaintiff ? 'Plaintiff'  : 'Petitioner';
    const respondingPartyLabel = usesPlaintiff ? 'Defendant' : 'Respondent';

    // Canadian provinces use province-specific location terminology:
    // NB uses "Judicial District"; PE has a single court location (Charlottetown).
    // All other Canadian provinces and all US states use generic location labelling.
    const CANADIAN_PROVINCES = ['MB', 'SK', 'NB', 'NS', 'NL', 'PE', 'ON', 'BC', 'AB', 'QC', 'NT', 'YT', 'NU'];
    const isCanadian = CANADIAN_PROVINCES.includes(this.stateCode);
    let locationLabel;
    if (this.stateCode === 'NB') {
      locationLabel = 'Judicial District';
    } else if (isCanadian) {
      locationLabel = 'Court Location';
    } else {
      locationLabel = 'County';
    }

    const items = [];
    if (d.petitionerFirstName) items.push(`${filingPartyLabel}: ${d.petitionerFirstName} ${d.petitionerLastName || ''}`);
    if (d.respondentFirstName)  items.push(`${respondingPartyLabel}: ${d.respondentFirstName} ${d.respondentLastName || ''}`);
    if (d.state)                items.push(`Province/State: ${d.state}`);
    if (d.county)               items.push(`${locationLabel}: ${d.county}`);
    if (d.residencyStateMonths !== undefined && d.residencyStateMonths !== null) {
      items.push(`Time living in state/province: ${d.residencyStateMonths} months`);
    }
    if (d.marriageDate)         items.push(`Marriage date: ${d.marriageDate}`);
    if (d.marriageDuration)     items.push(`Marriage length: ${d.marriageDuration}`);
    if (d.marriageCity || d.marriageStateName || d.marriageLocation) {
      const marriagePlace = d.marriageLocation ||
        [d.marriageCity, d.marriageStateName].filter(Boolean).join(', ');
      items.push(`Marriage place: ${marriagePlace}`);
    }
    if (d.separationDate)       items.push(`Separation date: ${d.separationDate}`);
    if (d.groundsForDivorce || d.grounds) {
      items.push(`Grounds: ${d.groundsForDivorce || d.grounds}`);
    }
    if (Array.isArray(d.children) && d.children.length > 0) {
      items.push(`Children recorded (${d.children.length}):\n${summarizeChildren(d.children)}`);
    } else if (typeof d.hasMinorChildren === 'boolean') {
      items.push(`Minor children: ${d.hasMinorChildren ? 'yes' : 'no'}`);
    }
    if (d.custodyArrangement)   items.push(`Custody arrangement: ${d.custodyArrangement}`);
    if (d.propertyAgreement)    items.push(`Property agreement: ${d.propertyAgreement}`);
    if (typeof d.spousalSupportRequested === 'boolean') {
      items.push(`Spousal support requested: ${d.spousalSupportRequested ? 'yes' : 'no'}`);
    }
    if (d.serviceMethod)        items.push(`Service method: ${d.serviceMethod}`);
    if (typeof d.indigencyRequested === 'boolean') {
      items.push(`Fee waiver requested: ${d.indigencyRequested ? 'yes' : 'no'}`);
    }
    if (d.respondentMilitaryStatus) {
      items.push(`Respondent military status: ${d.respondentMilitaryStatus}`);
    }
    // Itemized money already recorded — shown so the model can restate a
    // person's COMPLETE list consistently (income_breakdown/expense_breakdown
    // REPLACE what is stored for any person the turn mentions).
    if (Array.isArray(d.incomeBreakdown) && d.incomeBreakdown.length > 0) {
      const lines = d.incomeBreakdown
        .filter((e) => e && typeof e === 'object' && e.label)
        .map((e) => `- [${e.person || 'unspecified'}] ${e.label}: $${e.amount}/month`);
      if (lines.length > 0) {
        items.push(`Income items recorded (when you emit income_breakdown for a person, restate that person's COMPLETE list using these EXACT labels and amounts, changing only what the user corrected):\n${lines.join('\n')}`);
      }
    }
    // Property/debt lists per party — same REPLACE-PER-PERSON contract as
    // income: whenever the model emits one of these fields, it must restate
    // the party's COMPLETE list, so we show the current stored items with
    // an explicit instruction to reuse them EXACTLY. Without this summary,
    // a later turn that only mentions a NEW asset would REPLACE the party's
    // full list down to that single item, silently dropping everything the
    // interview had already collected.
    const listBlock = (label, list) => {
      const items = Array.isArray(list)
        ? list.map((e) => (typeof e === 'string' ? e.trim() : '')).filter(Boolean)
        : [];
      if (items.length === 0) return null;
      const lines = items.map((e) => `- ${e}`).join('\n');
      return `${label} recorded (when you emit this list, restate every one of these items EXACTLY as written plus any new ones — a duplicated restatement doubles the estate; a dropped one silently removes the asset from the decree):\n${lines}`;
    };
    const petPropBlock = listBlock('Petitioner property', d.petitionerProperty);
    if (petPropBlock) items.push(petPropBlock);
    const respPropBlock = listBlock('Respondent property', d.respondentProperty);
    if (respPropBlock) items.push(respPropBlock);
    const petDebtBlock = listBlock('Petitioner debts', d.petitionerDebts);
    if (petDebtBlock) items.push(petDebtBlock);
    const respDebtBlock = listBlock('Respondent debts', d.respondentDebts);
    if (respDebtBlock) items.push(respDebtBlock);
    if (Array.isArray(d.expenseBreakdown) && d.expenseBreakdown.length > 0) {
      const lines = d.expenseBreakdown
        .filter((e) => e && typeof e === 'object' && e.label)
        .map((e) => `- ${e.label}: $${e.amount}/month`);
      if (lines.length > 0) {
        items.push(`Expense items recorded (when you emit expense_breakdown, restate the COMPLETE list using these EXACT labels and amounts, changing only what the user corrected):\n${lines.join('\n')}`);
      }
    }
    if (d.facts?.length) {
      const priorFacts = d.facts
        .map((fact) => typeof fact === 'string' ? fact : fact?.content)
        .filter(Boolean)
        .slice(0, 30)
        .map((fact) => String(fact).slice(0, 500));
      items.push(`Facts documented: ${d.facts.length}`);
      if (priorFacts.length > 0) {
        items.push(`Previously documented facts (do not ask for these again):\n- ${priorFacts.join('\n- ')}`);
      }
    }
    return items.join('\n');
  }

  _applyFieldUpdates(divorceData, fields) {
    const updated = { ...divorceData };

    // Role signals (who_filed / served_on_user) resolve BEFORE the caption
    // fields land, because they decide which side of the caption is "the
    // user" and therefore where affiantName / firstName / lastName point.
    // The interview's historical assumption ("user == petitioner") once
    // wrote the SPOUSE's name into affiantName when the user was actually
    // the respondent (Ontario Marcus, served-on-user replay).
    const roleFromServed = (() => {
      const s = typeof fields.served_on_user === 'string'
        ? fields.served_on_user.toLowerCase() : '';
      return s === 'yes' ? 'respondent' : '';
    })();
    const roleFromFiled = (() => {
      const w = typeof fields.who_filed === 'string'
        ? fields.who_filed.toLowerCase() : '';
      if (w === 'me') return 'petitioner';
      if (w === 'my_spouse') return 'respondent';
      return '';
    })();
    const derivedRole = roleFromServed || roleFromFiled;
    if (derivedRole) updated.role = derivedRole;

    for (const [snakeKey, camelKey] of Object.entries(FIELD_MAP)) {
      if (fields[snakeKey] !== undefined && fields[snakeKey] !== null && fields[snakeKey] !== '') {
        // Structured lists accumulate across turns — the LLM usually emits
        // only the entry under discussion, so assignment would drop the rest.
        if (snakeKey === 'children') {
          updated.children = mergeChildren(divorceData.children, fields.children);
        } else if (snakeKey === 'income_breakdown' || snakeKey === 'expense_breakdown') {
          updated[camelKey] = mergeLabeledAmounts(divorceData[camelKey], fields[snakeKey]);
        } else if (
          snakeKey === 'petitioner_property' || snakeKey === 'respondent_property' ||
          snakeKey === 'petitioner_debts' || snakeKey === 'respondent_debts'
        ) {
          // REPLACE-PER-PERSON (mirrors income_breakdown): the model is
          // instructed to restate this party's COMPLETE list every time it
          // touches this field, so the incoming list REPLACES what was
          // stored for this party — label-variant duplicates ("the mobile
          // dog-grooming business" vs "the dog-grooming business worth
          // $18k") can never accumulate across turns. Persons the turn does
          // not mention (the other side's fields) are untouched.
          //
          // A legacy string value passes through as a single-element array —
          // NEVER re-split on commas (a comma split once shattered
          // "$62,000" into "$62" + "000").
          //
          // Same-turn dedup: within one incoming list the model may still
          // restate the same asset under two label variants. Collapse via
          // dedupePropertyItems() (whitespace/punctuation/stopword/currency
          // stripping — pure plumbing, no fuzzy match), keeping the longer
          // wording so no detail is lost.
          const incoming = dedupePropertyItems(
            (Array.isArray(fields[snakeKey]) ? fields[snakeKey] : [fields[snakeKey]])
              .map((item) => String(item).trim())
              .filter(Boolean)
          );
          updated[camelKey] = incoming;
        } else {
          updated[camelKey] = fields[snakeKey];
        }
      }
    }

    // Role-aware income mapping (mirrors how affiantName resolves the USER's
    // own side): monthlyIncome is always the USER's own income and
    // spouseMonthlyIncome the spouse's — NEVER a household total. Which
    // schema role is "the user" follows the interview's role convention:
    // missing role means petitioner.
    const userRole = String(updated.role || '').toLowerCase() === 'respondent'
      ? 'respondent'
      : 'petitioner';
    const spouseRole = userRole === 'respondent' ? 'petitioner' : 'respondent';
    const roleIncome = {
      petitioner: fields.petitioner_monthly_income,
      respondent: fields.respondent_monthly_income,
    };
    if (typeof roleIncome[userRole] === 'number') {
      updated.monthlyIncome = roleIncome[userRole];
    }
    if (typeof roleIncome[spouseRole] === 'number') {
      updated.spouseMonthlyIncome = roleIncome[spouseRole];
    }

    // Itemized money is the source of truth for the totals once present —
    // but only the USER's own person-tagged entries feed monthlyIncome
    // (summing every entry once stored a $17,200 household total as the
    // petitioner's income). Untagged entries count as the user's own: the
    // fee-waiver phases ask about the user's income. Enum-tag filtering is
    // plumbing, not language work.
    if (Array.isArray(updated.incomeBreakdown) && updated.incomeBreakdown.length > 0) {
      const personOf = (entry) => String(entry?.person || '').trim().toLowerCase();
      const own = updated.incomeBreakdown.filter(
        (entry) => personOf(entry) === userRole || personOf(entry) === ''
      );
      const spouse = updated.incomeBreakdown.filter((entry) => personOf(entry) === spouseRole);
      if (own.length > 0) updated.monthlyIncome = totalOf(own);
      if (spouse.length > 0) updated.spouseMonthlyIncome = totalOf(spouse);
    }
    if (Array.isArray(updated.expenseBreakdown) && updated.expenseBreakdown.length > 0) {
      updated.monthlyExpenses = totalOf(updated.expenseBreakdown);
    }

    if (Array.isArray(fields.remove_children) && fields.remove_children.length > 0) {
      updated.children = removeChildrenByName(updated.children, fields.remove_children);
    }
    // Re-derive only on turns that touched the children list, from actual
    // ages — adult children must not flip the minor-children flag (it gates
    // custody/support document selection), and an explicit "no minors"
    // answer must not be overwritten on unrelated turns.
    if (fields.children !== undefined || fields.remove_children !== undefined) {
      updated.hasMinorChildren = hasMinors(updated.children);
    }

    // Derive full names for template compatibility
    if (updated.petitionerFirstName || updated.petitionerLastName) {
      updated.petitionerName = [updated.petitionerFirstName, updated.petitionerLastName].filter(Boolean).join(' ');
    }
    if (updated.respondentFirstName || updated.respondentLastName) {
      updated.respondentName = [updated.respondentFirstName, updated.respondentLastName].filter(Boolean).join(' ');
    }
    // The affiant is the USER, on whichever side of the caption they sit —
    // when role === 'respondent' the petitioner caption is the SPOUSE, so
    // affiantName must default from the user's own side (mirrors
    // lifeStory.fullName(): missing role means petitioner). The requirements
    // checker, document titles, and PDF filenames all read affiantName
    // (live E2E showed "Name provided" unchecked mid-interview without it).
    //
    // ROLE-FLIP CORRECTION: if affiantName was set earlier — before role
    // was known — it may point at the SPOUSE's caption side (the historical
    // "user == petitioner" default). Once role is known, if affiantName
    // still matches the spouse's caption verbatim AND the user's own side
    // has a real name to promote, replace it. Never overwrite an affiantName
    // that doesn't match either caption (a user's explicit edit).
    const userIsRespondent = String(updated.role || '').toLowerCase() === 'respondent';
    const userOwnName = userIsRespondent ? updated.respondentName : updated.petitionerName;
    const spouseCaptionName = userIsRespondent ? updated.petitionerName : updated.respondentName;
    if (!updated.affiantName) {
      if (userOwnName) updated.affiantName = userOwnName;
    } else if (
      userOwnName &&
      spouseCaptionName &&
      updated.affiantName === spouseCaptionName &&
      updated.affiantName !== userOwnName
    ) {
      updated.affiantName = userOwnName;
    }

    // Derive marriageLocation from marriageCity + marriageStateName for template compatibility.
    // BaseDivorcePetitionTemplate reads divorceData.marriageLocation for the marriage paragraph.
    if (updated.marriageCity || updated.marriageStateName) {
      updated.marriageLocation = [updated.marriageCity, updated.marriageStateName].filter(Boolean).join(', ');
    }

    // Derive spousal-support decree fields from the orchestrator's support fields.
    // BaseDivorceDecreeTemplate (and all state subclasses) read:
    //   divorceData.spousalSupportAmount   — orchestrator stores supportAmount
    //   divorceData.spousalSupportDuration — orchestrator stores supportDuration
    //   divorceData.spousalSupportAwarded  — orchestrator stores spousalSupportRequested
    // Without these aliases the decree sections always render with '[AMOUNT]' / '[DURATION]'
    // placeholders and the spousal-support block is suppressed entirely.
    if (updated.supportAmount !== undefined) {
      updated.spousalSupportAmount = updated.supportAmount;
    }
    if (updated.supportDuration !== undefined) {
      updated.spousalSupportDuration = updated.supportDuration;
    }
    // Map spousalSupportRequested→spousalSupportAwarded when TRUE.
    // Do NOT auto-derive spousalSupportWaived from a false/absent request
    // (v23-A safety fix): silence on the topic is not an affirmative waiver,
    // and the template layer requires an explicit spousalSupportWaived===true
    // OR spousalSupportAgreed===true before rendering the waiver clause.
    // A false spousalSupportRequested simply clears the awarded flag.
    if (updated.spousalSupportRequested === true) {
      updated.spousalSupportAwarded = true;
      updated.spousalSupportWaived = false;
    } else if (updated.spousalSupportRequested === false) {
      updated.spousalSupportAwarded = false;
      // spousalSupportWaived is NOT set — the user must affirmatively agree
      // to waive support (via spousal_support_waived: true or an agreed
      // settlement fact) before any decree waives it. Otherwise the
      // template renders a "(Draft — confirm agreement before filing)"
      // Draft note per v23-A.
    }
    // BaseDivorcePetitionTemplate gates the alimony relief item on
    // requestSpousalSupport — without this alias a user who asked for
    // spousal maintenance never gets it in the petition's prayer.
    if (updated.spousalSupportRequested !== undefined && updated.requestSpousalSupport === undefined) {
      updated.requestSpousalSupport = updated.spousalSupportRequested;
    }
    // BaseDivorceDecreeTemplate prints spousalSupportPayor / spousalSupportPayee
    // verbatim in the maintenance order. The interview never asks who pays whom:
    // the petitioner is the one who requests support (spousal_support_requested),
    // so the petitioner is the payee and the respondent the payor. Derive both
    // only when support is awarded and they are not already set.
    if (updated.spousalSupportRequested === true) {
      if (!updated.spousalSupportPayee && updated.petitionerName) {
        updated.spousalSupportPayee = updated.petitionerName;
      }
      if (!updated.spousalSupportPayor && updated.respondentName) {
        updated.spousalSupportPayor = updated.respondentName;
      }
    }

    // Derive custodyType from custodyArrangement for decree template compatibility.
    // BaseDivorceDecreeTemplate (and all state subclasses) gate joint-vs-sole custody
    // language on divorceData.custodyType. The orchestrator stores custodyArrangement
    // (from custody_arrangement). Without this alias the decree always defaults to 'joint'.
    if (updated.custodyArrangement !== undefined && updated.custodyType === undefined) {
      updated.custodyType = updated.custodyArrangement;
    }

    // The decree templates print these fields verbatim, so resolve
    // party-role answers ('petitioner' / 'respondent') to the actual names.
    const roleToName = (value) => {
      const s = String(value || '').trim();
      const role = s.toLowerCase();
      // Fall back to the capitalized role word — decrees print this field
      // verbatim, and a lowercase 'petitioner' mid-sentence reads broken.
      if (role === 'petitioner' || role === 'plaintiff') {
        return updated.petitionerName || (s.charAt(0).toUpperCase() + role.slice(1));
      }
      if (role === 'respondent' || role === 'defendant') {
        return updated.respondentName || (s.charAt(0).toUpperCase() + role.slice(1));
      }
      return s;
    };
    if (updated.primaryCustodian) {
      updated.primaryCustodian = roleToName(updated.primaryCustodian);
    }
    if (updated.childSupportPayor) {
      const role = String(updated.childSupportPayor).trim().toLowerCase();
      updated.childSupportObligor = roleToName(updated.childSupportPayor);
      if (role === 'petitioner' && updated.respondentName) {
        updated.childSupportObligee = updated.respondentName;
      } else if (role === 'respondent' && updated.petitionerName) {
        updated.childSupportObligee = updated.petitionerName;
      }
    }

    // Equalization payor/payee: the schema emits a role code (petitioner |
    // respondent) so the model does not have to spell the name; the decree
    // prints these verbatim ("Alison Rae McPherson shall pay Devin
    // McPherson"), so resolve to the actual name. If only one side is set,
    // derive the opposite. Never fills both sides from a single name (a
    // self-payment reads broken); only role↔name is auto-derived.
    if (fields.equalization_payor || fields.equalization_payee) {
      const eqPayor = String(fields.equalization_payor || '').trim().toLowerCase();
      const eqPayee = String(fields.equalization_payee || '').trim().toLowerCase();
      if (eqPayor === 'petitioner' || eqPayor === 'respondent') {
        updated.equalizationPayor = roleToName(eqPayor);
      }
      if (eqPayee === 'petitioner' || eqPayee === 'respondent') {
        updated.equalizationPayee = roleToName(eqPayee);
      }
      // Derive the opposite side when only one was emitted.
      if (updated.equalizationPayor && !updated.equalizationPayee) {
        const opp = (eqPayor === 'petitioner') ? 'respondent' : 'petitioner';
        updated.equalizationPayee = roleToName(opp);
      } else if (updated.equalizationPayee && !updated.equalizationPayor) {
        const opp = (eqPayee === 'petitioner') ? 'respondent' : 'petitioner';
        updated.equalizationPayor = roleToName(opp);
      }
    }

    // Derive the former-name-restoration gate the templates read.
    // The petition relief items and the decree's RESTORATION OF NAME section
    // both gate on divorceData.requestNameChange && divorceData.previousName;
    // the interview stores restorePreviousName. Mirror it every turn so a
    // user who changes their mind ("actually, keep my married name") flips
    // the gate off again instead of freezing the first answer.
    if (updated.restorePreviousName !== undefined) {
      updated.requestNameChange = updated.restorePreviousName;
    }
    // The decree prints nameChangeParty verbatim as WHOSE name is restored
    // (falling back to petitionerName) — resolve a party-role answer to the
    // actual name, same as primaryCustodian above.
    if (updated.nameChangeParty) {
      updated.nameChangeParty = roleToName(updated.nameChangeParty);
    }

    return updated;
  }

  /**
   * The model reported statements this turn corrected (superseded_facts).
   * Retire the matching fact cards from the document and expose the
   * statements on affidavitData as `retiredFactStatements`, so the profile
   * merge (lib/api/profile.ts) can retire its stored copies too — the chat
   * route passes affidavitData through unchanged. The field is rewritten
   * every turn (and cleared when the turn reported nothing) so stale
   * retirements never re-apply to facts recorded later.
   */
  _applySupersededFacts(updatedData, supersededFacts) {
    delete updatedData.retiredFactStatements;
    const statements = sanitizeSupersededStatements(supersededFacts);
    if (statements.length === 0) return;
    const { kept, retired } = retireFacts(updatedData.facts, statements);
    if (retired.length > 0) updatedData.facts = kept;
    updatedData.retiredFactStatements = statements;
  }

  _buildFacts(extractedFacts, _fieldUpdates, currentPhase, sourceMessage) {
    const defaultCategory = PHASE_CATEGORY[currentPhase] || 'general';
    // Provenance: keep the user's own words so the review UI can show
    // exactly where each sworn statement came from.
    const sourceQuote = typeof sourceMessage === 'string'
      ? sourceMessage.trim().slice(0, 280)
      : '';
    return extractedFacts.map(f => {
      const fact = {
        id:          `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        content:     f.content,
        category:    f.category || defaultCategory,
        subcategory: f.subcategory || '',
        type:        'fact',
        confidence:  0.9,
        severity:    'success',
        sourceQuote,
        timestamp:   new Date().toISOString()
      };
      // Preserve schema-typed companions (v11-B): the profile-merge promotion
      // (lib/api/profile.ts) reads these to fill respondentSuspectedLocation
      // and numberOfChildren without string-parsing the content prose.
      if (typeof f.numeric_value === 'number' && Number.isFinite(f.numeric_value)) {
        fact.numericValue = f.numeric_value;
      }
      if (typeof f.place_value === 'string' && f.place_value.trim()) {
        fact.placeValue = f.place_value.trim();
      }
      if (typeof f.grounds_value === 'string' && f.grounds_value.trim()) {
        fact.groundsValue = f.grounds_value.trim();
      }
      return fact;
    });
  }

  /**
   * v12-B: post-turn companion-value promoter.
   *
   * Luna via the Responses API records rich narrative facts
   * ("Respondent Ray may be somewhere in Louisiana or Mississippi",
   * "we have two adult children") but sparsely omits the schema-typed
   * companions (place_value, numeric_value) even with prompt+schema
   * instructions. Downstream promotion in lib/api/profile.ts routes the
   * *typed* companion (not the fact prose) into structured profile fields
   * — so a missing companion is why respondentSuspectedLocation /
   * numberOfChildren silently stay null.
   *
   * This backstop:
   *   1. Scans new facts for ones missing a companion that WOULD promote
   *      (whereabouts → place, children → count). Skips work when none.
   *   2. Batches those facts into ONE cheap gpt-5-nano chat-completions
   *      call with a tight extraction tool.
   *   3. Merges the returned place_value / numeric_value back onto the
   *      fact objects IN PLACE, before mergeFacts.
   *
   * LLM-first (no regex over content) and fail-open (a thrown error is
   * caught by the caller — the raw facts still flow through).
   */
  async _promoteFactCompanions(facts, openAIService) {
    if (!Array.isArray(facts) || facts.length === 0) return;
    if (!openAIService || typeof openAIService.chat !== 'function') return;

    // Which facts need which companion. A fact can need both.
    // Mari v14 replay: the primary LLM tagged the whereabouts fact with
    // subcategory variants ("whereabouts", "respondent_address_unknown",
    // "residence_unknown") — strict === 'respondent_whereabouts' let those
    // through unpromoted. Match any whereabouts-ish tag on either the
    // subcategory OR the category (both are model-classified metadata
    // strings, not content prose — this is still a shape check, not regex
    // over language).
    const isWhereaboutsTag = (f) => {
      const sub = String(f?.subcategory || '').trim().toLowerCase();
      const cat = String(f?.category || '').trim().toLowerCase();
      if (sub.includes('whereabout') || cat.includes('whereabout')) return true;
      if (sub === 'respondent_address_unknown') return true;
      if (sub === 'residence_unknown' || sub === 'respondent_location') return true;
      return false;
    };
    const needsPlace = (f) => {
      if (!isWhereaboutsTag(f)) return false;
      return typeof f.placeValue !== 'string' || !f.placeValue.trim();
    };
    const needsNumeric = (f) => {
      const cat = String(f?.category || '').trim().toLowerCase();
      const sub = String(f?.subcategory || '').trim().toLowerCase();
      // Match the merge-layer isChildrenCountFact widening: Tavita (FL) had
      // a fact tagged category=parental subcategory=children_of_marriage
      // that the strict list missed — the promoter now sees any plural
      // "children" subcategory tag (children_of_marriage, adult_children,
      // no_children, …) so it can extract a count. "child_support" /
      // "child_care" (singular) never match.
      const childrenTag =
        cat === 'children' ||
        sub === 'children' ||
        sub === 'adult_children' ||
        sub === 'minor_children' ||
        sub.includes('children');
      if (!childrenTag) return false;
      return !(typeof f.numericValue === 'number' && Number.isFinite(f.numericValue));
    };
    // v21-A: grounds slug companion. David (NY, "irretrievable breakdown")
    // and Amara (GA, "documented cruelty") both narrated grounds and the
    // petition rendered the correct statute via facts inference — but
    // profile.groundsForDivorce silently stayed null because Luna never
    // emitted the structured slug. Same shape-check pattern as place/numeric:
    // model-classified metadata (category/subcategory) picks the target;
    // the promoter model extracts the canonical slug.
    const isGroundsTag = (f) => {
      const cat = String(f?.category || '').trim().toLowerCase();
      const sub = String(f?.subcategory || '').trim().toLowerCase();
      if (cat === 'grounds' || sub === 'grounds' || sub.includes('grounds')) return true;
      // v23: statutory-ground-name subcategory. Amara (GA, cruel treatment)
      // replay emitted {category:'evidence', subcategory:'cruel_treatment'} —
      // the model classified the ground by putting the statutory slug on the
      // subcategory, not by using the 'grounds' category. Match those so the
      // companion promoter still fills grounds_value from the fact prose.
      // Shape check on schema-typed metadata; no content-prose parsing.
      return STATUTORY_GROUND_TOKENS.some((tok) => sub.includes(tok));
    };
    const needsGrounds = (f) => {
      if (!isGroundsTag(f)) return false;
      return typeof f.groundsValue !== 'string' || !f.groundsValue.trim();
    };

    const targets = [];
    facts.forEach((f, i) => {
      if (!f || typeof f !== 'object') return;
      const wantPlace = needsPlace(f);
      const wantNumeric = needsNumeric(f);
      const wantGrounds = needsGrounds(f);
      if (!wantPlace && !wantNumeric && !wantGrounds) return;
      targets.push({ index: i, wantPlace, wantNumeric, wantGrounds, fact: f });
    });
    if (targets.length === 0) {
      // eslint-disable-next-line no-console
      console.log('[promoter] no facts need companions (skipped)');
      return;
    }

    // Batch payload — the model sees only what's necessary to decide. We
    // include sourceQuote as well as content: the fact content is a cleaned
    // court-usable sentence that may lose the hedged geography, but the
    // sourceQuote preserves the user's verbatim wording where the place
    // originally appeared.
    const items = targets.map((t) => ({
      id: t.index,
      content: String(t.fact.content || ''),
      sourceQuote: String(t.fact.sourceQuote || ''),
      category: String(t.fact.category || ''),
      subcategory: String(t.fact.subcategory || ''),
      want: [
        t.wantPlace ? 'place_value' : null,
        t.wantNumeric ? 'numeric_value' : null,
        t.wantGrounds ? 'grounds_value' : null,
      ].filter(Boolean),
    }));

    // eslint-disable-next-line no-console
    console.log(`[promoter] calling gpt-5-nano with ${items.length} facts needing companions`, items.map((i) => ({ id: i.id, want: i.want, sub: i.subcategory })));

    const systemPrompt =
      'You are a data-extraction assistant. Given a list of narrative fact ' +
      'entries from a divorce interview, extract structured companion values ' +
      'for each item. For every input item, emit exactly one result object ' +
      'in the results array, keyed by the input id, populating whichever of ' +
      'these companions the item\'s "want" array asks for:\n' +
      '  • place_value: the place name(s) mentioned anywhere in either the ' +
      'fact content OR the sourceQuote (the user\'s verbatim words), ' +
      'hedge-stripped (drop leading "possibly", "maybe", "I think", ' +
      '"somewhere in", "could be", "not sure", "I don\'t know"). Keep ' +
      'disjunctions intact ("Louisiana or Mississippi"). Return "" (empty ' +
      'string) if no place is mentioned in either field.\n' +
      '  • numeric_value: the numeric quantity of children mentioned ' +
      '(convert spelled numbers: "two" → 2, "three" → 3). Return null if ' +
      'no count is stated.\n' +
      '  • grounds_value: the canonical snake_case grounds slug the user ' +
      'narrated as the reason for divorce, matching the target jurisdiction\'s ' +
      'statutory vocabulary. Examples: irretrievable_breakdown (NY §170(7) ' +
      'no-fault), cruel_treatment (NY §170(1) / GA §19-5-3(10) / Utah ' +
      '§30-3-1(3)(g)), cruelty (TX §6.002 / ON s.8(2)(b)(i)), ' +
      'irreconcilable_differences (CA Fam. Code §2310), insupportability ' +
      '(TX §6.001), breakdown_of_marriage (ON Divorce Act s.8), adultery ' +
      '(TX §6.003 / NY §170(4)), abandonment (TX §6.005 / NY §170(2)), ' +
      'living_apart (TX §6.006), separation_agreement (NY §170(6)), ' +
      'felony (TX §6.004), imprisonment (NY §170(3)). Return null if ' +
      'the user did not narrate grounds, or if the ground is unclear.\n' +
      'Never invent values not present in the fact content or sourceQuote.';

    // v14-C: switch from function-tool to json_schema response_format.
    // gpt-5-nano is a reasoning model and its function-tool arguments are
    // unreliable under prompt pressure — observed live: an empty tool_calls
    // array while the model burned its completion budget on hidden reasoning.
    // json_schema-shaped content is the most reliable structured-output
    // channel for reasoning models: the entire completion IS the JSON, so
    // reasoning-token budget doesn\'t compete with argument emission.
    const responseSchema = {
      name: 'companion_extraction',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: ['results'],
        properties: {
          results: {
            type: 'array',
            description: 'One entry per input item, keyed by the input id.',
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['id', 'place_value', 'numeric_value', 'grounds_value'],
              properties: {
                id: { type: 'integer', description: 'The id from the input item.' },
                place_value: { type: ['string', 'null'], description: 'Hedge-stripped place name(s) from the fact content or sourceQuote, "" or null when none.' },
                numeric_value: { type: ['number', 'null'], description: 'Numeric count from the fact content, or null.' },
                grounds_value: { type: ['string', 'null'], description: 'Canonical snake_case grounds slug the user narrated, or null when the fact is not about grounds or the ground is unclear.' },
              },
            },
          },
        },
      },
    };

    const userPrompt = JSON.stringify({ items });

    let completion;
    try {
      completion = await openAIService.chat(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        {
          model: 'gpt-5-nano',
          response_format: { type: 'json_schema', json_schema: responseSchema },
          temperature: 0,
          // Reasoning models spend hidden tokens before emitting content —
          // 3000 leaves headroom after typical reasoning burn.
          max_tokens: 3000,
        },
      );
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(`[promoter] LLM call threw ${err && err.message} (fail-open)`);
      return;
    }

    const choice = completion?.choices?.[0];
    const contentStr = choice?.message?.content;
    // eslint-disable-next-line no-console
    console.log(`[promoter] response finish_reason=${choice?.finish_reason} contentLen=${contentStr ? contentStr.length : 0}`);
    if (!contentStr || typeof contentStr !== 'string') return;

    let parsed;
    try {
      parsed = JSON.parse(contentStr);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.log(`[promoter] JSON parse failed: ${err && err.message} content=${contentStr.slice(0, 200)}`);
      return;
    }
    const results = Array.isArray(parsed?.results) ? parsed.results : [];
    // eslint-disable-next-line no-console
    console.log(`[promoter] parsed ${results.length} result rows`);
    for (const r of results) {
      if (!r || typeof r !== 'object') continue;
      const idx = typeof r.id === 'number' ? r.id : Number(r.id);
      if (!Number.isInteger(idx)) continue;
      const fact = facts[idx];
      if (!fact || typeof fact !== 'object') continue;

      if (
        typeof r.place_value === 'string' &&
        r.place_value.trim() &&
        (typeof fact.placeValue !== 'string' || !fact.placeValue.trim())
      ) {
        fact.placeValue = r.place_value.trim();
        // eslint-disable-next-line no-console
        console.log(`[promoter] mutated fact ${fact.id} placeValue=${fact.placeValue}`);
      }
      if (
        typeof r.numeric_value === 'number' &&
        Number.isFinite(r.numeric_value) &&
        !(typeof fact.numericValue === 'number' && Number.isFinite(fact.numericValue))
      ) {
        fact.numericValue = r.numeric_value;
        // eslint-disable-next-line no-console
        console.log(`[promoter] mutated fact ${fact.id} numericValue=${fact.numericValue}`);
      }
      if (
        typeof r.grounds_value === 'string' &&
        r.grounds_value.trim() &&
        (typeof fact.groundsValue !== 'string' || !fact.groundsValue.trim())
      ) {
        fact.groundsValue = r.grounds_value.trim();
        // eslint-disable-next-line no-console
        console.log(`[promoter] mutated fact ${fact.id} groundsValue=${fact.groundsValue}`);
      }
    }
  }

  _getNextPhase(currentPhase, divorceData) {
    const idx = this.phaseOrder.indexOf(currentPhase);
    if (idx === -1 || idx === this.phaseOrder.length - 1) return 'REVIEW';

    for (let i = idx + 1; i < this.phaseOrder.length; i++) {
      const candidate = this.phaseOrder[i];
      const phaseConf = this.phases[candidate];

      // Returning users may arrive with whole sections already present in
      // My Story. Skip those sections deterministically instead of relying on
      // the model to notice them and still advancing only one phase at a time.
      if (this._phaseAlreadySatisfied(candidate, divorceData)) continue;

      if (phaseConf?.optional) {
        if (candidate === 'SUPPORT'   && divorceData.spousalSupportConfirmed === true) continue;
        // Skip INDIGENCY only when confirmed AND the user did not request a fee waiver.
        // indigencyConfirmed=true merely means the section ran; indigencyRequested=true
        // means the user actually needs the waiver and the phase must NOT be skipped.
        if (candidate === 'INDIGENCY' && divorceData.indigencyConfirmed === true && !divorceData.indigencyRequested) continue;
      }
      return candidate;
    }
    return 'REVIEW';
  }

  _phaseAlreadySatisfied(phase, data) {
    const has = (value) => value !== undefined && value !== null && value !== '';
    // No phase past INTAKE is satisfied while the user's own name is missing.
    // This deterministically blocks the returning-user skip path from jumping
    // over the intake questions when the name hasn't been captured yet.
    if (phase !== 'INTAKE' && _userNameMissing(data)) return false;
    switch (phase) {
      case 'INTAKE':
        return Boolean(
          (data.petitionerFirstName || data.petitionerName) &&
          (data.respondentFirstName || data.respondentName)
        );
      case 'RESIDENCY':
        return Boolean(data.state && data.county && has(data.residencyStateMonths));
      case 'GROUNDS':
        return Boolean(
          (data.groundsForDivorce || data.grounds) &&
          data.marriageDate &&
          (data.marriageLocation || data.marriageCity)
        );
      case 'CHILDREN':
        return data.hasMinorChildren === false ||
          data.childrenConfirmed === true ||
          this._factsExplicitlySayNoMinorChildren(data.facts);
      case 'PROPERTY':
        return has(data.propertyAgreement) || data.propertyConfirmed === true;
      case 'SUPPORT':
        return data.spousalSupportRequested === false || data.spousalSupportConfirmed === true;
      case 'SERVICE':
        return has(data.serviceMethod);
      case 'INDIGENCY':
        return data.indigencyRequested === false || data.indigencyConfirmed === true;
      case 'MILITARY':
        // A non-date commitment (dmdcSearchPlanned, e.g. 'before_filing')
        // satisfies the DMDC item — the search date is not a hard gate.
        return Boolean(
          (data.respondentMilitaryStatus &&
            (data.militarySearchDate || data.dmdcSearchPlanned || data.militaryStatusConfirmed === true)) ||
          this._factsSatisfyMilitaryCheck(data.facts)
        );
      default:
        return false;
    }
  }

  _factsExplicitlySayNoMinorChildren(facts) {
    if (!Array.isArray(facts)) return false;
    return facts.some((fact) => {
      const text = String(typeof fact === 'string' ? fact : fact?.content || '');
      return /\bno minor children\b|\bno children (?:together|of (?:the|this) marriage)\b|\bdo not have (?:any )?minor children\b/i.test(text);
    });
  }

  _factsSatisfyMilitaryCheck(facts) {
    if (!Array.isArray(facts)) return false;
    const text = facts
      .map((fact) => String(typeof fact === 'string' ? fact : fact?.content || ''))
      .join(' ');
    const hasStatus = /\bnot (?:in|serving in) (?:the )?(?:u\.?s\.? )?military\b|\bno active[- ]duty status\b|\bis (?:currently )?(?:on active duty|serving in the military)\b/i.test(text);
    const hasDmdcCheck = /\b(?:checked|searched|check of) (?:the )?DMDC\b/i.test(text) &&
      /\b(?:19|20)\d{2}\b/.test(text);
    return hasStatus && hasDmdcCheck;
  }
}

module.exports = BaseDivorceOrchestrator;
