/**
 * lib/marketplace/repository.ts
 *
 * Data access for the public marketplace read surface. All queries are
 * parameterized via `lib/db`'s `query()` helper and constrained to
 * `status = 'published' AND deleted_at IS NULL` — these endpoints are
 * unauthenticated, so the explicit WHERE is the primary guard (RLS read policy
 * in migration 015 is defense-in-depth on top).
 *
 * Pagination is keyset (cursor) based on the active sort column + `id` so deep
 * pages stay O(log n) and don't drift as rows change underneath the user.
 */
import { query } from '@/lib/db';
import { ValidationError } from '@/lib/api/errors';
import { serializeTemplate, type TemplateRow } from '@/lib/marketplace/serialize';
import type {
  MarketplaceTemplate,
  TemplateListPage,
  TemplateSort,
} from '@discover-legal/sdk';

export interface SearchParams {
  q?: string;
  matterType?: string;
  practiceArea?: string;
  jurisdiction?: string;
  minPrice?: number;
  maxPrice?: number;
  minRating?: number;
  sortBy?: TemplateSort;
  cursor?: string;
  limit?: number;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/** sort key -> { sql column expression, direction }. id DESC is the tiebreaker. */
const SORTS: Record<TemplateSort, { expr: string; dir: 'ASC' | 'DESC' }> = {
  popular: { expr: 'mt.total_purchases', dir: 'DESC' },
  newest: { expr: 'mt.published_at', dir: 'DESC' },
  rating: { expr: 'mt.avg_rating', dir: 'DESC' },
  price_asc: { expr: 'mt.price_cents', dir: 'ASC' },
  price_desc: { expr: 'mt.price_cents', dir: 'DESC' },
};

const SELECTED_COLUMNS = `
  mt.id, mt.slug, mt.title, mt.short_description, mt.description,
  mt.matter_type, mt.practice_area, mt.jurisdictions, mt.price_cents,
  mt.cover_image_url, mt.tags, mt.estimated_minutes, mt.difficulty_level,
  mt.total_purchases, mt.avg_rating, mt.rating_count, mt.published_at,
  mt.lawyer_id, u.name AS lawyer_name`;

const FROM = `FROM marketplace_templates mt LEFT JOIN users u ON u.id = mt.lawyer_id`;
const PUBLISHED = `mt.status = 'published' AND mt.deleted_at IS NULL`;

interface Cursor {
  s: TemplateSort;
  v: string | number;
  id: number;
}

export function encodeCursor(sort: TemplateSort, value: string | number, id: number): string {
  const payload: Cursor = { s: sort, v: value, id };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeCursor(raw: string, expectedSort: TemplateSort): Cursor {
  let parsed: Cursor;
  try {
    parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Cursor;
  } catch {
    throw new ValidationError('Invalid pagination cursor');
  }
  if (!parsed || parsed.s !== expectedSort || typeof parsed.id !== 'number') {
    throw new ValidationError('Pagination cursor does not match the requested sort order');
  }
  return parsed;
}

/** Sort value to embed in the cursor for the last row of a page. */
function cursorValueFor(sort: TemplateSort, row: TemplateRow): string | number {
  switch (sort) {
    case 'popular':
      return row.total_purchases;
    case 'rating':
      return typeof row.avg_rating === 'string' ? Number(row.avg_rating) : row.avg_rating;
    case 'price_asc':
    case 'price_desc':
      return row.price_cents;
    case 'newest':
      return row.published_at instanceof Date
        ? row.published_at.toISOString()
        : String(row.published_at);
  }
}

export async function searchTemplates(params: SearchParams): Promise<TemplateListPage> {
  const sortBy = params.sortBy ?? 'popular';
  if (!(sortBy in SORTS)) {
    throw new ValidationError(
      `Invalid sort. Must be one of: ${Object.keys(SORTS).join(', ')}`,
    );
  }
  const limit = Math.min(Math.max(1, Math.trunc(params.limit ?? DEFAULT_LIMIT) || DEFAULT_LIMIT), MAX_LIMIT);

  // --- WHERE (filters, shared by COUNT and page query) ---
  const where: string[] = [PUBLISHED];
  const filterParams: unknown[] = [];
  const bind = (value: unknown) => {
    filterParams.push(value);
    return `$${filterParams.length}`;
  };

  if (params.q && params.q.trim()) {
    where.push(`mt.search_vector @@ websearch_to_tsquery('english', ${bind(params.q.trim())})`);
  }
  if (params.matterType) where.push(`mt.matter_type = ${bind(params.matterType)}`);
  if (params.practiceArea) {
    if (params.practiceArea !== 'family' && params.practiceArea !== 'civil') {
      throw new ValidationError('practice_area must be "family" or "civil"');
    }
    where.push(`mt.practice_area = ${bind(params.practiceArea)}`);
  }
  if (params.jurisdiction) {
    where.push(`mt.jurisdictions @> ARRAY[${bind(params.jurisdiction.toUpperCase())}]::text[]`);
  }
  if (params.minPrice != null) where.push(`mt.price_cents >= ${bind(Math.trunc(params.minPrice))}`);
  if (params.maxPrice != null) where.push(`mt.price_cents <= ${bind(Math.trunc(params.maxPrice))}`);
  if (params.minRating != null) where.push(`mt.avg_rating >= ${bind(params.minRating)}`);

  const filterWhere = where.join(' AND ');

  // --- COUNT (first page only) ---
  let total: number | null = null;
  if (!params.cursor) {
    const countResult = await query<{ count: string }>(
      `SELECT COUNT(*) ${FROM} WHERE ${filterWhere}`,
      filterParams,
    );
    total = Number(countResult.rows[0]?.count ?? 0);
  }

  // --- Keyset cursor clause ---
  const { expr, dir } = SORTS[sortBy];
  const pageParams = [...filterParams];
  const pageBind = (value: unknown) => {
    pageParams.push(value);
    return `$${pageParams.length}`;
  };

  let keyset = '';
  if (params.cursor) {
    const cur = decodeCursor(params.cursor, sortBy);
    const cmp = dir === 'DESC' ? '<' : '>';
    // Strictly-after the cursor under (expr <dir>, id DESC) ordering.
    keyset = ` AND ((${expr} ${cmp} ${pageBind(cur.v)}) OR (${expr} = ${pageBind(cur.v)} AND mt.id < ${pageBind(cur.id)}))`;
  }

  const limitPlaceholder = pageBind(limit + 1); // fetch one extra to detect next page
  const sql = `
    SELECT ${SELECTED_COLUMNS}
    ${FROM}
    WHERE ${filterWhere}${keyset}
    ORDER BY ${expr} ${dir}${sortBy === 'newest' ? ' NULLS LAST' : ''}, mt.id DESC
    LIMIT ${limitPlaceholder}`;

  const result = await query<TemplateRow>(sql, pageParams);
  const hasMore = result.rows.length > limit;
  const rows = hasMore ? result.rows.slice(0, limit) : result.rows;

  let nextCursor: string | null = null;
  if (hasMore && rows.length > 0) {
    const last = rows[rows.length - 1];
    nextCursor = encodeCursor(sortBy, cursorValueFor(sortBy, last), last.id);
  }

  return {
    templates: rows.map(serializeTemplate),
    nextCursor,
    total,
  };
}

export async function getTemplateBySlug(slug: string): Promise<MarketplaceTemplate | null> {
  const result = await query<TemplateRow>(
    `SELECT ${SELECTED_COLUMNS} ${FROM} WHERE mt.slug = $1 AND ${PUBLISHED} LIMIT 1`,
    [slug],
  );
  const row = result.rows[0];
  return row ? serializeTemplate(row) : null;
}
