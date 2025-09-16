// client/src/views/EditorView.js - ORIGINAL LAYOUT + DocumentContext Fix
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
  ArrowLeft
} from 'lucide-react';

// Import DocumentContext
import { useDocumentState, useDocumentActions } from '../contexts/DocumentContext';

import ChatInterface from '../components/ChatInterface';
import DocumentPreview from '../components/DocumentPreview';
import ValidationSidebar from '../components/ValidationSidebar';

// Resizer Component
const Resizer = ({ onResize, isResizing, setIsResizing }) => {
  const [startX, setStartX] = useState(0);
  const [startWidth, setStartWidth] = useState(0);

  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
    setStartX(e.clientX);
    setStartWidth(42); // Starting width percentage
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
      <div className={`flex flex-col space-y-1 opacity-0 group-hover:opacity-100 transition-opacity ${
        isResizing ? 'opacity-100' : ''
      }`}>
        <GripVertical className="h-4 w-4 text-gray-400" />
      </div>
    </div>
  );
};

// Main Editor View Component
const EditorView = ({ existingDocument = null, onBack }) => {
  const { isAuthenticated } = useAuth0();
  
  // Layout state
  const [chatWidth, setChatWidth] = useState(42);
  const [isResizing, setIsResizing] = useState(false);
  const [activePanel, setActivePanel] = useState('chat'); // 'chat', 'preview', 'validation'
  const [isMobileView, setIsMobileView] = useState(false);
  
  // CORE FIX: Replace local state with DocumentContext
  const { 
    currentDocument, 
    preview, 
    isPreviewLoading, 
    isSaving 
  } = useDocumentState();
  
  const { 
    saveDocument, 
    updateDocumentData,
    selectDocument,
    createNewDocument
  } = useDocumentActions();
  
  // Use currentDocument as affidavitData for compatibility with existing components
  const affidavitData = currentDocument || {
    state: '',
    affiantName: '',
    caseNumber: '',
    caseType: '',
    county: '',
    documentType: 'general',
    facts: [],
    documentId: null
  };

  // Check for mobile view
  useEffect(() => {
    const checkMobileView = () => {
      setIsMobileView(window.innerWidth < 768);
    };
    
    checkMobileView();
    window.addEventListener('resize', checkMobileView);
    return () => window.removeEventListener('resize', checkMobileView);
  }, []);

  // Handle real-time data updates from chat
  const handleDataUpdate = (newData) => {
    updateDocumentData(newData);
  };

  // CORE FIX: Use DocumentContext saveDocument method
  const handleSaveProgress = async () => {
    if (!isAuthenticated) return;
    
    try {
      await saveDocument();
    } catch (error) {
      console.error('Save error:', error);
    }
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
        <ChatInterface
          affidavitData={affidavitData}
          onDataUpdate={handleDataUpdate}
        />
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
        style={{ width: `${100 - chatWidth - 20}%` }} // Reserve space for validation
      >
        <DocumentPreview
          affidavitData={affidavitData}
          preview={preview}
          isLoading={isPreviewLoading}
        />
      </div>

      {/* Validation Sidebar */}
      <div className="w-80 bg-gray-50 border-l">
        <ValidationSidebar 
          affidavitData={affidavitData} 
          onDataUpdate={handleDataUpdate}
        />
      </div>
    </div>
  );

  // Mobile layout
  const renderMobileLayout = () => (
    <div className="flex-1 flex flex-col min-h-0">
      {renderMobileNavigation()}
      
      <div className="flex-1 min-h-0">
        {activePanel === 'chat' && (
          <ChatInterface
            affidavitData={affidavitData}
            onDataUpdate={handleDataUpdate}
          />
        )}
        
        {activePanel === 'preview' && (
          <DocumentPreview
            affidavitData={affidavitData}
            preview={preview}
            isLoading={isPreviewLoading}
          />
        )}
        
        {activePanel === 'validation' && (
          <ValidationSidebar 
            affidavitData={affidavitData} 
            onDataUpdate={handleDataUpdate}
          />
        )}
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
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center">
              <Gavel className="h-6 w-6 text-blue-600 mr-2" />
              <h1 className="text-xl font-semibold">
                {existingDocument ? 'Edit Affidavit' : 'Create New Affidavit'}
              </h1>
            </div>
          </div>
          
          {/* Header Actions */}
          <div className="flex items-center space-x-2">
            {isAuthenticated && (
              <button
                onClick={handleSaveProgress}
                disabled={isSaving}
                className="flex items-center px-3 py-2 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 disabled:opacity-50"
              >
                <Save className="h-4 w-4 mr-1" />
                {isSaving ? 'Saving...' : 'Save Progress'}
              </button>
            )}
            
            <button
              className="flex items-center px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              disabled={!affidavitData.affiantName || !affidavitData.state}
            >
              <Download className="h-4 w-4 mr-1" />
              Generate
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