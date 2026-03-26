'use strict';

/**
 * DocumentIngestionService
 *
 * Pipeline for respondent path: parse uploaded PDF → classify via LLM →
 * extract structured data → calculate response deadline → build case profile.
 */

const pdfParse = require('pdf-parse');
const logger = require('../utils/logger');
const documentSelectionAgent = require('./agents/DocumentSelectionAgent');

// ─── Response deadline lookup (days from service) ────────────────────────────
// Sources: state civil procedure rules for each document type.
// '*' is the fallback when no state-specific rule is registered.

const RESPONSE_DEADLINES = {
  TX: { divorce_petition: 20, civil_complaint: 20, small_claims_complaint: 14, eviction_notice: 5, debt_collection_complaint: 20 },
  CA: { divorce_petition: 30, civil_complaint: 30, small_claims_complaint: 15, eviction_notice: 5, debt_collection_complaint: 30 },
  FL: { divorce_petition: 20, civil_complaint: 20, small_claims_complaint: 5, eviction_notice: 5, debt_collection_complaint: 20 },
  NY: { divorce_petition: 20, civil_complaint: 20, small_claims_complaint: 20, eviction_notice: 10, debt_collection_complaint: 20 },
  IL: { divorce_petition: 30, civil_complaint: 30, small_claims_complaint: 14, eviction_notice: 7, debt_collection_complaint: 30 },
  AZ: { divorce_petition: 20, civil_complaint: 20, small_claims_complaint: 10, eviction_notice: 5, debt_collection_complaint: 20 },
  UT: { divorce_petition: 21, civil_complaint: 21, small_claims_complaint: 10, eviction_notice: 3, debt_collection_complaint: 21 },
  CO: { divorce_petition: 21, civil_complaint: 21, small_claims_complaint: 14, debt_collection_complaint: 21 },
  GA: { divorce_petition: 30, civil_complaint: 30, small_claims_complaint: 30, debt_collection_complaint: 30 },
  MA: { divorce_petition: 20, civil_complaint: 20, small_claims_complaint: 20, debt_collection_complaint: 20 },
  MI: { divorce_petition: 21, civil_complaint: 21, small_claims_complaint: 14, debt_collection_complaint: 21 },
  NC: { divorce_petition: 30, civil_complaint: 30, small_claims_complaint: 20, debt_collection_complaint: 30 },
  NJ: { divorce_petition: 35, civil_complaint: 35, small_claims_complaint: 15, debt_collection_complaint: 35 },
  OH: { divorce_petition: 28, civil_complaint: 28, small_claims_complaint: 28, debt_collection_complaint: 28 },
  PA: { divorce_petition: 20, civil_complaint: 20, small_claims_complaint: 10, debt_collection_complaint: 20 },
  VA: { divorce_petition: 21, civil_complaint: 21, small_claims_complaint: 10, debt_collection_complaint: 21 },
  WA: { divorce_petition: 20, civil_complaint: 20, small_claims_complaint: 14, debt_collection_complaint: 20 },
  IN: { divorce_petition: 20, civil_complaint: 20, small_claims_complaint: 14, debt_collection_complaint: 20 },
  TN: { divorce_petition: 30, civil_complaint: 30, small_claims_complaint: 15, debt_collection_complaint: 30 },
  MO: { divorce_petition: 30, civil_complaint: 30, small_claims_complaint: 15, debt_collection_complaint: 30 },
  MD: { divorce_petition: 30, civil_complaint: 30, small_claims_complaint: 15, debt_collection_complaint: 30 },
  MN: { divorce_petition: 30, civil_complaint: 30, small_claims_complaint: 20, debt_collection_complaint: 30 },
  KY: { divorce_petition: 20, civil_complaint: 20, small_claims_complaint: 20, debt_collection_complaint: 20 },
  WI: { divorce_petition: 20, civil_complaint: 20, small_claims_complaint: 15, debt_collection_complaint: 20 },
  SC: { divorce_petition: 30, civil_complaint: 30, small_claims_complaint: 30, debt_collection_complaint: 30 },
  AL: { divorce_petition: 30, civil_complaint: 30, small_claims_complaint: 14, debt_collection_complaint: 30 },
  OR: { divorce_petition: 30, civil_complaint: 30, small_claims_complaint: 14, debt_collection_complaint: 30 },
  OK: { divorce_petition: 20, civil_complaint: 20, small_claims_complaint: 10, debt_collection_complaint: 20 },
  LA: { divorce_petition: 15, civil_complaint: 21, small_claims_complaint: 10, debt_collection_complaint: 21 },
  CT: { divorce_petition: 30, civil_complaint: 30, small_claims_complaint: 15, debt_collection_complaint: 30 },
  NV: { divorce_petition: 20, civil_complaint: 20, small_claims_complaint: 20, debt_collection_complaint: 20 },
  NM: { divorce_petition: 30, civil_complaint: 30, small_claims_complaint: 15, debt_collection_complaint: 30 },
  ID: { divorce_petition: 21, civil_complaint: 21, small_claims_complaint: 14, debt_collection_complaint: 21 },
  AK: { divorce_petition: 20, civil_complaint: 20, small_claims_complaint: 20, debt_collection_complaint: 20 },
  AR: { divorce_petition: 30, civil_complaint: 30, small_claims_complaint: 30, debt_collection_complaint: 30 },
  DC: { divorce_petition: 21, civil_complaint: 21, small_claims_complaint: 21, debt_collection_complaint: 21 },
  DE: { divorce_petition: 20, civil_complaint: 20, small_claims_complaint: 15, debt_collection_complaint: 20 },
  HI: { divorce_petition: 20, civil_complaint: 20, small_claims_complaint: 20, debt_collection_complaint: 20 },
  IA: { divorce_petition: 20, civil_complaint: 20, small_claims_complaint: 20, debt_collection_complaint: 20 },
  KS: { divorce_petition: 21, civil_complaint: 21, small_claims_complaint: 14, debt_collection_complaint: 21 },
  ME: { divorce_petition: 20, civil_complaint: 20, small_claims_complaint: 14, debt_collection_complaint: 20 },
  MS: { divorce_petition: 30, civil_complaint: 30, small_claims_complaint: 30, debt_collection_complaint: 30 },
  MT: { divorce_petition: 21, civil_complaint: 21, small_claims_complaint: 14, debt_collection_complaint: 21 },
  ND: { divorce_petition: 21, civil_complaint: 21, small_claims_complaint: 21, debt_collection_complaint: 21 },
  NE: { divorce_petition: 30, civil_complaint: 30, small_claims_complaint: 30, debt_collection_complaint: 30 },
  NH: { divorce_petition: 30, civil_complaint: 30, small_claims_complaint: 30, debt_collection_complaint: 30 },
  RI: { divorce_petition: 20, civil_complaint: 20, small_claims_complaint: 10, debt_collection_complaint: 20 },
  SD: { divorce_petition: 30, civil_complaint: 30, small_claims_complaint: 30, debt_collection_complaint: 30 },
  VT: { divorce_petition: 21, civil_complaint: 21, small_claims_complaint: 14, debt_collection_complaint: 21 },
  WV: { divorce_petition: 20, civil_complaint: 20, small_claims_complaint: 20, debt_collection_complaint: 20 },
  WY: { divorce_petition: 20, civil_complaint: 20, small_claims_complaint: 10, debt_collection_complaint: 20 },
  // Canadian provinces/territories — Rules of Civil Procedure
  ON: { divorce_petition: 30, civil_complaint: 20 },
  BC: { divorce_petition: 30, civil_complaint: 21 },
  AB: { divorce_petition: 20, civil_complaint: 20 },
  QC: { divorce_petition: 15, civil_complaint: 15 },
  MB: { divorce_petition: 20, civil_complaint: 20 },
  NB: { divorce_petition: 20, civil_complaint: 20 },
  NL: { divorce_petition: 30, civil_complaint: 30 },
  NS: { divorce_petition: 20, civil_complaint: 20 },
  PE: { divorce_petition: 20, civil_complaint: 20 },
  SK: { divorce_petition: 20, civil_complaint: 20 },
  NT: { divorce_petition: 15, civil_complaint: 15 },
  YT: { divorce_petition: 30, civil_complaint: 30 },
  NU: { divorce_petition: 20, civil_complaint: 20 },
  // Fallback
  '*': { divorce_petition: 30, civil_complaint: 30, small_claims_complaint: 14, custody_petition: 30, child_support_petition: 30, dvro_petition: 5, eviction_notice: 5, debt_collection_complaint: 30, court_order: 10 }
};

