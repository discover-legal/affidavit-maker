// client/src/hooks/useSaveDocument.js
import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

// Use relative URLs in production (empty string), localhost in development
const API_BASE_URL = process.env.REACT_APP_API_URL !== undefined
  ? process.env.REACT_APP_API_URL
  : 'http://localhost:3001';

/**
 * Hook for saving documents to the backend with auto-save support.
 * @returns {{ isSaving: boolean, lastSaved: Date|null, saveError: string|null,
 *   saveDocument: (affidavitData: Object, options?: Object) => Promise<{success: boolean, document?: Object, documentId?: number, error?: string}>,
 *   autoSave: (affidavitData: Object, delay?: number) => void,
 *   forceSave: (affidavitData: Object, options?: Object) => Promise<Object>,
 *   clearSaveError: () => void,
 *   canSave: (affidavitData: Object) => boolean,
 *   getSaveStatus: () => string,
 *   generateTitle: (affidavitData: Object) => string }}
 */
const useSaveDocument = () => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [saveError, setSaveError] = useState(null);
  
  // Auto-save timeout reference
  const autoSaveTimeoutRef = useRef(null);
  const isAutoSavingRef = useRef(false);

  // Manual save function
  const saveDocument = useCallback(async (affidavitData, options = {}) => {
    if (!isAuthenticated) {
      setSaveError('User not authenticated');
      return { success: false, error: 'User not authenticated' };
    }

    if (!affidavitData) {
      setSaveError('No data to save');
      return { success: false, error: 'No data to save' };
    }

    setIsSaving(true);
    setSaveError(null);

    try {
      const token = await getAccessTokenSilently();
      
      // Determine if this is an update or create
      const isUpdate = affidavitData.documentId;
      const url = isUpdate 
        ? `${API_BASE_URL}/api/documents/${affidavitData.documentId}`
        : `${API_BASE_URL}/api/documents`;
      
      const method = isUpdate ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content: affidavitData,
          status: options.status || 'draft',
          title: options.title || generateTitle(affidavitData)
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Server error: ${response.status}`);
      }

      const result = await response.json();
      
      setLastSaved(new Date());
      setIsSaving(false);

      return {
        success: true,
        document: result.document,
        documentId: result.document?.id || affidavitData.documentId
      };

    } catch (error) {
      console.error('Save document error:', error);
      setSaveError(error.message);
      setIsSaving(false);
      
      return {
        success: false,
        error: error.message
      };
    }
  }, [isAuthenticated, getAccessTokenSilently]);

  // Auto-save with debouncing
  const autoSave = useCallback((affidavitData, delay = 3000) => {
    if (!isAuthenticated || !affidavitData || isAutoSavingRef.current) {
      return;
    }

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Set new timeout
    autoSaveTimeoutRef.current = setTimeout(async () => {
      if (!isAutoSavingRef.current) {
        isAutoSavingRef.current = true;
        
        try {
          const result = await saveDocument(affidavitData, { 
            status: 'draft',
            isAutoSave: true 
          });
          
          // Auto-save completed
        } catch (error) {
          console.error('Auto-save failed:', error);
        } finally {
          isAutoSavingRef.current = false;
        }
      }
    }, delay);
  }, [isAuthenticated, saveDocument]);

  // Force immediate save (bypasses debouncing)
  const forceSave = useCallback(async (affidavitData, options = {}) => {
    // Clear any pending auto-save
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    return saveDocument(affidavitData, { ...options, forceSave: true });
  }, [saveDocument]);

  // Check if document can be saved
  const canSave = useCallback((affidavitData) => {
    return isAuthenticated && 
           affidavitData && 
           (affidavitData.affiantName || affidavitData.state || (affidavitData.facts && affidavitData.facts.length > 0));
  }, [isAuthenticated]);

  // Generate a title for the document
  const generateTitle = (affidavitData) => {
    if (affidavitData.affiantName) {
      return `${affidavitData.affiantName}'s Affidavit`;
    }
    if (affidavitData.state) {
      return `${affidavitData.state} Affidavit`;
    }
    if (affidavitData.documentType && affidavitData.documentType !== 'general') {
      return `${affidavitData.documentType} Affidavit`;
    }
    return `Affidavit Draft - ${new Date().toLocaleDateString()}`;
  };

  // Clear save error
  const clearSaveError = useCallback(() => {
    setSaveError(null);
  }, []);

  // Get save status text
  const getSaveStatus = useCallback(() => {
    if (isSaving) return 'Saving...';
    if (saveError) return 'Save failed';
    if (lastSaved) return `Saved ${lastSaved.toLocaleTimeString()}`;
    return 'Not saved';
  }, [isSaving, saveError, lastSaved]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  return {
    // State
    isSaving,
    lastSaved,
    saveError,
    
    // Actions
    saveDocument,
    autoSave,
    forceSave,
    clearSaveError,
    
    // Utilities
    canSave,
    getSaveStatus,
    generateTitle
  };
};

export default useSaveDocument;