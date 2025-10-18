// client/src/views/EditorView.js - FIXED VERSION
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeft, Gavel, Save, Download, MessageSquare, Eye, Settings, GripVertical } from 'lucide-react';
import { useAuth0 } from '@auth0/auth0-react';
import { useDocumentState, useDocumentActions } from '../contexts/DocumentContext';
import ChatInterface from '../components/ChatInterface';
import DocumentPreview from '../components/DocumentPreview';
import ValidationSidebar from '../components/ValidationSidebar';

// Resizer component for adjusting pane widths
const Resizer = ({ onResize, isResizing, setIsResizing, position = 'between-chat-preview' }) => {
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);

    const startX = e.clientX;
    const container = e.target.closest('.editor-layout');
    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width;

    const handleMouseMove = (e) => {
      const deltaX = e.clientX - startX;
      const deltaPercentage = (deltaX / containerWidth) * 100;
      
      if (position === 'between-chat-preview') {
        onResize(deltaPercentage, 'chat-preview');
      } else if (position === 'between-preview-validation') {
        onResize(deltaPercentage, 'preview-validation');
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [onResize, setIsResizing, position]);

  return (
    <div
      className={`w-2 bg-gray-200 cursor-col-resize hover:bg-blue-300 transition-colors group flex items-center justify-center ${
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

// Main Editor View Component with 35/35/30 proportions
const EditorView = ({ isNew = false, onBack }) => {
  const { isAuthenticated } = useAuth0();
  const { documentId } = useParams(); // ✅ Get documentId from URL
  
  // Layout state with new proportions (35/35/30)
  const [chatWidth, setChatWidth] = useState(35);
  const [previewWidth, setPreviewWidth] = useState(35);
  const [validationWidth, setValidationWidth] = useState(30);
  const [isResizing, setIsResizing] = useState(false);
  const [activePanel, setActivePanel] = useState('chat');
  const [isMobileView, setIsMobileView] = useState(false);
  const [sessionInitialized, setSessionInitialized] = useState(false);
  
  // Use DocumentContext for all document-related state
  const { 
    currentDocument, 
    preview, 
    isPreviewLoading, 
    isSaving,
    lastSaved,
    hasUnsavedChanges
  } = useDocumentState();
  
  const { 
    saveDocument, 
    loadDocument,
    createNewDocument,
    initializeNewDocument
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

  // ✅ FIXED: Properly handle document loading and switching
  useEffect(() => {
    console.log('📂 Loading document from URL:', documentId);
    
    // Reset session when documentId changes
    if (sessionInitialized && documentId && currentDocument.documentId?.toString() !== documentId) {
      console.log('🔄 Document ID changed, resetting session');
      setSessionInitialized(false);
    }
    
    // Initialize session based on route
    const initializeSession = async () => {
      if (sessionInitialized) {
        console.log('✅ Session already initialized with document:', currentDocument.documentId);
        return;
      }

      if (isNew) {
        // Creating a new document on the server and initialize session
        console.log('📝 Creating new document (server)');
        try {
          await initializeNewDocument();
          setSessionInitialized(true);
        } catch (err) {
          console.error('Failed to initialize new document on server:', err);
        }
      } else if (documentId && isAuthenticated) {
        // Loading existing document from URL
        console.log('📂 Loading existing document:', documentId);
        try {
          await loadDocument(documentId);
          setSessionInitialized(true);
          console.log('✅ Document loaded:', documentId);
        } catch (error) {
          console.error('❌ Failed to load document:', error);
        }
      }
    };

    initializeSession();
    
    // ✅ CRITICAL: Cleanup when documentId changes
    return () => {
      if (documentId && currentDocument.documentId?.toString() !== documentId) {
        console.log('🧹 Cleaning up old document session');
        setSessionInitialized(false);
      }
    };
  }, [documentId, isNew, isAuthenticated, loadDocument, createNewDocument, sessionInitialized, currentDocument.documentId]);

  // Handle pane resizing with constraints
  const handlePaneResize = useCallback((deltaPercentage, resizeType) => {
    if (resizeType === 'chat-preview') {
      const newChatWidth = Math.max(20, Math.min(50, chatWidth + deltaPercentage));
      const newPreviewWidth = Math.max(20, Math.min(50, previewWidth - deltaPercentage));
      
      const availableSpace = 100 - validationWidth;
      const totalNewWidth = newChatWidth + newPreviewWidth;
      
      if (totalNewWidth <= availableSpace) {
        setChatWidth(newChatWidth);
        setPreviewWidth(newPreviewWidth);
      }
    } else if (resizeType === 'preview-validation') {
      const newPreviewWidth = Math.max(20, Math.min(50, previewWidth + deltaPercentage));
      const newValidationWidth = Math.max(20, Math.min(50, validationWidth - deltaPercentage));
      
      const availableSpace = 100 - chatWidth;
      const totalNewWidth = newPreviewWidth + newValidationWidth;
      
      if (totalNewWidth <= availableSpace) {
        setPreviewWidth(newPreviewWidth);
        setValidationWidth(newValidationWidth);
      }
    }
  }, [chatWidth, previewWidth, validationWidth]);

  // Handle manual save
  const handleSaveProgress = async () => {
    if (!isAuthenticated) {
      console.warn('Cannot save: User not authenticated');
      return;
    }
    
    try {
      const documentId = await saveDocument();
      if (documentId) {
        console.log('✅ Document saved:', documentId);
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

  // Desktop layout with new proportions
  const renderDesktopLayout = () => (
    <div className="flex-1 flex min-h-0 editor-layout">
      {/* Chat Panel - 35% default */}
      <div 
        className="bg-white border-r flex flex-col"
        style={{ width: `${chatWidth}%` }}
      >
        <ChatInterface />
      </div>

      {/* Resizer between Chat and Preview */}
      <Resizer
        onResize={handlePaneResize}
        isResizing={isResizing}
        setIsResizing={setIsResizing}
        position="between-chat-preview"
      />

      {/* Preview Panel - 35% default */}
      <div 
        className="bg-gray-50 flex flex-col min-h-0"
        style={{ width: `${previewWidth}%` }}
      >
        <DocumentPreview />
      </div>

      {/* Resizer between Preview and Validation */}
      <Resizer
        onResize={handlePaneResize}
        isResizing={isResizing}
        setIsResizing={setIsResizing}
        position="between-preview-validation"
      />

      {/* Validation Panel - 30% default */}
      <div 
        className="bg-white border-l flex flex-col"
        style={{ width: `${validationWidth}%` }}
      >
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

  // Calculate save status text
  const getSaveStatusText = () => {
    if (isSaving) return 'Saving...';
    if (hasUnsavedChanges) return 'Unsaved changes';
    if (lastSaved) {
      const timeAgo = Math.floor((Date.now() - new Date(lastSaved).getTime()) / 1000);
      if (timeAgo < 60) return 'Saved just now';
      if (timeAgo < 3600) return `Saved ${Math.floor(timeAgo / 60)}m ago`;
      return `Saved ${Math.floor(timeAgo / 3600)}h ago`;
    }
    return '';
  };

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
                {isNew ? 'New Affidavit' : 'Edit Affidavit'}
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Save status */}
            <div className="text-sm text-gray-600">
              {getSaveStatusText()}
            </div>
            
            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveProgress}
                disabled={isSaving || !isAuthenticated}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Save className="h-4 w-4" />
                {isSaving ? 'Saving...' : 'Save'}
              </button>
              
              <button
                onClick={handleDownload}
                disabled={!currentDocument.documentId}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Download className="h-4 w-4" />
                Download
              </button>
            </div>
          </div>
        </div>
        
        {/* Document info bar */}
        <div className="mt-3 flex items-center gap-6 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <span>Document:</span>
            <span className="font-medium">
              {currentDocument.affiantName || 'Unnamed'} - {currentDocument.state || 'No state'}
            </span>
          </div>
          
          {currentDocument.facts?.length > 0 && (
            <div className="flex items-center gap-2">
              <span>Facts:</span>
              <span className="font-medium">{currentDocument.facts.length}</span>
            </div>
          )}
          
          {preview?.metadata?.estimatedPages && (
            <div className="flex items-center gap-2">
              <span>Est. Pages:</span>
              <span className="font-medium">{preview.metadata.estimatedPages}</span>
            </div>
          )}
          
          {/* Current document ID (for debugging) */}
          {!isMobileView && documentId && (
            <div className="text-xs text-gray-400 ml-auto">
              Doc ID: {documentId} | Layout: {Math.round(chatWidth)}% | {Math.round(previewWidth)}% | {Math.round(validationWidth)}%
            </div>
          )}
        </div>
      </header>

      {/* Main content area */}
      {isMobileView ? renderMobileLayout() : renderDesktopLayout()}
    </div>
  );
};

export default EditorView;
