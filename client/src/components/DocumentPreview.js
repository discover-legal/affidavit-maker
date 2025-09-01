// client/src/components/DocumentPreview.js - Auto-Updating Preview
import React, { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

const DocumentPreview = ({ affidavitData }) => {
  const [preview, setPreview] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const { getAccessTokenSilently } = useAuth0();

  // Auto-update preview when affidavit data changes
  useEffect(() => {
    console.log('🔍 DocumentPreview: Data changed, updating preview:', affidavitData);
    
    if (affidavitData && (affidavitData.state || affidavitData.affiantName || affidavitData.facts)) {
      updatePreview();
    } else {
      setPreview(null);
      console.log('🔍 DocumentPreview: No data to preview yet');
    }
  }, [affidavitData]);

  const updatePreview = async () => {
    if (!affidavitData || (!affidavitData.state && !affidavitData.affiantName)) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('🔍 DocumentPreview: Calling preview API with:', affidavitData);
      
      const response = await fetch('http://localhost:3001/api/preview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ affidavitData })
      });

      if (!response.ok) {
        throw new Error(`Preview API failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('🔍 DocumentPreview: Preview API response:', data);

      if (data.success && data.preview) {
        setPreview(data.preview);
      } else {
        throw new Error(data.error || 'Preview generation failed');
      }

    } catch (error) {
      console.error('🔍 DocumentPreview: Error updating preview:', error);
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
    };
  const renderSection = (section, index) => {
    if (!section) return null;

    // Handle both object and array section formats
    const sectionData = typeof section === 'string' ? { type: 'text', content: section } : section;
    
    switch (sectionData.type) {
      case 'header':
        return (
          <div key={index} className="text-center mb-6">
            <h1 className="text-2xl font-bold mb-2">{sectionData.title || 'AFFIDAVIT'}</h1>
            {sectionData.content && <p className="text-lg">{sectionData.content}</p>}
          </div>
        );

      case 'venue':
        return (
          <div key={index} className="mb-6">
            <div className="text-right">
              <p className="font-semibold">{sectionData.content || 'STATE OF [STATE]'}</p>
              <p className="font-semibold">COUNTY OF [COUNTY]</p>
            </div>
          </div>
        );

      case 'introduction':
        return (
          <div key={index} className="mb-6">
            <p className="leading-relaxed">{sectionData.content}</p>
          </div>
        );

      case 'facts':
        return (
          <div key={index} className="mb-6">
            <h2 className="text-lg font-semibold mb-3">STATEMENT OF FACTS</h2>
            {Array.isArray(sectionData.content) ? (
              <ol className="space-y-2">
                {sectionData.content.map((fact, factIndex) => (
                  <li key={factIndex} className="flex">
                    <span className="mr-3 text-gray-600">{factIndex + 1}.</span>
                    <span className="leading-relaxed">{fact}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-gray-500 italic">No facts provided yet</p>
            )}
          </div>
        );

      case 'signature':
      case 'signatureBlock':
        return (
          <div key={index} className="mt-8 mb-6">
            <div className="bg-gray-50 p-4 rounded border-2 border-dashed border-gray-300">
              <p className="text-gray-600">[Signature will appear here when document is finalized]</p>
              <div className="mt-4">
                <p>_________________________________</p>
                <p className="text-sm text-gray-600">
                  {affidavitData.affiantName || '[Affiant Name]'}
                </p>
              </div>
            </div>
          </div>
        );

      case 'notary':
      case 'notaryBlock':
        return (
          <div key={index} className="mb-6">
            <h2 className="text-lg font-semibold mb-2">NOTARIZATION</h2>
            <div className="bg-gray-50 p-4 rounded border-2 border-dashed border-gray-300">
              <p className="text-gray-600">Notary acknowledgment will appear here</p>
            </div>
          </div>
        );

      default:
        return (
          <div key={index} className="mb-6">
            {sectionData.title && <h2 className="text-lg font-semibold mb-2">{sectionData.title}</h2>}
            <p className="leading-relaxed">{sectionData.content || sectionData}</p>
          </div>
        );
    }
  };


  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="p-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">Document Preview</h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-gray-600">Generating preview...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="p-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">Document Preview</h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-red-600">
            <p>Preview error: {error}</p>
            <button 
              onClick={updatePreview}
              className="mt-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="p-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">Document Preview</h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <p>Start chatting to see your affidavit preview</p>
            <p className="text-sm mt-1">Tell the assistant your name and state</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="p-4 border-b bg-gray-50">
        <h2 className="text-lg font-semibold text-gray-900">Document Preview</h2>
        <p className="text-sm text-gray-600">Live preview of your affidavit</p>
      </div>

      {/* Preview Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto bg-white shadow-sm border rounded-lg p-8">
          {/* ✅ FIXED: Handle both sections object and array */}
          {preview?.sections ? (
            typeof preview.sections === 'object' ? (
              // Handle sections as object (from StateTemplateManager)
              Object.entries(preview.sections).map(([key, section], index) => 
                renderSection({ ...section, type: key }, `${key}-${index}`)
              )
            ) : Array.isArray(preview.sections) ? (
              // Handle sections as array
              preview.sections.map((section, index) => renderSection(section, index))
            ) : (
              <p className="text-gray-500">Preview format not recognized</p>
            )
          ) : (
            <div className="text-center text-gray-500">
              <p>Start chatting to see your affidavit preview</p>
              <p className="text-sm mt-1">Tell the assistant your name and state</p>
            </div>
          )}
        </div>
      </div>

      {/* Footer with metadata */}
      {preview.metadata && (
        <div className="p-4 border-t bg-gray-50 text-sm text-gray-600">
          <div className="flex justify-between">
            <span>State: {preview.metadata.stateName || 'Not specified'}</span>
            <span>Estimated pages: {preview.metadata.estimatedPages || 1}</span>
          </div>
        </div>
      )}

      {/* Debug info in development */}
      {process.env.NODE_ENV === 'development' && (
        <div className="p-2 bg-yellow-50 border-t text-xs">
          <details>
            <summary>Preview Debug (click to expand)</summary>
            <pre className="mt-2 whitespace-pre-wrap text-xs">
              {JSON.stringify({ affidavitData, preview }, null, 2)}
            </pre>
          </details>
        </div>
      )}
    </div>
  );
};

export default DocumentPreview;