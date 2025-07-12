// config/auth.config.js
// Centralized Auth0 configuration to ensure consistency

const getAuth0Config = () => {
  const domain = process.env.AUTH0_DOMAIN;
  
  if (!domain) {
    throw new Error('AUTH0_DOMAIN environment variable is required');
  }
  
  // Ensure domain has https:// prefix
  const domainWithProtocol = domain.startsWith('http') ? domain : `https://${domain}`;
  
  // Ensure trailing slash for issuer
  const issuer = domainWithProtocol.endsWith('/') ? domainWithProtocol : `${domainWithProtocol}/`;
  
  return {
    domain: domainWithProtocol,
    issuer: issuer,
    audience: process.env.AUTH0_AUDIENCE,
    clientId: process.env.AUTH0_CLIENT_ID,
    clientSecret: process.env.AUTH0_CLIENT_SECRET,
    algorithms: ['RS256'],
    // JWKS URI for key retrieval
    jwksUri: `${domainWithProtocol}/.well-known/jwks.json`
  };
};

// JWT verification options
const getJwtVerificationOptions = () => {
  const config = getAuth0Config();
  
  return {
    audience: config.audience,
    issuer: config.issuer,
    algorithms: config.algorithms
  };
};

// For debugging - log the configuration (without secrets)
const logAuthConfig = () => {
  const config = getAuth0Config();
  console.log('Auth0 Configuration:');
  console.log(`  Domain: ${config.domain}`);
  console.log(`  Issuer: ${config.issuer}`);
  console.log(`  Audience: ${config.audience}`);
  console.log(`  JWKS URI: ${config.jwksUri}`);
};

module.exports = {
  getAuth0Config,
  getJwtVerificationOptions,
  logAuthConfig
};