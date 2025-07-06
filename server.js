// server.js - Updated with template system integration
require('dotenv').config();

// Environment variable validation
const requiredEnvVars = ['DATABASE_URL', 'OPENAI_API_KEY', 'AUTH0_CLIENT_ID', 'STRIPE_SECRET_KEY'];
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
const { checkJwt } = require('./middleware/auth0Middleware');
const AffidavitService = require('./affidavitService');
const { generatePDF } = require('./services/pdfService');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Initialize Affidavit Service with template system
const affidavitService = new AffidavitService(process.env.OPENAI_API_KEY, {
  model: 'gpt-4',
  temperature: 0.3,
  timeout: 30000
});

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

// Document preview endpoint using templates
app.post('/api/preview', checkJwt, async (req, res) => {
  try {
    const { affidavitData } = req.body;
    const userId = req.auth.sub;
    const user = await getUserFromAuth(userId);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const preview = affidavitService.generatePreview(affidavitData, true);
    
    res.json(preview);

  } catch (error) {
    console.error('Preview generation error:', error);
    res.status(500).json({ success: false, error: 'Failed to generate preview' });
  }
});

// Enhanced document generation with template system
app.post('/api/generate-affidavit', checkJwt, async (req, res) => {
  try {
    const { affidavitData, strategy = 'simple', format = 'pdf' } = req.body;
    const userId = req.auth.sub;
    const user = await getUserFromAuth(userId);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
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
      `INSERT INTO documents (user_id, content, generated_text, generation_metadata, status, completed_at)
       VALUES ($1, $2, $3, $4, 'completed', NOW())
       RETURNING *`,
      [
        user.id,
        JSON.stringify(affidavitData),
        result.document.fullText,
        JSON.stringify(result.metadata)
      ]
    );

    // Generate PDF if requested
    let filePath = null;
    if (format === 'pdf') {
      filePath = await generatePDF(result.document, {
        documentId: document.rows[0].id,
        userId: user.id
      });

      // Update document with file path
      await pool.query(
        'UPDATE documents SET file_path = $1 WHERE id = $2',
        [filePath, document.rows[0].id]
      );
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
    res.status(500).json({ success: false, error: 'Failed to generate affidavit' });
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

// Save draft endpoint with template validation
app.post('/api/save-draft', checkJwt, async (req, res) => {
  try {
    const { documentId, affidavitData } = req.body;
    const userId = req.auth.sub;
    const user = await getUserFromAuth(userId);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    // Validate data if state is selected
    let validation = null;
    if (affidavitData.state) {
      validation = affidavitService.validateAffidavitData(affidavitData, affidavitData.state);
    }

    if (documentId) {
      // Update existing draft
      await pool.query(
        'UPDATE documents SET content = $1, validation_results = $2, updated_at = NOW() WHERE id = $3 AND user_id = $4',
        [JSON.stringify(affidavitData), JSON.stringify(validation), documentId, user.id]
      );
      res.json({ success: true, documentId, validation });
    } else {
      // Create new draft
      const document = await pool.query(
        `INSERT INTO documents (user_id, content, validation_results, status, created_at)
         VALUES ($1, $2, $3, 'draft', NOW())
         RETURNING id`,
        [user.id, JSON.stringify(affidavitData), JSON.stringify(validation)]
      );
      res.json({ success: true, documentId: document.rows[0].id, validation });
    }

    // Log activity
    await logActivity(user.id, 'draft_saved', 'document', documentId || document.rows[0].id, req);

  } catch (error) {
    console.error('Save draft error:', error);
    res.status(500).json({ success: false, error: 'Failed to save draft' });
  }
});

// Get user documents with template metadata
app.get('/api/documents', checkJwt, async (req, res) => {
  try {
    const userId = req.auth.sub;
    const user = await getUserFromAuth(userId);

    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    const documents = await pool.query(
      `SELECT id, content, status, validation_results, generation_metadata, created_at, updated_at, completed_at
       FROM documents 
       WHERE user_id = $1 
       ORDER BY updated_at DESC`,
      [user.id]
    );

    // Enhance documents with template information
    const enhancedDocuments = documents.rows.map(doc => {
      const content = doc.content ? JSON.parse(doc.content) : {};
      const validation = doc.validation_results ? JSON.parse(doc.validation_results) : null;
      const metadata = doc.generation_metadata ? JSON.parse(doc.generation_metadata) : null;

      return {
        ...doc,
        content,
        validation,
        metadata,
        state: content.state,
        documentType: content.documentType,
        affiantName: content.affiantName
      };
    });

    res.json({
      success: true,
      documents: enhancedDocuments
    });

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

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    templateStates: affidavitService.getSupportedStates().length,
    documentTypes: affidavitService.getSupportedDocumentTypes().length
  });
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