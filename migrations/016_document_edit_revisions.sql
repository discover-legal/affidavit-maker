-- Optimistic concurrency token for user-authored document content.
-- Deliberately separate from updated_at: payment, generation, and rename
-- metadata updates must not create false editing conflicts.
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS edit_revision BIGINT NOT NULL DEFAULT 1;

