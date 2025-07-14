require('dotenv').config();

const requiredEnvVars = ['DATABASE_URL', 'OPENAI_API_KEY', 'AUTH0_DOMAIN', 'AUTH0_AUDIENCE', 'STRIPE_SECRET_KEY'];

requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    throw new Error(`Missing required environment variable: ${varName}. Please check your .env file.`);
  }
});

const authDomain = process.env.AUTH0_DOMAIN;
const domainWithProtocol = authDomain.startsWith('http') ? authDomain : `https://${authDomain}`;
const issuer = domainWithProtocol.endsWith('/') ? domainWithProtocol : `${domainWithProtocol}/`;

module.exports = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: process.env.PORT || 3001,
  databaseUrl: process.env.DATABASE_URL,
  openaiApiKey: process.env.OPENAI_API_KEY,
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  logLevel: process.env.LOG_LEVEL || 'info',

  auth0: {
    domain: domainWithProtocol,
    audience: process.env.AUTH0_AUDIENCE,
    clientId: process.env.AUTH0_CLIENT_ID,
    clientSecret: process.env.AUTH0_CLIENT_SECRET,
    issuer: issuer,
    algorithms: ['RS256'],
    jwksUri: `${domainWithProtocol}/.well-known/jwks.json`,
  },

  smtp: {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  }
};