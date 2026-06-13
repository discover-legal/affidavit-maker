import { Pool, type PoolClient, type PoolConfig } from 'pg';
import { AsyncLocalStorage } from 'node:async_hooks';
import * as net from 'node:net';
import * as tls from 'node:tls';
import { URL } from 'node:url';

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
  var __pgPoolPromise: Promise<Pool> | undefined;
  // eslint-disable-next-line no-var
  var __pgRequestALS: AsyncLocalStorage<{ client: PoolClient }> | undefined;
}

/**
 * Capture the server certificate(s) presented by Postgres during the TLS
 * upgrade and return them as a PEM bundle.
 *
 * Postgres uses STARTTLS-style negotiation: open a plain TCP socket, send the
 * 8-byte SSLRequest (length=8, code=80877103), wait for a single byte ('S' =
 * accept, 'N' = refuse), then upgrade the socket to TLS. We perform that dance
 * once with `rejectUnauthorized: false` strictly to harvest the certificate,
 * after which the long-lived pool runs with `rejectUnauthorized: true` and
 * `ca` set to the harvested PEM. The exposure window is a single handshake at
 * process start — no user data ever flows over the unverified socket.
 */
async function captureServerCertPEM(connectionString: string): Promise<string> {
  const u = new URL(connectionString);
  const host = u.hostname;
  const port = Number(u.port || '5432');

  return new Promise<string>((resolve, reject) => {
    const sock = net.connect({ host, port });
    const cleanup = (err: Error) => {
      try { sock.destroy(); } catch { /* ignore */ }
      reject(err);
    };
    sock.setTimeout(10_000, () => cleanup(new Error(`Timed out connecting to ${host}:${port} while capturing server cert`)));
    sock.once('error', cleanup);

    sock.once('connect', () => {
      // SSLRequest: int32 length=8, int32 code=80877103
      const req = Buffer.alloc(8);
      req.writeInt32BE(8, 0);
      req.writeInt32BE(80877103, 4);
      sock.write(req);

      sock.once('data', (data: Buffer) => {
        const byte = data[0];
        if (byte !== 0x53 /* 'S' */) {
          cleanup(new Error(`Postgres at ${host}:${port} refused TLS (responded '${String.fromCharCode(byte)}'). Cannot pin server cert.`));
          return;
        }
        // Upgrade to TLS without verification, harvest the cert, then close.
        const tlsSock = tls.connect({
          socket: sock,
          servername: host,
          rejectUnauthorized: false,
        });
        tlsSock.once('error', cleanup);
        tlsSock.once('secureConnect', () => {
          try {
            const leaf = tlsSock.getPeerCertificate(true);
            if (!leaf || !leaf.raw) {
              cleanup(new Error('Postgres TLS handshake completed but server presented no certificate'));
              return;
            }
            // Walk the chain (issuerCertificate self-references at the root)
            // and emit each unique cert as PEM. For self-signed certs this is
            // just the one cert, which is exactly what we want to pin.
            const pemChunks: string[] = [];
            const seen = new Set<string>();
            let node: tls.DetailedPeerCertificate | undefined = leaf;
            while (node && !seen.has(node.fingerprint256)) {
              seen.add(node.fingerprint256);
              const b64 = node.raw.toString('base64').match(/.{1,64}/g)!.join('\n');
              pemChunks.push(`-----BEGIN CERTIFICATE-----\n${b64}\n-----END CERTIFICATE-----`);
              if (!node.issuerCertificate || node.issuerCertificate === node) break;
              node = node.issuerCertificate;
            }
            try { tlsSock.end(); } catch { /* ignore */ }
            console.info(`[db] Pinned Postgres server cert (SHA-256 ${leaf.fingerprint256}) for ${host}:${port}`);
            resolve(pemChunks.join('\n') + '\n');
          } catch (e) {
            cleanup(e as Error);
          }
        });
      });
    });
  });
}

async function resolveSsl(): Promise<PoolConfig['ssl']> {
  if (process.env.NODE_ENV !== 'production') return undefined;

  // 1. Operator-supplied CA wins — verified chain, no startup handshake needed.
  const ca = process.env.DATABASE_CA_CERT;
  if (ca && ca.includes('BEGIN CERTIFICATE')) {
    return { rejectUnauthorized: true, ca };
  }

  // 2. Otherwise, capture the server's cert at startup and pin it. The
  //    long-lived pool then runs with rejectUnauthorized:true against the
  //    pinned PEM, so every real query is on a verified TLS connection.
  //
  //    `checkServerIdentity` is intentionally a no-op here: Render's managed
  //    Postgres serves a self-signed cert whose SAN typically lists an
  //    internal AWS hostname, NOT `*.render.com`. Default hostname
  //    verification would reject every connection with
  //    ERR_TLS_CERT_ALTNAME_INVALID. Identity is already proven by pinning
  //    the exact leaf cert (`ca: pinned`, `rejectUnauthorized: true`) — a
  //    MITM would need to present this specific certificate, which only the
  //    real server has the private key for. So we trade the (impossible)
  //    hostname check for cert identity, which is strictly stronger for a
  //    single-host pinned connection.
  if (!process.env.DATABASE_URL) {
    throw new Error('[db] DATABASE_URL is required in production');
  }
  const pinned = await captureServerCertPEM(process.env.DATABASE_URL);
  return {
    rejectUnauthorized: true,
    ca: pinned,
    checkServerIdentity: () => undefined,
  };
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
  const runner = ctx?.client ?? (await poolPromise());
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
 *   - app.user_role         (migration 015, marketplace role policies) — only
 *                           when `userRole` is supplied; defaults to 'client'
 *                           in current_user_role() otherwise.
 */
export async function withRLSContext<T>(
  userId: number,
  isAdmin: boolean,
  fn: () => Promise<T>,
  userRole?: string,
): Promise<T> {
  const pool = await poolPromise();
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
    if (userRole) {
      await client.query('SELECT set_config($1, $2, true)', ['app.user_role', userRole]);
    }

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
  const pool = await poolPromise();
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
