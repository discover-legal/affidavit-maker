-- ============================================================================
-- Migration 022: v2 life story
-- ============================================================================
-- The v2 engine (core/profile) keeps the durable "life story" as one typed
-- document (people, children, fields with provenance, facts, events,
-- confirmations). It lives beside the v1 profile/facts columns on the same
-- per-user row, so RLS (migrations 010 + 014 + 015) covers it unchanged and
-- a user's erase deletes both generations at once.
--
-- NULL means "no v2 story yet"; the engine hydrates from nothing.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS life_story JSONB;

COMMENT ON COLUMN user_profiles.life_story IS
  'v2 engine LifeStory (core/profile/types.ts). NULL until the user has a v2 conversation.';
