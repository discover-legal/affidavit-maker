# Attorney-verified acceptance log — 2026-08-31

Branch: `acceptance-100pct-v6-v22`. Final HEAD: `73e35d1` (feature-flag) →
`f04e8de` (v33 polish) → `72e72d7` (v32 rescue retry) → `8230b15` (v31
round-7) etc.

## Summary

**Result**: 69/69 across 7 real personas via live LLM (gpt-5.6-luna via
Responses API), verified by senior-family-law attorney review in round 8
as READY FOR LIMITED-INVITATION UNPAUSE.

**Approach**: Recursive persona-driven acceptance loop. Each round drove
the site with a real persona (chat + save + generate + verify), captured
failures against transcripts, fixed disjoint-file batches via parallel
subagents, merged, gated (jest + type-check + lint + build + banned-phrase
sweep), re-replayed, and repeated. Attorney-review rounds interleaved from
round 3 onward to catch quality issues automated asserts miss (fabrications,
US idioms in Canadian docs, missing prayer clauses, wrong statute cites).

## Personas covered

| Persona | Jurisdiction | Case shape | Final |
|---|---|---|---|
| Marcus Thompson | Ontario respondent | Contested parenting, wife filed, kids with wife | 11/11 |
| Mari Vasquez-McPherson | Texas contested | Cruelty grounds, absent respondent + Rule 145 indigency | 11/11 |
| Alison McPherson | California petitioner | Adult-only children, jurisdiction correction NV→CA | 12/12 |
| David Rosenberg | New York uncontested | Mediated settlement + minor child + CSSA waiver | 6/6 |
| Sarah Khoury | Alberta applicant | Contested §19 income imputation, 6-month sep gate | 10/10 |
| Tavita Faletau | Florida respondent | Prenup enforcement + AFFIRMATIVE DEFENSES | 10/10 |
| Amara Okafor | Georgia petitioner | Cruelty + absent spouse (Alabama) + 3 minor kids | 9/9 |

## Round-by-round fix stack

| Round | Focus | Highlights |
|---|---|---|
| v6→v22 | Base acceptance | First-time 69/69 green, comprehensive fanned fixes across extraction, templates, routing |
| v23 | Attorney round-1 | Kill fabricated waivers, US-idiom scrub, FL Answer rebuild, Canadian templates |
| v24 | Extractor | Broaden `isGroundsFact` to statutory-ground subcategories |
| v25 | Attorney round-2 | Predicate guards, contested-issue passthrough, TX cruelty alt-plea, ON Form 10 |
| v26 | Attorney round-3 | Substrate grammar, meta-commentary filter, DOB universal, fabrication guards, FL affirmative defenses, Rule 145 expense scaffold |
| v27 | Attorney round-4 | Sarah §19 imputation from facts, David uncontested prayer switch, UCCJEA autofill, FL Answer pre-populate, Marcus decree schedule bracket |
| v28 | Attorney round-5 | `services/pdfService.js` `contestedIssues` fix, AB jurat + ordinarily-resident + Judicial Centre, FL AFFIRMATIVE DEFENSES cross-ref, Case No null, Roman numerals, ON Divorce Act post-2021 cites, GA §9-10-91 |
| v29 | Attorney round-6 | AB single-intro imputation, GA Plaintiff/Defendant substrate, ON Answer no FRCP idiom, decree primary-parent from transcript, Case No bare period |
| v30 | Rescue LLM | Broader-scan whereabouts rescue when no dedicated fact exists |
| v31 | Attorney round-7 | case_number schema field, canadianize marital→family + Counter-Petition→Answer with Claim, ON decree fabrications killed + s.12(6) cite, Parts B/C fact ingest, FL dup title + party labels + sep-date guard + prayer prenup + verification cite §92.525, TX §6.002 pinpoint + property/prayer consistency, footer page-of-total fix, GA all-evidence substrate + label collapse, NY dup title |
| v32 | Rescue retry | gpt-5-nano retry with 6000-token budget when first call returns empty |
| v33 | Attorney round-8 polish | Dedup tense variations, collapse Role,Role artifacts |

## Feature flag: narrow launch

`JURISDICTION_ALLOWLIST=ON,UT` in `.env.example.sh`. When set, ONLY the
listed jurisdictions surface across templates, catalog, chat state picker,
and API responses. Overrides `ENABLE_INTERNATIONAL`. Unset the var to
restore full-NA default. Add codes to expand progressively.

Priority: allowlist > `ENABLE_INTERNATIONAL` > `NA_JURISDICTIONS` default.

## Files

- `config/jurisdictions.js` — `isAllowedJurisdiction`, `activeJurisdictions`,
  `readAllowlist`, plus `NA_JURISDICTIONS` + `isInternationalEnabled`.
- `lib/api/catalog-data.ts` — `getAllJurisdictions()` filters through
  allowlist.
- `app/api/catalog/matters/[code]/route.ts` — matter cards
  cross-filtered through active-jurisdictions.
- `templates/core/TemplateLoader.js` — already gated on
  `isAllowedJurisdiction()`, so new allowlist logic cascades to the
  template layer without further changes.

## Reproducing acceptance

Rig at `/tmp/e2e-app` (hardlinked from repo). Drive with real Luna via:

```
cd /tmp/e2e-app && NODE_OPTIONS="--max-old-space-size=4096" \
  npm run dev -- -p 3100
```

Reset test user between personas via:

```
DELETE FROM api_rate_limits;
DELETE FROM user_profiles WHERE user_id IN (
  SELECT id FROM users WHERE email='e2e@discover.legal'
);
DELETE FROM documents WHERE user_id IN (
  SELECT id FROM users WHERE email='e2e@discover.legal'
);
```

Latest driver: `/tmp/claude-1000/.../scratchpad/v32b-replay/run.mjs`.
Copy forward + tweak scratchpad path variable to run additional rounds.

## Cost/latency notes

- Primary Luna call via Responses API per chat turn.
- Companion promoter batch adds ONE gpt-5-nano call per turn when facts
  need companions.
- Merge-time rescue LLMs (respondentSuspectedLocation, numberOfChildren,
  groundsForDivorce) each add ONE gpt-5-nano call per turn when structured
  field is still missing after primary + promoter, retried once with
  larger budget on empty response.
- All fail-open — LLM errors never break the pipeline.

## Unpause procedure

1. Review branch `acceptance-100pct-v6-v22` and merge to `main`.
2. Set `JURISDICTION_ALLOWLIST=ON,UT` in Render env (or accept the
   `.env.example.sh` default when redeploying).
3. Unset `MAINTENANCE_MODE` (or set to `false`) — `proxy.ts` will stop
   serving the 503 maintenance page and let requests through.
4. Monitor `/api/health` + Auth0 login flow + one live chat turn each for
   ON + UT before broader invitation.

To expand jurisdictions later: add codes to `JURISDICTION_ALLOWLIST`
(e.g. `ON,UT,TX,CA,NY`) and redeploy. To restore full NA default, unset
`JURISDICTION_ALLOWLIST` entirely.
