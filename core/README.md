# core/ — the v2 engine

The v2 engine is a parallel implementation of the product's brain: triage,
interview, facts and life story, document composition, rendering. It lives
beside the v1 code (`services/`, `templates/`, `lib/api/profile.ts`) and is
selected per request with `CORE_ENGINE=v2`. v1 stays the default until v2
passes the persona acceptance run on a real model.

Functional specs (what the system does, not how): `docs/spec/*.md`.

## Principles

1. **Code owns the workflow, invariants and state. The model supplies
   judgment and language.** Every semantic decision that v1 made with a
   regex or a keyword table is a typed question to the Intelligence layer.
   Every legal invariant (silence is never a waiver) is code over explicit
   `Confirmations` with provenance.
2. **Unknown is absent.** No sentinel values. A field exists with a value and
   provenance, or it does not exist. Drafts render a typed `blank` block with
   a draft note for anything absent.
3. **Provenance everywhere.** Every value knows where it came from and, for
   anything the user said, their own words.
4. **The model proposes, code disposes.** A turn returns a structured
   proposal; the engine verifies the consequential parts (affirmations,
   corrections, child identity, language) with judgments and thresholds
   (`THRESHOLDS` in `core/intelligence/types.ts`), then applies them.
5. **No model SDK outside `core/intelligence/`.** Modules take an
   `Intelligence` in their deps and nothing else model-shaped.
6. **No regexes, no keyword lists, no substring heuristics for semantics** in
   `core/` or in `__tests__/core/`. Format work that is genuinely syntactic
   (an ISO date's shape, an identifier for an API) is allowed and must say
   why in a comment.

## Layout

| Module | Contract | Role |
|---|---|---|
| `core/intelligence` | `types.ts` | `ask()` structured generation, `judge()` typed questions with probabilities. Implementations: OpenAI, TypeSafe (Jev) for judgments, Scripted for tests. |
| `core/model` | `types.ts` | `CaseFile`, `Fact`, `Field`, `Confirmations`, `Child`, provenance. |
| `core/jurisdictions` | `types.ts` | One registry built from `templates/states/*/metadata.json` + `divorce-metadata.json`; lexicon, court, jurat, divorce profile; allowlist gating. |
| `core/triage` | `types.ts` | Classify the need into a matter, clarify, or say it is out of scope; safety first. |
| `core/interview` | `types.ts` | One engine for every matter definition (YAML matters + divorce with jurisdiction overlays). |
| `core/profile` | `types.ts` | Life story: hydrate, absorb, promote (one extraction replaces the rescue loops), ingest court papers, erase. |
| `core/compose` | `types.ts` | Select documents; build a typed `DocumentTree`; verify every drafted paragraph against the record. |
| `core/render` | `types.ts` | `DocumentTree` → PDF / HTML / text. Draws blocks; interprets nothing. |
| `core/engine.ts` | | Wires modules; the façade the routes call when `CORE_ENGINE=v2`. |

Each module exports `create<Module>(deps)` from `index.ts` and keeps its
contract in `types.ts`. Contracts are frozen for the rebuild; change one only
with a spec change in `docs/spec/`.

## Testing rules (`__tests__/core/`)

- Tests construct a `ScriptedIntelligence` and declare every model answer
  the scenario needs. An unscripted call throws, so no test passes on an
  answer it did not declare.
- Assertions are structural: fields, provenance, phases, confirmations,
  block kinds, judgment calls made (`intel.calls`). Never a regex or a
  substring match on prose. If a test needs to say something about a reply's
  meaning, it asserts the judgment the engine made about it (e.g. the
  `language` choice) or the structured `questions_asked`.
- Interview scenarios are driven as simple loops: a scripted user script and
  a scripted model script, turn after turn, with the CaseFile asserted after
  each turn.
- Real-model runs are a separate gate (`REAL_LLM=1`) and are not part of the
  unit suite.

## Environment

```
CORE_ENGINE=v2                 # route requests to core/ (default: v1)
CORE_INTELLIGENCE=typesafe     # scripted | openai | typesafe (default: typesafe when TYPESAFE_API_KEY set, else openai)
                               # "scripted" exists for unit tests only; every demo and e2e run uses a real model
CORE_LLM_MODEL=gpt-5.5         # generative model
CORE_JUDGE_MODEL=              # optional cheaper model for OpenAI-backed judgments
TYPESAFE_API_KEY=              # enables Jev-backed judgments
OPENAI_API_KEY=
```
