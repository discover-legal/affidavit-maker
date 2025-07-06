// middleware/auth0Middleware.js
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

const client = jwksClient({
  jwksUri: `${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
}

const checkJwt = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }

  jwt.verify(token, getKey, {
    audience: process.env.AUTH0_AUDIENCE,
    issuer: process.env.AUTH0_DOMAIN,
    algorithms: ['RS256']
  }, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    req.auth = decoded;
    next();
  });
};

module.exports = { checkJwt };