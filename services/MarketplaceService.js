// services/MarketplaceService.js - Marketplace template CRUD, search, and discovery
const crypto = require('crypto');
const logger = require('../utils/logger');
const {
  ValidationError,
  NotFoundError,
  AuthorizationError
} = require('../middleware/errorMiddleware');

// Valid matter types (matches catalog.js codes)
const VALID_MATTER_TYPES = new Set([
  'divorce', 'custody', 'child_support', 'dvro', 'paternity',
  'legal_separation', 'annulment', 'guardianship_minor', 'adoption',
  'emancipation', 'small_claims', 'name_change', 'debt_defense',
  'landlord_tenant', 'civil_harassment', 'general_civil', 'probate',
  'affidavit'
]);

const VALID_PRACTICE_AREAS = new Set([
  'family', 'civil', 'criminal', 'estate', 'business', 'immigration',
  'employment', 'real_estate', 'bankruptcy', 'tax'
]);

const VALID_SORT_OPTIONS = new Set([
  'popular', 'rating', 'newest', 'price_low', 'price_high'
]);

const TEMPLATE_COLUMNS = `
  mt.id, mt.lawyer_id, mt.title, mt.slug, mt.description, mt.short_description,
  mt.matter_type, mt.practice_area, mt.jurisdictions, mt.template_config,
  mt.price_cents, mt.status, mt.version, mt.current_version_id,
  mt.cover_image_url, mt.tags, mt.estimated_minutes, mt.difficulty_level,
  mt.total_purchases, mt.total_revenue_cents, mt.avg_rating, mt.rating_count,
  mt.published_at, mt.created_at, mt.updated_at
`.trim();

const LAWYER_JOIN_COLUMNS = `
  lp.display_name AS lawyer_display_name,
  lp.avatar_url AS lawyer_avatar_url,
  lp.firm_name AS lawyer_firm_name,
  lp.bar_state AS lawyer_bar_state,
  lp.bar_verified AS lawyer_bar_verified,
  lp.years_experience AS lawyer_years_experience,
  lp.avg_template_rating AS lawyer_avg_rating
`.trim();

class MarketplaceService {
  constructor(pool) {
    this.pool = pool;
  }

  // ---------------------------------------------------------------------------
  // Template CRUD (Lawyer)
  // ---------------------------------------------------------------------------

  async createTemplate(lawyerId, data) {
    await this._assertLawyerRole(lawyerId);

    const { title, description, shortDescription, matterType, practiceArea,
      jurisdictions, templateConfig, priceCents, coverImageUrl, tags,
      estimatedMinutes, difficultyLevel } = data;

    if (!title || typeof title !== 'string' || title.trim().length < 3) {
      throw new ValidationError('Title is required and must be at least 3 characters');
    }
    if (!matterType || !VALID_MATTER_TYPES.has(matterType)) {
      throw new ValidationError(`Invalid matter_type. Must be one of: ${[...VALID_MATTER_TYPES].join(', ')}`);
    }
    if (!Array.isArray(jurisdictions) || jurisdictions.length === 0) {
      throw new ValidationError('At least one jurisdiction is required');
    }
    if (practiceArea && !VALID_PRACTICE_AREAS.has(practiceArea)) {
      throw new ValidationError(`Invalid practice_area. Must be one of: ${[...VALID_PRACTICE_AREAS].join(', ')}`);
    }

    const slug = this._generateSlug(title);

    const result = await this.pool.query(
      `INSERT INTO marketplace_templates
        (lawyer_id, title, slug, description, short_description, matter_type,
         practice_area, jurisdictions, template_config, price_cents,
         cover_image_url, tags, estimated_minutes, difficulty_level, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'draft')
       RETURNING *`,
      [
        lawyerId, title.trim(), slug,
        description || null, shortDescription || null,
        matterType, practiceArea || 'civil',
        jurisdictions, templateConfig || {},
        priceCents != null ? priceCents : 100,
        coverImageUrl || null, tags || [],
        estimatedMinutes || 15, difficultyLevel || 'standard'
      ]
    );

    logger.info('Marketplace template created', { templateId: result.rows[0].id, lawyerId });
    return result.rows[0];
  }

  async getTemplate(templateId, userId = null) {
    const result = await this.pool.query(
      `SELECT ${TEMPLATE_COLUMNS}, ${LAWYER_JOIN_COLUMNS}
       FROM marketplace_templates mt
       LEFT JOIN lawyer_profiles lp ON lp.user_id = mt.lawyer_id
       WHERE mt.id = $1 AND mt.deleted_at IS NULL`,
      [templateId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Template not found');
    }

    const template = result.rows[0];
    this._assertCanView(template, userId);
    return template;
  }

  async getTemplateBySlug(slug, userId = null) {
    const result = await this.pool.query(
      `SELECT ${TEMPLATE_COLUMNS}, ${LAWYER_JOIN_COLUMNS}
       FROM marketplace_templates mt
       LEFT JOIN lawyer_profiles lp ON lp.user_id = mt.lawyer_id
       WHERE mt.slug = $1 AND mt.deleted_at IS NULL`,
      [slug]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Template not found');
    }

    const template = result.rows[0];
    this._assertCanView(template, userId);
    return template;
  }

  async updateTemplate(templateId, lawyerId, data) {
    const existing = await this._getOwnedTemplate(templateId, lawyerId);

    if (existing.status === 'suspended') {
      throw new ValidationError('Cannot update a suspended template. Contact support.');
    }

    const fields = [];
    const values = [];
    let paramIndex = 1;

    const allowedFields = {
      title: 'title', description: 'description', shortDescription: 'short_description',
      matterType: 'matter_type', practiceArea: 'practice_area',
      jurisdictions: 'jurisdictions', templateConfig: 'template_config',
      priceCents: 'price_cents', coverImageUrl: 'cover_image_url',
      tags: 'tags', estimatedMinutes: 'estimated_minutes',
      difficultyLevel: 'difficulty_level'
    };

    for (const [jsKey, dbCol] of Object.entries(allowedFields)) {
      if (data[jsKey] !== undefined) {
        // Validate specific fields
        if (jsKey === 'matterType' && !VALID_MATTER_TYPES.has(data[jsKey])) {
          throw new ValidationError(`Invalid matter_type`);
        }
        if (jsKey === 'practiceArea' && !VALID_PRACTICE_AREAS.has(data[jsKey])) {
          throw new ValidationError(`Invalid practice_area`);
        }
        if (jsKey === 'jurisdictions') {
          if (!Array.isArray(data[jsKey]) || data[jsKey].length === 0) {
            throw new ValidationError('At least one jurisdiction is required');
          }
        }
        fields.push(`${dbCol} = $${paramIndex}`);
        values.push(data[jsKey]);
        paramIndex++;
      }
    }

    // Auto-update slug if title changed
    if (data.title) {
      fields.push(`slug = $${paramIndex}`);
      values.push(this._generateSlug(data.title));
      paramIndex++;
    }

    if (fields.length === 0) {
      return existing;
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(templateId, lawyerId);

    const result = await this.pool.query(
      `UPDATE marketplace_templates
       SET ${fields.join(', ')}
       WHERE id = $${paramIndex} AND lawyer_id = $${paramIndex + 1} AND deleted_at IS NULL
       RETURNING *`,
      values
    );

    logger.info('Marketplace template updated', { templateId, lawyerId });
    return result.rows[0];
  }

  async deleteTemplate(templateId, lawyerId) {
    await this._getOwnedTemplate(templateId, lawyerId);

    await this.pool.query(
      `UPDATE marketplace_templates
       SET status = 'deleted', deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND lawyer_id = $2`,
      [templateId, lawyerId]
    );

    logger.info('Marketplace template soft-deleted', { templateId, lawyerId });
  }

  async publishTemplate(templateId, lawyerId) {
    const template = await this._getOwnedTemplate(templateId, lawyerId);

    if (template.status !== 'draft') {
      throw new ValidationError(`Only draft templates can be published. Current status: ${template.status}`);
    }
    if (!template.template_config || Object.keys(template.template_config).length === 0) {
      throw new ValidationError('Template config must not be empty before publishing');
    }
    if (!template.jurisdictions || template.jurisdictions.length === 0) {
      throw new ValidationError('At least one jurisdiction is required before publishing');
    }

    const newVersion = template.version + 1;

    // Create a new template_version row
    const versionResult = await this.pool.query(
      `INSERT INTO template_versions (template_id, version_number, template_config, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [templateId, newVersion, template.template_config, lawyerId]
    );

    const versionId = versionResult.rows[0].id;

    // Update the template: pending_review (auto-approve could change this to 'published')
    const autoApprove = process.env.MARKETPLACE_AUTO_APPROVE === 'true';
    const newStatus = autoApprove ? 'published' : 'pending_review';

    const result = await this.pool.query(
      `UPDATE marketplace_templates
       SET status = $1, version = $2, current_version_id = $3,
           published_at = CASE WHEN $1 = 'published' THEN CURRENT_TIMESTAMP ELSE published_at END,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4 AND lawyer_id = $5
       RETURNING *`,
      [newStatus, newVersion, versionId, templateId, lawyerId]
    );

    logger.info('Marketplace template published', { templateId, lawyerId, newStatus, version: newVersion });
    return result.rows[0];
  }

  async unpublishTemplate(templateId, lawyerId) {
    const template = await this._getOwnedTemplate(templateId, lawyerId);

    if (template.status !== 'published') {
      throw new ValidationError('Only published templates can be unpublished');
    }

    const result = await this.pool.query(
      `UPDATE marketplace_templates
       SET status = 'draft', updated_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND lawyer_id = $2
       RETURNING *`,
      [templateId, lawyerId]
    );

    logger.info('Marketplace template unpublished', { templateId, lawyerId });
    return result.rows[0];
  }

  async duplicateTemplate(templateId, lawyerId) {
    const template = await this._getOwnedTemplate(templateId, lawyerId);

    const newTitle = `Copy of ${template.title}`;
    const newSlug = this._generateSlug(newTitle);

    const result = await this.pool.query(
      `INSERT INTO marketplace_templates
        (lawyer_id, title, slug, description, short_description, matter_type,
         practice_area, jurisdictions, template_config, price_cents,
         cover_image_url, tags, estimated_minutes, difficulty_level, status)
       SELECT lawyer_id, $1, $2, description, short_description, matter_type,
              practice_area, jurisdictions, template_config, price_cents,
              cover_image_url, tags, estimated_minutes, difficulty_level, 'draft'
       FROM marketplace_templates
       WHERE id = $3
       RETURNING *`,
      [newTitle, newSlug, templateId]
    );

    logger.info('Marketplace template duplicated', { sourceId: templateId, newId: result.rows[0].id, lawyerId });
    return result.rows[0];
  }

  // ---------------------------------------------------------------------------
  // Marketplace Discovery (Public)
  // ---------------------------------------------------------------------------

  async searchTemplates(options = {}) {
    const { q, matterType, practiceArea, jurisdiction, minPrice, maxPrice,
      minRating, sortBy = 'popular', cursor, limit = 20 } = options;

    const safeLimit = Math.min(Math.max(1, parseInt(limit, 10) || 20), 100);

    if (sortBy && !VALID_SORT_OPTIONS.has(sortBy)) {
      throw new ValidationError(`Invalid sortBy. Must be one of: ${[...VALID_SORT_OPTIONS].join(', ')}`);
    }

    const { whereClause, params, nextParamIndex } = this._buildSearchQuery(options);
    const orderBy = this._sortColumn(sortBy);
    const cursorWhere = cursor ? this._buildCursorCondition(cursor, sortBy, nextParamIndex) : null;

    let fullWhere = whereClause;
    const fullParams = [...params];

    if (cursorWhere) {
      fullWhere += ` AND ${cursorWhere.clause}`;
      fullParams.push(...cursorWhere.params);
    }

    // Count total (without cursor, for first page)
    let total = null;
    if (!cursor) {
      const countResult = await this.pool.query(
        `SELECT COUNT(*) FROM marketplace_templates mt WHERE ${whereClause}`,
        params
      );
      total = parseInt(countResult.rows[0].count, 10);
    }

    const limitParam = fullParams.length + 1;
    fullParams.push(safeLimit + 1); // fetch one extra to detect next page

    const result = await this.pool.query(
      `SELECT ${TEMPLATE_COLUMNS}, ${LAWYER_JOIN_COLUMNS}
       FROM marketplace_templates mt
       LEFT JOIN lawyer_profiles lp ON lp.user_id = mt.lawyer_id
       WHERE ${fullWhere}
       ORDER BY ${orderBy}, mt.id DESC
       LIMIT $${limitParam}`,
      fullParams
    );

    const hasMore = result.rows.length > safeLimit;
    const templates = hasMore ? result.rows.slice(0, safeLimit) : result.rows;

    let nextCursor = null;
    if (hasMore) {
      const last = templates[templates.length - 1];
      nextCursor = this._encodeCursor(last, sortBy);
    }

    return { templates, nextCursor, total };
  }

  async getFeaturedTemplates(limit = 8) {
    const safeLimit = Math.min(Math.max(1, limit), 50);

    // Try featured placements first
    const featured = await this.pool.query(
      `SELECT ${TEMPLATE_COLUMNS}, ${LAWYER_JOIN_COLUMNS}
       FROM marketplace_templates mt
       LEFT JOIN lawyer_profiles lp ON lp.user_id = mt.lawyer_id
       INNER JOIN featured_placements fp ON fp.template_id = mt.id
       WHERE mt.status = 'published' AND mt.deleted_at IS NULL
         AND fp.starts_at <= CURRENT_TIMESTAMP AND fp.ends_at > CURRENT_TIMESTAMP
       ORDER BY fp.position ASC, mt.avg_rating DESC
       LIMIT $1`,
      [safeLimit]
    );

    if (featured.rows.length >= safeLimit) {
      return featured.rows;
    }

    // Fall back to top-rated published templates
    const topRated = await this.pool.query(
      `SELECT ${TEMPLATE_COLUMNS}, ${LAWYER_JOIN_COLUMNS}
       FROM marketplace_templates mt
       LEFT JOIN lawyer_profiles lp ON lp.user_id = mt.lawyer_id
       WHERE mt.status = 'published' AND mt.deleted_at IS NULL
         AND mt.rating_count >= 3
       ORDER BY mt.avg_rating DESC, mt.total_purchases DESC
       LIMIT $1`,
      [safeLimit]
    );

    return topRated.rows;
  }

  async getTrendingTemplates(limit = 10) {
    const safeLimit = Math.min(Math.max(1, limit), 50);

    const result = await this.pool.query(
      `SELECT ${TEMPLATE_COLUMNS}, ${LAWYER_JOIN_COLUMNS},
              COALESCE(SUM(ta.purchases), 0) AS recent_purchases
       FROM marketplace_templates mt
       LEFT JOIN lawyer_profiles lp ON lp.user_id = mt.lawyer_id
       LEFT JOIN template_analytics ta
         ON ta.template_id = mt.id AND ta.date >= CURRENT_DATE - INTERVAL '7 days'
       WHERE mt.status = 'published' AND mt.deleted_at IS NULL
       GROUP BY mt.id, lp.display_name, lp.avatar_url, lp.firm_name,
                lp.bar_state, lp.bar_verified, lp.years_experience, lp.avg_template_rating
       ORDER BY recent_purchases DESC, mt.avg_rating DESC
       LIMIT $1`,
      [safeLimit]
    );

    return result.rows;
  }

  async getNewTemplates(limit = 10) {
    const safeLimit = Math.min(Math.max(1, limit), 50);

    const result = await this.pool.query(
      `SELECT ${TEMPLATE_COLUMNS}, ${LAWYER_JOIN_COLUMNS}
       FROM marketplace_templates mt
       LEFT JOIN lawyer_profiles lp ON lp.user_id = mt.lawyer_id
       WHERE mt.status = 'published' AND mt.deleted_at IS NULL
       ORDER BY mt.published_at DESC
       LIMIT $1`,
      [safeLimit]
    );

    return result.rows;
  }

  async getTemplatesByJurisdiction(jurisdictionCode, options = {}) {
    return this.searchTemplates({ ...options, jurisdiction: jurisdictionCode });
  }

  async getTemplatesByMatterType(matterType, options = {}) {
    return this.searchTemplates({ ...options, matterType });
  }

  async getCategories() {
    const result = await this.pool.query(
      `SELECT id, slug, display_name, description, parent_id, icon_name, sort_order
       FROM template_categories
       WHERE is_active = true
       ORDER BY sort_order ASC, display_name ASC`
    );

    // Build parent/children hierarchy
    const byId = new Map();
    const roots = [];

    for (const row of result.rows) {
      row.children = [];
      byId.set(row.id, row);
    }

    for (const row of result.rows) {
      if (row.parent_id && byId.has(row.parent_id)) {
        byId.get(row.parent_id).children.push(row);
      } else {
        roots.push(row);
      }
    }

    return roots;
  }

  // ---------------------------------------------------------------------------
  // Lawyer Dashboard Data
  // ---------------------------------------------------------------------------

  async getLawyerTemplates(lawyerId, options = {}) {
    const { status, sortBy = 'newest', cursor, limit = 20 } = options;
    const safeLimit = Math.min(Math.max(1, parseInt(limit, 10) || 20), 100);

    const conditions = ['mt.lawyer_id = $1', 'mt.deleted_at IS NULL'];
    const params = [lawyerId];
    let paramIndex = 2;

    if (status) {
      conditions.push(`mt.status = $${paramIndex}`);
      params.push(status);
      paramIndex++;
    }

    const orderBy = this._sortColumn(sortBy);

    if (cursor) {
      const cursorCond = this._buildCursorCondition(cursor, sortBy, paramIndex);
      conditions.push(cursorCond.clause);
      params.push(...cursorCond.params);
      paramIndex += cursorCond.params.length;
    }

    params.push(safeLimit + 1);

    const result = await this.pool.query(
      `SELECT ${TEMPLATE_COLUMNS}
       FROM marketplace_templates mt
       WHERE ${conditions.join(' AND ')}
       ORDER BY ${orderBy}, mt.id DESC
       LIMIT $${paramIndex}`,
      params
    );

    const hasMore = result.rows.length > safeLimit;
    const templates = hasMore ? result.rows.slice(0, safeLimit) : result.rows;

    let nextCursor = null;
    if (hasMore) {
      nextCursor = this._encodeCursor(templates[templates.length - 1], sortBy);
    }

    return { templates, nextCursor };
  }

  async getLawyerDashboardSummary(lawyerId) {
    const templateStats = await this.pool.query(
      `SELECT
        COUNT(*) FILTER (WHERE deleted_at IS NULL) AS total_templates,
        COUNT(*) FILTER (WHERE status = 'published' AND deleted_at IS NULL) AS published_templates,
        COALESCE(SUM(total_purchases) FILTER (WHERE deleted_at IS NULL), 0) AS total_sales,
        COALESCE(SUM(total_revenue_cents) FILTER (WHERE deleted_at IS NULL), 0) AS total_revenue,
        COALESCE(AVG(avg_rating) FILTER (WHERE rating_count > 0 AND deleted_at IS NULL), 0) AS avg_rating
       FROM marketplace_templates
       WHERE lawyer_id = $1`,
      [lawyerId]
    );

    const monthlyStats = await this.pool.query(
      `SELECT
        COALESCE(SUM(ta.views), 0) AS views_this_month,
        COALESCE(SUM(ta.purchases), 0) AS sales_this_month,
        COALESCE(SUM(ta.revenue_cents), 0) AS revenue_this_month
       FROM template_analytics ta
       INNER JOIN marketplace_templates mt ON mt.id = ta.template_id
       WHERE mt.lawyer_id = $1
         AND ta.date >= date_trunc('month', CURRENT_DATE)`,
      [lawyerId]
    );

    const stats = templateStats.rows[0];
    const monthly = monthlyStats.rows[0];

    return {
      totalTemplates: parseInt(stats.total_templates, 10),
      publishedTemplates: parseInt(stats.published_templates, 10),
      totalSales: parseInt(stats.total_sales, 10),
      totalRevenue: parseInt(stats.total_revenue, 10),
      avgRating: parseFloat(stats.avg_rating) || 0,
      viewsThisMonth: parseInt(monthly.views_this_month, 10),
      salesThisMonth: parseInt(monthly.sales_this_month, 10),
      revenueThisMonth: parseInt(monthly.revenue_this_month, 10)
    };
  }

  // ---------------------------------------------------------------------------
  // Analytics Tracking
  // ---------------------------------------------------------------------------

  async trackView(templateId, userId = null) {
    await this.pool.query(
      `INSERT INTO template_analytics (template_id, date, views)
       VALUES ($1, CURRENT_DATE, 1)
       ON CONFLICT (template_id, date)
       DO UPDATE SET views = template_analytics.views + 1`,
      [templateId]
    );
  }

  async trackDetailView(templateId, userId = null) {
    await this.pool.query(
      `INSERT INTO template_analytics (template_id, date, detail_views)
       VALUES ($1, CURRENT_DATE, 1)
       ON CONFLICT (template_id, date)
       DO UPDATE SET detail_views = template_analytics.detail_views + 1`,
      [templateId]
    );
  }

  // ---------------------------------------------------------------------------
  // Internal Helpers
  // ---------------------------------------------------------------------------

  _generateSlug(title) {
    const base = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
    const suffix = crypto.randomBytes(3).toString('hex');
    return `${base}-${suffix}`;
  }

  _buildSearchQuery(options) {
    const { q, matterType, practiceArea, jurisdiction, minPrice, maxPrice, minRating } = options;

    const conditions = ['mt.status = \'published\'', 'mt.deleted_at IS NULL'];
    const params = [];
    let paramIndex = 1;

    if (q && q.trim()) {
      conditions.push(`mt.search_vector @@ plainto_tsquery('english', $${paramIndex})`);
      params.push(q.trim());
      paramIndex++;
    }

    if (matterType) {
      conditions.push(`mt.matter_type = $${paramIndex}`);
      params.push(matterType);
      paramIndex++;
    }

    if (practiceArea) {
      conditions.push(`mt.practice_area = $${paramIndex}`);
      params.push(practiceArea);
      paramIndex++;
    }

    if (jurisdiction) {
      conditions.push(`$${paramIndex} = ANY(mt.jurisdictions)`);
      params.push(jurisdiction);
      paramIndex++;
    }

    if (minPrice != null) {
      conditions.push(`mt.price_cents >= $${paramIndex}`);
      params.push(parseInt(minPrice, 10));
      paramIndex++;
    }

    if (maxPrice != null) {
      conditions.push(`mt.price_cents <= $${paramIndex}`);
      params.push(parseInt(maxPrice, 10));
      paramIndex++;
    }

    if (minRating != null) {
      conditions.push(`mt.avg_rating >= $${paramIndex}`);
      params.push(parseFloat(minRating));
      paramIndex++;
    }

    return {
      whereClause: conditions.join(' AND '),
      params,
      nextParamIndex: paramIndex
    };
  }

  _sortColumn(sortBy) {
    switch (sortBy) {
      case 'popular':    return 'mt.total_purchases DESC';
      case 'rating':     return 'mt.avg_rating DESC';
      case 'newest':     return 'mt.published_at DESC';
      case 'price_low':  return 'mt.price_cents ASC';
      case 'price_high': return 'mt.price_cents DESC';
      default:           return 'mt.total_purchases DESC';
    }
  }

  _encodeCursor(row, sortBy) {
    const payload = { id: row.id };
    switch (sortBy) {
      case 'popular':    payload.v = row.total_purchases; break;
      case 'rating':     payload.v = row.avg_rating; break;
      case 'newest':     payload.v = row.published_at; break;
      case 'price_low':
      case 'price_high': payload.v = row.price_cents; break;
      default:           payload.v = row.total_purchases; break;
    }
    return Buffer.from(JSON.stringify(payload)).toString('base64url');
  }

  _buildCursorCondition(cursor, sortBy, startParamIndex) {
    let decoded;
    try {
      decoded = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    } catch {
      throw new ValidationError('Invalid cursor');
    }

    const { id, v } = decoded;
    if (id == null || v == null) {
      throw new ValidationError('Invalid cursor payload');
    }

    // Keyset pagination: (sortCol, id) pair for deterministic ordering
    const isAsc = sortBy === 'price_low';
    const op = isAsc ? '>' : '<';
    const sortCol = this._sortColumnRaw(sortBy);

    return {
      clause: `(${sortCol} ${op} $${startParamIndex} OR (${sortCol} = $${startParamIndex} AND mt.id < $${startParamIndex + 1}))`,
      params: [v, id]
    };
  }

  _sortColumnRaw(sortBy) {
    switch (sortBy) {
      case 'popular':    return 'mt.total_purchases';
      case 'rating':     return 'mt.avg_rating';
      case 'newest':     return 'mt.published_at';
      case 'price_low':
      case 'price_high': return 'mt.price_cents';
      default:           return 'mt.total_purchases';
    }
  }

  async _assertLawyerRole(userId) {
    const result = await this.pool.query(
      `SELECT user_role FROM users WHERE id = $1`,
      [userId]
    );
    if (result.rows.length === 0) {
      throw new NotFoundError('User not found');
    }
    if (result.rows[0].user_role !== 'lawyer') {
      throw new AuthorizationError('Only users with the lawyer role can manage marketplace templates');
    }
  }

  async _getOwnedTemplate(templateId, lawyerId) {
    const result = await this.pool.query(
      `SELECT * FROM marketplace_templates WHERE id = $1 AND deleted_at IS NULL`,
      [templateId]
    );
    if (result.rows.length === 0) {
      throw new NotFoundError('Template not found');
    }
    if (result.rows[0].lawyer_id !== lawyerId) {
      throw new AuthorizationError('You do not own this template');
    }
    return result.rows[0];
  }

  _assertCanView(template, userId) {
    if (template.status === 'published') return;
    // Non-published templates are only visible to the owner
    if (!userId || template.lawyer_id !== userId) {
      throw new NotFoundError('Template not found');
    }
  }
}

module.exports = MarketplaceService;
