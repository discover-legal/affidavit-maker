// client/src/contexts/DocumentContext.js - CLEAN ARCHITECTURE
import React, { createContext, useContext, useReducer, useEffect, useCallback, useState } from 'react';
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
  
  // Session state
  sessionInitialized: false,
  
  // Metadata
  lastSaved: null,
  error: null,
  validation: null,
  hasUnsavedChanges: false
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
  SET_UNSAVED_CHANGES: 'SET_UNSAVED_CHANGES',
  SET_SESSION_INITIALIZED: 'SET_SESSION_INITIALIZED',
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
      // ✅ CRITICAL: documentId is immutable - never allow it to be overwritten
      const updates = { ...action.payload };
      
      // Remove documentId from updates if it's null/undefined
      if (updates.documentId === null || updates.documentId === undefined) {
        delete updates.documentId;
      }
      
      return {
        ...state,
        currentDocument: {
          ...state.currentDocument,
          ...updates,
          // Preserve existing documentId
          documentId: state.currentDocument.documentId
        },
        error: null,
        hasUnsavedChanges: true
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
        isSaving: false,
        hasUnsavedChanges: false
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
    
    case ActionTypes.SET_UNSAVED_CHANGES:
      return {
        ...state,
        hasUnsavedChanges: action.payload
      };
    
    case ActionTypes.SET_SESSION_INITIALIZED:
      return {
        ...state,
        sessionInitialized: action.payload
      };
    
    case ActionTypes.RESET_DOCUMENT:
      return {
        ...state,
        currentDocument: { ...initialState.currentDocument },
        preview: null,
        validation: null,
        error: null,
        hasUnsavedChanges: false,
        sessionInitialized: false
      };
    
    case ActionTypes.SELECT_DOCUMENT:
      return {
        ...state,
        currentDocument: action.payload,
        preview: null,
        validation: null,
        error: null,
        hasUnsavedChanges: false,
        sessionInitialized: true // Existing document = initialized
      };
    
    default:
      return state;
  }
};

// Create contexts
const DocumentContext = createContext();
const DocumentDispatchContext = createContext();

/**
 * ✅ Document Provider Component - CLEAN ARCHITECTURE
 */
