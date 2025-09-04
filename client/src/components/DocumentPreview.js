// client/src/components/DocumentPreview.js - Enhanced with Better Data Handling
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { 
  FileText, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  RefreshCw,
  Eye,
  Award,
  TrendingUp
} from 'lucide-react';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// Legal category icons mapping
const CATEGORY_ICONS = {
  financial: '💰',
  property: '🏠', 
  parental: '👨‍👩‍👧‍👦',
  witness: '👁️',
  temporal: '📅',
  communication: '💬',
  relational: '👫',
  general: '📄'
};

const DocumentPreview = ({ affidavitData, onPreviewUpdate }) => {
  const [preview, setPreview] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  // Auto-update preview when affidavit data changes
  useEffect(() => {
    console.log('🔍 DocumentPreview: Data changed, updating preview');
    
    if (shouldUpdatePreview(affidavitData)) {
      updatePreview();
    } else {
      setPreview(null);
      setError(null);
    }
  }, [affidavitData]);

  // ✅ Smart preview update logic
  const shouldUpdatePreview = useCallback((data) => {
    if (!data) return false;
    
    // Update if we have basic required data
    return !!(
      data.affiantName || 
      data.state || 
      (data.facts && data.facts.length > 0)
    );
  }, []);

  const updatePreview = useCallback(async () => {
    if (!affidavitData) return;

    setIsLoading(true);
    setError(null);

    try {
      console.log('🔍 DocumentPreview: Calling preview API with:', {
        hasName: !!affidavitData.affiantName,
        hasState: !!affidavitData.state,
        factCount: affidavitData.facts?.length || 0
      });

      // ✅ Enhanced API call with better error handling
      const response = await fetch(`${API_BASE_URL}/api/preview`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          affidavitData: {
            ...affidavitData,
            // Ensure we have defaults for required fields
            state: affidavitData.state || 'TX',
            documentType: affidavitData.documentType || 'general',
            facts: affidavitData.facts || []
          }
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Preview API failed (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      console.log('🔍 DocumentPreview: API response structure:', {
        success: data.success,
        hasPreview: !!data.preview,
        hasData: !!data.data,
        topLevelKeys: Object.keys(data),
        fallback: data.fallback
      });

      // ✅ Handle multiple response formats
      let previewData = null;
      
      if (data.success) {
        // Try different response structures
        previewData = data.preview || data.data?.preview || data.data;
      }

      if (!previewData) {
        throw new Error('No preview data received from API');
      }

      // ✅ Validate preview structure
      if (!previewData.sections) {
        console.warn('Preview missing sections, creating fallback structure');
        previewData = createClientFallbackPreview(affidavitData);
      }

      setPreview(previewData);
      setLastUpdated(new Date());
      
      // Notify parent component
      if (onPreviewUpdate) {
        onPreviewUpdate(previewData);
      }

      console.log('✅ DocumentPreview: Preview updated successfully');

    } catch (error) {
      console.error('🔍 DocumentPreview: Error updating preview:', error);
      setError(error.message);
      
      // ✅ Create fallback preview on error
      const fallbackPreview = createClientFallbackPreview(affidavitData);
      setPreview(fallbackPreview);
    } finally {
      setIsLoading(false);
    }
  }, [affidavitData, onPreviewUpdate]);

  // ✅ Create fallback preview on client side
  const createClientFallbackPreview = useCallback((data) => {
    const facts = data.facts || [];
    
    return {
      sections: {
        header: {
          type: 'header',
          title: 'AFFIDAVIT',
          content: `STATE OF ${getStateName(data.state)}
COUNTY OF ${data.county || '[COUNTY TO BE DETERMINED]'}

AFFIDAVIT OF ${data.affiantName || '[YOUR NAME]'}`
        },
        introduction: {
          type: 'introduction',
          title: 'INTRODUCTION',
          content: `I, ${data.affiantName || '[YOUR NAME]'}, being first duly sworn, depose and state as follows:`
        },
        facts: {
          type: 'facts',
          title: 'STATEMENT OF FACTS',
          content: facts.length > 0 
            ? facts.map((fact, index) => {
                const content = fact.professionalRewrite || fact.content || fact;
                const category = fact.category ? ` [${fact.category}]` : '';
                return `${index + 1}. ${content}${category}`;
              }).join('\n\n')
            : 'No facts have been added yet. Start chatting to add facts to your affidavit.'
        },
        conclusion: {
          type: 'conclusion',
          title: 'CONCLUSION',
          content: `I declare under penalty of perjury that the foregoing is true and correct to the best of my knowledge and belief.

FURTHER AFFIANT SAYETH NOT.`
        },
        signature: {
          type: 'signature',
          title: 'SIGNATURE AND NOTARIZATION',
          content: `Executed on this _____ day of _________, 2025.

_________________________________
${data.affiantName || '[YOUR NAME]'}

[NOTARY ACKNOWLEDGMENT SECTION]`
        }
      },
      metadata: {
        stateName: getStateName(data.state),
        estimatedPages: Math.max(1, Math.ceil((facts.length * 50 + 300) / 250)),
        wordCount: estimateWordCount(facts),
        factCount: facts.length,
        isComplete: !!(data.affiantName && data.state && facts.length > 0),
        isClientFallback: true,
        categories: getCategorySummary(facts),
        qualityMetrics: calculateQualityMetrics(facts)
      }
    };
  }, []);

  // ✅ Render individual section with enhanced formatting
  const renderSection = (section, key) => {
    if (!section) return null;

    const sectionContent = section.content || section;
    
    switch (section.type || key) {
      case 'header':
        return (
          <div key={key} className="mb-8 text-center border-b pb-6">
            <h1 className="text-2xl font-bold mb-4">{section.title || 'AFFIDAVIT'}</h1>
            <div className="whitespace-pre-line text-sm leading-relaxed">
              {sectionContent}
            </div>
          </div>
        );

      case 'introduction':
        return (
          <div key={key} className="mb-6">
            <h2 className="text-lg font-semibold mb-3">{section.title}</h2>
            <div className="whitespace-pre-line leading-relaxed text-gray-800">
              {sectionContent}
            </div>
          </div>
        );

      case 'facts':
        return (
          <div key={key} className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">{section.title || 'FACTS'}</h2>
              {preview?.metadata?.categories && (
                <div className="flex space-x-1">
                  {Object.entries(preview.metadata.categories).map(([cat, info]) => (
                    <span 
                      key={cat}
                      className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full"
                      title={`${info.count} ${cat} facts`}
                    >
                      {CATEGORY_ICONS[cat] || '📄'} {info.count}
                    </span>
                  ))}
                </div>
              )}
            </div>
            
            <div className="space-y-4">
              {Array.isArray(affidavitData.facts) ? (
                // ✅ Enhanced fact rendering with categories
                affidavitData.facts.map((fact, index) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg border-l-4 border-blue-500">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-sm font-medium text-gray-600">
                        Fact #{index + 1}
                      </span>
                      {fact.category && (
                        <span className="text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded">
                          {CATEGORY_ICONS[fact.category] || '📄'} {fact.category}
                        </span>
                      )}
                    </div>
                    <p className="text-gray-800 leading-relaxed">
                      {fact.professionalRewrite || fact.content}
                    </p>
                    {fact.validationIssues && fact.validationIssues.length > 0 && (
                      <div className="mt-2 text-xs text-amber-600">
                        ⚠️ {fact.validationIssues.join(', ')}
                      </div>
                    )}
                  </div>
                ))
              ) : (
                // Fallback for string content
                <div className="whitespace-pre-line leading-relaxed text-gray-800 bg-gray-50 p-4 rounded-lg">
                  {sectionContent}
                </div>
              )}
            </div>
          </div>
        );

      case 'conclusion':
      case 'signature':
        return (
          <div key={key} className="mb-6">
            <h2 className="text-lg font-semibold mb-3">{section.title}</h2>
            <div className="whitespace-pre-line leading-relaxed text-gray-800 bg-gray-50 p-4 rounded-lg">
              {sectionContent}
            </div>
          </div>
        );

      default:
        return (
          <div key={key} className="mb-6">
            {section.title && <h2 className="text-lg font-semibold mb-3">{section.title}</h2>}
            <div className="whitespace-pre-line leading-relaxed text-gray-800">
              {sectionContent}
            </div>
          </div>
        );
    }
  };

  // ✅ Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="p-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">Document Preview</h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-2" />
            <p className="text-gray-600">Generating preview...</p>
          </div>
        </div>
      </div>
    );
  }

  // ✅ Error state with retry
  if (error && !preview) {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="p-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">Document Preview</h2>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-600 mb-3">Preview Error: {error}</p>
            <button 
              onClick={updatePreview}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry Preview
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ✅ Empty state
  if (!preview) {
    return (
      <div className="flex flex-col h-full bg-white">
        <div className="p-4 border-b bg-gray-50">
          <h2 className="text-lg font-semibold text-gray-900">Document Preview</h2>
          <p className="text-sm text-gray-500">Live preview of your affidavit</p>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center text-gray-500">
            <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-lg mb-1">Start Building Your Affidavit</p>
            <p className="text-sm">Tell the assistant your name and state to begin</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-white">
      {/* ✅ Enhanced Header with Quality Metrics */}
      <div className="p-4 border-b bg-gray-50">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Document Preview</h2>
            <p className="text-sm text-gray-500">
              {preview.metadata?.factCount || 0} facts • {preview.metadata?.wordCount || 0} words
            </p>
          </div>
          
          {preview.metadata?.qualityMetrics && (
            <div className="flex items-center space-x-3">
              {/* Quality Score */}
              <div className="text-right">
                <div className="flex items-center">
                  <Award className="h-4 w-4 text-yellow-500 mr-1" />
                  <span className="text-sm font-medium">
                    {preview.metadata.qualityMetrics.score}/10
                  </span>
                </div>
                <p className="text-xs text-gray-500">Quality Score</p>
              </div>
              
              {/* Completion */}
              <div className="text-right">
                <div className="flex items-center">
                  <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                  <span className="text-sm font-medium">
                    {preview.metadata.qualityMetrics.completeness || 0}%
                  </span>
                </div>
                <p className="text-xs text-gray-500">Complete</p>
              </div>
            </div>
          )}
        </div>
        
        {/* Status Indicators */}
        <div className="flex items-center justify-between mt-2">
          <div className="flex items-center space-x-4">
            {preview.metadata?.qualityMetrics?.criticalIssues > 0 && (
              <div className="flex items-center text-red-600">
                <AlertCircle className="h-4 w-4 mr-1" />
                <span className="text-xs">
                  {preview.metadata.qualityMetrics.criticalIssues} Critical Issues
                </span>
              </div>
            )}
            
            {preview.metadata?.qualityMetrics?.warnings > 0 && (
              <div className="flex items-center text-yellow-600">
                <AlertCircle className="h-4 w-4 mr-1" />
                <span className="text-xs">
                  {preview.metadata.qualityMetrics.warnings} Warnings
                </span>
              </div>
            )}
            
            {error && (
              <div className="flex items-center text-orange-600">
                <AlertCircle className="h-4 w-4 mr-1" />
                <span className="text-xs">Using fallback preview</span>
              </div>
            )}
          </div>
          
          {lastUpdated && (
            <div className="flex items-center text-gray-500">
              <Clock className="h-3 w-3 mr-1" />
              <span className="text-xs">
                Updated {lastUpdated.toLocaleTimeString()}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ✅ Preview Content with Enhanced Rendering */}
      <div className="flex-1 overflow-y-auto">
        <div className="p-6">
          <div className="max-w-2xl mx-auto bg-white shadow-sm border rounded-lg p-8 min-h-[600px]">
            {/* Render sections dynamically */}
            {preview?.sections && (
              <>
                {typeof preview.sections === 'object' && !Array.isArray(preview.sections) ? (
                  // Handle sections as object (from StateTemplateManager)
                  Object.entries(preview.sections).map(([key, section]) => 
                    renderSection(section, key)
                  )
                ) : Array.isArray(preview.sections) ? (
                  // Handle sections as array
                  preview.sections.map((section, index) => renderSection(section, index))
                ) : (
                  <div className="text-center text-gray-500 py-12">
                    <p>Preview format not recognized</p>
                    <button 
                      onClick={updatePreview}
                      className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                    >
                      Regenerate Preview
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* ✅ Footer with Enhanced Metadata */}
        {preview?.metadata && (
          <div className="p-4 border-t bg-gray-50">
            <div className="max-w-2xl mx-auto">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <p className="font-medium text-gray-700">State</p>
                  <p className="text-gray-600">{preview.metadata.stateName || 'Not specified'}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-700">Est. Pages</p>
                  <p className="text-gray-600">{preview.metadata.estimatedPages || 1}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-700">Facts</p>
                  <p className="text-gray-600">{preview.metadata.factCount || 0}</p>
                </div>
                <div>
                  <p className="font-medium text-gray-700">Categories</p>
                  <p className="text-gray-600">
                    {preview.metadata.categories ? Object.keys(preview.metadata.categories).length : 0}
                  </p>
                </div>
              </div>
              
              {/* Category Breakdown */}
              {preview.metadata.categories && Object.keys(preview.metadata.categories).length > 0 && (
                <div className="mt-3 pt-3 border-t">
                  <p className="text-xs font-medium text-gray-700 mb-2">Fact Categories:</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(preview.metadata.categories).map(([category, info]) => (
                      <span 
                        key={category}
                        className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full flex items-center"
                      >
                        <span className="mr-1">{CATEGORY_ICONS[category] || '📄'}</span>
                        {category}: {info.count}
                        {info.issues > 0 && (
                          <AlertCircle className="h-3 w-3 ml-1 text-yellow-600" />
                        )}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ✅ Debug Info in Development */}
        {process.env.NODE_ENV === 'development' && (
          <div className="p-4 bg-yellow-50 border-t">
            <details className="text-xs">
              <summary className="cursor-pointer font-medium">Debug Info (Development)</summary>
              <div className="mt-2 space-y-2">
                <div>
                  <strong>Affidavit Data:</strong>
                  <pre className="mt-1 bg-white p-2 rounded text-xs overflow-auto max-h-32">
                    {JSON.stringify(affidavitData, null, 2)}
                  </pre>
                </div>
                <div>
                  <strong>Preview Data:</strong>
                  <pre className="mt-1 bg-white p-2 rounded text-xs overflow-auto max-h-32">
                    {JSON.stringify(preview, null, 2)}
                  </pre>
                </div>
                {error && (
                  <div>
                    <strong>Error:</strong>
                    <p className="text-red-600">{error}</p>
                  </div>
                )}
              </div>
            </details>
          </div>
        )}
      </div>
    </div>
  );
};

// ✅ Helper functions
function getStateName(stateCode) {
  const stateMap = {
    'TX': 'Texas',
    'UT': 'Utah',
    'AZ': 'Arizona'
  };
  return stateMap[stateCode] || stateCode || 'Unknown';
}

function estimateWordCount(facts) {
  if (!Array.isArray(facts)) return 0;
  return facts.reduce((count, fact) => {
    const content = fact.professionalRewrite || fact.content || '';
    return count + (content.split(/\s+/).length || 0);
  }, 0);
}

function getCategorySummary(facts) {
  if (!Array.isArray(facts)) return {};
  
  const summary = {};
  facts.forEach(fact => {
    const category = fact.category || 'general';
    if (!summary[category]) {
      summary[category] = { count: 0, issues: 0 };
    }
    summary[category].count++;
    if (fact.severity === 'critical' || fact.severity === 'warning') {
      summary[category].issues++;
    }
  });
  
  return summary;
}

function calculateQualityMetrics(facts) {
  if (!Array.isArray(facts) || facts.length === 0) {
    return { score: 0, issues: 0, completeness: 0 };
  }
  
  const totalFacts = facts.length;
  const criticalIssues = facts.filter(f => f.severity === 'critical').length;
  const warnings = facts.filter(f => f.severity === 'warning').length;
  const avgConfidence = facts.reduce((sum, f) => sum + (f.confidence || 0.8), 0) / totalFacts;
  
  const score = Math.max(0, Math.min(10, 
    (avgConfidence * 10) - (criticalIssues * 3) - (warnings * 1)
  ));
  
  return {
    score: Math.round(score * 10) / 10,
    avgConfidence: Math.round(avgConfidence * 100) / 100,
    criticalIssues,
    warnings,
    completeness: totalFacts >= 3 ? 100 : Math.round((totalFacts / 3) * 100)
  };
}

export default DocumentPreview;