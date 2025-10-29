// ✅ FIXED: Update document data with proper state synchronization
const updateDocumentData = useCallback((data) => {
  console.log('📝 Updating document data');
  
  dispatch({ 
    type: ActionTypes.UPDATE_DOCUMENT_DATA, 
    payload: data 
  });
  
  // Schedule auto-save
  scheduleAutoSave();
  
  // ✅ FIX: Merge the update with current state BEFORE passing to generatePreview
  const updatedDocument = {
    ...state.currentDocument,
    ...data,
    // Preserve documentId
    documentId: state.currentDocument.documentId
  };
  
  // Generate preview after a short delay with the fully merged data
  const debounceTimer = setTimeout(() => {
    generatePreview(updatedDocument);  // Pass full merged document
  }, 500);
  
  return () => clearTimeout(debounceTimer);
}, [generatePreview, scheduleAutoSave, state.currentDocument]);