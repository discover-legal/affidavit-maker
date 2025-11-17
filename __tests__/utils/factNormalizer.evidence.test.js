// __tests__/utils/factNormalizer.evidence.test.js
/**
 * Tests for evidence functionality in factNormalizer
 */

const {
  normalizeFact,
  isEvidence,
  evidenceHasFile,
  getEvidenceItems,
  calculateExhibitLabels,
  createEvidencePlaceholder
} = require('../../utils/factNormalizer');

describe('factNormalizer - Evidence Functions', () => {
  describe('normalizeFact with evidence type', () => {
    test('should normalize evidence fact with all fields', () => {
      const evidenceFact = {
        content: 'I attach as Exhibit A my bank statement.',
        type: 'evidence',
        evidenceData: {
          exhibitLabel: 'A',
          description: 'Bank statement from Chase',
          fileName: 'bank_statement.pdf',
          fileKey: 'user123/doc456/evidence_abc.pdf',
          fileType: 'pdf',
          fileSizeBytes: 524288,
          filePages: 3,
          uploadedAt: '2025-01-15T10:00:00Z',
          thumbnailKey: 'user123/doc456/evidence_abc_thumb.jpg',
          requiresUpload: false
        }
      };

      const normalized = normalizeFact(evidenceFact);

      expect(normalized.type).toBe('evidence');
      expect(normalized.evidenceData).toBeDefined();
      expect(normalized.evidenceData.exhibitLabel).toBe('A');
      expect(normalized.evidenceData.fileName).toBe('bank_statement.pdf');
      expect(normalized.evidenceData.requiresUpload).toBe(false);
    });

    test('should normalize evidence placeholder without file', () => {
      const evidencePlaceholder = {
        content: 'I attach as Exhibit A my bank statement.',
        type: 'evidence',
        evidenceData: {
          description: 'Bank statement',
          requiresUpload: true
        }
      };

      const normalized = normalizeFact(evidencePlaceholder);

      expect(normalized.type).toBe('evidence');
      expect(normalized.evidenceData.requiresUpload).toBe(true);
      expect(normalized.evidenceData.fileKey).toBeNull();
    });

    test('should default to fact type if not specified', () => {
      const regularFact = {
        content: 'This is a regular fact.'
      };

      const normalized = normalizeFact(regularFact);

      expect(normalized.type).toBe('fact');
      expect(normalized.evidenceData).toBeUndefined();
    });
  });

  describe('isEvidence', () => {
    test('should return true for evidence type', () => {
      const evidence = {
        content: 'Evidence content',
        type: 'evidence',
        evidenceData: { description: 'Test' }
      };

      expect(isEvidence(evidence)).toBe(true);
    });

    test('should return false for fact type', () => {
      const fact = {
        content: 'Fact content',
        type: 'fact'
      };

      expect(isEvidence(fact)).toBe(false);
    });

    test('should return false for fact without type', () => {
      const fact = {
        content: 'Fact content'
      };

      expect(isEvidence(fact)).toBe(false);
    });
  });

  describe('evidenceHasFile', () => {
    test('should return true when file is uploaded', () => {
      const evidence = {
        type: 'evidence',
        evidenceData: {
          fileKey: 'user/doc/file.pdf',
          requiresUpload: false
        }
      };

      expect(evidenceHasFile(evidence)).toBe(true);
    });

    test('should return false when upload required', () => {
      const evidence = {
        type: 'evidence',
        evidenceData: {
          fileKey: null,
          requiresUpload: true
        }
      };

      expect(evidenceHasFile(evidence)).toBe(false);
    });

    test('should return false for non-evidence', () => {
      const fact = {
        type: 'fact',
        content: 'Regular fact'
      };

      expect(evidenceHasFile(fact)).toBe(false);
    });
  });

  describe('getEvidenceItems', () => {
    test('should extract only evidence items', () => {
      const facts = [
        { content: 'Fact 1', type: 'fact' },
        { content: 'Evidence 1', type: 'evidence', evidenceData: {} },
        { content: 'Fact 2', type: 'fact' },
        { content: 'Evidence 2', type: 'evidence', evidenceData: {} }
      ];

      const evidenceItems = getEvidenceItems(facts);

      expect(evidenceItems).toHaveLength(2);
      expect(evidenceItems[0].type).toBe('evidence');
      expect(evidenceItems[1].type).toBe('evidence');
    });

    test('should return empty array when no evidence', () => {
      const facts = [
        { content: 'Fact 1', type: 'fact' },
        { content: 'Fact 2', type: 'fact' }
      ];

      const evidenceItems = getEvidenceItems(facts);

      expect(evidenceItems).toHaveLength(0);
    });
  });

  describe('calculateExhibitLabels', () => {
    test('should calculate letter labels (A, B, C...)', () => {
      const facts = [
        { content: 'Fact 1', type: 'fact' },
        { content: 'Evidence 1', type: 'evidence', evidenceData: {} },
        { content: 'Fact 2', type: 'fact' },
        { content: 'Evidence 2', type: 'evidence', evidenceData: {} },
        { content: 'Evidence 3', type: 'evidence', evidenceData: {} }
      ];

      const updated = calculateExhibitLabels(facts, { style: 'letters' });

      const evidenceItems = updated.filter(f => f.type === 'evidence');
      expect(evidenceItems[0].evidenceData.exhibitLabel).toBe('A');
      expect(evidenceItems[1].evidenceData.exhibitLabel).toBe('B');
      expect(evidenceItems[2].evidenceData.exhibitLabel).toBe('C');
    });

    test('should calculate number labels (1, 2, 3...)', () => {
      const facts = [
        { content: 'Evidence 1', type: 'evidence', evidenceData: {} },
        { content: 'Fact 1', type: 'fact' },
        { content: 'Evidence 2', type: 'evidence', evidenceData: {} }
      ];

      const updated = calculateExhibitLabels(facts, { style: 'numbers' });

      const evidenceItems = updated.filter(f => f.type === 'evidence');
      expect(evidenceItems[0].evidenceData.exhibitLabel).toBe('1');
      expect(evidenceItems[1].evidenceData.exhibitLabel).toBe('2');
    });

    test('should preserve fact items unchanged', () => {
      const facts = [
        { content: 'Fact 1', type: 'fact', category: 'general' },
        { content: 'Evidence 1', type: 'evidence', evidenceData: {} }
      ];

      const updated = calculateExhibitLabels(facts);

      expect(updated[0].type).toBe('fact');
      expect(updated[0].category).toBe('general');
      expect(updated[0].evidenceData).toBeUndefined();
    });
  });

  describe('createEvidencePlaceholder', () => {
    test('should create evidence placeholder with description', () => {
      const placeholder = createEvidencePlaceholder({
        description: 'Bank statement from January 2025'
      });

      expect(placeholder.type).toBe('evidence');
      expect(placeholder.category).toBe('evidence');
      expect(placeholder.evidenceData.description).toBe('Bank statement from January 2025');
      expect(placeholder.evidenceData.requiresUpload).toBe(true);
      expect(placeholder.evidenceData.fileKey).toBeNull();
      expect(placeholder.content).toContain('Exhibit [TBD]');
    });

    test('should create evidence placeholder with custom content', () => {
      const placeholder = createEvidencePlaceholder({
        description: 'Tax return',
        content: 'I attach as Exhibit A my 2024 tax return.'
      });

      expect(placeholder.type).toBe('evidence');
      expect(placeholder.content).toBe('I attach as Exhibit A my 2024 tax return.');
      expect(placeholder.originalContent).toBe('I attach as Exhibit A my 2024 tax return.');
    });

    test('should create empty placeholder', () => {
      const placeholder = createEvidencePlaceholder();

      expect(placeholder.type).toBe('evidence');
      expect(placeholder.evidenceData.requiresUpload).toBe(true);
      expect(placeholder.evidenceData.description).toBe('');
    });
  });
});
