/**
 * Persistence for the v2 LifeStory (core/profile). One JSONB column on the
 * per-user `user_profiles` row (migration 022), so RLS and the privacy erase
 * cover it exactly like the v1 profile.
 */

import { query } from '@/lib/db';
import type { LifeStory } from '@/core/profile/types';

export async function getLifeStory(userId: number): Promise<LifeStory | null> {
  const result = await query<{ life_story: unknown }>(
    'SELECT life_story FROM user_profiles WHERE user_id = $1',
    [userId],
  );
  const raw = result.rows[0]?.life_story;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  return raw as LifeStory;
}

export async function saveLifeStory(userId: number, story: LifeStory): Promise<void> {
  await query(
    `INSERT INTO user_profiles (user_id, life_story)
     VALUES ($1, $2::jsonb)
     ON CONFLICT (user_id) DO UPDATE
       SET life_story = EXCLUDED.life_story,
           updated_at = CURRENT_TIMESTAMP`,
    [userId, JSON.stringify(story)],
  );
}

export async function clearLifeStory(userId: number): Promise<void> {
  await query('UPDATE user_profiles SET life_story = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1', [userId]);
}
