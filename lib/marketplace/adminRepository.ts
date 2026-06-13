/**
 * lib/marketplace/adminRepository.ts
 *
 * Cross-tenant data access for marketplace administrators: user/role
 * management, template moderation, and platform stats. Runs inside withAuth ->
 * withRLSContext with is_admin=true, so the admin RLS policies (migrations 010
 * users_*, 015 marketplace_templates, 016 marketplace_purchases) permit the
 * cross-user reads/writes. Endpoints are additionally `requireAdminApi`-gated.
 */
import { query } from '@/lib/db';
import { ValidationError } from '@/lib/api/errors';
import type {
  AdminStats,
  AdminTemplate,
  AdminTemplateListPage,
  AdminUser,
  AdminUserListPage,
  PracticeArea,
  TemplateStatus,
  UserRole,
} from '@discover-legal/sdk';

const DEFAULT_LIMIT = 25;
const MAX_LIMIT = 100;
const ROLES: ReadonlySet<UserRole> = new Set(['client', 'lawyer', 'admin']);

function encodeIdCursor(id: number): string {
  return Buffer.from(String(id), 'utf8').toString('base64url');
}
function decodeIdCursor(raw: string): number {
  const n = Number(Buffer.from(raw, 'base64url').toString('utf8'));
  if (!Number.isInteger(n)) throw new ValidationError('Invalid pagination cursor');
  return n;
}
function toIso(v: Date | string | null): string | null {
  if (v == null) return null;
  return v instanceof Date ? v.toISOString() : new Date(v).toISOString();
}
function clampLimit(n: number | undefined): number {
  return Math.min(Math.max(1, Math.trunc(n ?? DEFAULT_LIMIT) || DEFAULT_LIMIT), MAX_LIMIT);
}

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

interface UserRow {
  id: number;
  email: string;
  name: string | null;
  user_role: UserRole | null;
  created_at: Date | string;
}
function serializeUser(r: UserRow): AdminUser {
  return {
    id: r.id,
    email: r.email,
    name: r.name,
    role: r.user_role ?? 'client',
    createdAt: toIso(r.created_at) ?? '',
  };
}

export async function listUsers(opts: {
  role?: UserRole;
  q?: string;
  cursor?: string;
  limit?: number;
}): Promise<AdminUserListPage> {
  const limit = clampLimit(opts.limit);
  const where: string[] = ['TRUE'];
  const params: unknown[] = [];
  const bind = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };

  if (opts.role) {
    if (!ROLES.has(opts.role)) throw new ValidationError('Invalid role filter');
    where.push(`user_role = ${bind(opts.role)}`);
  }
  if (opts.q && opts.q.trim()) {
    const like = `%${opts.q.trim()}%`;
    where.push(`(email ILIKE ${bind(like)} OR name ILIKE ${bind(like)})`);
  }

  let total: number | null = null;
  if (!opts.cursor) {
    const count = await query<{ count: string }>(
      `SELECT COUNT(*) FROM users WHERE ${where.join(' AND ')}`,
      params,
    );
    total = Number(count.rows[0]?.count ?? 0);
  } else {
    where.push(`id < ${bind(decodeIdCursor(opts.cursor))}`);
  }

  const limitPlaceholder = bind(limit + 1);
  const result = await query<UserRow>(
    `SELECT id, email, name, user_role, created_at FROM users
      WHERE ${where.join(' AND ')}
      ORDER BY id DESC
      LIMIT ${limitPlaceholder}`,
    params,
  );
  const hasMore = result.rows.length > limit;
  const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
  return {
    users: rows.map(serializeUser),
    nextCursor: hasMore && rows.length ? encodeIdCursor(rows[rows.length - 1].id) : null,
    total,
  };
}

export async function setUserRole(userId: number, role: UserRole): Promise<AdminUser | null> {
  if (!ROLES.has(role)) throw new ValidationError('Invalid role');
  const result = await query<UserRow>(
    `UPDATE users SET user_role = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, email, name, user_role, created_at`,
    [role, userId],
  );
  return result.rows[0] ? serializeUser(result.rows[0]) : null;
}

// ---------------------------------------------------------------------------
// Template moderation
// ---------------------------------------------------------------------------

interface AdminTemplateRow {
  id: number;
  slug: string;
  title: string;
  status: string;
  practice_area: string;
  matter_type: string;
  price_cents: number;
  lawyer_id: number | null;
  lawyer_name: string | null;
  suspension_reason: string | null;
  created_at: Date | string;
  published_at: Date | string | null;
}
function serializeAdminTemplate(r: AdminTemplateRow): AdminTemplate {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    status: r.status as TemplateStatus,
    practiceArea: r.practice_area as PracticeArea,
    matterType: r.matter_type,
    priceCents: r.price_cents,
    lawyer: r.lawyer_id != null ? { id: r.lawyer_id, displayName: r.lawyer_name ?? 'provider' } : null,
    suspensionReason: r.suspension_reason,
    createdAt: toIso(r.created_at) ?? '',
    publishedAt: toIso(r.published_at),
  };
}

