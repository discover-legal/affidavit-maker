# Understanding the Affidavit Maker Architecture

## Introduction for New Developers

This document explains the technical architecture and design decisions of the Affidavit Maker application. If you're new to web development or want to understand why we built things this way, this guide is for you!

## The Big Picture 🏗️

Think of our application like a restaurant:
- **Frontend (React)** = The dining room where customers sit
- **Backend (Node.js)** = The kitchen where food is prepared  
- **Database (PostgreSQL)** = The pantry where ingredients are stored
- **External Services** = Suppliers who provide special ingredients

```
User's Browser          Your Server              Cloud Services
┌─────────────┐        ┌─────────────┐         ┌─────────────┐
│   React     │◄──────►│   Node.js   │◄───────►│   OpenAI    │
│   Website   │        │   Express   │         │   (AI Chat) │
└─────────────┘        │   Server    │         └─────────────┘
                       │             │         ┌─────────────┐
                       │             │◄───────►│   Auth0     │
                       │             │         │   (Login)   │
                       │             │         └─────────────┘
                       │             │         ┌─────────────┐
                       │             │◄───────►│   Stripe    │
                       │             │         │  (Payments) │
                       └─────────────┘         └─────────────┘
                              ▲
                              ▼
                       ┌─────────────┐
                       │ PostgreSQL  │
                       │  Database   │
                       └─────────────┘
```

## Why These Technologies? 🤔

### Frontend: React

**What it is:** A JavaScript library for building user interfaces

**Why we chose it:**
- **Component-based**: Like LEGO blocks - build complex UIs from simple pieces
- **Popular**: Huge community, lots of tutorials and help
- **Fast**: Virtual DOM makes updates efficient
- **Reusable**: Write once, use many times

**Example in our app:**
```javascript
// Each section of our app is a component
<ChatInterface />      // The chat box
<DocumentPreview />    // The preview pane
<ValidationDisplay />  // Shows errors/warnings
```

### Backend: Node.js + Express

**What it is:** JavaScript running on the server (not in a browser)

**Why we chose it:**
- **Same language**: Frontend and backend both use JavaScript
- **Non-blocking**: Can handle many users at once
- **NPM ecosystem**: Thousands of packages available
- **Easy to deploy**: Works on any cloud provider

**Real example from our code:**
```javascript
// This handles when someone sends a chat message
app.post('/api/chat', async (req, res) => {
  const userMessage = req.body.message;
  const aiResponse = await askOpenAI(userMessage);
  res.json({ response: aiResponse });
});
```

### Database: PostgreSQL

**What it is:** A powerful, open-source relational database

**Why we chose it:**
- **ACID compliant**: Your data is safe, even if server crashes
- **Complex queries**: Can do sophisticated data analysis
- **JSON support**: Stores structured data flexibly
- **Battle-tested**: Used by companies like Apple, Instagram

**How we use it:**
```sql
-- Store user's affidavit drafts
INSERT INTO documents (user_id, content, status) 
VALUES (123, '{"name": "John", "facts": [...]}', 'draft');
```

### AI: OpenAI GPT-4

**What it is:** Advanced AI language model

**Why we chose it:**
- **Conversational**: Understands context and intent
- **Flexible**: Handles various legal document types
- **Accurate**: Extracts information reliably
- **API-based**: No need to train our own model

**How it works in our app:**
1. User types: "My name is John Doe and I live in Texas"
2. We send to OpenAI with instructions
3. AI extracts: `{name: "John Doe", state: "TX"}`
4. We update the document preview

### Authentication: Auth0

**What it is:** Service that handles user login/signup

**Why we chose it:**
- **Security**: We don't store passwords (huge responsibility!)
- **Social login**: Users can login with Google, etc.
- **MFA ready**: Two-factor authentication built-in
- **Compliance**: Handles GDPR, SOC2, etc.

**User flow:**
```
1. User clicks "Login"
2. Redirected to Auth0
3. User enters credentials
4. Auth0 sends back a token
5. We verify token on each request
```

### Payments: Stripe

**What it is:** Payment processing platform

**Why we chose it:**
- **Developer-friendly**: Excellent documentation
- **PCI compliant**: We never touch credit card numbers
- **Global**: Works in many countries
- **Webhooks**: Real-time payment notifications

## Architecture Patterns Explained 🏛️

### 1. MVC-ish Pattern

We loosely follow Model-View-Controller:
- **Model**: Database schema and data logic
- **View**: React components
- **Controller**: Express route handlers

```javascript
// Controller (handles request)
app.post('/api/save-draft', async (req, res) => {
  // Model (data operation)
  const document = await saveDocumentToDatabase(req.body);
  
  // Send to View (React will display)
  res.json({ success: true, document });
});
```

### 2. Service Layer Pattern

We separate business logic from routes:

```javascript
// ❌ Bad: Everything in route
app.post('/api/generate', async (req, res) => {
  // 100 lines of PDF generation code here
});

// ✅ Good: Logic in service
app.post('/api/generate', async (req, res) => {
  const pdf = await pdfService.generate(req.body);
  res.json({ pdf });
});
```

