# 01 — Conversation and interviews (functional spec)

Scope: the chat-based interview as a user and the surrounding system observe it. Paths are cited so a
rebuild can check behaviour, not copy code. **UNVERIFIED** marks anything not confirmed live.

A **turn** is one `POST /api/chat`. Every turn is one forced LLM tool call returning
`{ response, phase_complete, extracted_facts[], superseded_facts[], ...structured fields }`; the engine
applies fields, retires corrected facts, merges new facts, decides whether the phase advances, and
returns the updated document blob (`affidavitData`).

---

## 1. Chat route contract (`app/api/chat/route.ts`)

**Request** (authenticated JSON; body ≤ 512 KB; serialised `affidavitData` ≤ 256 KB): `message`
(1–5000 chars), optional `sessionId` (`[A-Za-z0-9_.-]{1,100}`), `conversationHistory` (≤ 40 of
`{ role:'user'|'assistant' }` or `{ type:'user'|… }`, content ≤ 6000; `role:'system'` rejected),
`affidavitData` (free-form), `skipExtraction`, and `documentType`/`state`/`country` that fill
`affidavitData` only when absent. The client sends its last 10 messages (`components/app/ChatInterface.js:336`).

**Response** `200 { success:true, response, affidavitData, newFacts[], orchestratorState|null, processingTime, sessionId, timestamp }`.
`sessionId` defaults to `chat_<epoch>_<userId>`; `GET/DELETE /api/chat/session/:id` only check that
shape against the caller's id and return metadata — transcripts live in the saved document, not the server.

**Limits/errors**: 50 turns per 15 min and 250 per day per user, fail-closed → `429`
(`lib/api/rateLimit.ts:105-106`). Validation → `400 { success:false, error, errorType, requestId }`.
The orchestrator call is retried once on non-4xx errors. An orchestrator "soft failure"
(`success:false`) still returns `200` with its error text as `response`.

**History**: newest-first accumulation up to 6000 estimated tokens (chars/4) or 20 messages; the
interview then sees the last 16 (triage: 10).

- Given `message: ''` → status `400`, `success = false`.
- Given 51 turns inside 15 minutes → turn 51 status `429`.
- Given history containing `{ role:'system' }` → status `400`.

### 1.1 Country awareness (`route.ts:337-362`)

`countryCode` resolves: explicit value → derived from `state` (provinces → CA, `ENG/SCO/NIR` → UK, AU
states, `NZ`) → subdomain of `Origin`/`Referer` (`ca.`/`canada.` → CA, `uk.`, `ie.`, `au.`, `nz.`) → `US`.
Without `ENABLE_INTERNATIONAL=true` any non-US/CA result becomes `US`. Triage clamps to
`{US,CA,UK,IE,AU,NZ}` and injects a "use Canadian references" hint for CA (`TriageOrchestrator.js:56-63`).

- Given `Origin: https://ca.discover.legal`, no state → `countryCode = 'CA'`.
- Given `state:'AB'` → `'CA'` regardless of origin. Given `state:'ENG'`, international off → `'US'`.

### 1.2 Orchestrator selection (first match, `route.ts:611-620`)

1. **Triage**: no `matterTypeCode`, no `documentType`/`document_type`/`affidavitType`, `orchestratorState.triageComplete` not true.
2. **Divorce**: `documentType === 'divorce_package'`, keyed by `state`; missing state → country default (US→TX, CA→ON, UK→ENG, IE→IRL, AU→NSW, NZ→NZ).
3. **Matter**: `matterTypeCode` names a loaded matter (15 JS packs + every valid `matters/*.yaml`).
4. **General affidavit**: registry type not routed to divorce. 5. Legacy fallback, else `400`.

- Given `{ matterTypeCode:'custody' }` → handled by custody; `orchestratorState.matterTypeCode = 'custody'`.
- Given `{ documentType:'divorce_package' }`, no state, `Origin: canada.discover.legal` → `orchestratorState.stateCode = 'ON'`.

---

## 2. Triage (`services/agents/TriageOrchestrator.js`, `prompts/triage/index.js`)

Warm greeting, then classify the plain-language need into one code from the 16 built-in entries +
YAML matters + catch-all `general_affidavit` (tool `classify_matter_type { response, phase_complete, matter_type_code?, confidence }`,
temp 0.4, 600 tokens). No personal data is collected. Ambiguity → exactly one clarifying question from a
fixed guide (DVRO vs civil harassment: intimate partner?; custody vs divorce: married?; small claims vs
general civil: amount vs jurisdiction limit; guardianship vs adoption: sever parental rights?).
Modification/enforcement requests route to the underlying matter.

