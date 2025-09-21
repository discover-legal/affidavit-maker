// client/src/components/DocumentPreview.js - MINIMAL CORRECT VERSION
import React, { useState } from 'react';
import { 
  FileText, 
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  RefreshCw
} from 'lucide-react';
import { useDocumentState, useDocumentActions } from '../contexts/DocumentContext';

const DocumentPreview = () => {
  const { 
    currentDocument, 
    preview, 
    isPreviewLoading 
  } = useDocumentState();
  
  const { generatePreview } = useDocumentActions();
  
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFormatting, setShowFormatting] = useState(true);

  // Toggle fullscreen view
  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  // Refresh preview
  const handleRefresh = () => {
    if (currentDocument) {
      generatePreview(currentDocument);
    }
  };

  // Render empty state
  if (!currentDocument || (!currentDocument.affiantName && !currentDocument.state && (!currentDocument.facts || currentDocument.facts.length === 0))) {
    return (
      <div className="h-full flex flex-col bg-white">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">Document Preview</h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500">Your document preview will appear here</p>
            <p className="text-sm text-gray-400 mt-2">Start chatting to build your affidavit</p>
          </div>
        </div>
      </div>
    );
  }

  // Render loading state
  if (isPreviewLoading) {
    return (
      <div className="h-full flex flex-col bg-white">
        <div className="p-4 border-b">
          <h2 className="text-lg font-semibold text-gray-800">Document Preview</h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 text-blue-600 animate-spin mx-auto mb-2" />
            <p className="text-gray-600">Generating preview...</p>
          </div>
        </div>
      </div>
    );
  }

  // IMPORTANT: Just display what the API sends - StateTemplateManager handles ALL formatting
  const renderSection = (sectionKey, section) => {
    if (!section) return null;
    
    // Different rendering based on section type
    switch (section.type || sectionKey) {
      case 'header':
      case 'venue':
        return (
          <div key={sectionKey} className="mb-6">
            <div className="whitespace-pre-wrap font-mono text-sm">
              {section.content}
            </div>
          </div>
        );
      
      case 'title':
        return (
          <div key={sectionKey} className="text-center mb-8">
            <h1 className="text-2xl font-bold uppercase tracking-wide">
              {section.content || 'AFFIDAVIT'}
            </h1>
          </div>
        );
      
      case 'introduction':
      case 'conclusion':
        return (
          <div key={sectionKey} className="mb-6">
            {section.title && <h2 className="font-bold mb-3">{section.title}</h2>}
            <div className="whitespace-pre-wrap leading-relaxed">
              {section.content}
            </div>
          </div>
        );
      
      case 'facts':
        return (
          <div key={sectionKey} className="mb-6">
            <h2 className="font-bold mb-3">{section.title || 'STATEMENT OF FACTS'}</h2>
            <div className="whitespace-pre-wrap leading-relaxed">
              {section.content}
            </div>
          </div>
        );
      
      case 'signatureBlock':
      case 'notaryBlock':
        return (
          <div key={sectionKey} className="mt-8">
            <div className="whitespace-pre-wrap">
              {section.content}
            </div>
          </div>
        );
      
      default:
        return (
          <div key={sectionKey} className="mb-6">
            {section.title && <h2 className="font-bold mb-3">{section.title}</h2>}
            <div className="whitespace-pre-wrap">
              {section.content}
            </div>
          </div>
        );
    }
  };

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50' : 'h-full'} flex flex-col bg-white`}>
      {/* Header */}
      <div className="p-4 border-b bg-white flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Document Preview</h2>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFormatting(!showFormatting)}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title={showFormatting ? 'Hide formatting' : 'Show formatting'}
          >
            {showFormatting ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
          <button
            onClick={handleRefresh}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Refresh preview"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Document Content - JUST DISPLAY WHAT API SENDS */}
      <div className="flex-1 overflow-y-auto">
        <div className={`${isFullscreen ? 'max-w-4xl mx-auto' : ''} p-8`}>
          <div className={`${showFormatting ? 'bg-white shadow-lg' : ''} p-8 ${showFormatting ? 'border' : ''}`}>
            {preview && preview.sections ? (
              // Display all sections from the API response
              // StateTemplateManager already includes notary block, signature, etc.
              Object.entries(preview.sections).map(([key, section]) => 
                renderSection(key, section)
              )
            ) : (
              // Fallback if no preview
              <div className="text-center py-8">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">Preview will update as you add information</p>
                <button
                  onClick={handleRefresh}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Generate Preview
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Document Stats Footer */}
      {preview && (
        <div className="border-t bg-gray-50 px-4 py-2">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center gap-4">
              <span>Facts: {preview.metadata?.factCount || currentDocument.facts?.length || 0}</span>
              <span>Words: ~{preview.metadata?.wordCount || 0}</span>
              <span>Pages: ~{preview.metadata?.estimatedPages || 1}</span>
            </div>
            <div className="flex items-center gap-2">
              {currentDocument.documentId && (
                <span className="text-xs text-green-600">Saved</span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentPreview;