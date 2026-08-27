'use strict';

/**
 * extractionQuality
 *
 * Shared extraction-quality layer for every LLM interview path:
 *   - BaseDivorceOrchestrator (all ~110 jurisdiction divorce agents)
 *   - BaseMatterOrchestrator  (all 16 matter-type agents)
 *   - GeneralAffidavitOrchestrator
 *   - affidavitService (legacy general + divorce paths)
 *
 * Exists because a live Ontario transcript showed four failure modes:
 *   1. Extraction missed values buried in a messy first message
 *      ("…was married 2928 days to marry Ellis Jane smith son-wyatt"),
 *      so later phases re-asked for the spouse's name — twice.
 *   2. Compound names were truncated ("Ellis Jame Smith Son-Wyatt" was
 *      recorded as "Ellis Smith" — middle name and hyphenated surname lost).
 *   3. Typed casing flowed into filed documents ("Mike smith").
 *   4. Facts were stored as verbatim transcriptions WITH the typos
 *      ("I like in simcoe county…") instead of cleaned first-person
 *      statements. The verbatim words belong in sourceQuote (provenance,
 *      shown as "You said: …"); fact content must be court-usable.
 *
 * EXTRACTION_QUALITY is appended to every interview system prompt.
 * All normalization (casing, typo cleanup, name splitting) is the MODEL's
 * job, steered by these prompts and the tool-schema descriptions — there is
 * deliberately no deterministic string-munging layer here (owner decision).
 */

const EXTRACTION_QUALITY = `
DATA QUALITY RULES (apply to EVERY extracted value and fact):
1. FULL LEGAL NAMES — NEVER TRUNCATE: capture the COMPLETE name: every given name, every middle name, and every surname component, including hyphenated or multi-word compound surnames. When splitting a name into first/last fields: the first-name field holds ALL given and middle names in order; the last-name field holds everything after the given name(s) — the COMPLETE surname with compounds and hyphens intact. Example: "Ellis Jane Smith Son-Wyatt" → first name: "Ellis Jane", last name: "Smith Son-Wyatt". Recording just "Ellis Smith" is WRONG.
2. PROPER NAME CASING: normalize names and place names to proper name case ("mike smith" → "Mike Smith"; "smith son-wyatt" → "Smith Son-Wyatt"; "simcoe county" → "Simcoe County") while PRESERVING any internal capitals the user typed ("McDonald", "DiCaprio", "van der Berg" stay exactly as typed).
3. CLEAN VALUES, NOT TRANSCRIPTIONS: the system stores the user's raw message separately as provenance, so every extracted value and every fact content must be the corrected, court-usable version. Fix obvious typos and speech-to-text noise from context: "I like in simcoe county" means "I live in Simcoe County"; "35 yeRs" means "35 years"; "was married 2928 days to marry Ellis…" means the spouse's name is "Ellis…". Correct spelling and casing; NEVER change meaning. If a correction would be a guess, ask one clarifying question instead.
4. EXTRACT EVERYTHING, ASK ONE THING: the current phase limits what you ASK next, never what you EXTRACT. If the user's message contains information matching ANY field in the schema — their name, the spouse's name, county, state, dates, durations, children — extract ALL of it in this call, even when you only asked for one item. A first message like "My name is Mike Smith, I live in Simcoe County, was married 2928 days to Ellis Jane Smith Son-Wyatt" must populate the user's name AND the county AND the marriage duration AND the spouse's full name at once, so later phases never re-ask.
5. NEVER RE-ASK: before asking anything, check the ALREADY COLLECTED list and the user's earlier messages. If the answer is already present, acknowledge it and ask only for what is still missing. If the user says they already told you something, re-read their earlier messages and extract it from there instead of asking again.
6. DURATIONS: understand duration expressions in any unit and convert to the unit each field requires: "married 2928 days" is a marriage length of 2928 days (about 8 years); "35 yeRs" means 35 years; "I've lived here 5 years" → months-lived field = 60. When the schema has no dedicated field for a stated duration, record it as a fact so it is not lost.
7. FACT content: a cleaned first-person statement suitable for a sworn court document — corrected spelling, proper name casing, full names instead of pronouns, self-contained. Do NOT copy the user's typos into content; their exact words are already preserved as the quoted source.
8. MACHINE-READ ENUM FIELDS: when a field's schema lists allowed values, emit EXACTLY one of those codes — never the user's phrasing. Templates and document selection branch on the exact code (storing "joint decision making" verbatim once rendered a sole-custody decree). Map the user's wording onto the closest code per the field's description, and record their exact wording as a fact when the nuance matters.
9. NO SELF-CONTRADICTORY FACTS: every fact must make ONE coherent assertion. Never fuse a statement and its negation into one fact ("I do not want to ask the court to waive the filing fee because money will be tight but I do not want to ask the court for that relief" is broken — the correct fact is "I will pay the filing fee and am not asking the court to waive it."). If the user's position is genuinely unresolved, ask a clarifying question instead of recording a contradiction.
10. NO NEAR-DUPLICATE FACTS: before emitting a fact, check the previously documented facts — if the same assertion is already recorded (even worded differently), do NOT emit it again. Emit a fact only when it adds NEW information; a correction goes in superseded_facts (when that field exists) alongside the corrected fact, never as a duplicate.
11. NEUTRAL THIRD-PERSON IN COURT-ORDER VALUE FIELDS: property, debt, support, and agreement VALUE fields are printed verbatim inside court orders, so phrase them in neutral third-person court language using the parties' names or roles — "to be refinanced into the petitioner's name", never "to be refinanced into my name". The user's own first-person words belong only in fact statements and the quoted source, never in these value fields.
12. VARY RE-ASK PHRASING: if you must ask for something again (the user answered around the question, or a required detail is still missing), NEVER repeat a previous question word-for-word — rephrase it, acknowledge what the user DID say, and explain briefly why the detail is still needed.`;