export const DocumentProvider = ({ children }) => {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();
  const [state, dispatch] = useReducer(documentReducer, initialState);
  const [autoSaveTimer, setAutoSaveTimer] = useState(null);

  // ✅ Enhanced authFetch helper
  const authFetch = useCallback(async (url, options = {}) => {
    try {
      const headers = {
        'Content-Type': 'application/json',
        ...options.headers
      };

      if (isAuthenticated) {
        const token = await getAccessTokenSilently();
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await fetch(`${API_BASE_URL}${url}`, {
        ...options,
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Network error' }));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }, [isAuthenticated, getAccessTokenSilently]);

  // Load documents list
  const loadDocuments = useCallback(async () => {
    if (!isAuthenticated) return;

    try {
      dispatch({ type: ActionTypes.SET_DOCUMENTS_LOADING, payload: true });
      
      const data = await authFetch('/api/documents');
      
      if (data.success && data.documents) {
        dispatch({ 
          type: ActionTypes.SET_DOCUMENTS, 
          payload: data.documents 
        });
      }
    } catch (error) {
      console.error('Failed to load documents:', error);
      dispatch({ 
        type: ActionTypes.SET_ERROR, 
        payload: 'Failed to load documents' 
      });
    }
  }, [authFetch, isAuthenticated]);

  // Load a specific document
  const loadDocument = useCallback(async (documentId) => {
    try {
      dispatch({ type: ActionTypes.SET_LOADING, payload: true });
      
      const data = await authFetch(`/api/documents/${documentId}`);
      
      if (data.success && data.document) {
        console.log('📂 Document loaded:', documentId);
        
        // Parse the document content
        let documentContent = {};
        
        if (data.document.content) {
          try {
            documentContent = typeof data.document.content === 'string' 
              ? JSON.parse(data.document.content) 
              : data.document.content;
          } catch (e) {
            console.error('Failed to parse document content:', e);
            documentContent = data.document.content;
          }
        }
        
        dispatch({ 
          type: ActionTypes.SELECT_DOCUMENT, 
          payload: {
            ...documentContent,
            documentId: data.document.id
          }
        });
        
        return data.document;
      }
    } catch (error) {
      console.error('Failed to load document:', error);
      dispatch({ 
        type: ActionTypes.SET_ERROR, 
        payload: 'Failed to load document' 
      });
    } finally {
      dispatch({ type: ActionTypes.SET_LOADING, payload: false });
    }
  }, [authFetch]);

  // ✅ NEW: Initialize a new document session
  const initializeNewDocument = useCallback(async () => {
    if (!isAuthenticated) {
      console.warn('Cannot initialize document: User not authenticated');
      return null;
    }

    // ✅ CRITICAL: Only initialize if truly new (no documentId exists)
    if (state.currentDocument.documentId) {
      console.log('📄 Document already exists:', state.currentDocument.documentId);
      if (!state.sessionInitialized) {
        dispatch({ type: ActionTypes.SET_SESSION_INITIALIZED, payload: true });
      }
      return state.currentDocument.documentId;
    }

    try {
      console.log('📄 Creating new document...');
      dispatch({ type: ActionTypes.SET_SAVING, payload: true });
      
      // Create empty document
      const payload = {
        affidavitData: {
          state: '',
          affiantName: '',
          caseNumber: '',
          county: '',
          caseType: '',
          documentType: 'general',
          facts: []
        },
        title: 'Untitled Affidavit',
        content: JSON.stringify({
          state: '',
          affiantName: '',
          facts: []
        })
      };
      
      const data = await authFetch('/api/documents/save', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      if (data.success && data.document?.id) {
        const documentId = data.document.id;
        
        console.log('📄 New document created:', documentId);
        
        // Set the document ID
        dispatch({
          type: ActionTypes.SET_DOCUMENT_DATA,
          payload: {
            ...data.document.affidavitData,
            documentId
          }
        });
        
        dispatch({ type: ActionTypes.SET_SESSION_INITIALIZED, payload: true });
        dispatch({ type: ActionTypes.SET_LAST_SAVED, payload: new Date() });
        
        // Reload documents list
        loadDocuments();
        
        return documentId;
      } else {
        throw new Error('Failed to create document');
      }
    } catch (error) {
      console.error('Failed to initialize document:', error);
      dispatch({ 
        type: ActionTypes.SET_ERROR, 
        payload: 'Failed to create document: ' + error.message 
      });
      throw error;
    } finally {
      dispatch({ type: ActionTypes.SET_SAVING, payload: false });
    }
  }, [authFetch, isAuthenticated, state.currentDocument, state.sessionInitialized, loadDocuments]);

  // ✅ SIMPLIFIED: Save document (always updates existing)
  const saveDocument = useCallback(async (documentData = null) => {
    if (!isAuthenticated) {
      throw new Error('Authentication required to save documents');
    }

    const documentId = state.currentDocument.documentId;
    
    if (!documentId) {
      throw new Error('No document ID - session not initialized');
    }

    try {
      dispatch({ type: ActionTypes.SET_SAVING, payload: true });
      
      // Merge current document with any provided data
      const fullDocumentData = {
        ...state.currentDocument,
        ...(documentData || {}),
        documentId // Always include the ID
      };
      
      console.log('💾 Saving document:', documentId);
      
      // Build payload
      const payload = {
        affidavitData: {
          state: fullDocumentData.state || '',
          affiantName: fullDocumentData.affiantName || '',
          caseNumber: fullDocumentData.caseNumber || '',
          county: fullDocumentData.county || '',
          caseType: fullDocumentData.caseType || '',
          documentType: fullDocumentData.documentType || 'general',
          facts: fullDocumentData.facts || [],
          documentId // Include for backend to know it's an update
        },
        title: fullDocumentData.affiantName 
          ? `Affidavit of ${fullDocumentData.affiantName}` 
          : 'Untitled Affidavit',
        content: JSON.stringify(fullDocumentData)
      };
      
      const data = await authFetch('/api/documents/save', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      
      if (data.success) {
        console.log('💾 Document saved successfully');
        
        dispatch({ 
          type: ActionTypes.SET_LAST_SAVED, 
          payload: new Date() 
        });
        
        // Update validation if included in response
        if (data.validation) {
          dispatch({
            type: ActionTypes.SET_VALIDATION,
            payload: data.validation
          });
        }
        
        // Reload documents list
        loadDocuments();
        
        return documentId;
      } else {
        throw new Error(data.error || 'Save failed');
      }
    } catch (error) {
      console.error('Failed to save document:', error);
      
      dispatch({ 
        type: ActionTypes.SET_ERROR, 
        payload: 'Failed to save document: ' + error.message 
      });
      
      throw error;
    } finally {
      dispatch({ type: ActionTypes.SET_SAVING, payload: false });
    }
  }, [authFetch, state.currentDocument, loadDocuments, isAuthenticated]);

  // ✅ Auto-save functionality
  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
    }
    
    const timer = setTimeout(() => {
      if (isAuthenticated && 
          state.hasUnsavedChanges &&
          state.currentDocument.documentId &&
          (state.currentDocument.affiantName || 
           state.currentDocument.state || 
           (state.currentDocument.facts && state.currentDocument.facts.length > 0))) {
        
        console.log('⏰ Auto-saving document...');
        saveDocument().catch(error => {
          console.log('⏰ Auto-save failed:', error.message);
        });
      }
    }, 30000); // Auto-save after 30 seconds of inactivity
    
    setAutoSaveTimer(timer);
  }, [isAuthenticated, state.hasUnsavedChanges, state.currentDocument, saveDocument, autoSaveTimer]);

  // Generate preview
  const generatePreview = useCallback(async (documentData = null) => {
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
      dispatch({ 
        type: ActionTypes.SET_ERROR, 
        payload: 'Failed to generate preview' 
      });
    } finally {
      dispatch({ type: ActionTypes.SET_PREVIEW_LOADING, payload: false });
    }
  }, [authFetch, state.currentDocument]);

  // Validate document
  const validateDocument = useCallback(async (documentData = null) => {
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

  // Create new document (resets state)
  const createNewDocument = useCallback(() => {
    dispatch({ type: ActionTypes.RESET_DOCUMENT });
  }, []);

  // Select an existing document
  const selectDocument = useCallback((document) => {
    if (document && document.content) {
      dispatch({ 
        type: ActionTypes.SELECT_DOCUMENT, 
        payload: {
          ...document.content,
          documentId: document.id
        }
      });
      
      generatePreview(document.content);
    }
  }, [generatePreview]);

  // ✅ SIMPLIFIED: Update document data (never touches documentId)
  const updateDocumentData = useCallback((data) => {
    console.log('📝 Updating document data');
    
    dispatch({ 
      type: ActionTypes.UPDATE_DOCUMENT_DATA, 
      payload: data 
    });
    
    // Schedule auto-save
    scheduleAutoSave();
    
    // Generate preview after a short delay
    const debounceTimer = setTimeout(() => {
      generatePreview(data);
    }, 500);
    
    return () => clearTimeout(debounceTimer);
  }, [generatePreview, scheduleAutoSave]);

  // Load documents on mount
  useEffect(() => {
    if (isAuthenticated) {
      loadDocuments();
    }
  }, [isAuthenticated, loadDocuments]);

  // Clean up auto-save timer
  useEffect(() => {
    return () => {
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
      }
    };
  }, [autoSaveTimer]);

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
          updateDocumentData,
          initializeNewDocument // ✅ NEW
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

// Export for testing
export { ActionTypes };
