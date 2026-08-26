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

// CommonJS util shared with the orchestrators (services/ tree).
const { mergeChildren } = require('@/utils/childrenMerge') as {
  mergeChildren: (a: unknown[] | undefined, b: unknown[] | undefined) => Record<string, unknown>[];
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
  'monthlyIncome', 'monthlyExpenses', 'incomeBreakdown', 'expenseBreakdown',
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
  'hasProperty', 'hasDebts', 'propertyAgreement',
  'serviceMethod',
  'hasProtectiveOrder', 'respondentAddress', 'respondentMilitaryStatus',
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
    if (!isEmptyValue(incoming)) profile[field] = incoming;
  }
  sanitizeRole(profile);
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

  const seen = new Set(stored.facts.map(normalizeFactContent).filter(Boolean));
  const mergedFacts = [...stored.facts];
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
