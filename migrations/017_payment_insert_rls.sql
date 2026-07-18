-- The authenticated create-intent route inserts only its own server-created
-- pending payment row. Webhook updates remain system-only through bypass RLS.
DROP POLICY IF EXISTS payments_insert_own_pending ON payments;
CREATE POLICY payments_insert_own_pending ON payments
  FOR INSERT
  WITH CHECK (
    (
      user_id = NULLIF(current_setting('app.user_id', TRUE), '')::INTEGER
      AND status = 'pending'
    )
    OR bypass_rls_enabled()
  );
