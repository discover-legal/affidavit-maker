-- ============================================================================
-- Migration 015: Life-story user profiles
-- ============================================================================
-- One row per user accumulating everything the user has told the AI across
-- every chat session and every document: structured interview fields
-- (parties, marriage, children, residency, ...) in `profile`, and the
-- first-person fact statements in `facts`. The chat route hydrates new
-- conversations from this row and merges each turn's extractions back in,
-- so returning users never have to repeat themselves.

CREATE TABLE IF NOT EXISTS user_profiles (
  user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  profile     JSONB NOT NULL DEFAULT '{}',   -- structured fields (camelCase, same shape as affidavitData)
  facts       JSONB NOT NULL DEFAULT '[]',   -- accumulated fact objects [{id, content, category, ...}]
  created_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- RLS: same posture as every other tenant table (migrations 010 + 014).
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles FORCE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_profiles' AND policyname = 'user_profiles_select_own') THEN
        EXECUTE 'CREATE POLICY user_profiles_select_own ON user_profiles
            FOR SELECT
            USING (
                user_id = current_user_id()
                OR current_user_is_admin()
                OR bypass_rls_enabled()
            )';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_profiles' AND policyname = 'user_profiles_insert_own') THEN
        EXECUTE 'CREATE POLICY user_profiles_insert_own ON user_profiles
            FOR INSERT
            WITH CHECK (
                user_id = current_user_id()
                OR bypass_rls_enabled()
            )';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_profiles' AND policyname = 'user_profiles_update_own') THEN
        EXECUTE 'CREATE POLICY user_profiles_update_own ON user_profiles
            FOR UPDATE
            USING (
                user_id = current_user_id()
                OR current_user_is_admin()
                OR bypass_rls_enabled()
            )';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'user_profiles' AND policyname = 'user_profiles_delete_own') THEN
        EXECUTE 'CREATE POLICY user_profiles_delete_own ON user_profiles
            FOR DELETE
            USING (
                user_id = current_user_id()
                OR current_user_is_admin()
                OR bypass_rls_enabled()
            )';
    END IF;
END $$;

-- updated_at trigger (same pattern as cases, migration 012)
CREATE OR REPLACE FUNCTION update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS user_profiles_updated_at ON user_profiles;
CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_user_profiles_updated_at();
