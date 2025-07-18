// client/src/components/DocumentPreview.js - Fixed height with better controls
import React, { useState } from 'react';
import { FileText, Download, Loader2, ZoomIn, ZoomOut, Maximize2, Minimize2 } from 'lucide-react';

const DocumentPreview = ({ 
  preview, 
  affidavitData, 
  documentComplete, 
  validation,
  onDownload,
  isPreviewLoading
}) => {
  const [zoom, setZoom] = useState(85); // Start at 85% for better fit
  const [isFullscreen, setIsFullscreen] = useState(false);

  if (isPreviewLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border h-full flex flex-col">
        <div className="p-4 border-b flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">Document Preview</h2>
          <p className="text-sm text-gray-600">Live preview using {affidavitData.state || 'state'} template</p>
        </div>
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <Loader2 className="h-12 w-12 mx-auto mb-4 text-blue-500 animate-spin" />
            <p>Updating Preview...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="bg-white rounded-lg shadow-sm border h-full flex flex-col">
        <div className="p-4 border-b flex-shrink-0">
          <h2 className="text-lg font-semibold text-gray-900">Document Preview</h2>
          <p className="text-sm text-gray-600">Live preview using {affidavitData.state || 'state'} template</p>
        </div>
        
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p>Preview will appear here as you provide information.</p>
          </div>
        </div>
      </div>
    );
  }

  const zoomIn = () => setZoom(prev => Math.min(prev + 15, 150));
  const zoomOut = () => setZoom(prev => Math.max(prev - 15, 50));
  const toggleFullscreen = () => setIsFullscreen(prev => !prev);

  return (
    <div className={`bg-white rounded-lg shadow-sm border flex flex-col ${
      isFullscreen ? 'fixed inset-4 z-50' : 'h-full'
    }`}>
      {/* Compact Header */}
      <div className="px-4 py-3 border-b flex justify-between items-center flex-shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Preview</h2>
          <p className="text-xs text-gray-600">{affidavitData.state || 'Select state'} template</p>
        </div>
        
        <div className="flex items-center space-x-2">
          {/* Compact Zoom controls */}
          <div className="flex items-center bg-gray-100 rounded px-1">
            <button
              onClick={zoomOut}
              disabled={zoom <= 50}
              className="p-1 hover:bg-white rounded disabled:opacity-50"
              title="Zoom out"
            >
              <ZoomOut className="h-3 w-3" />
            </button>
            <span className="text-xs px-2 min-w-10 text-center font-medium">
              {zoom}%
            </span>
            <button
              onClick={zoomIn}
              disabled={zoom >= 150}
              className="p-1 hover:bg-white rounded disabled:opacity-50"
              title="Zoom in"
            >
              <ZoomIn className="h-3 w-3" />
            </button>
          </div>
          
          {/* Fullscreen toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 hover:bg-gray-100 rounded"
            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
          
          {/* Download button */}
          {documentComplete && validation?.isValid && (
            <button
              onClick={onDownload}
              className="flex items-center px-3 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium text-sm"
            >
              <Download className="h-3 w-3 mr-1" />
              Download
            </button>
          )}
        </div>
      </div>
      
      {/* Document container with 8.5x11 proportions */}
      <div 
        className="flex-1 overflow-y-auto bg-gray-100 p-2" 
        style={{ 
          minHeight: 0
        }}
      >
        <div 
          className="bg-white shadow-lg mx-auto relative"
          style={{ 
            width: `${Math.min(zoom, 120)}%`, // Allow wider display
            maxWidth: '100%',
            // Proper 8.5x11 aspect ratio calculation: height = width * (11/8.5)
            height: isFullscreen ? 'auto' : `${zoom * 1.29}%`, // 11/8.5 = 1.294
            aspectRatio: isFullscreen ? 'auto' : '8.5 / 11',
            fontSize: `${zoom * 0.12}pt`,
            lineHeight: 1.4,
            fontFamily: 'Times New Roman, serif',
            transformOrigin: 'top center',
            minHeight: isFullscreen ? '11in' : '400px', // Ensure minimum readable size
            overflow: 'hidden' // Prevent content from breaking aspect ratio
          }}
        >
          {/* Subtle preview watermark */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) rotate(-45deg)',
            fontSize: `${Math.max(zoom * 0.5, 24)}px`,
            color: 'rgba(0,0,0,0.04)',
            fontWeight: 'bold',
            zIndex: 0,
            pointerEvents: 'none',
            userSelect: 'none'
          }}>
            PREVIEW
          </div>
          
          {/* Document content */}
          <div style={{ 
            position: 'relative', 
            zIndex: 1, 
            padding: isFullscreen ? '1in' : `${zoom * 0.4}px`
          }}>
            {preview.sections?.header && (
              <div style={{ 
                textAlign: 'center', 
                fontWeight: 'bold', 
                marginBottom: `${zoom * 0.2}px`,
                fontSize: '1.1em'
              }}>
                {preview.sections.header}
              </div>
            )}
            
            {preview.sections?.venue && (
              <div style={{ 
                textAlign: 'center', 
                fontWeight: 'bold', 
                marginBottom: `${zoom * 0.2}px`
              }}>
                {preview.sections.venue}
              </div>
            )}
            
            {preview.sections?.caseCaption && (
              <div style={{ 
                textAlign: 'right', 
                marginBottom: `${zoom * 0.2}px`,
                borderBottom: '1px solid #000',
                paddingBottom: `${zoom * 0.1}px`
              }}>
                <div dangerouslySetInnerHTML={{
                  __html: preview.sections.caseCaption.formatted.replace(/\n/g, '<br />')
                }} />
              </div>
            )}
            
            {preview.sections?.title && (
              <div style={{ 
                textAlign: 'center', 
                fontWeight: 'bold', 
                textDecoration: 'underline', 
                fontSize: '1.1em', 
                margin: `${zoom * 0.3}px 0`,
                textTransform: 'uppercase'
              }}>
                {preview.sections.title}
              </div>
            )}
            
            {preview.sections?.introduction && (
              <div style={{ 
                textAlign: 'justify', 
                textIndent: '0.4in', 
                marginBottom: `${zoom * 0.2}px`
              }}>
                {preview.sections.introduction}
              </div>
            )}
            
            {preview.sections?.facts && preview.sections.facts.length > 0 && (
              <div style={{ marginBottom: `${zoom * 0.2}px` }}>
                {preview.sections.facts.map((fact, index) => (
                  <div key={index} style={{ 
                    display: 'flex', 
                    marginBottom: `${zoom * 0.15}px`, 
                    textAlign: 'justify',
                    alignItems: 'flex-start'
                  }}>
                    <span style={{ 
                      minWidth: `${zoom * 0.3}px`, 
                      fontWeight: 'bold',
                      marginRight: `${zoom * 0.1}px`
                    }}>
                      {fact.number}.
                    </span>
                    <span style={{ flex: 1 }}>{fact.content}</span>
                  </div>
                ))}
              </div>
            )}
            
            {preview.sections?.conclusion && (
              <div style={{ 
                textAlign: 'justify', 
                textIndent: '0.4in', 
                marginBottom: `${zoom * 0.2}px`
              }}>
                {preview.sections.conclusion}
              </div>
            )}
            
            {preview.sections?.perjuryStatement && (
              <div style={{ 
                textAlign: 'justify', 
                textIndent: '0.4in', 
                marginBottom: `${zoom * 0.3}px`,
                fontWeight: 'bold'
              }}>
                {preview.sections.perjuryStatement}
              </div>
            )}
            
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
      
      {/* Minimal Footer */}
      <div className="px-4 py-2 border-t bg-gray-50 text-xs text-gray-500 flex-shrink-0">
        <div className="flex justify-between items-center">
          <span>ID: {affidavitData.documentId || 'Preview'}</span>
          <span>{affidavitData.state || 'No state'} • {zoom}%</span>
        </div>
      </div>
    </div>
  );
};

export default DocumentPreview;