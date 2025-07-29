// client/src/hooks/useAffidavitData.js
import { useState, useCallback, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const useAffidavitData = (initialData = null) => {
  const { isAuthenticated } = useAuth0();
  
  // Initialize state
  const [affidavitData, setAffidavitData] = useState(() => {
    if (initialData) {
      return {
        ...initialData,
        documentId: initialData.id || initialData.documentId || null
      };
    }
    return {
      state: '',
      affiantName: '',
      caseNumber: '',
      caseType: '',
      county: '',
      documentType: 'general',
      facts: [],
      documentId: null
    };
  });

  const [isDirty, setIsDirty] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validation, setValidation] = useState(null);

  // Update affidavit data
  const updateAffidavitData = useCallback((newData) => {
    setAffidavitData(prev => {
      const updated = { ...prev, ...newData };
      setIsDirty(true);
      return updated;
    });
  }, []);

  // Add a fact
  const addFact = useCallback((factContent, category = 'general') => {
    const newFact = {
      content: factContent.trim(),
      category,
      id: Date.now() + Math.random() // Simple ID generation
    };
    
    setAffidavitData(prev => ({
      ...prev,
      facts: [...(prev.facts || []), newFact]
    }));
    setIsDirty(true);
  }, []);

  // Update a fact
  const updateFact = useCallback((index, newContent) => {
    setAffidavitData(prev => {
      const updatedFacts = [...(prev.facts || [])];
      if (updatedFacts[index]) {
        updatedFacts[index] = {
          ...updatedFacts[index],
          content: newContent.trim()
        };
      }
      return { ...prev, facts: updatedFacts };
    });
    setIsDirty(true);
  }, []);

  // Remove a fact
  const removeFact = useCallback((index) => {
    setAffidavitData(prev => {
      const updatedFacts = [...(prev.facts || [])];
      updatedFacts.splice(index, 1);
      return { ...prev, facts: updatedFacts };
    });
    setIsDirty(true);
  }, []);

  // Validate data
  const validateData = useCallback(async () => {
    setIsValidating(true);
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ affidavitData })
      });

      if (response.ok) {
        const result = await response.json();
        setValidation(result.validation);
        return result.validation;
      } else {
        throw new Error('Validation failed');
      }
    } catch (error) {
      console.error('Validation error:', error);
      return null;
    } finally {
      setIsValidating(false);
    }
  }, [affidavitData]);

  // Check if document is ready for generation
  const isDocumentReady = useCallback(() => {
    return !!(
      affidavitData.affiantName &&
      affidavitData.state &&
      affidavitData.facts &&
      affidavitData.facts.length > 0
    );
  }, [affidavitData]);

  // Get completion percentage
  const getCompletionPercentage = useCallback(() => {
    const requiredFields = ['affiantName', 'state', 'facts'];
    const completedFields = requiredFields.filter(field => {
      const value = affidavitData[field];
      return value && (Array.isArray(value) ? value.length > 0 : value.trim().length > 0);
    });
    
    return Math.round((completedFields.length / requiredFields.length) * 100);
  }, [affidavitData]);

  // Reset to initial state
  const resetData = useCallback(() => {
    setAffidavitData(initialData || {
      state: '',
      affiantName: '',
      caseNumber: '',
      caseType: '',
      county: '',
      documentType: 'general',
      facts: [],
      documentId: null
    });
    setIsDirty(false);
    setValidation(null);
  }, [initialData]);

  // Mark as saved (clears dirty flag)
  const markAsSaved = useCallback((documentId) => {
    setIsDirty(false);
    if (documentId) {
      setAffidavitData(prev => ({ ...prev, documentId }));
    }
  }, []);

  return {
    // Data
    affidavitData,
    isDirty,
    isValidating,
    validation,
    
    // Actions
    updateAffidavitData,
    addFact,
    updateFact,
    removeFact,
    validateData,
    resetData,
    markAsSaved,
    
    // Computed values
    isDocumentReady,
    getCompletionPercentage
  };
};

export default useAffidavitData;