// services/LawyerProfileService.js - Lawyer profile, Stripe Connect, and subscription management
const logger = require('../utils/logger');
const { ValidationError, NotFoundError, AuthorizationError } = require('../middleware/errorMiddleware');

// Fields that only admins can set — never accept from the lawyer themselves
const ADMIN_ONLY_FIELDS = ['bar_verified', 'bar_verified_at'];
// Fields managed exclusively by Stripe webhook flow
const STRIPE_MANAGED_FIELDS = ['stripe_connect_id', 'stripe_onboarding_complete', 'stripe_payouts_enabled'];

// Allowed updatable profile columns and their corresponding input keys
const UPDATABLE_FIELDS = {
  barNumber: 'bar_number',
  barState: 'bar_state',
  firmName: 'firm_name',
  bio: 'bio',
  displayName: 'display_name',
  yearsExperience: 'years_experience',
  licensedJurisdictions: 'licensed_jurisdictions',
  specialties: 'specialties',
  websiteUrl: 'website_url',
  avatarUrl: 'avatar_url',
};

class LawyerProfileService {
  /**
   * @param {import('pg').Pool} pool - PostgreSQL connection pool
   */
  constructor(pool) {
    this.pool = pool;
    // In-memory cache for hasFeature() — cleared on subscription mutation
    this._featureCache = new Map();
    this._featureCacheTTL = 60_000; // 1 minute
  }

  // ---------------------------------------------------------------------------
  // Profile Management
  // ---------------------------------------------------------------------------