**Out of scope** (criminal, immigration, criminal protective orders, bankruptcy): explain, redirect
(country-specific: USCIS vs IRCC…), and still complete as `general_affidavit` so the user is not stranded.
**Safety**: any mention of violence or danger puts the hotline first (US 1-800-799-7233; CA 1-866-863-0511; both if unsure).

**Outcome**: on `phase_complete && matter_type_code` → `affidavitData.matterTypeCode`; `divorce` also
sets `documentType='divorce_package'`; `general_affidavit` sets `documentType` if empty.
`orchestratorState = { triageComplete, triageConfidence, matterTypeCode }`; `newFacts = []`; the triage
transcript stays in history.

- Given "my husband hits me and I need him out" (US) → reply opens with the US hotline; `matterTypeCode='dvro'`, `triageComplete=true`.
- Given "restraining order against my neighbour" → reply asks exactly one question (intimate partner/co-parent?); `triageComplete=false`.
- Given "I got a DUI" → reply says criminal matters are out of scope and names criminal defence/public defender; `matterTypeCode='general_affidavit'`, `triageComplete=true`.
- Given "we want to split up, house in Calgary", `countryCode='CA'` → `matterTypeCode='divorce'`, `documentType='divorce_package'`.

---

## 3. Rules shared by every interview

Injected into every system prompt (`BaseMatterOrchestrator.js:96-106`, `BaseDivorceOrchestrator.js:649-660`,
`GeneralAffidavitOrchestrator.js`, `extractionQuality.js`):

- **One question per reply**, 1–3 sentences; a `phase_complete` reply already asks the next phase's first question.
- **Name first**: while the user's own full legal name is missing, the next question must be "What is your full legal name?" (vague answers get a follow-up). The engine refuses to advance any phase while the name is missing, whatever the model returned (`BaseMatterOrchestrator.js:214-220`, `BaseDivorceOrchestrator.js:794-800`, `GeneralAffidavitOrchestrator.js:230-236`); divorce also rebuilds the tool schema each turn so the `response` parameter itself demands it.
- **Extract everything, ask one thing**; never re-ask what is in ALREADY COLLECTED; never guess; enum fields carry machine codes, wording goes into a fact.
- **Facts** are cleaned first-person court-usable statements. Stored shape: `{ id, content, category, subcategory, type:'fact', confidence:0.9, severity:'success', sourceQuote (≤280 chars of the user's message), timestamp }`; divorce adds optional `numericValue`, `placeValue`, `groundsValue`.
- **Corrections**: ≤ 3 `superseded_facts`, only for explicit corrections; matching stored facts are removed (normalized exact/substring, statements < 10 chars ignored) and echoed as `affidavitData.retiredFactStatements` so the profile retires them too (`factRetirement.js`).
- **Language mirroring**: reply in the user's language; structured formats unchanged.
- Contested issue or safety risk → recommend a lawyer once, continue.
- **REVIEW completion**: 2–3 sentence summary, the fixed notice "Important: These documents were generated with AI assistance…", then the download/purchase call to action. No first-message disclaimer.
- Every turn re-runs document selection → `requiredDocuments[]`, `selectionReasons[]`.

- Given first matter turn "I want custody of my kids, Travis County" → reply asks exactly one question, for the user's full legal name; phase stays `INTAKE`.
- Given the user writes in Spanish → reply in Spanish; extracted names proper-cased.
- Given stored fact "separated end of February 2024" and "actually it was March 1st" → `superseded_facts` names the February statement, it is absent from `facts`, a fact meaning separation on 2024-03-01 exists, `retiredFactStatements.length = 1`.
- Given "yes, everything is correct" in REVIEW → reply contains the AI notice; `completedPhases` includes `REVIEW`.

---

## 4. Matter interviews (`BaseMatterOrchestrator.js`, `prompts/<matter>/index.js`, `matters/*.yaml`)

