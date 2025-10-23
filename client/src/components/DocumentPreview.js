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

  // ✅ Auto-adjust zoom based on container width
  useEffect(() => {
    if (!containerRef.current) return;
    
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const width = entry.contentRect.width;
        
        // Auto-adjust zoom if container is too narrow
        // 8.5in = 816px at 96 DPI, plus 2in (192px) for margins/padding
        const requiredWidth = 816 + 192; // Total: 1008px
        
        if (width < requiredWidth) {
          const autoZoom = Math.floor((width / requiredWidth) * 100);
          setZoomLevel(Math.max(40, Math.min(autoZoom, 100))); // Clamp between 40-100%
        } else if (width >= requiredWidth && zoomLevel < 80) {
          setZoomLevel(80); // Return to default
        }
      }
    });
    
    resizeObserver.observe(containerRef.current);
    
    return () => resizeObserver.disconnect();
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
      // Count newlines for multi-line content (like notary blocks)
      const newlines = (text.match(/\n/g) || []).length;
      const baseLines = Math.ceil(chars / 75);
      
      // Add extra lines for special types
      let extraLines = 1;
      if (type === 'notary') extraLines = 8; // Notary blocks need more space
      if (type === 'signature') extraLines = 3;
      
      return Math.max(baseLines, newlines) + extraLines;
    };
    
    // Add header
    if (sections.header) {
      allContent.push({ type: 'header', content: sections.header.content || sections.header, lines: 3 });
    }
    
    // Add venue
    if (sections.venue) {
      allContent.push({ type: 'venue', content: sections.venue.content || sections.venue, lines: 3 });
    }
    
    // ✅ Add case caption
    if (sections.caseCaption) {
      const captionText = sections.caseCaption.formatted || sections.caseCaption;
      allContent.push({ type: 'case-caption', content: captionText, lines: estimateLines(captionText) + 2 });
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
    
    // Add facts with protection
    if (sections.facts) {
      allContent.push({ type: 'section-title', content: 'STATEMENT OF FACTS', lines: 2 });
      
      const facts = currentDocument.facts || [];
      facts.forEach((fact, idx) => {
        const content = fact.professionalRewrite || fact.content || String(fact);
        allContent.push({ 
          type: 'fact', 
          content: `${idx + 1}. ${content}`,
          lines: estimateLines(content) + 1,
          isLastFact: idx === facts.length - 1
        });
      });
    }
    
    // Add conclusion
    if (sections.conclusion) {
      const conclusion = sections.conclusion.content || sections.conclusion;
      allContent.push({ type: 'conclusion', content: conclusion, lines: estimateLines(conclusion) + 1 });
    }
    
    // Add perjury statement
    if (sections.perjuryStatement) {
      const perjury = sections.perjuryStatement.content || sections.perjuryStatement;
      allContent.push({ type: 'perjury', content: perjury, lines: estimateLines(perjury, 'signature') });
    }
    
    // Add signature block
    if (sections.signatureBlock) {
      const sig = sections.signatureBlock.formatted || sections.signatureBlock;
      allContent.push({ type: 'signature', content: sig, lines: estimateLines(sig, 'signature') });
    }
    
    // Add notary block
    if (sections.notaryBlock) {
      const notary = sections.notaryBlock.formatted || sections.notaryBlock;
      allContent.push({ type: 'notary', content: notary, lines: Math.max(estimateLines(notary, 'notary'), 15) });
    }
    
    // Paginate content
    const paginatedPages = [];
    let currentPageContent = [];
    let currentPageLines = 0;
    
    for (let i = 0; i < allContent.length; i++) {
      const item = allContent[i];
      
      // ✅ Protection logic: Keep last fact with signature/notary
      const isLastFact = item.type === 'fact' && item.isLastFact;
      const isSignature = item.type === 'signature' || item.type === 'perjury';
      const isNotary = item.type === 'notary';
      
      const needsProtection = isLastFact || isSignature || isNotary;
      
      // Check if we need page break
      if (currentPageLines + item.lines > LINES_PER_PAGE) {
        // If this item needs protection, check if we can fit it with protected items
        if (needsProtection) {
          // Calculate total lines needed for protected group
          let protectedLines = item.lines;
          for (let j = i + 1; j < allContent.length; j++) {
            const nextItem = allContent[j];
            if (nextItem.type === 'signature' || nextItem.type === 'perjury' || nextItem.type === 'notary') {
              protectedLines += nextItem.lines;
            }
          }
          
          // If protected group won't fit, start new page
          if (currentPageLines + protectedLines > LINES_PER_PAGE) {
            paginatedPages.push({ content: currentPageContent });
            currentPageContent = [];
            currentPageLines = 0;
          }
        } else {
          // Normal page break
          paginatedPages.push({ content: currentPageContent });
          currentPageContent = [];
          currentPageLines = 0;
        }
      }
      
      currentPageContent.push(item);
      currentPageLines += item.lines;
    }
    
    // Add final page
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
        className="flex-1 overflow-auto bg-gray-200 p-6 flex justify-center items-start"
      >
        <div 
          className="bg-white shadow-lg relative"
          style={{ 
            width: '8.5in',
            minHeight: '11in',
            aspectRatio: '8.5 / 11', // ✅ FIXED ASPECT RATIO - maintains proportions
            padding: '1in',
            fontFamily: '"Times New Roman", Times, serif',
            fontSize: '12pt',
            lineHeight: '2.0',
            transform: `scale(${zoomLevel / 100})`,
            transformOrigin: 'top center',
            marginBottom: `${Math.abs(zoomLevel - 100) * 2}px`, // Account for scaling
            boxSizing: 'border-box'
          }}
        >
          {currentPageData.content.map((section, idx) => renderSection(section, idx))}
          
          {/* Page number */}
          <div 
            style={{
              position: 'absolute',
              bottom: '0.5in',
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
          
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                className="p-2 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className="p-2 hover:bg-gray-100 rounded disabled:opacity-50 disabled:cursor-not-allowed"
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
