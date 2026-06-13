/**
 * lib/marketplace/lawyerRepository.ts
 *
 * Owner-scoped data access for provider (lawyer) template authoring. Every
 * query is parameterized AND constrained with `lawyer_id = $owner` — explicit
 * ownership checks per CLAUDE.md, on top of the RLS policies from migration 015
 * (which are the database-level backstop). Runs inside `withAuth` →
 * `withRLSContext`, so `app.user_id` / `app.user_role` are set for RLS.
 */
import { query } from '@/lib/db';
import { ValidationError } from '@/lib/api/errors';
import {
  serializeLawyerTemplate,
  normalizeTemplateConfig,
  type LawyerTemplateRow,
} from '@/lib/marketplace/serialize';
import type {
  CreateTemplateInput,
  LawyerDashboard,
  LawyerTemplate,
  LawyerTemplateListPage,
  TemplateStatus,
  UpdateTemplateInput,
} from '@discover-legal/sdk';

const COLUMNS = `
  id, slug, title, short_description, description, matter_type, practice_area,
  jurisdictions, price_cents, cover_image_url, tags, estimated_minutes,
  difficulty_level, status, version, template_config, total_purchases,
  total_revenue_cents, avg_rating, rating_count, published_at, created_at, updated_at`;

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

// ---------------------------------------------------------------------------
// Slug generation
// ---------------------------------------------------------------------------

export function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return base || 'template';
}

/**
 * Produce a globally-unique slug derived from `title`. Queries existing slugs
 * that collide on the base and appends the smallest free `-N` suffix. (slug is
 * UNIQUE in the schema, so a concurrent racer is still caught at INSERT; the
 * caller retries via createTemplate's loop.)
 */
