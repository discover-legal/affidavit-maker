// Enhanced JWT verification middleware with debugging
const checkJwt = (req, res, next) => {
  console.log('🔍 Auth middleware called for:', req.path);
  console.log('🔍 Headers received:', JSON.stringify(req.headers, null, 2));
  
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log('❌ No auth header or invalid format');
    return res.status(401).json({ 
      success: false, 
      error: 'Authorization token required',
      requiresLogin: true 
    });
  }

  const token = authHeader.split(' ')[1];
  console.log('🔍 Token extracted (first 50 chars):', token.substring(0, 50) + '...');
  
  jwt.verify(token, getKey, {
    audience: process.env.AUTH0_AUDIENCE,
    issuer: `${process.env.AUTH0_DOMAIN}/`, // Should be https://your-domain.auth0.com
    algorithms: ['RS256']
  }, async (err, decoded) => {
    if (err) {
      console.error('❌ JWT verification error:', err.message);
      console.error('❌ Expected audience:', process.env.AUTH0_AUDIENCE);
      console.error('❌ Expected issuer:', process.env.AUTH0_DOMAIN);
      
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid or expired token',
        requiresLogin: true,
        debug: {
          errorMessage: err.message,
          expectedAudience: process.env.AUTH0_AUDIENCE,
          expectedissuer: `${process.env.AUTH0_DOMAIN}/`
        }
      });
    }
    
    try {
      console.log('✅ JWT verified successfully');
      console.log('🔍 Decoded token:', JSON.stringify(decoded, null, 2));
      
      req.auth = decoded;
      req.userId = decoded.sub;
      
      // Get or create user in database
      const user = await getUserFromAuth(decoded.sub, decoded);
      req.user = user;
      
      console.log('✅ User found/created:', user?.id);
      
      next();
    } catch (error) {
      console.error('❌ User lookup error:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'User verification failed' 
      });
    }
  });
};

// Debug endpoint to check auth configuration
app.get('/api/debug/auth-config', (req, res) => {
  res.json({
    auth0Domain: process.env.AUTH0_DOMAIN,
    auth0Audience: process.env.AUTH0_AUDIENCE,
    hasClientId: !!process.env.AUTH0_CLIENT_ID,
    timestamp: new Date().toISOString()
  });
});

// Debug endpoint to test token validation
app.get('/api/debug/verify-token', checkJwt, (req, res) => {
  res.json({
    success: true,
    user: req.user,
    auth: req.auth,
    timestamp: new Date().toISOString()
  });
});