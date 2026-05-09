import { Pool, type PoolClient, type PoolConfig } from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Singleton pg Pool. Cached on globalThis to survive Next.js HMR in dev so
 * we don't leak connections.
 *
 * Per-request RLS context is provided via AsyncLocalStorage: when a request
 * runs inside `withRequestClient(client, fn)` (called by `withAuth`), every
 * `query()` in that async chain runs against `client` — which has
 * `SET LOCAL app.user_id = '<userId>'` etc. set on its open transaction.
 * Outside a request scope, `query()` falls back to the pool directly.
 */

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
  // eslint-disable-next-line no-var
  var __pgRequestALS: AsyncLocalStorage<{ client: PoolClient }> | undefined;
}

function buildPool(): Pool {
  const config: PoolConfig = {
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DATABASE_POOL_MAX ?? 20),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl:
      process.env.NODE_ENV === 'production'
        ? { rejectUnauthorized: false }
        : undefined,
  };

  const pool = new Pool(config);
  pool.on('error', (err) => {
    console.error('[db] unexpected pool error', err);
  });
  return pool;
}

export const pool: Pool = global.__pgPool ?? buildPool();
if (process.env.NODE_ENV !== 'production') {
  global.__pgPool = pool;
}

const requestALS: AsyncLocalStorage<{ client: PoolClient }> =
  global.__pgRequestALS ?? new AsyncLocalStorage<{ client: PoolClient }>();
if (process.env.NODE_ENV !== 'production') {
  global.__pgRequestALS = requestALS;
}

export type QueryResult<T> = { rows: T[]; rowCount: number | null };

/**
 * Execute a query against the per-request RLS-scoped client if we're inside
 * a `withRequestClient` chain, otherwise against the pool directly. Existing
 * handler code keeps calling `query()` and gets RLS automatically when wrapped
 * by `withAuth`.
 */
export async function query<T = unknown>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  const ctx = requestALS.getStore();
  const runner = ctx?.client ?? pool;
  const result = await runner.query(text, params as never[]);
  return { rows: result.rows as T[], rowCount: result.rowCount };
}

/**
 * Run `fn` inside a transactional client with RLS session variables set so
 * RLS policies (migrations 010, 012, 013) treat queries as if they came from
 * `userId`. The transaction is COMMITted on success and ROLLed BACK on
 * thrown errors. The client is always released.
 *
 * Variables set:
 *   - app.user_id           (migration 010)
 *   - app.current_user_id   (migrations 012/013, integer cast)
 *   - app.is_admin          (migration 010)
 */
export async function withRLSContext<T>(
  userId: number,
  isAdmin: boolean,
  fn: () => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // set_config(name, value, is_local) — is_local=true → scoped to this txn.
    await client.query('SELECT set_config($1, $2, true)', ['app.user_id', String(userId)]);
    await client.query('SELECT set_config($1, $2, true)', [
      'app.current_user_id',
      String(userId),
    ]);
    await client.query('SELECT set_config($1, $2, true)', [
      'app.is_admin',
      isAdmin ? 'true' : 'false',
    ]);

    const result = await requestALS.run({ client }, fn);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore rollback errors; the original throws below
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Webhook / system operations bypass RLS by setting app.bypass_rls=true.
 * Use sparingly — only for trusted internal flows that must read across
 * users (Stripe webhook, Auth0 webhook).
 */
export async function withRLSBypass<T>(fn: () => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true)', ['app.bypass_rls', 'true']);
    const result = await requestALS.run({ client }, fn);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    throw err;
  } finally {
    client.release();
  }
}