Linear `phaseOrder`, resumed from `orchestratorState.currentPhase` (unknown → INTAKE). "Phase complete"
= model set `phase_complete:true` **and** the user's name is captured; `required_fields` are advisory to
the model only (`matters/README.md:133-136`). Conditional phases are skipped by predicate on data
(`skipIf`; YAML `skip_unless_any`/`skip_if_any`, `createOrchestrator.js:18-27`); after the last phase
comes `REVIEW`. State: `{ currentPhase, completedPhases[], phaseHistory[{phase,completedAt}], caseId, stateCode, matterTypeCode }`.
`children` merge by name/dob, other arrays append-dedupe, full names derive from first+last; facts default
to a per-phase category (SAFETY→`safety`, FINANCES→`financial`; YAML `fact_category` overrides). Temp 0.3, 1500 tokens.

| Matter | Phases | Fields gathered |
|---|---|---|
| custody | INTAKE → EXISTING_ORDER (if modification/enforcement) → CHILDREN → HISTORY → SAFETY → PROPOSED_PLAN → EVIDENCE → REVIEW | parties, state/county, `childHomeState`, `children[]`, living arrangement, existing order terms, `safetyConcernsConfirmed`, custody type or enforcement relief, `evidenceConfirmed` |
| child_support | INTAKE → SUPPORT_CHANGES (if modification/enforcement) → CHILDREN → FINANCES → HISTORY → REVIEW | existing order amount/date/court, `children[]`, each parent's monthly income, `paymentHistoryDocumented` |
| dvro | SAFETY_CHECK → INTAKE → VIOLATION_EVENTS (contempt) → RENEWAL_CONTEXT (renewal) → INCIDENTS (new order) → CHILDREN → RELIEF → EVIDENCE → REVIEW | `userIsSafe` first (911 + hotline if in danger), `isContempt`/`isRenewal`, relationship, cohabitation, incidents with weapon/injury flags, `reliefItems[]` |
| paternity | INTAKE → CHILD_DETAILS → ACTION_TYPE → EVIDENCE → REVIEW | `petitionerRole`, child name/dob, mother, alleged father, `paternityAcknowledged`, `actionType` establish/disestablish, relief |
| legal_separation | INTAKE → CHILDREN → FINANCES → AGREEMENT → REVIEW | marriage date, reason, `childrenConfirmed`, `propertyDivisionAgreed`, `isAgreed`, `serviceMethod` |
| annulment | INTAKE → GROUNDS → CHILDREN_AND_PROPERTY → REVIEW | marriage date/place, `annulmentGrounds` (fraud/bigamy/underage/incapacity/force/impotence/incest), `childrenOfMarriage`, `isAgreed` |
| guardianship_minor | INTAKE → PARENTS → CHILD_SITUATION → FINANCES → REVIEW | relationship, child, duration type, parents' names/whereabouts/situation, `isContested`, child needs, `guardianshipType` |
| adoption | INTAKE → BIOLOGICAL_PARENTS → ADOPTEE_BACKGROUND → LEGAL_STATUS → REVIEW | `adoptionType` stepparent/adult/relative, adoptee, bio parents, `consentStatus`, relationship duration, prior proceedings, interstate, home study |
| emancipation | INTAKE → INDEPENDENCE → REASONS → REVIEW | minor's dob, parents, income/source, living situation, self-sufficiency, reason, parental stance |
| name_change (YAML) | INTAKE → BACKGROUND → MINOR_DETAILS (if `is_for_minor`) → NOTICE → REVIEW | current/new name parts, reason, prior names, criminal-history confirmation, pending proceedings, child + other-parent consent, publication waiver + reason enum, indigency |
| small_claims | INTAKE → CLAIM_DETAILS → DEMAND_HISTORY → EVIDENCE → REVIEW | defendant name/address, `claimAmount`, `claimBasis`, `demandSent` |
| civil_harassment | INTAKE → HARASSMENT_HISTORY → CONTACT_ATTEMPTS → RELIEF → EVIDENCE → REVIEW | respondent relationship/address, `wantsTro`, incident dates/count, contact methods, stay-away distance, no-contact |
| debt_defense | INTAKE → DEBT_DETAILS → DEFENSES → COUNTERCLAIMS → REVIEW | plaintiff, case number, service date, answer deadline, claimed amount, `debtType`, `debtRecognized`, defenses, `fdcpaViolations` |
| landlord_tenant | INTAKE → LEASE_DETAILS → DISPUTE_DETAILS → EVIDENCE → REVIEW | `userRole`, property address, `matterType` (eviction/deposit/habitability/wrongful eviction/lease), written lease, rent, tenancy type |
| general_civil | INTAKE → CLAIM_DETAILS → LEGAL_BASIS → EVIDENCE → REVIEW | `claimType`, description, incident date, damages, legal basis, `statuteOpen` |
| probate | INTAKE → DECEDENT_INFO → ESTATE_ASSETS → WILL_AND_HEIRS → REVIEW | `petitionerRole`, decedent name/dob/death/address, `hadWill`, `proceedingType`, heirs, estate value, executor, `heirsAgree`, bond waiver |
| divorce | §5 | — |

