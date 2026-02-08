// client/src/contexts/DocumentContext.js - SPLIT CONTEXT ARCHITECTURE
// Optimized to prevent unnecessary re-renders by splitting state into separate contexts
import React, { createContext, useContext, useReducer, useEffect, useCallback, useState, useRef, useMemo } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { useTOS } from './TOSContext';

// Use relative URLs in production (empty string), localhost in development
const API_BASE_URL = process.env.REACT_APP_API_URL !== undefined
  ? process.env.REACT_APP_API_URL
  : 'http://localhost:3001';

// Create separate contexts to minimize re-renders
const DocumentDataContext = createContext();      // Core document data (preview, currentDocument)
const DocumentListContext = createContext();      // Dashboard documents list
const SaveMetadataContext = createContext();      // Save state (for SaveButton)
const UIContext = createContext();                // UI state (loading, errors)
const DocumentActionsContext = createContext();   // All actions

// Initial state
const initialState = {
  // Document data
  currentDocument: {
    state: '',
    affiantName: '',
    caseNumber: '',
    courtName: '',
    plaintiff: '',
    defendant: '',
    caseType: '',
    county: '',
    documentType: 'general',
    activeSubDocument: null, // For divorce packages: 'divorce_petition' or 'divorce_decree'
    facts: [],
    documentId: null,
    factSummary: null,      // Cached AI summary of facts
    factSignature: null     // Hash of facts used to generate summary
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
  hasUnsavedChanges: false,
  justSaved: false
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
  SELECT_DOCUMENT: 'SELECT_DOCUMENT',
  MERGE_PROFESSIONAL_REWRITES: 'MERGE_PROFESSIONAL_REWRITES',
  SET_JUST_SAVED: 'SET_JUST_SAVED',
  REORDER_FACTS: 'REORDER_FACTS',
  SAVE_COMPLETE: 'SAVE_COMPLETE',
  SWITCH_SUB_DOCUMENT: 'SWITCH_SUB_DOCUMENT'
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

      // Auto-set activeSubDocument for divorce_package if not already set
      const mergedDoc = { ...state.currentDocument, ...updates };
      if (mergedDoc.documentType === 'divorce_package' && !mergedDoc.activeSubDocument) {
        updates.activeSubDocument = 'divorce_petition';
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

    case ActionTypes.SET_JUST_SAVED:
      return {
        ...state,
        justSaved: action.payload
      };

    case ActionTypes.SAVE_COMPLETE:
      return {
        ...state,
        isSaving: false,
        lastSaved: action.payload.lastSaved,
        justSaved: true
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
        documents: [], // SECURITY: Clear documents list to prevent data leakage
        preview: null,
        validation: null,
        error: null,
        hasUnsavedChanges: false,
        sessionInitialized: false
      };
    
    case ActionTypes.SELECT_DOCUMENT:
      return {
        ...state,
        currentDocument: {
          ...action.payload,
          // Clear UI cache fields when switching documents
          factSummary: null,
          factSignature: null
        },
        preview: null,
        validation: null,
        error: null,
        hasUnsavedChanges: false,
        sessionInitialized: true // Existing document = initialized
      };

    case ActionTypes.MERGE_PROFESSIONAL_REWRITES:
      // Merge professional rewrites from validation results into facts
      const validationResults = action.payload;
      if (!validationResults?.results || !Array.isArray(state.currentDocument.facts)) {
        return state;
      }

      const updatedFacts = state.currentDocument.facts.map((fact, index) => {
        const validationResult = validationResults.results[index];
        if (validationResult && validationResult.professionalRewrite) {
          return {
            ...fact,
            professionalRewrite: validationResult.professionalRewrite,
            // Optionally store other validation metadata
            category: validationResult.category,
            validationScore: validationResult.legalStandardScore
          };
        }
        return fact;
      });

      return {
        ...state,
        currentDocument: {
          ...state.currentDocument,
          facts: updatedFacts
        },
        hasUnsavedChanges: true
      };

    case ActionTypes.REORDER_FACTS:
      // Reorder facts array - payload: { fromIndex, toIndex }
      const { fromIndex, toIndex } = action.payload;
      const facts = [...state.currentDocument.facts];
      const [movedFact] = facts.splice(fromIndex, 1);
      facts.splice(toIndex, 0, movedFact);

      return {
        ...state,
        currentDocument: {
          ...state.currentDocument,
          facts
        },
        hasUnsavedChanges: true
      };

    case ActionTypes.SWITCH_SUB_DOCUMENT:
      // Switch between divorce petition and decree views
      // payload: 'divorce_petition' or 'divorce_decree'
      const newSubDoc = action.payload;
      if (newSubDoc !== 'divorce_petition' && newSubDoc !== 'divorce_decree') {
        return state;
      }
      // Keep the original documentType (e.g., 'divorce_package') intact
      // Only update activeSubDocument for view switching
      const originalDocType = state.currentDocument.documentType;
      const preserveDocType = originalDocType === 'divorce_package';
      return {
        ...state,
        currentDocument: {
          ...state.currentDocument,
          activeSubDocument: newSubDoc,
          documentType: preserveDocType ? originalDocType : newSubDoc
        },
        // Clear preview so it regenerates for the new sub-document
        preview: null
      };

    default:
      return state;
  }
};

/**
 * ✅ Document Provider Component - CLEAN ARCHITECTURE
 */
export const DocumentProvider = ({ children }) => {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();
  const { tosVerified } = useTOS();
  const [state, dispatch] = useReducer(documentReducer, initialState);
  const [autoSaveTimer, setAutoSaveTimer] = useState(null);
  const [previewDebounceTimer, setPreviewDebounceTimer] = useState(null);

  // ✅ Ref to access current state without causing dependency changes
  const stateRef = useRef(state);
  stateRef.current = state;

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

  // Generate preview
  const generatePreview = useCallback(async (documentData = null) => {
    try {
      dispatch({ type: ActionTypes.SET_PREVIEW_LOADING, payload: true });

      // Access state via ref to avoid dependency on state.currentDocument
      const payload = {
        affidavitData: {
          ...stateRef.current.currentDocument,
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
  }, [authFetch]);

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
        // Server may return the parsed content under `affidavitData` or under `content`.
        // Support both shapes and fall back safely.
        let documentContent = {};

        const rawContent = data.document.affidavitData ?? data.document.content;

        if (rawContent) {
          try {
            documentContent = typeof rawContent === 'string' 
              ? JSON.parse(rawContent)
              : rawContent;
          } catch (e) {
            console.error('Failed to parse document content:', e);
            documentContent = rawContent;
          }
        }

        // Clear UI cache fields that shouldn't be restored from database
        const documentWithId = {
          ...documentContent,
          documentId: data.document.id,
          factSummary: null,
          factSignature: null
        };

        dispatch({
          type: ActionTypes.SELECT_DOCUMENT,
          payload: documentWithId
        });
        
        // ✅ Generate preview after loading document
        setTimeout(() => {
          console.log('📊 Generating preview after document load:', documentId);
          generatePreview(documentWithId);
        }, 100);
        
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
  }, [authFetch, generatePreview]);

  // ✅ NEW: Initialize a new document session
  // documentType: 'affidavit' (default) or 'divorce_package'
  const initializeNewDocument = useCallback(async (forceNew = false, documentType = 'affidavit') => {
    if (!isAuthenticated) {
      console.warn('Cannot initialize document: User not authenticated');
      return null;
    }

    // ✅ FIX: Prevent multiple simultaneous document creations
    // Access state via ref to avoid dependency on state values
    if (stateRef.current.isSaving) {
      console.log('📄 Document creation already in progress');
      return null;
    }

    // ✅ If forceNew, reset state first to ensure clean slate
    if (forceNew) {
      console.log('📄 Force new document - resetting state');
      dispatch({ type: ActionTypes.RESET_DOCUMENT });
      // Note: We continue immediately because we know we want a new document
    } else if (stateRef.current.currentDocument.documentId) {
      // Only check for existing document if not forcing new
      console.log('📄 Document already exists:', stateRef.current.currentDocument.documentId);
      if (!stateRef.current.sessionInitialized) {
        dispatch({ type: ActionTypes.SET_SESSION_INITIALIZED, payload: true });
      }
      return stateRef.current.currentDocument.documentId;
    }

    // Determine if this is a divorce package
    const isDivorcePackage = documentType === 'divorce_package';
    const defaultTitle = isDivorcePackage ? 'Untitled Divorce Package' : 'Untitled Affidavit';
    // For divorce packages, use 'divorce_petition' as the internal documentType
    // and track activeSubDocument for switching between petition/decree views
    const internalDocType = isDivorcePackage ? 'divorce_petition' : 'general';

    try {
      console.log('📄 Creating new document...', { documentType, isDivorcePackage });
      dispatch({ type: ActionTypes.SET_SAVING, payload: true });

      // Create empty document
      const payload = {
        affidavitData: {
          state: '',
          affiantName: '',
          caseNumber: '',
          courtName: '',
          plaintiff: '',
          defendant: '',
          county: '',
          caseType: '',
          documentType: internalDocType,
          activeSubDocument: isDivorcePackage ? 'divorce_petition' : null,
          facts: []
        },
        title: defaultTitle,
        content: JSON.stringify({
          state: '',
          affiantName: '',
          documentType: internalDocType,
          activeSubDocument: isDivorcePackage ? 'divorce_petition' : null,
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

        // Safely extract affidavit data from the response. The server may return
        // parsed affidavit data under `document.affidavitData` or as `document.content`.
        let createdContent = {};
        const raw = data.document.affidavitData ?? data.document.content;
        if (raw) {
          try {
            createdContent = typeof raw === 'string' ? JSON.parse(raw) : raw;
          } catch (e) {
            console.warn('Failed to parse created document content, using raw value', e);
            createdContent = raw;
          }
        }

        // Set the document data (do not spread undefined)
        dispatch({
          type: ActionTypes.SET_DOCUMENT_DATA,
          payload: {
            ...createdContent,
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
  }, [authFetch, isAuthenticated, loadDocuments]);

  // ✅ SIMPLIFIED: Save document (always updates existing)
  const saveDocument = useCallback(async (documentData = null) => {
    if (!isAuthenticated) {
      throw new Error('Authentication required to save documents');
    }

    // Access state via ref to avoid dependency on state.currentDocument
    const documentId = stateRef.current.currentDocument.documentId;

    if (!documentId) {
      throw new Error('No document ID - session not initialized');
    }

    try {
      dispatch({ type: ActionTypes.SET_SAVING, payload: true });

      // Merge current document with any provided data
      const fullDocumentData = {
        ...stateRef.current.currentDocument,
        ...(documentData || {}),
        documentId // Always include the ID
      };

      console.log('💾 Saving document:', documentId);
      console.log('💾 Document title being saved:', fullDocumentData.documentTitle);
      console.log('💾 Full document data:', {
        documentTitle: fullDocumentData.documentTitle,
        firstName: fullDocumentData.firstName,
        lastName: fullDocumentData.lastName,
        affiantName: fullDocumentData.affiantName
      });

      // Build payload
      const payload = {
        affidavitData: {
          state: fullDocumentData.state || '',
          affiantName: fullDocumentData.affiantName || '',
          firstName: fullDocumentData.firstName || '',
          lastName: fullDocumentData.lastName || '',
          documentTitle: fullDocumentData.documentTitle || '',
          caseNumber: fullDocumentData.caseNumber || '',
          courtName: fullDocumentData.courtName || '',
          plaintiff: fullDocumentData.plaintiff || '',
          defendant: fullDocumentData.defendant || '',
          county: fullDocumentData.county || '',
          caseType: fullDocumentData.caseType || '',
          documentType: fullDocumentData.documentType || 'general',
          facts: fullDocumentData.facts || [],
          documentId // Include for backend to know it's an update
        },
        title: fullDocumentData.documentTitle ||
          (fullDocumentData.affiantName
            ? `Affidavit of ${fullDocumentData.affiantName}`
            : 'Untitled Affidavit'),
        content: JSON.stringify(fullDocumentData)
      };

      const data = await authFetch('/api/documents/save', {
        method: 'POST',
        body: JSON.stringify(payload)
      });

      if (data.success) {
        console.log('💾 Document saved successfully');

        // Batch save completion updates to reduce re-renders
        dispatch({
          type: ActionTypes.SAVE_COMPLETE,
          payload: { lastSaved: new Date() }
        });

        // Clear justSaved flag after 2.5 seconds
        setTimeout(() => {
          dispatch({
            type: ActionTypes.SET_JUST_SAVED,
            payload: false
          });
        }, 2500);

        // Update validation if included in response
        if (data.validation) {
          dispatch({
            type: ActionTypes.SET_VALIDATION,
            payload: data.validation
          });
        }

        // NOTE: We don't reload the documents list here because:
        // 1. It causes unnecessary re-renders of DocumentPreview and other components
        // 2. The dashboard will refresh when user navigates back to it
        // 3. The current document data is already up-to-date in state
        // If we need the documents list updated, the dashboard will call loadDocuments on mount

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

      dispatch({ type: ActionTypes.SET_SAVING, payload: false });

      throw error;
    }
  }, [authFetch, isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  // ✅ Auto-save functionality
  const scheduleAutoSave = useCallback(() => {
    if (autoSaveTimer) {
      clearTimeout(autoSaveTimer);
    }

    const timer = setTimeout(() => {
      // Access state via ref to avoid dependency on state values
      if (isAuthenticated &&
          stateRef.current.hasUnsavedChanges &&
          stateRef.current.currentDocument.documentId &&
          (stateRef.current.currentDocument.affiantName ||
           stateRef.current.currentDocument.state ||
           (stateRef.current.currentDocument.facts && stateRef.current.currentDocument.facts.length > 0))) {

        console.log('⏰ Auto-saving document...');
        saveDocument().catch(error => {
          console.log('⏰ Auto-save failed:', error.message);
        });
      }
    }, 30000); // Auto-save after 30 seconds of inactivity

    setAutoSaveTimer(timer);
  }, [isAuthenticated, saveDocument, autoSaveTimer]);

  // Render formatted preview for a saved document by documentId (on-demand)
  const renderFormattedPreview = useCallback(async (documentId) => {
    if (!isAuthenticated) throw new Error('Authentication required');

    try {
      dispatch({ type: ActionTypes.SET_PREVIEW_LOADING, payload: true });
      const data = await authFetch(`/api/documents/${documentId}/render`, {
        method: 'POST'
      });

      if (data.success) {
        // data contains { formatted, items }
        return { formatted: data.formatted, items: data.items, fromCache: data.fromCache };
      }
      throw new Error(data.error || 'Render failed');
    } catch (err) {
      console.error('Failed to render formatted preview:', err);
      throw err;
    } finally {
      dispatch({ type: ActionTypes.SET_PREVIEW_LOADING, payload: false });
    }
  }, [authFetch, isAuthenticated]);

  // Validate document
  // If mergeProfessionalRewrites is true, will automatically merge the professional rewrites into facts
  const validateDocument = useCallback(async (documentData = null, options = {}) => {
    try {
      const { mergeProfessionalRewrites = false } = options;

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

        // Optionally merge professional rewrites into facts
        if (mergeProfessionalRewrites && data.validation.factValidation) {
          dispatch({
            type: ActionTypes.MERGE_PROFESSIONAL_REWRITES,
            payload: data.validation.factValidation
          });
        }

        return data.validation;
      }
    } catch (error) {
      console.error('Failed to validate document:', error);
    }
  }, [authFetch, state.currentDocument]);

  // Helper function to merge professional rewrites manually (for use in components)
  const mergeProfessionalRewrites = useCallback((validationResults) => {
    if (validationResults && validationResults.results) {
      dispatch({
        type: ActionTypes.MERGE_PROFESSIONAL_REWRITES,
        payload: validationResults
      });
    }
  }, []);

  // Create new document (resets state)
  const createNewDocument = useCallback(() => {
    dispatch({ type: ActionTypes.RESET_DOCUMENT });
  }, []);

  // Select an existing document
  const selectDocument = useCallback((document) => {
    if (!document) return;

    // Support both shapes: { content } or { affidavitData }
    const raw = document.content ?? document.affidavitData ?? document;

    let parsed = {};
    try {
      parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    } catch (e) {
      parsed = raw;
    }

    dispatch({
      type: ActionTypes.SELECT_DOCUMENT,
      payload: {
        ...parsed,
        documentId: document.id
      }
    });

    setTimeout(() => {
      const documentWithId = { ...parsed, documentId: document.id };
      generatePreview(documentWithId);
    }, 100);
  }, [generatePreview]);

  // ✅ FIXED: Update document data with proper state synchronization and debouncing
  const updateDocumentData = useCallback((data) => {
    console.log('📝 Updating document data', {
      hasName: !!data.affiantName,
      hasState: !!data.state,
      factCount: data.facts?.length,
      updatingFields: Object.keys(data)
    });

    dispatch({
      type: ActionTypes.UPDATE_DOCUMENT_DATA,
      payload: data
    });

    // ✅ NEW: If facts were updated, auto-save immediately (don't wait 30 seconds)
    const factsUpdated = data.facts && Array.isArray(data.facts);
    if (factsUpdated) {
      console.log('💾 Facts updated - triggering immediate auto-save');
      // Save immediately when facts change
      // CRITICAL: Pass the updated data to saveDocument so it saves the NEW facts, not old state
      if (isAuthenticated && stateRef.current.currentDocument.documentId) {
        saveDocument(data).catch(error => {
          console.error('Immediate auto-save failed:', error);
        });
      }
    } else {
      // For other updates, schedule auto-save as before
      scheduleAutoSave();
    }

    // Check if only metadata fields were updated (don't affect preview rendering)
    const metadataOnlyFields = ['documentTitle'];
    const changedFields = Object.keys(data);
    const hasPreviewAffectingChanges = changedFields.some(
      field => !metadataOnlyFields.includes(field)
    );

    // Skip preview generation if only metadata changed
    if (!hasPreviewAffectingChanges) {
      console.log('📝 Skipping preview generation - metadata-only change:', changedFields);
      return;
    }

    // ✅ FIX: Clear any existing preview debounce timer to prevent multiple preview generations
    if (previewDebounceTimer) {
      clearTimeout(previewDebounceTimer);
    }

    // ✅ FIX: Merge the update with current state BEFORE passing to generatePreview
    const updatedDocument = {
      ...state.currentDocument,
      ...data,
      // Preserve documentId
      documentId: state.currentDocument.documentId
    };

    console.log('🔄 Merged document for preview:', {
      factCount: updatedDocument.facts?.length,
      firstFact: updatedDocument.facts?.[0],
      lastFact: updatedDocument.facts?.[updatedDocument.facts?.length - 1]
    });

    // Generate preview after a short delay with the fully merged data
    const timer = setTimeout(() => {
      console.log('🔄 Generating preview after document update');
      generatePreview(updatedDocument);  // Pass full merged document
      setPreviewDebounceTimer(null);
    }, 500);

    setPreviewDebounceTimer(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
}, [generatePreview, scheduleAutoSave, saveDocument, isAuthenticated, state.currentDocument]);

  // Update document data WITHOUT triggering preview generation
  // Used when storing professional rewrites before they are applied
  const updateDocumentDataWithoutPreview = useCallback((data) => {
    console.log('📝 Updating document data (no preview)');

    dispatch({
      type: ActionTypes.UPDATE_DOCUMENT_DATA,
      payload: data
    });

    // Schedule auto-save
    scheduleAutoSave();
  }, [scheduleAutoSave]);

  // Reorder facts
  const reorderFacts = useCallback((fromIndex, toIndex) => {
    console.log('🔄 Reordering facts:', { fromIndex, toIndex });

    dispatch({
      type: ActionTypes.REORDER_FACTS,
      payload: { fromIndex, toIndex }
    });

    // Trigger preview regeneration and auto-save
    const timer = setTimeout(() => {
      generatePreview();
      scheduleAutoSave();
    }, 500);

    setPreviewDebounceTimer(timer);
  }, [generatePreview, scheduleAutoSave]);

  // Switch between divorce petition and decree views (for divorce packages)
  const switchSubDocument = useCallback((subDocType) => {
    if (subDocType !== 'divorce_petition' && subDocType !== 'divorce_decree') {
      console.warn('Invalid sub-document type:', subDocType);
      return;
    }

    console.log('📄 Switching to sub-document:', subDocType);

    dispatch({
      type: ActionTypes.SWITCH_SUB_DOCUMENT,
      payload: subDocType
    });

    // Generate preview for the new sub-document type
    // Keep the original documentType but pass activeSubDocument for the backend to use
    setTimeout(() => {
      const currentDoc = stateRef.current.currentDocument;
      const updatedDoc = {
        ...currentDoc,
        activeSubDocument: subDocType,
        // Preserve divorce_package type but signal which sub-doc to render
        documentType: currentDoc.documentType === 'divorce_package'
          ? 'divorce_package'
          : subDocType
      };
      generatePreview(updatedDoc);
    }, 100);
  }, [generatePreview]);

  // Load documents on mount - only after TOS is verified
  useEffect(() => {
    if (isAuthenticated && tosVerified) {
      console.log('[DocumentContext] Auth and TOS verified, loading documents');
      loadDocuments();
    } else if (isAuthenticated && !tosVerified) {
      console.log('[DocumentContext] Waiting for TOS verification before loading documents');
    }
  }, [isAuthenticated, tosVerified, loadDocuments]);

  // SECURITY: Clear all user data when user logs out
  useEffect(() => {
    if (!isAuthenticated) {
      console.log('[DocumentContext] User logged out, clearing all user data');
      // Clear documents array to prevent showing previous user's data
      dispatch({ type: ActionTypes.SET_DOCUMENTS, payload: [] });
      // Reset current document
      dispatch({ type: ActionTypes.RESET_DOCUMENT });
    }
  }, [isAuthenticated]);

  // Clean up timers
  useEffect(() => {
    return () => {
      if (autoSaveTimer) {
        clearTimeout(autoSaveTimer);
      }
      if (previewDebounceTimer) {
        clearTimeout(previewDebounceTimer);
      }
    };
  }, [autoSaveTimer, previewDebounceTimer]);

  // Memoize context values to prevent unnecessary re-renders
  const documentDataValue = useMemo(() => ({
    currentDocument: state.currentDocument,
    preview: state.preview,
    isPreviewLoading: state.isPreviewLoading
  }), [state.currentDocument, state.preview, state.isPreviewLoading]);

  const documentListValue = useMemo(() => ({
    documents: state.documents,
    isDocumentsLoading: state.isDocumentsLoading
  }), [state.documents, state.isDocumentsLoading]);

  const saveMetadataValue = useMemo(() => ({
    isSaving: state.isSaving,
    lastSaved: state.lastSaved,
    justSaved: state.justSaved,
    hasUnsavedChanges: state.hasUnsavedChanges
  }), [state.isSaving, state.lastSaved, state.justSaved, state.hasUnsavedChanges]);

  const uiValue = useMemo(() => ({
    isLoading: state.isLoading,
    error: state.error,
    validation: state.validation,
    sessionInitialized: state.sessionInitialized
  }), [state.isLoading, state.error, state.validation, state.sessionInitialized]);

  const actionsValue = useMemo(() => ({
    loadDocument,
    loadDocuments,
    saveDocument,
    generatePreview,
    validateDocument,
    createNewDocument,
    selectDocument,
    updateDocumentData,
    updateDocumentDataWithoutPreview,
    initializeNewDocument,
    renderFormattedPreview,
    mergeProfessionalRewrites,
    reorderFacts,
    switchSubDocument
  }), [
    loadDocument,
    loadDocuments,
    saveDocument,
    generatePreview,
    validateDocument,
    createNewDocument,
    selectDocument,
    updateDocumentData,
    updateDocumentDataWithoutPreview,
    initializeNewDocument,
    renderFormattedPreview,
    mergeProfessionalRewrites,
    reorderFacts,
    switchSubDocument
  ]);

  return (
    <DocumentDataContext.Provider value={documentDataValue}>
      <DocumentListContext.Provider value={documentListValue}>
        <SaveMetadataContext.Provider value={saveMetadataValue}>
          <UIContext.Provider value={uiValue}>
            <DocumentActionsContext.Provider value={actionsValue}>
              {children}
            </DocumentActionsContext.Provider>
          </UIContext.Provider>
        </SaveMetadataContext.Provider>
      </DocumentListContext.Provider>
    </DocumentDataContext.Provider>
  );
};

// Custom hooks for using split contexts (RECOMMENDED - prevents unnecessary re-renders)
export const useDocumentData = () => useContext(DocumentDataContext);
export const useDocumentList = () => useContext(DocumentListContext);
export const useSaveMetadata = () => useContext(SaveMetadataContext);
export const useUIState = () => useContext(UIContext);
export const useDocumentActions = () => useContext(DocumentActionsContext);

// Legacy hook for backward compatibility (DEPRECATED - causes excessive re-renders)
// Components should migrate to the specific hooks above
export const useDocumentState = () => {
  const documentData = useContext(DocumentDataContext);
  const documentList = useContext(DocumentListContext);
  const saveMetadata = useContext(SaveMetadataContext);
  const uiState = useContext(UIContext);

  // Return combined state for backward compatibility
  return useMemo(() => ({
    ...documentData,
    ...documentList,
    ...saveMetadata,
    ...uiState
  }), [documentData, documentList, saveMetadata, uiState]);
};

// Export for testing
export { ActionTypes };
