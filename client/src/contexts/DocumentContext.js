// client/src/contexts/DocumentContext.js
import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// Initial state
const initialState = {
  // Document data
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
  
  // Document list (for dashboard)
  documents: [],
  
  // UI states
  preview: null,
  isLoading: false,
  isSaving: false,
  isPreviewLoading: false,
  isDocumentsLoading: false,
  
  // Metadata
  lastSaved: null,
  error: null,
  validation: null
};

// Action types
const ActionTypes = {
  SET_DOCUMENT_DATA: 'SET_DOCUMENT_DATA',
  UPDATE_DOCUMENT_DATA: 'UPDATE_DOCUMENT_DATA',
  SET_DOCUMENTS: 'SET_DOCUMENTS',
  SET_PREVIEW: 'SET_PREVIEW',
  SET_LOADING: 'SET_LOADING',
  SET_SAVING: 'SET_SAVING',
  SET_PREVIEW_LOADING: 'SET_PREVIEW_LOADING',
  SET_DOCUMENTS_LOADING: 'SET_DOCUMENTS_LOADING',
  SET_LAST_SAVED: 'SET_LAST_SAVED',
  SET_ERROR: 'SET_ERROR',
  SET_VALIDATION: 'SET_VALIDATION',
  RESET_DOCUMENT: 'RESET_DOCUMENT',
  SELECT_DOCUMENT: 'SELECT_DOCUMENT'
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
    
    case ActionTypes.SET_DOCUMENTS:
      return {
        ...state,
        documents: action.payload,
        isDocumentsLoading: false
      };
    
    case ActionTypes.SET_PREVIEW:
      return {
        ...state,
        preview: action.payload,
        isPreviewLoading: false
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
    
    case ActionTypes.SET_DOCUMENTS_LOADING:
      return {
        ...state,
        isDocumentsLoading: action.payload
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
        isSaving: false,
        isPreviewLoading: false,
        isDocumentsLoading: false
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
    
    case ActionTypes.SELECT_DOCUMENT:
      return {
        ...state,
        currentDocument: action.payload,
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

  // Fetch documents on auth state change
  useEffect(() => {
    if (isAuthenticated) {
      loadDocuments();
    }
  }, [isAuthenticated]);

  // API request wrapper with auth token
  const authFetch = useCallback(async (url, options = {}) => {
    try {
      if (isAuthenticated) {
        const token = await getAccessTokenSilently();
        options.headers = {
          ...options.headers,
          Authorization: `Bearer ${token}`
        };
      }

      const response = await fetch(`${API_BASE_URL}${url}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'An error occurred');
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      dispatch({ 
        type: ActionTypes.SET_ERROR, 
        payload: error.message 
      });
      throw error;
    }
  }, [isAuthenticated, getAccessTokenSilently]);

  // Load all documents for user
  const loadDocuments = useCallback(async () => {
    if (!isAuthenticated) return;
    
    try {
      dispatch({ type: ActionTypes.SET_DOCUMENTS_LOADING, payload: true });
      
      const data = await authFetch('/api/documents');
      
      if (data.success && Array.isArray(data.documents)) {
        dispatch({ 
          type: ActionTypes.SET_DOCUMENTS, 
          payload: data.documents 
        });
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
    }
  }, [authFetch, isAuthenticated]);

  // Load a specific document
  const loadDocument = useCallback(async (documentId) => {
    try {
      dispatch({ type: ActionTypes.SET_LOADING, payload: true });
      
      const data = await authFetch(`/api/documents/${documentId}`);
      
      if (data.success && data.document) {
        dispatch({ 
          type: ActionTypes.SET_DOCUMENT_DATA, 
          payload: data.document.content 
        });
        
        // Trigger preview generation
        generatePreview(data.document.content);
        
        return data.document;
      }
    } catch (error) {
      console.error('Failed to load document:', error);
    } finally {
      dispatch({ type: ActionTypes.SET_LOADING, payload: false });
    }
  }, [authFetch]);

  // Save document
  const saveDocument = useCallback(async (documentData) => {
    try {
      dispatch({ type: ActionTypes.SET_SAVING, payload: true });
      
      const payload = {
        documentId: state.currentDocument.documentId,
        affidavitData: {
          ...state.currentDocument,
          ...documentData
        }
      };
      
      const data = await authFetch('/api/documents/save', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      if (data.success && data.document) {
        // Update document ID if it's a new document
        if (!state.currentDocument.documentId) {
          dispatch({
            type: ActionTypes.UPDATE_DOCUMENT_DATA,
            payload: { documentId: data.document.id }
          });
        }
        
        dispatch({ 
          type: ActionTypes.SET_LAST_SAVED, 
          payload: new Date() 
        });
        
        // Reload documents list
        loadDocuments();
        
        return data.document;
      }
    } catch (error) {
      console.error('Failed to save document:', error);
    } finally {
      dispatch({ type: ActionTypes.SET_SAVING, payload: false });
    }
  }, [authFetch, state.currentDocument, loadDocuments]);

  // Generate preview
  const generatePreview = useCallback(async (documentData) => {
    try {
      dispatch({ type: ActionTypes.SET_PREVIEW_LOADING, payload: true });
      
      const payload = {
        affidavitData: {
          ...state.currentDocument,
          ...(documentData || {})
        }
      };
      
      const data = await authFetch('/api/preview', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      if (data.success && data.preview) {
        dispatch({ 
          type: ActionTypes.SET_PREVIEW, 
          payload: data.preview 
        });
        
        // Update validation if available
        if (data.validation) {
          dispatch({ 
            type: ActionTypes.SET_VALIDATION, 
            payload: data.validation 
          });
        }
        
        return data.preview;
      }
    } catch (error) {
      console.error('Failed to generate preview:', error);
    } finally {
      dispatch({ type: ActionTypes.SET_PREVIEW_LOADING, payload: false });
    }
  }, [authFetch, state.currentDocument]);

  // Validate document
  const validateDocument = useCallback(async (documentData) => {
    try {
      const payload = {
        affidavitData: {
          ...state.currentDocument,
          ...(documentData || {})
        }
      };
      
      const data = await authFetch('/api/validate', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      if (data.success && data.validation) {
        dispatch({ 
          type: ActionTypes.SET_VALIDATION, 
          payload: data.validation 
        });
        
        return data.validation;
      }
    } catch (error) {
      console.error('Failed to validate document:', error);
    }
  }, [authFetch, state.currentDocument]);

  // Create new document
  const createNewDocument = useCallback(() => {
    dispatch({ type: ActionTypes.RESET_DOCUMENT });
  }, []);

  // Select an existing document
  const selectDocument = useCallback((document) => {
    if (document && document.content) {
      dispatch({ 
        type: ActionTypes.SELECT_DOCUMENT, 
        payload: document.content 
      });
      
      // Set document ID
      dispatch({
        type: ActionTypes.UPDATE_DOCUMENT_DATA,
        payload: { documentId: document.id }
      });
      
      // Generate preview
      generatePreview(document.content);
    }
  }, [generatePreview]);

  // Update document data
  const updateDocumentData = useCallback((data) => {
    dispatch({ 
      type: ActionTypes.UPDATE_DOCUMENT_DATA, 
      payload: data 
    });
    
    // Generate preview after a short delay for better UX
    const debounceTimer = setTimeout(() => {
      generatePreview(data);
    }, 500);
    
    return () => clearTimeout(debounceTimer);
  }, [generatePreview]);

  return (
    <DocumentContext.Provider value={state}>
      <DocumentDispatchContext.Provider 
        value={{
          loadDocument,
          loadDocuments,
          saveDocument,
          generatePreview,
          validateDocument,
          createNewDocument,
          selectDocument,
          updateDocumentData
        }}
      >
        {children}
      </DocumentDispatchContext.Provider>
    </DocumentContext.Provider>
  );
};

// Custom hooks for using the context
export const useDocumentState = () => useContext(DocumentContext);
export const useDocumentActions = () => useContext(DocumentDispatchContext);