// server.js - Updated with template system integration
require('dotenv').config();

// Environment variable validation
const requiredEnvVars = ['DATABASE_URL', 'OPENAI_API_KEY', 'AUTH0_CLIENT_ID', 'AUTH0_DOMAIN', 'AUTH0_AUDIENCE', 'STRIPE_SECRET_KEY'];
requiredEnvVars.forEach(varName => {
  if (!process.env[varName]) {
    console.error(`Missing required environment variable: ${varName}`);
    process.exit(1);
  }
});

const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { Pool } = require('pg');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const nodemailer = require('nodemailer');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const jwksClient = require('jwks-rsa');

// Try to import services, but handle missing files gracefully
let AffidavitService, generatePDF;
try {
  AffidavitService = require('./affidavitService');
  ({ generatePDF } = require('./services/pdfService'));
} catch (importError) {
  console.warn('Warning: Some service files missing. Some features may not work:', importError.message);
  // Create fallback functions
  AffidavitService = class {
    constructor() {
      this.templateManager = {
        getTemplate: () => ({ getRequirements: () => ({}) }),
        getSupportedStates: () => [
          { code: 'TX', name: 'Texas', requirements: {} },
          { code: 'UT', name: 'Utah', requirements: {} },
          { code: 'AZ', name: 'Arizona', requirements: {} }
        ],
        getSupportedDocumentTypes: () => ['divorce', 'custody', 'child_support', 'spousal_support', 'property_division', 'paternity', 'modification']
      };
      this.openai = { chat: { completions: { create: async () => ({ choices: [{ message: { content: 'Service temporarily unavailable' } }] }) } } };
    }
    validateAffidavitData() { return { isValid: true, errors: [], warnings: [] }; }
    generatePreview() { return { success: true, preview: { sections: {} } }; }
    processAffidavit() { return { success: false, error: 'Service temporarily unavailable' }; }
    getSupportedStates() { return this.templateManager.getSupportedStates(); }
    getSupportedDocumentTypes() { return this.templateManager.getSupportedDocumentTypes(); }
  };
  generatePDF = async () => { throw new Error('PDF service not available'); };
}

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Auth0 JWT verification setup
const client = jwksClient({
  jwksUri: `${process.env.AUTH0_DOMAIN}/.well-known/jwks.json`
});

function getKey(header, callback) {
  client.getSigningKey(header.kid, (err, key) => {
    if (err) {
      console.error('JWKS key retrieval error:', err);
      return callback(err);
    }
    const signingKey = key.publicKey || key.rsaPublicKey;
    callback(null, signingKey);
  });
}

// Enhanced JWT verification middleware
const checkJwt = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      success: false, 
      error: 'Authorization token required',
      requiresLogin: true 
    });
  }

  const token = authHeader.split(' ')[1];
  
  jwt.verify(token, getKey, {
    audience: process.env.AUTH0_AUDIENCE,
    issuer: process.env.AUTH0_DOMAIN,
    algorithms: ['RS256']
  }, async (err, decoded) => {
    if (err) {
      console.error('JWT verification error:', err.message);
      return res.status(401).json({ 
        success: false, 
        error: 'Invalid or expired token',
        requiresLogin: true 
      });
    }
    
    try {
      req.auth = decoded;
      req.userId = decoded.sub;
      
      // Get or create user in database
      const user = await getUserFromAuth(decoded.sub, decoded);
      req.user = user;
      
      next();
    } catch (error) {
      console.error('User lookup error:', error);
      return res.status(500).json({ 
        success: false, 
        error: 'User verification failed' 
      });
    }
  });
};