// ─── Document type → matter type mapping ─────────────────────────────────────

const DOC_CLASS_TO_MATTER = {
  divorce_petition: 'divorce',
  custody_petition: 'custody',
  child_support_petition: 'child_support',
  dvro_petition: 'dvro',
  small_claims_complaint: 'small_claims',
  civil_complaint: 'general_civil',
  eviction_notice: 'landlord_tenant',
  debt_collection_complaint: 'debt_defense',
  court_order: 'general_civil',
  demand_letter: 'general_civil',
  summons: 'general_civil'
};

// ─── Document type → response documents ──────────────────────────────────────

const RESPONSE_DOC_MAP = {
  divorce_petition:          [{ code: 'divorce_response',    reason: 'Your formal response to the divorce petition' },
                              { code: 'financial_disclosure', reason: 'Required financial disclosure for the court' }],
  custody_petition:          [{ code: 'custody_response',    reason: 'Your response to the custody petition' },
                              { code: 'parenting_plan',       reason: 'Your proposed parenting plan' }],
  child_support_petition:    [{ code: 'support_response',    reason: 'Your response to the child support petition' },
                              { code: 'income_declaration',   reason: 'Required income and expense declaration' }],
  dvro_petition:             [{ code: 'dvro_response',       reason: 'Your response to the restraining order petition' }],
  small_claims_complaint:    [{ code: 'small_claims_answer', reason: 'Your answer to the small claims complaint' }],
  civil_complaint:           [{ code: 'civil_answer',        reason: 'Your answer to the civil complaint' }],
  eviction_notice:           [{ code: 'ud_answer',           reason: 'Your answer to the unlawful detainer/eviction' }],
  debt_collection_complaint: [{ code: 'debt_answer',         reason: 'Your answer to the debt collection complaint' }]
};

