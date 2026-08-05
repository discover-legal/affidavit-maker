-- Make the relational document binding authoritative for payment entitlement.
-- Older rows retain metadata fallback in application code; only safe,
-- ownership-matching integer metadata is backfilled.
UPDATE payments p
   SET document_id = (p.metadata->>'documentId')::integer
  FROM documents d
 WHERE p.document_id IS NULL
   AND p.metadata->>'documentId' ~ '^[1-9][0-9]{0,9}$'
   AND (p.metadata->>'documentId')::bigint <= 2147483647
   AND d.id = (p.metadata->>'documentId')::integer
   AND d.user_id = p.user_id;

CREATE INDEX IF NOT EXISTS idx_payments_document_entitlement
    ON payments (user_id, document_id, status);
