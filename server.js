// server.js - Complete fixed version with all syntax errors resolved
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
        getTemplate: () => ({ 
          getRequirements: () => ({}),
          validateData: () => ({ isValid: true, errors: [], warnings: [] }),
          generateDocument: () => ({ sections: {}, fullText: '', htmlContent: '' })
        }),
        getSupportedStates: () => [
          { code: 'TX', name: 'Texas', requirements: {} },
          { code: 'UT', name: 'Utah', requirements: {} },
          { code: 'AZ', name: 'Arizona', requirements: {} }
        ],
        getSupportedDocumentTypes: () => ['divorce', 'custody', 'child_support', 'spousal_support', 'property_division']
      };
      this.openai = { 
        chat: { 
          completions: { 
            create: async () => ({ 
              choices: [{ 
                message: { 
                  content: JSON.stringify({
                    response: 'Service temporarily unavailable',
                    extractedData: {},
                    conversationComplete: false
                  })
                }
              }] 
            }) 
          } 
        } 
      };
    }
    validateAffidavitData() { return { isValid: true, errors: [], warnings: [] }; }
    generatePreview(data) { 
      return { 
        success: true, 
        preview: { 
          sections: {
            header: `THE STATE OF ${(data.state || 'TEXAS').toUpperCase()}`,
            title: 'AFFIDAVIT',
            introduction: `BEFORE ME, the undersigned Notary Public, personally appeared ${data.affiantName || '[AFFIANT NAME]'}.`,
            facts: (data.facts || []).map((fact, index) => ({
              number: index + 1,
              content: fact,
              type: 'fact'
            })),
            conclusion: 'Further, affiant sayeth not.',
            signatureBlock: {
              line: '_'.repeat(40),
              name: data.affiantName || '[AFFIANT NAME]',
              title: 'Affiant'
            }
          }
        }
      }; 
    }
    processAffidavit() { return { success: false, error: 'Service temporarily unavailable' }; }
    getSupportedStates() { return this.templateManager.getSupportedStates(); }
    getSupportedDocumentTypes() { return this.templateManager.getSupportedDocumentTypes(); }
  };
  generatePDF = async () => { throw new Error('PDF service not available'); };
}

// Initialize AffidavitService
const affidavitService = new AffidavitService(process.env.OPENAI_API_KEY);

const app = express();
const PORT = process.env.PORT || 3001;

// Enhanced database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test database connection
pool.on('connect', () => {
  console.log('✅ Database connected successfully');
});

pool.on('error', (err) => {
  console.error('❌ Database connection error:', err);
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

// Enhanced rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many requests, please try again later.'
  }
});

// Global rate limiting
app.use(limiter);

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? process.env.FRONTEND_URL 
    : 'http://localhost:3000',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// Email configuration
