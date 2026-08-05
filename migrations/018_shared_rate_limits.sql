CREATE TABLE IF NOT EXISTS api_rate_limits (
  bucket VARCHAR(100) NOT NULL,
  subject_key VARCHAR(200) NOT NULL,
  count INTEGER NOT NULL CHECK (count > 0),
  reset_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (bucket, subject_key)
);

CREATE INDEX IF NOT EXISTS idx_api_rate_limits_reset_at
  ON api_rate_limits (reset_at);

ALTER TABLE api_rate_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_rate_limits FORCE ROW LEVEL SECURITY;

CREATE POLICY api_rate_limits_system_all ON api_rate_limits
  FOR ALL
  USING (bypass_rls_enabled())
  WITH CHECK (bypass_rls_enabled());

COMMENT ON TABLE api_rate_limits IS
  'System-managed fixed-window counters shared across application instances';