// ─── LLM tool definition for classification + extraction ─────────────────────

const CLASSIFY_TOOL = {
  type: 'function',
  function: {
    name: 'analyze_legal_document',
    description: 'Classify a legal document and extract structured data from it.',
    parameters: {
      type: 'object',
      required: ['document_type', 'confidence'],
      properties: {
        document_type: {
          type: 'string',
          enum: ['divorce_petition', 'custody_petition', 'summons', 'court_order',
            'demand_letter', 'small_claims_complaint', 'civil_complaint',
            'dvro_petition', 'child_support_petition', 'eviction_notice',
            'debt_collection_complaint', 'unknown']
        },
        confidence: { type: 'number', description: '0-1 confidence score' },
        petitioner_name: { type: 'string' },
        respondent_name: { type: 'string' },
        court_name: { type: 'string' },
        case_number: { type: 'string' },
        state: { type: 'string', description: '2-letter state/province code' },
        county: { type: 'string' },
        filing_date: { type: 'string', description: 'ISO date or descriptive' },
        service_date: { type: 'string', description: 'ISO date if found' },
        claims: { type: 'array', items: { type: 'string' }, description: 'Legal claims or causes of action' },
        relief_requested: { type: 'array', items: { type: 'string' }, description: 'What the petitioner is asking for' },
        children: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              age: { type: 'number' },
              dob: { type: 'string' }
            }
          }
        },
        monetary_amounts: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              description: { type: 'string' },
              amount: { type: 'number' }
            }
          }
        },
        response_deadline_stated: { type: 'string', description: 'Deadline stated in the document, if any' },
        grounds: { type: 'array', items: { type: 'string' }, description: 'Legal grounds cited' },
        property_described: { type: 'array', items: { type: 'string' }, description: 'Property or assets mentioned' }
      }
    }
  }
};

const CLASSIFIER_PROMPT = `You are a legal document analysis expert. Analyze the following legal document text and extract all structured information you can find.

IMPORTANT RULES:
1. Identify the document type from the enumerated list. If you cannot determine the type, use "unknown".
2. Extract ALL party names, dates, case numbers, court names, and jurisdictions found in the text.
3. For state, return the 2-letter code (e.g., TX, CA, NY). Look for the court name, address, or explicit state references.
4. Extract any claims, grounds, relief requested, children mentioned, and monetary amounts.
5. Look for response deadlines stated in the document text.
6. Be conservative with confidence — use 0.9+ only when the document type is unambiguous.
7. If the text is too short or garbled (scanned image with bad OCR), set confidence below 0.3.

DOCUMENT TEXT:
`;

class DocumentIngestionService {
  constructor() {
    this.openAIService = null;
  }

  /**
   * Lazily get the LLM service (set during server init).
   */
  _getOpenAI() {
    if (!this.openAIService) {
      this.openAIService = global.openAIService;
    }
    if (!this.openAIService) {
      throw new Error('LLM service not available');
    }
    return this.openAIService;
  }

  // ─── 1. PDF text extraction ──────────────────────────────────────────────────

