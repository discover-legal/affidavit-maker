import { NextResponse } from 'next/server';
import { pool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  let dbOk = false;
  try {
    await pool.query('SELECT 1');
    dbOk = true;
  } catch (err) {
    console.error('[health] db check failed', err);
  }

  return NextResponse.json(
    {
      success: true,
      status: dbOk ? 'ok' : 'degraded',
      database: dbOk ? 'connected' : 'unreachable',
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}
