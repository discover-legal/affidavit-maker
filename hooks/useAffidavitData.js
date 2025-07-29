// hooks/useAffidavitData.js
import { useState, useCallback } from 'react';

/**
 * Custom hook for managing affidavit document data
 * Provides centralized state management for document information and facts
 * 
 * @param {Object} initialData - Initial document data
 * @returns {Object} Document data and management functions
 */
export const useAffidavitData = (initialData = {}) => {
  // Default structure for affidavit data
  const defaultData = {
    affiantName: '',
    state: '',
    county: '',
    caseNumber: '',
    caseType: '',
    facts: [],
    documentType: 'affidavit',
    documentId: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...initialData
  };

  const [affidavitData, setAffidavitData] = useState(defaultData);

  /**
   * Update document data with new values
   * Automatically updates the updatedAt timestamp
   * 
   * @param {Object} updates - Partial data to merge with existing data
   */
  const updateData = useCallback((updates) => {
    setAffidavitData(prev => ({
      ...prev,
      ...updates,
      updatedAt: new Date().toISOString()
    }));
  }, []);

  /**
   * Add a new fact to the document
   * 
   * @param {Object|string} fact - Fact object or string content
   */
  const addFact = useCallback((fact) => {
    const factObject = typeof fact === 'string' 
      ? { content: fact, category: 'general', timestamp: new Date().toISOString() }
      : { timestamp: new Date().toISOString(), ...fact };

    setAffidavitData(prev => ({
      ...prev,
      facts: [...(prev.facts || []), factObject],
      updatedAt: new Date().toISOString()
    }));
  }, []);

  /**
   * Update a specific fact by index
   * 
   * @param {number} index - Index of fact to update
   * @param {Object} updates - Updates to apply to the fact
   */
  const updateFact = useCallback((index, updates) => {
    setAffidavitData(prev => {
      const newFacts = [...(prev.facts || [])];
      if (newFacts[index]) {
        newFacts[index] = { ...newFacts[index], ...updates };
      }
      return {
        ...prev,
        facts: newFacts,
        updatedAt: new Date().toISOString()
      };
    });
  }, []);

  /**
   * Remove a fact by index
   * 
   * @param {number} index - Index of fact to remove
   */
  const removeFact = useCallback((index) => {
    setAffidavitData(prev => ({
      ...prev,
      facts: (prev.facts || []).filter((_, i) => i !== index),
      updatedAt: new Date().toISOString()
    }));
  }, []);

  /**
   * Reset document to default state
   */
  const resetData = useCallback(() => {
    setAffidavitData({
      ...defaultData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
  }, [defaultData]);

  /**
   * Load existing document data
   * 
   * @param {Object} documentData - Complete document data to load
   */
  const loadData = useCallback((documentData) => {
    setAffidavitData({
      ...defaultData,
      ...documentData,
      updatedAt: new Date().toISOString()
    });
  }, [defaultData]);

  /**
   * Calculate document completion percentage
   * Based on required fields for the specific state
   * 
   * @returns {number} Completion percentage (0-100)
   */
  const getCompletionPercentage = useCallback(() => {
    const requiredFields = ['affiantName', 'state'];
    
    // Add state-specific requirements
    if (affidavitData.state === 'TX') {
      requiredFields.push('county');
    }

    const completedFields = requiredFields.filter(field => {
      const value = affidavitData[field];
      return value && (typeof value === 'string' ? value.trim().length > 0 : value.length > 0);
    });

    // Factor in facts
    const hasFacts = affidavitData.facts && affidavitData.facts.length > 0;
    const totalRequirements = requiredFields.length + 1; // +1 for facts
    const completedRequirements = completedFields.length + (hasFacts ? 1 : 0);

    return Math.round((completedRequirements / totalRequirements) * 100);
  }, [affidavitData]);

  /**
   * Get validation status for required fields
   * 
   * @returns {Object} Validation status for each field
   */
  const getFieldValidation = useCallback(() => {
    return {
      affiantName: {
        isValid: !!(affidavitData.affiantName && affidavitData.affiantName.trim().length >= 2),
        message: 'Full legal name is required (minimum 2 characters)'
      },
      state: {
        isValid: !!(affidavitData.state && ['TX', 'UT', 'AZ'].includes(affidavitData.state)),
        message: 'Valid state selection is required'
      },
      county: {
        isValid: affidavitData.state !== 'TX' || !!(affidavitData.county && affidavitData.county.trim().length > 0),
        message: 'County is required for Texas affidavits'
      },
      facts: {
        isValid: !!(affidavitData.facts && affidavitData.facts.length > 0),
        message: 'At least one fact is required'
      }
    };
  }, [affidavitData]);

  /**
   * Check if document is ready for processing
   * 
   * @returns {boolean} True if all required fields are valid
   */
  const isDocumentReady = useCallback(() => {
    const validation = getFieldValidation();
    return Object.values(validation).every(field => field.isValid);
  }, [getFieldValidation]);

  /**
   * Get summary statistics about the document
   * 
   * @returns {Object} Document statistics
   */
  const getDocumentStats = useCallback(() => {
    const facts = affidavitData.facts || [];
    
    // Count facts by category
    const categoryCounts = facts.reduce((acc, fact) => {
      const category = fact.category || 'general';
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});

    // Calculate average fact length
    const avgFactLength = facts.length > 0 
      ? Math.round(facts.reduce((sum, fact) => sum + (fact.content || '').length, 0) / facts.length)
      : 0;

    return {
      totalFacts: facts.length,
      categoryCounts,
      avgFactLength,
      completionPercentage: getCompletionPercentage(),
      isReady: isDocumentReady(),
      lastUpdated: affidavitData.updatedAt
    };
  }, [affidavitData, getCompletionPercentage, isDocumentReady]);

  return {
    // Data
    affidavitData,
    
    // Core operations
    updateData,
    resetData,
    loadData,
    
    // Fact operations
    addFact,
    updateFact,
    removeFact,
    
    // Validation and status
    getCompletionPercentage,
    getFieldValidation,
    isDocumentReady,
    getDocumentStats
  };
};