- Given custody INTAKE completes with `isModification=false` → `currentPhase='CHILDREN'`.
- Given name_change with `isForMinor=true` → after BACKGROUND the next phase is `MINOR_DETAILS`; falsy → `NOTICE`.
- Given a DVRO user says they are not safe → reply says call 911 and gives the hotline; phase stays `SAFETY_CHECK`.
- Given a CHILDREN turn adding "Liam, 7" with Emma already recorded → `children.length = 2`.
- Given an invalid YAML matter → absent from catalog and triage enum; all others still work.

---

## 5. Divorce interviews (`BaseDivorceOrchestrator.js`, `prompts/<xx>Divorce/index.js`)

**Phases**: US `INTAKE → RESIDENCY → GROUNDS → CHILDREN → PROPERTY → SUPPORT → SERVICE → INDIGENCY → MILITARY → REVIEW`;
Canada omits INDIGENCY and MILITARY. SUPPORT/INDIGENCY are optional and skipped when confirmed (INDIGENCY
only if no waiver requested). Returning users skip phases already satisfied by data (`_phaseAlreadySatisfied`:
RESIDENCY = state+county+months, CHILDREN = `hasMinorChildren===false` or `childrenConfirmed`, …); the
starting phase is inferred (both names → RESIDENCY; +state/county → GROUNDS; +marriage date → CHILDREN).

**Role awareness**: tool signals `who_filed ∈ {me,my_spouse,unknown}` and `served_on_user ∈ {yes,no,unknown}`;
`yes`/`my_spouse` → `role='respondent'`, else petitioner. Petitioner/respondent captions describe *who filed*,
not who is typing; `affiantName`, `monthlyIncome` vs `spouseMonthlyIncome`, and payor/payee names follow the
user's side (`:1092-1180`). Labels are Plaintiff/Defendant for NY, PA, GA, MA, MI, NC, NJ, OH; Canada uses
"Court Location" (NB "Judicial District") and Applicant vocabulary (`:982-996`).

**Jurisdiction rules that change the questions**:
- **TX**: 6-month state + 90-day county (`residency_county_days`); ground must be `insupportability` (never "irreconcilable differences"); fault grounds (cruelty, adultery, abandonment) documented when raised; separation date asked.
- **UT**: 3-month county residency; irreconcilable differences default; "parent-time" vocabulary; 30-day wait. `parent_time_plan ∈ {statutory_minimum, expanded, equal, custom}` is in the shared schema — **UNVERIFIED** that the UT prompt asks for it explicitly.
- **CA**: 6-month state + 3-month county (days); only `irreconcilable_differences`/incurable insanity; "dissolution".
- **NY**: `residency_basis ∈ {both_residents, married_in_ny_1yr, last_lived_together_1yr, grounds_arose_1yr, 2yr_residence}`; `irretrievable_breakdown` needs 6 months; separation date required; "maintenance".
- **FL**: 6-month state, no county rule; "irretrievably broken". **GA**: 6-month bona-fide residency, nonresident may file where respondent lives; 13 §19-5-3 grounds, "irretrievably broken" recommended.
- **ON / AB**: one year ordinarily resident; Divorce Act s.8; **separation gate** — if `separation_date` is < 12 months before today the model must not emit the one-year ground (`breakdown_of_marriage`); omit grounds or record cruelty/adultery (`:162-180`). AB uses Family Property Act vocabulary.

**Children across turns**: `children[]` merges by name (else dob) — the model sends only the child under
discussion; `remove_children[]` deletes; `hasMinorChildren` recomputed from ages only on turns touching the
list; `number_of_children` emitted whenever a count is stated (0 and adult-only included); `children_confirmed` closes the section.