  /**
   * Create a new lawyer profile and promote the user role to 'lawyer'.
   * Runs inside a transaction so both writes succeed or neither does.
   */
  async createProfile(userId, data) {
    if (!userId) throw new ValidationError('userId is required');

    const {
      barNumber, barState, firmName, bio, displayName,
      yearsExperience, licensedJurisdictions, specialties, websiteUrl
    } = data || {};

    if (!barNumber || !barState) {
      throw new ValidationError('barNumber and barState are required');
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      // Verify user exists
      const userCheck = await client.query(
        'SELECT id, user_role FROM users WHERE id = $1',
        [userId]
      );
      if (userCheck.rows.length === 0) {
        throw new NotFoundError('User not found');
      }

      // Check for existing profile
      const existing = await client.query(
        'SELECT id FROM lawyer_profiles WHERE user_id = $1',
        [userId]
      );
      if (existing.rows.length > 0) {
        throw new ValidationError('Lawyer profile already exists for this user');
      }

      // Insert lawyer profile
      const result = await client.query(
        `INSERT INTO lawyer_profiles (
          user_id, bar_number, bar_state, firm_name, bio, display_name,
          years_experience, licensed_jurisdictions, specialties, website_url
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *`,
        [
          userId,
          barNumber,
          barState,
          firmName || null,
          bio || null,
          displayName || null,
          yearsExperience || null,
          licensedJurisdictions || null, // JSONB array
          specialties || null,           // JSONB array
          websiteUrl || null
        ]
      );

      // Promote user role
      await client.query(
        'UPDATE users SET user_role = $1 WHERE id = $2',
        ['lawyer', userId]
      );

      await client.query('COMMIT');

      logger.logBusinessEvent('lawyer_profile_created', userId, {
        barState,
        hasBarNumber: !!barNumber
      });

      return result.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Get a lawyer's own profile with active subscription tiers.
   * Returns null if no profile exists.
   */
  async getProfile(userId) {
    if (!userId) throw new ValidationError('userId is required');

    const result = await this.pool.query(
      `SELECT lp.*,
              COALESCE(
                json_agg(
                  json_build_object(
                    'tierCode', ls.tier_code,
                    'status', ls.status,
                    'currentPeriodEnd', ls.current_period_end,
                    'cancelAtPeriodEnd', ls.cancel_at_period_end
                  )
                ) FILTER (WHERE ls.id IS NOT NULL AND ls.status = 'active'),
                '[]'
              ) AS active_subscriptions
       FROM lawyer_profiles lp
       LEFT JOIN lawyer_subscriptions ls
         ON ls.user_id = lp.user_id AND ls.status = 'active'
       WHERE lp.user_id = $1
       GROUP BY lp.id`,
      [userId]
    );

    return result.rows[0] || null;
  }

  /**
   * Get public-facing lawyer profile for marketplace display.
   * Only returns if the lawyer is bar-verified OR has at least one published template.
   */
  async getProfileBySlug(lawyerId) {
    if (!lawyerId) throw new ValidationError('lawyerId is required');

    const result = await this.pool.query(
      `SELECT
         lp.id,
         lp.user_id,
         lp.display_name,
         lp.firm_name,
         lp.bio,
         lp.avatar_url,
         lp.specialties,
         lp.licensed_jurisdictions,
         lp.bar_verified,
         lp.created_at,
         COUNT(lt.id) FILTER (WHERE lt.status = 'published') AS total_templates,
         COALESCE(SUM(lt.total_sales), 0) AS total_sales,
         COALESCE(
           AVG(lt.avg_rating) FILTER (WHERE lt.avg_rating IS NOT NULL),
           0
         ) AS avg_template_rating
       FROM lawyer_profiles lp
       LEFT JOIN lawyer_templates lt ON lt.lawyer_id = lp.user_id
       WHERE lp.id = $1
       GROUP BY lp.id
       HAVING lp.bar_verified = true
          OR COUNT(lt.id) FILTER (WHERE lt.status = 'published') > 0`,
      [lawyerId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      userId: row.user_id,
      displayName: row.display_name,
      firmName: row.firm_name,
      bio: row.bio,
      avatarUrl: row.avatar_url,
      specialties: row.specialties,
      licensedJurisdictions: row.licensed_jurisdictions,
      barVerified: row.bar_verified,
      totalTemplates: parseInt(row.total_templates, 10),
      totalSales: parseInt(row.total_sales, 10),
      avgTemplateRating: parseFloat(row.avg_template_rating) || 0,
      memberSince: row.created_at
    };
  }

  /**
   * Update profile fields. Only the owning lawyer can update.
   * Admin-only and Stripe-managed fields are rejected.
   */
  async updateProfile(userId, data) {
    if (!userId) throw new ValidationError('userId is required');
    if (!data || Object.keys(data).length === 0) {
      throw new ValidationError('No fields to update');
    }

    // Reject admin-only and Stripe-managed fields
    const forbiddenKeys = [...ADMIN_ONLY_FIELDS, ...STRIPE_MANAGED_FIELDS];
    for (const key of Object.keys(data)) {
      if (forbiddenKeys.includes(key)) {
        throw new AuthorizationError(`Field '${key}' cannot be updated by the user`);
      }
    }

    // Build SET clause from allowed fields only
    const setClauses = [];
    const values = [];
    let paramIndex = 1;

    for (const [inputKey, dbColumn] of Object.entries(UPDATABLE_FIELDS)) {
      if (data[inputKey] !== undefined) {
        setClauses.push(`${dbColumn} = $${paramIndex}`);
        values.push(data[inputKey]);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      throw new ValidationError('No recognized fields to update');
    }

    // Add updated_at
    setClauses.push(`updated_at = NOW()`);

    // Add userId for the WHERE clause
    values.push(userId);

    const result = await this.pool.query(
      `UPDATE lawyer_profiles
       SET ${setClauses.join(', ')}
       WHERE user_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Lawyer profile not found');
    }

    // Invalidate feature cache since profile changed
    this._invalidateFeatureCache(userId);

    return result.rows[0];
  }

  /**
   * Admin action: mark a lawyer's bar membership as verified.
   * Logs to audit_log for compliance.
   */
  async verifyBar(userId, adminUserId) {
    if (!userId) throw new ValidationError('userId is required');
    if (!adminUserId) throw new ValidationError('adminUserId is required');

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `UPDATE lawyer_profiles
         SET bar_verified = true, bar_verified_at = NOW(), updated_at = NOW()
         WHERE user_id = $1
         RETURNING *`,
        [userId]
      );

      if (result.rows.length === 0) {
        throw new NotFoundError('Lawyer profile not found');
      }

      // Audit log entry
      await client.query(
        `INSERT INTO audit_log (user_id, action, resource_type, resource_id, details)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          adminUserId,
          'bar_verification',
          'lawyer_profile',
          result.rows[0].id,
          JSON.stringify({ lawyerUserId: userId, verifiedBy: adminUserId })
        ]
      );

      await client.query('COMMIT');

      logger.logBusinessEvent('bar_verified', userId, {
        verifiedBy: adminUserId,
        profileId: result.rows[0].id
      });

      return result.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Public profile for marketplace template detail pages.
   * Lighter than getProfileBySlug — no visibility gate, just basic info.
   */
  async getPublicProfile(lawyerId) {
    if (!lawyerId) throw new ValidationError('lawyerId is required');

    const result = await this.pool.query(
      `SELECT
         lp.display_name,
         lp.firm_name,
         lp.avatar_url,
         lp.bio,
         lp.specialties,
         lp.licensed_jurisdictions,
         lp.bar_verified,
         lp.created_at,
         COALESCE(SUM(lt.total_sales), 0) AS total_sales,
         COALESCE(
           AVG(lt.avg_rating) FILTER (WHERE lt.avg_rating IS NOT NULL),
           0
         ) AS avg_template_rating
       FROM lawyer_profiles lp
       LEFT JOIN lawyer_templates lt ON lt.lawyer_id = lp.user_id
       WHERE lp.user_id = $1
       GROUP BY lp.id`,
      [lawyerId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      displayName: row.display_name,
      firmName: row.firm_name,
      avatarUrl: row.avatar_url,
      bio: row.bio,
      specialties: row.specialties,
      licensedJurisdictions: row.licensed_jurisdictions,
      barVerified: row.bar_verified,
      totalSales: parseInt(row.total_sales, 10),
      avgTemplateRating: parseFloat(row.avg_template_rating) || 0,
      memberSince: row.created_at
    };
  }

  // ---------------------------------------------------------------------------
  // Stripe Connect Integration
  // ---------------------------------------------------------------------------

  /**
   * Prepare Stripe Connect Express account creation parameters.
   * Does NOT call the Stripe API directly — returns the parameters for the
   * route handler to pass to stripe.accounts.create() and stripe.accountLinks.create().
   */
  async initiateStripeOnboarding(userId) {
    if (!userId) throw new ValidationError('userId is required');

    const profile = await this.pool.query(
      'SELECT id, stripe_connect_id, stripe_onboarding_complete, display_name FROM lawyer_profiles WHERE user_id = $1',
      [userId]
    );

    if (profile.rows.length === 0) {
      throw new NotFoundError('Lawyer profile not found');
    }

    const lawyer = profile.rows[0];

    // If already has a Connect account, return re-onboarding params
    if (lawyer.stripe_connect_id) {
      return {
        alreadyConnected: true,
        stripeConnectId: lawyer.stripe_connect_id,
        onboardingComplete: lawyer.stripe_onboarding_complete,
        accountLinkParams: {
          account: lawyer.stripe_connect_id,
          type: 'account_onboarding'
        }
      };
    }

    // Fetch user email for Stripe account creation
    const user = await this.pool.query(
      'SELECT email FROM users WHERE id = $1',
      [userId]
    );

    return {
      alreadyConnected: false,
      stripeConnectId: null,
      accountCreateParams: {
        type: 'express',
        email: user.rows[0]?.email || undefined,
        metadata: {
          userId: String(userId),
          displayName: lawyer.display_name || ''
        },
        capabilities: {
          transfers: { requested: true }
        }
      },
      // Caller must fill in refresh_url and return_url, then call stripe.accountLinks.create()
      accountLinkParams: {
        type: 'account_onboarding'
      },
      // Callback for the route handler to persist the new connect ID
      _saveConnectId: async (stripeConnectId) => {
        await this.pool.query(
          `UPDATE lawyer_profiles
           SET stripe_connect_id = $1, updated_at = NOW()
           WHERE user_id = $2`,
          [stripeConnectId, userId]
        );
      }
    };
  }

  /**
   * Called after Stripe redirects the lawyer back from onboarding.
   * Updates the profile with onboarding completion status.
   */
  async completeStripeOnboarding(userId, stripeAccountId) {
    if (!userId) throw new ValidationError('userId is required');
    if (!stripeAccountId) throw new ValidationError('stripeAccountId is required');

    const result = await this.pool.query(
      `UPDATE lawyer_profiles
       SET stripe_connect_id = $1,
           stripe_onboarding_complete = true,
           stripe_payouts_enabled = true,
           updated_at = NOW()
       WHERE user_id = $2
       RETURNING *`,
      [stripeAccountId, userId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Lawyer profile not found');
    }

    logger.logBusinessEvent('stripe_onboarding_complete', userId, {
      stripeAccountId
    });

    return result.rows[0];
  }

  /**
   * Get Stripe Connect status for a lawyer.
   */
  async getStripeStatus(userId) {
    if (!userId) throw new ValidationError('userId is required');

    const result = await this.pool.query(
      `SELECT stripe_connect_id, stripe_onboarding_complete, stripe_payouts_enabled
       FROM lawyer_profiles
       WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Lawyer profile not found');
    }

    const row = result.rows[0];
    return {
      connected: !!row.stripe_connect_id,
      onboardingComplete: row.stripe_onboarding_complete || false,
      payoutsEnabled: row.stripe_payouts_enabled || false,
      connectId: row.stripe_connect_id || null
    };
  }

  /**
   * Calculate payout summary from template_purchases.
   */
  async getPayoutSummary(userId) {
    if (!userId) throw new ValidationError('userId is required');

    // Verify profile exists
    const profileCheck = await this.pool.query(
      'SELECT id FROM lawyer_profiles WHERE user_id = $1',
      [userId]
    );
    if (profileCheck.rows.length === 0) {
      throw new NotFoundError('Lawyer profile not found');
    }

    const result = await this.pool.query(
      `SELECT
         COALESCE(SUM(lawyer_payout_cents) FILTER (WHERE payout_status = 'pending'), 0)
           AS pending_payout_cents,
         COALESCE(SUM(lawyer_payout_cents), 0)
           AS total_earned_cents,
         COALESCE(SUM(lawyer_payout_cents) FILTER (
           WHERE created_at >= date_trunc('month', CURRENT_DATE)
         ), 0) AS this_month_cents,
         MAX(created_at) FILTER (WHERE payout_status = 'paid')
           AS last_payout_date,
         (
           SELECT lawyer_payout_cents FROM template_purchases
           WHERE lawyer_id = $1 AND payout_status = 'paid'
           ORDER BY created_at DESC LIMIT 1
         ) AS last_payout_amount
       FROM template_purchases
       WHERE lawyer_id = $1`,
      [userId]
    );

    const row = result.rows[0];
    return {
      pendingPayoutCents: parseInt(row.pending_payout_cents, 10),
      totalEarnedCents: parseInt(row.total_earned_cents, 10),
      thisMonthCents: parseInt(row.this_month_cents, 10),
      lastPayoutDate: row.last_payout_date || null,
      lastPayoutAmount: row.last_payout_amount ? parseInt(row.last_payout_amount, 10) : null
    };
  }

  // ---------------------------------------------------------------------------
  // Subscription Management
  // ---------------------------------------------------------------------------

  /**
   * Get all active subscriptions for a lawyer.
   */
  async getActiveSubscriptions(userId) {
    if (!userId) throw new ValidationError('userId is required');

    const result = await this.pool.query(
      `SELECT tier_code, status, price_cents, current_period_end,
              cancel_at_period_end, stripe_subscription_id
       FROM lawyer_subscriptions
       WHERE user_id = $1 AND status = 'active'
       ORDER BY created_at`,
      [userId]
    );

    return result.rows.map(row => ({
      tierCode: row.tier_code,
      status: row.status,
      priceCents: row.price_cents,
      currentPeriodEnd: row.current_period_end,
      cancelAtPeriodEnd: row.cancel_at_period_end,
      stripeSubscriptionId: row.stripe_subscription_id
    }));
  }

  /**
   * Check if a lawyer has access to a specific feature via their subscription.
   * 'pro' tier grants access to ALL features.
   * Uses a short-lived in-memory cache to avoid repeated DB hits.
   */
  async hasFeature(userId, featureCode) {
    if (!userId || !featureCode) return false;

    const cacheKey = `${userId}:${featureCode}`;
    const cached = this._featureCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < this._featureCacheTTL) {
      return cached.value;
    }

    const result = await this.pool.query(
      `SELECT 1 FROM lawyer_subscriptions
       WHERE user_id = $1
         AND status = 'active'
         AND (tier_code = $2 OR tier_code = 'pro')
       LIMIT 1`,
      [userId, featureCode]
    );

    const has = result.rows.length > 0;
    this._featureCache.set(cacheKey, { value: has, ts: Date.now() });
    return has;
  }

  /**
   * Create or update a subscription row for the given tier.
   * Upserts on (user_id, tier_code) so resubscribing works cleanly.
   */
  async addSubscription(userId, tierCode, stripeData) {
    if (!userId) throw new ValidationError('userId is required');
    if (!tierCode) throw new ValidationError('tierCode is required');

    const {
      stripeSubscriptionId, stripePriceId,
      currentPeriodStart, currentPeriodEnd,
      priceCents
    } = stripeData || {};

    const result = await this.pool.query(
      `INSERT INTO lawyer_subscriptions (
         user_id, tier_code, status, price_cents,
         stripe_subscription_id, stripe_price_id,
         current_period_start, current_period_end
       ) VALUES ($1, $2, 'active', $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, tier_code)
       DO UPDATE SET
         status = 'active',
         price_cents = EXCLUDED.price_cents,
         stripe_subscription_id = EXCLUDED.stripe_subscription_id,
         stripe_price_id = EXCLUDED.stripe_price_id,
         current_period_start = EXCLUDED.current_period_start,
         current_period_end = EXCLUDED.current_period_end,
         cancel_at_period_end = false,
         updated_at = NOW()
       RETURNING *`,
      [
        userId,
        tierCode,
        priceCents || 0,
        stripeSubscriptionId || null,
        stripePriceId || null,
        currentPeriodStart || null,
        currentPeriodEnd || null
      ]
    );

    this._invalidateFeatureCache(userId);

    logger.logBusinessEvent('subscription_added', userId, { tierCode });

    return result.rows[0];
  }

  /**
   * Cancel a subscription at end of billing period.
   */
  async cancelSubscription(userId, tierCode) {
    if (!userId) throw new ValidationError('userId is required');
    if (!tierCode) throw new ValidationError('tierCode is required');

    const result = await this.pool.query(
      `UPDATE lawyer_subscriptions
       SET cancel_at_period_end = true, updated_at = NOW()
       WHERE user_id = $1 AND tier_code = $2 AND status = 'active'
       RETURNING *`,
      [userId, tierCode]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Active subscription not found for this tier');
    }

    this._invalidateFeatureCache(userId);

    logger.logBusinessEvent('subscription_canceled', userId, { tierCode });

    return result.rows[0];
  }

  /**
   * Process Stripe Billing webhook events for lawyer subscriptions.
   * Returns void — webhook handlers must not return data to the caller.
   */
  async handleSubscriptionWebhook(event) {
    if (!event || !event.type) {
      logger.warn('Received invalid subscription webhook event');
      return;
    }

    const subscription = event.data?.object;
    if (!subscription) return;

    const stripeSubId = subscription.id;
    const userId = subscription.metadata?.userId;

    switch (event.type) {
      case 'customer.subscription.updated': {
        await this.pool.query(
          `UPDATE lawyer_subscriptions
           SET status = $1,
               current_period_start = to_timestamp($2),
               current_period_end = to_timestamp($3),
               cancel_at_period_end = $4,
               updated_at = NOW()
           WHERE stripe_subscription_id = $5`,
          [
            subscription.status === 'active' ? 'active' : subscription.status,
            subscription.current_period_start,
            subscription.current_period_end,
            subscription.cancel_at_period_end || false,
            stripeSubId
          ]
        );

        if (userId) this._invalidateFeatureCache(userId);

        logger.logBusinessEvent('subscription_webhook_updated', userId || 'unknown', {
          stripeSubId,
          status: subscription.status
        });
        break;
      }

      case 'customer.subscription.deleted': {
        await this.pool.query(
          `UPDATE lawyer_subscriptions
           SET status = 'canceled', updated_at = NOW()
           WHERE stripe_subscription_id = $1`,
          [stripeSubId]
        );

        if (userId) this._invalidateFeatureCache(userId);

        logger.logBusinessEvent('subscription_webhook_deleted', userId || 'unknown', {
          stripeSubId
        });
        break;
      }

      default:
        logger.debug('Unhandled subscription webhook event type', { type: event.type });
    }
  }

  // ---------------------------------------------------------------------------
  // Dashboard Data
  // ---------------------------------------------------------------------------

  /**
   * Aggregated dashboard summary — profile, template stats, revenue, ratings,
   * and recent activity in a single efficient query using CTEs.
   */
  async getDashboardSummary(userId) {
    if (!userId) throw new ValidationError('userId is required');

    const result = await this.pool.query(
      `WITH profile AS (
         SELECT display_name, avatar_url, bar_verified
         FROM lawyer_profiles
         WHERE user_id = $1
       ),
       template_stats AS (
         SELECT
           COUNT(*) AS total,
           COUNT(*) FILTER (WHERE status = 'published') AS published,
           COUNT(*) FILTER (WHERE status = 'draft') AS draft
         FROM lawyer_templates
         WHERE lawyer_id = $1
       ),
       revenue AS (
         SELECT
           COALESCE(SUM(lawyer_payout_cents), 0) AS total_cents,
           COALESCE(SUM(lawyer_payout_cents) FILTER (
             WHERE created_at >= date_trunc('month', CURRENT_DATE)
           ), 0) AS this_month_cents,
           COALESCE(SUM(lawyer_payout_cents) FILTER (
             WHERE payout_status = 'pending'
           ), 0) AS pending_cents
         FROM template_purchases
         WHERE lawyer_id = $1
       ),
       ratings AS (
         SELECT
           COALESCE(AVG(avg_rating) FILTER (WHERE avg_rating IS NOT NULL), 0) AS avg_rating,
           COALESCE(SUM(rating_count), 0) AS total_reviews
         FROM lawyer_templates
         WHERE lawyer_id = $1
       ),
       recent AS (
         SELECT
           tp.id,
           lt.title AS template_name,
           tp.price_cents AS amount_cents,
           tp.created_at
         FROM template_purchases tp
         JOIN lawyer_templates lt ON lt.id = tp.template_id
         WHERE tp.lawyer_id = $1
         ORDER BY tp.created_at DESC
         LIMIT 5
       )
       SELECT
         row_to_json(profile.*) AS profile,
         row_to_json(template_stats.*) AS template_stats,
         row_to_json(revenue.*) AS revenue,
         row_to_json(ratings.*) AS ratings,
         (SELECT json_agg(recent.*) FROM recent) AS recent_activity
       FROM profile, template_stats, revenue, ratings`,
      [userId]
    );

    if (result.rows.length === 0 || !result.rows[0].profile) {
      throw new NotFoundError('Lawyer profile not found');
    }

    const row = result.rows[0];
    return {
      profile: row.profile,
      templateStats: row.template_stats,
      revenue: row.revenue,
      ratings: {
        avgRating: parseFloat(row.ratings.avg_rating) || 0,
        totalReviews: parseInt(row.ratings.total_reviews, 10)
      },
      recentActivity: row.recent_activity || []
    };
  }

  /**
   * Revenue breakdown over time for dashboard charts.
   * @param {string} userId
   * @param {'daily'|'weekly'|'monthly'} period
   */
  async getRevenueBreakdown(userId, period = 'monthly') {
    if (!userId) throw new ValidationError('userId is required');

    const validPeriods = ['daily', 'weekly', 'monthly'];
    if (!validPeriods.includes(period)) {
      throw new ValidationError(`Invalid period: must be one of ${validPeriods.join(', ')}`);
    }

    // Verify profile exists
    const profileCheck = await this.pool.query(
      'SELECT id FROM lawyer_profiles WHERE user_id = $1',
      [userId]
    );
    if (profileCheck.rows.length === 0) {
      throw new NotFoundError('Lawyer profile not found');
    }

    let truncExpr;
    let intervalExpr;
    switch (period) {
      case 'daily':
        truncExpr = 'day';
        intervalExpr = '30 days';
        break;
      case 'weekly':
        truncExpr = 'week';
        intervalExpr = '12 weeks';
        break;
      case 'monthly':
      default:
        truncExpr = 'month';
        intervalExpr = '12 months';
        break;
    }

    const result = await this.pool.query(
      `SELECT
         date_trunc($2, tp.created_at) AS period,
         COALESCE(SUM(tp.lawyer_payout_cents), 0) AS revenue_cents,
         COUNT(*) AS purchases,
         COUNT(*) FILTER (WHERE tp.refunded = true) AS refunds
       FROM template_purchases tp
       WHERE tp.lawyer_id = $1
         AND tp.created_at >= (CURRENT_DATE - $3::interval)
       GROUP BY date_trunc($2, tp.created_at)
       ORDER BY period`,
      [userId, truncExpr, intervalExpr]
    );

    return result.rows.map(row => ({
      period: row.period,
      revenueCents: parseInt(row.revenue_cents, 10),
      purchases: parseInt(row.purchases, 10),
      refunds: parseInt(row.refunds, 10)
    }));
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /**
   * Clear cached feature flags for a user.
   * Called after any subscription or profile mutation.
   */
  _invalidateFeatureCache(userId) {
    for (const key of this._featureCache.keys()) {
      if (key.startsWith(`${userId}:`)) {
        this._featureCache.delete(key);
      }
    }
  }
}

module.exports = LawyerProfileService;
