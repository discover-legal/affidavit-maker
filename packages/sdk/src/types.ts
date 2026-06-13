/**
 * Public domain types for the discover.legal document marketplace.
 *
 * These hand-authored types are the source of truth the typed client is built
 * against. They are kept in lock-step with `openapi.yaml` (the published
 * contract); `npm run generate` regenerates `src/generated/schema.d.ts` from
 * that spec for consumers who want the raw OpenAPI schema types.
 */

export type PracticeArea = 'family' | 'civil';

export type DifficultyLevel = 'basic' | 'standard' | 'complex';

export type TemplateSort = 'popular' | 'newest' | 'rating' | 'price_asc' | 'price_desc';

/** Minimal public-facing summary of the lawyer who authored a template. */
export interface LawyerSummary {
  id: number;
  displayName: string;
}

/** A published marketplace template as returned by the public read APIs. */
export interface MarketplaceTemplate {
  id: number;
  slug: string;
  title: string;
  shortDescription: string | null;
  description: string | null;
  matterType: string;
  practiceArea: PracticeArea;
  jurisdictions: string[];
  /** Price in integer cents. Server-side authority — never client-mutable. */
  priceCents: number;
  coverImageUrl: string | null;
  tags: string[];
  estimatedMinutes: number | null;
  difficultyLevel: DifficultyLevel;
  totalPurchases: number;
  avgRating: number;
  ratingCount: number;
  /** ISO-8601, or null for never-published rows visible to their owner. */
  publishedAt: string | null;
  lawyer: LawyerSummary | null;
}

/** One page of templates with opaque cursor-based pagination. */
export interface TemplateListPage {
  templates: MarketplaceTemplate[];
  /** Opaque cursor for the next page, or null when there are no more results. */
  nextCursor: string | null;
  /** Total matching rows for the first page; null on cursor-following pages. */
  total: number | null;
}

/** Filters + pagination accepted by `templates.list` / `templates.search`. */
export interface TemplateSearchParams {
  /** Full-text query across title, description, and tags. */
  q?: string;
  matterType?: string;
  practiceArea?: PracticeArea;
  /** Two-letter jurisdiction code, e.g. 'TX', 'ON'. */
  jurisdiction?: string;
  /** Inclusive lower price bound, in cents. */
  minPrice?: number;
  /** Inclusive upper price bound, in cents. */
  maxPrice?: number;
  /** Minimum average rating, 0–5. */
  minRating?: number;
  sortBy?: TemplateSort;
  /** Opaque cursor from a prior page's `nextCursor`. */
  cursor?: string;
  /** Page size, 1–100 (server clamps). */
  limit?: number;
}

// ---------------------------------------------------------------------------
// Provider (lawyer) authoring surface — authenticated endpoints.
// ---------------------------------------------------------------------------

export type TemplateStatus =
  | 'draft'
  | 'pending_review'
  | 'published'
  | 'suspended'
  | 'archived'
  | 'deleted';

export type InterviewQuestionType =
  | 'text'
  | 'textarea'
  | 'date'
  | 'number'
  | 'select'
  | 'boolean';

/** One question in a template's guided interview. */
export interface InterviewQuestion {
  /** Stable id, referenced by `{{id}}` placeholders in the body. */
  id: string;
  label: string;
  type: InterviewQuestionType;
  required?: boolean;
  /** Choices for `type: 'select'`. */
  options?: string[];
  help?: string;
}

/** The authored content of a template: its interview + document body. */
export interface TemplateConfig {
  questions: InterviewQuestion[];
  /** Document body with `{{questionId}}` placeholders. */
  body?: string;
}