### 3. Middleware Pattern

Like layers of an onion, each request passes through:

```javascript
Request → CORS → Auth → Validation → Route → Response
         ↓       ↓        ↓           ↓
     Security  Check   Validate    Business
     Headers   Login    Input       Logic
```

### 4. Repository Pattern (sort of)

We abstract database operations:

```javascript
// Instead of SQL everywhere
const user = await pool.query('SELECT * FROM users...');

// We have functions
const user = await getUserFromAuth(authId);
```

## Security Architecture 🔒

### Defense in Depth

Like a castle with multiple walls:

1. **HTTPS** - Encrypted communication
2. **Authentication** - JWT tokens verify identity
3. **Authorization** - Check user owns document
4. **Validation** - Sanitize all inputs
5. **Rate Limiting** - Prevent abuse
6. **CORS** - Control which sites can call API

```javascript
// Example: Multiple security layers for one endpoint
app.post('/api/documents',
  rateLimit,        // 1. Prevent spam
  checkJwt,         // 2. Verify user logged in
  validateInput,    // 3. Check data is safe
  async (req, res) => {
    // 4. Verify user owns document
    if (doc.user_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }
);
```

## Data Flow Explained 📊

### Creating an Affidavit - Step by Step

```
1. User types in chat
   ↓
2. React sends to backend
   ↓
3. Backend asks OpenAI
   ↓
4. Extract information
   ↓
5. Save to database
   ↓
6. Update preview
   ↓
7. User reviews
   ↓
8. User pays
   ↓
9. Generate PDF
   ↓
10. User downloads
```

### State Management

**Frontend State (React):**
```javascript
// Local state in components
const [messages, setMessages] = useState([]);
const [affidavitData, setAffidavitData] = useState({});
```

**Backend State (Database):**
```sql
-- Permanent storage
documents table: drafts, completed docs
users table: account info
payments table: transaction history
```

**Session State:**
```javascript
// Temporary storage in browser
localStorage: save work if page refreshes
sessionStorage: temporary data
```

## Performance Decisions 🚀

### 1. Database Connection Pooling

Instead of creating new connection each time:
```javascript
// ❌ Slow: New connection per request
async function getUser() {
  const client = new Client();
  await client.connect();
  const result = await client.query('...');
  await client.end();
}

// ✅ Fast: Reuse connections
const pool = new Pool({ max: 20 });
async function getUser() {
  return pool.query('...');
}
```

### 2. Compression

We compress responses to save bandwidth:
```javascript
app.use(compression()); // 100KB → 20KB
```

### 3. Caching Headers

Tell browsers to cache static files:
```javascript
// CSS, JS, images cached for 1 year
app.use('/static', express.static('public', {
  maxAge: '1y'
}));
```

### 4. Lazy Loading

Load only what's needed:
```javascript
// Only load PDF library when generating PDF
if (format === 'pdf') {
  const { generatePDF } = require('./pdfService');
}
```

## Error Handling Philosophy 🚨

### Fail Gracefully

Never crash, always recover:

```javascript
try {
  // Try the main path
  const result = await riskyOperation();
} catch (error) {
  // Log for developers
  logger.error('Operation failed', error);
  
  // Friendly message for users
  res.json({
    success: false,
    error: 'Something went wrong. Please try again.'
  });
}
```

### Fallback Strategies

Always have Plan B:

```javascript
// If AI fails, still show basic preview
if (!aiResponse) {
  return generateBasicPreview(data);
}

// If email fails, still complete signup
if (!emailSent) {
  logger.warn('Welcome email failed');
  // Continue anyway
}
```

## Testing Strategy 🧪

### Test Pyramid

```
        /\
       /  \    E2E Tests (few, slow)
      /    \   - Full user journey
     /──────\  
    /        \ Integration Tests (some, medium)
   /          \- API endpoints
  /────────────\
 /              \ Unit Tests (many, fast)
/________________\- Individual functions
```

### What We Test

**Unit Tests:** Individual functions
```javascript
test('validates Texas requires county', () => {
  const result = validateData({ state: 'TX', county: null });
  expect(result.errors).toContain('County required');
});
```

**Integration Tests:** API endpoints
```javascript
test('POST /api/chat returns AI response', async () => {
  const response = await request(app)
    .post('/api/chat')
    .send({ message: 'Hello' });
  expect(response.body.success).toBe(true);
});
```

## Monitoring & Logging 📊

### Structured Logging

We log with context:
```javascript
logger.info('User action', {
  userId: 123,
  action: 'create_document',
  state: 'TX',
  duration: 1234
});
```

### Metrics We Track

1. **Performance**: Response times, slow queries
2. **Errors**: Failed requests, exceptions
3. **Business**: Documents created, payments
4. **Security**: Failed logins, suspicious activity

## Deployment Architecture 🌐

### Development → Staging → Production

