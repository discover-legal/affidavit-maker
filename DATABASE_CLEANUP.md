# Database Cleanup Documentation

## Overview

The Affidavit Maker application stores activity logs (including IP addresses and user agents) and session data in the database. To prevent unbounded table growth and potential performance issues, regular cleanup is essential.

## Problem

The `activity_logs` table stores:
- User actions (login, create_document, generate_pdf, etc.)
- IP addresses
- User agents
- Request metadata

Without regular cleanup, this table can grow very large over time, leading to:
- Increased database size
- Slower query performance
- Higher storage costs
- Potential privacy concerns with old data

## Solution

The database schema includes cleanup functions that:
1. **cleanup_old_activity_logs()** - Deletes activity logs older than 90 days
2. **cleanup_expired_sessions()** - Removes expired session data

## Manual Cleanup

You can run cleanup manually at any time:

```bash
npm run db:cleanup
```

This will execute both cleanup functions and report how many records were deleted.

## Automated Cleanup (Recommended)

### Option 1: Cron Job (Linux/Unix)

Add to your crontab to run daily at 2 AM:

```bash
# Edit crontab
crontab -e

# Add this line (adjust path to your installation)
0 2 * * * cd /var/www/affidavit-maker && npm run db:cleanup >> /var/log/affidavit-cleanup.log 2>&1
```

### Option 2: PostgreSQL pg_cron Extension

If you have the `pg_cron` extension installed:

```sql
-- Enable the extension (requires superuser)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule cleanup to run daily at 2 AM
SELECT cron.schedule(
  'cleanup-activity-logs',
  '0 2 * * *',
  'SELECT cleanup_old_activity_logs(); SELECT cleanup_expired_sessions();'
);

-- View scheduled jobs
SELECT * FROM cron.job;

-- Unschedule if needed
SELECT cron.unschedule('cleanup-activity-logs');
```

### Option 3: Windows Task Scheduler

1. Open Task Scheduler
2. Create Basic Task
3. Trigger: Daily at 2:00 AM
4. Action: Start a program
   - Program: `C:\Program Files\nodejs\node.exe`
   - Arguments: `scripts/cleanDatabase.js`
   - Start in: `C:\path\to\affidavit-maker`

### Option 4: Cloud Platform Schedulers

#### AWS CloudWatch Events / EventBridge

```yaml
# CloudFormation/SAM template
CleanupSchedule:
  Type: AWS::Events::Rule
  Properties:
    ScheduleExpression: 'cron(0 2 * * ? *)'
    Targets:
      - Arn: !GetAtt CleanupFunction.Arn
        Id: CleanupTarget
```

#### Google Cloud Scheduler

```bash
gcloud scheduler jobs create http cleanup-db \
  --schedule="0 2 * * *" \
  --uri="https://your-app.com/api/admin/cleanup" \
  --http-method=POST \
  --oidc-service-account-email=scheduler@project.iam.gserviceaccount.com
```

#### Heroku Scheduler

Add to your Heroku app:
```bash
heroku addons:create scheduler:standard
heroku addons:open scheduler
```
Then add: `npm run db:cleanup` to run daily at 2:00 AM

## Monitoring

Check the cleanup results:

```bash
# View the cleanup log (if using cron)
tail -f /var/log/affidavit-cleanup.log

# Check table sizes in PostgreSQL
psql -d affidavit_db -c "
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE tablename IN ('activity_logs', 'sessions')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
"

# Check oldest activity log
psql -d affidavit_db -c "
SELECT MIN(created_at) as oldest_log, 
       MAX(created_at) as newest_log,
       COUNT(*) as total_logs 
FROM activity_logs;
"
```

## Customizing Retention Period

The default retention period is 90 days. To modify:

1. Edit the function in your database:

```sql
-- Keep last 30 days instead of 90
CREATE OR REPLACE FUNCTION cleanup_old_activity_logs()
RETURNS INTEGER AS $
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM activity_logs 
    WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$ LANGUAGE plpgsql;
```

2. Update the schema files to reflect the change

## Best Practices

1. **Run regularly**: Daily cleanup prevents large batch deletions that could impact performance
2. **Monitor**: Track deleted record counts to identify unusual patterns
3. **Backup first**: Before changing retention policies, ensure you have backups
4. **Test in staging**: Test cleanup in a staging environment before production
5. **Consider archiving**: For compliance, consider archiving old logs to cold storage instead of deleting

## Troubleshooting

### Cleanup script fails to connect to database

- Check database credentials in `.env` or environment variables
- Ensure the database server is accessible
- Verify the `config/index.js` database configuration

### Permission denied errors

- Ensure the database user has DELETE permissions on `activity_logs` and `sessions` tables
- Ensure the database user can execute the cleanup functions

### Large deletions taking too long

If you have years of accumulated data, consider:

```sql
-- Delete in batches
DO $$
DECLARE
    batch_size INTEGER := 10000;
    deleted INTEGER;
BEGIN
    LOOP
        DELETE FROM activity_logs
        WHERE id IN (
            SELECT id FROM activity_logs
            WHERE created_at < CURRENT_TIMESTAMP - INTERVAL '90 days'
            LIMIT batch_size
        );
        GET DIAGNOSTICS deleted = ROW_COUNT;
        EXIT WHEN deleted = 0;
        RAISE NOTICE 'Deleted % rows', deleted;
        COMMIT;
    END LOOP;
END $$;
```

## Related Files

- `/scripts/cleanDatabase.js` - Cleanup script
- `/database_schema_complete.sql` - Database schema with cleanup functions
- `/package.json` - Contains `db:cleanup` npm script

## Privacy Considerations

The activity_logs table stores IP addresses. Depending on your jurisdiction (e.g., GDPR in EU, CCPA in California), you may need to:

1. Inform users that you're collecting and storing IP addresses
2. Provide a mechanism for users to request deletion of their data
3. Consider shorter retention periods for IP addresses (e.g., 30 days instead of 90)

Always consult with legal counsel regarding data retention policies.
