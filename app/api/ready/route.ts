import { constants as fsConstants, promises as fs } from 'node:fs';
import path from 'node:path';
import { getPool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ReadinessResult = {
  ready: boolean;
  checkedAt: string;
  checks: Record<string, 'ok' | 'failed'>;
};

let cached: { expiresAt: number; result: ReadinessResult } | undefined;

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('readiness timeout')), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function runChecks(): Promise<ReadinessResult> {
  const checks: ReadinessResult['checks'] = {};
  const required = [
    'DATABASE_URL',
    'DATABASE_CA_CERT',
    'AUTH0_SECRET',
    'AUTH0_BASE_URL',
    'AUTH0_ISSUER_BASE_URL',
    'AUTH0_CLIENT_ID',
    'AUTH0_CLIENT_SECRET',
    'AUTH0_WEBHOOK_SECRET',
    'OPENAI_API_KEY',
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
    'PAYMENTS_MODE',
  ];
  checks.configuration = required.every((key) => Boolean(process.env[key])) ? 'ok' : 'failed';
  if (checks.configuration === 'ok') {
    const livePayments = process.env.PAYMENTS_MODE === 'live';
    const validPaymentsMode = livePayments || process.env.PAYMENTS_MODE === 'test';
    const stripeModeMatches = livePayments
      ? process.env.STRIPE_SECRET_KEY!.startsWith('sk_live_')
        && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!.startsWith('pk_live_')
      : process.env.STRIPE_SECRET_KEY!.startsWith('sk_test_')
        && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!.startsWith('pk_test_');
    let baseUrlValid = false;
    try {
      baseUrlValid = new URL(process.env.AUTH0_BASE_URL!).protocol === 'https:';
    } catch {
      baseUrlValid = false;
    }
    if (!validPaymentsMode || !stripeModeMatches || !baseUrlValid) checks.configuration = 'failed';
  }

  try {
    await withTimeout((async () => {
      const pool = await getPool();
      await pool.query('SELECT 1');
    })(), 3_000);
    checks.database = 'ok';
  } catch {
    checks.database = 'failed';
  }

  try {
    const documentsPath = path.resolve(process.env.DOCUMENTS_PATH || path.join(process.cwd(), 'documents'));
    await fs.access(documentsPath, fsConstants.R_OK | fsConstants.W_OK);
    await fs.access(path.join(documentsPath, '.affidavit-storage'), fsConstants.R_OK);
    if (process.env.REQUIRE_PERSISTENT_STORAGE === 'true') {
      const mountInfo = await fs.readFile('/proc/self/mountinfo', 'utf8');
      const mounted = mountInfo.split('\n').some((line) => {
        const mountPoint = line.split(' ')[4]?.replace(/\\040/g, ' ');
        return mountPoint === documentsPath;
      });
      if (!mounted) throw new Error('persistent storage is not mounted');
    }
    checks.storage = 'ok';
  } catch {
    checks.storage = 'failed';
  }

  return {
    ready: Object.values(checks).every((value) => value === 'ok'),
    checkedAt: new Date().toISOString(),
    checks,
  };
}

export async function GET() {
  const now = Date.now();
  let result: ReadinessResult;
  if (cached && cached.expiresAt > now) {
    result = cached.result;
  } else {
    result = await runChecks();
    cached = { result, expiresAt: now + 10_000 };
  }
  return Response.json(result, {
    status: result.ready ? 200 : 503,
    headers: { 'cache-control': 'no-store' },
  });
}
