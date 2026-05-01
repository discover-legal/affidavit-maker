'use strict';

/**
 * Ingestion route tests.
 *
 * These test the route handler logic without a real database or LLM.
 * Integration tests with actual PDF upload would require a running server.
 */

const DocumentIngestionService = require('../../services/DocumentIngestionService');

describe('Ingest route prerequisites', () => {
  it('DocumentIngestionService exports a singleton', () => {
    expect(DocumentIngestionService).toBeDefined();
    expect(typeof DocumentIngestionService.extractText).toBe('function');
    expect(typeof DocumentIngestionService.classifyAndExtract).toBe('function');
    expect(typeof DocumentIngestionService.calculateDeadline).toBe('function');
    expect(typeof DocumentIngestionService.buildCaseProfile).toBe('function');
    expect(typeof DocumentIngestionService.selectResponseDocs).toBe('function');
    expect(typeof DocumentIngestionService.processDocument).toBe('function');
  });

  it('ingest route module exports a router', () => {
    // This verifies the route file loads without errors
    const router = require('../../routes/ingest');
    expect(router).toBeDefined();
    expect(typeof router).toBe('function'); // Express router is a function
  });

  it('DocumentIngestionOrchestrator loads without errors', () => {
    const orchestrator = require('../../services/agents/DocumentIngestionOrchestrator');
    expect(orchestrator).toBeDefined();
    expect(orchestrator.matterTypeCode).toBe('document_response');
    expect(orchestrator.practiceArea).toBe('utility');
    expect(orchestrator.phaseOrder).toEqual(['REVIEW_EXTRACTION', 'FILL_GAPS', 'RESPONSE_SELECTION', 'REVIEW']);
  });
});

describe('Ingestion prompts', () => {
  const { PHASES, PHASE_ORDER, FIELD_MAP, buildTool } = require('../../services/agents/prompts/ingestion/index');

  it('defines all 4 phases', () => {
    expect(PHASE_ORDER).toHaveLength(4);
    expect(PHASE_ORDER).toEqual(['REVIEW_EXTRACTION', 'FILL_GAPS', 'RESPONSE_SELECTION', 'REVIEW']);

    for (const phase of PHASE_ORDER) {
      expect(PHASES[phase]).toBeDefined();
      expect(PHASES[phase].prompt).toBeTruthy();
      expect(PHASES[phase].displayName).toBeTruthy();
    }
  });

  it('FIELD_MAP maps all expected fields', () => {
    expect(FIELD_MAP.respondent_first_name).toBe('respondentFirstName');
    expect(FIELD_MAP.respondent_last_name).toBe('respondentLastName');
    expect(FIELD_MAP.service_date).toBe('serviceDate');
    expect(FIELD_MAP.user_confirmed_extraction).toBe('userConfirmedExtraction');
    expect(FIELD_MAP.user_confirmed_documents).toBe('userConfirmedDocuments');
    expect(FIELD_MAP.user_confirmed_review).toBe('userConfirmedReview');
  });

  it('buildTool returns valid OpenAI tool definition', () => {
    const tool = buildTool();
    expect(tool.type).toBe('function');
    expect(tool.function.name).toBe('process_matter_data');
    expect(tool.function.parameters.required).toContain('response');
    expect(tool.function.parameters.required).toContain('phase_complete');
    expect(tool.function.parameters.properties.respondent_first_name).toBeDefined();
    expect(tool.function.parameters.properties.user_confirmed_extraction).toBeDefined();
  });
});

describe('DocumentSelectionAgent document_response handler', () => {
  const agent = require('../../services/agents/DocumentSelectionAgent');

  it('returns divorce_response for ingested divorce_petition', () => {
    const result = agent.select({
      state: 'TX',
      case_metadata: { ingested_document_class: 'divorce_petition' }
    }, 'document_response');

    expect(result.requiredDocuments).toContain('divorce_response');
    expect(result.requiredDocuments).toContain('financial_disclosure');
  });

  it('returns debt_answer for ingested debt_collection_complaint', () => {
    const result = agent.select({
      state: 'CA',
      case_metadata: { ingested_document_class: 'debt_collection_complaint' }
    }, 'document_response');

    expect(result.requiredDocuments).toContain('debt_answer');
  });

  it('returns ud_answer for ingested eviction_notice', () => {
    const result = agent.select({
      state: 'NY',
      case_metadata: { ingested_document_class: 'eviction_notice' }
    }, 'document_response');

    expect(result.requiredDocuments).toContain('ud_answer');
  });

  it('includes indigency_affidavit when requested', () => {
    const result = agent.select({
      state: 'TX',
      case_metadata: { ingested_document_class: 'divorce_petition' },
      indigencyRequested: true
    }, 'document_response');

    expect(result.requiredDocuments).toContain('indigency_affidavit');
  });

  it('falls back to civil_answer for unknown document class', () => {
    const result = agent.select({
      state: 'TX',
      case_metadata: { ingested_document_class: '' }
    }, 'document_response');

    expect(result.requiredDocuments).toContain('civil_answer');
  });
});
