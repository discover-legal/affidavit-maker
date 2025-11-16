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

// Page configuration for US Letter (8.5" x 11" with 1" margins)
const PAGE_CONFIG = {
  width: 8.5,      // inches
  height: 11,      // inches
  marginTop: 1,    // inches
  marginBottom: 1, // inches
  marginLeft: 1,   // inches
  marginRight: 1,  // inches
  lineHeight: 24,  // pixels - matches CSS line-height: 1.5 (1.5 × 16px = 24px)
  fontSize: 16,    // pixels (12pt equivalent)
  linesPerPage: 35 // Approximate lines per page with 1.5x spacing
};

// Pagination safety constants
const SAFETY_MARGIN = 7; // Pixels to subtract from max page height to prevent overflow
const CONTINUATION_MARKER_HEIGHT = 36; // Based on CSS: margin-top (24px) + margin-bottom (12px)

const DocumentPreview = () => {
  const { currentDocument, preview, isPreviewLoading } = useDocumentState();
  const { generatePreview } = useDocumentActions();

  const [currentPage, setCurrentPage] = useState(1);
  const [zoomLevel, setZoomLevel] = useState(80);
  const containerRef = useRef(null);
  const pageRefs = useRef([]);
  const measureCanvasRef = useRef(null);

  // Create a canvas for accurate text measurement
  const getTextHeight = (text, fontSize, fontFamily, maxWidth, isPreFormatted = false) => {
    if (!measureCanvasRef.current) {
      measureCanvasRef.current = document.createElement('canvas');
    }
    const canvas = measureCanvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.font = `${fontSize}px ${fontFamily}`;

    // For pre-formatted text (like notary blocks), respect newlines
    if (isPreFormatted) {
      const explicitLines = text.split('\n');
      let totalLines = 0;

      explicitLines.forEach(line => {
        if (line.trim() === '') {
          totalLines++; // Empty line still takes space
        } else {
          // Check if this line needs wrapping
          const metrics = ctx.measureText(line);
          if (metrics.width > maxWidth) {
            // Line is too long, calculate wrapped lines
            const words = line.split(' ');
            let currentLine = '';
            let wrappedLineCount = 0;

            words.forEach(word => {
              const testLine = currentLine ? `${currentLine} ${word}` : word;
              const testMetrics = ctx.measureText(testLine);

              if (testMetrics.width > maxWidth && currentLine) {
                wrappedLineCount++;
                currentLine = word;
              } else {
                currentLine = testLine;
              }
            });
            if (currentLine) wrappedLineCount++;
            totalLines += wrappedLineCount;
          } else {
            totalLines++;
          }
        }
      });

      // For pre-formatted text, just return lines * lineHeight (no extra line)
      return totalLines * PAGE_CONFIG.lineHeight;
    }

    // For regular text, split by words and calculate wrapped lines
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';

    words.forEach(word => {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const metrics = ctx.measureText(testLine);

      if (metrics.width > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    });
    if (currentLine) lines.push(currentLine);

    // Return total height (lines * line height)
    // Note: Individual sections add their own spacing/margins as needed
    return lines.length * PAGE_CONFIG.lineHeight;
  };

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

          // CONVENTION: Last fact must have keepWithNext to prevent orphaning closing sections
          // Closing sections (conclusion, perjury, signature, notary) must always be with at least one fact
          const isLastFact = factIndex === section.items.length - 1;
          const hasNotaryBlock = sections.notaryBlock || sections.notaryInstruction;

          allContent.push({
            type: factType, // Can be 'competency' or 'fact'
            content: `${factNumber}. ${factContent}`,
            keepWithNext: isLastFact && hasNotaryBlock, // Keep closing sections with at least one fact
            breakBefore: false,
            isBlockElement: false,
            isLastFact: isLastFact  // Track if this is the last fact for special handling
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
    // Available writable height: 879px
    // This allows optimal content per page while maintaining readability
    const maxPageHeight = 879;

    console.log(`📄 Total sections to paginate: ${allContent.length}`);
    allContent.forEach((section, idx) => {
      console.log(`  ${idx}: ${section.type} - ${section.content?.substring(0, 50)}...`);
      // CRITICAL: Height estimation must match PDF rendering for WYSIWYG accuracy
      // PDF uses PDFKit points (72 DPI), Preview uses CSS pixels (96 DPI)
      // Conversion: PDF points × (96/72) = CSS pixels
      // Example: 80 points × 1.333 = 106.67px ≈ 106px
      let sectionHeight = 0;
      const contentWidth = (PAGE_CONFIG.width - PAGE_CONFIG.marginLeft - PAGE_CONFIG.marginRight) * 96; // Available width in pixels

      switch(section.type) {
        case 'header':
        case 'venue':
          sectionHeight = 60; // Reduced: 0.5 moveDown in PDF (12pt = 16px) + text height
          break;
        case 'title':
          sectionHeight = 80; // Title with border and 1.5 moveDown (PDF uses ~60 points = 80px)
          break;
        case 'caseCaption':
        case 'case-caption':
          // Use actual text measurement for multi-line captions
          // PDF: text + moveDown(1.5) + border + moveDown(1.0)
          // Preview: text + padding-bottom(20px) + border(2px) + margin-bottom(16px) = text + 38px
          sectionHeight = getTextHeight(section.content || '', PAGE_CONFIG.fontSize, '"Times New Roman", Times, serif', contentWidth) + 38;
          break;
        case 'notary':
        case 'notaryBlock':
          // Use actual text measurement - notary blocks are pre-formatted with newlines
          // PDF: text height + border margins (10pt each side = 20pt = 27px) + spacing
          sectionHeight = getTextHeight(section.content || '', PAGE_CONFIG.fontSize, '"Times New Roman", Times, serif', contentWidth - 48, true) + 40; // Account for padding + border + margins
          break;
        case 'notary-instruction':
        case 'notaryInstruction':
          // Use actual text measurement with smaller font - instructions are pre-formatted
          // PDF: instructionHeight + 40pt = height + 53px (matching pdfService.js:314)
          sectionHeight = getTextHeight(section.content || '', PAGE_CONFIG.fontSize - 3, '"Times New Roman", Times, serif', contentWidth - 48, true) + 53; // 10pt font + 40pt padding (PDF line 314)
          break;
        case 'signature':
        case 'signatureBlock':
          // Use actual text measurement for signature lines - signatures are pre-formatted
          sectionHeight = getTextHeight(section.content || '', PAGE_CONFIG.fontSize, '"Times New Roman", Times, serif', contentWidth, true) + 40; // Extra margin for signature spacing
          break;
        case 'perjury':
        case 'perjuryStatement':
          // Use actual text measurement with indent
          sectionHeight = getTextHeight(section.content || '', PAGE_CONFIG.fontSize, '"Times New Roman", Times, serif', contentWidth - 48) + 24; // Account for indent
          break;
        case 'conclusion':
          // Use actual text measurement with indent
          sectionHeight = getTextHeight(section.content || '', PAGE_CONFIG.fontSize, '"Times New Roman", Times, serif', contentWidth - 48) + 24; // Account for indent
          break;
        case 'introduction':
          // Use actual text measurement with indent
          sectionHeight = getTextHeight(section.content || '', PAGE_CONFIG.fontSize, '"Times New Roman", Times, serif', contentWidth - 48) + 24; // Account for indent
          break;
        case 'fact':
        case 'competency':
        default:
          // Use actual text measurement for facts
          // PDF uses: estimateTextHeight(text, 12) + 20pt + moveDown(1.0) = text + 32pt = text + 43px
          // But our getTextHeight might measure differently than PDF's heightOfString
          // Using +30px as a balanced buffer that accounts for line spacing
          sectionHeight = getTextHeight(section.content || '', PAGE_CONFIG.fontSize, '"Times New Roman", Times, serif', contentWidth) + 30;
          break;
      }
      
      // Check if we need a page break
      const wouldOverflow = currentPageHeight + sectionHeight > maxPageHeight;
      const needsPageBreak = wouldOverflow && currentPageContent.length > 0;
      
      // Special handling for keep-together elements
      if (section.keepWithNext && idx < allContent.length - 1) {
        // SIMPLIFIED: Calculate total height for sections that should stay together
        // The keepWithNext chain for affidavits is typically:
        // conclusion → perjury → signature → notary instruction → notary block
        //
        // We calculate the TOTAL height of this chain to ensure they fit together
        let totalKeepTogetherHeight = sectionHeight;

        // Look ahead and sum up heights of all sections that should stay together
        for (let i = idx + 1; i < allContent.length; i++) {
          const followingSection = allContent[i];
          let followingHeight = 0;

          switch(followingSection.type) {
            case 'notary':
            case 'notaryBlock':
              followingHeight = getTextHeight(followingSection.content || '', PAGE_CONFIG.fontSize, '"Times New Roman", Times, serif', contentWidth - 48, true) + 40;
              break;
            case 'notary-instruction':
            case 'notaryInstruction':
              followingHeight = getTextHeight(followingSection.content || '', PAGE_CONFIG.fontSize - 3, '"Times New Roman", Times, serif', contentWidth - 48, true) + 53;
              break;
            case 'signature':
            case 'signatureBlock':
              followingHeight = getTextHeight(followingSection.content || '', PAGE_CONFIG.fontSize, '"Times New Roman", Times, serif', contentWidth, true) + 40;
              break;
            case 'perjuryStatement':
            case 'perjury':
              followingHeight = getTextHeight(followingSection.content || '', PAGE_CONFIG.fontSize, '"Times New Roman", Times, serif', contentWidth - 48) + 24;
              break;
            case 'conclusion':
              followingHeight = getTextHeight(followingSection.content || '', PAGE_CONFIG.fontSize, '"Times New Roman", Times, serif', contentWidth - 48) + 24;
              break;
            default:
              followingHeight = getTextHeight(followingSection.content || '', PAGE_CONFIG.fontSize, '"Times New Roman", Times, serif', contentWidth) + PAGE_CONFIG.lineHeight;
              break;
          }

          totalKeepTogetherHeight += followingHeight;

          // If this following section also has keepWithNext, continue looking ahead
          if (!followingSection.keepWithNext) {
            break;
          }
        }

        // Check if all sections that should stay together fit on current page
        const wouldExceedPage = currentPageHeight + totalKeepTogetherHeight > maxPageHeight;
        const hasContentBefore = currentPageContent.length > 0;

        if (wouldExceedPage && hasContentBefore) {
          // Add continuation marker when breaking before the last fact due to keep-together constraints
          // This matches the PDF behavior (pdfService.js:232-237)
          if (section.isLastFact) {
            currentPageContent.push({
              type: 'continuation',
              content: '(Continued on next page)',
              keepWithNext: false,
              breakBefore: false,
              isBlockElement: false
            });
            // Account for continuation marker height
            currentPageHeight += CONTINUATION_MARKER_HEIGHT;
          }

          // Break page and start fresh for this keep-together chain
          paginatedPages.push({
            content: currentPageContent,
            pageNumber: paginatedPages.length + 1
          });
          currentPageContent = [];
          currentPageHeight = 0;
        }
      } else if (needsPageBreak) {
        // Check if previous section had keepWithNext - if so, DON'T break
        // This ensures sections like notary-instruction stay with notary-block
        const previousSection = idx > 0 ? allContent[idx - 1] : null;
        const previousHasKeepWithNext = previousSection?.keepWithNext === true;

        if (!previousHasKeepWithNext) {
          // Start new page only if previous section doesn't require staying together
          paginatedPages.push({
            content: currentPageContent,
            pageNumber: paginatedPages.length + 1
          });
          currentPageContent = [];
          currentPageHeight = 0;
        }
      }

      currentPageContent.push(section);
      currentPageHeight += sectionHeight;

      console.log(`  ✅ Added ${section.type} to page ${paginatedPages.length + 1}, height now: ${currentPageHeight}/${maxPageHeight}`);
    });

    // Add final page
    if (currentPageContent.length > 0) {
      paginatedPages.push({
        content: currentPageContent,
        pageNumber: paginatedPages.length + 1
      });
    }

    // Log final pagination
    console.log(`📊 Final pagination:`);
    paginatedPages.forEach((page, idx) => {
      console.log(`  Page ${page.pageNumber}: ${page.content.length} items`);
      page.content.forEach((section, sIdx) => {
        console.log(`    ${sIdx}: ${section.type} - ${section.content?.substring(0, 50)}...`);
      });
    });

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
            {section.content}
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

      case 'continuation':
        return (
          <div key={key} className="affidavit-continuation">
            {section.content}
          </div>
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
          /* Let pagination logic control content height - no max-height restriction */
          /* Removing max-height prevents overflow: hidden from cutting off content */
        }

        /* Affidavit-specific styles */
        .affidavit-header {
          text-align: center;
          font-weight: bold;
          margin-bottom: 16px; /* 0.5 moveDown in PDF (12pt = 16px) */
        }

        .affidavit-venue {
          text-align: center;
          margin-bottom: 16px; /* 0.5 moveDown in PDF (12pt = 16px) */
        }

        .affidavit-caption {
          text-align: center;
          padding-bottom: 20px; /* PDF moveDown(1.5) ≈ 18-22px before border */
          margin-bottom: 16px; /* PDF moveDown(1.0) ≈ 12-16px after border */
          border-bottom: 2px solid black;
          white-space: pre-line;
        }

        .affidavit-title {
          text-align: center;
          font-weight: bold;
          font-size: ${PAGE_CONFIG.fontSize + 2}px;
          padding-bottom: 12px;
          margin-bottom: 24px;
          border-bottom: 2px solid black;
        }

        .affidavit-paragraph {
          text-align: justify;
          margin-bottom: ${PAGE_CONFIG.lineHeight}px;
          text-indent: 0.5in;
        }

        .affidavit-fact {
          text-align: justify;
          margin-bottom: ${PAGE_CONFIG.lineHeight}px;
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

        .affidavit-notary-instruction {
          margin-top: ${PAGE_CONFIG.lineHeight}px;
          margin-bottom: ${PAGE_CONFIG.lineHeight}px;
          padding: ${PAGE_CONFIG.lineHeight / 2}px;
          border: 2px solid #0066cc;
          color: #0066cc;
          font-weight: bold;
          font-size: ${PAGE_CONFIG.fontSize - 3}px; /* 10pt equivalent */
        }

        .affidavit-notary-instruction pre {
          font-family: 'Times New Roman', Times, serif;
          font-size: ${PAGE_CONFIG.fontSize - 3}px; /* 10pt equivalent */
          font-weight: bold;
          margin: 0;
          white-space: pre-wrap;
          color: #0066cc;
        }

        .affidavit-continuation {
          text-align: center;
          font-style: italic;
          font-size: ${PAGE_CONFIG.fontSize - 1}px;
          margin-top: ${PAGE_CONFIG.lineHeight}px;
          margin-bottom: ${PAGE_CONFIG.lineHeight / 2}px;
          color: #333;
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