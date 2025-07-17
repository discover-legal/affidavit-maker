// config/index.js - Fixed configuration with proper Auth0 handling
require('dotenv').config();

// Validation helper
const requireEnv = (name, defaultValue = null) => {
  const value = process.env[name] || defaultValue;
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}. Please check your .env file.`);
  }
  return value;
};

// Optional env helper
const optionalEnv = (name, defaultValue = null) => {
  return process.env[name] || defaultValue;
};

// Validate required environment variables
const requiredEnvVars = ['DATABASE_URL', 'OPENAI_API_KEY', 'AUTH0_DOMAIN', 'AUTH0_AUDIENCE', 'STRIPE_SECRET_KEY'];

for (const varName of requiredEnvVars) {
  if (!process.env[varName]) {
    console.error(`❌ Missing required environment variable: ${varName}`);
    console.error('Please ensure all required variables are set in your .env file');
    process.exit(1);
  }
}

// Process Auth0 domain consistently
const processAuth0Domain = (domain) => {
  if (!domain) return null;
  
  // Remove any protocol if present
  domain = domain.replace(/^https?:\/\//, '');
  
  // Remove any trailing slash
  domain = domain.replace(/\/$/, '');
  
  // Add https:// protocol
  return `https://${domain}`;
};

const auth0Domain = processAuth0Domain(process.env.AUTH0_DOMAIN);
const auth0Issuer = `${auth0Domain}/`;

// Log configuration (without sensitive data)
console.log('🔧 Configuration loaded:');
console.log(`  - Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`  - Port: ${process.env.PORT || 3001}`);
console.log(`  - Auth0 Domain: ${auth0Domain}`);
console.log(`  - Auth0 Issuer: ${auth0Issuer}`);
console.log(`  - Database: ${process.env.DATABASE_URL ? '✓ Configured' : '✗ Missing'}`);
console.log(`  - OpenAI: ${process.env.OPENAI_API_KEY ? '✓ Configured' : '✗ Missing'}`);
console.log(`  - Stripe: ${process.env.STRIPE_SECRET_KEY ? '✓ Configured' : '✗ Missing'}`);

module.exports = {
  // Server configuration
  nodeEnv: optionalEnv('NODE_ENV', 'development'),
  port: parseInt(optionalEnv('PORT', '3001'), 10),
  logLevel: optionalEnv('LOG_LEVEL', 'info'),
  
  // Database configuration
  databaseUrl: requireEnv('DATABASE_URL'),
  databasePoolMax: parseInt(optionalEnv('DATABASE_POOL_MAX', '20'), 10),
  
  // OpenAI configuration
  openaiApiKey: requireEnv('OPENAI_API_KEY'),
  openaiModel: optionalEnv('OPENAI_MODEL', 'gpt-4-turbo'),
  openaiMaxTokens: parseInt(optionalEnv('OPENAI_MAX_TOKENS', '2000'), 10),
  openaiTemperature: parseFloat(optionalEnv('OPENAI_TEMPERATURE', '0.3')),
  
  // Stripe configuration
  stripeSecretKey: requireEnv('STRIPE_SECRET_KEY'),
  stripeWebhookSecret: optionalEnv('STRIPE_WEBHOOK_SECRET'),
  stripeApiVersion: '2023-10-16',
  
  // Frontend configuration
  frontendUrl: optionalEnv('FRONTEND_URL', 'http://localhost:3000'),
  
  // Auth0 configuration (properly formatted)
  auth0: {
    domain: auth0Domain,
    audience: requireEnv('AUTH0_AUDIENCE'),
    clientId: requireEnv('AUTH0_CLIENT_ID'),
    clientSecret: optionalEnv('AUTH0_CLIENT_SECRET'),
    issuer: auth0Issuer,
    algorithms: ['RS256'],
    jwksUri: `${auth0Domain}/.well-known/jwks.json`,
  },
  
  // Email configuration (optional)
  smtp: {
    host: optionalEnv('SMTP_HOST'),
    port: parseInt(optionalEnv('SMTP_PORT', '587'), 10),
    secure: optionalEnv('SMTP_PORT') === '465',
    user: optionalEnv('SMTP_USER'),
    pass: optionalEnv('SMTP_PASS'),
    from: optionalEnv('SMTP_FROM', 'noreply@affidavit-maker.com')
  },
  
  // Security configuration
  security: {
    bcryptRounds: parseInt(optionalEnv('BCRYPT_ROUNDS', '10'), 10),
    jwtExpiresIn: optionalEnv('JWT_EXPIRES_IN', '24h'),
    sessionSecret: optionalEnv('SESSION_SECRET', 'your-session-secret-here'),
    corsOrigins: optionalEnv('CORS_ORIGINS', '').split(',').filter(Boolean),
    trustedProxies: parseInt(optionalEnv('TRUSTED_PROXIES', '1'), 10)
  },
  
  // Rate limiting
  rateLimiting: {
    windowMs: parseInt(optionalEnv('RATE_LIMIT_WINDOW_MS', '900000'), 10), // 15 minutes
    maxRequests: parseInt(optionalEnv('RATE_LIMIT_MAX_REQUESTS', '100'), 10),
    maxAuthAttempts: parseInt(optionalEnv('RATE_LIMIT_AUTH_ATTEMPTS', '5'), 10)
  },
  
  // File storage
  storage: {
    documentsPath: optionalEnv('DOCUMENTS_PATH', './documents'),
    maxFileSize: parseInt(optionalEnv('MAX_FILE_SIZE', '10485760'), 10), // 10MB
    allowedFileTypes: ['pdf', 'txt', 'json']
  },
  
  // Feature flags
  features: {
    enableWebhooks: optionalEnv('ENABLE_WEBHOOKS', 'true') === 'true',
    enableEmailNotifications: optionalEnv('ENABLE_EMAIL_NOTIFICATIONS', 'false') === 'true',
    enableAnalytics: optionalEnv('ENABLE_ANALYTICS', 'true') === 'true',
    maintenanceMode: optionalEnv('MAINTENANCE_MODE', 'false') === 'true'
  },
  
  // Export helper functions for use in other modules
  requireEnv,
  optionalEnv,
  processAuth0Domain
};