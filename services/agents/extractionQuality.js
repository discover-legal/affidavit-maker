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
8. MACHINE-READ ENUM FIELDS: when a field's schema lists allowed values, emit EXACTLY one of those codes — never the user's phrasing. Templates and document selection branch on the exact code (storing "joint decision making" verbatim once rendered a sole-custody decree). Map the user's wording onto the closest code per the field's description, and record their exact wording as a fact when the nuance matters.`;

// Reusable schema-description fragments so every tool tells the model the
// same thing about names.
const FIRST_NAME_DESCRIPTION =
  'ALL given and middle names, in order, in proper name case (e.g. "Ellis Jane" — never drop a middle name). Preserve internal capitals the user typed (McDonald).';
const LAST_NAME_DESCRIPTION =
  'The COMPLETE surname — everything after the given name(s) — keeping hyphenated and multi-word compound surnames intact (e.g. "Smith Son-Wyatt", never just "Smith"). Proper name case; preserve internal capitals the user typed (van der Berg).';
const FACT_CONTENT_DESCRIPTION =
  'Cleaned, court-usable first-person statement: typos and speech-to-text noise corrected, proper name casing, full names instead of pronouns. The user\'s verbatim words are stored separately as the quoted source — never transcribe their typos here.';

module.exports = {
  EXTRACTION_QUALITY,
  FIRST_NAME_DESCRIPTION,
  LAST_NAME_DESCRIPTION,
  FACT_CONTENT_DESCRIPTION,
};
