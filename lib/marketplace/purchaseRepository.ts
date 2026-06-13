/**
 * lib/marketplace/purchaseRepository.ts
 *
 * Buyer-scoped data access for marketplace purchases (the "$1/doc" flow).
 * Runs inside withAuth -> withRLSContext, so RLS (migration 016) is active;
 * every query also constrains `buyer_id = $owner` explicitly per CLAUDE.md.
 *
 * Payment SETTLEMENT (pending -> paid) is NOT here — it happens in the Stripe
 * webhook under withRLSBypass. This module covers checkout-row creation, the
 * interview (answers), generation, and buyer reads.
 */
import { query } from '@/lib/db';
import { ValidationError } from '@/lib/api/errors';
import { normalizeTemplateConfig } from '@/lib/marketplace/serialize';
import type {
  Purchase,
  PurchaseDetail,
  PurchaseListPage,
  PurchaseStatus,
} from '@discover-legal/sdk';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

interface PurchaseRow {
  id: number;
  template_id: number;
  template_title: string;
  template_slug: string;
  status: string;
  amount_cents: number;
  currency: string;
  interview_answers: unknown;
  completed_document: string | null;
  document_generated_at: Date | string | null;
  created_at: Date | string;
  paid_at: Date | string | null;
}

interface PurchaseDetailRow extends PurchaseRow {
  template_config: unknown;
}

const SELECT = `
  p.id, p.template_id, p.status, p.amount_cents, p.currency,
  p.interview_answers, p.completed_document, p.document_generated_at,
  p.created_at, p.paid_at,
  t.title AS template_title, t.slug AS template_slug`;

function toIso(v: Date | string | null): string | null {
  if (v == null) return null;
  return v instanceof Date ? v.toISOString() : new Date(v).toISOString();
}

function serializePurchase(row: PurchaseRow): Purchase {
  return {
    id: row.id,
    templateId: row.template_id,
    templateTitle: row.template_title,
    templateSlug: row.template_slug,
    status: row.status as PurchaseStatus,
    amountCents: row.amount_cents,
    currency: row.currency,
    interviewAnswers:
      row.interview_answers && typeof row.interview_answers === 'object'
        ? (row.interview_answers as Record<string, unknown>)
        : {},
    completedDocument: row.completed_document,
    documentGeneratedAt: toIso(row.document_generated_at),
    createdAt: toIso(row.created_at) ?? '',
    paidAt: toIso(row.paid_at),
  };
}

// ---------------------------------------------------------------------------
// Pricing lookup (for checkout) — published templates only.
// ---------------------------------------------------------------------------

export interface PurchasablePricing {
  templateId: number;
  lawyerId: number;
  priceCents: number;
}

export async function getPurchasablePricing(templateId: number): Promise<PurchasablePricing | null> {
  const result = await query<{ id: number; lawyer_id: number; price_cents: number }>(
    `SELECT id, lawyer_id, price_cents FROM marketplace_templates
     WHERE id = $1 AND status = 'published' AND deleted_at IS NULL LIMIT 1`,
    [templateId],
  );
  const row = result.rows[0];
  return row ? { templateId: row.id, lawyerId: row.lawyer_id, priceCents: row.price_cents } : null;
}

// ---------------------------------------------------------------------------
// Create checkout row
// ---------------------------------------------------------------------------

export async function createPurchase(input: {
  buyerId: number;
  templateId: number;
  lawyerId: number;
  amountCents: number;
  currency: string;
  stripePaymentIntentId: string | null;
  status: PurchaseStatus;
}): Promise<number> {
  const result = await query<{ id: number }>(
    `INSERT INTO marketplace_purchases
       (buyer_id, template_id, lawyer_id, amount_cents, currency,
        stripe_payment_intent_id, status, paid_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7,
        CASE WHEN $7 = 'paid' THEN NOW() ELSE NULL END)
     RETURNING id`,
    [
      input.buyerId,
      input.templateId,
      input.lawyerId,
      input.amountCents,
      input.currency,
      input.stripePaymentIntentId,
      input.status,
    ],
  );
  return result.rows[0].id;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export async function getPurchaseDetail(
  buyerId: number,
  id: number,
): Promise<PurchaseDetail | null> {
  const result = await query<PurchaseDetailRow>(
    `SELECT ${SELECT}, t.template_config
       FROM marketplace_purchases p
       JOIN marketplace_templates t ON t.id = p.template_id
      WHERE p.id = $1 AND p.buyer_id = $2 LIMIT 1`,
    [id, buyerId],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    ...serializePurchase(row),
    templateConfig: normalizeTemplateConfig(row.template_config),
  };
}

function encodeIdCursor(id: number): string {
  return Buffer.from(String(id), 'utf8').toString('base64url');
}
function decodeIdCursor(raw: string): number {
  const n = Number(Buffer.from(raw, 'base64url').toString('utf8'));
  if (!Number.isInteger(n)) throw new ValidationError('Invalid pagination cursor');
  return n;
}

export async function listPurchases(
  buyerId: number,
  opts: { cursor?: string; limit?: number } = {},
): Promise<PurchaseListPage> {
  const limit = Math.min(Math.max(1, Math.trunc(opts.limit ?? DEFAULT_LIMIT) || DEFAULT_LIMIT), MAX_LIMIT);
  const params: unknown[] = [buyerId];
  let keyset = '';
  let total: number | null = null;

  if (opts.cursor) {
    params.push(decodeIdCursor(opts.cursor));
    keyset = ` AND p.id < $${params.length}`;
  } else {
    const count = await query<{ count: string }>(
      `SELECT COUNT(*) FROM marketplace_purchases p WHERE p.buyer_id = $1`,
      [buyerId],
    );
    total = Number(count.rows[0]?.count ?? 0);
  }

  params.push(limit + 1);
  const result = await query<PurchaseRow>(
    `SELECT ${SELECT}
       FROM marketplace_purchases p
       JOIN marketplace_templates t ON t.id = p.template_id
      WHERE p.buyer_id = $1${keyset}
      ORDER BY p.id DESC
      LIMIT $${params.length}`,
    params,
  );

  const hasMore = result.rows.length > limit;
  const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
  return {
    purchases: rows.map(serializePurchase),
    nextCursor: hasMore && rows.length ? encodeIdCursor(rows[rows.length - 1].id) : null,
    total,
  };
}

// ---------------------------------------------------------------------------
// Interview + generation writes (paid purchases only)
// ---------------------------------------------------------------------------

export async function saveAnswers(
  buyerId: number,
  id: number,
  answers: Record<string, unknown>,
): Promise<PurchaseDetail | null> {
  const updated = await query<{ id: number }>(
    `UPDATE marketplace_purchases
        SET interview_answers = $1::jsonb
      WHERE id = $2 AND buyer_id = $3 AND status = 'paid'
      RETURNING id`,
    [JSON.stringify(answers ?? {}), id, buyerId],
  );
  if (updated.rowCount === 0) return null;
  return getPurchaseDetail(buyerId, id);
}

export async function saveGeneratedDocument(
  buyerId: number,
  id: number,
  document: string,
): Promise<PurchaseDetail | null> {
  const updated = await query<{ id: number }>(
    `UPDATE marketplace_purchases
        SET completed_document = $1, document_generated_at = NOW()
      WHERE id = $2 AND buyer_id = $3 AND status = 'paid'
      RETURNING id`,
    [document, id, buyerId],
  );
  if (updated.rowCount === 0) return null;
  return getPurchaseDetail(buyerId, id);
}
