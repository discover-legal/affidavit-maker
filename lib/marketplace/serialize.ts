/**
 * lib/marketplace/serialize.ts
 *
 * Maps a `marketplace_templates` DB row (snake_case, with a LEFT JOIN to
 * `users` for the lawyer's display name) onto the public `MarketplaceTemplate`
 * DTO exported by `@discover-legal/sdk`. This is the single trust boundary
 * between the DB shape and the wire shape — internal-only columns
 * (`template_config`, `total_revenue_cents`, `search_vector`, …) are simply
 * never selected by `SELECTED_COLUMNS` and never appear here, so they can't
 * leak to clients.
 */
import type {
  DifficultyLevel,
  LawyerTemplate,
  MarketplaceTemplate,
  PracticeArea,
  TemplateConfig,
  TemplateStatus,
} from '@discover-legal/sdk';

/** The exact columns the repository selects. Keep in sync with SELECTED_COLUMNS. */
export interface TemplateRow {
  id: number;
  slug: string;
  title: string;
  short_description: string | null;
  description: string | null;
  matter_type: string;
  practice_area: string;
  jurisdictions: string[];
  price_cents: number;
  cover_image_url: string | null;
  tags: string[] | null;
  estimated_minutes: number | null;
  difficulty_level: string;
  total_purchases: number;
  avg_rating: string | number;
  rating_count: number;
  published_at: Date | string | null;
  lawyer_id: number | null;
  lawyer_name: string | null;
}

function toIso(value: Date | string | null): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export function serializeTemplate(row: TemplateRow): MarketplaceTemplate {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    shortDescription: row.short_description,
    description: row.description,
    matterType: row.matter_type,
    practiceArea: row.practice_area as PracticeArea,
    jurisdictions: row.jurisdictions ?? [],
    priceCents: row.price_cents,
    coverImageUrl: row.cover_image_url,
    tags: row.tags ?? [],
    estimatedMinutes: row.estimated_minutes,
    difficultyLevel: row.difficulty_level as DifficultyLevel,
    totalPurchases: row.total_purchases,
    avgRating: typeof row.avg_rating === 'string' ? Number(row.avg_rating) : row.avg_rating,
    ratingCount: row.rating_count,
    publishedAt: toIso(row.published_at),
    lawyer:
      row.lawyer_id != null
        ? { id: row.lawyer_id, displayName: row.lawyer_name ?? 'discover.legal provider' }
        : null,
  };
}

/**
 * The owner-facing row shape — a superset of TemplateRow that also carries the
 * authoring/lifecycle columns (status, version, template_config, revenue, …).
 * Selected only by the lawyer repository for the owning lawyer / admin.
 */
export interface LawyerTemplateRow {
  id: number;
  slug: string;
  title: string;
  short_description: string | null;
  description: string | null;
  matter_type: string;
  practice_area: string;
  jurisdictions: string[];
  price_cents: number;
  cover_image_url: string | null;
  tags: string[] | null;
  estimated_minutes: number | null;
  difficulty_level: string;
  status: string;
  version: number;
  template_config: unknown;
  total_purchases: number;
  total_revenue_cents: number;
  avg_rating: string | number;
  rating_count: number;
  published_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

/** Normalize whatever is in the template_config JSONB into a TemplateConfig. */
export function normalizeTemplateConfig(raw: unknown): TemplateConfig {
  const cfg = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const questions = Array.isArray(cfg.questions) ? (cfg.questions as TemplateConfig['questions']) : [];
  const body = typeof cfg.body === 'string' ? cfg.body : undefined;
  return body !== undefined ? { questions, body } : { questions };
}

export function serializeLawyerTemplate(row: LawyerTemplateRow): LawyerTemplate {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    shortDescription: row.short_description,
    description: row.description,
    matterType: row.matter_type,
    practiceArea: row.practice_area as PracticeArea,
    jurisdictions: row.jurisdictions ?? [],
    priceCents: row.price_cents,
    coverImageUrl: row.cover_image_url,
    tags: row.tags ?? [],
    estimatedMinutes: row.estimated_minutes,
    difficultyLevel: row.difficulty_level as DifficultyLevel,
    status: row.status as TemplateStatus,
    version: row.version,
    templateConfig: normalizeTemplateConfig(row.template_config),
    totalPurchases: row.total_purchases,
    totalRevenueCents: row.total_revenue_cents,
    avgRating: typeof row.avg_rating === 'string' ? Number(row.avg_rating) : row.avg_rating,
    ratingCount: row.rating_count,
    publishedAt: toIso(row.published_at),
    createdAt: toIso(row.created_at) ?? '',
    updatedAt: toIso(row.updated_at) ?? '',
  };
}
