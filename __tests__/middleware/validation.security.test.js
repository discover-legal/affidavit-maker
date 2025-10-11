// __tests__/middleware/validation.security.test.js - Test the validation middleware directly
const { body, validationResult } = require('express-validator');

// Import the actual validation
const { validatePayment } = require('../../middleware/validation');

describe('Payment Validation Security', () => {
  // Helper to run validation
  const runValidation = async (data) => {
    const req = {
      body: data
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    const next = jest.fn();

    // Run all validation middleware in the array
    for (const validator of validatePayment) {
      await validator(req, res, next);
    }

    // Check if res.status was called (validation failed)
    if (res.status.mock.calls.length > 0) {
      return {
        errors: res.json.mock.calls[0][0].details || [],
        isValid: false,
        response: res.json.mock.calls[0][0]
      };
    }

    // Get validation results from express-validator
    const errors = validationResult(req);
    return {
      errors: errors.array(),
      isValid: errors.isEmpty()
    };
  };

  describe('Amount field validation', () => {
    it('should reject requests with amount parameter', async () => {
      const result = await runValidation({
        documentType: 'single_affidavit',
        documentId: 'new',
        amount: 3999
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      const amountError = result.errors.find(e => e.field === 'amount');
      expect(amountError).toBeDefined();
      expect(amountError.message).toContain('Amount cannot be provided by client');
    });

    it('should reject requests with amount: 0', async () => {
      const result = await runValidation({
        documentType: 'single_affidavit',
        documentId: 'new',
        amount: 0
      });

      expect(result.isValid).toBe(false);
      const amountError = result.errors.find(e => e.field === 'amount');
      expect(amountError.message).toContain('Amount cannot be provided by client');
    });

    it('should reject requests with amount as string', async () => {
      const result = await runValidation({
        documentType: 'single_affidavit',
        documentId: 'new',
        amount: '3999'
      });

      expect(result.isValid).toBe(false);
      const amountError = result.errors.find(e => e.field === 'amount');
      expect(amountError.message).toContain('Amount cannot be provided by client');
    });

    it('should accept requests without amount parameter', async () => {
      const result = await runValidation({
        documentType: 'single_affidavit',
        documentId: 'new'
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('DocumentType validation', () => {
    it('should accept valid document types', async () => {
      const validTypes = ['single_affidavit', 'family_law_package', 'all_state_access'];
      
      for (const type of validTypes) {
        const result = await runValidation({
          documentType: type,
          documentId: 'new'
        });
        
        expect(result.isValid).toBe(true);
      }
    });

    it('should reject invalid document types', async () => {
      const result = await runValidation({
        documentType: 'invalid_type',
        documentId: 'new'
      });

      expect(result.isValid).toBe(false);
      const docTypeError = result.errors.find(e => e.field === 'documentType');
      expect(docTypeError.message).toContain('Invalid document type');
    });

    it('should reject missing document type', async () => {
      const result = await runValidation({
        documentId: 'new'
      });

      expect(result.isValid).toBe(false);
    });
  });

  describe('Security scenarios', () => {
    it('should prevent price manipulation attack with low amount', async () => {
      const hackerRequest = {
        documentType: 'all_state_access', // $199.99 product
        amount: 1, // Trying to pay $0.01
        documentId: 'new'
      };

      const result = await runValidation(hackerRequest);

      expect(result.isValid).toBe(false);
      const amountError = result.errors.find(e => e.field === 'amount');
      expect(amountError.message).toContain('Amount cannot be provided by client');
    });

    it('should prevent price manipulation attack with high amount', async () => {
      const hackerRequest = {
        documentType: 'single_affidavit', // $39.99 product
        amount: 999999, // Trying to pay too much (fraud)
        documentId: 'new'
      };

      const result = await runValidation(hackerRequest);

      expect(result.isValid).toBe(false);
      const amountError = result.errors.find(e => e.field === 'amount');
      expect(amountError.message).toContain('Amount cannot be provided by client');
    });

    it('should prevent amount injection in documentType field', async () => {
      const hackerRequest = {
        documentType: 'single_affidavit&amount=100',
        documentId: 'new'
      };

      const result = await runValidation(hackerRequest);

      // Should reject invalid documentType format
      expect(result.isValid).toBe(false);
    });
  });
});
