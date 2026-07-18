-- Prevent replayed or out-of-order Auth0 webhook deliveries from reverting
-- identity data. The signed payload's updateTime advances monotonically.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS auth0_updated_at TIMESTAMPTZ;
