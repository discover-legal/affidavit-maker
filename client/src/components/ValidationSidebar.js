// client/src/components/ValidationSidebar.js - COMPLETE FIXED VERSION
import React, { useState, useEffect, useCallback } from 'react';
import { 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  ChevronDown, 
  ChevronUp,
  Info,
  RefreshCw,
  Sparkles,
  FileText,
  Edit2,
  Trash2,
  Check as CheckIcon,
  X
} from 'lucide-react';
import { useDocumentState, useDocumentActions } from '../contexts/DocumentContext';

const ValidationSidebar = () => {
  const { 
    validation, 
    currentDocument, 
    isValidating 
  } = useDocumentState();
  
  const { validateDocument, updateDocumentData, saveDocument } = useDocumentActions();
  
  const [expandedSection, setExpandedSection] = useState('facts');
  const [editingFactIndex, setEditingFactIndex] = useState(null);
  const [editedFactContent, setEditedFactContent] = useState('');

  // Run validation with useCallback
  const runValidation = useCallback(async () => {
    await validateDocument();
  }, [validateDocument]);

  // Auto-validate when document changes
  useEffect(() => {
    if (currentDocument && currentDocument.facts && currentDocument.facts.length > 0) {
      if (currentDocument.affiantName && currentDocument.state) {
        const timer = setTimeout(() => {
          runValidation();
        }, 3000);
        
        return () => clearTimeout(timer);
      }
    }
  }, [currentDocument, runValidation]);

  // Toggle section expansion
  const toggleSection = (section) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  // ✅ FIXED: Extract fact content safely handling all formats
  const getFactContent = (fact) => {
    if (!fact) return '[Invalid fact]';
    if (typeof fact === 'string') return fact;
    if (typeof fact === 'object') {
      return fact.professionalRewrite || fact.content || fact.text || '[Invalid fact]';
    }
    return '[Invalid fact format]';
  };

  // ✅ FIXED: Get fact metadata safely
  const getFactMetadata = (fact) => {
    if (typeof fact === 'object' && fact !== null) {
      return {
        category: fact.category || null,
        confidence: fact.confidence || null,
        severity: fact.severity || null,
        issues: Array.isArray(fact.issues) ? fact.issues : 
                Array.isArray(fact.languageIssues) ? fact.languageIssues : [],
        suggestions: Array.isArray(fact.suggestions) ? fact.suggestions :
                     Array.isArray(fact.improvements) ? fact.improvements : [],
        hasRewrite: !!fact.professionalRewrite
      };
    }
    return {
      category: null,
      confidence: null,
      severity: null,
      issues: [],
      suggestions: [],
      hasRewrite: false
    };
  };

  // Start editing a fact
  const startEditingFact = (index) => {
    const factContent = getFactContent(currentDocument.facts[index]);
    setEditingFactIndex(index);
    setEditedFactContent(factContent);
  };

  // ✅ FIXED: Save edited fact with immediate database save
  const saveEditedFact = async () => {
    if (editingFactIndex === null) return;
    
    const updatedFacts = [...currentDocument.facts];
    const currentFact = updatedFacts[editingFactIndex];
    const originalContent = getFactContent(currentFact);
    
    // Preserve object structure if it exists
    if (typeof currentFact === 'object' && currentFact !== null) {
      updatedFacts[editingFactIndex] = {
        ...currentFact,
        content: editedFactContent,
        // Only clear professionalRewrite if content actually changed
        professionalRewrite: editedFactContent !== originalContent ? null : currentFact.professionalRewrite,
        needsReview: editedFactContent !== originalContent,
        lastEdited: new Date().toISOString(),
        metadata: {
          ...(currentFact.metadata || {}),
          edited: true
        }
      };
    } else {
      // Convert to object format
      updatedFacts[editingFactIndex] = {
        content: editedFactContent,
        professionalRewrite: null,
        category: 'general',
        subcategory: null,
        confidence: 0.5,
        severity: 'info',
        issues: [],
        suggestions: [],
        needsReview: true,
        lastEdited: new Date().toISOString(),
        metadata: { created: true }
      };
    }
    
    // Update document data
    updateDocumentData({ facts: updatedFacts });
    
    // Trigger immediate save
    try {
      await saveDocument();
    } catch (error) {
      console.error('Failed to save edited fact:', error);
    }
    
    setEditingFactIndex(null);
    setEditedFactContent('');
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingFactIndex(null);
    setEditedFactContent('');
  };

  // Delete a fact
  const deleteFact = async (index) => {
    if (window.confirm('Are you sure you want to delete this fact?')) {
      const updatedFacts = currentDocument.facts.filter((_, i) => i !== index);
      updateDocumentData({ facts: updatedFacts });
      
      // Trigger immediate save
      try {
        await saveDocument();
      } catch (error) {
        console.error('Failed to save after deleting fact:', error);
      }
    }
  };

  // Get validation status for a specific fact
  const getFactValidation = (index) => {
    if (!validation || !validation.factValidation) return null;
    return validation.factValidation.results?.[index] || null;
  };

  // Calculate summary
  const getValidationSummary = () => {
    if (!validation) {
      return { status: 'pending', errors: 0, warnings: 0 };
    }
    
    const errors = validation.errors?.length || 0;
    const warnings = validation.warnings?.length || 0;
    
    let status = 'valid';
    if (errors > 0) status = 'error';
    else if (warnings > 0) status = 'warning';
    
    return { status, errors, warnings };
  };

  const summary = getValidationSummary();

  // Empty state
  if (!currentDocument || (!currentDocument.affiantName && !currentDocument.state && (!currentDocument.facts || currentDocument.facts.length === 0))) {
    return (
      <div className="h-full flex flex-col">
        <div className="p-4 border-b bg-white">
          <h2 className="text-lg font-semibold text-gray-800">Document Validation</h2>
        </div>
        <div className="flex-1 p-6 flex flex-col items-center justify-center text-gray-500">
          <FileText className="h-12 w-12 mb-4 text-gray-300" />
          <p className="text-center">Start adding information to validate</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {/* Header */}
      <div className="p-4 bg-white border-b">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-gray-800">Validation & Facts</h2>
          <button
            onClick={runValidation}
            disabled={isValidating}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
            title="Run validation"
          >
            <RefreshCw className={`h-4 w-4 ${isValidating ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Status Summary */}
        {validation && (
          <div className={`p-2 rounded-lg flex items-center text-sm ${
            summary.status === 'valid' ? 'bg-green-50' : 
            summary.status === 'error' ? 'bg-red-50' : 
            'bg-yellow-50'
          }`}>
            <div className="mr-2">
              {summary.status === 'valid' ? (
                <CheckCircle className="h-4 w-4 text-green-600" />
              ) : summary.status === 'error' ? (
                <XCircle className="h-4 w-4 text-red-600" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
              )}
            </div>
            <div className="flex-1">
              <span className={`font-medium ${
                summary.status === 'valid' ? 'text-green-700' : 
                summary.status === 'error' ? 'text-red-700' : 'text-yellow-700'
              }`}>
                {summary.status === 'valid' ? 'All Valid' : 
                 summary.status === 'error' ? `${summary.errors} Error${summary.errors !== 1 ? 's' : ''}` :
                 `${summary.warnings} Warning${summary.warnings !== 1 ? 's' : ''}`}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        
        {/* Facts Section */}
        <div className="bg-white rounded-lg overflow-hidden">
          <button
            onClick={() => toggleSection('facts')}
            className="w-full p-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
          >
            <div className="flex items-center">
              <Sparkles className="h-4 w-4 text-blue-600 mr-2" />
              <span className="font-medium text-gray-700">
                Facts ({currentDocument.facts?.length || 0})
              </span>
            </div>
            {expandedSection === 'facts' ? (
              <ChevronUp className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            )}
          </button>
          
          {expandedSection === 'facts' && (
            <div className="p-3 pt-0">
              {currentDocument.facts && currentDocument.facts.length > 0 ? (
                <div className="space-y-2">
                  {currentDocument.facts.map((fact, index) => {
                    const content = getFactContent(fact);
                    const metadata = getFactMetadata(fact);
                    const factValidation = getFactValidation(index);
                    
                    return (
                      <div
                        key={index}
                        className={`p-3 rounded-lg border ${
                          metadata.severity === 'critical' || metadata.severity === 'error' ? 'border-red-200 bg-red-50' :
                          metadata.severity === 'warning' ? 'border-yellow-200 bg-yellow-50' :
                          'border-gray-200 bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <span className="text-xs font-medium text-gray-500">
                            Fact #{index + 1}
                            {metadata.category && ` · ${metadata.category}`}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => startEditingFact(index)}
                              className="p-1 text-blue-600 hover:bg-blue-100 rounded transition"
                              title="Edit fact"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>
                            <button
                              onClick={() => deleteFact(index)}
                              className="p-1 text-red-600 hover:bg-red-100 rounded transition"
                              title="Delete fact"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                        
                        {editingFactIndex === index ? (
                          <div>
                            <textarea
                              value={editedFactContent}
                              onChange={(e) => setEditedFactContent(e.target.value)}
                              className="w-full p-2 border rounded text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                              rows={3}
                              autoFocus
                            />
                            <div className="flex justify-end gap-2 mt-2">
                              <button
                                onClick={cancelEdit}
                                className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded transition"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={saveEditedFact}
                                className="px-3 py-1 text-sm bg-blue-600 text-white hover:bg-blue-700 rounded transition"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="text-sm text-gray-700 leading-relaxed">
                              {content}
                            </p>
                            
                            {/* ✅ FIXED: Validation Issues - check if arrays exist */}
                            {(metadata.issues.length > 0 || metadata.suggestions.length > 0) && (
                              <div className="mt-2 pt-2 border-t border-gray-100">
                                {metadata.issues.length > 0 && (
                                  <div className="mb-1">
                                    <span className="text-xs font-medium text-red-600">Issues:</span>
                                    <ul className="text-xs text-red-600 mt-1">
                                      {metadata.issues.map((issue, i) => (
                                        <li key={i}>• {issue}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                                {metadata.suggestions.length > 0 && (
                                  <div>
                                    <span className="text-xs font-medium text-blue-600">Suggestions:</span>
                                    <ul className="text-xs text-blue-600 mt-1">
                                      {metadata.suggestions.map((suggestion, i) => (
                                        <li key={i}>• {suggestion}</li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-sm text-gray-500 italic">No facts added yet</p>
              )}
            </div>
          )}
        </div>

        {/* Validation Errors */}
        {validation?.errors?.length > 0 && (
          <div className="bg-white rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection('errors')}
              className="w-full p-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center">
                <XCircle className="h-4 w-4 text-red-600 mr-2" />
                <span className="font-medium text-red-700">
                  Errors ({validation.errors.length})
                </span>
              </div>
              {expandedSection === 'errors' ? (
                <ChevronUp className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronDown className="h-4 w-4 text-gray-500" />
              )}
            </button>
            
            {expandedSection === 'errors' && (
              <div className="p-3 pt-0">
                <ul className="space-y-1">
                  {validation.errors.map((error, index) => (
                    <li key={index} className="text-sm text-red-600">
                      • {error}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Requirements Checklist */}
        <div className="bg-white rounded-lg p-3">
          <h3 className="font-medium text-gray-700 mb-2 text-sm">Requirements</h3>
          <ul className="space-y-1">
            <li className="flex items-center text-sm">
              {currentDocument.affiantName ? (
                <CheckCircle className="h-3 w-3 text-green-500 mr-2" />
              ) : (
                <XCircle className="h-3 w-3 text-gray-300 mr-2" />
              )}
              <span className={currentDocument.affiantName ? 'text-gray-700' : 'text-gray-400'}>
                Name provided
              </span>
            </li>
            <li className="flex items-center text-sm">
              {currentDocument.state ? (
                <CheckCircle className="h-3 w-3 text-green-500 mr-2" />
              ) : (
                <XCircle className="h-3 w-3 text-gray-300 mr-2" />
              )}
              <span className={currentDocument.state ? 'text-gray-700' : 'text-gray-400'}>
                State selected
              </span>
            </li>
            <li className="flex items-center text-sm">
              {currentDocument.facts?.length >= 3 ? (
                <CheckCircle className="h-3 w-3 text-green-500 mr-2" />
              ) : (
                <XCircle className="h-3 w-3 text-gray-300 mr-2" />
              )}
              <span className={currentDocument.facts?.length >= 3 ? 'text-gray-700' : 'text-gray-400'}>
                At least 3 facts ({currentDocument.facts?.length || 0}/3)
              </span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
};

export default ValidationSidebar;