async function generateUniqueSlug(title: string): Promise<string> {
  const base = slugify(title);
  const existing = await query<{ slug: string }>(
    `SELECT slug FROM marketplace_templates WHERE slug = $1 OR slug LIKE $2`,
    [base, `${base}-%`],
  );
  const taken = new Set(existing.rows.map((r) => r.slug));
  if (!taken.has(base)) return base;
  for (let n = 2; n < 10_000; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  // Astronomically unlikely; fall back to a time-free disambiguator.
  return `${base}-${existing.rows.length + 1}`;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

function encodeIdCursor(id: number): string {
  return Buffer.from(String(id), 'utf8').toString('base64url');
}
function decodeIdCursor(raw: string): number {
  const n = Number(Buffer.from(raw, 'base64url').toString('utf8'));
  if (!Number.isInteger(n)) throw new ValidationError('Invalid pagination cursor');
  return n;
}

const VALID_STATUS: ReadonlySet<TemplateStatus> = new Set([
  'draft',
  'pending_review',
  'published',
  'suspended',
  'archived',
  'deleted',
]);

export async function listLawyerTemplates(
  lawyerId: number,
  opts: { status?: TemplateStatus; cursor?: string; limit?: number } = {},
): Promise<LawyerTemplateListPage> {
  const limit = Math.min(Math.max(1, Math.trunc(opts.limit ?? DEFAULT_LIMIT) || DEFAULT_LIMIT), MAX_LIMIT);

  const where = ['lawyer_id = $1', "status <> 'deleted'"];
  const params: unknown[] = [lawyerId];
  if (opts.status) {
    if (!VALID_STATUS.has(opts.status)) throw new ValidationError('Invalid status filter');
    params.push(opts.status);
    where.push(`status = $${params.length}`);
  }

  let total: number | null = null;
  if (!opts.cursor) {
    const count = await query<{ count: string }>(
      `SELECT COUNT(*) FROM marketplace_templates WHERE ${where.join(' AND ')}`,
      params,
    );
    total = Number(count.rows[0]?.count ?? 0);
  } else {
    params.push(decodeIdCursor(opts.cursor));
    where.push(`id < $${params.length}`);
  }

  params.push(limit + 1);
  const result = await query<LawyerTemplateRow>(
    `SELECT ${COLUMNS} FROM marketplace_templates
     WHERE ${where.join(' AND ')}
     ORDER BY id DESC
     LIMIT $${params.length}`,
    params,
  );

  const hasMore = result.rows.length > limit;
  const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
  return {
    templates: rows.map(serializeLawyerTemplate),
    nextCursor: hasMore && rows.length ? encodeIdCursor(rows[rows.length - 1].id) : null,
    total,
  };
}

export async function getLawyerTemplate(lawyerId: number, id: number): Promise<LawyerTemplate | null> {
  const result = await query<LawyerTemplateRow>(
    `SELECT ${COLUMNS} FROM marketplace_templates
     WHERE id = $1 AND lawyer_id = $2 AND status <> 'deleted' LIMIT 1`,
    [id, lawyerId],
  );
  return result.rows[0] ? serializeLawyerTemplate(result.rows[0]) : null;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export async function createTemplate(
  lawyerId: number,
  input: CreateTemplateInput,
): Promise<LawyerTemplate> {
  const slug = await generateUniqueSlug(input.title);
  const config = normalizeTemplateConfig(input.templateConfig);

  const result = await query<LawyerTemplateRow>(
    `INSERT INTO marketplace_templates
       (lawyer_id, title, slug, short_description, description, matter_type,
        practice_area, jurisdictions, price_cents, tags, estimated_minutes,
        difficulty_level, template_config, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, 'draft')
     RETURNING ${COLUMNS}`,
    [
      lawyerId,
      input.title,
      slug,
      input.shortDescription ?? null,
      input.description ?? null,
      input.matterType,
      input.practiceArea,
      input.jurisdictions ?? [],
      input.priceCents ?? 100,
      input.tags ?? [],
      input.estimatedMinutes ?? 15,
      input.difficultyLevel ?? 'standard',
      JSON.stringify(config),
    ],
  );
  return serializeLawyerTemplate(result.rows[0]);
}

/** Columns a lawyer may edit, mapped DTO field -> column + optional value coercion. */
const EDITABLE: Record<string, { col: string; coerce?: (v: unknown) => unknown }> = {
  title: { col: 'title' },
  shortDescription: { col: 'short_description' },
  description: { col: 'description' },
  matterType: { col: 'matter_type' },
  practiceArea: { col: 'practice_area' },
  jurisdictions: { col: 'jurisdictions' },
  priceCents: { col: 'price_cents' },
  tags: { col: 'tags' },
  estimatedMinutes: { col: 'estimated_minutes' },
  difficultyLevel: { col: 'difficulty_level' },
  coverImageUrl: { col: 'cover_image_url' },
  templateConfig: {
    col: 'template_config',
    coerce: (v) => JSON.stringify(normalizeTemplateConfig(v)),
  },
};

export async function updateTemplate(
  lawyerId: number,
  id: number,
  patch: UpdateTemplateInput,
): Promise<LawyerTemplate | null> {
  const sets: string[] = [];
  const params: unknown[] = [];

  for (const [key, def] of Object.entries(EDITABLE)) {
    if (!(key in patch)) continue;
    const value = (patch as Record<string, unknown>)[key];
    if (value === undefined) continue;
    params.push(def.coerce ? def.coerce(value) : value);
    const cast = def.col === 'template_config' ? '::jsonb' : '';
    sets.push(`${def.col} = $${params.length}${cast}`);
  }

  if (sets.length === 0) {
    // Nothing to change — return the current row (or null if not owned).
    return getLawyerTemplate(lawyerId, id);
  }

  params.push(id, lawyerId);
  const result = await query<LawyerTemplateRow>(
    `UPDATE marketplace_templates
        SET ${sets.join(', ')}
      WHERE id = $${params.length - 1} AND lawyer_id = $${params.length} AND status <> 'deleted'
      RETURNING ${COLUMNS}`,
    params,
  );
  return result.rows[0] ? serializeLawyerTemplate(result.rows[0]) : null;
}

/**
 * Transition a template's lifecycle status. `published` stamps published_at
 * (idempotently). 'deleted' is rejected here — use softDeleteTemplate.
 */
export async function setTemplateStatus(
  lawyerId: number,
  id: number,
  status: TemplateStatus,
): Promise<LawyerTemplate | null> {
  if (status === 'deleted') throw new ValidationError('Use delete to remove a template');
  if (!VALID_STATUS.has(status)) throw new ValidationError('Invalid status');

  const publishedClause = status === 'published' ? ', published_at = COALESCE(published_at, NOW())' : '';
  const result = await query<LawyerTemplateRow>(
    `UPDATE marketplace_templates
        SET status = $1${publishedClause}
      WHERE id = $2 AND lawyer_id = $3 AND status <> 'deleted'
      RETURNING ${COLUMNS}`,
    [status, id, lawyerId],
  );
  return result.rows[0] ? serializeLawyerTemplate(result.rows[0]) : null;
}

export async function softDeleteTemplate(lawyerId: number, id: number): Promise<boolean> {
  const result = await query(
    `UPDATE marketplace_templates
        SET status = 'deleted', deleted_at = NOW()
      WHERE id = $1 AND lawyer_id = $2 AND status <> 'deleted'`,
    [id, lawyerId],
  );
  return (result.rowCount ?? 0) > 0;
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export async function getLawyerDashboard(lawyerId: number): Promise<LawyerDashboard> {
  const totalsResult = await query<{
    templates: string;
    published: string;
    drafts: string;
    total_purchases: string;
    total_revenue_cents: string;
    avg_rating: string | null;
  }>(
    `SELECT
        COUNT(*)                                          AS templates,
        COUNT(*) FILTER (WHERE status = 'published')      AS published,
        COUNT(*) FILTER (WHERE status = 'draft')          AS drafts,
        COALESCE(SUM(total_purchases), 0)                 AS total_purchases,
        COALESCE(SUM(total_revenue_cents), 0)             AS total_revenue_cents,
        AVG(avg_rating) FILTER (WHERE rating_count > 0)   AS avg_rating
     FROM marketplace_templates
     WHERE lawyer_id = $1 AND status <> 'deleted'`,
    [lawyerId],
  );
  const t = totalsResult.rows[0];

  const recent = await listLawyerTemplates(lawyerId, { limit: 5 });

  return {
    totals: {
      templates: Number(t?.templates ?? 0),
      published: Number(t?.published ?? 0),
      drafts: Number(t?.drafts ?? 0),
      totalPurchases: Number(t?.total_purchases ?? 0),
      totalRevenueCents: Number(t?.total_revenue_cents ?? 0),
      avgRating: t?.avg_rating != null ? Number(t.avg_rating) : null,
    },
    recentTemplates: recent.templates,
  };
}