**Extracted each turn**: ~70 structured fields (parties, residency, marriage, grounds, children,
per-party property/debt lists, equalization, prenup, support, service, case number, service date,
whereabouts, itemised income/expenses, military, name restoration, review); `extracted_facts[]` with
optional `numeric_value`/`place_value`/`grounds_value`; `superseded_facts[]`. Lists and breakdowns are
**replace-per-person** (model restates the full list). A post-turn promoter (gpt-5-nano, fail-open)
backfills missing companions on facts tagged whereabouts/children/grounds (`_promoteFactCompanions`).

**Forbidden and hedged values**: `grounds` is a closed jurisdictional set — omit rather than
`other/unknown/unclear/none/n/a/na/not_sure` (profile deletes those, `profile.ts:172`). Hedged whereabouts
never enter `respondent_address`; instead `respondent_address_unknown:true` (schema-required every turn) and a
hedge-stripped `respondent_suspected_location`. Partial dates take the year from context, else the prompt's
TODAY line, plus a fact that the year was assumed. Silence is never a waiver: `spousalSupportRequested=false`
clears the award but never sets `spousalSupportWaived`.

**Confirmation flags** `childrenConfirmed`, `propertyConfirmed`, `spousalSupportConfirmed`, `indigencyConfirmed`,
`militaryStatusConfirmed`, `userConfirmedReview` close sections. MILITARY and INDIGENCY are soft gates: "I'll
check DMDC before I file" → `dmdcSearchPlanned='before_filing'` satisfies; "skip/later" on fee waiver →
`indigencyConfirmed=true`, never re-asked. **Nickname guard**: a nickname for the respondent is recorded
only as a fact; the reply asks for the legal name and the phase does not advance.

- Given ON user "she filed, I was served June 24" with FS-25-… in context → `role='respondent'`, `affiantName` = the user's own name, `serviceDate='2025-06-24'`.
- Given TX user "he moved out, no idea where, maybe Louisiana or Mississippi" → `respondentAddressUnknown=true`, `respondentSuspectedLocation='Louisiana or Mississippi'`, `respondentAddress` empty, a fact with that message as `sourceQuote`.
- Given AB user "we separated 4 months ago" → `groundsForDivorce` absent; reply explains the one-year ground is not yet available / asks about other grounds.
- Given "actually it's 3 kids, I forgot Noah, he's 4" after two recorded → `children.length=3`, `numberOfChildren=3`, the earlier two-children fact retired.
- Given CA user "two adult kids, 24 and 21" → `hasMinorChildren=false`, `numberOfChildren=2`, two child entries aged 24 and 21.
- Given NY user "irretrievable breakdown" → `groundsForDivorce='irretrievable_breakdown'` and a fact with `groundsValue='irretrievable_breakdown'`.
- Given "his name is Slick" → `respondentFirstName` unset, nickname fact recorded, reply asks for Slick's full legal name.

---

## 6. General affidavit interviews (`GeneralAffidavitOrchestrator.js`, `AffidavitTypeRegistry.js`)

Types: general, residency, identity, financial, support, heirship, small estate, domicile, no divorce,
survivorship, lost document, vehicle transfer, no lien. Phases `CLASSIFY → PARTIES → FACTS → REVIEW`:
CLASSIFY skipped when a type is already set, PARTIES when name+state exist, FACTS when facts exist.
PARTIES collects affiant first/last name, address, city, state, zip, filing state code, county. FACTS is
driven by a per-type requirements spec (`services/affidavits/requirements/index.js`: required topics,
structured fields, minimum fact count) and the prompt lists only missing topics. A deterministic checker
gates FACTS both ways: it blocks `phase_complete` while topics are missing and advances when satisfied even
if the model did not flag it (`:206-238`).

- Given `documentType='affidavit_of_residency'`, no name → first phase `PARTIES`, reply asks for the full legal name.
- Given FACTS with "purpose" uncovered and model `phase_complete:true` → phase stays `FACTS`.
- Given all topics covered and `phase_complete:false` → phase advances to `REVIEW`.

---

## 7. Life-story profile around each turn (`lib/api/profile.ts`; `route.ts:562-590, 675-690`)