```
Developer Machine       GitHub              Servers
┌─────────────┐       ┌─────────┐       ┌─────────────┐
│   Local     │──────►│  Repo    │──────►│   Staging   │
│   Testing   │       │          │       │   (Test)    │
└─────────────┘       └─────────┘       └─────────────┘
                            │                   │
                            │            ┌─────────────┐
                            └───────────►│ Production  │
                                        │   (Live)    │
                                        └─────────────┘
```

### Why PM2?

Keeps app running:
- **Auto-restart**: If crash, start again
- **Clustering**: Use all CPU cores
- **Monitoring**: Track memory, CPU
- **Zero-downtime**: Deploy without stopping

## Common Patterns You'll See 🎯

### 1. Async/Await Everywhere

Modern way to handle asynchronous code:
```javascript
// Old way (callback hell)
getUser(id, (err, user) => {
  getDocuments(user.id, (err, docs) => {
    // Nested and messy
  });
});

// New way (clean)
const user = await getUser(id);
const docs = await getDocuments(user.id);
```

### 2. Destructuring

Pull out what you need:
```javascript
// Instead of
const name = req.body.name;
const email = req.body.email;

// We do
const { name, email } = req.body;
```

### 3. Optional Chaining

Safely access nested properties:
```javascript
// Instead of
if (user && user.profile && user.profile.name) {
  
// We do
if (user?.profile?.name) {
```

### 4. Environment Variables

Never hardcode secrets:
```javascript
// ❌ Bad
const apiKey = 'sk_live_abcd1234';

// ✅ Good
const apiKey = process.env.STRIPE_SECRET_KEY;
```

## Scaling Considerations 📈

### Current Architecture Handles

- ✅ 100s of concurrent users
- ✅ 1000s of documents/day
- ✅ Multiple server instances

### Future Scaling Options

1. **Database Read Replicas**: Separate read/write
2. **Redis Cache**: Store frequent queries
3. **CDN**: Serve static files globally
4. **Queue System**: Handle PDF generation async
5. **Microservices**: Split into smaller services

## Best Practices We Follow 📚

### 1. DRY (Don't Repeat Yourself)

Write once, use everywhere:
```javascript
// Validation logic in one place
const validateAffidavit = (data) => {
  // Used by preview, save, and generate
};
```

### 2. KISS (Keep It Simple, Stupid)

Prefer simple over clever:
```javascript
// ❌ Too clever
const x = !!user && (user.active || admin) ? true : false;

// ✅ Clear
const canAccess = user && (user.active || user.isAdmin);
```

### 3. YAGNI (You Aren't Gonna Need It)

Don't build features "just in case":
- Build for 3 states, not 50
- Simple payment, not subscription engine
- Basic PDF, not Word/Excel/PowerPoint

### 4. Fail Fast

Catch errors early:
```javascript
// Check requirements at startup
if (!process.env.DATABASE_URL) {
  console.error('Missing DATABASE_URL');
  process.exit(1);
}
```

## Troubleshooting Architecture 🔧

### When Things Go Wrong

1. **Check logs first**: `logs/error.log`
2. **Verify services**: Is database up? Auth0 working?
3. **Test in isolation**: Does the function work alone?
4. **Check environment**: Right variables set?

### Common Architecture Issues

**"It works locally but not in production"**
- Check environment variables
- Check Node version
- Check database connection
- Check CORS settings

**"It's slow"**
- Check database queries (missing index?)
- Check external API calls (timeout?)
- Check payload size (sending too much?)
- Check connection pooling

## Learning Resources 📖

To understand our architecture better:

**JavaScript/Node.js:**
- [MDN JavaScript Guide](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide)
- [Node.js Tutorial](https://nodejs.dev/learn)

**React:**
- [React Official Tutorial](https://react.dev/learn)
- [React Hooks Explained](https://react.dev/learn/state-a-components-memory)

**PostgreSQL:**
- [PostgreSQL Tutorial](https://www.postgresqltutorial.com/)
- [SQL Basics](https://www.w3schools.com/sql/)

**Express:**
- [Express Guide](https://expressjs.com/en/guide/routing.html)
- [RESTful API Design](https://restfulapi.net/)

**Security:**
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [JWT Introduction](https://jwt.io/introduction)

## Architecture Decisions Record (ADR) 📝

### Why Not Other Options?

**Why not MongoDB?**
- Need complex queries (SQL better)
- Need transactions (ACID compliance)
- Relational data (users → documents)

**Why not Vue/Angular?**
- React has larger community
- More developers know React
- Better job market for team

**Why not Python/Django?**
- Team knows JavaScript
- One language for full stack
- Easier deployment

**Why not AWS Lambda?**
- More complex for this use case
- Need persistent connections
- Simpler deployment with VPS

## Summary 🎉

Our architecture prioritizes:
1. **Developer Experience**: Easy to understand and modify
2. **User Experience**: Fast, reliable, secure
3. **Business Needs**: Cost-effective, scalable
4. **Maintainability**: Well-documented, tested

Remember: Architecture is about trade-offs. We chose simplicity and reliability over complexity and features. As you work with the codebase, always ask "Is this the simplest solution that could work?"

Happy coding! 🚀