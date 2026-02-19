-- Migration 012: Add cases table for case profile management
-- Cases represent a single legal matter (e.g., one divorce case) and can
-- contain multiple related documents. Case-level information (parties,
-- court, cause number) is stored once and reused across all documents
-- in the case, enabling the orchestrator to skip re-collecting known data.

-- Cases table
CREATE TABLE IF NOT EXISTS cases (
  id                    SERIAL PRIMARY KEY,
  user_id               INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  practice_area         VARCHAR(50) NOT NULL DEFAULT 'family',  -- 'family', 'civil'
  title                 VARCHAR(500),                            -- e.g., "In re: Smith v. Jones"
  cause_number          VARCHAR(255),
  court_name            VARCHAR(255),
  state                 CHAR(2),
  county                VARCHAR(255),
  petitioner_first_name VARCHAR(255),
  petitioner_last_name  VARCHAR(255),
  respondent_first_name VARCHAR(255),
  respondent_last_name  VARCHAR(255),
  children              JSONB DEFAULT '[]',    -- [{name, dob, age}, ...]
  case_metadata         JSONB DEFAULT '{}',    -- extensible: property, grounds, support, etc.
  status                VARCHAR(50) DEFAULT 'active',  -- 'active', 'closed'
  created_at            TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_cases_user_id ON cases(user_id);
CREATE INDEX IF NOT EXISTS idx_cases_state ON cases(state);
CREATE INDEX IF NOT EXISTS idx_cases_status ON cases(status);

-- Add case_id FK on documents table
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS case_id INTEGER REFERENCES cases(id) ON DELETE SET NULL;

-- Add practice_area on documents for direct lookup without joining cases
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS practice_area VARCHAR(50) DEFAULT 'family';

CREATE INDEX IF NOT EXISTS idx_documents_case_id ON documents(case_id);

-- RLS: cases are private to their owner (matches pattern from migration 010)
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cases_user_isolation ON cases;
CREATE POLICY cases_user_isolation ON cases
  USING (user_id = current_setting('app.current_user_id', true)::integer);

-- Updated_at trigger (reuse pattern from existing tables)
CREATE OR REPLACE FUNCTION update_cases_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS cases_updated_at ON cases;
CREATE TRIGGER cases_updated_at
  BEFORE UPDATE ON cases
  FOR EACH ROW EXECUTE FUNCTION update_cases_updated_at();