/** A template as seen by its owning lawyer (all fields, any status). */
export interface LawyerTemplate {
  id: number;
  slug: string;
  title: string;
  shortDescription: string | null;
  description: string | null;
  matterType: string;
  practiceArea: PracticeArea;
  jurisdictions: string[];
  priceCents: number;
  coverImageUrl: string | null;
  tags: string[];
  estimatedMinutes: number | null;
  difficultyLevel: DifficultyLevel;
  status: TemplateStatus;
  version: number;
  templateConfig: TemplateConfig;
  totalPurchases: number;
  totalRevenueCents: number;
  avgRating: number;
  ratingCount: number;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LawyerTemplateListPage {
  templates: LawyerTemplate[];
  nextCursor: string | null;
  total: number | null;
}

export interface LawyerTemplateListParams {
  status?: TemplateStatus;
  cursor?: string;
  limit?: number;
}

/** Payload to create a new draft template. */
export interface CreateTemplateInput {
  title: string;
  matterType: string;
  practiceArea: PracticeArea;
  shortDescription?: string;
  description?: string;
  jurisdictions?: string[];
  /** Integer cents. Defaults server-side to 100 ($1). */
  priceCents?: number;
  tags?: string[];
  estimatedMinutes?: number;
  difficultyLevel?: DifficultyLevel;
  templateConfig?: TemplateConfig;
}

export type UpdateTemplateInput = Partial<CreateTemplateInput>;

export interface LawyerDashboard {
  totals: {
    templates: number;
    published: number;
    drafts: number;
    totalPurchases: number;
    totalRevenueCents: number;
    avgRating: number | null;
  };
  recentTemplates: LawyerTemplate[];
}

// ---------------------------------------------------------------------------
// Buyer checkout + purchases.
// ---------------------------------------------------------------------------

export type PurchaseStatus = 'pending' | 'paid' | 'failed' | 'refunded';

/** A buyer's purchase of a template. */
export interface Purchase {
  id: number;
  templateId: number;
  templateTitle: string;
  templateSlug: string;
  status: PurchaseStatus;
  amountCents: number;
  currency: string;
  interviewAnswers: Record<string, unknown>;
  completedDocument: string | null;
  documentGeneratedAt: string | null;
  createdAt: string;
  paidAt: string | null;
}

/** A purchase plus the template's interview config, for the interview runner. */
export interface PurchaseDetail extends Purchase {
  templateConfig: TemplateConfig;
}

export interface PurchaseListPage {
  purchases: Purchase[];
  nextCursor: string | null;
  total: number | null;
}

/**
 * The result of starting checkout. For a free ($0) template `free` is true,
 * `clientSecret` is null, and the purchase is already 'paid' — go straight to
 * the interview. Otherwise confirm the PaymentIntent with `clientSecret`.
 */
export interface CheckoutSession {
  purchaseId: number;
  amountCents: number;
  currency: string;
  clientSecret: string | null;
  free: boolean;
}

// ---------------------------------------------------------------------------
// Admin surface — moderation + user/role management (admin role only).
// ---------------------------------------------------------------------------

export type UserRole = 'client' | 'lawyer' | 'admin';

export interface AdminUser {
  id: number;
  email: string;
  name: string | null;
  role: UserRole;
  createdAt: string;
}

export interface AdminUserListPage {
  users: AdminUser[];
  nextCursor: string | null;
  total: number | null;
}

/** A template in the moderation view (any owner, any status). */
export interface AdminTemplate {
  id: number;
  slug: string;
  title: string;
  status: TemplateStatus;
  practiceArea: PracticeArea;
  matterType: string;
  priceCents: number;
  lawyer: LawyerSummary | null;
  suspensionReason: string | null;
  createdAt: string;
  publishedAt: string | null;
}

export interface AdminTemplateListPage {
  templates: AdminTemplate[];
  nextCursor: string | null;
  total: number | null;
}

export interface AdminStats {
  users: { total: number; clients: number; lawyers: number; admins: number };
  templates: { total: number; pendingReview: number; published: number; suspended: number };
  sales: { purchases: number; revenueCents: number };
}

/** The success envelope every discover.legal API returns. */
export interface ApiSuccess<T> {
  success: true;
  data: T;
  timestamp: string;
}

/** The error envelope every discover.legal API returns on failure. */
export interface ApiErrorBody {
  success: false;
  error: string;
  errorType?: string;
  requestId?: string;
  timestamp?: string;
}
