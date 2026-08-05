# Production operations

This service is designed to fail closed when its database trust, payment mode,
or persistent document disk is misconfigured. A green `/api/ready` response
means configuration, PostgreSQL, and the mounted document store passed their
checks. `/api/health` is liveness only.

## Launch gate

1. Protect `main`: require the `CI / verify` check, at least one review, and
   disallow force pushes and branch deletion.
2. Validate `render.yaml` with `render blueprints validate render.yaml`.
3. Configure every `sync: false` value in Render. Production Stripe values must
   be `sk_live_…` and `pk_live_…`; staging values must be `sk_test_…` and
   `pk_test_…`. Use separate Auth0 and Stripe webhook endpoints for staging.
4. Set `DATABASE_CA_CERT` to the database provider's current trusted CA PEM,
   including the BEGIN/END lines. Escaped `\n` values are accepted.
5. Confirm the Render disk is mounted exactly at `/app/documents`. The container
   refuses to start when `REQUIRE_PERSISTENT_STORAGE=true` and that path is not
   a mount point.
6. Connect Render's structured logs and metrics to the chosen external
   monitoring/APM provider, and configure a dead-man-switch through
   `CLEANUP_HEARTBEAT_URL`. Trigger and acknowledge one test alert from each
   integration before launch. No provider-specific DSN is bundled or claimed
   active by this repository.
7. Exercise the complete staging journey: sign in, create/save a document,
   upload and retrieve evidence, complete a Stripe test payment, receive its
   webhook, and download both output formats.

## Database migrations

Render runs `node scripts/migrate.js` before deployment. The runner takes a
PostgreSQL advisory lock, verifies checksums of previously applied migrations,
and commits each migration and ledger row together. Never edit an applied SQL
file. Add a new numbered migration instead.

If migration fails, Render must not promote the release. Diagnose the SQL and
ship a forward-only corrective migration; do not manually mark it as applied.

## Backups and restoration

Render Postgres and persistent disks provide managed snapshots. Before launch:

- verify the database plan's retention and point-in-time recovery settings in
  the Render dashboard;
- record the named owner who reviews backup status weekly;
- perform and time a restore into an isolated staging database;
- restore a disk snapshot to an isolated service and verify evidence checksums;
- document the measured recovery time and recovery point in the incident log.

Snapshots are not a tested backup until a restore has succeeded. Repeat the
restore drill quarterly and after changing providers or storage architecture.
Never restore production over the live database as a drill.

## Monitoring and alerts

Monitor externally:

- `GET /api/ready` every minute, alert after two consecutive failures;
- p95 latency, 5xx rate, process memory, database connections/storage, disk
  utilization, Stripe webhook failures, and cron-job failures;
- expiration dates for database CAs and webhook secrets.

Suggested initial alerts are 5xx above 2% for five minutes, p95 above 3 seconds
for ten minutes, disk above 75%, database storage above 70%, or no successful
cleanup heartbeat for 26 hours. Tune these from observed traffic.

The cleanup cron runs daily and removes expired sessions and activity logs past
their database retention window. Its monitor URL is secret because calling it
can forge a success signal.

## Incident and rollback

1. Enable Render maintenance mode if writes or payments could be unsafe.
2. Preserve logs and relevant Stripe event IDs; do not copy secrets into tickets.
3. Roll application code back through Render. Database migrations are
   forward-only, so deploy a corrective migration when schema state changed.
4. Reconcile every Stripe event received during the incident against the local
   payment ledger before disabling maintenance mode.
5. Verify `/api/ready`, then run the staging smoke journey against the candidate
   fix before restoring public traffic.

Rotate credentials immediately after suspected disclosure. Auth0, Stripe,
OpenAI, database, monitoring, and webhook credentials should have named owners
and a documented rotation cadence.
