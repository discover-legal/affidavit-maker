// client/src/views/EditorView.js - FIXED VERSION WITHOUT DUPLICATION
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { 
  Gavel, 
  GripVertical, 
  MessageSquare, 
  Eye, 
  Settings,
  Save,
  Download,
  ArrowLeft,
  Check
} from 'lucide-react';

// Import DocumentContext hooks
import { useDocumentState, useDocumentActions } from '../contexts/DocumentContext';

import ChatInterface from '../components/ChatInterface';
import DocumentPreview from '../components/DocumentPreview';
import ValidationSidebar from '../components/ValidationSidebar';

// Resizer Component (unchanged)
const Resizer = ({ onResize, isResizing, setIsResizing }) => {
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
    setStartX(e.clientX);
    setStartWidth(42);
  }, [setIsResizing]);

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      
      const deltaX = e.clientX - startX;
      const containerWidth = window.innerWidth;
      const deltaPercent = (deltaX / containerWidth) * 100;
      const newWidth = Math.max(25, Math.min(65, startWidth + deltaPercent));
      
      onResize(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, startX, startWidth, onResize]);

  return (
    <div
      className={`group w-2 bg-gray-200 hover:bg-blue-200 cursor-col-resize transition-colors ${
        isResizing ? 'bg-blue-200' : ''
      }`}
      onMouseDown={handleMouseDown}
      style={{ minWidth: '8px' }}
    >
      <div className={`flex flex-col justify-center h-full opacity-0 group-hover:opacity-100 transition-opacity ${
        isResizing ? 'opacity-100' : ''
      }`}>
        <GripVertical className="h-4 w-4 text-gray-400" />
      </div>
    </div>
  );
};

// Main Editor View Component - FIXED
const EditorView = ({ existingDocument = null, onBack }) => {
  const { isAuthenticated } = useAuth0();
  
  // Layout state (UI only)
  const [chatWidth, setChatWidth] = useState(42);
  const [isResizing, setIsResizing] = useState(false);
  const [activePanel, setActivePanel] = useState('chat');
  const [isMobileView, setIsMobileView] = useState(false);
  
  // Use DocumentContext for all document-related state
  const { 
    currentDocument, 
    preview, 
    isPreviewLoading, 
    isSaving,
    lastSaved,
    hasUnsavedChanges,
    isValidating,
    validation
  } = useDocumentState();
  
  const { 
    saveDocument, 
    loadDocument,
    selectDocument,
    createNewDocument
  } = useDocumentActions();

  // Check for mobile view
  useEffect(() => {
    const checkMobileView = () => {
      setIsMobileView(window.innerWidth < 768);
    };
    
    checkMobileView();
    window.addEventListener('resize', checkMobileView);
    return () => window.removeEventListener('resize', checkMobileView);
  }, []);

  // Load existing document if provided
  useEffect(() => {
    if (existingDocument?.id) {
      loadDocument(existingDocument.id);
    } else if (existingDocument) {
      selectDocument(existingDocument);
    }
  }, [existingDocument, loadDocument, selectDocument]);

  // Handle manual save
  const handleSaveProgress = async () => {
    if (!isAuthenticated) {
      console.warn('Cannot save: User not authenticated');
      return;
    }
    
    try {
      const documentId = await saveDocument();
      if (documentId) {
        console.log('Document saved with ID:', documentId);
      }
    } catch (error) {
      console.error('Save error:', error);
    }
  };

  // Handle PDF download
  const handleDownload = async () => {
    if (!currentDocument.documentId) {
      alert('Please save the document first');
      return;
    }
    
    // TODO: Implement PDF download
    console.log('Download PDF for document:', currentDocument.documentId);
  };

  // Mobile panel navigation
  const renderMobileNavigation = () => (
    <div className="flex border-b bg-white">
      <button
        onClick={() => setActivePanel('chat')}
        className={`flex-1 py-4 px-1 border-b-2 font-medium text-sm ${
          activePanel === 'chat'
            ? 'border-blue-600 text-blue-600'
            : 'border-transparent text-gray-600 hover:text-blue-600'
        }`}
      >
        <MessageSquare className="h-4 w-4 mx-auto mb-1" />
        Chat
      </button>
      <button
        onClick={() => setActivePanel('preview')}
        className={`flex-1 py-4 px-1 border-b-2 font-medium text-sm ${
          activePanel === 'preview'
            ? 'border-blue-600 text-blue-600'
            : 'border-transparent text-gray-600 hover:text-blue-600'
        }`}
      >
        <Eye className="h-4 w-4 mx-auto mb-1" />
        Preview
      </button>
      <button
        onClick={() => setActivePanel('validation')}
        className={`flex-1 py-4 px-1 border-b-2 font-medium text-sm ${
          activePanel === 'validation'
            ? 'border-blue-600 text-blue-600'
            : 'border-transparent text-gray-600 hover:text-blue-600'
        }`}
      >
        <Settings className="h-4 w-4 mx-auto mb-1" />
        Validate
      </button>
    </div>
  );

  // Desktop layout
  const renderDesktopLayout = () => (
    <div className="flex-1 flex min-h-0">
      {/* Chat Panel */}
      <div 
        className="bg-white border-r flex flex-col"
        style={{ width: `${chatWidth}%` }}
      >
        <ChatInterface />
      </div>

      {/* Resizer */}
      <Resizer
        onResize={setChatWidth}
        isResizing={isResizing}
        setIsResizing={setIsResizing}
      />

      {/* Preview Panel */}
      <div 
        className="bg-gray-50 flex flex-col min-h-0"
        style={{ width: `${100 - chatWidth - 20}%` }}
      >
        <DocumentPreview />
      </div>

      {/* Validation Sidebar - No props needed! */}
      <div className="w-80 bg-white border-l">
        <ValidationSidebar />
      </div>
    </div>
  );

  // Mobile layout
  const renderMobileLayout = () => (
    <div className="flex-1 flex flex-col min-h-0">
      {renderMobileNavigation()}
      
      <div className="flex-1 min-h-0 overflow-hidden">
        {activePanel === 'chat' && <ChatInterface />}
        {activePanel === 'preview' && <DocumentPreview />}
        {activePanel === 'validation' && <ValidationSidebar />}
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={onBack}
              className="mr-4 p-2 text-gray-500 hover:text-gray-700 rounded-lg transition-colors"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center">
              <Gavel className="h-6 w-6 text-blue-600 mr-2" />
              <h1 className="text-xl font-semibold">
                {existingDocument ? 'Edit Affidavit' : 'Create Affidavit'}
              </h1>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Save Status Indicator */}
            {lastSaved && (
              <div className="flex items-center text-sm text-green-600">
                <Check className="h-4 w-4 mr-1" />
                <span>Saved {new Date(lastSaved).toLocaleTimeString()}</span>
              </div>
            )}
            
            {hasUnsavedChanges && !isSaving && (
              <span className="text-sm text-yellow-600">Unsaved changes</span>
            )}
            
            {/* Save Button */}
            <button
              onClick={handleSaveProgress}
              disabled={isSaving || !hasUnsavedChanges}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center ${
                isSaving || !hasUnsavedChanges
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              <Save className="h-4 w-4 mr-2" />
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            
            {/* Download Button */}
            <button
              onClick={handleDownload}
              disabled={!currentDocument.documentId}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center ${
                !currentDocument.documentId
                  ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
            >
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      {isMobileView ? renderMobileLayout() : renderDesktopLayout()}
    </div>
  );
};

export default EditorView;