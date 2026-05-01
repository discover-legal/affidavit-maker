'use strict';

const DocumentIngestionService = require('../../services/DocumentIngestionService');

// ─── extractText ─────────────────────────────────────────────────────────────

describe('DocumentIngestionService', () => {
  describe('extractText', () => {
    it('returns error for non-PDF buffers', async () => {
      const result = await DocumentIngestionService.extractText(Buffer.from('not a pdf'));
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('returns error for empty buffer', async () => {
      const result = await DocumentIngestionService.extractText(Buffer.alloc(0));
      expect(result.success).toBe(false);
    });
  });

  // ─── calculateDeadline ─────────────────────────────────────────────────────

  describe('calculateDeadline', () => {
    it('calculates TX divorce deadline as 20 days', () => {
      const result = DocumentIngestionService.calculateDeadline('TX', 'divorce_petition', '2026-03-01');
      expect(result.deadline).toBe('2026-03-21');
      expect(result.days).toBe(20);
      expect(result.source).toContain('TX');
    });

    it('calculates CA divorce deadline as 30 days', () => {
      const result = DocumentIngestionService.calculateDeadline('CA', 'divorce_petition', '2026-03-01');
      expect(result.deadline).toBe('2026-03-31');
      expect(result.days).toBe(30);
    });

    it('calculates NJ civil complaint deadline as 35 days', () => {
      const result = DocumentIngestionService.calculateDeadline('NJ', 'civil_complaint', '2026-01-01');
      expect(result.deadline).toBe('2026-02-05');
      expect(result.days).toBe(35);
    });

    it('uses fallback for unknown state', () => {
      const result = DocumentIngestionService.calculateDeadline('XX', 'divorce_petition', '2026-03-01');
      expect(result.deadline).toBe('2026-03-31');
      expect(result.days).toBe(30);
      expect(result.source).toContain('Default');
    });

    it('returns null deadline when no service date', () => {
      const result = DocumentIngestionService.calculateDeadline('TX', 'divorce_petition', null);
      expect(result.deadline).toBeNull();
      expect(result.source).toContain('Service date required');
    });

    it('returns null deadline for invalid service date', () => {
      const result = DocumentIngestionService.calculateDeadline('TX', 'divorce_petition', 'not-a-date');
      expect(result.deadline).toBeNull();
      expect(result.source).toContain('Invalid');
    });

    it('handles UT 21-day deadline', () => {
      const result = DocumentIngestionService.calculateDeadline('UT', 'divorce_petition', '2026-06-01');
      expect(result.deadline).toBe('2026-06-22');
      expect(result.days).toBe(21);
    });

    it('handles LA 15-day divorce deadline', () => {
      const result = DocumentIngestionService.calculateDeadline('LA', 'divorce_petition', '2026-03-01');
      expect(result.deadline).toBe('2026-03-16');
      expect(result.days).toBe(15);
    });
  });

  // ─── buildCaseProfile ──────────────────────────────────────────────────────

  describe('buildCaseProfile', () => {
    it('inverts roles correctly', () => {
      const profile = DocumentIngestionService.buildCaseProfile({
        document_type: 'divorce_petition',
        petitioner_name: 'Jane Smith',
        respondent_name: 'John Doe',
        state: 'TX',
        county: 'Harris',
        case_number: '2026-FAM-12345',
        court_name: 'Harris County District Court'
      });

      expect(profile.matter_type_code).toBe('document_response');
      expect(profile.original_matter_type).toBe('divorce');
      expect(profile.practice_area).toBe('family');
      expect(profile.petitioner_first_name).toBe('Jane');
      expect(profile.petitioner_last_name).toBe('Smith');
      expect(profile.respondent_first_name).toBe('John');
      expect(profile.respondent_last_name).toBe('Doe');
      expect(profile.state).toBe('TX');
      expect(profile.county).toBe('Harris');
      expect(profile.cause_number).toBe('2026-FAM-12345');
    });

    it('maps debt_collection_complaint to debt_defense', () => {
      const profile = DocumentIngestionService.buildCaseProfile({
        document_type: 'debt_collection_complaint',
        state: 'FL'
      });
      expect(profile.original_matter_type).toBe('debt_defense');
      expect(profile.practice_area).toBe('civil');
    });

    it('maps eviction_notice to landlord_tenant', () => {
      const profile = DocumentIngestionService.buildCaseProfile({
        document_type: 'eviction_notice',
        state: 'NY'
      });
      expect(profile.original_matter_type).toBe('landlord_tenant');
      expect(profile.practice_area).toBe('civil');
    });

    it('stores claims and relief in case_metadata', () => {
      const profile = DocumentIngestionService.buildCaseProfile({
        document_type: 'civil_complaint',
        claims: ['breach of contract', 'fraud'],
        relief_requested: ['$50,000 damages'],
        monetary_amounts: [{ description: 'damages', amount: 50000 }]
      });
      expect(profile.case_metadata.claims_against).toEqual(['breach of contract', 'fraud']);
      expect(profile.case_metadata.relief_requested).toEqual(['$50,000 damages']);
      expect(profile.case_metadata.monetary_amounts).toHaveLength(1);
    });

    it('handles missing names gracefully', () => {
      const profile = DocumentIngestionService.buildCaseProfile({
        document_type: 'unknown'
      });
      expect(profile.petitioner_first_name).toBeNull();
      expect(profile.respondent_first_name).toBeNull();
      expect(profile.original_matter_type).toBe('general_civil');
    });
  });

  // ─── selectResponseDocs ────────────────────────────────────────────────────

  describe('selectResponseDocs', () => {
    it('returns divorce_response for divorce_petition', () => {
      const result = DocumentIngestionService.selectResponseDocs({
        document_type: 'divorce_petition'
      });
      expect(result.documents).toHaveLength(2);
      expect(result.documents[0].code).toBe('divorce_response');
      expect(result.documents[1].code).toBe('financial_disclosure');
    });

    it('returns debt_answer for debt_collection_complaint', () => {
      const result = DocumentIngestionService.selectResponseDocs({
        document_type: 'debt_collection_complaint'
      });
      expect(result.documents).toHaveLength(1);
      expect(result.documents[0].code).toBe('debt_answer');
    });

    it('returns ud_answer for eviction_notice', () => {
      const result = DocumentIngestionService.selectResponseDocs({
        document_type: 'eviction_notice'
      });
      expect(result.documents[0].code).toBe('ud_answer');
    });

    it('returns small_claims_answer for small_claims_complaint', () => {
      const result = DocumentIngestionService.selectResponseDocs({
        document_type: 'small_claims_complaint'
      });
      expect(result.documents[0].code).toBe('small_claims_answer');
    });

    it('falls back to DocumentSelectionAgent for unknown types', () => {
      const result = DocumentIngestionService.selectResponseDocs({
        document_type: 'unknown',
        state: 'TX'
      });
      expect(result.documents.length).toBeGreaterThan(0);
      expect(result.source).toBe('document_selection_agent');
    });
  });
});
