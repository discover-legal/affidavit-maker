export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Liveness probe. Render's external health check hits this path
 * (render.yaml: healthCheckPath: /api/health).
 *
 * Intentionally minimal: no DB query, no service imports. Liveness should
 * answer "is the process responsive?" — not "is the whole stack green?"
 * A degraded DB must not kill the container, and the probe must not block
 * on a 10s pg connect timeout. For deep-state checks add a separate /api/ready.
 */
export async function GET() {
  return new Response(
    JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }),
    {
      status: 200,
      headers: {
        'content-type': 'application/json',
        'cache-control': 'no-store',
      },
    },
  );
}