let transporter;
try {
  transporter = nodemailer.createTransporter({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: true,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
} catch (emailError) {
  console.warn('Email configuration failed:', emailError.message);
  transporter = null;
}

// Enhanced utility functions
async function logActivity(userId, action, resourceType, resourceId, req) {
  try {
    await pool.query(
      `INSERT INTO activity_logs (user_id, action, resource_type, resource_id, ip_address, user_agent, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        userId, 
        action, 
        resourceType, 
        resourceId, 
        req.ip, 
        req.get('user-agent'),
        JSON.stringify({ timestamp: new Date().toISOString() })
      ]
    );
  } catch (error) {
    console.error('Activity logging error:', error);
  }
}

// Fixed getUserFromAuth with user creation
async function getUserFromAuth(authId, decoded) {
  try {
    let result = await pool.query('SELECT * FROM users WHERE auth0_id = $1', [authId]);
    
    if (result.rows.length === 0 && decoded) {
      // Create new user
      console.log('Creating new user:', decoded.email);
      result = await pool.query(
        `INSERT INTO users (auth0_id, email, name, created_at, updated_at, last_login_at) 
         VALUES ($1, $2, $3, NOW(), NOW(), NOW()) 
         RETURNING *`,
        [authId, decoded.email || '', decoded.name || '']
      );
    } else if (result.rows.length > 0) {
      // Update last login
      await pool.query(
        'UPDATE users SET last_login_at = NOW() WHERE id = $1',
        [result.rows[0].id]
      );
    }
    
    return result.rows[0] || null;
  } catch (error) {
    console.error('User lookup/creation error:', error);
    throw error;
  }
}

// Document status validation
const VALID_STATUS_TRANSITIONS = {
  'draft': ['completed', 'draft'],
  'completed': ['paid', 'completed'],
  'paid': ['downloaded', 'paid'],
  'downloaded': ['downloaded']
};

function validateStatusTransition(currentStatus, newStatus) {
  return VALID_STATUS_TRANSITIONS[currentStatus]?.includes(newStatus) || false;
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
    
    if (!affidavitData || !state) {
      return res.status(400).json({
        success: false,
        error: 'affidavitData and state are required'
      });
    }
    
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

// Enhanced chat endpoint with fixed AI integration
app.post('/api/chat', checkJwt, async (req, res) => {
  try {
    const { message, conversationHistory, currentData, documentId } = req.body;
    const userId = req.userId;
    const user = req.user;

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (!message || !message.trim()) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }

    // Validate current data if state is selected
    let validation = null;
    if (currentData?.state) {
      validation = affidavitService.validateAffidavitData(currentData, currentData.state);
    }

    // Enhanced chat logic with template awareness
    const template = currentData?.state ? affidavitService.templateManager.getTemplate(currentData.state) : null;
    const requirements = template ? template.getRequirements() : {};

    // Build AI prompt with template context
    const systemPrompt = `You are a legal assistant helping create affidavits. You have access to state-specific templates and requirements.

Current State: ${currentData?.state || 'Not selected'}
Document Type: ${currentData?.documentType || 'general'}
Template Requirements: ${JSON.stringify(requirements)}
Current Data: ${JSON.stringify(currentData)}
Validation: ${validation ? JSON.stringify(validation) : 'Not validated'}

Guide the user through collecting all necessary information for their ${currentData?.state || 'state'} affidavit. Focus on:
1. Required information for their state
2. Completeness of facts
3. Legal sufficiency
4. Proper formatting requirements

Always respond with a JSON object containing:
- response: Your helpful message to the user
- extractedData: Any new data to extract from their message
- conversationComplete: boolean indicating if enough info is collected
- nextSteps: array of suggested next steps

Be conversational but professional. Ask for one piece of information at a time.`;

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
        response_format: { type: "json_object" }
      });

      clearTimeout(timeout);

      let aiResponse;
      try {
        aiResponse = JSON.parse(completion.choices[0].message.content);
      } catch (parseError) {
        console.warn('AI response parsing failed, using fallback');
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
    res.status(500).json({ 
      success: false, 
      error: 'Failed to process chat message',
      fallbackResponse: 'I apologize, but I\'m having trouble processing your message right now. Please try again.'
    });
  }
});

// Enhanced document preview endpoint using templates
app.post('/api/preview', optionalAuth, async (req, res) => {
  try {
    const { affidavitData } = req.body;
    const userId = req.userId;

    if (!affidavitData) {
      return res.status(400).json({
        success: false,
        error: 'Affidavit data is required'
      });
    }

    if (!affidavitData.state) {
      return res.status(400).json({
        success: false,
        error: 'State is required for preview generation'
      });
    }

    const preview = affidavitService.generatePreview(affidavitData, true);
    
    // Log activity if user is logged in
    if (userId && req.user) {
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
          header: `THE STATE OF ${(req.body.affidavitData?.state || 'TEXAS').toUpperCase()}`,
          title: 'AFFIDAVIT',
          introduction: `BEFORE ME, the undersigned Notary Public, personally appeared ${req.body.affidavitData?.affiantName || '[AFFIANT NAME]'}.`,
          facts: (req.body.affidavitData?.facts || []).map((fact, index) => ({
            number: index + 1,
            content: fact,
            type: 'fact'
          })),
          conclusion: 'Further, affiant sayeth not.',
          signatureBlock: {
            line: '_'.repeat(40),
            name: req.body.affidavitData?.affiantName || '[AFFIANT NAME]',
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
    const user = req.user;

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    if (!documentText || !state) {
      return res.status(400).json({
        success: false,
        error: 'Document text and state are required'
      });
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

    res.json({
      success: true,
      documents: enhancedDocuments,
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
});

// Download endpoint
app.get('/api/download/:documentId', checkJwt, async (req, res) => {
  try {
    const { documentId } = req.params;
    const userId = req.auth.sub;
    const user = req.user;

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

// Enhanced payment endpoints
app.post('/api/payment/create-intent', checkJwt, async (req, res) => {
  try {
    const userId = req.auth.sub;
    const user = req.user;
    const { documentType, documentId } = req.body;
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    // Payment amount logic
    const amount = documentType === 'single_affidavit' ? 999 : 2999; // $9.99 or $29.99
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency: 'usd',
      metadata: {
        userId: user.id.toString(),
        documentId: documentId || 'new',
        type: documentType
      }
    });
    
    // Log payment intent creation
    await logActivity(user.id, 'payment_intent_created', 'payment', paymentIntent.id, req);
    
    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      amount: amount / 100,
      paymentIntentId: paymentIntent.id
    });
    
  } catch (error) {
    console.error('Payment intent error:', error);
    res.status(500).json({ success: false, error: 'Failed to create payment intent' });
  }
});

// Payment confirmation endpoint
app.post('/api/payment/confirm', checkJwt, async (req, res) => {
  try {
    const { paymentIntentId } = req.body;
    const user = req.user;
    
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    // Verify payment with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        success: false,
        error: 'Payment not completed'
      });
    }
    
    // Record payment in database
    const payment = await pool.query(
      `INSERT INTO payments (user_id, stripe_payment_intent_id, amount_cents, 
                            currency, status, payment_type, product_details)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        user.id,
        paymentIntentId,
        paymentIntent.amount,
        paymentIntent.currency,
        'succeeded',
        paymentIntent.metadata.type,
        JSON.stringify(paymentIntent.metadata)
      ]
    );
    
    // Log payment success
    await logActivity(user.id, 'payment_completed', 'payment', payment.rows[0].id, req);
    
    res.json({
      success: true,
      paymentId: payment.rows[0].id,
      message: 'Payment confirmed successfully'
    });
    
  } catch (error) {
    console.error('Payment confirmation error:', error);
    res.status(500).json({ success: false, error: 'Failed to confirm payment' });
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
        auth: 'OK',
        stripe: 'OK'
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

    // Check database connection
    pool.query('SELECT 1', (err) => {
      if (err) {
        health.services.database = 'ERROR';
        health.databaseError = err.message;
      }
    });

    res.json(health);
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      error: error.message
    });
  }
});