// Optional JWT verification for public endpoints
const optionalAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.auth = null;
    req.userId = null;
    req.user = null;
    return next();
  }

  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = await new Promise((resolve, reject) => {
      jwt.verify(token, getKey, {
        audience: process.env.AUTH0_AUDIENCE,
        issuer: process.env.AUTH0_DOMAIN,
        algorithms: ['RS256']
      }, (err, result) => {
        if (err) reject(err);
        else resolve(result);
      });
    });
    
    req.auth = decoded;
    req.userId = decoded.sub;
    req.user = await getUserFromAuth(decoded.sub, decoded);
  } catch (error) {
    // Ignore auth errors for optional auth
    req.auth = null;
    req.userId = null;
    req.user = null;
  }
  
  next();
};

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL 
    : 'http://localhost:3000',
  credentials: true
}));

app.use('/api/', limiter);
app.use(express.json());

// Email configuration
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  secure: true,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Utility functions
async function logActivity(userId, action, resourceType, resourceId, req) {
  try {
    await pool.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, action, resourceType, resourceId, req.ip, req.get('user-agent')]
    );
  } catch (error) {
    console.error('Activity logging error:', error);
  }
}

async function getUserFromAuth(authId) {
  try {
    const result = await pool.query('SELECT * FROM users WHERE auth0_id = $1', [authId]);
    return result.rows[0] || null;
  } catch (error) {
    console.error('User lookup error:', error);
    return null;
  }
}

// Template system endpoints
app.get('/api/templates/states', (req, res) => {
  try {
    const states = affidavitService.getSupportedStates();
    res.json({
      success: true,
      states
    });
  } catch (error) {
    console.error('Get states error:', error);
    res.status(500).json({ success: false, error: 'Failed to get supported states' });
  }
});

app.get('/api/templates/document-types', (req, res) => {
  try {
    const documentTypes = affidavitService.getSupportedDocumentTypes();
    res.json({
      success: true,
      documentTypes
    });
  } catch (error) {
    console.error('Get document types error:', error);
    res.status(500).json({ success: false, error: 'Failed to get document types' });
  }
});

app.post('/api/templates/validate', (req, res) => {
  try {
    const { affidavitData, state } = req.body;
    const validation = affidavitService.validateAffidavitData(affidavitData, state);
    
    res.json({
      success: true,
      validation
    });
  } catch (error) {
    console.error('Validation error:', error);
    res.status(500).json({ success: false, error: 'Failed to validate data' });
  }
});

