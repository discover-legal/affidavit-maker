// server.js
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const fs = require('fs').promises;
const path = require('path');
const PDFDocument = require('pdfkit');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Initialize Payment Processor
const { PaymentProcessor, createPaymentRoutes } = require('./paymentProcessor');
const paymentProcessor = new PaymentProcessor({
  gateway: process.env.PAYMENT_GATEWAY || 'stripe', // Change to your gateway
  apiKey: process.env.PAYMENT_API_KEY,
  apiSecret: process.env.PAYMENT_API_SECRET,
  environment: process.env.NODE_ENV === 'production' ? 'production' : 'sandbox'
});

// Middleware
app.use(cors());
app.use(express.json());

// In-memory storage (replace with database in production)
const users = new Map();
const sessions = new Map();
const paidSessions = new Map(); // Track paid sessions

// JWT Secret (use environment variable in production)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// System prompt for the AI assistant
const SYSTEM_PROMPT = `You are an AI legal document preparation assistant helping self-represented litigants create affidavits. 

IMPORTANT RULES:
1. You ONLY help with document preparation, never give legal advice
2. Always maintain a professional, empathetic tone
3. Ask one clear question at a time
4. Validate information appropriately (dates, names, case numbers)
5. For family law affidavits, gather: full name, case number, relevant facts in chronological order, and specific relief sought
6. Ensure all facts are stated clearly and objectively
7. Flag when you have enough information to generate the affidavit

Current conversation state will be provided. Extract and track:
- State jurisdiction
- Case type
- Affiant name
- Case number
- Key facts (numbered)
- Current conversation stage

Respond with a JSON object containing:
{
  "response": "Your message to the user",
  "extractedData": {
    "state": "TX/UT/AZ or null",
    "caseType": "string or null",
    "affiantName": "string or null", 
    "caseNumber": "string or null",
    "facts": ["array of fact strings"],
    "dataComplete": boolean,
    "nextQuestion": "what to ask next"
  }
}`;

// Chat endpoint
app.post('/api/chat', async (req, res) => {
  try {
    const { message, conversationHistory, currentData } = req.body;

    // Build conversation context
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'system', content: `Current data collected: ${JSON.stringify(currentData)}` }
    ];

    // Add conversation history
    conversationHistory.forEach(msg => {
      messages.push({
        role: msg.type === 'user' ? 'user' : 'assistant',
        content: msg.content
      });
    });

    // Add current message
    messages.push({ role: 'user', content: message });

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4-turbo-preview', // or 'gpt-4-1106-preview' for the latest
      messages: messages,
      temperature: 0.7,
      response_format: { type: "json_object" }
    });

    const aiResponse = JSON.parse(completion.choices[0].message.content);

    res.json({
      success: true,
      response: aiResponse.response,
      extractedData: aiResponse.extractedData
    });

  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process message'
    });
  }
});

// Generate affidavit endpoint
app.post('/api/generate-affidavit', async (req, res) => {
  try {
    const { affidavitData, sessionId } = req.body;

    // Check if payment has been made for this session
    if (!paidSessions.has(sessionId)) {
      return res.status(402).json({
        success: false,
        error: 'Payment required',
        requiresPayment: true
      });
    }

    const paymentInfo = paidSessions.get(sessionId);
    
    // Create prompt for affidavit generation
    const affidavitPrompt = `Generate a formal legal affidavit with the following information:
    
State: ${affidavitData.state}
Case Type: ${affidavitData.caseType}
Affiant: ${affidavitData.affiantName}
Case Number: ${affidavitData.caseNumber}

Facts to include:
${affidavitData.facts.map((fact, i) => `${i + 1}. ${fact}`).join('\n')}

Format the affidavit with:
1. Proper heading with state and county
2. Case caption with case number
3. Title "AFFIDAVIT OF [NAME]"
4. Opening statement (I, [name], being duly sworn...)
5. Numbered facts in first person
6. Closing statement under penalty of perjury
7. Signature and notary blocks

Make it formal and legally appropriate.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'You are a legal document specialist. Generate formal, court-appropriate affidavits.' },
        { role: 'user', content: affidavitPrompt }
      ],
      temperature: 0.3,
    });

    const affidavitContent = completion.choices[0].message.content;

    // Generate HTML document
    const { generateAffidavitHTML } = require('./affidavitTemplate');
    const htmlContent = generateAffidavitHTML({
      ...affidavitData,
      content: affidavitContent,
      county: 'County Name', // You might want to collect this
      notaryDate: new Date().toLocaleDateString()
    });

    // Save to file
    const filename = `affidavit_${paymentInfo.orderReference}_${Date.now()}.html`;
    const filepath = path.join(__dirname, 'documents', filename);
    
    await fs.writeFile(filepath, htmlContent);

    // You could also generate PDF here using puppeteer
    
    res.json({
      success: true,
      filename: filename,
      downloadUrl: `/api/download/${filename}`
    });

  } catch (error) {
    console.error('Document generation error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate document'
    });
  }
});

// Download endpoint
app.get('/api/download/:filename', (req, res) => {
  const { filename } = req.params;
  const filepath = path.join(__dirname, 'documents', filename);
  
  // Security check - ensure filename is safe
  if (!filename.match(/^affidavit_[A-Z0-9\-]+_\d+\.html$/)) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  
  res.download(filepath, (err) => {
    if (err) {
      console.error('Download error:', err);
      res.status(404).json({ error: 'File not found' });
    }
  });
});

// Initialize payment routes
createPaymentRoutes(app, paymentProcessor);

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});