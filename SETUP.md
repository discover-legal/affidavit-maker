# Affidavit Maker - Setup and Deployment Guide

## Table of Contents
- [Development Setup](#development-setup)
- [Testing](#testing)
- [Production Deployment](#production-deployment)
- [Monitoring](#monitoring)
- [Troubleshooting](#troubleshooting)

## Development Setup

### Prerequisites
- Node.js >= 16.0.0
- PostgreSQL >= 13
- Redis (optional, for session management)
- Git

### Initial Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/your-username/affidavit-maker.git
   cd affidavit-maker
   ```

2. **Install dependencies**
   ```bash
   # Backend dependencies
   npm install
   
   # Frontend dependencies
   cd client
   npm install
   cd ..
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your actual values
   ```

4. **Set up the database**
   ```bash
   # Create database
   createdb affidavit_db
   
   # Run schema
   psql -U your_user -d affidavit_db -f database-schema.sql
   
   # Create test database
   createdb affidavit_test
   psql -U your_user -d affidavit_test -f database-schema.sql
   ```

5. **Configure Auth0**
   - Create an Auth0 application
   - Set allowed callback URLs: `http://localhost:3000`
   - Set allowed logout URLs: `http://localhost:3000`
   - Copy credentials to `.env`

6. **Configure Stripe**
   - Get test API keys from Stripe dashboard
   - Set up webhook endpoint: `http://localhost:3001/api/webhooks/stripe`
   - Copy webhook secret to `.env`

### Running the Application

```bash
# Start backend
npm run dev

# In another terminal, start frontend
npm run client

# Or run both together
npm run dev & npm run client
```

## Testing

### Running Tests

```bash
# Run all tests with coverage
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e
```

### Test Coverage Requirements
- Minimum 70% coverage for all metrics
- Critical paths must have 90%+ coverage

### Manual Testing Checklist

#### Authentication Flow
- [ ] Can register new account via Auth0
- [ ] Can login with existing account
- [ ] Session persists on page refresh
- [ ] Logout works correctly

#### Document Creation
- [ ] Can select all supported states (TX, UT, AZ)
- [ ] Chat interface responds appropriately
- [ ] Facts are extracted correctly from conversation
- [ ] Preview updates in real-time
- [ ] Validation errors display correctly

#### Document Management
- [ ] Can save drafts
- [ ] Can resume previous sessions
- [ ] Documents list displays correctly
- [ ] Can continue working on drafts

#### Payment Flow
- [ ] Payment modal appears for completed documents
- [ ] Stripe checkout works with test cards
- [ ] Successful payment enables download
- [ ] Payment records are saved

#### PDF Generation
- [ ] Generated PDFs are properly formatted
- [ ] State-specific requirements are met
- [ ] Notary blocks are included
- [ ] PDFs are downloadable

## Production Deployment

### Server Requirements
- Ubuntu 20.04 LTS or newer
- 2+ CPU cores
- 4GB+ RAM
- 20GB+ SSD storage
- SSL certificate (Let's Encrypt recommended)

### Deployment Steps

1. **Server Setup**
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y
   
   # Install dependencies
   sudo apt install -y nodejs npm postgresql nginx certbot python3-certbot-nginx
   
   # Install PM2 globally
   sudo npm install -g pm2
   ```

2. **Clone and Configure**
   ```bash
   # Clone repository
   cd /var/www
   sudo git clone https://github.com/your-username/affidavit-maker.git
   cd affidavit-maker
   
   # Install dependencies
   npm install --production
   cd client && npm install && npm run build
   
   # Set up environment
   sudo cp .env.example .env
   sudo nano .env  # Add production values
   ```

3. **Database Setup**
   ```bash
   # Create production database
   sudo -u postgres createdb affidavit_production
   
   # Run schema
   sudo -u postgres psql -d affidavit_production -f database-schema.sql
   
   # Run migrations
   NODE_ENV=production node scripts/migrate.js
   
   # Set up automated database cleanup (IMPORTANT)
   # Add to crontab to prevent activity_logs table from growing too large
   sudo crontab -e
   # Add this line:
   # 0 2 * * * cd /var/www/affidavit-maker && npm run db:cleanup >> /var/log/affidavit-cleanup.log 2>&1
   ```
   
   > **Note**: The activity_logs table stores IP addresses and can grow large over time. 
   > See [DATABASE_CLEANUP.md](./DATABASE_CLEANUP.md) for detailed cleanup configuration options.

4. **Configure Nginx**
   ```bash
   # Copy nginx config
   sudo cp nginx.conf /etc/nginx/sites-available/affidavit-maker
   sudo ln -s /etc/nginx/sites-available/affidavit-maker /etc/nginx/sites-enabled/
   
   # Get SSL certificate
   sudo certbot --nginx -d your-domain.com
   
   # Restart nginx
   sudo nginx -t && sudo systemctl restart nginx
   ```

5. **Start Application with PM2**
   ```bash
   # Start app
   pm2 start ecosystem.config.js --env production
   
   # Save PM2 config
   pm2 save
   pm2 startup
   ```

### Environment Variables for Production

```bash
NODE_ENV=production
PORT=3001

# Use connection pooling for production
DATABASE_URL=postgresql://user:pass@localhost:5432/affidavit_production?pool=25

# Auth0 Production
AUTH0_DOMAIN=https://your-prod-tenant.auth0.com
AUTH0_CLIENT_ID=prod_client_id
AUTH0_CLIENT_SECRET=prod_client_secret
AUTH0_AUDIENCE=https://api.your-domain.com

# Stripe Production
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_live_...

# Production URLs
FRONTEND_URL=https://your-domain.com
```

## Monitoring

### Application Monitoring

1. **PM2 Monitoring**
   ```bash
   # View application status
   pm2 status
   
   # View logs
   pm2 logs affidavit-app
   
   # Monitor resources
   pm2 monit
   ```

2. **Custom Analytics Dashboard**
   - Access at: `https://your-domain.com/api/analytics` (requires admin account)
   - Shows real-time metrics, error rates, and usage statistics

3. **Log Analysis**
   ```bash
   # View recent errors
   tail -f logs/error.log | grep ERROR
   
   # Analyze slow queries
   grep "Slow request" logs/combined.log | tail -20
   
   # Check AI usage
   grep "ai_interaction" logs/combined.log | wc -l
   ```

### Database Monitoring

```sql
-- Check slow queries
SELECT query, mean_exec_time, calls 
FROM pg_stat_statements 
ORDER BY mean_exec_time DESC 
LIMIT 10;

-- Monitor connections
SELECT count(*) FROM pg_stat_activity;

-- Check table sizes (monitor activity_logs growth)
SELECT relname, pg_size_pretty(pg_total_relation_size(relid))
FROM pg_stat_user_tables
ORDER BY pg_total_relation_size(relid) DESC;

-- Check oldest activity log entry (should be ~90 days old if cleanup is working)
SELECT MIN(created_at) as oldest_log, 
       MAX(created_at) as newest_log,
       COUNT(*) as total_logs 
FROM activity_logs;
```

**Important**: Monitor the `activity_logs` table size regularly. If it grows beyond expected 
levels, verify that the automated cleanup is running correctly. See [DATABASE_CLEANUP.md](./DATABASE_CLEANUP.md).

### Health Checks

Set up external monitoring (e.g., UptimeRobot) to check:
- `https://your-domain.com/health` - Should return 200 OK
- `https://your-domain.com/api/health` - Detailed health status

## Troubleshooting

### Common Issues

#### Application Won't Start
```bash
# Check logs
pm2 logs --lines 50

# Verify environment variables
node -e "console.log(process.env.DATABASE_URL)"

# Test database connection
psql $DATABASE_URL -c "SELECT 1"
```

#### PDF Generation Fails
```bash
# Install Puppeteer dependencies
sudo apt-get install -y libx11-xcb1 libxcomposite1 libxdamage1 libxi6 libxtst6 libnss3 libcups2 libxss1 libxrandr2 libasound2 libpangocairo-1.0-0 libatk1.0-0 libcairo-gobject2 libgtk-3-0

# Check disk space
df -h
```

#### High Memory Usage
```bash
# Check memory usage
pm2 monit

# Restart with memory limit
pm2 delete affidavit-app
pm2 start ecosystem.config.js --max-memory-restart 1G
```

#### Database Connection Errors
```sql
-- Check connection limit
SHOW max_connections;

-- See current connections
SELECT count(*) FROM pg_stat_activity;

-- Kill idle connections
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE state = 'idle' 
AND state_change < NOW() - INTERVAL '1 hour';
```

### Performance Optimization

1. **Enable Redis for sessions** (optional)
   ```bash
   npm install connect-redis redis
   ```

2. **CDN for static assets**
   - Use CloudFlare or similar for client build files
   - Cache static assets for 1 year

3. **Database indexes**
   ```sql
   -- Add missing indexes based on slow query log
   CREATE INDEX CONCURRENTLY idx_documents_user_created 
   ON documents(user_id, created_at DESC);
   ```

### Backup and Recovery

1. **Automated backups**
   ```bash
   # Add to crontab
   0 2 * * * pg_dump $DATABASE_URL | gzip > /backups/db-$(date +\%Y\%m\%d).sql.gz
   ```

2. **Restore from backup**
   ```bash
   gunzip < /backups/db-20240115.sql.gz | psql $DATABASE_URL
   ```

### Security Checklist

- [ ] All environment variables are set correctly
- [ ] SSL certificate is valid and auto-renews
- [ ] Firewall configured (only ports 80, 443, 22 open)
- [ ] Database is not accessible from internet
- [ ] Regular security updates applied
- [ ] Rate limiting is working
- [ ] CORS is properly configured
- [ ] File upload size limits enforced

## Support

For issues or questions:
1. Check the logs first
2. Review this documentation
3. Search existing GitHub issues
4. Create a new issue with:
   - Error messages
   - Steps to reproduce
   - Environment details