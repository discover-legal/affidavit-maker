// client/src/components/DocumentPreview.js - Enhanced with 8.5x11 proportions and multi-page support
import React, { useState, useRef, useEffect } from 'react';
import { 
  FileText, 
  Eye,
  EyeOff,
  Maximize2,
  Minimize2,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight
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
  const [zoomLevel, setZoomLevel] = useState(100);
  const [currentPage, setCurrentPage] = useState(1);
  const previewContainerRef = useRef(null);

  // Calculate pages based on content
  const estimatedPages = preview?.metadata?.estimatedPages || 1;
  const totalPages = Math.max(1, estimatedPages);

  // 8.5 x 11 inch aspect ratio (0.7727)
  const PAPER_ASPECT_RATIO = 8.5 / 11;
  const CONTAINER_WIDTH = isFullscreen ? 800 : 600;
  const PAPER_HEIGHT = CONTAINER_WIDTH / PAPER_ASPECT_RATIO;

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

  // Zoom controls
  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(200, prev + 25));
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(50, prev - 25));
  };

  const handleZoomReset = () => {
    setZoomLevel(100);
  };

  // Page navigation
  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
    }
  };

  const goToPrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
    }
  };

  // Apply jurisdiction-specific formatting rules
  const getJurisdictionStyles = () => {
    const state = currentDocument?.state || 'TX';
    const baseStyles = {
      fontFamily: 'Times New Roman, serif',
      fontSize: '12pt',
      lineHeight: '1.6',
      color: '#000000',
    };

    // State-specific formatting requirements
    switch (state.toUpperCase()) {
      case 'TX':
        return {
          ...baseStyles,
          textAlign: 'left',
          marginTop: '1in',
          marginBottom: '1in',
          marginLeft: '1.25in',
          marginRight: '1in',
        };
      case 'CA':
        return {
          ...baseStyles,
          textAlign: 'left',
          marginTop: '1in',
          marginBottom: '1in', 
          marginLeft: '1in',
          marginRight: '1in',
          fontSize: '12pt', // California specifically requires 12pt
        };
      case 'UT':
        return {
          ...baseStyles,
          textAlign: 'left',
          marginTop: '1in',
          marginBottom: '1in',
          marginLeft: '1in',
          marginRight: '1in',
          lineHeight: '1.5', // Utah prefers 1.5 line spacing
        };
      case 'AZ':
        return {
          ...baseStyles,
          textAlign: 'left',
          marginTop: '1in',
          marginBottom: '1in',
          marginLeft: '1in',
          marginRight: '1in',
        };
      default:
        return baseStyles;
    }
  };

  // Split content into pages based on estimated line count
  const paginateContent = (sections) => {
    if (!sections) return [{}];
    
    const LINES_PER_PAGE = 40; // Approximate lines per page with margins
    const pages = [];
    let currentPageContent = {};
    let currentLines = 0;

    Object.entries(sections).forEach(([key, section]) => {
      if (!section) return;
      
      const sectionLines = estimateSectionLines(section);
      
      // If adding this section would exceed page limit, start new page
      if (currentLines + sectionLines > LINES_PER_PAGE && currentLines > 0) {
        pages.push(currentPageContent);
        currentPageContent = {};
        currentLines = 0;
      }
      
      currentPageContent[key] = section;
      currentLines += sectionLines;
    });
    
    // Add the last page if it has content
    if (Object.keys(currentPageContent).length > 0) {
      pages.push(currentPageContent);
    }
    
    return pages.length > 0 ? pages : [{}];
  };

  // Estimate lines for a section
  const estimateSectionLines = (section) => {
    if (!section) return 0;
    
    if (typeof section === 'string') {
      return Math.ceil(section.length / 80) + 1; // ~80 chars per line + spacing
    }
    
    if (section.content) {
      return Math.ceil(section.content.length / 80) + 2; // Extra for section spacing
    }
    
    return 2; // Default spacing
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

  const jurisdictionStyles = getJurisdictionStyles();
  const pages = paginateContent(preview?.sections);
  const currentPageContent = pages[currentPage - 1] || {};

  // Render section content with proper legal formatting
  const renderSection = (sectionKey, section) => {
    if (!section) return null;
    
    const sectionStyle = {
      marginBottom: '16px',
      ...jurisdictionStyles
    };
    
    switch (sectionKey) {
      case 'header':
        return (
          <div key={sectionKey} style={{ ...sectionStyle, textAlign: 'center', fontWeight: 'bold', marginBottom: '24px' }}>
            {section.content || section}
          </div>
        );
      
      case 'venue':
        return (
          <div key={sectionKey} style={{ ...sectionStyle, textAlign: 'right', marginBottom: '24px' }}>
            {section.content || section}
          </div>
        );
      
      case 'title':
        return (
          <div key={sectionKey} style={{ ...sectionStyle, textAlign: 'center', fontWeight: 'bold', fontSize: '14pt', marginBottom: '32px' }}>
            {section.content || section}
          </div>
        );
      
      case 'facts':
        return (
          <div key={sectionKey} style={sectionStyle}>
            <div style={{ fontWeight: 'bold', marginBottom: '16px' }}>
              {section.title || 'STATEMENT OF FACTS'}
            </div>
            <div style={{ textIndent: '0.5in', textAlign: 'justify' }}>
              {section.content || section}
            </div>
          </div>
        );
      
      case 'signatureBlock':
        return (
          <div key={sectionKey} style={{ ...sectionStyle, marginTop: '48px' }}>
            <div style={{ whiteSpace: 'pre-line' }}>
              {section.content || section}
            </div>
          </div>
        );
      
      case 'notaryBlock':
        return (
          <div key={sectionKey} style={{ ...sectionStyle, marginTop: '32px', border: '1px solid #000', padding: '16px' }}>
            <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>NOTARY ACKNOWLEDGMENT</div>
            <div style={{ whiteSpace: 'pre-line' }}>
              {section.content || section}
            </div>
          </div>
        );
      
      default:
        return (
          <div key={sectionKey} style={sectionStyle}>
            {section.title && (
              <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>
                {section.title}
              </div>
            )}
            <div style={{ textAlign: 'justify' }}>
              {section.content || section}
            </div>
          </div>
        );
    }
  };

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50' : 'h-full'} flex flex-col bg-gray-100`}>
      {/* Header with controls */}
      <div className="p-4 border-b bg-white flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-800">Document Preview</h2>
        <div className="flex items-center gap-2">
          {/* Zoom controls */}
          <button
            onClick={handleZoomOut}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Zoom out"
          >
            <ZoomOut className="h-4 w-4" />
          </button>
          <span className="text-sm text-gray-600 min-w-[3rem] text-center">
            {zoomLevel}%
          </span>
          <button
            onClick={handleZoomIn}
            className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Zoom in"
          >
            <ZoomIn className="h-4 w-4" />
          </button>
          <button
            onClick={handleZoomReset}
            className="px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 rounded transition-colors"
            title="Reset zoom"
          >
            Reset
          </button>
          
          <div className="w-px h-6 bg-gray-300 mx-2"></div>
          
          {/* Page navigation */}
          {totalPages > 1 && (
            <>
              <button
                onClick={goToPrevPage}
                disabled={currentPage === 1}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-gray-600 min-w-[3rem] text-center">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={goToNextPage}
                disabled={currentPage === totalPages}
                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <div className="w-px h-6 bg-gray-300 mx-2"></div>
            </>
          )}
          
          {/* Other controls */}
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

      {/* Document container with 8.5x11 proportions */}
      <div 
        ref={previewContainerRef}
        className="flex-1 overflow-auto bg-gray-200 p-8 flex justify-center"
      >
        <div 
          className="bg-white shadow-lg relative"
          style={{
            width: `${CONTAINER_WIDTH * (zoomLevel / 100)}px`,
            height: `${PAPER_HEIGHT * (zoomLevel / 100)}px`,
            minHeight: `${PAPER_HEIGHT * (zoomLevel / 100)}px`,
            transform: `scale(1)`,
            transformOrigin: 'top center'
          }}
        >
          {/* Page number indicator */}
          {totalPages > 1 && (
            <div className="absolute top-2 right-4 text-xs text-gray-400">
              Page {currentPage} of {totalPages}
            </div>
          )}
          
          {/* Document content with proper legal formatting */}
          <div 
            className="h-full overflow-hidden"
            style={{
              padding: '96px 120px 96px 144px', // 1in top/bottom, 1.25in left, 1in right (96px = 1in at 96dpi)
              fontSize: `${12 * (zoomLevel / 100)}px`,
              lineHeight: jurisdictionStyles.lineHeight,
              fontFamily: jurisdictionStyles.fontFamily,
            }}
          >
            {preview && preview.sections ? (
              Object.entries(currentPageContent).map(([key, section]) => 
                renderSection(key, section)
              )
            ) : (
              <div className="h-full flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Preview will update as you add information</p>
                  <button
                    onClick={handleRefresh}
                    className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    Generate Preview
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer with document stats */}
      {preview && (
        <div className="border-t bg-white px-4 py-2">
          <div className="flex items-center justify-between text-sm text-gray-600">
            <div className="flex items-center gap-4">
              <span>Facts: {preview.metadata?.factCount || currentDocument.facts?.length || 0}</span>
              <span>Words: ~{preview.metadata?.wordCount || 0}</span>
              <span>Pages: {totalPages}</span>
              <span>State: {currentDocument.state || 'Not specified'}</span>
            </div>
            <div className="flex items-center gap-2">
              {currentDocument.documentId && (
                <span className="text-xs text-green-600">Saved</span>
              )}
              <span className="text-xs text-gray-500">
                Zoom: {zoomLevel}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentPreview;