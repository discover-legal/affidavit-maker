// client/src/components/DocumentPreview.js
import React from 'react';
import { FileText, Download } from 'lucide-react';

const DocumentPreview = ({ 
  preview, 
  affidavitData, 
  documentComplete, 
  validation,
  onDownload 
}) => {
  if (!preview) {
    return (
      <div className="bg-white rounded-lg shadow-sm border h-full">
        <div className="p-6 border-b">
          <h2 className="text-lg font-semibold text-gray-900">Document Preview</h2>
          <p className="text-sm text-gray-600">Live preview using {affidavitData.state || 'state'} template</p>
        </div>
        
        <div className="p-6">
          <div className="flex items-center justify-center h-64 text-gray-500">
            <div className="text-center">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
              <p>Preview will appear when you provide basic information</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border h-full flex flex-col">
      <div className="p-6 border-b flex justify-between items-center">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Document Preview</h2>
          <p className="text-sm text-gray-600">Live preview using {affidavitData.state || 'state'} template</p>
        </div>
        {documentComplete && validation?.isValid && (
          <button
            onClick={onDownload}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Download className="h-4 w-4 mr-2" />
            Download PDF
          </button>
        )}
      </div>
      
      <div className="flex-1 p-6 overflow-y-auto">
        <div className="bg-white shadow-lg mx-auto" style={{ 
          width: '8.5in', 
          minHeight: '11in',
          padding: '1in',
          fontSize: '12pt',
          lineHeight: '1.5',
          fontFamily: 'Times New Roman, serif',
          position: 'relative'
        }}>
          {/* Watermark for preview */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) rotate(-45deg)',
            fontSize: '72px',
            color: 'rgba(0,0,0,0.08)',
            fontWeight: 'bold',
            zIndex: 0,
            pointerEvents: 'none'
          }}>
            PREVIEW
          </div>

          {/* Document Content */}
          <div style={{ position: 'relative', zIndex: 1 }}>
            {preview.sections?.header && (
              <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: '20px' }}>
                {preview.sections.header}
              </div>
            )}
            
            {preview.sections?.venue && (
              <div style={{ textAlign: 'center', fontWeight: 'bold', marginBottom: '20px' }}>
                {preview.sections.venue}
              </div>
            )}
            
            {preview.sections?.caseCaption && (
              <div style={{ textAlign: 'right', marginBottom: '20px' }}>
                {preview.sections.caseCaption.formatted}
              </div>
            )}
            
            {preview.sections?.title && (
              <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '14pt', marginBottom: '30px' }}>
                {preview.sections.title}
              </div>
            )}
            
            {preview.sections?.introduction && (
              <div style={{ textAlign: 'justify', marginBottom: '20px' }}>
                {preview.sections.introduction}
              </div>
            )}
            
            {preview.sections?.facts && preview.sections.facts.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                {preview.sections.facts.map((fact, index) => (
                  <div key={index} style={{ marginBottom: '15px', textAlign: 'justify' }}>
                    <strong>{fact.number}.</strong> {fact.content}
                  </div>
                ))}
              </div>
            )}
            
            {preview.sections?.conclusion && (
              <div style={{ textAlign: 'justify', marginBottom: '20px' }}>
                {preview.sections.conclusion}
              </div>
            )}
            
            {preview.sections?.perjuryStatement && (
              <div style={{ textAlign: 'justify', marginBottom: '30px' }}>
                {preview.sections.perjuryStatement}
              </div>
            )}
            
            {preview.sections?.signatureBlock && (
              <div style={{ marginBottom: '30px' }}>
                <div>{preview.sections.signatureBlock.line}</div>
                <div>{preview.sections.signatureBlock.name}</div>
                <div>{preview.sections.signatureBlock.title}</div>
                {preview.sections.signatureBlock.date && (
                  <div style={{ marginTop: '10px' }}>{preview.sections.signatureBlock.date}</div>
                )}
              </div>
            )}
            
            {preview.sections?.notaryBlock && (
              <div style={{ 
                border: '2px solid #000', 
                padding: '20px', 
                marginTop: '30px',
                backgroundColor: '#f9f9f9'
              }}>
                <pre style={{ fontFamily: 'Times New Roman, serif', fontSize: '12pt', margin: 0 }}>
                  {preview.sections.notaryBlock}
                </pre>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentPreview;