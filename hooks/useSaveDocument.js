// hooks/useSaveDocument.js
import { useState, useCallback, useRef, useEffect } from 'react';
import { useDocumentService } from '../services/documentService';

export const useSaveDocument = (affidavitData, autoSaveDelay = 2000) => {
  const [saveStatus, setSaveStatus] = useState(null); // 'saving', 'saved', 'error'
  const [lastSaved, setLastSaved] = useState(null);
  const [error, setError] = useState(null);
  
  const documentService = useDocumentService();
  const autoSaveTimeoutRef = useRef(null);
  const lastDataRef = useRef(null);

  // Manual save function
  const saveDocument = useCallback(async (options = {}) => {
    if (!affidavitData || saveStatus === 'saving') return;

    setSaveStatus('saving');
    setError(null);

    try {
      const result = await documentService.saveDocument(affidavitData, options);
      
      if (result.success) {
        setSaveStatus('saved');
        setLastSaved(new Date());
        
        // Clear status after 3 seconds
        setTimeout(() => setSaveStatus(null), 3000);
        
        return result;
      } else {
        throw new Error(result.error || 'Save failed');
      }
    } catch (err) {
      setSaveStatus('error');
      setError(err.message);
      console.error('Save failed:', err);
      throw err;
    }
  }, [affidavitData, saveStatus, documentService]);

  // Auto-save when data changes
  useEffect(() => {
    const currentData = JSON.stringify(affidavitData);
    
    // Skip if data hasn't changed or is empty
    if (!affidavitData || currentData === lastDataRef.current) {
      return;
    }

    // Skip auto-save if currently saving manually
    if (saveStatus === 'saving') {
      return;
    }

    lastDataRef.current = currentData;

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Set new auto-save timeout
    autoSaveTimeoutRef.current = setTimeout(async () => {
      try {
        await saveDocument({ isAutoSave: true });
      } catch (error) {
        // Auto-save failures are less critical
        console.warn('Auto-save failed:', error);
      }
    }, autoSaveDelay);

    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, [affidavitData, saveDocument, saveStatus, autoSaveDelay]);

  // Force save (bypass auto-save delay)
  const forceSave = useCallback(async () => {
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }
    return saveDocument({ forceSave: true });
  }, [saveDocument]);

  // Retry failed save
  const retrySave = useCallback(async () => {
    if (saveStatus === 'error') {
      return saveDocument();
    }
  }, [saveDocument, saveStatus]);

  return {
    saveStatus,
    lastSaved,
    error,
    saveDocument,
    forceSave,
    retrySave,
    isSaving: saveStatus === 'saving',
    hasError: saveStatus === 'error',
    isAutoSaving: autoSaveTimeoutRef.current !== null
  };
};