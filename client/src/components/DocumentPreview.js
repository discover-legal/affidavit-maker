
// client/src/components/DocumentPreview.js 
import React, { useState, useRef, useEffect } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Loader, FileText, AlertTriangle } from 'lucide-react';

const DocumentPreview = ({ affidavitData, preview, isLoading }) => {
  const [zoom, setZoom] = useState(85);
  const [containerHeight, setContainerHeight] = useState(0);
  const containerRef = useRef(null);
  const contentRef = useRef(null);

  // Fixed height calculation to prevent scrolling issues
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const availableHeight = window.innerHeight - rect.top;
        setContainerHeight(Math.max(400, availableHeight - 20)); // 20px buffer
      }
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  const handleZoomIn = () => setZoom(prev => Math.min(150, prev + 10));
  const handleZoomOut = () => setZoom(prev => Math.max(50, prev - 10));
  const handleResetZoom = () => setZoom(85);

  if (isLoading) {
    return (
      <div 
        className="bg-white flex flex-col"
        style={{ height: containerHeight || '100vh' }}
      >
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Loader className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
            <p className="text-gray-600">Generating preview...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!preview) {
    return (
      <div 
        className="bg-white flex flex-col"
        style={{ height: containerHeight || '100vh' }}
      >
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Preview Not Available</h3>
            <p className="text-gray-600">
              Start chatting to see your affidavit preview
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="bg-white flex flex-col"
      style={{ height: containerHeight || '100vh', overflow: 'hidden' }}
    >
      {/* Fixed Header */}
      <div className="px-4 py-3 border-b bg-gray-50 flex-shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Document Preview</h2>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleZoomOut}
              className="p-1 text-gray-600 hover:text-gray-900"
              title="Zoom Out"
            >
              <ZoomOut className="h-4 w-4" />
            </button>
            <span className="text-sm text-gray-600 min-w-[50px] text-center">{zoom}%</span>
            <button
              onClick={handleZoomIn}
              className="p-1 text-gray-600 hover:text-gray-900"
              title="Zoom In"
            >
              <ZoomIn className="h-4 w-4" />
            </button>
            <button
              onClick={handleResetZoom}
              className="p-1 text-gray-600 hover:text-gray-900"
              title="Reset Zoom"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Scrollable Content Area - Fixed overflow handling */}
      <div className="flex-1 overflow-auto bg-gray-100 p-4" style={{ minHeight: 0 }}>
        <div className="max-w-2xl mx-auto">
          {/* Paper Container - Fixed dimensions */}
          <div 
            ref={contentRef}
            className="bg-white shadow-lg mx-auto"
            style={{
              width: `${zoom * 8.5}px`, // 8.5 inches at current zoom
              minHeight: `${zoom * 11}px`, // 11 inches minimum
              transform: `scale(${zoom / 100})`,
              transformOrigin: 'top center',
              marginBottom: '2rem'
            }}
          >
            {/* Document Content */}
            <div style={{ 
              padding: `${zoom * 0.75}px`, // 0.75 inch margins
              fontFamily: 'Times New Roman, serif',
              fontSize: `${zoom * 0.12}px`, // 12pt at 100% zoom
              lineHeight: 1.5,
              color: '#000'
            }}>
              
              {/* Header */}
              {preview.sections?.header && (
                <div style={{ 
                  textAlign: 'center', 
                  fontWeight: 'bold', 
                  fontSize: `${zoom * 0.16}px`,
                  marginBottom: `${zoom * 0.1}px`
                }}>
                  {preview.sections.header}
                </div>
              )}
              
              {/* Venue */}
              {preview.sections?.venue && (
                <div style={{ 
                  textAlign: 'center', 
                  fontWeight: 'bold',
                  fontSize: `${zoom * 0.14}px`,
                  marginBottom: `${zoom * 0.1}px`
                }}>
                  {preview.sections.venue}
                </div>
              )}

              {/* Case Caption */}
              {preview.sections?.caseCaption && (
                <div style={{ 
                  textAlign: 'right',
                  marginBottom: `${zoom * 0.2}px`
                }}>
                  {preview.sections.caseCaption.formatted || preview.sections.caseCaption}
                </div>
              )}

              {/* Title */}
              {preview.sections?.title && (
                <div style={{ 
                  textAlign: 'center', 
                  fontWeight: 'bold',
                  fontSize: `${zoom * 0.14}px`,
                  marginBottom: `${zoom * 0.3}px`
                }}>
                  {preview.sections.title}
                </div>
              )}

              {/* Introduction */}
              {preview.sections?.introduction && (
                <div style={{ 
                  textAlign: 'justify', 
                  textIndent: `${zoom * 0.4}px`,
                  marginBottom: `${zoom * 0.2}px`
                }}>
                  {preview.sections.introduction}
                </div>
              )}

              {/* Facts */}
              {preview.sections?.facts && preview.sections.facts.length > 0 && (
                <div style={{ marginBottom: `${zoom * 0.2}px` }}>
                  {preview.sections.facts.map((fact, index) => (
                    <div key={index} style={{ 
                      marginBottom: `${zoom * 0.1}px`,
                      display: 'flex',
                      textAlign: 'justify'
                    }}>
                      <span style={{ 
                        minWidth: `${zoom * 0.25}px`,
                        fontWeight: 'normal'
                      }}>
                        {fact.number}.
                      </span>
                      <span style={{ flex: 1 }}>{fact.content}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Conclusion */}
              {preview.sections?.conclusion && (
                <div style={{ 
                  textAlign: 'justify', 
                  textIndent: `${zoom * 0.4}px`, 
                  marginBottom: `${zoom * 0.2}px`
                }}>
                  {preview.sections.conclusion}
                </div>
              )}
              
              {/* Perjury Statement */}
              {preview.sections?.perjuryStatement && (
                <div style={{ 
                  textAlign: 'justify', 
                  textIndent: `${zoom * 0.4}px`, 
                  marginBottom: `${zoom * 0.3}px`,
                  fontWeight: 'bold'
                }}>
                  {preview.sections.perjuryStatement}
                </div>
              )}
              
              {/* Signature Block */}
              {preview.sections?.signatureBlock && (
                <div style={{ 
                  marginTop: `${zoom * 0.4}px`, 
                  marginBottom: `${zoom * 0.3}px`
                }}>
                  <div style={{ 
                    marginBottom: `${zoom * 0.05}px`, 
                    borderBottom: '1px solid #000', 
                    width: `${zoom * 2.5}px`, 
                    height: `${zoom * 0.15}px` 
                  }}></div>
                  <div style={{ fontWeight: 'bold' }}>{preview.sections.signatureBlock.name}</div>
                  <div style={{ fontStyle: 'italic' }}>{preview.sections.signatureBlock.title}</div>
                  {preview.sections.signatureBlock.date && (
                    <div style={{ marginTop: `${zoom * 0.2}px` }}>{preview.sections.signatureBlock.date}</div>
                  )}
                </div>
              )}
              
              {/* Notary Block */}
              {preview.sections?.notaryBlock && (
                <div style={{ 
                  border: '1px solid #000', 
                  padding: `${zoom * 0.2}px`, 
                  marginTop: `${zoom * 0.4}px`,
                  backgroundColor: '#f9f9f9',
                  fontSize: '0.9em'
                }}>
                  <pre style={{ 
                    fontFamily: 'Times New Roman, serif', 
                    fontSize: 'inherit', 
                    margin: 0, 
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word'
                  }}>
                    {preview.sections.notaryBlock}
                  </pre>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Fixed Footer */}
      <div className="px-4 py-2 border-t bg-gray-50 text-xs text-gray-500 flex-shrink-0">
        <div className="flex justify-between items-center">
          <span>Discover.Legal • Professional Affidavit Creation</span>
          <span>{affidavitData.state || 'No state'} • {zoom}% • Page 1</span>
        </div>
      </div>
    </div>
  );
};

export default DocumentPreview;