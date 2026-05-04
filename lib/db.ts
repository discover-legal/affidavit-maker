import { Pool, type PoolConfig } from 'pg';

// Singleton pg Pool. Next.js may load this module multiple times in dev (HMR),
// so cache the pool on globalThis to avoid leaking connections.
declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
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

export async function query<T = unknown>(
  text: string,
  params?: unknown[],
): Promise<{ rows: T[]; rowCount: number | null }> {
  const result = await pool.query(text, params as never[]);
  return { rows: result.rows as T[], rowCount: result.rowCount };
}