// Reusable schema-description fragments so every tool tells the model the
// same thing about names.
const FIRST_NAME_DESCRIPTION =
  'ALL given and middle names, in order, in proper name case (e.g. "Ellis Jane" — never drop a middle name). Preserve internal capitals the user typed (McDonald).';
const LAST_NAME_DESCRIPTION =
  'The COMPLETE surname — everything after the given name(s) — keeping hyphenated and multi-word compound surnames intact (e.g. "Smith Son-Wyatt", never just "Smith"). Proper name case; preserve internal capitals the user typed (van der Berg).';
const FACT_CONTENT_DESCRIPTION =
  'Cleaned, court-usable first-person statement: typos and speech-to-text noise corrected, proper name casing, full names instead of pronouns. The user\'s verbatim words are stored separately as the quoted source — never transcribe their typos here.';

// Property/debt LIST fields: each array element is one whole asset/debt.
// These lines are printed verbatim as decree line items, so element
// integrity and neutral phrasing are both load-bearing.
const PROPERTY_ITEM_DESCRIPTION =
  'Each array element must be ONE complete asset with its full description and value intact — "Fidelity 401(k), approximately $62,000" is ONE element; NEVER split an item or its dollar amount across elements. Phrase each element in neutral third-person court language using the parties\' names or roles ("the marital home at 1487 E Sycamore Way, with the mortgage to be refinanced into the petitioner\'s name") — never "my"/"me"/"I". Entries MERGE into the already-collected list — do not re-send prior items.';
const DEBT_ITEM_DESCRIPTION =
  'Each array element must be ONE complete debt with its description, creditor, and amount intact — "mortgage on 1487 E Sycamore Way, to be refinanced into the petitioner\'s name" is ONE element; NEVER split an item or its dollar amount across elements. Phrase each element in neutral third-person court language using the parties\' names or roles — never "my"/"me"/"I". Entries MERGE into the already-collected list — do not re-send prior items.';

// Correction retirement: the model reports which recorded facts a turn
// corrected; deterministic plumbing (factRetirement.js) removes the matches.
const SUPERSEDED_FACTS_DESCRIPTION =
  'Existing recorded fact statements that THIS turn CORRECTED or CONTRADICTED, quoted exactly or closely paraphrased from the previously documented facts list. List them ONLY when the user explicitly corrected themselves ("wait, actually the date was March 1st" retires the recorded end-of-February separation fact). Never list facts that were merely restated, refined, or expanded. At most 3 per turn.';

module.exports = {
  EXTRACTION_QUALITY,
  FIRST_NAME_DESCRIPTION,
  LAST_NAME_DESCRIPTION,
  FACT_CONTENT_DESCRIPTION,
  PROPERTY_ITEM_DESCRIPTION,
  DEBT_ITEM_DESCRIPTION,
  SUPERSEDED_FACTS_DESCRIPTION,
};
