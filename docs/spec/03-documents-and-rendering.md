# 03 — Documents and rendering

Functional spec (observable behaviour, not implementation) for how drafts are
selected, composed and rendered. Cites the current code so a rebuild can
verify parity. Items marked UNVERIFIED were not confirmed end-to-end.

Conventions used in acceptance examples: **D** = case data (profile +
editor content), **J** = jurisdiction code, **R** = role. "Blank-with-note"
means a visible underscore fill-in followed by a parenthetical beginning
`(Draft — …)`. Section presence/absence and field values are the assertable
surface; prose wording is not.

---

## 1. Document selection

### 1.1 Interview-time selection (what a case "needs")

**Statement.** Given the collected interview data, the state and a practice
area, the system returns an ordered list of required document types plus a
plain-English reason per document. Handlers are keyed `STATE:practiceArea`;
a `*:practiceArea` wildcard is the fallback; anything else yields a single
generic `affidavit` (`services/agents/DocumentSelectionAgent.js:948-962`,
`:846-854`).

**Inputs.** `data.state` (defaults to TX when absent), `practiceArea`
(default `family`), and flags `children[]`, `serviceMethod`
(`waiver` | other truthy | unset), `respondentMilitaryStatus`,
`indigencyRequested`, `spousalSupportRequested`.

**Outcome.** `{ requiredDocuments: string[], selectionReasons: {} }`.

Rules with dedicated handlers (TX, AZ, CA, FL, IL, NY, UT family) share the
same shape: petition + decree always; `waiver_of_service` (+ `prove_up_affidavit`
in TX/UT) when `serviceMethod === 'waiver'`; `cert_last_known_address` +
`military_status_affidavit` when service is any other method; military
affidavit also on the waiver path unless status is affirmatively
`not_military` (`:74-76`); `indigency_affidavit` when
`indigencyRequested === true`; `parenting_plan` when `children.length > 0`
(AZ, UT). CA uses `petition_dissolution`/`judgment_dissolution` and adds
`child_custody_order` + `child_support_order` for children and
`spousal_support_order` when support requested (`:177-221`).

Acceptance:
- D = {state: TX, serviceMethod: 'waiver', respondentMilitaryStatus: 'not_military'} → documents = [divorce_petition, divorce_decree, waiver_of_service, prove_up_affidavit].
- D = {state: UT, children: [1 child], serviceMethod: 'personal', indigencyRequested: true} → [divorce_petition, divorce_decree, parenting_plan, cert_last_known_address, military_status_affidavit, indigency_affidavit].
- D = {state: ON, practiceArea: family} → [affidavit] (no ON handler; wildcard `*:family` → default). UNVERIFIED whether ON divorce orchestrators bypass this agent.
- D = {state: GA, practiceArea: 'custody'} → the `*:custody` wildcard set (`:404`).

### 1.2 Render-time resolution and role-aware packets

**Statement.** A saved document has one `document_type`; the umbrella
`divorce_package` is resolved to a concrete document via
`activeSubDocument`, defaulting by role (`lib/api/documentStructure.ts:174-203`).
Aliases collapse: `petition|petition_dissolution → divorce_petition`;
`decree|judgment_dissolution|final_judgment|proposed_judgment → divorce_decree`;
`response|answer_of_divorce → divorce_response` (`:128-150`). Anything
ending in `_affidavit` (not a support kind) is the generic affidavit path.

**Role normalisation.** `respondent|defendant → respondent`; everything else
(petitioner, applicant, plaintiff, missing) → petitioner (`:264-269`).

**Packet expansion** (`PACKAGE_SUB_DOCUMENTS_BY_ROLE`, `:230-256`):
petitioner `divorce_package → [divorce_petition]`; respondent
`divorce_package → [divorce_response]`. Decrees are never bundled in an
initiating or responsive packet.

**Reference marking.** A respondent generating a `divorce_decree` or a
`divorce_petition` gets a structure whose `metadata.renderContext =
'reference'` and whose header is prefixed with a REFERENCE — NOT FOR FILING
banner (`:333-372`).

**Entitlement binding.** A saved single-type row (`divorce_petition`,
`divorce_decree`, `divorce_response`) may only render that type; an
`affidavit` row may not render a divorce doc; support kinds are exempt
(`assertGenerationTypeAllowed`, `:294-330`).

Acceptance:
- J = FL, R = respondent, saved type `divorce_package`, no `activeSubDocument` → resolved type `divorce_response`; packet set = [divorce_response].
- J = ON, R = applicant → normalised to petitioner; packet = [divorce_petition]; the packet cover labels the filer "Applicant" (`app/api/documents/packet/route.ts` CANADIAN_JURISDICTIONS block).
- R = respondent requests `divorce_decree` standalone → document renders with `renderContext = 'reference'` and the header carries the reference banner.
- Saved row type `divorce_petition`, request `activeSubDocument = divorce_decree` → ValidationError ("does not match the saved document type").
- Saved row type `affidavit`, request `financial_declaration` → allowed (support kinds bypass binding).

### 1.3 Support-document availability

`services/supportDocs/index.js` is the registry: `lawyer_handoff` for every
state; `answer` for FL, GA, NY, CA, ON, AB, TX, UT; TX adds
`statement_of_inability` (aliased as `indigency_affidavit`) and
`financial_declaration`; UT adds `acceptance_of_service`,
`certificate_of_service`, `financial_declaration`, `default_package`,
`child_support_worksheet`, `fee_waiver_motion`, `finalization_prep`.
`GET /api/documents/support?state=X` lists kinds with EN/ES titles and
descriptions (`:236-248`). Requesting a kind the state lacks → `null`
builder → 400 "not yet available" (`documentStructure.ts:400-417`; support
route). `SUPPORT_DOC_KINDS` in `documentStructure.ts:57-73` is deliberately
wider than the registry so per-tab downloads for unavailable kinds return a
truthful 400 rather than a wrong document.

Acceptance: J = UT list → 9 kinds incl. lawyer_handoff; J = ON list →
[answer, lawyer_handoff]; J = BC, kind `answer` → 400.

---

## 2. Composition by document family

All families emit a `{ sections, metadata.documentTitle, fullText,
htmlContent }` structure; `sections` keys are the assertable unit.

### 2.1 Affidavit (`templates/core/BaseAffidavitTemplate.js:192-268`)

Sections in order: `header` (STATE OF X), `venue` (COUNTY OF Y, only when a
county is present), optional `caseCaption`, `title`, `introduction`
("I, {name}[, residing at …], being duly sworn, depose and state…"),
`facts.items` where item 1 is the competency statement and the remainder
are the user's facts, `conclusion`, `perjuryStatement` (state-specific,
may be null), `signatureBlock` (title "Affiant"), `notaryBlock`
(state jurat, from `metadata.json.affidavitJurat`), `footer`. County input
"Salt Lake County" is normalised so "County" is never doubled
(`templates/core/countyName.js`). Canadian affidavits render "PROVINCE OF X"
and no county line (`templates/core/terminology.js:106-115`).

Acceptance: J = TX, D = {affiantName, county: 'Harris County'} → venue =
"COUNTY OF HARRIS"; notaryBlock contains the "BEFORE ME, the undersigned
authority" jurat (metadata `affidavitJurat`); perjuryStatement absent
(`features.perjuryStatement=false`). J = ON → header "PROVINCE OF ONTARIO",
venue absent, jurat names "A Commissioner for Taking Oaths".

### 2.2 Divorce petition / application / statement of claim / complaint

Base: `templates/core/BaseDivorcePetitionTemplate.js:326-441`. Sections:
`draftBanner`, `filerBlock`, `header`, `venue`, `caseCaption`, `title`,
numbered `parties`, `jurisdiction`, `marriageInfo`, `grounds`,
`childrenInfo`, `propertyInfo` (property + debts), optional
`contestedIssues` (jurisdiction splice-in), `reliefRequested`,
`verification`, `signatureBlock`, `footer`. Paragraph numbers thread
across sections.

Caption: exactly one court identification. When the caption text already
names the court, the separate header/venue lines are suppressed
(`templates/core/captionDedupe.js`). Structured captions render a
two-column block (parties left; file number + judge right) in the PDF
(`services/pdfService.js:749-773`). Case-number label per jurisdiction via
`getCaseNumberLabel()`; party labels via `this.terminology`.

| J | Court line / label | Filer / responder | Notable |
|---|---|---|---|
| TX | "CAUSE NO." (`texas/DivorcePetitionTemplate.js:222`) | Petitioner / Respondent | §6.002 fault + §6.001 alternative; alt-service caveat |
| UT | "Case No." + "Judge ____" right column (`supportDocs/utah.js:139-166`) | Petitioner / Respondent | District Court by county |
| CA | "In re Marriage of <surnames>" caption; FL-100 (`california/DivorcePetitionTemplate.js:112-134`) | Petitioner / Respondent | §2320 6-mo/3-mo residency; §4320/4335/4330 election |
| NY | "Index No.:" (`newyork/DivorcePetitionTemplate.js:149`) | Plaintiff / Defendant | VERIFIED COMPLAINT; DRL §230 |
| FL | "IN THE CIRCUIT COURT OF THE STATE OF FLORIDA" + Nth Judicial Circuit by county (`florida/…:143,171`) | Petitioner / Respondent | year-only marriage date renders "in 2019" |
| GA | Superior Court; Plaintiff / Defendant | Plaintiff / Defendant | 13 O.C.G.A. §19-5-3 grounds via `groundsResolver.js` |
| ON | "Court File No." (`ontario/…:112`); "BETWEEN:" block, Form 8 | Applicant / Respondent | s.16.1 decision-making vocabulary |
| AB | "COURT OF KING'S BENCH OF ALBERTA — JUDICIAL CENTRE OF X" (`alberta/…:124`); Action No. | Plaintiff / Defendant | Statement of Claim for Divorce |
| ENG | "Case No."; "In the Family Court at X" (`england/…:102-135`) | Applicant / Respondent | irretrievable breakdown only; A4; statement of truth, no notary |

Verification: default "I, {name}, {filerLabel}, declare under penalty of
perjury…" (`:1549-1571`); jurisdictions override (e.g. Ontario/Alberta
affirmations before a commissioner). Signature block title is
`{filerLabel}, {selfRepresentedLabel}` — "Pro Se" (US default) vs
"Self-Represented" (Canadian overrides).

Acceptance:
- J = TX, D.groundsForDivorce = 'cruelty' → `grounds.items` contains one paragraph pleading cruel treatment under §6.002 as the primary ground and a second paragraph (type `grounds_alternative`) pleading §6.001 insupportability in the alternative (`texas/…:474-493`). With `skipInsupportabilityAlt === true` the second paragraph is absent.
- J = ON, D = {} → caption's file-number label is "Court File No."; parties labelled Applicant/Respondent; signatureBlock title ends "Self-Represented".
- J = AB, D.county = 'Calgary' → header names "JUDICIAL CENTRE OF CALGARY"; no "COUNTY OF" line.
- J = CA, D.children all adults → childrenInfo pleads that adult children exist and no custody/support orders are requested (`california/…:478-486`).

### 2.3 Decree / judgment / order (`templates/core/BaseDivorceDecreeTemplate.js:255-300`)

Sections: `draftBanner`, `header`, `venue`, `caseCaption`, `title`,
`appearances`, `jurisdiction`, `dissolution` ("IT IS ORDERED AND DECREED …
dissolved" in US base; Ontario emits "IT IS ORDERED"), `propertyDivision`,
`debtAllocation`, `childCustody`, `childSupport`, `spousalSupport`
(null when outcome `none`), `nameChange`, `finalOrders`, `judgmentBlock`,
`signatureBlock`, `footer`. Spousal outcome is decided by
`templates/core/spousalSupport.js:34-88`: `award` (awarded flag, or
requested + amount), `reserve` (requested, no amount), `waive`
(`spousalSupportWaived === true` or `spousalSupportAgreed === true`),
else `none`.

Acceptance:
- D = {requestSpousalSupport: true, spousalSupportAmount: 1800} → spousalSupport section present with an award order naming payor/payee and $1800.
- D = {spousalSupportRequested: false} and no waiver flag → spousalSupport section absent (never a waiver).
- D = {spousalSupportRequested: true} no amount → order reserves jurisdiction.
- R = respondent → decree carries reference banner + `metadata.renderContext = 'reference'`.

### 2.4 Answer / Response / Statement of Defence

`services/supportDocs/BaseAnswerTemplate.js` factory; per-jurisdiction
configs in `floridaAnswer.js`, `georgiaAnswer.js`, `newyorkAnswer.js`,
`texasAnswer.js`, `californiaAnswer.js`, `ontarioAnswer.js`,
`albertaAnswer.js`, `utahAnswer.js`. Output uses the affidavit shape
(`documentType: 'affidavit'`) so the PDF routes it generically.

Order of `facts.items` (`:838-1100`): GENERAL DENIAL header → per-paragraph
responses (user-classified `answerPositions` groupings if supplied, else the
10-topic scaffold `STANDARD_DIVORCE_SCAFFOLD` `:369-410`, each line
"ADMITS / DENIES / IS WITHOUT KNOWLEDGE … (mark one)" with blank paragraph
numbers) → AFFIRMATIVE DEFENSES (only when seeded) → COUNTER-PETITION
OFFER (cites `config.counterPetitionForm`) → optional WHEREFORE
(`config.answerWherefore`) → user requests → COUNTERCLAIM (only when
`includeCounterclaim`) → certificate of service → verification/signature
(`signatureStyle` `unsworn` default | `notary`).

Pre-admission: scaffold lines are replaced by sworn ADMITS lines when
schema-typed facts support them (state present → jurisdiction; residency
fact or ≥6 months → residency; etc.) (`preAdmitScaffoldMap`, `:467-597`);
`config.suppressPreAdmit` disables.

Jurisdiction variants: FL — three prenup defenses (EXECUTION / INDEPENDENT
COUNSEL / BAR ON INCONSISTENT RELIEF) auto-render from `prenupSigned` or a
prenup fact subcategory, WHEREFORE closing, Form 12.903(b) offer, §92.525
unsworn declaration (`floridaAnswer.js:63-140`). NY/GA/AB —
Plaintiff/Defendant labels. ON — Form 10 with PART A / PART B / PART C
headings rendered as `form10_header` items outside the numbering,
"AGREES / DOES NOT AGREE / HAS NO KNOWLEDGE" wording, Part C claim
template pre-populated from custody facts, "Court File No." header
(`ontarioAnswer.js:43-115`). AB — Statement of Defence, "JUDICIAL CENTRE
OF" header, notary header PROVINCE OF ALBERTA (`albertaAnswer.js:20-64`).
Canadian outputs pass through `canadianizeStructure` (§4).

Acceptance:
- J = FL, D.prenupSigned = true → AFFIRMATIVE DEFENSES section present with exactly three prenup defense items; a WHEREFORE item present.
- J = ON, D = {} → items include PART A, PART B, PART C headers of type `form10_header`; no item contains a "Counter-Petition" reference (rewritten to "Answer with Claim"); header line uses "Court File No.".
- J = NY, no `answerPositions` → 10 scaffold lines each marked as requiring the user to choose; none is auto-denied or auto-admitted beyond pre-admitted facts.
- Any J, `includeCounterclaim` unset → COUNTERCLAIM section absent.

### 2.5 Supporting documents

Sworn packet sub-docs from `services/documents/DivorceDocumentGenerator.js:340-401`
(state config supplies court line + notary block by county, `:33-160`):
- **Waiver of Service** — respondent statement waiving formal service, voluntariness clause (`:711-757`).
- **Certificate of Last Known Address** — last known address + diligent-efforts statement (`:811-853`).
- **Prove-Up Affidavit** — 7 numbered facts: identity/competence, residency, marriage date, grounds, children (list or "no minor children"), allegations true, request to grant (`:860-916`).
- **Military Status Affidavit (SCRA)** — search date/method and a status statement that is one of NOT on active duty / IS on active duty / unable to determine, driven by `respondentMilitaryStatus` (`:923-977`).
- **Indigency Affidavit** — income, expenses, dependents, assets, inability, request (`:990-1022`).
- Also: acknowledgment of service, parenting plan, child support worksheet/order, spousal support order, custody order, NY summons with notice / verified complaint.

Support-doc builders (`services/supportDocs/*`): TX **Statement of
Inability** (Rule 145) with itemized income/expense tables, scaffold rows
when nothing is on file, and a qualification Draft note when monthly
surplus > $500 and no public benefits (`texas.js:310-470`); TX Financial
Information Statement; UT Acceptance of Service, Certificate of Service,
Financial Declaration (Rule 26.1), Motion for Default (21-day recital),
Finalization prep checklist ("Not a filing"), **Child Support Worksheet
(estimate)** with obligor/receiving parent and blank money markers
(`utahChildSupportWorksheet.js:85-249`), **Motion to Waive Fees** with
sworn itemized finances (`utahFeeWaiver.js:157-329`); universal **Case
summary for attorney review** (lawyer handoff: snapshot, timeline,
finances, documents, questions; explicitly "Not a filing";
`lawyerHandoff.js:257-341`). Party income attribution never assigns one
side's itemized income to the other (`partyIncome.js`).

Acceptance: J = TX, kind `statement_of_inability`, D with income 4000,
expenses 2000, no benefits → document contains a qualification Draft note;
J = UT, kind `child_support_worksheet`, no incomes → money lines render the
`$__________` blank marker; any J, kind `lawyer_handoff` → title "CASE
SUMMARY FOR ATTORNEY REVIEW" and a "Prepared on" blank.

---

## 3. Anti-fabrication invariants

Each is stated as an invariant with acceptance examples.

**I-1 Silence ≠ waiver (spousal support).** A waiver clause renders only when
`spousalSupportWaived === true` or `spousalSupportAgreed === true` and no
request flag is set. `spousalSupportRequested === false` alone never
produces waiver text; the orchestrator never derives the waiver flag
(`spousalSupport.js:49-52`; `BaseDivorcePetitionTemplate.js:1411-1422`;
`services/agents/BaseDivorceOrchestrator.js:1261-1271`).
- D = {spousalSupportRequested: false} → petition relief has a blank-with-note asking to confirm agreement; decree spousalSupport absent.
- D = {spousalSupportWaived: true} → relief includes the mutual waiver; decree has a waive order.

**I-2 Nil-property / no-debts only from affirmative signals.** "No property
to divide" renders when `noPropertyConfirmed === true`, or
`hasProperty === false` + a described `propertyAgreement`, or a closed
keyword fact says no property; `hasProperty === false` alone → blank-with-
note; neither flag → blank-with-note; `hasProperty === true` → allegation
(`:1159-1233`). Debts paragraph only on `hasDebts === true`/itemized lists
(allegation) or `hasDebts === false`/no-debts fact (nil); silence → no debts
paragraph (`:1240-1256`). Decree mirrors (`BaseDivorceDecreeTemplate.js:525-700`).
- D = {} → propertyInfo has one item of type `property_draft_note`; no debt item.
- D = {noPropertyConfirmed: true} → item type `property_info` stating no community/marital property.
- D = {propertyAgreement: 'pending'} → treated as no agreement (status tokens are non-affirmative, `:1266-1300`).

**I-3 Draft banner + Draft-note blanks.** Every petition/decree structure has
`sections.draftBanner` and unresolved dispositive slots render a visible
blank + `(Draft — …)` note, never inferred prose (`:343`, `:883-910`).
UNVERIFIED: the PDF layer (`services/pdfService.js` renderDocumentHeader)
does not print `draftBanner`; it appears in `fullText`/HTML only.

**I-4 No "Case No. null" / punctuation-only captions.** Case numbers equal to
null/undefined/"null"/"n/a"/"none" or lacking any alphanumeric char render
as an underscore blank (`BaseDivorcePetitionTemplate.js:117-131`;
`BaseAnswerTemplate.js:61-73`). County values with no letters are dropped
(`BaseAnswerTemplate.js:474-480`).
- D.caseNumber = "." → caption shows label + blank; D.caseNumber = "FS-26-01234" → rendered verbatim.

**I-5 Date-shape validation.** Only ISO, M/D/YYYY, or "Month DD, YYYY"
strings are renderable (`templates/core/dateUtils.js:33-42`);
`formatDate` returns null otherwise and callers render blank-with-note.
Year-only children render "born 2016" (`:53-115`); FL year-only marriage
uses "in 2019".
- D.separationDate = "a few months ago" → marriageInfo separation item is blank-with-note.
- D.marriageDate = "2019-06-01" → renders June 1, 2019.

**I-6 Placeholder denylist blocks generation.** Before PDF/DOCX, the
serialized structure is scanned for tokens in `PLACEHOLDER_DENYLIST`
(`app/api/documents/generate/route.ts:91-131`); any hit → HTTP 422
`{ errorType: 'MissingRequiredFields', missingFields: [...] }`. Court-filled
tokens (`[DATE]`, `[SEAL]`, `[JUDGE SIGNATURE]`) are not in the list.
- D without petitioner name on a template that emits `[PETITIONER NAME]` → 422 with missingFields including "petitioner name". Preview is not blocked.

**I-7 Meta-commentary stripping.** Fact text matching planning phrases
("rather than", "instead of", "seeks dissolution", "the appropriate ground",
"we should plead", "recommends pleading") is excluded from the cruelty
substrate (`texas/DivorcePetitionTemplate.js:49-51, :97, :128`).
- Fact "seeks dissolution on the Georgia ground of cruel treatment rather than irreconcilable differences" → the cruelty paragraph does not reproduce that sentence.

**I-8 Canadian one-year separation gate.** When `separationDate` parses and
is < 365 days old, the s.8(2)(a) ground is pleaded prospectively ("will have
been living separate and apart for at least one year by <date>") with a
Draft note pointing to cruelty/adultery; unknown or ≥365 days → the
traditional assertion; never both (`templates/core/canadianHelpers.js:87-142`).
- J = ON, separationDate 200 days ago → grounds paragraph is the prospective form and contains a do-not-file-until date.

**I-9 TX fault + alternative.** Any fault ground (cruelty, adultery,
conviction, abandonment, confinement, living_apart) always co-pleads §6.001
unless `skipInsupportabilityAlt === true` (`texas/…:474-493`).

**I-10 Predicate guards.** "Resides at address unknown"/alt-service text
fires only when `respondentAddressUnknown === true` (or a hedged raw
address in TX/GA); a well-formed address pleads residence; no address and
no flag → blank + Draft note (`BaseDivorcePetitionTemplate.js:684-750`).
"Community property exists" only when `hasProperty === true` (I-2). GA
nonresident venue basis only when the respondent is absent.
- D = {respondentAddress: '', respondentAddressUnknown: undefined} → parties section respondent paragraph ends with a Draft note asking to insert address or affirm unknown.
- D = {respondentAddressUnknown: true, respondentSuspectedLocation: 'Louisiana'} (TX) → alt-service clause with the "has heard, but cannot swear" caveat (`texas/…:352`).

**I-11 Grounds sentinel scrub / canonicalization.** Values like
`other`/`unknown` are never promoted as grounds; foreign slugs
(`cruel_treatment`, `irretrievably_broken`, `wilful_desertion`) canonicalise
into the filing jurisdiction's vocabulary (`texas/groundsResolver.js:32-60`;
`georgia/groundsResolver.js:141-185`).

**I-12 Answer transcribes, never decides.** Unclassified scaffold paragraphs
render as mark-one prompts; requests for relief come only from user input
(`BaseAnswerTemplate.js:41-46`).

---

## 4. Terminology and localization

- **Party labels** come from `this.terminology` (`templates/core/terminology.js`):
  default Petitioner/Respondent/"Pro Se"; NY, GA, AB → Plaintiff/Defendant;
  ON, ENG → Applicant/Respondent; Canadian → "Self-Represented".
- **Venue labels**: US "STATE OF / COUNTY OF"; Canadian provinces "PROVINCE OF X"
  and no county line; territories bare name; AB "JUDICIAL CENTRE"; district
  phrasing style `suffix|prefix|plain` (`terminology.js:44-56`).
- **canadianize()** (`BaseAnswerTemplate.js:112-139`) rewrites, for Canadian
  answers only: alimony → spousal support; attorney('s) fees [and costs] →
  costs; Case No. → Court File No.; marital assets/debts/property → family
  property/debts (ON FLA vocabulary); Counter-Petition → Answer with Claim;
  " v. " → " AND BETWEEN ". Keys `id, state, documentType, kind, type,
  scaffoldKey, timestamp` are skipped.
- **Divorce Act 2021 vocabulary** in ON/AB templates: "decision-making
  responsibility" (s.16.1), "parenting time" (s.16.2), never "custody"
  (`ontario/DivorcePetitionTemplate.js:198-225`).
- **Ontario decree** uses "IT IS ORDERED" (not "AND DECREED"); Certificate of
  Divorce cited s.12(6) + FLR r.36(7) (`ontario/DivorceDecreeTemplate.js:32-33`).
- **Paper size**: Letter for US/CA; A4 for the `A4_JURISDICTIONS` set (UK,
  IE, AU, NZ, SG, HK, ZA, KE, GH, NG states, IN states)
  (`services/pdfService.js:19-27`, DOCX page size `:259-262`).
- **Footer**: "Page N of TOTAL • Created with Discover.Legal" stamped once per
  page after a single-pass build (`:144-182`, `:314`). Headers render the
  court line centred; `section_header`/`form10_header`/`form10_claim_subheader`
  items render bold-centred without a numeric prefix (`:1023-1030`).
- **Name casing** in captions preserves McPherson/DiCaprio/van der Berg/O'Brien
  patterns (`templates/core/nameCase.js`).

Acceptance: J = ON answer containing "attorney's fees" in scaffold text →
rendered text says "costs"; J = ENG petition → PDF page size A4; J = TX →
Letter; any 3-page PDF → each footer reads "Page k of 3".

---

## 5. Output formats and endpoints

| Endpoint | Input | Output |
|---|---|---|
| `POST /api/documents/preview` | `affidavitData` (state, documentType, activeSubDocument, facts…) | `{ success, preview: { sections, htmlContent }, metadata }`; no state → neutral fallback preview with `metadata.fallback: true`; template failure → fallback, never 500 (`app/api/documents/preview/route.ts:236-354`). Divorce sub-docs without a registered template go through `DivorceDocumentGenerator`. |
| `POST /api/documents/generate` | `documentId?`, `affidavitData`, `format` `pdf|docx|word` | binary PDF or DOCX; filename `{petition|decree|response|affidavit|<support-kind>}-{name}.{ext}` (`generate/route.ts:536-580`). Gates: state required + allow-listed; payment gate only when `PAYMENTS_ENABLED`; `case_packet` → 400 wrong endpoint; denylist → 422. |
| `POST /api/documents/packet` | `documentId` | single PDF `case-packet-{title}.pdf`: cover "CASE PACKET" (parties, where-to-file, filing tips, not-legal-advice line), TABLE OF CONTENTS, each rendered document in filing order, exhibit separator pages A, B…, "print separately" pages for non-embeddable types, EXHIBIT INDEX (`services/courtPacket/index.js`). Per-sub-doc degradation; if nothing renders, a plain facts document. Cover date is now minus 12h (`packet/route.ts:455-465`). |
| `POST /api/documents/support` | `kind`, `state`, `documentId?`, `signatureStyle?`, `extra?` | PDF built from profile merged with saved content; free, no payment gate. |
| `POST /api/documents/[id]/render` | id | `{ formatted, items }` plain numbered-facts affidavit text via `services/previewRenderer.js` (jurisdiction-aware venue lines). |
| `GET /api/templates/validation/[state]` | state | legal-review changelog: claim categories with verdict/verifiedOn/source/note, corrections (`templates/validation-history.json`); surfaced by `components/app/LegalReviewBadge.js` as "Law verified N days ago; K claim categories; M corrections". |
| Official forms | `lib/officialForms.ts:officialFormsLink(state)` | `{ name, url }` or null (LA, NU absent); used by Respond/LifeStory/HearingPrep/ServeGuide clients. |

Framing: editor download labels are "Download … draft"
(`components/app/EditorView.js:825-836`); packet is "Case packet"; petition
footer disclaimer says informational only (`BaseDivorcePetitionTemplate.js:1590`).
Reference-context documents carry the NOT FOR FILING banner. UNVERIFIED:
whether the PDF cover/first page prints the `draftBanner` text.

Acceptance: J = "" preview → `metadata.fallback = true`; J = ZZ generate →
ValidationError "Unsupported state / province"; `format=docx` → content-type
`application/vnd.openxmlformats-officedocument.wordprocessingml.document`;
packet with 2 evidence files → TOC lists Exhibit A and Exhibit B and an
EXHIBIT INDEX page exists.

---

## 6. Metadata / template registry and jurisdiction gating

`templates/states/<dir>/metadata.json` (validated against
`templates/core/templateMetadata.schema.json`: required `stateCode,
stateName, documentTypes, version, legallyCompliant, requiredFields,
features{perjuryStatement, notaryBlock, caseNumberLabel}`) declares
functionally: which `documentTypes` the state can render
(`StateTemplateManager.hasDocumentType`, `templates/StateTemplateManager.js:62`),
`requiredFields` (typically affiantName, state, county), the case-number
label, whether a perjury statement / notary block / commissioner-for-oaths
/ statement-of-truth applies, `courtSystem`, `divorceTerminology.parties`,
`legalCitations`, the `affidavitJurat` text, `exhibitRules`, and for
international entries `paperSize`, `currency`, hotline numbers.
`divorce-metadata.json` declares residency requirements, waiting periods,
grounds (code/name/statute) and the divorce document types (e.g. TX
`residencyRequirements {stateMonths: 6, countyDays: 90}`, 60-day wait).

Gating rule (`lib/api/catalog-data.ts:114-138`): if `JURISDICTION_ALLOWLIST`
is set, only those codes surface anywhere (overrides
`ENABLE_INTERNATIONAL`); else US states + Canadian provinces, plus
international when `ENABLE_INTERNATIONAL=true`. `generate` independently
allow-lists US+CA and adds international only when enabled
(`generate/route.ts:293-313`) — UNVERIFIED whether `generate` honours
`JURISDICTION_ALLOWLIST` (it uses `ALL_STATES`/`ALL_PROVINCES` directly).

Acceptance: env `JURISDICTION_ALLOWLIST=ON,UT` → `getAllJurisdictions()` =
[ON, UT] (order per source lists); `ENABLE_INTERNATIONAL` unset → ENG not
in catalog; TX metadata → `features.caseNumberLabel = "CAUSE NO."`;
ON metadata → `divorceTerminology.parties = [Applicant, Respondent]`.

---

## 7. Semantic judgments currently done by pattern-matching

Each is a semantic decision a rebuild may want an LLM or structured field to make instead.

| Judgment | Mechanism | Location |
|---|---|---|
| "This rendered document has unfilled required data" | fixed token denylist substring scan of JSON | `app/api/documents/generate/route.ts:91-160` |
| "This fact is model meta-commentary, not a fact" | regex `rather than|instead of|seeks dissolution|the appropriate ground|we should plead|recommends pleading` | `templates/states/texas/DivorcePetitionTemplate.js:49-51,97,128` |
| "Strip hedge words from a suspected location" | regex `^(possibly|maybe|perhaps|probably|apparently|allegedly|reportedly|supposedly)` loop | `texas/DivorcePetitionTemplate.js:13-22`; `georgia/DivorcePetitionTemplate.js:13-22` |
| "Is this string a real date?" | three shape regexes (ISO, slash, long-form) | `templates/core/dateUtils.js:33-42` |
| "Extract a birth year from freeform" | `(19|20)\d{2}` capture | `dateUtils.js:66-71` |
| "Is this value year-only (use 'in' not 'on')?" | `^(19|20)\d{2}$` | `services/supportDocs/BaseAnswerTemplate.js:78-84` |
| "Which ground did the user plead?" | ordered keyword regexes over fact text (`cruel`, `adulter`, `felony`, `desert`, …) | `templates/states/georgia/groundsResolver.js:113-135` |
| "Map a foreign grounds slug to local vocabulary" | static alias map | `templates/states/texas/groundsResolver.js:55-60` |
| "Facts say there is no property / no debts" | closed keyword × category-token intersection | `BaseDivorcePetitionTemplate.js:1312-1321` (`_factsIndicateNo`) |
| "Is `propertyAgreement` a real agreement or a status token?" | token sets (`agreed/yes/true` vs `pending/unknown/contested/n/a`) | `BaseDivorcePetitionTemplate.js:1266-1300` |
| "Case number / county is absent" | null-ish sentinel strings + no-alphanumeric test | `BaseDivorcePetitionTemplate.js:117-131`; `BaseAnswerTemplate.js:61-73,474-480` |
| "US idiom → Canadian term" | word-boundary replace chain | `BaseAnswerTemplate.js:112-139` |
| "Caption already names the court (suppress header)" | normalised uppercase containment | `templates/core/captionDedupe.js:23-46,64-105` |
| "County name already includes 'County'" | `/\s+county$/i` strip | `templates/core/countyName.js`; `BaseDivorcePetitionTemplate.js:107` |
| "Uppercase a name without breaking McX/DiX/van der" | prefix/particle regexes | `templates/core/nameCase.js:36-98` |
| "Respondent address is a hedge, not an address" | hedge-word detection on raw address (TX/GA overrides) | `BaseDivorcePetitionTemplate.js:690-750` (+ extraction prompt rule 17/19, `services/agents/extractionQuality.js:48-50`) |
| "Residency fact exists" for pre-admission | subcategory token match (`residency`, `state_residency`) | `BaseAnswerTemplate.js:431-460,485-497` |
| "Prenup fact exists / year of prenup" | subcategory + regex on fact content | `BaseAnswerTemplate.js:439-460` |
| "Document is petition vs decree vs affidavit" (PDF routing) | section-key sniffing when `documentType` missing | `services/pdfService.js:66-82` |
| "Relief already mentions waiver / agreement" (avoid duplicates) | `/waiv/i`, `/agreement regarding the division/i` on joined text | `BaseDivorcePetitionTemplate.js:1424,1430` |
| "Rule 145 applicant likely does not qualify" | surplus > $500 and no benefits string | `services/supportDocs/texas.js:455-470` |
| "Which document is this in the packet" (filename prefix) | classification kind/type switch | `generate/route.ts:543-562` |
| "Sanitise filename" | `[^a-zA-Z0-9-]` collapse | `generate/route.ts:69-73` |
