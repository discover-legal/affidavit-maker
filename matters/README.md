# Matters (claim / interview types) — YAML definitions

Every file in this directory is one **matter**: a kind of legal claim the
triage step can classify a person into, a card in the catalog, and the phased
interview that collects the facts for it. Adding a matter means adding one
YAML file here. No JavaScript, no registry edits, no prompt-list edits.

```
matters/
  name_change.yaml     ← the reference example (converted from the old JS pack)
  _example.yaml        ← files starting with "_" or "." are ignored (scaffolds)
```

Validate before committing:

```bash
npm run matters:validate      # lists every problem with file + path
npm test                      # the suite also fails on an invalid matter file
```

## What a YAML matter plugs into

| Consumer | What it reads |
|---|---|
| Catalog API (`/api/catalog/matters…`) | `code`, `practice_area`, `display_name`, `short_name`, `tagline`, `sort_order`, `is_packaged`, `documents`, `supported_jurisdictions` |
| Triage classifier (first chat turn) | `triage.description`, `triage.keywords`, `triage.routing_notes` — appended to the classifier prompt and its `matter_type_code` enum |
| Interview engine (`BaseMatterOrchestrator`) | `phases`, `fields`, `shared_rules` |
| Life-story hydration | `family_profile` — `true` lets spouse/children facts from the user's profile pre-fill this interview |
| Document selection (review screen) | `document_selection` — optional; default is a single general affidavit |

Built-in matters that still live as JS (`divorce`, `custody`, `probate`, …)
keep their codes reserved: a YAML file reusing one of those codes is
rejected until the JS orchestrator is removed.

## File format

```yaml
code: expungement_petition        # snake_case, unique; becomes matterTypeCode
practice_area: civil              # family | civil
display_name: Record Expungement
short_name: Expungement
tagline: Ask the court to seal or clear an old record
sort_order: 180                   # optional, default 1000 (catalog ordering)
is_packaged: false                # optional
family_profile: false             # optional; true for matters about spouse/children
supported_jurisdictions: [ON]     # optional; omit = every active jurisdiction

documents:                        # catalog document codes for this matter (≥1)
  - petition_for_expungement
  - indigency_affidavit

document_selection:               # optional; what the review screen offers
  documents: [affidavit]
  reasons:
    affidavit: A sworn statement supporting your petition.

triage:
  description: Sealing or clearing a criminal record
  keywords: [expunge, seal my record, clear my record]
  routing_notes:                  # optional lines added to the classifier's guidance
    - "\"remove a conviction from my record\" → expungement_petition"

shared_rules: |                   # optional; appended to every phase prompt
  EXTRACTION RULES:
  - Always call process_matter_data
  - Use FIRST PERSON for all facts

fields:                           # what the model may extract each turn
  petitioner_first_name: string   # shorthand = { type: string }
  petitioner_last_name: string
  state: string
  county: string
  is_juvenile_record:
    type: boolean
    description: true when the record is from juvenile court
  offense_type:
    type: string
    enum: [misdemeanor, felony, infraction, arrest_only]
  children:
    type: array
    items:
      type: object
      properties:
        name: { type: string }
        dob: { type: string }
  user_confirmed_review: boolean

phases:                           # in order; INTAKE first, REVIEW last
  - id: INTAKE
    display_name: Getting Started
    required_fields: [petitioner_first_name, petitioner_last_name, state, county]
    prompt: |
      You are a legal document assistant helping someone ...
      COLLECT:
      1. ...
  - id: JUVENILE
    display_name: Juvenile Record
    skip_unless_any: [is_juvenile_record]   # runs only when any listed field is truthy
    prompt: |
      ...
  - id: REVIEW
    display_name: Review & Confirm
    required_fields: [user_confirmed_review]
    fact_category: general                   # optional default category for extracted facts
    prompt: |
      ...
```

### Rules the validator enforces

- `code` is unique across files and not a built-in JS matter.
- `fields` keys are `snake_case`; each maps to a camelCase key on the
  interview data (`petitioner_first_name` → `petitionerFirstName`). Set
  `target:` to override. `response`, `phase_complete`, `extracted_facts`
  and `superseded_facts` are reserved.
- `array` fields need `items`; `enum` only on `string`; `properties` only on
  `object`.
- `phases` start with `INTAKE` and end with `REVIEW`; ids are
  `UPPER_SNAKE_CASE` and unique.
- `required_fields`, `skip_unless_any`, `skip_if_any` may name a field by its
  snake_case key or camelCase target; unknown names are errors.
- A phase with `skip_unless_any` / `skip_if_any` is optional automatically.
  `INTAKE` and `REVIEW` cannot be conditional.
- Every phase prompt is at least 20 characters; `shared_rules` (if any) is
  appended to each phase prompt.

### How the interview engine treats your phases

The engine (`services/agents/BaseMatterOrchestrator.js`) adds its own
conversation rules to every prompt: one question per message, never re-ask
what is already collected, extract only what the user stated, ask for the
user's full legal name first. Your `prompt` supplies the legal substance:
what to collect, jurisdiction notes, wording rules. `required_fields` is
advisory for the model; the engine advances when the model sets
`phase_complete: true` (and never past INTAKE while the user's own name is
missing).

### Names the engine recognises

If your matter has parties, use the standard field targets so the review
screen, previews and the life-story profile pick them up:
`petitionerFirstName` / `petitionerLastName`, `respondentFirstName` /
`respondentLastName` (family), `plaintiffFirstName` / `defendantFirstName`
(civil), `state`, `county`, `children` (array of `{ name, dob, age }` —
merged across turns, never overwritten).

## Converting a JS prompt pack to YAML

1. `SHARED_RULES` → `shared_rules`.
2. Each phase constant → a `phases[]` entry: `displayName` → `display_name`,
   `requiredFields` → `required_fields`, `skipIf: (d) => !d.x` →
   `skip_unless_any: [x]`, `skipIf: (d) => d.x || d.y` → `skip_if_any: [x, y]`.
3. `buildTool()` properties → `fields` (drop `response`, `phase_complete`,
   `extracted_facts`); `FIELD_MAP` entries whose camelCase differs from the
   default become `target:`.
4. Delete the JS orchestrator + prompt pack and its entry in
   `app/api/chat/route.ts` `MATTER_ORCHESTRATOR_LOADERS`, remove the code
   from `BUILTIN_MATTER_CODES` in `services/matters/index.js`, and remove its
   rows from `MATTER_TYPES` / `DOCS_BY_MATTER` in `lib/api/catalog-data.ts`
   and from the built-in list in `services/agents/prompts/triage/index.js`.
5. `npm run matters:validate && npm test`.