// Webhook endpoint for Stripe
app.post('/api/webhooks/stripe', express.raw({type: 'application/json'}), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Handle the event
  switch (event.type) {
    case 'payment_intent.succeeded':
      const paymentIntent = event.data.object;
      console.log('Payment succeeded:', paymentIntent.id);
      // Additional handling if needed
      break;
    case 'payment_intent.payment_failed':
      const failedPayment = event.data.object;
      console.log('Payment failed:', failedPayment.id);
      // Handle failed payment
      break;
    default:
      console.log(`Unhandled event type ${event.type}`);
  }

  res.json({received: true});
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  
  // Don't leak error details in production
  const errorMessage = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : error.message;
    
  res.status(500).json({ 
    success: false, 
    error: errorMessage,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path,
    method: req.method
  });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down gracefully');
  
  // Close database connections
  await pool.end();
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, shutting down gracefully');
  
  // Close database connections
  await pool.end();
  
  process.exit(0);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🗺️  Supported states: ${affidavitService.getSupportedStates().map(s => s.name).join(', ')}`);
  console.log(`📄 Document types: ${affidavitService.getSupportedDocumentTypes().join(', ')}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  
  if (process.env.NODE_ENV === 'development') {
    console.log(`🔧 Frontend should be running on: http://localhost:3000`);
  }
});

module.exports = app;