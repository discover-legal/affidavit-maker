// client/src/components/DocumentPreview.js
// ENHANCED VERSION - Drop-in replacement for existing DocumentPreview.js
// Adds: Professional formatting, Pagination, Better empty state

import React, { useState, useMemo } from 'react';
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

  // Calculate pagination from preview content
  const pages = useMemo(() => {
    if (!preview?.sections) return [{content: []}];
    
    const sections = preview.sections;
    const allContent = [];
    
    // Helper to estimate lines for text (accounts for double-spacing)
    const estimateLines = (text) => {
      if (!text) return 0;
      const chars = typeof text === 'string' ? text.length : String(text).length;
      // Count newlines for multi-line content (like notary blocks)
      const newlines = (text.match(/\n/g) || []).length;
      const baseLines = Math.ceil(chars / 75);
      return Math.max(baseLines, newlines) + 1; // Use the larger estimate
    };
    
    // Add header
    if (sections.header) {
      allContent.push({ type: 'header', content: sections.header.content || sections.header, lines: 3 });
    }
    
    // Add venue
    if (sections.venue) {
      allContent.push({ type: 'venue', content: sections.venue.content || sections.venue, lines: 3 });
    }
    
    // Add title
    if (sections.title) {
      allContent.push({ type: 'title', content: 'AFFIDAVIT', lines: 2 });
    }
    
    // Add introduction
    if (sections.introduction) {
      const intro = sections.introduction.content || sections.introduction;
      allContent.push({ type: 'introduction', content: intro, lines: estimateLines(intro) + 1 });
    }
    
    // Add facts
    if (sections.facts) {
      allContent.push({ type: 'section-title', content: 'STATEMENT OF FACTS', lines: 2 });
      
      const facts = currentDocument.facts || [];
      facts.forEach((fact, idx) => {
        const content = fact.professionalRewrite || fact.content || String(fact);
        allContent.push({ 
          type: 'fact', 
          content: `${idx + 1}. ${content}`, 
          lines: estimateLines(content) + 1 
        });
      });
    }
    
    // Add conclusion
    if (sections.conclusion) {
      allContent.push({ type: 'section-title', content: 'CONCLUSION', lines: 2 });
      const concl = sections.conclusion.content || sections.conclusion;
      allContent.push({ type: 'conclusion', content: concl, lines: estimateLines(concl) + 1 });
    }
    
    // Add signature
    if (sections.signature || sections.signatureBlock) {
      const sig = sections.signature?.content || sections.signatureBlock?.content || sections.signature;
      allContent.push({ type: 'signature', content: sig, lines: 6 });
    }
    
    // Add notary
    if (sections.notary || sections.notaryBlock) {
      const notary = sections.notary?.content || sections.notaryBlock?.content || sections.notary;
      allContent.push({ type: 'notary', content: notary, lines: 8 });
    }
    
    // Paginate
    const paginatedPages = [];
    let currentPageContent = [];
    let currentPageLines = 0;
    
    allContent.forEach((section) => {
      if (currentPageLines + section.lines > LINES_PER_PAGE && currentPageContent.length > 0) {
        paginatedPages.push({ content: [...currentPageContent] });
        currentPageContent = [];
        currentPageLines = 0;
      }
      currentPageContent.push(section);
      currentPageLines += section.lines;
    });
    
    if (currentPageContent.length > 0) {
      paginatedPages.push({ content: currentPageContent });
    }
    
    return paginatedPages.length > 0 ? paginatedPages : [{content: []}];
  }, [preview, currentDocument]);

  const totalPages = pages.length;
  const currentPageData = pages[currentPage - 1] || {content: []};

  const handleRefresh = () => {
    if (currentDocument) {
      generatePreview(currentDocument);
    }
  };

  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 10, 150));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 10, 50));

  // Render section with proper legal formatting
  const renderSection = (section, idx) => {
    const classMap = {
      header: 'text-center font-bold text-sm tracking-wide mb-4',
      venue: 'text-right mb-4 whitespace-pre-line text-sm',
      title: 'text-center font-bold text-base my-6 tracking-wider',
      'section-title': 'text-center font-bold text-sm my-4',
      introduction: 'text-justify indent-8 mb-4 leading-loose',
      fact: 'text-justify mb-3 leading-loose pl-8 -indent-8',
      conclusion: 'text-justify indent-8 mb-4 leading-loose',
      signature: 'mt-6 leading-8 whitespace-pre-line',
      notary: 'mt-6 border-2 border-black p-4 leading-relaxed whitespace-pre-line text-sm'
    };
    
    return (
      <div key={idx} className={classMap[section.type] || 'mb-2'}>
        {section.content}
      </div>
    );
  };

  // Empty state - before facts added
  if (!currentDocument?.facts || currentDocument.facts.length === 0) {
    return (
      <div className="h-full flex flex-col bg-gray-50">
        <div className="p-4 border-b bg-white">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Document Preview
          </h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <div className="w-24 h-32 mx-auto mb-6 border-4 border-dashed border-gray-300 rounded-lg flex items-center justify-center">
              <FileText className="h-12 w-12 text-gray-300" />
            </div>
            <h3 className="text-xl font-semibold text-gray-700 mb-2">
              Preview Will Appear Once You Add Facts
            </h3>
            <p className="text-gray-500 mb-4">
              Start chatting with the assistant to add facts to your affidavit. 
              The preview will update automatically as you provide information.
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

      {/* Document viewer with legal formatting */}
      <div className="flex-1 overflow-auto bg-gray-200 p-6 flex justify-center">
        <div 
          className="bg-white shadow-lg"
          style={{ 
            width: '8.5in',
            minHeight: '11in',
            padding: '1in',
            fontFamily: '"Times New Roman", Times, serif',
            fontSize: '12pt',
            lineHeight: '1.8',
            transform: `scale(${zoomLevel / 100})`,
            transformOrigin: 'top center',
            marginBottom: `${(zoomLevel - 100) * 1.5}px`
          }}
        >
          {currentPageData.content.map((section, idx) => renderSection(section, idx))}
          
          {/* Page number */}
          <div className="text-center text-gray-500 text-xs mt-8 font-sans">
            Page {currentPage} of {totalPages}
          </div>
        </div>
      </div>

      {/* Footer with stats and pagination */}
      <div className="border-t bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span>Facts: {currentDocument.facts?.length || 0}</span>
            <span>State: {currentDocument.state || 'Not specified'}</span>
            <span>Pages: {totalPages}</span>
          </div>
          
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <span className="text-sm text-gray-700 min-w-[100px] text-center">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentPreview;