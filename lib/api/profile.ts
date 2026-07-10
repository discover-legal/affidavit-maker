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
 */
const PROFILE_FIELDS: readonly string[] = [
  // Identity
  'firstName', 'lastName', 'affiantName',
  'petitionerFirstName', 'petitionerLastName', 'petitionerName',
  'respondentFirstName', 'respondentLastName', 'respondentName',
  // Location / residency
  'state', 'county', 'residencyStateMonths', 'residencyCountyDays', 'residencyBasis',
  // Marriage
  'marriageDate', 'marriageCity', 'marriageStateName', 'marriageLocation',
  'marriagePlace', 'marriageType', 'separationDate',
  // Family
  'children', 'hasMinorChildren', 'numberOfChildren',
  'custodyArrangement', 'custodyType', 'custodyPreference', 'custodyDetails',
  // Finances (used by support + fee-waiver phases)
  'monthlyIncome', 'monthlyExpenses', 'assetsDescription', 'dependentsCount',
  // Safety / service details that follow the person, not the document
  'hasProtectiveOrder', 'respondentAddress', 'respondentMilitaryStatus',
];

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
 */
export function hydrateAffidavitData<T extends Record<string, unknown>>(
  stored: UserProfile,
  affidavitData: T,
): T & { profileHydrated?: boolean } {
  const hydrated: Record<string, unknown> = { ...affidavitData };
  let changed = false;

  for (const field of PROFILE_FIELDS) {
    if (field === 'children') continue; // merged below
    if (isEmptyValue(hydrated[field]) && !isEmptyValue(stored.profile[field])) {
      hydrated[field] = stored.profile[field];
      changed = true;
    }
  }

  const storedChildren = stored.profile.children;
  if (Array.isArray(storedChildren) && storedChildren.length > 0) {
    const merged = mergeChildren(
      storedChildren as unknown[],
      hydrated.children as unknown[] | undefined,
    );
    if (merged.length !== ((hydrated.children as unknown[] | undefined)?.length ?? 0)) {
      changed = true;
    }
    hydrated.children = merged;
    if (isEmptyValue(hydrated.hasMinorChildren)) hydrated.hasMinorChildren = merged.length > 0;
  }

  if (
    (!Array.isArray(hydrated.facts) || hydrated.facts.length === 0) &&
    stored.facts.length > 0
  ) {
    hydrated.facts = stored.facts.slice(0, MAX_PROFILE_FACTS);
    changed = true;
  }

  if (changed) hydrated.profileHydrated = true;
  return hydrated as T & { profileHydrated?: boolean };
}

/**
 * Merge a conversation turn's results back into the stored profile
 * (non-destructive: children merge by identity, facts append + dedupe by
 * content, empty values never erase stored ones). Upserts the row.
 */
export async function mergeUserProfile(
  userId: number,
  affidavitData: Record<string, unknown>,
  newFacts: ProfileFact[] = [],
): Promise<void> {
  const stored = await getUserProfile(userId);

  const profile: Record<string, unknown> = { ...stored.profile };
  for (const field of PROFILE_FIELDS) {
    if (field === 'children') continue;
    const incoming = affidavitData[field];
    if (!isEmptyValue(incoming)) profile[field] = incoming;
  }
  profile.children = mergeChildren(
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
): Promise<void> {
  try {
    await mergeUserProfile(userId, affidavitData, newFacts);
  } catch (err) {
    logger.error('user_profile_merge_failed', { userId, error: (err as Error).message });
  }
}

/** Erase the stored life story (privacy control). */
export async function deleteUserProfile(userId: number): Promise<void> {
  await query('DELETE FROM user_profiles WHERE user_id = $1', [userId]);
}
