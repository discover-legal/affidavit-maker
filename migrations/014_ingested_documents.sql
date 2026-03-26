-- Migration 014: Ingested documents for respondent path
-- Stores uploaded legal documents (served papers) with extraction results,
-- classification, and response deadline tracking.

CREATE TABLE IF NOT EXISTS ingested_documents (
  id                        SERIAL PRIMARY KEY,
  user_id                   TEXT NOT NULL,
  case_id                   INTEGER REFERENCES cases(id) ON DELETE SET NULL,

  -- Source file
  file_key                  VARCHAR(500) NOT NULL,
  file_name                 VARCHAR(500),
  file_size_bytes           INTEGER,
  file_pages                INTEGER DEFAULT 1,

  -- Extraction
  raw_text                  TEXT,
  document_class            VARCHAR(100),
  classification_confidence DECIMAL(3,2),
  extracted_data            JSONB DEFAULT '{}',

  -- Deadlines
  service_date              DATE,
  response_deadline         DATE,
  deadline_source           TEXT,

  -- State
  status                    VARCHAR(30) DEFAULT 'uploaded',
  error_message             TEXT,

  created_at                TIMESTAMPTZ DEFAULT NOW(),
  updated_at                TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: user isolation
ALTER TABLE ingested_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS ingested_user_isolation ON ingested_documents;
CREATE POLICY ingested_user_isolation ON ingested_documents
  USING (user_id = current_setting('app.current_user_id', true));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ingested_user    ON ingested_documents(user_id);
CREATE INDEX IF NOT EXISTS idx_ingested_case    ON ingested_documents(case_id);
CREATE INDEX IF NOT EXISTS idx_ingested_status  ON ingested_documents(status);
CREATE INDEX IF NOT EXISTS idx_ingested_class   ON ingested_documents(document_class);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_ingested_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS ingested_documents_updated_at ON ingested_documents;
CREATE TRIGGER ingested_documents_updated_at
  BEFORE UPDATE ON ingested_documents
  FOR EACH ROW EXECUTE FUNCTION update_ingested_documents_updated_at();