const ADMIN_TPL_COLS = `
  mt.id, mt.slug, mt.title, mt.status, mt.practice_area, mt.matter_type,
  mt.price_cents, mt.lawyer_id, u.name AS lawyer_name, mt.suspension_reason,
  mt.created_at, mt.published_at`;

export async function listAdminTemplates(opts: {
  status?: TemplateStatus;
  cursor?: string;
  limit?: number;
}): Promise<AdminTemplateListPage> {
  const limit = clampLimit(opts.limit);
  const where: string[] = ["mt.status <> 'deleted'"];
  const params: unknown[] = [];
  const bind = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };
  if (opts.status) where.push(`mt.status = ${bind(opts.status)}`);

  let total: number | null = null;
  if (!opts.cursor) {
    const count = await query<{ count: string }>(
      `SELECT COUNT(*) FROM marketplace_templates mt WHERE ${where.join(' AND ')}`,
      params,
    );
    total = Number(count.rows[0]?.count ?? 0);
  } else {
    where.push(`mt.id < ${bind(decodeIdCursor(opts.cursor))}`);
  }

  const limitPlaceholder = bind(limit + 1);
  const result = await query<AdminTemplateRow>(
    `SELECT ${ADMIN_TPL_COLS}
       FROM marketplace_templates mt
       LEFT JOIN users u ON u.id = mt.lawyer_id
      WHERE ${where.join(' AND ')}
      ORDER BY mt.id DESC
      LIMIT ${limitPlaceholder}`,
    params,
  );
  const hasMore = result.rows.length > limit;
  const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
  return {
    templates: rows.map(serializeAdminTemplate),
    nextCursor: hasMore && rows.length ? encodeIdCursor(rows[rows.length - 1].id) : null,
    total,
  };
}

async function moderateTemplate(id: number, set: string, params: unknown[]): Promise<AdminTemplate | null> {
  // params are bound starting at $1; the id is the final param.
  const result = await query<AdminTemplateRow>(
    `WITH upd AS (
       UPDATE marketplace_templates
          SET ${set}
        WHERE id = $${params.length + 1} AND status <> 'deleted'
        RETURNING id
     )
     SELECT ${ADMIN_TPL_COLS}
       FROM marketplace_templates mt
       LEFT JOIN users u ON u.id = mt.lawyer_id
      WHERE mt.id = (SELECT id FROM upd)`,
    [...params, id],
  );
  return result.rows[0] ? serializeAdminTemplate(result.rows[0]) : null;
}

export function approveTemplate(id: number): Promise<AdminTemplate | null> {
  return moderateTemplate(
    id,
    `status = 'published', published_at = COALESCE(published_at, NOW()), suspended_at = NULL, suspension_reason = NULL`,
    [],
  );
}

export function suspendTemplate(id: number, reason: string): Promise<AdminTemplate | null> {
  return moderateTemplate(id, `status = 'suspended', suspended_at = NOW(), suspension_reason = $1`, [
    reason,
  ]);
}

export function reinstateTemplate(id: number): Promise<AdminTemplate | null> {
  return moderateTemplate(
    id,
    `status = 'published', published_at = COALESCE(published_at, NOW()), suspended_at = NULL, suspension_reason = NULL`,
    [],
  );
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export async function getAdminStats(): Promise<AdminStats> {
  const usersRow = await query<{ total: string; clients: string; lawyers: string; admins: string }>(
    `SELECT COUNT(*) AS total,
            COUNT(*) FILTER (WHERE user_role = 'client') AS clients,
            COUNT(*) FILTER (WHERE user_role = 'lawyer') AS lawyers,
            COUNT(*) FILTER (WHERE user_role = 'admin')  AS admins
       FROM users`,
  );
  const tplRow = await query<{ total: string; pending: string; published: string; suspended: string }>(
    `SELECT COUNT(*) FILTER (WHERE status <> 'deleted') AS total,
            COUNT(*) FILTER (WHERE status = 'pending_review') AS pending,
            COUNT(*) FILTER (WHERE status = 'published') AS published,
            COUNT(*) FILTER (WHERE status = 'suspended') AS suspended
       FROM marketplace_templates`,
  );
  const salesRow = await query<{ purchases: string; revenue: string }>(
    `SELECT COUNT(*) FILTER (WHERE status = 'paid') AS purchases,
            COALESCE(SUM(amount_cents) FILTER (WHERE status = 'paid'), 0) AS revenue
       FROM marketplace_purchases`,
  );
  const u = usersRow.rows[0];
  const t = tplRow.rows[0];
  const s = salesRow.rows[0];
  return {
    users: {
      total: Number(u?.total ?? 0),
      clients: Number(u?.clients ?? 0),
      lawyers: Number(u?.lawyers ?? 0),
      admins: Number(u?.admins ?? 0),
    },
    templates: {
      total: Number(t?.total ?? 0),
      pendingReview: Number(t?.pending ?? 0),
      published: Number(t?.published ?? 0),
      suspended: Number(t?.suspended ?? 0),
    },
    sales: {
      purchases: Number(s?.purchases ?? 0),
      revenueCents: Number(s?.revenue ?? 0),
    },
  };
}
