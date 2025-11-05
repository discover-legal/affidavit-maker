// client/src/components/DocumentPreview.js - FULLY FIXED VERSION
// With proper page boundaries, real pagination, and WYSIWYG formatting
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
import '../styles/DocumentPreview.css';

// Page configuration for US Letter (8.5" x 11" with 1" margins)
const PAGE_CONFIG = {
  width: 8.5,      // inches
  height: 11,      // inches
  marginTop: 1,    // inches
  marginBottom: 1, // inches
  marginLeft: 1,   // inches
  marginRight: 1,  // inches
  lineHeight: 24,  // pixels (double-spaced)
  fontSize: 16,    // pixels (12pt equivalent)
  linesPerPage: 26 // Approximate lines per page with double spacing
};

const DocumentPreview = () => {
  const { currentDocument, preview, isPreviewLoading } = useDocumentState();
  const { generatePreview } = useDocumentActions();

  const [currentPage, setCurrentPage] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(80);
  const containerRef = useRef(null);
  const pageRefs = useRef([]);

  // Center the preview pane horizontally to ensure equal left/right scroll
  useEffect(() => {
    if (containerRef.current) {
      const container = containerRef.current;
      // Wait for next tick to ensure DOM is updated
      requestAnimationFrame(() => {
        const scrollLeft = (container.scrollWidth - container.clientWidth) / 2;
        container.scrollLeft = scrollLeft;
      });
    }
  }, [zoomLevel, preview]);

  // Process and paginate content
  const pages = useMemo(() => {
    if (!preview?.sections) return [{ content: [], pageNumber: 1 }];
    
    const sections = preview.sections;
    const allContent = [];
    
    // Section order for affidavit
    // Note: 'facts' now includes competency statement as first item
    // Note: 'notaryInstruction' must come before 'notaryBlock' (Utah requirement)
    const sectionOrder = [
      'header', 'venue', 'caseCaption', 'title',
      'introduction', 'facts', 'conclusion',
      'perjuryStatement', 'signatureBlock', 'notaryInstruction', 'notaryBlock'
    ];
    
    // Process sections into content array
    sectionOrder.forEach(key => {
      const section = sections[key];
      if (!section) return;
      
      if (key === 'facts' && section.items && Array.isArray(section.items)) {
        // FIXED: Handle facts with numbering from StateTemplateManager
        // Facts array includes competency statement as first item
        section.items.forEach((fact, factIndex) => {
          // Use the fact number from the template manager (already correct)
          const factNumber = fact.number || 1;
          const factContent = fact.content || String(fact);
          const factType = fact.type || 'fact';

          // CRITICAL FIX: Mark the last fact with keepWithNext to ensure it stays
          // with conclusion, perjury statement, signature, and notary sections
          const isLastFact = factIndex === section.items.length - 1;
          const hasNotaryBlock = sections.notaryBlock || sections.notaryInstruction;

          allContent.push({
            type: factType, // Can be 'competency' or 'fact'
            content: `${factNumber}. ${factContent}`,
            keepWithNext: isLastFact && hasNotaryBlock, // Keep last fact with following sections
            breakBefore: false,
            isBlockElement: false
          });
        });
      } else if (key === 'caseCaption' && section) {
        // Handle case caption (object with formatted property)
        const captionContent = section.formatted || section.content || '';
        allContent.push({
          type: 'caseCaption',
          content: captionContent,
          keepWithNext: false,
          breakBefore: false,
          isBlockElement: false
        });
      } else if (key === 'signatureBlock' && section) {
        // Handle signature block (object with formatted property)
        const signatureContent = section.formatted || section.content || '';
        allContent.push({
          type: 'signature',
          content: signatureContent,
          keepWithNext: true, // Keep with notary
          breakBefore: false,
          isBlockElement: false
        });
      } else if (key === 'notaryBlock' && section) {
        // Handle notary block (string)
        allContent.push({
          type: 'notary',
          content: typeof section === 'string' ? section : section.content || '',
          keepWithNext: false,
          breakBefore: false,
          isBlockElement: true
        });
      } else if (key === 'notaryInstruction' && section) {
        // Handle notary instruction (Utah-specific)
        allContent.push({
          type: 'notary-instruction',
          content: typeof section === 'string' ? section : section.content || '',
          keepWithNext: true, // Keep with notary block
          breakBefore: false,
          isBlockElement: false
        });
      } else if (section && typeof section === 'string') {
        // Handle string sections (like perjuryStatement, conclusion, etc.)
        const sectionData = {
          type: key,
          content: section,
          keepWithNext: false,
          breakBefore: false,
          isBlockElement: key === 'notaryBlock'
        };

        // FIXED: Keep conclusion, perjury statement, and signature together with notary
        // This ensures the keepWithNext chain is complete from last fact through notary block
        if (key === 'conclusion' || key === 'perjuryStatement') {
          sectionData.keepWithNext = true;
        }

        allContent.push(sectionData);
      } else if (section?.content) {
        // Handle object sections with content property
        const sectionData = {
          type: section.type || key,
          content: section.content,
          keepWithNext: false,
          breakBefore: false,
          isBlockElement: key === 'notaryBlock'
        };

        allContent.push(sectionData);
      }
    });

    // Create pages with proper breaks
    const paginatedPages = [];
    let currentPageContent = [];
    let currentPageHeight = 0;
    const maxPageHeight = (PAGE_CONFIG.height - PAGE_CONFIG.marginTop - PAGE_CONFIG.marginBottom) * 96; // Convert to pixels
    
    allContent.forEach((section, idx) => {
      // CRITICAL: Height estimation must match PDF rendering for WYSIWYG accuracy
      // PDF uses PDFKit points (72 DPI), Preview uses CSS pixels (96 DPI)
      // Conversion: PDF points × (96/72) = CSS pixels
      // Example: 80 points × 1.333 = 106.67px ≈ 106px
      //
      // NOTE: These are conservative estimates. Actual rendering may vary due to:
      // - Font rendering differences (browser Times New Roman vs PDFKit Times-Roman)
      // - Text wrapping differences (browser vs PDFKit text engine)
      // - Justified text alignment differences
      let sectionHeight = 0;

      switch(section.type) {
        case 'header':
        case 'venue':
        case 'title':
          sectionHeight = 80; // Title sections (PDF uses ~60 points = 80px)
          break;
        case 'caseCaption':
        case 'case-caption':
          sectionHeight = 160; // Caption with border (PDF uses ~120 points = 160px)
          break;
        case 'notary':
        case 'notaryBlock':
          // PDF uses 180 points for notary block = 240px, but with borders and padding
          sectionHeight = 260;
          break;
        case 'notary-instruction':
        case 'notaryInstruction':
          // Variable based on content, but estimate conservatively
          const instructionLines = Math.ceil((section.content?.length || 0) / 60);
          sectionHeight = Math.max(180, instructionLines * PAGE_CONFIG.lineHeight * 1.5);
          break;
        case 'signature':
        case 'signatureBlock':
          sectionHeight = 160; // PDF uses 120 points = 160px
          break;
        case 'perjury':
        case 'perjuryStatement':
          sectionHeight = 106; // PDF uses 80 points = 106px
          break;
        case 'conclusion':
          sectionHeight = 106; // PDF uses 80 points = 106px
          break;
        case 'introduction':
          // Use more conservative estimate for introduction
          const introLines = Math.ceil((section.content?.length || 0) / 70);
          sectionHeight = introLines * PAGE_CONFIG.lineHeight * 2;
          break;
        case 'fact':
        case 'competency':
        default:
          // Estimate based on content length - be more conservative
          // PDF wraps differently than browser, so overestimate slightly
          const lines = Math.ceil((section.content?.length || 0) / 70); // Changed from 80 to 70 for safety
          sectionHeight = lines * PAGE_CONFIG.lineHeight * 2; // Double-spaced
          break;
      }
      
      // Check if we need a page break
      const wouldOverflow = currentPageHeight + sectionHeight > maxPageHeight;
      const needsPageBreak = wouldOverflow && currentPageContent.length > 0;
      
      // Special handling for keep-together elements
      if (section.keepWithNext && idx < allContent.length - 1) {
        // CRITICAL FIX: Calculate total height for all remaining sections that should stay together
        // This matches PDF's notary protection logic (pdfService.js lines 159-216)
        //
        // The keepWithNext chain for affidavits is typically:
        // Last fact → conclusion → perjury → signature → notary instruction → notary block
        //
        // We must calculate the TOTAL height of this entire chain to ensure they all
        // fit on one page together. If they don't fit, we move ALL of them to the next page.
        let totalKeepTogetherHeight = sectionHeight;

        // Look ahead and sum up heights of all sections that should stay together
        for (let i = idx + 1; i < allContent.length; i++) {
          const followingSection = allContent[i];
          let followingHeight = 0;

          switch(followingSection.type) {
            case 'notary':
            case 'notaryBlock':
              followingHeight = 260; // Match main calculation
              break;
            case 'notary-instruction':
            case 'notaryInstruction':
              const instructionLines = Math.ceil((followingSection.content?.length || 0) / 60);
              followingHeight = Math.max(180, instructionLines * PAGE_CONFIG.lineHeight * 1.5);
              break;
            case 'signature':
            case 'signatureBlock':
              followingHeight = 160; // Match main calculation
              break;
            case 'perjuryStatement':
            case 'perjury':
              followingHeight = 106; // Match main calculation
              break;
            case 'conclusion':
              followingHeight = 106; // Match main calculation
              break;
            default:
              const lines = Math.ceil((followingSection.content?.length || 0) / 70); // Changed from 80 to 70
              followingHeight = lines * PAGE_CONFIG.lineHeight * 2;
              break;
          }

          totalKeepTogetherHeight += followingHeight;

          // If this following section also has keepWithNext, continue looking ahead
          if (!followingSection.keepWithNext) {
            break;
          }
        }

        // Check if all sections that should stay together fit on current page
        if (currentPageHeight + totalKeepTogetherHeight > maxPageHeight && currentPageContent.length > 0) {
          // Move all of them to next page
          paginatedPages.push({
            content: currentPageContent,
            pageNumber: paginatedPages.length + 1
          });
          currentPageContent = [];
          currentPageHeight = 0;
        }
      } else if (needsPageBreak) {
        // Start new page
        paginatedPages.push({ 
          content: currentPageContent, 
          pageNumber: paginatedPages.length + 1 
        });
        currentPageContent = [];
        currentPageHeight = 0;
      }
      
      currentPageContent.push(section);
      currentPageHeight += sectionHeight;
    });
    
    // Add final page
    if (currentPageContent.length > 0) {
      paginatedPages.push({ 
        content: currentPageContent, 
        pageNumber: paginatedPages.length + 1 
      });
    }
    
    return paginatedPages.length > 0 ? paginatedPages : [{ content: [], pageNumber: 1 }];
  }, [preview]); // Removed currentDocument.facts dependency - not needed

  const totalPages = pages.length;

  // IntersectionObserver to track which page is visible
  useEffect(() => {
    if (!containerRef.current || pages.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio > 0.5) {
            const pageNum = parseInt(entry.target.dataset.pageNumber);
            if (pageNum) {
              // Use functional setState to compare against latest state
              setCurrentPage((prevPage) => {
                return pageNum !== prevPage ? pageNum : prevPage;
              });
            }
          }
        });
      },
      {
        root: containerRef.current,
        threshold: [0.5], // Update when 50% of page is visible
        rootMargin: '-20% 0px -20% 0px' // Focus on center of viewport
      }
    );

    // Observe all page elements
    pageRefs.current.forEach((pageEl) => {
      if (pageEl) observer.observe(pageEl);
    });

    return () => {
      observer.disconnect();
    };
  }, [pages]);

  // Controls
  const handleZoomIn = () => setZoomLevel(prev => Math.min(prev + 10, 150));
  const handleZoomOut = () => setZoomLevel(prev => Math.max(prev - 10, 50));
  const handleRefresh = () => generatePreview();

  const scrollToPage = (pageNum) => {
    const pageEl = pageRefs.current[pageNum - 1];
    if (pageEl && containerRef.current) {
      pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handlePrevPage = () => {
    const newPage = Math.max(1, currentPage - 1);
    setCurrentPage(newPage); // Update state immediately
    scrollToPage(newPage);
  };

  const handleNextPage = () => {
    const newPage = Math.min(totalPages, currentPage + 1);
    setCurrentPage(newPage); // Update state immediately
    scrollToPage(newPage);
  };

  // Render section based on type
  const renderSection = (section, idx, pageNum) => {
    const key = `section-${pageNum}-${idx}`;

    switch (section.type) {
      case 'header':
        return (
          <div key={key} className="affidavit-header">
            {section.content}
          </div>
        );
      
      case 'venue':
        return (
          <div key={key} className="affidavit-venue">
            {section.content}
          </div>
        );
      
      case 'caseCaption':
      case 'case-caption':
        return (
          <div key={key} className="affidavit-caption">
            {section.content}
          </div>
        );
      
      case 'title':
        return (
          <div key={key} className="affidavit-title">
            <span>{section.content}</span>
          </div>
        );
      
      case 'introduction':
        return (
          <p key={key} className="affidavit-paragraph">
            {section.content}
          </p>
        );
      
      case 'fact':
        return (
          <p key={key} className="affidavit-fact">
            {section.content}
          </p>
        );
      
      case 'conclusion':
        return (
          <p key={key} className="affidavit-paragraph">
            {section.content}
          </p>
        );
      
      case 'perjuryStatement':
      case 'perjury':
        return (
          <div key={key} className="affidavit-perjury">
            {section.content}
          </div>
        );

      case 'signatureBlock':
      case 'signature':
        return (
          <div key={key} className="affidavit-signature">
            <pre>{section.content}</pre>
          </div>
        );

      case 'notaryBlock':
      case 'notary':
        return (
          <div key={key} className="affidavit-notary">
            <pre>{section.content}</pre>
          </div>
        );

      case 'notaryInstruction':
      case 'notary-instruction':
        return (
          <div key={key} className="affidavit-notary-instruction">
            <pre>{section.content}</pre>
          </div>
        );

      case 'competency':
        return (
          <p key={key} className="affidavit-fact affidavit-competency">
            {section.content}
          </p>
        );

      default:
        return (
          <div key={key} className="affidavit-paragraph">
            {section.content}
          </div>
        );
    }
  };

  // Empty state - Don't show preview until we have at least a name or state
  const hasMinimalData = currentDocument.affiantName || currentDocument.state;

  if (!hasMinimalData) {
    return (
      <div className="h-full flex flex-col bg-gray-50">
        <div className="p-4 border-b bg-white">
          <h2 className="text-lg font-semibold text-gray-800">Document Preview</h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center max-w-md">
            <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-700 mb-2">Preview will appear shortly!</h3>
            <p className="text-gray-500 mb-4">
              Once you provide your name and state in the chat, your affidavit preview will appear here with the correct formatting for your jurisdiction.
            </p>
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
    <>
      <style>{`
        /* WYSIWYG Legal Document Styles */
        .page-container {
          width: ${8.5 * 96}px; /* 8.5 inches at 96 DPI */
          height: ${11 * 96}px; /* 11 inches at 96 DPI */
          padding: ${1 * 96}px; /* 1 inch margins */
          background: white;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          margin: 0 auto 2rem auto;
          font-family: 'Times New Roman', Times, serif;
          font-size: ${PAGE_CONFIG.fontSize}px;
          line-height: ${PAGE_CONFIG.lineHeight}px;
          color: #000;
          position: relative;
          overflow: hidden; /* Prevent content overflow */
          box-sizing: border-box;
        }

        .page-content {
          max-height: ${9 * 96}px; /* 9 inches (11 - 2 inches margins) */
          overflow: hidden;
        }

        /* Affidavit-specific styles */
        .affidavit-header {
          text-align: center;
          font-weight: bold;
          margin-bottom: ${PAGE_CONFIG.lineHeight}px;
        }

        .affidavit-venue {
          text-align: center;
          margin-bottom: ${PAGE_CONFIG.lineHeight}px;
        }

        .affidavit-caption {
          text-align: center;
          margin-bottom: ${PAGE_CONFIG.lineHeight * 2}px;
          padding-bottom: ${PAGE_CONFIG.lineHeight}px;
          border-bottom: 2px solid black;
          white-space: pre-line;
        }

        .affidavit-title {
          text-align: center;
          font-weight: bold;
          font-size: ${PAGE_CONFIG.fontSize + 2}px;
          margin-bottom: ${PAGE_CONFIG.lineHeight * 2}px;
        }

        .affidavit-title > span {
          display: inline-block;
          border-bottom: 2px solid black;
          padding-bottom: 2px;
        }

        .affidavit-paragraph {
          text-align: justify;
          margin-bottom: ${PAGE_CONFIG.lineHeight}px;
          text-indent: 0.5in;
        }

        .affidavit-fact {
          text-align: justify;
          margin-bottom: ${PAGE_CONFIG.lineHeight}px;
          padding-left: 0.5in;
          text-indent: -0.5in;
        }

        .affidavit-perjury {
          margin-top: ${PAGE_CONFIG.lineHeight * 2}px;
          margin-bottom: ${PAGE_CONFIG.lineHeight}px;
          text-align: justify;
        }

        .affidavit-signature {
          margin-top: ${PAGE_CONFIG.lineHeight * 2}px;
          margin-bottom: ${PAGE_CONFIG.lineHeight}px;
          white-space: pre-line;
        }

        .affidavit-signature pre {
          font-family: 'Times New Roman', Times, serif;
          font-size: ${PAGE_CONFIG.fontSize}px;
          margin: 0;
        }

        .affidavit-notary {
          margin-top: ${PAGE_CONFIG.lineHeight * 2}px;
          padding: ${PAGE_CONFIG.lineHeight / 2}px;
          border: 2px solid black;
          background-color: #f9f9f9;
          page-break-inside: avoid;
          break-inside: avoid;
        }

        .affidavit-notary pre {
          font-family: 'Times New Roman', Times, serif;
          font-size: ${PAGE_CONFIG.fontSize}px;
          margin: 0;
          white-space: pre-wrap;
        }

        @media print {
          .page-container {
            box-shadow: none;
            margin: 0;
            page-break-after: always;
          }
        }
      `}</style>
      
      <div className="h-full flex flex-col bg-gray-50">
        {/* Header with controls */}
        <div className="p-4 border-b bg-white">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Document Preview
            </h2>
            <div className="flex items-center gap-4">
              {/* Zoom controls */}
              <div className="flex items-center gap-2 border-r pr-4">
                <button
                  onClick={handleZoomOut}
                  className="p-2 hover:bg-gray-100 rounded transition-colors"
                  title="Zoom out"
                  disabled={zoomLevel <= 50}
                >
                  <ZoomOut className="h-4 w-4" />
                </button>
                <span className="text-sm text-gray-600 min-w-[50px] text-center font-medium">
                  {zoomLevel}%
                </span>
                <button
                  onClick={handleZoomIn}
                  className="p-2 hover:bg-gray-100 rounded transition-colors"
                  title="Zoom in"
                  disabled={zoomLevel >= 150}
                >
                  <ZoomIn className="h-4 w-4" />
                </button>
              </div>
              
              {/* Refresh button */}
              <button
                onClick={handleRefresh}
                className="p-2 hover:bg-gray-100 rounded transition-colors"
                title="Refresh preview"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Document preview area */}
        <div
          ref={containerRef}
          className="flex-1 overflow-auto bg-gray-200"
          style={{
            padding: '2rem'
          }}
        >
          <div
            style={{
              display: 'inline-block',
              minWidth: '100%'
            }}
          >
            <div
              style={{
                transform: `scale(${zoomLevel / 100})`,
                transformOrigin: 'top center',
                transition: 'transform 0.2s ease-in-out',
                margin: '0 auto',
                width: 'fit-content'
              }}
            >
              {/* Render all pages vertically */}
              {pages.map((page, pageIndex) => (
                <div
                  key={`page-${page.pageNumber}`}
                  ref={(el) => (pageRefs.current[pageIndex] = el)}
                  data-page-number={page.pageNumber}
                  className="page-container"
                  style={{
                    marginBottom: pageIndex < pages.length - 1 ? '2rem' : '0'
                  }}
                >
                  <div className="page-content">
                    {page.content.map((section, idx) => renderSection(section, idx, page.pageNumber))}
                  </div>

                  {/* Page number */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: '0.5in',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      fontSize: '12px',
                      color: '#666'
                    }}
                  >
                    Page {page.pageNumber} of {totalPages}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer with navigation */}
        <div className="p-4 border-t bg-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-sm text-gray-600">
              <span>{totalPages} page{totalPages !== 1 ? 's' : ''}</span>
              {currentDocument.facts?.length > 0 && (
                <>
                  <span>•</span>
                  <span>{currentDocument.facts.length} fact{currentDocument.facts.length !== 1 ? 's' : ''}</span>
                </>
              )}
            </div>
            
            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevPage}
                  disabled={currentPage === 1}
                  className="p-2 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Previous page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="px-4 py-2 bg-gray-50 rounded text-sm font-medium">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={handleNextPage}
                  disabled={currentPage === totalPages}
                  className="p-2 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Next page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default DocumentPreview;