  async extractText(buffer) {
    try {
      const data = await pdfParse(buffer);
      let text = (data.text || '').trim();
      const pages = data.numpages || 1;

      if (text.length < 50) {
        // Secondary extraction attempt — parse all pages explicitly
        try {
          const retryData = await pdfParse(buffer, { max: 0 });
          const retryText = (retryData.text || '').trim();
          if (retryText.length > text.length) {
            text = retryText;
          }
        } catch (retryErr) {
          logger.warn('Secondary PDF extraction attempt failed', { error: retryErr.message });
        }
      }

      if (text.length < 50) {
        // PDF has pages but no extractable text — likely a scanned document
        if (pages > 0) {
          logger.info('Scanned PDF detected — OCR required', { pages, extractedLength: text.length });
          return {
            success: true,
            ocrRequired: true,
            text: text || '',
            pages,
            message: 'This appears to be a scanned document. Please enter the document details manually or upload a text-based PDF.'
          };
        }

        return {
          success: false,
          error: 'This PDF appears to be empty or unreadable. Please upload a different file.',
          text: '',
          pages
        };
      }

      return { success: true, text, pages };
    } catch (err) {
      logger.error('PDF parse failed', { error: err.message });
      return {
        success: false,
        error: 'Failed to read this PDF. The file may be corrupted or password-protected.',
        text: '',
        pages: 0
      };
    }
  }

  // ─── 2. LLM classification + extraction ──────────────────────────────────────

  async classifyAndExtract(text) {
    const openAI = this._getOpenAI();

    // Truncate to ~12K chars (~3K tokens) to stay well within context
    const truncated = text.length > 12000 ? text.slice(0, 12000) + '\n[...truncated]' : text;

    const messages = [
      { role: 'system', content: CLASSIFIER_PROMPT + truncated }
    ];

    const completion = await openAI.chat(messages, {
      model: process.env.LLM_MODEL || 'gpt-4o-2024-08-06',
      tools: [CLASSIFY_TOOL],
      tool_choice: { type: 'function', function: { name: 'analyze_legal_document' } },
      temperature: 0.1,
      max_tokens: 1500
    });

    const toolCall = completion.choices[0].message.tool_calls?.[0];
    if (!toolCall) {
      throw new Error('LLM did not return a classification result');
    }

    let result;
    try {
      result = JSON.parse(toolCall.function.arguments);
    } catch (parseErr) {
      logger.error('Failed to parse LLM tool call arguments', {
        error: parseErr.message,
        raw: toolCall.function.arguments
      });
      throw new Error('LLM returned malformed classification data — could not parse response');
    }

    return {
      documentClass: result.document_type,
      confidence: result.confidence || 0.5,
      extractedData: result
    };
  }

  // ─── 3. Deadline calculation (deterministic) ─────────────────────────────────

  calculateDeadline(stateCode, docClass, serviceDate) {
    if (!serviceDate) {
      return { deadline: null, source: 'Service date required to calculate deadline' };
    }

    const state = (stateCode || '').toUpperCase();
    const deadlines = RESPONSE_DEADLINES[state] || RESPONSE_DEADLINES['*'];
    const days = deadlines[docClass] || deadlines['civil_complaint'] || 30;

    // Parse as local date parts to avoid UTC/local timezone shift
    const parts = String(serviceDate).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (!parts) {
      return { deadline: null, source: 'Invalid service date' };
    }

    const sDate = new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]));
    if (isNaN(sDate.getTime())) {
      return { deadline: null, source: 'Invalid service date' };
    }

    const deadline = new Date(sDate);
    deadline.setDate(deadline.getDate() + days);

    // Find the rule source
    const ruleKey = RESPONSE_DEADLINES[state] ? state : 'default';
    const source = `${ruleKey === 'default' ? 'Default' : state} Rules: ${days} days from service`;

    // Format as YYYY-MM-DD using local date parts (avoids UTC shift)
    const yyyy = deadline.getFullYear();
    const mm = String(deadline.getMonth() + 1).padStart(2, '0');
    const dd = String(deadline.getDate()).padStart(2, '0');

    return {
      deadline: `${yyyy}-${mm}-${dd}`,
      source,
      days
    };
  }

  // ─── 4. Build case profile (role-inverted) ───────────────────────────────────

  buildCaseProfile(extractedData) {
    const docType = extractedData.document_type || 'unknown';
    const matterType = DOC_CLASS_TO_MATTER[docType] || 'general_civil';

    // Split names into first/last
    const splitName = (fullName) => {
      if (!fullName) return { first: null, last: null };
      const parts = fullName.trim().split(/\s+/);
      return {
        first: parts[0] || null,
        last: parts.slice(1).join(' ') || null
      };
    };

    const petitioner = splitName(extractedData.petitioner_name);
    const respondent = splitName(extractedData.respondent_name);

    return {
      practice_area: matterType === 'divorce' || matterType === 'custody' || matterType === 'child_support' || matterType === 'dvro' ? 'family' : 'civil',
      matter_type_code: 'document_response',
      original_matter_type: matterType,
      state: extractedData.state || null,
      county: extractedData.county || null,
      court_name: extractedData.court_name || null,
      cause_number: extractedData.case_number || null,
      // ROLE INVERSION: their petitioner is our user's opponent
      petitioner_first_name: petitioner.first,
      petitioner_last_name: petitioner.last,
      // User is respondent — left blank for them to fill
      respondent_first_name: respondent.first,
      respondent_last_name: respondent.last,
      children: extractedData.children || [],
      case_metadata: {
        ingested_document_class: docType,
        claims_against: extractedData.claims || [],
        relief_requested: extractedData.relief_requested || [],
        grounds: extractedData.grounds || [],
        monetary_amounts: extractedData.monetary_amounts || [],
        property_described: extractedData.property_described || [],
        filing_date: extractedData.filing_date || null,
        response_deadline_stated: extractedData.response_deadline_stated || null
      }
    };
  }

  // ─── 5. Select response documents ────────────────────────────────────────────

  selectResponseDocs(extractedData) {
    const docType = extractedData.document_type || 'unknown';
    const mapped = RESPONSE_DOC_MAP[docType];

    if (mapped) {
      return {
        documents: mapped.map(d => ({ code: d.code, display_name: d.code.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()), reason: d.reason })),
        source: 'standard_mapping'
      };
    }

    // Fallback: delegate to DocumentSelectionAgent
    const matterType = DOC_CLASS_TO_MATTER[docType] || 'general_civil';
    const result = documentSelectionAgent.select(
      { state: extractedData.state || 'TX' },
      matterType
    );

    return {
      documents: result.requiredDocuments.map(code => ({
        code,
        display_name: code.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        reason: result.selectionReasons[code] || 'Suggested based on your matter type'
      })),
      source: 'document_selection_agent'
    };
  }

  // ─── 6. Full pipeline ────────────────────────────────────────────────────────

  async processDocument(buffer, fileName, userId) {
    logger.info('DocumentIngestionService: starting pipeline', { fileName, userId });

    // Step 1: Extract text
    const textResult = await this.extractText(buffer);
    if (!textResult.success) {
      return {
        success: false,
        status: 'error',
        error: textResult.error,
        pages: textResult.pages
      };
    }

    // Step 1b: Handle scanned PDFs that need OCR
    if (textResult.ocrRequired) {
      logger.info('DocumentIngestionService: scanned PDF — returning partial result for manual entry', { fileName });
      return {
        success: true,
        status: 'ocr_required',
        ocrRequired: true,
        pages: textResult.pages,
        rawText: textResult.text,
        message: textResult.message,
        documentClass: null,
        confidence: 0,
        extractedData: {},
        deadline: null,
        deadlineSource: null,
        deadlineDays: null,
        serviceDate: null,
        caseProfile: null,
        suggestedDocuments: []
      };
    }

    // Step 2: Classify + extract
    let classification;
    try {
      classification = await this.classifyAndExtract(textResult.text);
    } catch (err) {
      logger.error('Classification failed', { error: err.message, fileName });
      return {
        success: false,
        status: 'error',
        error: 'Failed to analyze the document. Please try again.',
        pages: textResult.pages,
        rawText: textResult.text
      };
    }

    // Step 3: Calculate deadline (if service date found in document)
    const serviceDate = classification.extractedData.service_date || null;
    const deadlineResult = this.calculateDeadline(
      classification.extractedData.state,
      classification.documentClass,
      serviceDate
    );

    // Step 4: Build case profile
    const caseProfile = this.buildCaseProfile(classification.extractedData);

    // Step 5: Select response documents
    const responseDocs = this.selectResponseDocs(classification.extractedData);

    logger.info('DocumentIngestionService: pipeline complete', {
      fileName,
      documentClass: classification.documentClass,
      confidence: classification.confidence,
      state: classification.extractedData.state,
      responseDocs: responseDocs.documents.length
    });

    return {
      success: true,
      status: 'parsed',
      pages: textResult.pages,
      rawText: textResult.text,
      documentClass: classification.documentClass,
      confidence: classification.confidence,
      extractedData: classification.extractedData,
      deadline: deadlineResult.deadline,
      deadlineSource: deadlineResult.source,
      deadlineDays: deadlineResult.days,
      serviceDate,
      caseProfile,
      suggestedDocuments: responseDocs.documents
    };
  }
}

module.exports = new DocumentIngestionService();
