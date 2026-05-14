export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Alias of /api/health at the path the legacy Express service exposed.
 *
 * The Render dashboard's Health Check Path setting overrides render.yaml,
 * and historically pointed at /health (Express had `app.get('/health', ...)`).
 * If the dashboard hasn't been updated post-Next.js-migration, probes still
 * hit /health and the deploy times out. This route keeps both paths alive
 * so the platform health check passes either way. Once the dashboard is
 * confirmed to point at /api/health this file can be removed.
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
