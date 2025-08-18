// client/src/components/ValidationSidebar.js - Complete drop-in with LLM integration
import React, { useState } from 'react';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  ChevronDown, 
  ChevronUp,
  Info
} from 'lucide-react';
import { useDocumentState, useDocumentActions } from '../contexts/DocumentContext';

const ValidationSidebar = () => {
  const { validation, currentDocument, isLoading } = useDocumentState();
  const { validateDocument } = useDocumentActions();
  const [expandedSection, setExpandedSection] = useState(null);

  // Toggle section expansion
  const toggleSection = (section) => {
    if (expandedSection === section) {
      setExpandedSection(null);
    } else {
      setExpandedSection(section);
    }
  };

  // Trigger enhanced validation
  const runEnhancedValidation = async () => {
    await validateDocument(currentDocument);
  };

  // If no validation data available yet
  if (!validation) {
    return (
      <div className="p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-800">Document Validation</h3>
          <button
            onClick={runEnhancedValidation}
            className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
            disabled={isLoading}
          >
            {isLoading ? 'Running...' : 'Run Validation'}
          </button>
        </div>
        <p className="text-gray-600 text-sm mb-4">
          Validate your document to ensure it meets legal requirements.
        </p>
        <div className="flex justify-center py-8">
          <Info className="text-gray-400 h-12 w-12" />
        </div>
        <p className="text-center text-gray-500 text-sm">
          Click "Run Validation" to check your document.
        </p>
      </div>
    );
  }

  // Determine validation status
  const isValid = validation.isValid;
  const hasWarnings = validation.warnings && validation.warnings.length > 0;
  const hasErrors = validation.errors && validation.errors.length > 0;
  const hasLLMAnalysis = validation.llmAnalysis && validation.llmAnalysis.factAnalysis;

  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-gray-800">Document Validation</h3>
        <button
          onClick={runEnhancedValidation}
          className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200 transition-colors"
          disabled={isLoading}
        >
          {isLoading ? 'Running...' : 'Run Enhanced Check'}
        </button>
      </div>

      {/* Status summary */}
      <div className={`p-3 rounded-lg mb-4 flex items-start ${
        isValid ? 'bg-green-50' : (hasErrors ? 'bg-red-50' : 'bg-yellow-50')
      }`}>
        <div className="mr-2 mt-0.5">
          {isValid ? (
            <CheckCircle className="h-5 w-5 text-green-500" />
          ) : hasErrors ? (
            <XCircle className="h-5 w-5 text-red-500" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-yellow-500" />
          )}
        </div>
        <div>
          <p className={`font-medium ${
            isValid ? 'text-green-700' : (hasErrors ? 'text-red-700' : 'text-yellow-700')
          }`}>
            {isValid ? 'Document Valid' : (hasErrors ? 'Document Needs Corrections' : 'Document Has Warnings')}
          </p>
          <p className="text-sm text-gray-600 mt-1">
            {isValid 
              ? 'Your document meets all requirements.'
              : (hasErrors 
                ? 'Please fix the errors below before proceeding.' 
                : 'Please review the warnings below.')
            }
          </p>
        </div>
      </div>

      {/* Errors section */}
      {hasErrors && (
        <div className="mb-4">
          <div 
            className="flex items-center justify-between cursor-pointer py-2"
            onClick={() => toggleSection('errors')}
          >
            <h4 className="font-medium text-red-700 flex items-center">
              <XCircle className="h-4 w-4 mr-2" />
              Errors ({validation.errors.length})
            </h4>
            {expandedSection === 'errors' ? (
              <ChevronUp className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            )}
          </div>
          
          {expandedSection === 'errors' && (
            <ul className="pl-6 pr-2 py-2 text-sm text-red-700 border-l-2 border-red-200 ml-2">
              {validation.errors.map((error, index) => (
                <li key={`error-${index}`} className="mb-2 last:mb-0">
                  • {error}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Warnings section */}
      {hasWarnings && (
        <div className="mb-4">
          <div 
            className="flex items-center justify-between cursor-pointer py-2"
            onClick={() => toggleSection('warnings')}
          >
            <h4 className="font-medium text-yellow-700 flex items-center">
              <AlertTriangle className="h-4 w-4 mr-2" />
              Warnings ({validation.warnings.length})
            </h4>
            {expandedSection === 'warnings' ? (
              <ChevronUp className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            )}
          </div>
          
          {expandedSection === 'warnings' && (
            <ul className="pl-6 pr-2 py-2 text-sm text-yellow-700 border-l-2 border-yellow-200 ml-2">
              {validation.warnings.map((warning, index) => (
                <li key={`warning-${index}`} className="mb-2 last:mb-0">
                  • {warning}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* LLM Analysis section */}
      {hasLLMAnalysis && (
        <div className="mb-4">
          <div 
            className="flex items-center justify-between cursor-pointer py-2"
            onClick={() => toggleSection('llm')}
          >
            <h4 className="font-medium text-blue-700 flex items-center">
              <Info className="h-4 w-4 mr-2" />
              Enhanced Analysis
            </h4>
            {expandedSection === 'llm' ? (
              <ChevronUp className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            )}
          </div>
          
          {expandedSection === 'llm' && (
            <div className="pl-6 pr-2 py-2 text-sm border-l-2 border-blue-200 ml-2">
              {validation.llmAnalysis.overallAssessment && (
                <div className="mb-3">
                  <p className="font-medium text-gray-700">Overall Assessment:</p>
                  <p className="text-gray-600 mt-1">{validation.llmAnalysis.overallAssessment}</p>
                </div>
              )}
              
              <p className="font-medium text-gray-700 mb-2">Fact Analysis:</p>
              {validation.llmAnalysis.factAnalysis.map((fact, index) => (
                <div key={`fact-${index}`} className="mb-4 pb-3 last:mb-0 last:pb-0 border-b border-gray-100 last:border-b-0">
                  <div className="flex justify-between mb-1">
                    <p className="font-medium text-gray-700">Fact #{fact.factIndex + 1}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      fact.category === 'Factual' ? 'bg-green-100 text-green-700' :
                      fact.category === 'Opinion' ? 'bg-yellow-100 text-yellow-700' :
                      fact.category === 'Hearsay' ? 'bg-red-100 text-red-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {fact.category}
                    </span>
                  </div>
                  
                  {fact.issues && fact.issues.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-red-600 font-medium">Issues:</p>
                      <ul className="pl-3 mt-1 text-xs text-red-700">
                        {fact.issues.map((issue, i) => (
                          <li key={`issue-${index}-${i}`} className="mb-1 last:mb-0">
                            • {issue}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {fact.suggestions && fact.suggestions.length > 0 && (
                    <div className="mt-2">
                      <p className="text-xs text-blue-600 font-medium">Suggestions:</p>
                      <ul className="pl-3 mt-1 text-xs text-blue-700">
                        {fact.suggestions.map((suggestion, i) => (
                          <li key={`suggestion-${index}-${i}`} className="mb-1 last:mb-0">
                            • {suggestion}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Requirements section */}
      <div className="mb-4">
        <div 
          className="flex items-center justify-between cursor-pointer py-2"
          onClick={() => toggleSection('requirements')}
        >
          <h4 className="font-medium text-gray-700 flex items-center">
            <Info className="h-4 w-4 mr-2" />
            Requirements
          </h4>
          {expandedSection === 'requirements' ? (
            <ChevronUp className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          )}
        </div>
        
        {expandedSection === 'requirements' && (
          <div className="pl-6 pr-2 py-2 text-sm border-l-2 border-gray-200 ml-2">
            <ul className="text-gray-600">
              <li className="mb-2 flex items-start">
                <span className="mr-2">•</span>
                <span>
                  <strong>Affiant name</strong>: Full legal name of the person making the statement
                </span>
              </li>
              <li className="mb-2 flex items-start">
                <span className="mr-2">•</span>
                <span>
                  <strong>Facts</strong>: At least one clear, factual statement
                </span>
              </li>
              {currentDocument.state === 'TX' && (
                <li className="mb-2 flex items-start">
                  <span className="mr-2">•</span>
                  <span>
                    <strong>County</strong>: Required for Texas affidavits
                  </span>
                </li>
              )}
              <li className="mb-2 flex items-start">
                <span className="mr-2">•</span>
                <span>
                  <strong>Facts should be</strong>: Clear, specific, based on personal knowledge, and not contain opinions or hearsay
                </span>
              </li>
            </ul>
          </div>
        )}
      </div>

      {/* Tips section */}
      <div>
        <div 
          className="flex items-center justify-between cursor-pointer py-2"
          onClick={() => toggleSection('tips')}
        >
          <h4 className="font-medium text-gray-700 flex items-center">
            <Info className="h-4 w-4 mr-2" />
            Tips for Good Affidavits
          </h4>
          {expandedSection === 'tips' ? (
            <ChevronUp className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          )}
        </div>
        
        {expandedSection === 'tips' && (
          <div className="pl-6 pr-2 py-2 text-sm border-l-2 border-gray-200 ml-2">
            <ul className="text-gray-600">
              <li className="mb-2 flex items-start">
                <span className="mr-2">•</span>
                <span>Be specific and factual rather than vague or emotional</span>
              </li>
              <li className="mb-2 flex items-start">
                <span className="mr-2">•</span>
                <span>Include dates, times, and locations when relevant</span>
              </li>
              <li className="mb-2 flex items-start">
                <span className="mr-2">•</span>
                <span>State only what you personally know or witnessed</span>
              </li>
              <li className="mb-2 flex items-start">
                <span className="mr-2">•</span>
                <span>Organize facts in chronological or logical order</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>Use simple, clear language without legal jargon</span>
              </li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};

export default ValidationSidebar;