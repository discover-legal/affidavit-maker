# 02 — Facts and the Life-Story Profile

Functional specification (observable behaviour, not implementation). Sources: `lib/api/profile.ts`, `migrations/015_user_profiles.sql`, `app/api/profile/route.ts`, `app/api/profile/ingest/route.ts`, `components/app/lifeStory.ts`, `components/app/LifeStoryClient.tsx`, `services/agents/FactOrganizer.js`, `services/agents/factRetirement.js`, `services/agents/BaseDivorceOrchestrator.js`, `services/agents/extractionQuality.js`, `utils/childrenMerge.js`, `utils/labeledAmounts.js`, `services/supportDocs/partyIncome.js`, `templates/core/parenting.js`. UNVERIFIED marks items not confirmed by a test or live run.

Notation: **P** = stored profile, **E** = the turn's post-extraction document data plus new facts, **M** = merged profile.

---

## 1. Fact records

### 1.1 What a fact is
One coherent, court-usable, first-person statement plus provenance (`BaseDivorceOrchestrator.js:1395-1428`; `BaseMatterOrchestrator.js:412-435`): `id`; `content` (typos fixed, full names, no pronouns — never a transcription, `extractionQuality.js:38,63`); `category`/`subcategory` (model-assigned tags; category defaults to the phase topic); `sourceQuote` (user's verbatim message, ≤280 chars — the only place raw words live); `confidence` (fixed 0.9); `type` (`fact`; evidence items are `evidence`, `lib/utils/factNormalizer.js`); optional companions `numericValue`, `placeValue` (hedge-stripped), `groundsValue` (canonical slug); `timestamp`. Ingested court-paper facts carry `source` = document kind and `sourceQuote` = `From: <kind>` (`ingest/route.ts:325-336`).

**Required outcome — companions are present whenever a fact carries them**, even if primary extraction omitted them (today: fail-open second pass, `BaseDivorceOrchestrator.js:1453-1690`).
- E fact `{category:'children', content:'We have two adult children, ages 24 and 21'}` → stored `numericValue = 2`.
- E fact `{subcategory:'respondent_whereabouts', sourceQuote:'no idea, possibly Louisiana or Mississippi'}` → `placeValue = 'Louisiana or Mississippi'` (hedge removed, disjunction kept).
- E fact `{category:'evidence', subcategory:'cruel_treatment'}` on a GA case → `groundsValue = 'cruel_treatment'`.

### 1.2 Ordering and per-turn merge (`FactOrganizer.js:118-160`)
Facts have a user-rearrangeable order that a turn never disturbs. A new fact duplicating an existing one (same `id`, else same whitespace/case-normalized `content`) updates it in place; a genuinely new fact is inserted after the last fact of its topical section (residency → marriage → children → property → grounds → support → service → indigency → military → general), else appended.
- [A(residency), B(children)] + C(residency) → [A, C, B].
- [A, B] + B′ (B's id, corrected content) → [A, B′].

### 1.3 Deduplication
Document: by id or normalized content (1.2). Profile: by normalized content, first copy wins, ≤300 facts (oldest dropped) (`profile.ts:1391-1410`). Differently-worded near-duplicates are the extractor's job (`extractionQuality.js:41`); the store never fuzzy-matches.
- P facts [{content:'I was married on 2019-05-04'}] + E [{content:'i was  married on 2019-05-04'}] → one fact in M.

### 1.4 Retirement by correction (`factRetirement.js`; `profile.ts:1380-1404`)
When the user explicitly corrects an earlier statement, the superseded stored facts are removed, not kept beside the correction. *Which* statements were corrected is a language judgment by the extractor (`superseded_facts`, `extractionQuality.js:76-77`); the store only applies it: unmatched statements retire nothing; statements under 10 normalized characters are ignored; ≤3 retirements per turn; a match is exact or containment either way on normalized text; a retired statement cannot re-enter from the same turn's sweep; the list is rewritten every turn so stale corrections never re-apply.
- Facts [F1 'We separated at the end of February 2024', F2 'We married in Provo'], correction "wait, actually it was March 1", superseded = [F1's text] → retired {F1}, kept {F2}, March fact stored.
- superseded = ['yes'] → retired set empty.
- superseded naming five stored facts → exactly the first 3 matches retired.

### 1.5 Sanitization
Interview facts require `content` and `category`; empty companions are dropped. Ingest: blank content dropped, ≤25 facts per document. Profile: non-object entries ignored; explicit edits truncate strings to 500 chars. UNVERIFIED: store-time rejection of placeholder content ("[NAME]") — the `PLACEHOLDER_DENYLIST` named in CLAUDE.md is outside this scope's files.

---

## 2. The life-story profile

### 2.1 What is stored (`migrations/015`; `profile.ts:70-157`)
One row per user: `profile` (camelCase structured fields) + `facts`. Whitelisted groups: **General** — names, `role` (`petitioner`|`respondent` only, else dropped, `profile.ts:340-345`), `monthlyIncome` (user's own), `spouseMonthlyIncome`, `monthlyExpenses`, itemized `incomeBreakdown`/`expenseBreakdown`, assets description, dependents, fee-waiver request. **Family** — spouse/caption names, marriage/separation, children, custody/support, grounds, spousal-support flags, property/debt flags and per-party lists, settlement/mediation, prenup, equalization, service method/date, protective order, respondent address/unknown/suspected location, military. **Jurisdiction** — state, county, residency durations/basis: stored and displayed, never hydrated. Plus `keyEvents` (≤40 dated court events, `profile.ts:1449-1467`). Per-document state (document type, case number, court, payment, orchestrator state) is never stored.

### 2.2 Hydration into a new session/document (`profile.ts:464-500`; `chat/route.ts:319-333, 556-573`)
Each turn starts by gap-filling the document from P. The document's own value always wins. Scope is `family` for divorce documents and family matter codes (custody, child_support, dvro, paternity, legal_separation, annulment, guardianship_minor, adoption, emancipation, or YAML `family_profile: true`), else `general`. General scope hydrates General fields only; family scope also hydrates Family fields, merges stored children into the document's by identity, sets `hasMinorChildren` if absent, and seeds facts only when the document has none. Jurisdiction never hydrates. A failed profile read never fails the turn.
- P `{affiantName:'Kathleen O'Brien-Hatch', spouseName:'Mark Hatch', state:'UT', monthlyIncome:3400}`, new small-claims doc → has `affiantName`, `monthlyIncome`; lacks `spouseName`, `state`. Same P, new divorce doc → has `spouseName`; still lacks `state`.
- Doc `{affiantName:'Kate Hatch'}` → stays `'Kate Hatch'`.
- P children [Emma (2015-04-02)], doc children [Emma Smith, age 10] → one child with name, DOB and age.

### 2.3 Merge-back after a turn (`profile.ts:512-1419`)
1. **Empty never erases**: absent/null/blank/empty-array in E leaves P intact. 2. Scalars overwrite when present. 3. **Itemized money lists replace per person** (`labeledAmounts.js`): a turn mentioning person X replaces all of X's stored entries; unmentioned persons keep theirs; person-less entries share one bucket; repeated (person,label) within a turn keeps the latest; ≤20 items; stored exact duplicates are scrubbed every turn. 4. **Per-party property/debt lists replace per field** (`profile.ts:535-542`); same-turn label variants collapse to the longer wording; "Separate property:" prefixes and negative-equity phrasing survive. 5. **Children merge by identity** (`childrenMerge.js`): normalized name → unambiguous first-name prefix → DOB → age (anonymous entries only); matches update field-by-field, empties ignored, a shorter name never replaces a longer; new children append (≤25); DOB aliases all stamped. In family scope the turn's list is authoritative (`replaceChildren`) so removals propagate. 6. Role-aware totals recomputed (§3.1). 7. Party identity reconciled (§2.6). 8. Facts per §1.
- P `{monthlyIncome:3400}` + E `{monthlyIncome:''}` → M.monthlyIncome = 3400.
- P incomeBreakdown [{person:'petitioner', label:'Katie – dental office wages', amount:3400}] + E [{person:'petitioner', label:'Kathleen – wages, dental office', amount:3400}] → exactly one petitioner entry, total 3400.
- P children [Emma Smith (2015-04-02), Liam Smith] + E [{name:'Emma', age:11}] → 2 children; Emma keeps 'Emma Smith', gains age 11.

### 2.4 Fact-to-structured-field promotion (required outcomes)
When a structured field is *truly absent* (undefined/null — an explicit `false` or value is authoritative), M must reflect what the facts state. Mechanisms today are listed in §4.

| Field | Required outcome |
|---|---|
| `respondentAddressUnknown` | true when a fact states the respondent's whereabouts are unknown |
| `respondentSuspectedLocation` | the hedge-stripped place from a whereabouts fact; if the flag is true and no whereabouts fact exists, the place named anywhere in the facts as where the respondent may be (never the petitioner's home or marriage place) |
| `numberOfChildren` | the count a children fact states (adults count; "no children" → 0); "no minor children" with no list and no children fact → 0 |
| `hasMinorChildren` | false when the count resolves to 0 and the flag is absent |
| `groundsForDivorce` | the slug a grounds fact carries; a stored hedge value (`other`, `unknown`, `unclear`, `none`, `n/a`, `na`, `not_sure`, any case) counts as absent and is never re-stored (`profile.ts:172-174, 1044-1048, 1163`) |
| `hasProperty=false`, `noPropertyConfirmed=true` | when a fact affirmatively states there is no property/home/assets |
| `hasDebts=false`, `noDebtsConfirmed=true` | when a fact affirmatively states there are no debts |
| `spousalSupportWaived=true` | when a spousal-support fact records a mutual waiver |
| `mediatedChildSupport=true` | when a children/support fact records mediation or CSSA |
| `settlementAgreement=true` | when a fact is tagged uncontested/settlement/mediation |
| `selfEmployedPayor`, `incomeUnderreporting`, `childSupportImputationRequested` | when facts state self-employment, under-reporting, or a request to impute income |
| `case_number` | captured directly by the extractor (CLAUDE.md); UNVERIFIED — no fact-based promotion found in `profile.ts` |

Silence is never a waiver: `spousalSupportRequested` false/absent must not yield `spousalSupportWaived=true` (`BaseDivorceOrchestrator.js:1260-1276`).
- P `{}` + E facts [{subcategory:'respondent_whereabouts', placeValue:'Louisiana or Mississippi'}], no flag → M.respondentAddressUnknown = true, M.respondentSuspectedLocation = 'Louisiana or Mississippi'. With E `{respondentAddressUnknown:false}` → stays false.
- P `{groundsForDivorce:'Other'}` + E facts [{category:'grounds', groundsValue:'cruel_treatment'}] → 'cruel_treatment'; with no grounds fact → field absent.
- E `{hasMinorChildren:false}`, no children, no children fact → M.numberOfChildren = 0; with an adult-children fact lacking a count → the count is recovered (2), not forced to 0.
- E facts [{content:'We own no real estate and have no retirement accounts'}], `hasProperty` absent → M.hasProperty = false, M.noPropertyConfirmed = true.

### 2.5 Rescue behaviour
If after promotion `respondentSuspectedLocation`, `numberOfChildren` or `groundsForDivorce` is still missing while a fact of that kind exists, the value must be recovered from the fact's content and verbatim quote (jurisdiction-aware for grounds): never invented, "absent" when the text has none, hedge slugs rejected, fail-open (recovery failure never fails the turn or save).
- Fact `{subcategory:'adult_children', content:'two adult children, ages 24 and 21'}`, no count → M.numberOfChildren = 2 (never 45 or 2421).
- TX fact `{category:'grounds', content:'He hurt me physically'}` → M.groundsForDivorce = TX fault slug (`cruelty`), not `other`.
- Whereabouts fact naming no place → M.respondentSuspectedLocation absent.

### 2.6 Role-aware identity and naming (`profile.ts:377-436, 1332-1348`; `lifeStory.ts:357-394`)
Canonical trio: `affiantName` (user), `spouseName` (role-independent), `role`. Caption fields (`petitioner*`/`respondent*`) are recomputed from the trio after every write, read under the role they were written with. Missing role = petitioner side; `applicant`/`plaintiff`/`filer` map to petitioner and `defendant` to respondent (`parenting.js:100-131`; `BaseDivorceOrchestrator.js:1307-1319`). An explicit `spouseName` is trusted verbatim (spouses may share a name); a caption-derived spouse guess equal to the user's own name is rejected as a stale caption. A blank `spouseName` in an explicit edit clears the spouse.
- P `{affiantName:'Marcus Bell', petitionerName:'Marcus Bell', respondentName:'Dana Bell'}` + E `{role:'respondent'}` → M.spouseName = 'Dana Bell', M.petitionerName = 'Dana Bell', M.respondentName = 'Marcus Bell', M.affiantName unchanged.
- P `{affiantName:'Taylor Lautner'}` + E `{spouseName:'Taylor Lautner'}` → M.spouseName = 'Taylor Lautner'; but E `{respondentName:'Taylor Lautner'}` alone → spouse unchanged.

**Name casing** belongs to the model, never a deterministic transform (`extractionQuality.js:33`; `profile.test.ts:557-604`). Stores save names as given; the story-page edit path asks a normalizer for proper casing with count-in/count-out validation and a 5 s budget, else stores as typed (`profile/route.ts:56-127`). Internal capitals (McDonald, van der Berg) and compound surnames survive; captions uppercase while preserving them (`templates/core/nameCase.js`). A nickname is never persisted as a legal name — the interview asks for the full legal name and records the nickname as a fact only (`BaseDivorceOrchestrator.js:645-647`).
- Edit `{affiantName:'mike smith', spouseName:'ellis jane smith son-wyatt'}` → 'Mike Smith' / 'Ellis Jane Smith Son-Wyatt'. Normalizer returns 1 name for 2 inputs → both stored as typed.

### 2.7 Court-paper ingestion (`ingest/route.ts`)
Input: pasted text (40–20,000 chars) or one PNG/JPEG photo (≤8 MB decoded, ≤10,000 px/side, ≤25 MP, content-sniffed; OCR must yield ≥40 chars), optional label ≤120 chars; 10 requests/15 min. Outcome: explicitly dated events join `keyEvents` (deduped by label+date, source = document kind); ≤25 third-person statements join facts marked as from that document; clearly printed caption names merge via the standard path (never overwriting `affiantName`); only an unambiguous "served on me" flips `role` to respondent — nothing infers petitioner. Response: `documentKind`, `eventsAdded`, `factsAdded`. Undated/unstated items are never added.
- Pasted petition with "Filed: 2025-06-17", "Answer due: 2025-07-17", label "papers I got served" → keyEvents gain both, source = document kind; M.role = 'respondent'; each fact's provenance names that document.
- Same paper ingested twice → keyEvents count unchanged. Proof the *other* side was served → role unchanged.

### 2.8 Explicit edits, erase, and the /profile page
`PATCH /api/profile` sets whitelisted fields verbatim: empty clears, `children` replaces, `keyEvents` replaces (`profile.ts:1475-1520`). `DELETE /api/profile` erases the row; the next read is an empty profile (`profile.ts:1439-1441`). Both per-user (RLS).

The page (`LifeStoryClient.tsx`) renders from P alone: progress meter over nine core slots; timeline of marriage, births, separation and court events; numbered recitals in the user's role (identity/marriage/home always, money and safety only once known; income framed "you bring in" vs "your household", §3.1); family strip; ledger (grounds, custody and child support only when minors may be on record, spousal support as "Waived (mutual)" / "Requested" / "Not requested", property, service, military, protective order, fee waiver) with glossary tooltips; advisor flags (contested custody/property, safety); fee-waiver hint from the user's own income vs 150 % of federal poverty guidelines; next steps fetched from `/api/procedure/<state>`; "Papers you can create" (answer only for respondents, default/finalization only for petitioners, worksheet only with children); fact chapters by category with provenance ("You said: …" / "From: <document>"); "Earlier notes" for jurisdiction facts mentioning a state other than the current one; fix-story and ingest panels; confirmed erase. Bilingual en/es.

---

## 3. Integrity invariants

### 3.1 Income integrity survives label drift (commits 7cff6b4, 1596bea)
**`monthlyIncome` is always the user's own income, `spouseMonthlyIncome` the spouse's, never a household total; restating an income under a different label never doubles it.** Mechanisms: replace-per-person itemization (§2.3); totals recomputed from itemization with untagged entries counted as the user's (`profile.ts:1317-1331`; orchestrator `1157-1194`); role-aware extraction; sworn documents derive per-party income with explicit per-person fields > itemized sums > scalars, a scalar equal to both sides' sums flagged as household, and an unattributable amount rendered as a placeholder rather than a wrong number (`partyIncome.js:8-44`); the page frames a lone scalar as household (`lifeStory.ts:460-472`).
- P `{monthlyIncome:8600}` + E incomeBreakdown [{petitioner, wages, 3400}, {respondent, wages, 5200}] → M.monthlyIncome = 3400, M.spouseMonthlyIncome = 5200; with `role:'respondent'` → M.monthlyIncome = 5200.
- P `{monthlyIncome:8600}` only → the page states the household brings in $8,600, not the user.

### 3.2 Truthful parent-time (`parenting.js`; `parentTimeNaming.test.js`)
**Parent-time is ordered for the non-residential parent, by full legal caption name, never guessed.** A stored residence value resolves by role token, exact name, or unique surname; shared surname or unknown → neutral wording, no name; a go-by never appears in an order.
- primaryResidence 'Katie O'Brien-Hatch', captions Kathleen O'Brien-Hatch / Mark Hatch → parent-time names 'Mark Hatch'. Both parties surnamed Hatch, residence 'Katie Hatch' → neutral, no name.

### 3.3 Spouse identity (§2.6; `profile.test.ts:398-555`)
**A role flip never makes the user their own spouse; a corrected spouse name outranks the stored one.**
- Respondent round-trip in §2.6 → page "Your name is" reads the user, spouse reads the filer.
- P `{affiantName:'A', spouseName:'B'}` + E `{respondentName:'B. Corrected'}` (petitioner profile) → M.spouseName = 'B. Corrected'.

---

## 4. Semantic judgments currently done by pattern-matching

Judgment → mechanism, with location. A rebuild may use model judgments or structured tags but must reproduce §1–3 outcomes.

1. **Fact says the respondent's whereabouts are unknown** → subcategory/category contains `whereabout`, or equals `respondent_address_unknown`, `residence_unknown`, `respondent_location` (`profile.ts:595-603`; `BaseDivorceOrchestrator.js:1465-1472`).
2. **Fact states a count of children** → category `children`, or subcategory in {children, adult_children, minor_children}, or contains plural `children` (excludes `child_support`) (`profile.ts:859-876`; orchestrator `1477-1494`).
3. **Fact narrates grounds** → category/subcategory equals/contains `grounds`, or subcategory contains a token from {cruel_treatment, cruelty, adultery, abandonment, desertion, insupportability, irretrievable_breakdown, irreconcilable_differences, felony, conviction, imprisonment, mental_incapacity, mental_confinement, separation_agreement, separation_judgment, breakdown_of_marriage} (`profile.ts:185-202, 1018-1030`; orchestrator `1502-1513`).
4. **Grounds value is a hedge, not a ground** → lowercase membership in {other, unknown, unclear, none, n/a, na, not_sure} (`profile.ts:172-174, 1044-1048, 1079-1085, 1163`).
5. **Leading hedge words removed from a suspected location** → hedge list in prompt text (`extractionQuality.js:50`; orchestrator `292, 1561-1566`; `profile.ts:669, 794`); TX petition additionally strips `^(possibly|maybe|perhaps|probably|apparently|allegedly|reportedly|supposedly)` (`templates/states/texas/DivorcePetitionTemplate.js:13-22`).
6. **User affirmatively has no property / no debts** → substring hit over content+quote+tags of {no property, no house, no assets, no real estate, no retirement, no home, no marital/community/family property} / {no debts, no debt, no liabilities, no marital/community/family debt} (`profile.ts:1192-1227`). "no debt-free assets" would false-positive — UNVERIFIED in tests.
7. **Spousal support mutually waived** → subcategory `mutual_waiver` under a support category, or category `spousal_support` with content `/waiv/` (`profile.ts:1251-1257`).
8. **Child support mediated/CSSA** → children/support tag + content `/mediat|cssa/` (`profile.ts:1258-1264`).
9. **A settlement exists** → subcategory in {uncontested_agreement, settlement_agreement, settlement, mediation} (`profile.ts:1265-1271`).
10. **Self-employed / under-reporting / imputation requested** → `SELF_EMPLOY_RE`, `UNDERREPORT_RE`, `/impute income|imputation of income|impute\s+.+income/`, subcategory set {income_imputation, income_imputation_request, imputation, income_underreporting} (`profile.ts:1282-1311`).
11. **Two income entries are the same item** → exact (person, normalized label); label drift handled by replace-per-person instead (`labeledAmounts.js:29-35, 66-81`; `profile.ts:323-337`).
12. **Two property/debt entries are the same asset** → lowercase, strip amounts/punctuation/stopwords, synonyms (house/residence/dwelling/property→home; car/truck/suv/auto→vehicle), then equality, containment or ≥3-token subset (`profile.ts:235-313`; orchestrator `527-600`).
13. **Two children are the same person** → normalized name, unambiguous first-name prefix, DOB, or (anonymous only) age (`childrenMerge.js:39-69`).
14. **A stored statement is the one corrected** → normalized exact/containment, ≥10 chars, ≤3/turn (`factRetirement.js:24-33, 45-49`).
15. **Which section a fact belongs to** → category table, else content keyword regexes (`reside|married|child|property|insupportab|support|service|indigent|military`) (`FactOrganizer.js:24-99`).
16. **Fact is about a jurisdiction the user moved past** → category in {residency, jurisdiction, court, case_number, parties, general, filing} and content+quote naming a state by full name, curated city/county hint, or uppercase two-letter code other than the current state (`lifeStory.ts:112-136, 1377-1445`).
17. **Residence/custodian value names which party** → role tokens (petitioner/applicant/filer/respondent), exact name, unique surname (`parenting.js:100-131`); `petitioner|plaintiff|respondent|defendant` → names (`BaseDivorceOrchestrator.js:1307-1319`).
18. **Own vs spouse income entry** → `person` tag equals user's role or is empty (`profile.ts:1321-1326`; `lifeStory.ts:425-439`; `partyIncome.js`).
19. **Custody/property is contested** → value equals `contested` (`lifeStory.ts:1288-1293`).
20. **Internal capitals survive uppercase captions** → Mc/Mac/O'/Di/De/La/Le prefixes and a lowercase-particle list (`templates/core/nameCase.js:33-37`).
21. **Raw address is itself a hedge** → petition template hedge detection on a stored `respondent_address` (`templates/core/BaseDivorcePetitionTemplate.js:690-714`; wording UNVERIFIED); the sworn-vs-suspected split is otherwise a model judgment (`extractionQuality.js:48`).
22. **Name is a nickname** → model-only (orchestrator `645-647`); no deterministic check.
23. **User is the respondent** → ingest enum `served_on_user === 'yes'` (`ingest/route.ts:316-318`); interview `served_on_user='yes'` or `who_filed='my_spouse'` (orchestrator `1101-1114`).
