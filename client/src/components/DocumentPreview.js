// client/src/components/DocumentPreview.js - FIXED VERSION with Notary Protection
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

const LINES_PER_PAGE = 42; // Standard legal document (letter size, double-spaced)

const DocumentPreview = () => {
  const { currentDocument, preview, isPreviewLoading } = useDocumentState();
  const { generatePreview } = useDocumentActions();
  
  const [currentPage, setCurrentPage] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(80);

  // ✅ FIXED: Calculate pagination with notary block protection
  const pages = useMemo(() => {
    if (!preview?.sections) return [{content: []}];
    
    const sections = preview.sections;
    const allContent = [];
    
    // Helper to estimate lines for text (accounts for double-spacing and wrapping)
    const estimateLines = (text, type = 'normal') => {
      if (!text) return 0;
      const textStr = typeof text === 'string' ? text : String(text);
      
      // Count explicit newlines
      const newlines = (textStr.match(/\n/g) || []).length;
      
      // Estimate wrapped lines (75 chars per line average for legal docs)
      const wrappedLines = Math.ceil(textStr.length / 75);
      
      // Use the larger estimate
      let lines = Math.max(wrappedLines, newlines + 1);
      
      // Add extra spacing based on type
      if (type === 'title') lines += 2;
      if (type === 'section-header') lines += 1;
      if (type === 'notary') lines += 8; // Extra spacing around notary
      
      return lines;
    };
    
    // Add header
    if (sections.header) {
      allContent.push({ 
        type: 'header', 
        content: sections.header.content || sections.header, 
        lines: 3 
      });
    }
    
    // Add venue
    if (sections.venue) {
      allContent.push({ 
        type: 'venue', 
        content: sections.venue.content || sections.venue, 
        lines: 3 
      });
    }
    
    // Add title
    if (sections.title) {
      allContent.push({ 
        type: 'title', 
        content: 'AFFIDAVIT', 
        lines: 3 
      });
    }
    
    // Add introduction
    if (sections.introduction) {
      const intro = sections.introduction.content || sections.introduction;
      allContent.push({ 
        type: 'introduction', 
        content: intro, 
        lines: estimateLines(intro) + 1 
      });
    }
    
    // Add section title for facts
    if (sections.facts) {
      allContent.push({ 
        type: 'section-title', 
        content: 'STATEMENT OF FACTS', 
        lines: 2 
      });
    }
    
    // ✅ Add facts with smart tracking
    const facts = currentDocument.facts || [];
    const factItems = [];
    
    facts.forEach((fact, idx) => {
      const content = fact.professionalRewrite || fact.content || String(fact);
      const factText = `${idx + 1}. ${content}`;
      const lines = estimateLines(factText);
      
      factItems.push({
        type: 'fact',
        content: factText,
        lines: lines,
        index: idx,
        isLastFact: idx === facts.length - 1,
        isSecondToLastFact: idx === facts.length - 2
      });
    });
    
    // Add facts to content
    allContent.push(...factItems);
    
    // Add conclusion
    if (sections.conclusion) {
      const conclusion = sections.conclusion.content || sections.conclusion;
      allContent.push({ 
        type: 'conclusion', 
        content: conclusion, 
        lines: estimateLines(conclusion) + 1 
      });
    }
    
    // Add perjury statement
    if (sections.perjuryStatement) {
      const perjury = sections.perjuryStatement.content || sections.perjuryStatement;
      allContent.push({
        type: 'perjury',
        content: perjury,
        lines: estimateLines(perjury) + 1
      });
    }
    
    // Add signature block
    if (sections.signatureBlock) {
      allContent.push({ 
        type: 'signature', 
        content: sections.signatureBlock.formatted || 
                 `\n\n_________________________________\n${currentDocument.affiantName || '[AFFIANT NAME]'}, Affiant\n\nDate: ________________`, 
        lines: 6 
      });
    }
    
    // Add notary block (estimated height)
    if (sections.notaryBlock) {
      const notaryText = sections.notaryBlock.content || sections.notaryBlock;
      allContent.push({ 
        type: 'notary', 
        content: notaryText, 
        lines: estimateLines(notaryText, 'notary') + 15 // Add extra buffer for border/padding
      });
    }
    
    // ✅ PAGINATION with Notary Block Protection
    const paginatedPages = [];
    let currentPageContent = [];
    let currentPageLines = 0;
    
    for (let i = 0; i < allContent.length; i++) {
      const item = allContent[i];
      
      // ✅ CRITICAL FIX: Notary Block Protection Logic      
      const isSignature = item.type === 'signature' || item.type === 'perjury';
      const isNotary = item.type === 'notary';
      const isLastFact = item.type === 'fact' && item.isLastFact; // ← Only the LAST fact
      const needsProtection = isLastFact || isSignature || isNotary;
      if (needsProtection) {


        // Calculate space needed for everything remaining
        let spaceNeeded = item.lines;
        
        // Add all remaining items
        for (let j = i + 1; j < allContent.length; j++) {
          spaceNeeded += allContent[j].lines;
        }
        
        // ✅ KEY DECISION: If notary + trailing content won't fit, start new page NOW
        const hasContentOnPage = currentPageContent.length > 0;
        const wouldOverflow = currentPageLines + spaceNeeded > LINES_PER_PAGE;
        
        if (wouldOverflow && hasContentOnPage) {
          // Save current page
          paginatedPages.push({ content: currentPageContent });
          
          // Start new page with this item
          currentPageContent = [item];
          currentPageLines = item.lines;
          continue;
        }
      }
      
      // Normal page break logic for non-protected items
      if (currentPageLines + item.lines > LINES_PER_PAGE && currentPageContent.length > 0) {
        // Save current page
        paginatedPages.push({ content: currentPageContent });
        
        // Start new page
        currentPageContent = [item];
        currentPageLines = item.lines;
      } else {
        // Add to current page
        currentPageContent.push(item);
        currentPageLines += item.lines;
      }
    }
    
    // Add final page if it has content
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
  const handleNextPage = () => setCurrentPage(prev => Math.min(prev + 1, totalPages));
  const handlePrevPage = () => setCurrentPage(prev => Math.max(prev - 1, 1));

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
      perjury: 'text-justify indent-8 mb-4 leading-loose font-semibold',
      signature: 'mt-6 leading-8 whitespace-pre-line',
      notary: 'mt-8 border-2 border-black p-4 leading-relaxed whitespace-pre-line text-sm bg-gray-50'
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

      {/* Footer with pagination */}
      <div className="p-4 border-t bg-white flex items-center justify-between">
        <div className="text-sm text-gray-600">
          {currentDocument.facts?.length || 0} facts • {totalPages} page{totalPages !== 1 ? 's' : ''}
        </div>
        
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 1}
              className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            
            <span className="text-sm font-medium">
              {currentPage} / {totalPages}
            </span>
            
            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages}
              className="p-2 rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentPreview;
