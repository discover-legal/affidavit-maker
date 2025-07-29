// client/src/contexts/DocumentContext.js
import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// Initial state
const initialState = {
  currentDocument: {
    state: '',
    affiantName: '',
    caseNumber: '',
    caseType: '',
    county: '',
    documentType: 'general',
    facts: [],
    documentId: null
  },
  preview: null,
  isLoading: false,
  isSaving: false,
  isPreviewLoading: false,
  lastSaved: null,
  error: null,
  validation: null
};

// Action types
const ActionTypes = {
  SET_DOCUMENT_DATA: 'SET_DOCUMENT_DATA',
  UPDATE_DOCUMENT_DATA: 'UPDATE_DOCUMENT_DATA',
  SET_PREVIEW: 'SET_PREVIEW',
  SET_LOADING: 'SET_LOADING',
  SET_SAVING: 'SET_SAVING',
  SET_PREVIEW_LOADING: 'SET_PREVIEW_LOADING',
  SET_LAST_SAVED: 'SET_LAST_SAVED',
  SET_ERROR: 'SET_ERROR',
  SET_VALIDATION: 'SET_VALIDATION',
  RESET_DOCUMENT: 'RESET_DOCUMENT'
};

// Reducer
const documentReducer = (state, action) => {
  switch (action.type) {
    case ActionTypes.SET_DOCUMENT_DATA:
      return {
        ...state,
        currentDocument: action.payload,
        error: null
      };
    
    case ActionTypes.UPDATE_DOCUMENT_DATA:
      return {
        ...state,
        currentDocument: {
          ...state.currentDocument,
          ...action.payload
        },
        error: null
      };
    
    case ActionTypes.SET_PREVIEW:
      return {
        ...state,
        preview: action.payload
      };
    
    case ActionTypes.SET_LOADING:
      return {
        ...state,
        isLoading: action.payload,
        error: action.payload ? null : state.error
      };
    
    case ActionTypes.SET_SAVING:
      return {
        ...state,
        isSaving: action.payload
      };
    
    case ActionTypes.SET_PREVIEW_LOADING:
      return {
        ...state,
        isPreviewLoading: action.payload
      };
    
    case ActionTypes.SET_LAST_SAVED:
      return {
        ...state,
        lastSaved: action.payload,
        isSaving: false
      };
    
    case ActionTypes.SET_ERROR:
      return {
        ...state,
        error: action.payload,
        isLoading: false,
        isSaving: false
      };
    
    case ActionTypes.SET_VALIDATION:
      return {
        ...state,
        validation: action.payload
      };
    
    case ActionTypes.RESET_DOCUMENT:
      return {
        ...state,
        currentDocument: { ...initialState.currentDocument },
        preview: null,
        validation: null,
        error: null
      };
    
    default:
      return state;
  }
};

// Create contexts
const DocumentContext = createContext();
const DocumentDispatchContext = createContext();

/**
 * Document Provider Component
 * 
 * Wraps the application or parts of it to provide document state management.
 * Handles document loading, saving, and real-time updates.
 */
export const DocumentProvider = ({ children }) => {
  const [state, dispatch] = useReducer(documentReducer, initialState);
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  // Auto-save debounced timeout
  const autoSaveTimeoutRef = React.useRef(null);

  // Generate preview
  const generatePreview = useCallback(async (affidavitData) => {
    if (!affidavitData || (!affidavitData.state && !affidavitData.affiantName && (!affidavitData.facts || affidavitData.facts.length === 0))) {
      return;
    }

    dispatch({ type: ActionTypes.SET_PREVIEW_LOADING, payload: true });
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ affidavitData })
      });

      if (response.ok) {
        const result = await response.json();
        dispatch({ type: ActionTypes.SET_PREVIEW, payload: result.preview });
      } else {
        throw new Error('Failed to generate preview');
      }
    } catch (error) {
      console.error('Preview error:', error);
      dispatch({ type: ActionTypes.SET_ERROR, payload: 'Failed to generate preview' });
    } finally {
      dispatch({ type: ActionTypes.SET_PREVIEW_LOADING, payload: false });
    }
  }, []);

  // Save document
  const saveDocument = useCallback(async (documentData, options = {}) => {
    if (!isAuthenticated) {
      console.warn('Cannot save document: user not authenticated');
      return;
    }

    dispatch({ type: ActionTypes.SET_SAVING, payload: true });

    try {
      const token = await getAccessTokenSilently();
      const url = documentData.documentId 
        ? `${API_BASE_URL}/api/documents/${documentData.documentId}`
        : `${API_BASE_URL}/api/documents`;
      
      const method = documentData.documentId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          content: documentData,
          status: options.status || 'draft'
        })
      });

      if (response.ok) {
        const result = await response.json();
        
        // Update document ID if it's a new document
        if (!documentData.documentId && result.document?.id) {
          dispatch({ 
            type: ActionTypes.UPDATE_DOCUMENT_DATA, 
            payload: { documentId: result.document.id }
          });
        }

        dispatch({ type: ActionTypes.SET_LAST_SAVED, payload: new Date() });
        return { success: true, document: result.document };
      } else {
        throw new Error('Failed to save document');
      }
    } catch (error) {
      console.error('Save error:', error);
      dispatch({ type: ActionTypes.SET_ERROR, payload: 'Failed to save document' });
      return { success: false, error: error.message };
    }
  }, [isAuthenticated, getAccessTokenSilently]);

  // Auto-save with debouncing
  const autoSave = useCallback((documentData) => {
    if (!isAuthenticated || !documentData) return;

    // Clear existing timeout
    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    // Set new timeout
    autoSaveTimeoutRef.current = setTimeout(() => {
      saveDocument(documentData);
    }, 2000); // 2 second delay
  }, [isAuthenticated, saveDocument]);

  // Update document data
  const updateDocumentData = useCallback((newData) => {
    dispatch({ type: ActionTypes.UPDATE_DOCUMENT_DATA, payload: newData });
    
    // Auto-save after update
    const updatedData = { ...state.currentDocument, ...newData };
    autoSave(updatedData);
    
    // Generate preview
    generatePreview(updatedData);
  }, [state.currentDocument, autoSave, generatePreview]);

  // Load existing document
  const loadDocument = useCallback(async (documentId) => {
    if (!isAuthenticated) return;

    dispatch({ type: ActionTypes.SET_LOADING, payload: true });

    try {
      const token = await getAccessTokenSilently();
      const response = await fetch(`${API_BASE_URL}/api/documents/${documentId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        dispatch({ type: ActionTypes.SET_DOCUMENT_DATA, payload: result.document.content });
        generatePreview(result.document.content);
      } else {
        throw new Error('Failed to load document');
      }
    } catch (error) {
      console.error('Load error:', error);
      dispatch({ type: ActionTypes.SET_ERROR, payload: 'Failed to load document' });
    } finally {
      dispatch({ type: ActionTypes.SET_LOADING, payload: false });
    }
  }, [isAuthenticated, getAccessTokenSilently, generatePreview]);

  // Reset document
  const resetDocument = useCallback(() => {
    dispatch({ type: ActionTypes.RESET_DOCUMENT });
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    dispatch({ type: ActionTypes.SET_ERROR, payload: null });
  }, []);

  // Context value
  const value = {
    ...state,
    updateDocumentData,
    saveDocument,
    loadDocument,
    resetDocument,
    generatePreview,
    clearError
  };

  // Cleanup auto-save timeout on unmount
  useEffect(() => {
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  return (
    <DocumentContext.Provider value={value}>
      <DocumentDispatchContext.Provider value={dispatch}>
        {children}
      </DocumentDispatchContext.Provider>
    </DocumentContext.Provider>
  );
};

// Custom hooks to use the context
export const useDocument = () => {
  const context = useContext(DocumentContext);
  if (!context) {
    throw new Error('useDocument must be used within a DocumentProvider');
  }
  return context;
};

export const useDocumentDispatch = () => {
  const context = useContext(DocumentDispatchContext);
  if (!context) {
    throw new Error('useDocumentDispatch must be used within a DocumentProvider');
  }
  return context;
};

// Export action types for external use
export { ActionTypes };

export default DocumentContext;