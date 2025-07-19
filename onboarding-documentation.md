# Affidavit Maker - Developer Onboarding Guide

## Welcome to the Team! 👋

This guide will help you get up and running with the Affidavit Maker codebase. We'll cover everything from initial setup to making your first contribution.

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture Overview](#architecture-overview)
3. [Development Setup](#development-setup)
4. [Codebase Structure](#codebase-structure)
5. [Key Technologies](#key-technologies)
6. [Development Workflow](#development-workflow)
7. [Common Tasks](#common-tasks)
8. [Testing Guidelines](#testing-guidelines)
9. [Debugging Tips](#debugging-tips)
10. [Contributing Guidelines](#contributing-guidelines)

## Project Overview

**Affidavit Maker** is a SaaS application that helps users create legally-compliant affidavits for Texas, Utah, and Arizona. The application features:

- 🤖 AI-powered chat interface for gathering information
- 📄 State-specific legal document templates
- 💳 Stripe payment integration
- 🔐 Auth0 authentication
- 📊 Real-time document preview
- 📑 PDF generation with proper legal formatting

### Business Model
- **Free**: Users can create and preview affidavits
- **Paid ($9.99)**: Users can download the final PDF
- **Future**: Subscription plans for law firms and frequent users

## Architecture Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│  React Frontend │────▶│  Express API    │────▶│  PostgreSQL DB  │
│   (Port 3000)   │     │   (Port 3001)   │     │                 │
│                 │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │                        
         │                       ├──────▶ OpenAI API
         │                       ├──────▶ Stripe API
         └──────────────────────▶──────▶ Auth0

```

### Tech Stack Details

**Frontend:**
- React 18 with Hooks
- Tailwind CSS for styling
- Lucide React for icons
- Auth0 React SDK

**Backend:**
- Node.js with Express
- PostgreSQL database
- OpenAI GPT-4 for AI chat
- PDFKit/Puppeteer for PDF generation
- Winston for logging
- Jest for testing

**Infrastructure:**
- PM2 for process management
- Nginx for reverse proxy
- Let's Encrypt for SSL

## Development Setup

### Prerequisites

1. **Required Software:**
   - Node.js >= 16.0.0
   - PostgreSQL >= 13
   - Git
   - VS Code (recommended)

2. **Accounts Needed:**
   - GitHub access to repository
   - Auth0 developer account
   - OpenAI API access
   - Stripe test account

### Step-by-Step Setup

1. **Clone the Repository**
   ```bash
   git clone https://github.com/your-org/affidavit-maker.git
   cd affidavit-maker
   ```

2. **Install Dependencies**
   ```bash
   # Backend dependencies
   npm install
   
   # Frontend dependencies
   cd client
   npm install
   cd ..
   ```

3. **Database Setup**
   ```bash
   # Create development database
   createdb affidavit_dev
   
   # Run schema
   psql -U postgres -d affidavit_dev -f database-schema.sql
   
   # Create test database
   createdb affidavit_test
   psql -U postgres -d affidavit_test -f database-schema.sql
   ```

4. **Environment Configuration**
   ```bash
   # Copy example env file
   cp .env.example .env
   ```
   
   Edit `.env` with your credentials:
   ```env
   # Critical variables that MUST be set:
   DATABASE_URL=postgresql://postgres:password@localhost:5432/affidavit_dev
   OPENAI_API_KEY=sk-your-key-here
   AUTH0_DOMAIN=https://your-tenant.auth0.com
   AUTH0_CLIENT_ID=your-client-id
   AUTH0_CLIENT_SECRET=your-secret
   AUTH0_AUDIENCE=https://your-api-identifier
   STRIPE_SECRET_KEY=sk_test_your-key
   ```

5. **Auth0 Configuration**
   - Log into Auth0 Dashboard
   - Create new Single Page Application
   - Set Allowed Callback URLs: `http://localhost:3000`
   - Set Allowed Logout URLs: `http://localhost:3000`
   - Enable "Refresh Token Rotation"
   - Copy credentials to `.env`

6. **Run the Application**
   ```bash
   # Terminal 1 - Backend
   npm run dev
   
   # Terminal 2 - Frontend
   npm run client
   ```

7. **Verify Setup**
   - Backend health check: http://localhost:3001/health
   - Frontend: http://localhost:3000
   - Try creating a test affidavit

## Codebase Structure

```
affidavit-maker/
├── server.js              # Main backend entry point
├── affidavitService.js    # Core business logic
├── services/              # Service layer
│   ├── logger.js          # Logging service
│   ├── pdfService.js      # PDF generation
│   └── monitoringService.js # Analytics
├── middleware/            # Express middleware
│   ├── auth0Middleware.js # JWT verification
│   ├── loggingMiddleware.js # Request logging
│   └── securityMiddleware.js # Security features
├── templates/             # State-specific templates
│   └── StateTemplateManager.js # Template engine
├── __tests__/             # Test files
├── client/                # React frontend
│   └── src/
│       ├── App.js         # Main React component
│       └── components/    # React components
└── database-schema.sql    # Database structure
```

### Key Files Explained

**`server.js`** - Express server setup, routes, middleware configuration
**`affidavitService.js`** - Handles AI chat, document generation, validation
**`StateTemplateManager.js`** - State-specific legal requirements and formatting
**`App.js`** - Main React app with routing and state management

## Key Technologies

### OpenAI Integration
We use GPT-4 for intelligent conversation flow:
```javascript
// Example from affidavitService.js
const completion = await this.openai.chat.completions.create({
  model: "gpt-4",
  messages: conversationHistory,
  temperature: 0.7,
  max_tokens: 1000
});
```

### State Templates
Each state has specific legal requirements:
```javascript
// Texas requires county information
// Utah has different notary format
// Arizona doesn't require venue section
```

### Database Schema
Key tables:
- `users` - User accounts linked to Auth0
- `documents` - Saved affidavits and drafts
- `payments` - Payment records
- `activity_logs` - User activity tracking

## Development Workflow

### 1. Feature Development

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes
# Write tests
# Run tests
npm test

# Commit with conventional commits
git commit -m "feat: add new feature"
git push origin feature/your-feature-name
```

### 2. Code Style

We use ESLint and Prettier:
```bash
# Check linting
npm run lint

# Auto-fix issues
npm run lint:fix

# Format code
npm run format
```

### 3. Commit Messages

Follow conventional commits:
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation
- `style:` Code style
- `refactor:` Code refactoring
- `test:` Testing
- `chore:` Maintenance

## Common Tasks

### Adding a New State Template

1. Create new template class in `templates/StateTemplateManager.js`:
```javascript
class CaliforniaTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();
    this.state = 'CA';
    this.stateName = 'California';
    // Add CA-specific requirements
  }
}
```

2. Register in StateTemplateManager:
```javascript
this.templates = {
  'TX': new TexasTemplate(),
  'UT': new UtahTemplate(),
  'AZ': new ArizonaTemplate(),
  'CA': new CaliforniaTemplate() // New!
};
```

3. Update frontend state selector

### Modifying AI Prompts

Edit in `server.js` chat endpoint:
```javascript
const systemPrompt = `You are a legal assistant...
// Modify prompt here
`;
```

### Adding New Document Types

1. Update `getSupportedDocumentTypes()` in StateTemplateManager
2. Add type-specific facts generation
3. Update frontend UI options

### Database Migrations

```bash
# Create migration file
node scripts/migrate.js

# Add new migration in migrate.js:
{
  name: 'add_new_column',
  query: `ALTER TABLE documents ADD COLUMN new_field VARCHAR(255);`
}
```

## Testing Guidelines

### Running Tests

```bash
# All tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm test -- --coverage

# Specific file
npm test StateTemplateManager.test.js
```

### Writing Tests

```javascript
// Example test structure
describe('Feature Name', () => {
  beforeEach(() => {
    // Setup
  });

  it('should do something', async () => {
    // Arrange
    const input = { /* test data */ };
    
    // Act
    const result = await functionToTest(input);
    
    // Assert
    expect(result).toBe(expected);
  });
});
```

### Test Categories

1. **Unit Tests** - Individual functions
2. **Integration Tests** - API endpoints
3. **E2E Tests** - Full user flows

## Debugging Tips

### 1. Check Logs

```bash
# Application logs
tail -f logs/combined.log

# Error logs only
tail -f logs/error.log

# Database queries
grep "database" logs/combined.log
```

### 2. Common Issues

**"JWT verification failed"**
- Check Auth0 credentials in .env
- Verify token expiration
- Check audience configuration

**"OpenAI rate limit"**
- Check API key validity
- Monitor usage in OpenAI dashboard
- Implement retry logic

**"PDF generation failed"**
- Install Puppeteer dependencies
- Check disk space
- Verify template data

### 3. Debugging Tools

- VS Code debugger configuration included
- Chrome DevTools for frontend
- Postman collection for API testing
- pgAdmin for database inspection

## API Endpoints Reference

### Public Endpoints
- `GET /health` - Health check
- `GET /api/templates/states` - Get supported states
- `POST /api/preview` - Generate preview (optional auth)

### Protected Endpoints (require auth)
- `POST /api/chat` - AI chat interaction
- `POST /api/save-draft` - Save document draft
- `GET /api/documents` - Get user's documents
- `POST /api/generate-affidavit` - Generate final document
- `GET /api/download/:id` - Download PDF

### Payment Endpoints
- `POST /api/payment/create-intent` - Create Stripe payment
- `POST /api/payment/confirm` - Confirm payment

## Environment Variables

### Required Variables
- `DATABASE_URL` - PostgreSQL connection string
- `OPENAI_API_KEY` - OpenAI API key
- `AUTH0_*` - Auth0 configuration
- `STRIPE_SECRET_KEY` - Stripe API key

### Optional Variables
- `SMTP_*` - Email configuration
- `LOG_LEVEL` - Logging verbosity
- `NODE_ENV` - Environment (development/production)

## Deployment Notes

### Staging Deployment
1. Merge to `staging` branch
2. Automatic deployment via GitHub Actions
3. Test at staging.affidavit-maker.com

### Production Deployment
1. Create PR from `staging` to `main`
2. Require code review approval
3. Run full test suite
4. Deploy with PM2

## Getting Help

### Resources
- Technical documentation in `/docs`
- API documentation: `/docs/api.md`
- Architecture decisions: `/docs/architecture.md`

### Team Contacts
- **Tech Lead**: [Email/Slack]
- **Product Manager**: [Email/Slack]
- **DevOps**: [Email/Slack]

### Useful Links
- [Auth0 Documentation](https://auth0.com/docs)
- [Stripe Testing Guide](https://stripe.com/docs/testing)
- [OpenAI API Reference](https://platform.openai.com/docs)
- [React Documentation](https://react.dev)

## Contributing Guidelines

1. **Code Review Process**
   - All code must be reviewed
   - Minimum 1 approval required
   - Tests must pass
   - No decrease in coverage

2. **Performance Considerations**
   - Monitor response times
   - Optimize database queries
   - Cache when appropriate
   - Profile before optimizing

3. **Security Best Practices**
   - Never commit secrets
   - Validate all inputs
   - Use parameterized queries
   - Keep dependencies updated

## Quick Start Checklist

- [ ] Repository cloned
- [ ] Dependencies installed
- [ ] Database created and migrated
- [ ] Environment variables configured
- [ ] Auth0 application created
- [ ] Application runs locally
- [ ] Can create test affidavit
- [ ] Tests pass

Welcome aboard! 🚀 Feel free to ask questions in Slack channel #affidavit-dev