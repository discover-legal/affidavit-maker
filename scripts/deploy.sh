#!/bin/bash
# scripts/deploy.sh

echo "🚀 Starting deployment..."

# Environment check
if [ "$NODE_ENV" != "production" ]; then
    echo "⚠️  Warning: NODE_ENV is not set to production"
    exit 1
fi

# Build client
echo "📦 Building client..."
cd client
npm run build
cd ..

# Run tests
echo "🧪 Running tests..."
npm test -- --ci --coverage --maxWorkers=2

if [ $? -ne 0 ]; then
    echo "❌ Tests failed. Aborting deployment."
    exit 1
fi

# Database backup
echo "💾 Backing up database..."
pg_dump $DATABASE_URL > backups/backup-$(date +%Y%m%d-%H%M%S).sql

# Run migrations
echo "🔄 Running database migrations..."
node scripts/migrate.js

# Clean old logs
echo "🧹 Cleaning old logs..."
node scripts/cleanLogs.js

# Clean old PDFs
echo "📄 Cleaning old PDFs..."
node scripts/cleanPdfs.js

# Restart services
echo "♻️  Restarting services..."
pm2 restart affidavit-app

echo "✅ Deployment complete!"