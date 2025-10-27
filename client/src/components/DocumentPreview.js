// client/src/components/DocumentPreview.js - UPDATED WITH FIXED ASPECT RATIO
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  FileText, 
  RefreshCw,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useDocumentState, useDocumentActions } from '../contexts/DocumentContext';

const LINES_PER_PAGE = 42; // Standard legal document

const DocumentPreview = () => {
  const { currentDocument, preview, isPreviewLoading } = useDocumentState();
  const { generatePreview } = useDocumentActions();
  
  const [currentPage, setCurrentPage] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(80); // Default to 80% zoom
  
  const containerRef = useRef(null);

  // Center the horizontal scrollbar when zoom changes
  useEffect(() => {
    if (containerRef.current) {
      const container = containerRef.current;
      container.scrollLeft = (container.scrollWidth - container.clientWidth) / 2;
    }
  }, [zoomLevel]);

  // Calculate pagination from preview content
  const pages = useMemo(() => {
    if (!preview?.sections) return [{content: []}];
    
    const sections = preview.sections;
    const allContent = [];
    
    // Helper to estimate lines for text (accounts for double-spacing)
    const estimateLines = (text, type = 'normal') => {
      if (!text) return 0;
      const chars = typeof text === 'string' ? text.length : String(text).length;
      const charsPerLine = 80; // Approximate characters per line with 1in margins
      const baseLines = Math.ceil(chars / charsPerLine);
      
      // Account for double spacing (line-height: 2.0)
      return type === 'title' ? baseLines + 2 : baseLines;
    };

    // Convert sections object to array and add to content
    // The sections object has properties like: header, venue, introduction, facts, etc.
    const sectionOrder = ['header', 'venue', 'caseCaption', 'title', 'introduction', 'facts', 'conclusion', 'perjury', 'signature', 'notary'];
    
    sectionOrder.forEach(key => {
      const section = sections[key];
      if (!section) return;
      
      // Handle facts specially - it has items array
      if (key === 'facts' && section.items && Array.isArray(section.items)) {
        section.items.forEach((fact, idx) => {
          allContent.push({
            type: 'fact',
            content: fact.displayContent || fact.content || String(fact),
            estimatedLines: estimateLines(fact.displayContent || fact.content || String(fact), 'normal')
          });
        });
      } else if (section.content) {
        // Regular section with content
        allContent.push({
          type: section.type || key,
          content: section.content,
          estimatedLines: estimateLines(section.content, section.type || key)
        });
      }
    });

    // Paginate content
    const paginatedPages = [];
    let currentPageContent = [];
    let currentLineCount = 0;

    allContent.forEach(section => {
      const sectionLines = section.estimatedLines;
      
      // If adding this section would exceed page limit, start new page
      if (currentLineCount + sectionLines > LINES_PER_PAGE && currentPageContent.length > 0) {
        paginatedPages.push({ content: currentPageContent });
        currentPageContent = [section];
        currentLineCount = sectionLines;
      } else {
        currentPageContent.push(section);
        currentLineCount += sectionLines;
      }
    });

    // Add last page
    if (currentPageContent.length > 0) {
      paginatedPages.push({ content: currentPageContent });
    }

    return paginatedPages.length > 0 ? paginatedPages : [{content: []}];
  }, [preview, currentDocument.facts]);

  const totalPages = pages.length;
  const currentPageData = pages[currentPage - 1] || { content: [] };

  // Zoom controls
  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 10, 150));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 10, 40));
  const handleRefresh = () => generatePreview();

  // Pagination
  const handlePrevPage = () => setCurrentPage(prev => Math.max(1, prev - 1));
  const handleNextPage = () => setCurrentPage(prev => Math.min(totalPages, prev + 1));

  // Render different section types
  const renderSection = (section, idx) => {
    const key = `section-${idx}`;
    
    switch (section.type) {
      case 'header':
        return (
          <div key={key} className="text-center font-bold mb-4">
            {section.content}
          </div>
        );
      
      case 'venue':
        return (
          <div key={key} className="text-center mb-4">
            {section.content}
          </div>
        );
      
      case 'case-caption':
        return (
          <div key={key} className="text-center mb-6 whitespace-pre-line border-b-2 border-black pb-4">
            {section.content}
          </div>
        );
      
      case 'title':
        return (
          <div key={key} className="text-center font-bold text-lg mb-6 underline">
            {section.content}
          </div>
        );
      
      case 'section-title':
        return (
          <div key={key} className="font-bold mb-4">
            {section.content}
          </div>
        );
      
      case 'introduction':
      case 'conclusion':
      case 'perjury':
        return (
          <p key={key} className="mb-4 text-justify">
            {section.content}
          </p>
        );
      
      case 'fact':
        return (
          <p key={key} className="mb-4 text-justify pl-8 -indent-8">
            {section.content}
          </p>
        );
      
      case 'signature':
        return (
          <div key={key} className="mt-8 mb-4 whitespace-pre-line">
            {section.content}
          </div>
        );
      
      case 'notary':
        return (
          <div 
            key={key} 
            className="mt-8 p-4 border-2 border-black bg-gray-50"
            style={{ pageBreakInside: 'avoid' }}
          >
            <div className="whitespace-pre-line">
              {section.content}
            </div>
          </div>
        );
      
      default:
        return (
          <div key={key} className="mb-4">
            {section.content}
          </div>
        );
    }
  };

  // Empty state
  if (!currentDocument.affiantName && (!preview || !preview.sections)) {
    return (
      <div className="h-full flex flex-col bg-gray-50">
        <div className="p-4 border-b bg-white">
          <h2 className="text-lg font-semibold text-gray-800">Document Preview</h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">No Document Yet</h3>
            <p className="text-gray-500 mb-4">
              Start chatting to create your affidavit. The preview will update automatically as you provide information.
            </p>
            <div className="text-sm text-gray-400 space-y-1">
              <p>✓ Real-time preview generation</p>
              <p>✓ Professional legal formatting</p>
              <p>✓ State-specific requirements</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (isPreviewLoading) {
    return (
      <div className="h-full flex flex-col bg-gray-50">
        <div className="p-4 border-b bg-white">
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

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header with controls */}
      <div className="p-4 border-b bg-white">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Document Preview
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={handleZoomOut} className="p-2 hover:bg-gray-100 rounded" title="Zoom out">
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="text-sm text-gray-600 min-w-[60px] text-center">{zoomLevel}%</span>
            <button onClick={handleZoomIn} className="p-2 hover:bg-gray-100 rounded" title="Zoom in">
              <ZoomIn className="h-4 w-4" />
            </button>
            <button onClick={handleRefresh} className="p-2 hover:bg-gray-100 rounded ml-2" title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Document viewer with FIXED ASPECT RATIO */}
      <div 
        ref={containerRef}
        className="flex-1 overflow-auto bg-gray-200 p-6"
      >
        <div 
          style={{ 
            minWidth: 'fit-content',
            margin: '0 auto'
          }}
        >
          <div 
            className="bg-white shadow-lg relative"
            style={{ 
              width: '816px',       // 8.5in at 96 DPI
              height: '1056px',     // 11in at 96 DPI
              flexShrink: 0,        // Prevent CSS from squishing
              padding: '96px',      // 1in margins
              fontFamily: '"Times New Roman", Times, serif',
              fontSize: '12pt',
              lineHeight: '2.0',
              transform: `scale(${zoomLevel / 100})`,
              transformOrigin: 'top center',
              marginBottom: `${Math.abs(zoomLevel - 100) * 2}px`,
              boxSizing: 'border-box'
            }}
          >
            {currentPageData.content.map((section, idx) => renderSection(section, idx))}
            
            {/* Page number */}
            <div 
              style={{
                position: 'absolute',
                bottom: '48px',     // 0.5in from bottom
                left: '0',
                right: '0',
                textAlign: 'center',
                fontSize: '10pt',
                color: '#666',
                fontFamily: 'Arial, sans-serif'
              }}
            >
              Page {currentPage} of {totalPages}
            </div>
          </div>
        </div>
      </div>

      {/* Footer with stats and pagination */}
      <div className="p-4 border-t bg-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>{totalPages} page{totalPages !== 1 ? 's' : ''}</span>
            {currentDocument.facts?.length > 0 && (
              <span>•</span>
            )}
            {currentDocument.facts?.length > 0 && (
              <span>{currentDocument.facts.length} fact{currentDocument.facts.length !== 1 ? 's' : ''}</span>
            )}
          </div>
          
          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                className="p-2 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                title="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-gray-600 min-w-[80px] text-center">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className="p-2 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                title="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentPreview;