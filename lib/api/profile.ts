import { query } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * Life-story user profiles.
 *
 * One row per user (user_profiles, migration 015) accumulating everything
 * the user has told the AI across every chat session and document:
 *  - `profile`: structured interview fields (camelCase, the same shape as
 *    affidavitData) — parties, marriage, children, residency, finances.
 *  - `facts`:   the accumulated first-person fact statements.
 *
 * The chat route hydrates each conversation from this row before dispatching
 * to an orchestrator, and merges the turn's extractions back afterwards, so
 * a returning user never has to repeat themselves — in a new session OR a
 * new document.
 */

// CommonJS utils shared with the orchestrators (services/ tree).
const { mergeChildren } = require('@/utils/childrenMerge') as {
  mergeChildren: (a: unknown[] | undefined, b: unknown[] | undefined) => Record<string, unknown>[];
};
const { mergeLabeledAmounts, totalOf } = require('@/utils/labeledAmounts') as {
  mergeLabeledAmounts: (
    existing: unknown[] | undefined,
    incoming: unknown[] | undefined,
  ) => Array<Record<string, unknown>>;
  totalOf: (items: unknown) => number;
};
const { retireFacts, sanitizeSupersededStatements, normalizeFactText } =
  require('@/services/agents/factRetirement') as {
    retireFacts: (
      facts: unknown[] | undefined,
      superseded: unknown,
      cap?: number,
    ) => { kept: ProfileFact[]; retired: ProfileFact[] };
    sanitizeSupersededStatements: (superseded: unknown, cap?: number) => string[];
    normalizeFactText: (text: unknown) => string;
  };
export type ProfileFact = {
  id?: string;
  content?: string;
  category?: string;
  [key: string]: unknown;
};

export type UserProfile = {
  profile: Record<string, unknown>;
  facts: ProfileFact[];
};

/**
 * Structured fields that describe the user's life story — durable across
 * documents. Deliberately excludes per-document/per-case state
 * (documentType, orchestratorState, caseNumber, courtName, requiredDocuments,
 * payment fields, ...): remembering those across documents would corrupt new
 * interviews.
 *
 * Hydration is scoped:
 *  - GENERAL fields flow into any conversation (who you are, finances used
 *    by fee-waiver phases everywhere).
 *  - FAMILY fields flow only into family-law matters — seeding a small-claims
 *    or name-change affidavit with a spouse, children, and divorce grounds
 *    would contaminate it.
 *  - JURISDICTION fields are stored (the /profile page shows them) but NEVER
 *    hydrated: state/county drive orchestrator routing and phase skipping,
 *    and each new document must ask where it is being filed. A user who
 *    moved states must not be silently routed to their old jurisdiction.
 */
const GENERAL_FIELDS: readonly string[] = [
  'firstName', 'lastName', 'affiantName',
  'role', // which side of the case the user is on: 'petitioner' | 'respondent'
  // monthlyIncome is always the USER's own income; the spouse's lives in
  // spouseMonthlyIncome (role-aware mapping in the orchestrators). Never a
  // household total.
  'monthlyIncome', 'spouseMonthlyIncome', 'monthlyExpenses', 'incomeBreakdown', 'expenseBreakdown',
  'assetsDescription', 'dependentsCount',
  'indigencyRequested',
];

const FAMILY_FIELDS: readonly string[] = [
  'spouseName', // canonical, role-independent — see reconcileParties()
  'petitionerFirstName', 'petitionerLastName', 'petitionerName',
  'respondentFirstName', 'respondentLastName', 'respondentName',
  'marriageDate', 'marriageCity', 'marriageStateName', 'marriageLocation',
  'marriagePlace', 'marriageType', 'separationDate',
  'children', 'hasMinorChildren', 'numberOfChildren',
  'custodyArrangement', 'custodyType', 'custodyPreference', 'custodyDetails',
  'primaryCustodian', 'childSupportAmount', 'childSupportPayor',
  'childSupportObligor', 'childSupportObligee',
  'groundsForDivorce', 'spousalSupportRequested', 'supportAmount', 'supportDuration',
  'spousalSupportAmount', 'spousalSupportDuration',
  // Template gate fields for the decree/petition spousal-support sections.
  // spousalSupportWaived was missing here, so an agreed alimony waiver never
  // survived into the profile (live katie2 replay). Its siblings, which the
  // templates read alongside it, had the same gap.
  'spousalSupportWaived', 'spousalSupportAwarded', 'requestSpousalSupport',
  'hasProperty', 'hasDebts', 'propertyAgreement',
  // Per-party property/debt lists. String arrays — one complete asset/debt
  // per element, values (and "Separate property: " / "Separate debt: "
  // prefixes) intact — mirroring the orchestrator's REPLACE-PER-PERSON
  // contract so a persona whose interview named the marital home always sees
  // it re-populated in a new session, and a label-variant restatement never
  // doubles the marital estate on the durable profile.
  'petitionerProperty', 'respondentProperty', 'petitionerDebts', 'respondentDebts',
  // Equalization payment (property, NOT debt — see extractionQuality rule 16).
  // The interview stores structured fields so the decree renders equalization
  // as its own ordered clause under DIVISION OF PROPERTY, not buried in
  // ALLOCATION OF DEBTS (live CA acceptance run, 2026-08).
  'equalizationAmount', 'equalizationSchedule', 'equalizationPayor', 'equalizationPayee',
  // Prenuptial agreement — the CA decree reads these to add a WHEREAS-style
  // recital in JURISDICTION and a "confirmation of separate character under
  // the parties' premarital agreement" tail in property awards.
  'prenupSigned', 'prenupSignedYear', 'prenupGovernsAfterDivorce',
  'serviceMethod',
  // When RespondClient renders the Answer-deadline banner it prefers the
  // stored keyEvents "served on you" line (ingested from a scanned petition)
  // but falls back to this scalar — set by the divorce interview whenever the
  // user narrates a served date ("process server handed it to me on june 24").
  // Live Ontario acceptance run, 2026-08: the fact was captured but no
  // structured field held it, so the banner kept saying "we don't have your
  // served date yet".
  'serviceDate',
  'hasProtectiveOrder', 'respondentAddress',
  // Whereabouts-unknown respondent (extractionQuality rule 17). The petition
  // template renders an alternative-service clause instead of the standard
  // "is a resident of ..." sentence when respondentAddressUnknown is true, and
  // respondentSuspectedLocation preserves the user's hedged guess as a
  // NON-sworn field kept OUT of the residence clause. Persisting these on the
  // profile keeps the state coherent across sessions so the interview never
  // silently defaults back to a spuriously-empty respondent_address.
  'respondentAddressUnknown', 'respondentSuspectedLocation',
  'respondentMilitaryStatus',
];

const JURISDICTION_FIELDS: readonly string[] = [
  'state', 'county', 'residencyStateMonths', 'residencyCountyDays', 'residencyBasis',
];

const PROFILE_FIELDS: readonly string[] = [
  ...GENERAL_FIELDS,
  ...FAMILY_FIELDS,
  ...JURISDICTION_FIELDS,
];

export type HydrationScope = 'family' | 'general';

const MAX_PROFILE_FACTS = 300;

/**
 * Forbidden `groundsForDivorce` placeholders (v22-A). The primary schema call
 * tells Luna to OMIT the grounds field when unclear (BaseDivorceOrchestrator
 * §GROUNDS description), but the model still occasionally writes one of these
 * sentinels — leaving the downstream resolver with nothing to map onto a real
 * statute. Normalized to lowercase; a match at merge time is treated as
 * "truly absent" so the v20-B/v21-A companion-fact promotion can populate the
 * real slug from grounds_value.
 */
const FORBIDDEN_GROUNDS_SENTINELS: ReadonlySet<string> = new Set([
  'other', 'unknown', 'unclear', 'none', 'n/a', 'na', 'not_sure',
]);

/**
 * Canonical statutory-ground name tokens. When Luna tags a grounds narration
 * with a non-'grounds' category (v23 Amara replay: `category:'evidence',
 * subcategory:'cruel_treatment'`) the isGroundsFact predicate must still
 * recognize it — the model already classified it by putting the statutory
 * slug on the subcategory. Kept as a small closed list of the tokens the
 * downstream jurisdiction resolvers understand; matched via `sub.includes`
 * so `cruel_treatment_documented`, `respondent_adultery`, etc. still qualify.
 */
const STATUTORY_GROUND_TOKENS: readonly string[] = [
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

function isEmptyValue(v: unknown): boolean {
  return (
    v === undefined ||
    v === null ||
    (typeof v === 'string' && v.trim() === '') ||
    (Array.isArray(v) && v.length === 0)
  );
}

function normalizeFactContent(fact: ProfileFact): string {
  return String(fact?.content ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

const BREAKDOWN_FIELDS: readonly string[] = ['incomeBreakdown', 'expenseBreakdown'];

// Per-party property/debt lists that mirror the orchestrator's contract.
// Each incoming list REPLACES what was stored for that party (labelled
// per its schema field name — petitionerProperty, respondentDebts, ...);
// same-turn label-variant restatements collapse via dedupePropertyList.
const PROPERTY_DEBT_FIELDS: readonly string[] = [
  'petitionerProperty', 'respondentProperty', 'petitionerDebts', 'respondentDebts',
];

/**
 * Same-turn dedupe for property/debt list entries: pure plumbing, no fuzzy
 * matching. Strips whitespace, punctuation, dollar amounts, and a small
 * closed set of articles/qualifiers, then treats two entries as duplicates
 * when their normalized cores collide (equal, or one contained in the other).
 * Keeps the LONGER original wording — it almost always carries the address,
 * creditor, and disposition that the shorter restatement dropped.
 */
const PROPERTY_ITEM_STOPWORDS = new Set([
  'the', 'a', 'an', 'my', 'our', 'their', 'his', 'her', 'your',
  'and', 'or', 'of', 'in', 'on', 'at', 'for', 'to', 'with',
  'worth', 'valued', 'value', 'approximately', 'approx', 'about', 'around',
  // Descriptor-only tokens that never carry identity — see the mirror in
  // services/agents/BaseDivorceOrchestrator (live CA acceptance run, 2026-08).
  'marital', 'family', 'primary', 'former', 'main', 'joint', 'community',
  'total', 'currently', 'shall', 'be', 'is',
]);

// Mirror of the orchestrator's PROPERTY_ITEM_SYNONYMS — kept in sync so
// hydration never re-splits a duplicate the orchestrator already collapsed.
const PROPERTY_ITEM_SYNONYMS = new Map<string, string>([
  ['house', 'home'],
  ['residence', 'home'],
  ['dwelling', 'home'],
  ['property', 'home'],
  ['auto', 'vehicle'],
  ['car', 'vehicle'],
  ['truck', 'vehicle'],
  ['suv', 'vehicle'],
]);

function propertyItemCore(raw: unknown): string {
  return String(raw)
    .toLowerCase()
    .replace(/\$\s*\d[\d,]*(?:\.\d+)?\s*[km]?\b/g, ' ')
    .replace(/\b\d[\d,]*(?:\.\d+)?\s*(?:dollars?|usd|cad)\b/g, ' ')
    .replace(/[^\w\s]/g, ' ')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter((t) => t && !PROPERTY_ITEM_STOPWORDS.has(t))
    .map((t) => PROPERTY_ITEM_SYNONYMS.get(t) || t)
    .join(' ');
}

// Token-set containment — mirrors _isTokenSubset in the orchestrator.
function isTokenSubset(shorter: string, longer: string): boolean {
  const sTokens = shorter.split(' ').filter(Boolean);
  const lTokens = new Set(longer.split(' ').filter(Boolean));
  if (sTokens.length < 3) return false;
  return sTokens.every((t) => lTokens.has(t));
}

function dedupePropertyList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const items = raw.map((v) => String(v ?? '').trim()).filter(Boolean);
  const kept: string[] = [];
  const cores: string[] = [];
  for (const item of items) {
    const core = propertyItemCore(item);
    if (!core) { kept.push(item); cores.push(core); continue; }
    let collision = -1;
    for (let j = 0; j < kept.length; j++) {
      const other = cores[j];
      if (!other) continue;
      if (core === other || core.includes(other) || other.includes(core)) {
        collision = j;
        break;
      }
      const shorter = core.length <= other.length ? core : other;
      const longer  = core.length <= other.length ? other : core;
      if (isTokenSubset(shorter, longer)) {
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
  }
  return kept;
}

/**
 * Itemized money lists must never accumulate duplicates across merge turns
 * (a live run stored the same wage twice per person, doubling per-person
 * sums). Dedupe by normalized (person, label) key, keeping the LATEST
 * entry — so a corrected amount for the same item replaces instead of
 * duplicating. Pure plumbing: label wording is the model's job (the schema
 * demands stable labels); this only collapses exact key collisions.
 */
function dedupeBreakdown(raw: unknown): Array<Record<string, unknown>> {
  if (!Array.isArray(raw)) return [];
  const byKey = new Map<string, Record<string, unknown>>();
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const label = String(e.label ?? '').trim();
    const amount = Number(e.amount);
    if (!label || !Number.isFinite(amount)) continue;
    const person = String(e.person ?? '').trim().toLowerCase();
    const key = `${person}|${label.toLowerCase().replace(/\s+/g, ' ')}`;
    byKey.set(key, e); // latest wins — corrections replace
  }
  return [...byKey.values()];
}

/** `role` is an enum, not free text: lowercase, keep only the two party roles, else drop. */
function sanitizeRole(profile: Record<string, unknown>): void {
  if (!('role' in profile)) return;
  const role = String(profile.role ?? '').trim().toLowerCase();
  if (role === 'petitioner' || role === 'respondent') profile.role = role;
  else delete profile.role;
}

function strv(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function splitFullName(full: string): [string, string] {
  const parts = full.trim().split(/\s+/);
  return [parts[0] || '', parts.slice(1).join(' ')];
}

/**
 * Keep the canonical identity trio — `affiantName`, `spouseName`, `role` —
 * and the court-caption fields (petitioner… / respondent…) consistent.
 *
 * The caption fields are role-relative and go stale the moment `role`
 * flips (a petitioner-drafted profile whose owner then gets served becomes
 * a respondent profile, but the captions still name the user as
 * petitioner — which once made the story page say the user married
 * themself). `spouseName` is role-independent and survives the flip, so
 * after every write the captions are recomputed from the trio.
 *
 * `previousRole` is the role the stored captions were written under —
 * that's the role they must be read with when deriving a missing
 * `spouseName` from them. `explicitSpouse` (the write naming the spouse
 * outright via `spouseName`) is trusted verbatim — spouses CAN share a
 * full name (both Taylor Lautners, say). `incomingCaptionSpouse` (spouse
 * read out of the write's caption fields) wins over the stored value so
 * a correction is never clobbered, but is dropped when it matches the
 * user's own name — that's the stale-caption bug, not a same-named
 * spouse.
 */
function reconcileParties(
  profile: Record<string, unknown>,
  previousRole: string,
  opts: {
    explicitSpouse?: string;
    incomingCaptionSpouse?: string;
    clearSpouse?: boolean;
  } = {},
): void {
  const role = strv(profile.role) === 'respondent' ? 'respondent' : 'petitioner';
  const captionRole = strv(previousRole) === 'respondent' ? 'respondent' : 'petitioner';
  const self =
    strv(profile.affiantName) ||
    [strv(profile.firstName), strv(profile.lastName)].filter(Boolean).join(' ');
  const selfSide = role === 'respondent' ? 'respondent' : 'petitioner';
  const spouseSide = role === 'respondent' ? 'petitioner' : 'respondent';

  const sideName = (side: 'petitioner' | 'respondent'): string =>
    strv(profile[`${side}Name`]) ||
    [strv(profile[`${side}FirstName`]), strv(profile[`${side}LastName`])]
      .filter(Boolean)
      .join(' ');
  const setSide = (side: 'petitioner' | 'respondent', name: string): void => {
    const [first, last] = splitFullName(name);
    profile[`${side}Name`] = name;
    profile[`${side}FirstName`] = first;
    profile[`${side}LastName`] = last;
  };
  const clearSide = (side: 'petitioner' | 'respondent'): void => {
    delete profile[`${side}Name`];
    delete profile[`${side}FirstName`];
    delete profile[`${side}LastName`];
  };

  if (opts.clearSpouse) {
    delete profile.spouseName;
    clearSide(spouseSide);
    if (self) setSide(selfSide, self);
    return;
  }

  // Spouse resolution. Explicit and stored spouseName are canonical and
  // trusted verbatim (same-named spouses exist); only the caption-derived
  // guesses refuse the user's own name — a caption slot holding the user's
  // name is the stale-caption bug, not evidence they married their namesake.
  const captionSpouse = sideName(captionRole === 'respondent' ? 'petitioner' : 'respondent');
  const incomingCaptionSpouse = strv(opts.incomingCaptionSpouse);
  const spouse =
    strv(opts.explicitSpouse) ||
    (incomingCaptionSpouse && incomingCaptionSpouse !== self ? incomingCaptionSpouse : '') ||
    strv(profile.spouseName) ||
    (captionSpouse && captionSpouse !== self ? captionSpouse : '');

  if (spouse) profile.spouseName = spouse;

  if (!self && !spouse) return;
  if (self) setSide(selfSide, self);
  if (spouse) setSide(spouseSide, spouse);
  else if (self && sideName(spouseSide) === self) clearSide(spouseSide);
}

/** Load the user's life-story profile. Returns an empty profile when none exists. */
export async function getUserProfile(userId: number): Promise<UserProfile> {
  const result = await query<{ profile: unknown; facts: unknown }>(
    'SELECT profile, facts FROM user_profiles WHERE user_id = $1',
    [userId],
  );
  const row = result.rows[0];
  const profile =
    row && row.profile && typeof row.profile === 'object' && !Array.isArray(row.profile)
      ? (row.profile as Record<string, unknown>)
      : {};
  const facts = row && Array.isArray(row.facts) ? (row.facts as ProfileFact[]) : [];
  return { profile, facts };
}

/**
 * Fill gaps in `affidavitData` from the stored profile — never overwrite
 * anything the current conversation/document already has. Children merge
 * by identity; profile facts seed the conversation only when it has none
 * (a document's own facts always win).
 *
 * `scope` limits what flows in: 'general' hydrates identity + finances
 * only; 'family' also hydrates spouse/marriage/children/matter details.
 * Jurisdiction fields (state, county, residency) NEVER hydrate — routing
 * and residency must be confirmed per document.
 */
export function hydrateAffidavitData<T extends Record<string, unknown>>(
  stored: UserProfile,
  affidavitData: T,
  scope: HydrationScope = 'general',
): T {
  const hydrated: Record<string, unknown> = { ...affidavitData };

  const fields =
    scope === 'family' ? [...GENERAL_FIELDS, ...FAMILY_FIELDS] : GENERAL_FIELDS;
  for (const field of fields) {
    if (field === 'children') continue; // merged below
    if (isEmptyValue(hydrated[field]) && !isEmptyValue(stored.profile[field])) {
      hydrated[field] = stored.profile[field];
    }
  }

  if (scope === 'family') {
    const storedChildren = stored.profile.children;
    if (Array.isArray(storedChildren) && storedChildren.length > 0) {
      const merged = mergeChildren(
        storedChildren as unknown[],
        hydrated.children as unknown[] | undefined,
      );
      hydrated.children = merged;
      if (isEmptyValue(hydrated.hasMinorChildren)) hydrated.hasMinorChildren = merged.length > 0;
    }

    if (
      (!Array.isArray(hydrated.facts) || hydrated.facts.length === 0) &&
      stored.facts.length > 0
    ) {
      hydrated.facts = stored.facts.slice(0, MAX_PROFILE_FACTS);
    }
  }

  return hydrated as T;
}

/**
 * Merge a conversation turn's results back into the stored profile
 * (non-destructive: children merge by identity, facts append + dedupe by
 * content, empty values never erase stored ones). Upserts the row.
 *
 * `replaceChildren`: when the conversation was hydrated with the profile's
 * full children list (family scope), its post-turn list is authoritative —
 * replacing lets an explicit removal ("drop Emma from the record")
 * propagate to the durable profile instead of resurrecting on next login.
 */
export async function mergeUserProfile(
  userId: number,
  affidavitData: Record<string, unknown>,
  newFacts: ProfileFact[] = [],
  options: { replaceChildren?: boolean } = {},
): Promise<void> {
  const stored = await getUserProfile(userId);

  const profile: Record<string, unknown> = { ...stored.profile };
  for (const field of PROFILE_FIELDS) {
    if (field === 'children') continue;
    const incoming = affidavitData[field];
    if (isEmptyValue(incoming)) continue;
    // Itemized money lists: replace-per-person (utils/labeledAmounts) — the
    // incoming turn's entries for a person supersede everything stored for
    // that person, so label-variant duplicates ("Katie … wages" then
    // "Kathleen … wages") can never accumulate. Same semantics as the
    // orchestrator's doc-level accumulation — the two layers must agree.
    if (BREAKDOWN_FIELDS.includes(field)) {
      profile[field] = mergeLabeledAmounts(
        stored.profile[field] as unknown[] | undefined,
        incoming as unknown[],
      );
    } else if (PROPERTY_DEBT_FIELDS.includes(field)) {
      // REPLACE-PER-PERSON: the incoming list for THIS party (this exact
      // field name — one of the four petitioner/respondent × property/debt
      // buckets) supersedes what was stored for the same party. Persons the
      // turn does not mention keep their stored entries untouched because we
      // never enter this branch for their fields (incoming isEmpty). Same
      // semantics as the orchestrator's _applyFieldUpdates.
      profile[field] = dedupePropertyList(incoming);
    } else {
      profile[field] = incoming;
    }
  }
  // Stored rows that predate the dedupe may already hold exact-key
  // duplicates — scrub them even on turns that did not touch the breakdowns.
  for (const field of BREAKDOWN_FIELDS) {
    if (Array.isArray(profile[field])) profile[field] = dedupeBreakdown(profile[field]);
  }
  sanitizeRole(profile);

  // ── Semantic-fact promotion (extractionQuality rule 17 backstop) ──
  // The TX petition template branches on the structured `respondentAddressUnknown`
  // flag: an unset flag emits an EMPTY residence clause and drops the
  // alternative-service caveat. Even with the flag in the tool schema's
  // `required` array, Luna via the Responses API occasionally records a
  // "respondent_whereabouts" fact but skips the structured flag (v10-A replay).
  // Promote the machine-typed fact subcategory to the machine-typed field —
  // pure shape check on schema-typed fact metadata; NO language parsing of the
  // fact content string. The subcategory is a discrete tag the LLM already
  // assigned per the extracted_facts schema, so this is a data-structural
  // promotion in the spirit of LLM-first (the model classifies; the plumbing
  // routes).
  // "not yet set" means truly absent — do NOT override an explicit `false` the
  // LLM emitted this turn: the structured field is authoritative when present.
  const factCandidates: unknown[] = [
    ...(Array.isArray(newFacts) ? newFacts : []),
    ...(Array.isArray(affidavitData.facts) ? (affidavitData.facts as unknown[]) : []),
  ];
  const factSub = (f: unknown): string =>
    String((f as Record<string, unknown> | null)?.subcategory ?? '').trim().toLowerCase();
  const factCat = (f: unknown): string =>
    String((f as Record<string, unknown> | null)?.category ?? '').trim().toLowerCase();
  const factPlace = (f: unknown): string => {
    const r = f as Record<string, unknown> | null;
    const v = r?.placeValue ?? r?.place_value;
    return typeof v === 'string' ? v.trim() : '';
  };
  const factNumeric = (f: unknown): number | null => {
    const r = f as Record<string, unknown> | null;
    const v = r?.numericValue ?? r?.numeric_value;
    return typeof v === 'number' && Number.isFinite(v) ? v : null;
  };

  // Mari v14 replay: the primary LLM tagged the whereabouts fact with
  // subcategory variants ("whereabouts", "respondent_address_unknown",
  // "residence_unknown", or with category=service and subcategory that
  // merely contained "whereabout") — strict === 'respondent_whereabouts'
  // let those variants through unpromoted. Broaden the check to any
  // whereabouts-ish tag on either the subcategory OR the category. Still a
  // pure shape check on model-classified metadata strings, no content
  // prose parsing.
  const isWhereaboutsFact = (f: unknown): boolean => {
    if (!f || typeof f !== 'object') return false;
    const sub = factSub(f);
    const cat = factCat(f);
    if (sub.includes('whereabout') || cat.includes('whereabout')) return true;
    if (sub === 'respondent_address_unknown') return true;
    if (sub === 'residence_unknown' || sub === 'respondent_location') return true;
    return false;
  };

  if (profile.respondentAddressUnknown === undefined || profile.respondentAddressUnknown === null) {
    const hasWhereaboutsFact = factCandidates.some((f) => isWhereaboutsFact(f));
    if (hasWhereaboutsFact) profile.respondentAddressUnknown = true;
  }

  // v11-B: schema-typed fact-companion promotion. When a whereabouts fact
  // carries a place_value, route that machine-typed place into the structured
  // respondentSuspectedLocation scalar the petition template reads. The
  // model's own place_value (hedge-stripped per schema description) is trusted
  // as-is — no string parsing of the fact content prose. Only fires when the
  // structured field is truly absent; an explicit value the LLM emitted this
  // turn is authoritative and never overridden.
  if (profile.respondentSuspectedLocation === undefined || profile.respondentSuspectedLocation === null || profile.respondentSuspectedLocation === '') {
    for (const f of factCandidates) {
      if (!isWhereaboutsFact(f)) continue;
      const place = factPlace(f);
      if (place) {
        profile.respondentSuspectedLocation = place;
        break;
      }
    }
  }

  // v14-C: last-line rescue. Both the primary Luna schema call and the
  // orchestrator-side companion promoter can miss the place_value; when a
  // whereabouts fact exists but respondentSuspectedLocation is still empty,
  // run ONE tightly-scoped LLM call over the fact's sourceQuote (the user's
  // verbatim words) to recover the hedge-stripped place. LLM-first: no regex
  // over user language; the shape check on schema-typed subcategory selects
  // the target, the model does the extraction. Fail-open on any error.
  if (
    profile.respondentSuspectedLocation === undefined ||
    profile.respondentSuspectedLocation === null ||
    profile.respondentSuspectedLocation === ''
  ) {
    const whereaboutsFact = factCandidates.find((f) => isWhereaboutsFact(f)) as
      | Record<string, unknown>
      | undefined;
    const quote = String(whereaboutsFact?.sourceQuote ?? '').trim();
    const content = String(whereaboutsFact?.content ?? '').trim();
    const rescueText = quote || content;
    if (rescueText.length > 0) {
      try {
        const svc = (global as unknown as { openAIService?: { chat?: Function } })
          .openAIService;
        if (svc && typeof svc.chat === 'function') {
          // eslint-disable-next-line no-console
          console.log(
            `[profile-rescue] invoking gpt-5-nano rescue for respondentSuspectedLocation, textLen=${rescueText.length}`,
          );
          const completion = await svc.chat(
            [
              {
                role: 'system',
                content:
                  'Extract the respondent\'s suspected LOCATION from the given text and return a JSON object {"place":"..."}. ' +
                  'The text is one user message from a divorce interview describing where the respondent might be. ' +
                  'Rules: (1) strip leading hedges ("possibly", "maybe", "I think", "somewhere in", "could be", "not sure", "I don\'t know") before emitting; ' +
                  '(2) keep disjunctions intact ("Louisiana or Mississippi"); ' +
                  '(3) if the text names NO place, emit "" (empty string); ' +
                  '(4) never invent a place not present in the text.',
              },
              { role: 'user', content: rescueText },
            ],
            {
              model: 'gpt-5-nano',
              response_format: {
                type: 'json_schema',
                json_schema: {
                  name: 'place_extraction',
                  strict: true,
                  schema: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['place'],
                    properties: {
                      place: { type: 'string', description: 'Hedge-stripped place name(s); "" if none.' },
                    },
                  },
                },
              },
              temperature: 0,
              max_tokens: 3000,
            },
          );
          const contentStr = completion?.choices?.[0]?.message?.content;
          if (typeof contentStr === 'string' && contentStr.length > 0) {
            const parsed = JSON.parse(contentStr);
            const place = typeof parsed?.place === 'string' ? parsed.place.trim() : '';
            // eslint-disable-next-line no-console
            console.log(`[profile-rescue] rescue returned place="${place}"`);
            if (place) {
              profile.respondentSuspectedLocation = place;
              // Also promote respondentAddressUnknown when it's absent — a
              // whereabouts fact with a hedged place is by definition an
              // unknown-address turn.
              if (
                profile.respondentAddressUnknown === undefined ||
                profile.respondentAddressUnknown === null
              ) {
                profile.respondentAddressUnknown = true;
              }
            }
          } else {
            // eslint-disable-next-line no-console
            console.log('[profile-rescue] empty response from rescue call');
          }
        } else {
          // eslint-disable-next-line no-console
          console.log('[profile-rescue] global.openAIService unavailable; skipping rescue');
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.log(
          `[profile-rescue] rescue LLM threw ${(err as Error)?.message} (fail-open)`,
        );
      }
    }
  }

  // v11-B: numberOfChildren promotion from schema-typed numeric_value on a
  // children fact. Alison persona: the LLM narrated "two adults" without ever
  // emitting the structured count. When a fact tagged with the children
  // category/subcategory carries a numeric_value ≥ 0, promote it. Explicit
  // structured value wins — same "truly absent only" guard as above.
  // Alison (CA, 2 adult children) replay: the LLM tagged the fact with
  // subcategory=adult_children — a legitimate model-classified variant that
  // the strict === 'children' check let slip past. Match any children-ish
  // subcategory tag (children / adult_children / minor_children) OR
  // category=children. Still a shape check on model metadata, not content.
  const isChildrenCountFact = (f: unknown): boolean => {
    const sub = factSub(f);
    const cat = factCat(f);
    if (cat === 'children') return true;
    if (sub === 'children' || sub === 'adult_children' || sub === 'minor_children') return true;
    // Tavita (FL, no kids) replay: Luna tagged the "no children from this
    // marriage" fact with category=parental subcategory=children_of_marriage
    // — a legitimate model-classified variant that the strict list above let
    // slip past. Broaden to any subcategory that names children in the
    // plural (children_of_marriage, no_children, our_children, …), so
    // downstream count promotion and the merge-time rescue LLM can see the
    // fact. Still a shape check on model-classified metadata strings, no
    // content parsing. Guarded against "child_support" / "child_care" —
    // those are the singular "child", not the plural "children" this rule
    // targets, so they never match.
    if (sub.includes('children')) return true;
    return false;
  };
  if (profile.numberOfChildren === undefined || profile.numberOfChildren === null) {
    for (const f of factCandidates) {
      if (!f || typeof f !== 'object') continue;
      if (!isChildrenCountFact(f)) continue;
      const n = factNumeric(f);
      if (n !== null && n >= 0 && Number.isInteger(n)) {
        profile.numberOfChildren = n;
        break;
      }
    }
  }

  // v22-B: last-line rescue LLM call for numberOfChildren (mirror of the
  // respondentSuspectedLocation rescue above). Two failure shapes fall
  // through everything above:
  //   • Alison (CA, 2 adult): the primary schema call and the orchestrator
  //     promoter both missed numeric_value on an adult_children fact; the
  //     fact prose ("two adult children, ages 24 and 21") clearly names the
  //     count but the structured field stayed null. The zero-backstop below
  //     is suppressed because a children fact exists — but the count is not
  //     zero, it's two, so silence there is the correct behavior. A focused
  //     LLM extract recovers the count from the fact prose / sourceQuote.
  //   • Tavita (FL, no kids): the fact was tagged category=parental
  //     subcategory=children_of_marriage — now matched by the widened
  //     isChildrenCountFact — but again with no numeric_value. Rescue
  //     extracts 0 from "no children from this marriage".
  // LLM-first (no regex over user language). Fail-open on any error: the
  // downstream zero-backstop still gets its shot for the Tavita-shape case
  // that lands with `hasMinorChildren:false` from an earlier turn.
  if (profile.numberOfChildren === undefined || profile.numberOfChildren === null) {
    const childrenFact = factCandidates.find((f) => isChildrenCountFact(f)) as
      | Record<string, unknown>
      | undefined;
    const quote = String(childrenFact?.sourceQuote ?? '').trim();
    const content = String(childrenFact?.content ?? '').trim();
    // Provide BOTH the sourceQuote (verbatim user words — the plainest count
    // signal) and the fact content (cleaned court-usable statement) so the
    // rescue model has the widest evidence base. Concatenate with a labeled
    // separator so the model can attend to either.
    const rescueText = [
      quote ? `USER SAID: ${quote}` : '',
      content ? `RECORDED FACT: ${content}` : '',
    ].filter(Boolean).join('\n');
    if (rescueText.length > 0) {
      try {
        const svc = (global as unknown as { openAIService?: { chat?: Function } })
          .openAIService;
        if (svc && typeof svc.chat === 'function') {
          // eslint-disable-next-line no-console
          console.log(
            `[profile-rescue] invoking gpt-5-nano rescue for numberOfChildren, textLen=${rescueText.length}`,
          );
          const completion = await svc.chat(
            [
              {
                role: 'system',
                content:
                  'Extract the COUNT of children of the marriage from the given text and return a JSON object {"count": N} where N is a non-negative integer (or -1 when the text does not state or imply a count). ' +
                  'The text is one children-related fact from a divorce interview, plus the user\'s verbatim words that produced it. ' +
                  'Rules: ' +
                  '(1) "no children" / "no kids" / "childless" / "none from this marriage" → count 0; ' +
                  '(2) "two adult kids" / "our children are 24 and 21" → count 2 (adult children still count — the field is the TOTAL count of children of the marriage, minor or adult); ' +
                  '(3) "three kids ages 7, 9, and 12" → 3; ' +
                  '(4) NEVER sum or concatenate ages ("24 and 21" is 2, not 45 and not 2421); ' +
                  '(5) if the text does not state or imply a specific count, emit -1; ' +
                  '(6) never invent a count not supported by the text.',
              },
              { role: 'user', content: rescueText },
            ],
            {
              model: 'gpt-5-nano',
              response_format: {
                type: 'json_schema',
                json_schema: {
                  name: 'children_count_extraction',
                  strict: true,
                  schema: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['count'],
                    properties: {
                      count: {
                        type: 'integer',
                        description: 'Non-negative count of children of the marriage; -1 when the text does not state a count.',
                      },
                    },
                  },
                },
              },
              temperature: 0,
              max_tokens: 3000,
            },
          );
          const contentStr = completion?.choices?.[0]?.message?.content;
          if (typeof contentStr === 'string' && contentStr.length > 0) {
            const parsed = JSON.parse(contentStr);
            const count = typeof parsed?.count === 'number' && Number.isInteger(parsed.count)
              ? parsed.count
              : -1;
            // eslint-disable-next-line no-console
            console.log(`[profile-rescue] rescue returned count=${count}`);
            if (count >= 0) {
              profile.numberOfChildren = count;
              // Zero count implies no minor children — safe to fill only when
              // the structured flag is truly absent (never override an
              // explicit boolean the LLM emitted this turn).
              if (
                count === 0 &&
                (profile.hasMinorChildren === undefined || profile.hasMinorChildren === null)
              ) {
                profile.hasMinorChildren = false;
              }
            }
          } else {
            // eslint-disable-next-line no-console
            console.log('[profile-rescue] empty response from children-count rescue');
          }
        } else {
          // eslint-disable-next-line no-console
          console.log('[profile-rescue] global.openAIService unavailable; skipping children-count rescue');
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.log(
          `[profile-rescue] children-count rescue LLM threw ${(err as Error)?.message} (fail-open)`,
        );
      }
    }
  }

  // v21-A: groundsForDivorce promotion from schema-typed grounds_value on a
  // grounds fact. David (NY, "irretrievable breakdown") and Amara (GA,
  // "documented cruelty") both narrated grounds explicitly; the petition
  // template rendered the correct statute via facts inference, but
  // profile.groundsForDivorce silently stayed null because the primary
  // schema call omitted the structured `grounds` field. The orchestrator's
  // companion promoter fills a `groundsValue` on the fact whenever the
  // fact category/subcategory is grounds; this backstop routes it into
  // the durable profile field the templates and story page read.
  // Same "truly absent only" guard as the whereabouts/count promotions
  // — an explicit slug the LLM emitted this turn is never overridden.
  const isGroundsFact = (f: unknown): boolean => {
    const cat = factCat(f);
    const sub = factSub(f);
    if (cat === 'grounds' || sub === 'grounds' || sub.includes('grounds')) return true;
    // v23: statutory-ground-name subcategories. Luna occasionally tags a
    // grounds narration with category='evidence' (or 'fault', 'reason', …)
    // and puts the statutory slug on the subcategory instead — the Amara
    // (GA, cruel treatment) v23 replay emitted
    // {category:'evidence', subcategory:'cruel_treatment', …}. Match those
    // by the model-classified statutory token on the subcategory. Still a
    // shape check on schema-typed metadata; no content-prose parsing.
    return STATUTORY_GROUND_TOKENS.some((tok) => sub.includes(tok));
  };
  const factGrounds = (f: unknown): string => {
    const r = f as Record<string, unknown> | null;
    const v = r?.groundsValue ?? r?.grounds_value;
    return typeof v === 'string' ? v.trim() : '';
  };
  // Amara replay (v22-A): even with the "OMIT the field" schema guidance and
  // the v20-B companion promoter, Luna occasionally still writes a forbidden
  // sentinel ("other", "unknown", "unclear", …) into profile.groundsForDivorce.
  // The plain "truly absent" gate below then treats it as authoritative and
  // never overwrites, so the petition template renders the placeholder as-if
  // it were a real statutory slug. Normalize the sentinels to absent BEFORE
  // the promotion loop, so a real grounds_value on a companion fact wins.
  // Pure shape check on a schema-typed slug — no language parsing.
  const rawGrounds =
    typeof profile.groundsForDivorce === 'string' ? profile.groundsForDivorce.trim().toLowerCase() : '';
  if (rawGrounds && FORBIDDEN_GROUNDS_SENTINELS.has(rawGrounds)) {
    delete profile.groundsForDivorce;
  }
  if (
    profile.groundsForDivorce === undefined ||
    profile.groundsForDivorce === null ||
    profile.groundsForDivorce === ''
  ) {
    for (const f of factCandidates) {
      if (!f || typeof f !== 'object') continue;
      if (!isGroundsFact(f)) continue;
      const slug = factGrounds(f);
      if (slug) {
        profile.groundsForDivorce = slug;
        break;
      }
    }
  }

  // v22-C: last-line rescue LLM call for groundsForDivorce (mirror of the
  // respondentSuspectedLocation and numberOfChildren rescues above). Amara
  // (GA, "documented cruelty") and Mari (TX, "he hurt me physically") replays:
  // both the primary schema call and the v20-B companion promoter left
  // grounds_value empty, so the promotion loop above had nothing to route.
  // A grounds fact clearly exists — the model tagged it category/subcategory
  // grounds — but the canonical statute slug never made it into the profile.
  // A focused LLM extract reads the fact prose + sourceQuote + jurisdiction
  // state code and returns the snake_case slug (cruel_treatment for GA
  // §19-5-3(10), insupportability for TX §6.001, irretrievable_breakdown
  // for NY §170(7), …). LLM-first — no regex over user language, no static
  // per-state slug tables in code. Fail-open on any error. Never overrides
  // an explicit valid slug (sentinel scrub above already normalized "other"/
  // "unknown"/… to absent, so a stored real slug survives).
  const rescueGroundsRaw =
    typeof profile.groundsForDivorce === 'string' ? profile.groundsForDivorce.trim().toLowerCase() : '';
  const rescueGroundsAbsent =
    profile.groundsForDivorce === undefined ||
    profile.groundsForDivorce === null ||
    profile.groundsForDivorce === '' ||
    (rescueGroundsRaw !== '' && FORBIDDEN_GROUNDS_SENTINELS.has(rescueGroundsRaw));
  if (rescueGroundsAbsent) {
    const groundsFact = factCandidates.find((f) => isGroundsFact(f)) as
      | Record<string, unknown>
      | undefined;
    const quote = String(groundsFact?.sourceQuote ?? '').trim();
    const content = String(groundsFact?.content ?? '').trim();
    const rescueText = [
      quote ? `USER SAID: ${quote}` : '',
      content ? `RECORDED FACT: ${content}` : '',
    ].filter(Boolean).join('\n');
    const jurisdiction =
      (typeof profile.state === 'string' && profile.state.trim()) ||
      (typeof affidavitData.state === 'string' && (affidavitData.state as string).trim()) ||
      '';
    if (rescueText.length > 0) {
      try {
        const svc = (global as unknown as { openAIService?: { chat?: Function } })
          .openAIService;
        if (svc && typeof svc.chat === 'function') {
          // eslint-disable-next-line no-console
          console.log(
            `[profile-rescue] invoking gpt-5-nano rescue for groundsForDivorce, textLen=${rescueText.length}, jurisdiction=${jurisdiction || 'unknown'}`,
          );
          const completion = await svc.chat(
            [
              {
                role: 'system',
                content:
                  'Extract the canonical statutory GROUNDS FOR DIVORCE from the given text and return a JSON object {"grounds_slug":"..."}. ' +
                  'The text is one grounds-related fact from a divorce interview, plus the user\'s verbatim words that produced it. ' +
                  `Filing jurisdiction (US state / CA province code): ${jurisdiction || 'unknown'}. ` +
                  'Rules: ' +
                  '(1) emit the snake_case slug used by that jurisdiction\'s divorce statute — e.g. TX §6.001 → "insupportability", ' +
                  'GA §19-5-3(10) → "cruel_treatment", NY DRL §170(7) → "irretrievable_breakdown", CA Fam §2310(a) → "irreconcilable_differences", ' +
                  'FL §61.052 → "irretrievably_broken", ON (Divorce Act) → "separation_one_year"; ' +
                  '(2) map lay language to the statutory slug: "physical abuse" / "he hurt me" / "cruelty" → cruel_treatment (or the jurisdiction\'s equivalent, e.g. TX has both "cruelty" and "insupportability"; prefer the fault ground the user actually described); ' +
                  '(3) "we grew apart" / "no fault" / "just want out" → the jurisdiction\'s no-fault slug; ' +
                  '(4) "documented cruelty" → cruel_treatment; ' +
                  '(5) if the text is only a placeholder ("other", "unknown", "unclear") with no substance, emit "" (empty string); ' +
                  '(6) if the text names NO grounds substance at all, emit ""; ' +
                  '(7) never invent grounds not supported by the text.',
              },
              { role: 'user', content: rescueText },
            ],
            {
              model: 'gpt-5-nano',
              response_format: {
                type: 'json_schema',
                json_schema: {
                  name: 'grounds_extraction',
                  strict: true,
                  schema: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['grounds_slug'],
                    properties: {
                      grounds_slug: {
                        type: 'string',
                        description: 'Canonical snake_case grounds slug for the filing jurisdiction; "" when the text names no grounds.',
                      },
                    },
                  },
                },
              },
              temperature: 0,
              max_tokens: 3000,
            },
          );
          const contentStr = completion?.choices?.[0]?.message?.content;
          if (typeof contentStr === 'string' && contentStr.length > 0) {
            const parsed = JSON.parse(contentStr);
            const slug = typeof parsed?.grounds_slug === 'string' ? parsed.grounds_slug.trim() : '';
            const slugLc = slug.toLowerCase();
            // eslint-disable-next-line no-console
            console.log(`[profile-rescue] rescue returned grounds_slug="${slug}"`);
            // Never accept a returned sentinel — it would just re-poison the
            // field we scrubbed above. Only substantive slugs win.
            if (slug && !FORBIDDEN_GROUNDS_SENTINELS.has(slugLc)) {
              profile.groundsForDivorce = slug;
            }
          } else {
            // eslint-disable-next-line no-console
            console.log('[profile-rescue] empty response from grounds rescue');
          }
        } else {
          // eslint-disable-next-line no-console
          console.log('[profile-rescue] global.openAIService unavailable; skipping grounds rescue');
        }
      } catch (err) {
        // eslint-disable-next-line no-console
        console.log(
          `[profile-rescue] grounds rescue LLM threw ${(err as Error)?.message} (fail-open)`,
        );
      }
    }
  }

  // Recompute the role-aware money totals from the merged itemizations so
  // the stored scalars can never disagree with the stored breakdowns
  // (mirrors the orchestrator: monthlyIncome = the USER's own entries only,
  // untagged entries count as the user's own; NEVER a household total).
  const totalsRole = strv(profile.role) === 'respondent' ? 'respondent' : 'petitioner';
  const totalsSpouseRole = totalsRole === 'respondent' ? 'petitioner' : 'respondent';
  const incomeItems = profile.incomeBreakdown;
  if (Array.isArray(incomeItems) && incomeItems.length > 0) {
    const personOf = (entry: unknown): string =>
      String((entry as Record<string, unknown> | null)?.person ?? '').trim().toLowerCase();
    const own = incomeItems.filter((e) => personOf(e) === totalsRole || personOf(e) === '');
    const spouse = incomeItems.filter((e) => personOf(e) === totalsSpouseRole);
    if (own.length > 0) profile.monthlyIncome = totalOf(own);
    if (spouse.length > 0) profile.spouseMonthlyIncome = totalOf(spouse);
  }
  const expenseItems = profile.expenseBreakdown;
  if (Array.isArray(expenseItems) && expenseItems.length > 0) {
    profile.monthlyExpenses = totalOf(expenseItems);
  }
  // A turn that named the spouse — canonically or via a caption field read
  // under the post-merge role — outranks the stored spouseName.
  const mergedRole = strv(profile.role) === 'respondent' ? 'respondent' : 'petitioner';
  const incomingCaptionSpouse =
    mergedRole === 'respondent'
      ? strv(affidavitData.petitionerName) ||
        [strv(affidavitData.petitionerFirstName), strv(affidavitData.petitionerLastName)]
          .filter(Boolean)
          .join(' ')
      : strv(affidavitData.respondentName) ||
        [strv(affidavitData.respondentFirstName), strv(affidavitData.respondentLastName)]
          .filter(Boolean)
          .join(' ');
  reconcileParties(profile, strv(stored.profile.role), {
    explicitSpouse: strv(affidavitData.spouseName),
    incomingCaptionSpouse,
  });
  profile.children =
    options.replaceChildren && Array.isArray(affidavitData.children)
      ? (affidavitData.children as unknown[]).filter((c) => c && typeof c === 'object')
      : mergeChildren(
          stored.profile.children as unknown[] | undefined,
          affidavitData.children as unknown[] | undefined,
        );
  if ((profile.children as unknown[]).length === 0) delete profile.children;

  // Backstop: "no minor children" implies a zero count. Tavita (FL, no kids)
  // replay: the LLM emitted has_minor_children: false but omitted
  // number_of_children entirely, leaving profile.numberOfChildren === null and
  // the story page rendering "null children". When the boolean says no
  // (false) OR the LLM explicitly cleared it (null) AND no children survived
  // the merge AND no children-count fact was recorded (an adult-children
  // fact could still supply a count via the v11-B promotion above) AND the
  // structured count is still absent, fill in 0. Never override an explicit
  // count the LLM already emitted, and never fire when hasMinorChildren is
  // simply untouched this turn (undefined) — that would set 0 for turns
  // that never touched the children topic at all.
  const hmc = profile.hasMinorChildren as boolean | null | undefined;
  const anyChildrenCountFact = factCandidates.some(isChildrenCountFact);
  if (
    (hmc === false || hmc === null) &&
    (profile.numberOfChildren === undefined || profile.numberOfChildren === null) &&
    (!Array.isArray(profile.children) || (profile.children as unknown[]).length === 0) &&
    !anyChildrenCountFact
  ) {
    profile.numberOfChildren = 0;
  }

  // Corrections retire superseded stored facts. The orchestrators fold the
  // model's superseded_facts into affidavitData as `retiredFactStatements`
  // (rewritten each turn); matching here is the same exact/substring
  // plumbing on normalized text the orchestrators use — conservative: an
  // unmatched statement retires nothing, and removals are capped per turn.
  const retiredStatements = sanitizeSupersededStatements(affidavitData.retiredFactStatements);
  const { kept: survivingFacts } = retireFacts(stored.facts, retiredStatements);
  const retiredKeys = retiredStatements.map(normalizeFactText);
  const isRetired = (key: string): boolean =>
    retiredKeys.some((r) => key === r || key.includes(r) || r.includes(key));

  const seen = new Set(survivingFacts.map(normalizeFactContent).filter(Boolean));
  const mergedFacts = [...survivingFacts];
  const candidates = [
    ...(Array.isArray(newFacts) ? newFacts : []),
    // Also sweep the conversation's full fact list — covers facts collected
    // before this deploy or via paths that don't report newFacts.
    ...(Array.isArray(affidavitData.facts) ? (affidavitData.facts as ProfileFact[]) : []),
  ];
  for (const fact of candidates) {
    if (!fact || typeof fact !== 'object') continue;
    const key = normalizeFactContent(fact);
    if (!key || seen.has(key)) continue;
    // A retired statement must not re-enter through the conversation sweep.
    if (retiredKeys.length > 0 && isRetired(key)) continue;
    seen.add(key);
    mergedFacts.push(fact);
  }
  if (mergedFacts.length > MAX_PROFILE_FACTS) {
    mergedFacts.splice(0, mergedFacts.length - MAX_PROFILE_FACTS);
  }

  await query(
    `INSERT INTO user_profiles (user_id, profile, facts)
     VALUES ($1, $2::jsonb, $3::jsonb)
     ON CONFLICT (user_id)
     DO UPDATE SET profile = EXCLUDED.profile, facts = EXCLUDED.facts`,
    [userId, JSON.stringify(profile), JSON.stringify(mergedFacts)],
  );
}

/**
 * Best-effort variant for the chat hot path: a profile write must never fail
 * the user's chat turn.
 */
export async function mergeUserProfileSafe(
  userId: number,
  affidavitData: Record<string, unknown>,
  newFacts: ProfileFact[] = [],
  options: { replaceChildren?: boolean } = {},
): Promise<void> {
  try {
    await mergeUserProfile(userId, affidavitData, newFacts, options);
  } catch (err) {
    logger.error('user_profile_merge_failed', { userId, error: (err as Error).message });
  }
}

/** Erase the stored life story (privacy control). */
export async function deleteUserProfile(userId: number): Promise<void> {
  await query('DELETE FROM user_profiles WHERE user_id = $1', [userId]);
}

/**
 * Court/filing events extracted from uploaded response documents or set by
 * the user — rendered on the life timeline. Not hydrated into interviews.
 */
export type KeyEvent = { label: string; date: string; source?: string };

const MAX_KEY_EVENTS = 40;

function sanitizeKeyEvents(raw: unknown): KeyEvent[] {
  if (!Array.isArray(raw)) return [];
  const events: KeyEvent[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const e = entry as Record<string, unknown>;
    const label = String(e.label ?? '').trim().slice(0, 120);
    const date = String(e.date ?? '').trim().slice(0, 40);
    if (!label || !date) continue;
    const event: KeyEvent = { label, date };
    const source = String(e.source ?? '').trim().slice(0, 200);
    if (source) event.source = source;
    events.push(event);
    if (events.length >= MAX_KEY_EVENTS) break;
  }
  return events;
}

/**
 * Explicit user edit of the life story ("fix story" on /profile).
 * Unlike mergeUserProfile, provided keys are SET verbatim: an empty
 * string/null clears the field, and `children` replaces the list
 * (identity aliases re-stamped). Only whitelisted fields apply.
 */
export async function updateUserProfile(
  userId: number,
  patch: Record<string, unknown>,
): Promise<UserProfile> {
  const stored = await getUserProfile(userId);
  const profile: Record<string, unknown> = { ...stored.profile };

  for (const field of PROFILE_FIELDS) {
    if (!(field in patch)) continue;
    if (field === 'children') continue;
    const value = patch[field];
    if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
      delete profile[field];
    } else {
      profile[field] = typeof value === 'string' ? value.trim().slice(0, 500) : value;
    }
  }

  sanitizeRole(profile);
  reconcileParties(profile, strv(stored.profile.role), {
    explicitSpouse: strv(patch.spouseName),
    // A patch that names spouseName but blank is an explicit "no spouse".
    clearSpouse: 'spouseName' in patch && strv(patch.spouseName) === '',
  });

  if ('children' in patch) {
    const replaced = mergeChildren([], patch.children as unknown[] | undefined);
    if (replaced.length > 0) profile.children = replaced;
    else delete profile.children;
  }

  if ('keyEvents' in patch) {
    const events = sanitizeKeyEvents(patch.keyEvents);
    if (events.length > 0) profile.keyEvents = events;
    else delete profile.keyEvents;
  }

  await query(
    `INSERT INTO user_profiles (user_id, profile, facts)
     VALUES ($1, $2::jsonb, $3::jsonb)
     ON CONFLICT (user_id)
     DO UPDATE SET profile = EXCLUDED.profile`,
    [userId, JSON.stringify(profile), JSON.stringify(stored.facts)],
  );
  return { profile, facts: stored.facts };
}

/** Append key events (from an ingested document), deduped by label+date. */
export async function appendKeyEvents(userId: number, events: KeyEvent[]): Promise<void> {
  const stored = await getUserProfile(userId);
  const existing = sanitizeKeyEvents(stored.profile.keyEvents);
  const seen = new Set(existing.map((e) => `${e.label.toLowerCase()}|${e.date}`));
  const merged = [...existing];
  for (const event of sanitizeKeyEvents(events)) {
    const key = `${event.label.toLowerCase()}|${event.date}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(event);
  }
  await updateUserProfile(userId, { keyEvents: merged });
}
