import { Pool, type PoolClient, type PoolConfig } from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Singleton pg Pool. Cached on globalThis to survive Next.js HMR in dev so
 * we don't leak connections.
 *
 * AsyncLocalStorage carries request identity, not a checked-out PoolClient.
 * Each user query gets a short transaction that applies SET LOCAL and releases
 * immediately, so slow non-database work cannot exhaust the connection pool.
 */

type QueryContext =
  | { kind: 'user'; userId: number; isAdmin: boolean }
  | { kind: 'transaction'; client: PoolClient };

declare global {
  // eslint-disable-next-line no-var
  var __pgPoolPromise: Promise<Pool> | undefined;
  // eslint-disable-next-line no-var
  var __pgRequestALS: AsyncLocalStorage<QueryContext> | undefined;
}

async function resolveSsl(): Promise<PoolConfig['ssl']> {
  if (process.env.NODE_ENV !== 'production') return undefined;

  // Production must authenticate the database before sending credentials.
  // Never "learn" a certificate from an unverified connection: that is TOFU
  // and lets a startup-time MITM choose the certificate we subsequently trust.
  const ca = process.env.DATABASE_CA_CERT;
  if (!ca || !ca.includes('BEGIN CERTIFICATE')) {
    throw new Error(
      '[db] DATABASE_CA_CERT containing the trusted PostgreSQL CA is required in production',
    );
  }
  return { rejectUnauthorized: true, ca };
}

async function buildPool(): Promise<Pool> {
  const ssl = await resolveSsl();
  const config: PoolConfig = {
    connectionString: process.env.DATABASE_URL,
    max: Number(process.env.DATABASE_POOL_MAX ?? 20),
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    ssl,
    // Block accidental statement-level secret leakage by capping how long
    // any single statement can run. The slowest legitimate query in this
    // app is the document save (a few ms); 30s is a generous ceiling that
    // still neutralizes pg-side DoS amplification.
    statement_timeout: Number(process.env.DATABASE_STATEMENT_TIMEOUT_MS ?? 30_000),
  };
  const pool = new Pool(config);
  pool.on('error', (err) => {
    console.error('[db] unexpected pool error', err);
  });
  return pool;
}

function poolPromise(): Promise<Pool> {
  if (!global.__pgPoolPromise) {
    global.__pgPoolPromise = buildPool().catch((err) => {
      // Don't cache a failed init — let the next caller retry.
      global.__pgPoolPromise = undefined;
      throw err;
    });
  }
  return global.__pgPoolPromise;
}

/**
 * Resolves to the initialized singleton Pool. Lazily performs the one-time
 * TLS cert capture on first call.
 */
export function getPool(): Promise<Pool> {
  return poolPromise();
}

const requestALS: AsyncLocalStorage<QueryContext> =
  global.__pgRequestALS ?? new AsyncLocalStorage<QueryContext>();
if (process.env.NODE_ENV !== 'production') {
  global.__pgRequestALS = requestALS;
}

export type QueryResult<T> = { rows: T[]; rowCount: number | null };

/**
 * Execute a query with the current RLS identity. Explicit trusted transactions
 * reuse their client; user requests acquire and release a client per query.
 */
export async function query<T = unknown>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  const ctx = requestALS.getStore();
  if (!ctx || ctx.kind === 'transaction') {
    const runner = ctx?.client ?? (await poolPromise());
    const result = await runner.query(text, params as never[]);
    return { rows: result.rows as T[], rowCount: result.rowCount };
  }

  const pool = await poolPromise();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await setUserRLSVariables(client, ctx.userId, ctx.isAdmin);
    const result = await client.query(text, params as never[]);
    await client.query('COMMIT');
    return { rows: result.rows as T[], rowCount: result.rowCount };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the original error.
    }
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Run `fn` with an RLS identity. This does not acquire a database connection;
 * each query made by `fn` applies the identity in a short transaction.
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
  return requestALS.run({ kind: 'user', userId, isAdmin }, fn);
}

async function setUserRLSVariables(
  client: PoolClient,
  userId: number,
  isAdmin: boolean,
): Promise<void> {
  await client.query('SELECT set_config($1, $2, true)', ['app.user_id', String(userId)]);
  await client.query('SELECT set_config($1, $2, true)', [
    'app.current_user_id',
    String(userId),
  ]);
  await client.query('SELECT set_config($1, $2, true)', [
    'app.is_admin',
    isAdmin ? 'true' : 'false',
  ]);
}

/**
 * Webhook / system operations bypass RLS by setting app.bypass_rls=true.
 * Use sparingly — only for trusted internal flows that must read across
 * users (Stripe webhook, Auth0 webhook).
 */
export async function withRLSBypass<T>(fn: () => Promise<T>): Promise<T> {
  const pool = await poolPromise();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true)', ['app.bypass_rls', 'true']);
    const result = await requestALS.run({ kind: 'transaction', client }, fn);
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