**Before** the orchestrator runs, empty fields fill from the stored profile: identity + finances always;
spouse/marriage/children/divorce fields only for divorce and family matters (`custody, child_support, dvro,
paternity, legal_separation, annulment, guardianship_minor, adoption, emancipation`, YAML `family_profile:true`);
stored children merge in and stored facts seed an empty fact list; **state/county/residency never hydrate**.
**After** the turn the result merges back (non-empty wins; facts deduped by normalized content, ≤ 300;
retired statements removed; children replaced wholesale in family scope so removals persist) and absent
structured fields are promoted from facts (`respondentAddressUnknown`, `respondentSuspectedLocation`,
`numberOfChildren`, `groundsForDivorce`, `hasProperty/noPropertyConfirmed`, settlement/waiver, AB imputation
flags), with gpt-5-nano rescue calls when companions are still missing. Profile failures never fail the turn.

- Given a returning user with stored name and children, a new small-claims turn hydrates the name but not `children`.
- Given the same user starting a divorce, `children` hydrates and `state` does not.
- Given a turn that retired a statement, the stored profile no longer holds a matching fact.

---

## 8. Semantic judgments currently done by pattern-matching

1. Which country the user is in, from the origin host — `app/api/chat/route.ts:352` (`/\b(\w+)\.discover\.legal\b/`).
2. Whether a document is a divorce (hydration scope) — `route.ts:331` (`docType.includes('divorce')`).
3. Whether a session id belongs to the caller — `app/api/chat/session/[sessionId]/route.ts:24` (`/^chat_(\d{1,17})_(\d+)$/`).
4. Whether the facts say there are no minor children (skips CHILDREN) — `BaseDivorceOrchestrator.js:1769` regex over fact prose.
5. Whether the facts prove the SCRA/DMDC check was done (skips MILITARY) — `:1778-1780` regexes ("not in the military", "checked DMDC" + a year).
6. Whether a fact concerns the respondent's whereabouts — `:1468-1471`, `lib/api/profile.ts:599-602` (`sub.includes('whereabout')`, fixed subcategory names).
7. Whether a fact is a children-count fact — `:1485-1491`, `profile.ts:862-874` (`sub.includes('children')`).
8. Whether a fact states divorce grounds — `:1505-1512`, `profile.ts:1021-1029` (`includes('grounds')` or any `STATUTORY_GROUND_TOKENS` substring).
9. Whether a grounds value is a placeholder rather than a statute slug — `profile.ts:172-174` (`FORBIDDEN_GROUNDS_SENTINELS`).
10. Whether two property/debt items are the same asset — `BaseDivorceOrchestrator.js:512-600`, `profile.ts:235-300` (currency stripping, stopwords, synonym map, token containment).
11. Which stored fact a correction supersedes — `services/agents/factRetirement.js:29-35`, `profile.ts:1385-1389` (normalized exact/substring).
12. Whether two facts are duplicates — `services/agents/FactOrganizer.js:99-101, 127-131` (normalized content equality).
13. Which section a fact belongs to (residency, marriage, children, property, grounds, support, service, indigency, military) — `FactOrganizer.js:85-93` keyword regexes.
14. Whether two children are the same person (name, else dob) — `utils/childrenMerge.js:16-18, 37-70`; whether a child is a minor from a dob string — `:85`.
15. Whether the parties have no property / no debts — `profile.ts:1192-1220` keyword lists over content + sourceQuote.
16. Whether support was mutually waived, child support mediated, or a settlement exists — `profile.ts:1250-1270` (`/waiv/`, `/mediat|cssa/`, subcategory names).
17. Whether the payor is self-employed, under-reports income, or imputation is requested — `profile.ts:1282-1310` (`SELF_EMPLOY_RE`, `UNDERREPORT_RE`, `/impute income…/`).
18. Whether a role token means the user or the spouse when resolving custodian/payor/payee names — `BaseDivorceOrchestrator.js:1300-1345` (`roleToName`); role sanitising `profile.ts:340-345`.
19. Whether a general-affidavit requirement topic is covered — `services/agents/AffidavitRequirementsChecker.js:187-189` (topic keyword substring of category/content/subcategory).
20. Which caption labels apply (Plaintiff/Defendant states, Canadian location label) — `BaseDivorceOrchestrator.js:982-996` hard-coded lists.
21. Whether the model is a reasoning/Responses-only model — `services/llmConfig.js` (`/^gpt-5/`, `/^gpt-5\.6/`).

Hedge stripping, nickname detection, date-year inference, enum mapping and the Canadian separation gate are
deliberately delegated to the model via prompt/schema text rather than code (`extractionQuality.js` rules 17–21,
`BaseDivorceOrchestrator.js:645-647`).
