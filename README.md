# affidavit-maker
A affidavit generation tool

## Database Maintenance

This application logs user activity (including IP addresses) in the database. To prevent unbounded table growth, regular cleanup is required.

### Manual Cleanup

Run the cleanup script manually:
```bash
npm run db:cleanup
```

### Automated Cleanup

For production deployments, schedule the cleanup to run daily. See [DATABASE_CLEANUP.md](./DATABASE_CLEANUP.md) for detailed instructions on setting up automated cleanup using:
- Cron jobs (Linux/Unix)
- PostgreSQL pg_cron extension
- Windows Task Scheduler
- Cloud platform schedulers (AWS, GCP, Heroku, etc.)

The cleanup functions maintain:
- **Activity logs**: 90-day retention
- **Sessions**: Removes expired sessions

For more information, see the complete [Database Cleanup Documentation](./DATABASE_CLEANUP.md).