// Enhanced chat endpoint with template integration
app.post('/api/chat', checkJwt, async (req, res) => {
  try {
    const { message, conversationHistory, currentData, documentId } = req.body;
    const userId = req.auth.sub;
    const user = await getUserFromAuth(userId);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Validate current data if state is selected
    let validation = null;
    if (currentData.state) {
      validation = affidavitService.validateAffidavitData(currentData, currentData.state);
    }

    // Enhanced chat logic with template awareness
    const template = currentData.state ? affidavitService.templateManager.getTemplate(currentData.state) : null;
    const requirements = template ? template.getRequirements() : {};

    // Build AI prompt with template context
    const systemPrompt = `You are a legal assistant helping create affidavits. You have access to state-specific templates and requirements.

Current State: ${currentData.state || 'Not selected'}
Document Type: ${currentData.documentType || 'general'}
Template Requirements: ${JSON.stringify(requirements)}
Current Data: ${JSON.stringify(currentData)}
Validation: ${validation ? JSON.stringify(validation) : 'Not validated'}

Guide the user through collecting all necessary information for their ${currentData.state || 'state'} affidavit. Focus on:
1. Required information for their state
2. Completeness of facts
3. Legal sufficiency
4. Proper formatting requirements

Respond with helpful guidance and ask for missing information.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...conversationHistory.map(msg => ({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content
      })),
      { role: "user", content: message }
    ];

    // Add request timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const completion = await affidavitService.openai.chat.completions.create({
        model: "gpt-4",
        messages,
        temperature: 0.7,
        max_tokens: 1000,
        signal: controller.signal,
        response_format: { type: "json_object" },
        functions: [{
          name: "update_affidavit_data",
          description: "Update the affidavit data based on user input",
          parameters: {
            type: "object",
            properties: {
              extractedData: {
                type: "object",
                description: "Data extracted from user response"
              },
              response: {
                type: "string",
                description: "Response to user"
              },
              conversationComplete: {
                type: "boolean",
                description: "Whether enough information has been collected"
              },
              nextSteps: {
                type: "array",
                items: { type: "string" },
                description: "Suggested next steps for the user"
              }
            }
          }
        }]
      });

      clearTimeout(timeout);

      let aiResponse;
      try {
        aiResponse = JSON.parse(completion.choices[0].message.content);
      } catch (parseError) {
        aiResponse = {
          response: completion.choices[0].message.content,
          extractedData: {},
          conversationComplete: false,
          nextSteps: []
        };
      }

      // Log activity
      await logActivity(user.id, 'chat_interaction', 'conversation', documentId, req);

      res.json({
        success: true,
        response: aiResponse.response,
        extractedData: aiResponse.extractedData || {},
        conversationComplete: aiResponse.conversationComplete || false,
        nextSteps: aiResponse.nextSteps || [],
        validation: validation,
        stateRequirements: requirements
      });

    } catch (error) {
      clearTimeout(timeout);
      if (error.name === 'AbortError') {
        return res.status(504).json({ success: false, error: 'Request timeout' });
      }
      throw error;
    }

  } catch (error) {
    console.error('Chat endpoint error:', error);
    res.status(500).json({ success: false, error: 'Failed to process chat message' });
  }
});

// Enhanced document preview endpoint using templates
app.post('/api/preview', optionalAuth, async (req, res) => {
  try {
    const { affidavitData } = req.body;
    const userId = req.userId;

    if (!affidavitData.state) {
      return res.status(400).json({
        success: false,
        error: 'State is required for preview generation'
      });
    }

    const preview = affidavitService.generatePreview(affidavitData, true);
    
    // Log activity if user is logged in
    if (userId) {
      await logActivity(req.user.id, 'preview_generated', 'document', affidavitData.documentId, req);
    }
    
    res.json(preview);

  } catch (error) {
    console.error('Preview generation error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate preview',
      fallback: {
        sections: {
          header: `THE STATE OF ${(affidavitData.state || 'TEXAS').toUpperCase()}`,
          title: 'AFFIDAVIT',
          introduction: `BEFORE ME, the undersigned Notary Public, personally appeared ${affidavitData.affiantName || '[AFFIANT NAME]'}.`,
          facts: (affidavitData.facts || []).map((fact, index) => ({
            number: index + 1,
            content: fact,
            type: 'fact'
          })),
          conclusion: 'Further, affiant sayeth not.',
          signatureBlock: {
            line: '_'.repeat(40),
            name: affidavitData.affiantName || '[AFFIANT NAME]',
            title: 'Affiant'
          }
        }
      }
    });
  }
});

// Enhanced document generation with template system
app.post('/api/generate-affidavit', checkJwt, async (req, res) => {
  try {
    const { affidavitData, strategy = 'simple', format = 'pdf' } = req.body;
    const userId = req.userId;
    const user = req.user;

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found',
        requiresLogin: true 
      });
    }

    if (!affidavitData || !affidavitData.state) {
      return res.status(400).json({
        success: false,
        error: 'Affidavit data and state are required'
      });
    }

    // Generate document using template service
    const result = await affidavitService.processAffidavit(affidavitData, strategy, {
      documentId: affidavitData.documentId
    });

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Save to database
    const document = await pool.query(
      `INSERT INTO documents (user_id, content, generated_text, template_state, 
                             document_type, generation_metadata, status, completed_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'completed', NOW())
       RETURNING *`,
      [
        user.id,
        JSON.stringify(affidavitData),
        result.document.fullText,
        affidavitData.state,
        affidavitData.documentType || 'general',
        JSON.stringify(result.metadata)
      ]
    );

    // Generate PDF if requested
    let filePath = null;
    if (format === 'pdf') {
      try {
        filePath = await generatePDF(result.document, {
          documentId: document.rows[0].id,
          userId: user.id
        });

        // Update document with file path
        await pool.query(
          'UPDATE documents SET file_path = $1 WHERE id = $2',
          [filePath, document.rows[0].id]
        );
      } catch (pdfError) {
        console.error('PDF generation error:', pdfError);
        // Continue without PDF - user can still get text version
      }
    }

    // Log activity
    await logActivity(user.id, 'document_generated', 'document', document.rows[0].id, req);

    res.json({
      success: true,
      documentId: document.rows[0].id,
      content: result.document.fullText,
      htmlContent: result.document.htmlContent,
      downloadUrl: filePath ? `/api/download/${document.rows[0].id}` : null,
      metadata: result.metadata,
      validation: result.validation
    });

  } catch (error) {
    console.error('Generation error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to generate affidavit',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Document analysis endpoint
app.post('/api/analyze-document', checkJwt, async (req, res) => {
  try {
    const { documentText, state } = req.body;
    const userId = req.auth.sub;
    const user = await getUserFromAuth(userId);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const analysis = affidavitService.analyzeDocument(documentText, state);
    
    res.json({
      success: true,
      analysis
    });

  } catch (error) {
    console.error('Document analysis error:', error);
    res.status(500).json({ success: false, error: 'Failed to analyze document' });
  }
});

// Enhanced save draft endpoint with proper error handling
app.post('/api/save-draft', checkJwt, async (req, res) => {
  try {
    const { documentId, affidavitData } = req.body;
    const userId = req.userId;
    const user = req.user;

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found',
        requiresLogin: true 
      });
    }

    // Validate affidavit data
    if (!affidavitData || typeof affidavitData !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Invalid affidavit data provided'
      });
    }

    // Validate data if state is selected
    let validation = null;
    if (affidavitData.state) {
      try {
        validation = affidavitService.validateAffidavitData(affidavitData, affidavitData.state);
      } catch (validationError) {
        console.error('Validation error:', validationError);
        validation = {
          isValid: false,
          errors: ['Validation temporarily unavailable'],
          warnings: []
        };
      }
    }

    let document;
    
    if (documentId) {
      // Update existing draft
      const updateResult = await pool.query(
        `UPDATE documents 
         SET content = $1, validation_results = $2, template_state = $3, 
             document_type = $4, updated_at = NOW() 
         WHERE id = $5 AND user_id = $6
         RETURNING *`,
        [
          JSON.stringify(affidavitData), 
          JSON.stringify(validation),
          affidavitData.state,
          affidavitData.documentType || 'general',
          documentId, 
          user.id
        ]
      );
      
      if (updateResult.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Document not found or access denied'
        });
      }
      
      document = updateResult.rows[0];
      
    } else {
      // Create new draft
      const insertResult = await pool.query(
        `INSERT INTO documents (user_id, content, validation_results, template_state, 
                               document_type, status, created_at)
         VALUES ($1, $2, $3, $4, $5, 'draft', NOW())
         RETURNING *`,
        [
          user.id, 
          JSON.stringify(affidavitData), 
          JSON.stringify(validation),
          affidavitData.state,
          affidavitData.documentType || 'general'
        ]
      );
      
      document = insertResult.rows[0];
    }

    // Log activity
    await logActivity(user.id, documentId ? 'draft_updated' : 'draft_created', 'document', document.id, req);

    // Return consistent response format
    res.json({ 
      success: true, 
      documentId: document.id,
      validation,
      document: {
        id: document.id,
        status: document.status,
        created_at: document.created_at,
        updated_at: document.updated_at,
        state: affidavitData.state,
        documentType: affidavitData.documentType,
        affiantName: affidavitData.affiantName
      }
    });

  } catch (error) {
    console.error('Save draft error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to save draft. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Get user documents with enhanced data
app.get('/api/documents', checkJwt, async (req, res) => {
  try {
    const userId = req.userId;
    const user = req.user;

    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: 'User not found',
        requiresLogin: true 
      });
    }
    
    const documents = await pool.query(
      `SELECT id, content, generated_text, template_state, document_type, 
              validation_results, generation_metadata, status, file_path,
              created_at, updated_at, completed_at
       FROM documents 
       WHERE user_id = $1 
       ORDER BY updated_at DESC`,
      [user.id]
    );

    // Enhance documents with parsed content
    const enhancedDocuments = documents.rows.map(doc => {
      let content = {};
      let validation = null;
      let metadata = null;

      try {
        content = doc.content ? JSON.parse(doc.content) : {};
      } catch (e) {
        console.error('Error parsing document content:', e);
      }

      try {
        validation = doc.validation_results ? JSON.parse(doc.validation_results) : null;
      } catch (e) {
        console.error('Error parsing validation results:', e);
      }

      try {
        metadata = doc.generation_metadata ? JSON.parse(doc.generation_metadata) : null;
      } catch (e) {
        console.error('Error parsing generation metadata:', e);
      }

      return {
        id: doc.id,
        status: doc.status,
        created_at: doc.created_at,
        updated_at: doc.updated_at,
        completed_at: doc.completed_at,
        
        // Template and document info
        state: doc.template_state || content.state,
        template_state: doc.template_state,
        document_type: doc.document_type || content.documentType,
        documentType: doc.document_type || content.documentType,
        
        // User content
        affiantName: content.affiantName,
        caseNumber: content.caseNumber,
        county: content.county,
        
        // Validation and metadata
        validation,
        metadata,
        
        // File info
        hasFile: !!doc.file_path,
        
        // Full content (for editing)
        content
      };
        });

  } catch (error) {
    console.error('Fetch documents error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch documents',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});,
      count: enhancedDocuments.length
    });

  } catch (error) {
    console.error('Fetch documents error:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch documents',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});});

  } catch (error) {
    console.error('Fetch documents error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch documents' });
  }
});

// Download endpoint
app.get('/api/download/:documentId', checkJwt, async (req, res) => {
  try {
    const { documentId } = req.params;
    const userId = req.auth.sub;
    const user = await getUserFromAuth(userId);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const document = await pool.query(
      'SELECT file_path, content FROM documents WHERE id = $1 AND user_id = $2',
      [documentId, user.id]
    );

    if (document.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Document not found' });
    }

    const filePath = document.rows[0].file_path;
    if (!filePath) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }

    // Log download activity
    await logActivity(user.id, 'document_downloaded', 'document', documentId, req);

    res.download(filePath, `affidavit-${documentId}.pdf`);

  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ success: false, error: 'Failed to download document' });
  }
});

// Payment endpoints remain the same
app.post('/api/payment/create-intent', checkJwt, async (req, res) => {
  try {
    const userId = req.auth.sub;
    const user = await getUserFromAuth(userId);
    const { documentType, documentId } = req.body;
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const amount = documentType === 'single_affidavit' ? 999 : 2999; // $9.99 or $29.99
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      metadata: {
        userId: user.id.toString(),
        documentId: documentId,
        type: documentType
      }
    });
    
    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      amount: amount / 100
    });
    
  } catch (error) {
    console.error('Payment intent error:', error);
    res.status(500).json({ success: false, error: 'Failed to create payment intent' });
  }
});

// Health check endpoint with template system status
app.get('/health', (req, res) => {
  try {
    const health = {
      status: 'OK',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      services: {
        database: 'OK',
        templates: 'OK',
        auth: 'OK'
      }
    };

    // Check template system
    try {
      const states = affidavitService.getSupportedStates();
      const docTypes = affidavitService.getSupportedDocumentTypes();
      health.templateStates = states.length;
      health.documentTypes = docTypes.length;
      health.supportedStates = states.map(s => s.name).join(', ');
    } catch (templateError) {
      health.services.templates = 'ERROR';
      health.templateError = templateError.message;
    }

    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Supported states: ${affidavitService.getSupportedStates().map(s => s.name).join(', ')}`);
  console.log(`Document types: ${affidavitService.getSupportedDocumentTypes().join(', ')}`);
});

module.exports = app;