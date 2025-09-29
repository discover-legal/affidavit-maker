// components/FactValidationPanel.js
import React, { useState, useCallback, useMemo } from 'react';
import { useDocument } from '../contexts/DocumentContext';
import { 
  CheckCircle2, 
  AlertTriangle, 
  AlertCircle, 
  Award, 
  Eye, 
  EyeOff, 
  RefreshCw,
  TrendingUp,
  Scale,
  FileCheck
} from 'lucide-react';

/**
 * Professional Fact Validation Panel
 * 
 * Provides comprehensive fact validation with:
 * - Real-time professional standards checking
 * - Inappropriate content detection
 * - Legal admissibility assessment
 * - Court-readiness scoring
 * - Professional fact rewriting suggestions
 * 
 * @param {Object} props - Component props
 * @param {Object} props.affidavitData - Current document data
 * @param {Function} props.onDataUpdate - Data update handler
 * @param {boolean} props.hasValidationService - Whether validation service is available
 * @returns {JSX.Element} Fact validation panel
 */
const FactValidationPanel = ({ 
  affidavitData, 
  onDataUpdate, 
  hasValidationService 
}) => {
  const { validateAllFacts, addFactWithValidation, updateFactWithValidation } = useDocument();

  // Local state for validation results and UI
  const [validationResults, setValidationResults] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [expandedFacts, setExpandedFacts] = useState(new Set());
  const [showOnlyIssues, setShowOnlyIssues] = useState(false);

  /**
   * Perform comprehensive fact validation
   */
  const handleValidateAllFacts = useCallback(async () => {
    if (!hasValidationService || !affidavitData.facts?.length) {
      return;
    }

    setIsValidating(true);
    try {
      const results = await validateAllFacts();
      setValidationResults(results);
    } catch (error) {
      console.error('Validation failed:', error);
    } finally {
      setIsValidating(false);
    }
  }, [hasValidationService, affidavitData.facts, validateAllFacts]);

  /**
   * Toggle expanded view for a specific fact
   * 
   * @param {number} index - Fact index
   */
  const toggleFactExpanded = useCallback((index) => {
    setExpandedFacts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  }, []);

  /**
   * Apply professional rewrite to a fact
   * 
   * @param {number} index - Fact index
   * @param {string} professionalVersion - Professional version of the fact
   */
  const applyProfessionalRewrite = useCallback(async (index, professionalVersion) => {
    try {
      await updateFactWithValidation(index, { content: professionalVersion });
      
      // Re-run validation to update results
      setTimeout(() => {
        handleValidateAllFacts();
      }, 500);
    } catch (error) {
      console.error('Failed to apply rewrite:', error);
    }
  }, [updateFactWithValidation, handleValidateAllFacts]);

  /**
   * Get validation summary statistics
   */
  const validationSummary = useMemo(() => {
    if (!validationResults?.validation?.results) {
      return null;
    }

    const results = validationResults.validation.results;
    const criticalIssues = results.filter(r => r.severity === 'critical').length;
    const warningIssues = results.filter(r => r.languageIssues?.length > 0 && r.severity !== 'critical').length;
    const validFacts = results.filter(r => r.isValid && r.legalStandardScore >= 70).length;
    const avgScore = results.reduce((sum, r) => sum + (r.legalStandardScore || 0), 0) / results.length;

    return {
      totalFacts: results.length,
      criticalIssues,
      warningIssues,
      validFacts,
      averageScore: Math.round(avgScore),
      readyForCourt: criticalIssues === 0 && avgScore >= 75
    };
  }, [validationResults]);

  /**
   * Filter facts based on current display options
   */
  const filteredFacts = useMemo(() => {
    if (!affidavitData.facts?.length) {
      return [];
    }

    const facts = affidavitData.facts.map((fact, index) => ({
      ...fact,
      index,
      validation: validationResults?.validation?.results?.[index]
    }));

    if (showOnlyIssues) {
      return facts.filter(fact => 
        fact.validation?.severity === 'critical' || 
        fact.validation?.languageIssues?.length > 0 ||
        (fact.validation?.legalStandardScore || 100) < 70
      );
    }

    return facts;
  }, [affidavitData.facts, validationResults, showOnlyIssues]);

  /**
   * Get severity styling for a fact
   * 
   * @param {Object} validation - Validation result
   * @returns {Object} Styling classes
   */
  const getSeverityStyles = useCallback((validation) => {
    if (!validation) {
      return {
        border: 'border-gray-200',
        background: 'bg-white',
        icon: CheckCircle2,
        iconColor: 'text-gray-400'
      };
    }

    if (validation.severity === 'critical') {
      return {
        border: 'border-red-500',
        background: 'bg-red-50',
        icon: AlertCircle,
        iconColor: 'text-red-600'
      };
    }

    if (validation.languageIssues?.length > 0 || (validation.legalStandardScore || 100) < 70) {
      return {
        border: 'border-yellow-300',
        background: 'bg-yellow-50',
        icon: AlertTriangle,
        iconColor: 'text-yellow-600'
      };
    }

    return {
      border: 'border-green-300',
      background: 'bg-green-50',
      icon: CheckCircle2,
      iconColor: 'text-green-600'
    };
  }, []);

  /**
   * Render validation summary card
   */
  const renderValidationSummary = () => {
    if (!validationSummary) {
      return null;
    }

    return (
      <div className="bg-white rounded-lg border p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold flex items-center">
            <Scale className="w-5 h-5 mr-2 text-purple-600" />
            Professional Standards Assessment
          </h3>
          <div className="flex items-center space-x-2">
            <span className={`text-2xl font-bold ${validationSummary.readyForCourt ? 'text-green-600' : 'text-yellow-600'}`}>
              {validationSummary.averageScore}/100
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{validationSummary.totalFacts}</div>
            <div className="text-sm text-gray-600">Total Facts</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{validationSummary.validFacts}</div>
            <div className="text-sm text-gray-600">Court Ready</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-yellow-600">{validationSummary.warningIssues}</div>
            <div className="text-sm text-gray-600">Need Review</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{validationSummary.criticalIssues}</div>
            <div className="text-sm text-gray-600">Critical Issues</div>
          </div>
        </div>

        <div className={`p-3 rounded-lg ${validationSummary.readyForCourt ? 'bg-green-100' : 'bg-yellow-100'}`}>
          <div className="flex items-center">
            {validationSummary.readyForCourt ? (
              <>
                <FileCheck className="w-5 h-5 text-green-600 mr-2" />
                <span className="text-green-800 font-medium">Document meets professional legal standards</span>
              </>
            ) : (
              <>
                <TrendingUp className="w-5 h-5 text-yellow-600 mr-2" />
                <span className="text-yellow-800 font-medium">
                  {validationSummary.criticalIssues > 0 
                    ? 'Critical issues must be resolved before legal use'
                    : 'Some improvements recommended for professional standards'
                  }
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  /**
   * Render individual fact validation
   */
  const renderFactValidation = (fact) => {
    const { validation, index } = fact;
    const styles = getSeverityStyles(validation);
    const isExpanded = expandedFacts.has(index);
    const IconComponent = styles.icon;

    return (
      <div
        key={index}
        className={`border rounded-lg p-4 ${styles.border} ${styles.background} transition-all duration-200`}
      >
        {/* Fact Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-start space-x-3 flex-1">
            <IconComponent className={`w-5 h-5 mt-0.5 ${styles.iconColor}`} />
            <div className="flex-1">
              <div className="flex items-center space-x-2 mb-1">
                <span className="text-sm font-medium text-gray-700">
                  Fact {index + 1}
                </span>
                {validation?.enhancedCategory && (
                  <span className="text-xs px-2 py-1 bg-gray-100 rounded">
                    {validation.enhancedCategory.name}
                  </span>
                )}
                {validation?.legalStandardScore && (
                  <span className={`text-xs font-bold ${
                    validation.legalStandardScore >= 80 ? 'text-green-600' : 
                    validation.legalStandardScore >= 60 ? 'text-yellow-600' : 'text-red-600'
                  }`}>
                    {validation.legalStandardScore}/100
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-800">"{fact.content}"</p>
            </div>
          </div>
          
          <button
            onClick={() => toggleFactExpanded(index)}
            className="ml-2 p-1 text-gray-400 hover:text-gray-600"
          >
            {isExpanded ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        {/* Expanded Validation Details */}
        {isExpanded && validation && (
          <div className="space-y-4 border-t pt-4">
            
            {/* Professional Rewrite */}
            {validation.professionalRewrite && validation.professionalRewrite !== fact.content && (
              <div className="bg-green-50 border border-green-200 rounded p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-green-800">
                    Professional Version:
                  </span>
                  <button
                    onClick={() => applyProfessionalRewrite(index, validation.professionalRewrite)}
                    className="text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                  >
                    Apply
                  </button>
                </div>
                <p className="text-sm text-green-700">"{validation.professionalRewrite}"</p>
              </div>
            )}

            {/* Language Issues */}
            {validation.languageIssues?.length > 0 && (
              <div className="space-y-1">
                <span className="text-sm font-medium text-red-600">Language Issues:</span>
                {validation.languageIssues.map((issue, i) => (
                  <div key={i} className="text-sm text-red-600 flex items-start">
                    <span className="mr-2">
                      {issue.includes('CRITICAL') ? '🚨' : '❌'}
                    </span>
                    <span className={issue.includes('CRITICAL') ? 'font-bold' : ''}>
                      {issue}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Legal Issues */}
            {validation.legalIssues?.length > 0 && (
              <div className="space-y-1">
                <span className="text-sm font-medium text-orange-600">Legal Concerns:</span>
                {validation.legalIssues.map((issue, i) => (
                  <div key={i} className="text-sm text-orange-600">
                    ⚖️ {issue}
                  </div>
                ))}
              </div>
            )}

            {/* Improvements */}

            {/* Improvements - FIXED */}
            {validation.improvements && (
              <div className="space-y-1">
                <span className="text-sm font-medium text-blue-600">Suggestions:</span>
                {(() => {
                  // Check if improvements is a string or array
                  if (typeof validation.improvements === 'string') {
                    // Clean up if it has bullet points between characters
                    let cleanText = validation.improvements;
                    const bulletCount = (cleanText.match(/•/g) || []).length;
                    if (bulletCount > cleanText.length * 0.3) {
                      cleanText = cleanText.replace(/•\s*/g, '');
                    }
                    return (
                      <div className="text-sm text-blue-600">
                        💡 {cleanText}
                      </div>
                    );
                  } else if (Array.isArray(validation.improvements)) {
                    // If it's an array, map normally
                    return validation.improvements.map((improvement, i) => {
                      // Clean each item if needed
                      let cleanImprovement = improvement;
                      if (typeof improvement === 'string' && improvement.includes('•')) {
                        const bullets = (improvement.match(/•/g) || []).length;
                        if (bullets > improvement.length * 0.3) {
                          cleanImprovement = improvement.replace(/•\s*/g, '');
                        }
                      }
                      return (
                        <div key={i} className="text-sm text-blue-600">
                          💡 {cleanImprovement}
                        </div>
                      );
                    });
                  }
                  return null;
                })()}
              </div>
            )}
          </div>
        )}
    );
  };

  // Main render
  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 overflow-y-auto p-6">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-2">
            <Award className="w-6 h-6 text-purple-600" />
            <h2 className="text-xl font-semibold text-gray-900">
              Professional Validation
            </h2>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowOnlyIssues(!showOnlyIssues)}
              className={`text-xs px-3 py-1 rounded ${
                showOnlyIssues 
                  ? 'bg-yellow-100 text-yellow-800' 
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {showOnlyIssues ? 'Show All' : 'Issues Only'}
            </button>
            
            <button
              onClick={handleValidateAllFacts}
              disabled={isValidating || !hasValidationService || !affidavitData.facts?.length}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
            >
              <RefreshCw className={`w-4 h-4 mr-2 ${isValidating ? 'animate-spin' : ''}`} />
              {isValidating ? 'Analyzing...' : 'Validate Facts'}
            </button>
          </div>
        </div>

        {/* Validation Service Status */}
        {!hasValidationService && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2" />
              <span className="text-yellow-800">
                Professional validation service is not available. Basic validation is being used.
              </span>
            </div>
          </div>
        )}

        {/* No Facts Message */}
        {!affidavitData.facts?.length && (
          <div className="text-center py-12">
            <FileCheck className="w-12 h-12 text-gray-300 mx-auto mb-4" />
            <h3 className="text-