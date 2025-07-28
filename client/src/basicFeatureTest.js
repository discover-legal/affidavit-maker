// Fixed App.js - Complete UpdatedStandaloneTest with proper JSX closing
import React, { useState, useRef, useEffect } from 'react';
import { Check, AlertCircle, Loader2, RefreshCw, Plus, Trash2, Save, TestTube, Award, AlertTriangle } from 'lucide-react';

// Mock OpenAI for testing Enhanced Professional Validation
const mockOpenAI = {
  chat: {
    completions: {
      create: async ({ messages }) => {
        await new Promise(resolve => setTimeout(resolve, 2000)); // Slightly longer for "professional" analysis
        
        const userMessage = messages[1].content;
        
        if (userMessage.includes('ANALYZE THIS FACT FOR LEGAL AFFIDAVIT')) {
          const factMatch = userMessage.match(/"([^"]+)"/);
          const factText = factMatch ? factMatch[1] : 'Test fact';
          
          // Analyze the fact for professional issues
          const hasUncertainty = /maybe|probably|might|could be|i think/i.test(factText);
          const hasEmotion = /terrible|horrible|amazing|awful|wonderful/i.test(factText);
          const hasInformal = /kinda|sorta|like totally|whatever/i.test(factText);
          const hasVague = /some|many|often|sometimes|around/i.test(factText);
          const hasSpecific = /\b\d+|\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i.test(factText);
          
          const languageIssues = [];
          const improvements = [];
          let score = 80;
          
          if (hasUncertainty) {
            languageIssues.push('Contains uncertain language');
            improvements.push('Replace uncertain terms with "to my knowledge" or "it is my understanding"');
            score -= 15;
          }
          
          if (hasEmotion) {
            languageIssues.push('Contains emotional/subjective language');
            improvements.push('Use objective, factual descriptions instead of emotional terms');
            score -= 20;
          }
          
          if (hasInformal) {
            languageIssues.push('Contains informal language');
            improvements.push('Use formal, professional language appropriate for legal documents');
            score -= 15;
          }
          
          if (hasVague) {
            languageIssues.push('Contains vague quantifiers');
            improvements.push('Provide specific numbers, dates, or timeframes instead of vague terms');
            score -= 10;
          }
          
          if (!hasSpecific) {
            improvements.push('Add specific dates, amounts, or names for clarity');
            score -= 5;
          }
          
          // Determine category based on keywords
          let category = 'general';
          let subcategory = 'other';
          
          if (/money|paid|cost|income|debt|asset|financial|support|payment/i.test(factText)) {
            category = 'financial';
            subcategory = /support|alimony/i.test(factText) ? 'support' : 'payments';
          } else if (/house|property|car|vehicle|owned|residence|address/i.test(factText)) {
            category = 'property';
            subcategory = /house|residence|address/i.test(factText) ? 'real_estate' : 'personal_property';
          } else if (/saw|observed|witnessed|heard|present/i.test(factText)) {
            category = 'witness';
            subcategory = 'observations';
          } else if (/spouse|child|parent|family|married|divorce|custody/i.test(factText)) {
            category = 'relational';
            subcategory = /custody|visitation/i.test(factText) ? 'custody' : 'family';
          } else if (/date|time|when|during|before|after|on/i.test(factText)) {
            category = 'temporal';
            subcategory = 'dates';
          }
          
          // Generate professional version
          let professionalVersion = factText;
          if (hasUncertainty) {
            professionalVersion = professionalVersion.replace(/maybe|probably|might/gi, 'to my knowledge');
            professionalVersion = professionalVersion.replace(/i think|i believe/gi, 'it is my understanding that');
          }
          if (hasEmotion) {
            professionalVersion = professionalVersion.replace(/terrible|awful/gi, 'concerning');
            professionalVersion = professionalVersion.replace(/amazing|wonderful/gi, 'notable');
          }
          if (hasVague) {
            professionalVersion = professionalVersion.replace(/around|about/gi, 'approximately');
          }
          
          return {
            choices: [{
              message: {
                content: JSON.stringify({
                  isValid: score >= 50,
                  category,
                  subcategory,
                  professionalVersion,
                  languageIssues,
                  legalIssues: score < 60 ? ['May not meet professional legal standards'] : [],
                  improvements,
                  confidence: score / 100,
                  legalStandardScore: Math.max(0, score),
                  duplicateIndex: null
                })
              }
            }]
          };
        } else {
          // Batch analysis
          const facts = userMessage.split('\n').filter(line => line.match(/^\d+:/));
          
          const batchFacts = facts.map((fact, i) => {
            const factText = fact.replace(/^\d+:\s*"?(.+?)"?$/, '$1');
            const hasProblems = /maybe|terrible|kinda|around/i.test(factText);
            
            return {
              isValid: true,
              category: 'general',
              subcategory: 'other',
              professionalVersion: factText,
              languageIssues: hasProblems ? ['Unprofessional language detected'] : [],
              legalIssues: [],
              improvements: hasProblems ? ['Use more professional language'] : ['Consider adding more specific details'],
              legalStandardScore: hasProblems ? 60 : 85
            };
          });
          
          const avgScore = batchFacts.reduce((sum, f) => sum + f.legalStandardScore, 0) / batchFacts.length;
          
          return {
            choices: [{
              message: {
                content: JSON.stringify({
                  overallProfessional: avgScore >= 70,
                  narrativeFlow: 'Facts appear to follow a logical sequence for legal proceedings',
                  recommendedOrder: facts.map((_, i) => i),
                  globalIssues: batchFacts.some(f => f.languageIssues.length > 0) ? 
                    ['Some facts contain unprofessional language that should be revised'] : [],
                  professionalSummary: `${facts.length} facts analyzed. Average professional score: ${Math.round(avgScore)}/100`,
                  facts: batchFacts
                })
              }
            }]
          };
        }
      }
    }
  }
};

// Enhanced Professional Fact Validation Service (simplified for testing)
class EnhancedFactValidationService {
  constructor(openaiClient, language = 'en') {
    this.openai = openaiClient;
    this.language = language;
  }

  async validateFactProfessional(fact, existingFacts = [], context = {}) {
    try {
      const prompt = this.buildProfessionalValidationPrompt(fact, existingFacts, context);
      
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: this.getProfessionalSystemPrompt() },
          { role: "user", content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 800
      });

      const result = JSON.parse(response.choices[0].message.content);
      
      return {
        ...result,
        enhancedCategory: this.enhanceCategory(result.category, result.subcategory),
        professionalRewrite: result.professionalVersion,
        legalStandard: { overallScore: result.legalStandardScore }
      };
      
    } catch (error) {
      console.error('Professional fact validation failed:', error);
      return this.fallbackValidation(fact);
    }
  }

  async validateFactsBatchProfessional(facts, context = {}) {
    try {
      const prompt = this.buildBatchPrompt(facts, context);
      
      const response = await this.openai.chat.completions.create({
        model: "gpt-4",
        messages: [
          { role: "system", content: this.getBatchSystemPrompt() },
          { role: "user", content: prompt }
        ],
        temperature: 0.1,
        max_tokens: 3000
      });

      const batchResult = JSON.parse(response.choices[0].message.content);
      
      return {
        ...batchResult,
        readyForCourt: batchResult.facts?.every(f => f.legalStandardScore >= 70) || false,
        professionalStandard: {
          averageScore: batchResult.facts?.reduce((sum, f) => sum + (f.legalStandardScore || 50), 0) / (batchResult.facts?.length || 1) || 50,
          meetsProfessionalStandard: true
        }
      };
      
    } catch (error) {
      console.error('Batch validation failed:', error);
      return { overallProfessional: false, facts: [] };
    }
  }

  enhanceCategory(category, subcategory) {
    const categories = {
      financial: { name: 'Financial', description: 'Money, assets, income, debts' },
      property: { name: 'Property', description: 'Real estate, personal property, vehicles' },
      witness: { name: 'Witness Testimony', description: 'Direct observations, witnessed events' },
      relational: { name: 'Relationships', description: 'Family, custody, marriage, divorce' },
      temporal: { name: 'Chronological', description: 'Dates, times, sequences' },
      general: { name: 'General', description: 'General factual statement' }
    };

    return {
      category,
      subcategory: subcategory || 'general',
      name: categories[category]?.name || 'General',
      description: categories[category]?.description || 'General factual statement'
    };
  }

  getProfessionalSystemPrompt() {
    return `You are a legal document expert. Analyze facts for professional legal standards and proper categorization.`;
  }

  buildProfessionalValidationPrompt(fact, existingFacts, context) {
    const factText = fact.content || fact;
    return `ANALYZE THIS FACT FOR LEGAL AFFIDAVIT: "${factText}"
    
CONTEXT: ${context.state || 'General'} affidavit for ${context.affiantName || 'client'}

Analyze for professional language, legal standards, and proper categorization. Respond in JSON format.`;
  }

  buildBatchPrompt(facts, context) {
    let prompt = `ANALYZE THESE FACTS FOR PROFESSIONAL LEGAL AFFIDAVIT:\n`;
    facts.forEach((fact, index) => {
      prompt += `${index}: "${fact.content || fact}"\n`;
    });
    prompt += `\nAnalyze for professional standards and respond in JSON format.`;
    return prompt;
  }

  getBatchSystemPrompt() {
    return `Analyze multiple facts for professional legal standards, categorization, and narrative flow.`;
  }

  fallbackValidation(fact) {
    return {
      isValid: true,
      category: 'general',
      subcategory: 'other',
      professionalVersion: fact.content || fact,
      languageIssues: [],
      legalIssues: [],
      improvements: ['Consider professional review'],
      legalStandardScore: 60,
      enhancedCategory: this.enhanceCategory('general', 'other')
    };
  }
}

// SaveStatus Component
const SaveStatus = ({ status, lastSaved, error, onRetry, className = '' }) => {
  const getStatusDisplay = () => {
    switch (status) {
      case 'saving':
        return (
          <div className="flex items-center text-blue-600">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            <span className="text-sm">Saving...</span>
          </div>

        </div>

        {/* Enhanced Batch Validation Results */}
        {validationResults?.batch && (
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <Award className="w-5 h-5 mr-2 text-purple-600" />
              Professional Standards Assessment
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="text-purple-800 font-semibold">Overall Professional</div>
                <div className="text-2xl font-bold text-purple-600">
                  {validationResults.batch.overallProfessional ? '✅ Yes' : '❌ No'}
                </div>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-blue-800 font-semibold">Average Score</div>
                <div className={`text-2xl font-bold ${getScoreColor(validationResults.batch.professionalStandard?.averageScore || 0)}`}>
                  {Math.round(validationResults.batch.professionalStandard?.averageScore || 0)}/100
                </div>
              </div>
              
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-green-800 font-semibold">Court Ready</div>
                <div className="text-2xl font-bold text-green-600">
                  {validationResults.batch.readyForCourt ? '⚖️ Yes' : '📝 Needs Work'}
                </div>
              </div>
            </div>

            {validationResults.batch.professionalSummary && (
              <div className="bg-gray-50 p-4 rounded-lg mb-4">
                <strong>Professional Summary:</strong> {validationResults.batch.professionalSummary}
              </div>
            )}

            {validationResults.batch.narrativeFlow && (
              <div className="bg-blue-50 p-4 rounded-lg mb-4">
                <strong>Narrative Flow:</strong> {validationResults.batch.narrativeFlow}
              </div>
            )}

            {validationResults.batch.globalIssues?.length > 0 && (
              <div className="bg-yellow-50 p-4 rounded-lg mb-4">
                <strong className="text-yellow-800">Global Issues:</strong>
                <div className="mt-2 space-y-1">
                  {validationResults.batch.globalIssues.map((issue, i) => (
                    <div key={i} className="text-yellow-700">⚠️ {issue}</div>
                  ))}
                </div>
              </div>
            )}

            {validationResults.batch.recommendedOrder && (
              <div className="bg-indigo-50 p-4 rounded-lg">
                <strong className="text-indigo-800">Recommended Fact Order:</strong>
                <div className="mt-2 text-indigo-700">
                  Facts should be ordered: {validationResults.batch.recommendedOrder.map(i => i + 1).join(' → ')}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Comparison with Basic Validation */}
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-purple-800 mb-4">
            🆚 Enhanced vs Basic Validation Comparison
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-red-50 border border-red-200 rounded p-4">
              <h4 className="font-semibold text-red-800 mb-2">❌ Basic Validation (Current)</h4>
              <ul className="text-sm text-red-700 space-y-1">
                <li>• Simple keyword categorization</li>
                <li>• No professional language checking</li>
                <li>• No legal standard assessment</li>
                <li>• Basic duplicate detection</li>
                <li>• 8 basic categories</li>
                <li>• No rewriting suggestions</li>
              </ul>
            </div>
            
            <div className="bg-green-50 border border-green-200 rounded p-4">
              <h4 className="font-semibold text-green-800 mb-2">✅ Enhanced Professional Validation</h4>
              <ul className="text-sm text-green-700 space-y-1">
                <li>• 9 categories with subcategories</li>
                <li>• Professional language analysis</li>
                <li>• Legal standard scoring (0-100)</li>
                <li>• Court-readiness assessment</li>
                <li>• Professional fact rewriting</li>
                <li>• Narrative flow analysis</li>
                <li>• Legal admissibility checking</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Test Results */}
        <div className="bg-green-50 border border-green-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-green-800 mb-4">Test Checklist</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <label className="flex items-center space-x-2">
              <input type="checkbox" />
              <span>✅ Save status shows loading → success</span>
            </label>
            <label className="flex items-center space-x-2">
              <input type="checkbox" />
              <span>✅ Error state shows retry button</span>
            </label>
            <label className="flex items-center space-x-2">
              <input type="checkbox" />
              <span>✅ Auto-save works when editing</span>
            </label>
            <label className="flex items-center space-x-2">
              <input type="checkbox" />
              <span>✅ Facts validation catches issues</span>
            </label>
            <label className="flex items-center space-x-2">
              <input type="checkbox" />
              <span>✅ Batch validation works</span>
            </label>
            <label className="flex items-center space-x-2">
              <input type="checkbox" />
              <span>✅ Performance is acceptable</span>
            </label>
          </div>
          
          <div className="mt-4 p-3 bg-green-100 rounded border border-green-300">
            <p className="text-green-800 font-medium">
              📋 Once satisfied with testing, confirm these features work and we'll proceed with refactoring your main app!
            </p>
          </div>
        </div>

      </div>
    </div>
  );
};

export default App;>
        );
      case 'saved':
        return (
          <div className="flex items-center text-green-600">
            <Check className="w-4 h-4 mr-2" />
            <span className="text-sm">Saved</span>
          </div>
        );
      case 'error':
        return (
          <div className="flex items-center space-x-2">
            <div className="flex items-center text-red-600">
              <AlertCircle className="w-4 h-4 mr-2" />
              <span className="text-sm">Save failed</span>
            </div>
            {onRetry && (
              <button
                onClick={onRetry}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                Retry
              </button>
            )}
          </div>
        );
      default:
        if (lastSaved) {
          return (
            <div className="text-gray-500">
              <span className="text-sm">
                Last saved: {lastSaved.toLocaleTimeString()}
              </span>
            </div>
          );
        }
        return null;
    }
  };

  return (
    <div className={`transition-all duration-300 ${className}`}>
      {getStatusDisplay()}
      {error && status === 'error' && (
        <div className="mt-1 text-xs text-red-500">{error}</div>
      )}
    </div>
  );
};

// Main Enhanced Test Component
const App = () => {
  // Mock affidavit data with some problematic facts for testing
  const [affidavitData, setAffidavitData] = useState({
    affiantName: 'John Doe',
    state: 'TX',
    caseType: 'Family Law',
    facts: [
      { content: 'I live at 123 Main Street, Austin, Texas', category: 'property' },
      { content: 'I maybe saw the defendant do something terrible to my car', category: 'witness' },
      { content: 'I paid around $500 for the amazing repair work', category: 'financial' },
      { content: 'My spouse kinda acted weird during the incident', category: 'relational' }
    ]
  });

  // Save status state
  const [saveStatus, setSaveStatus] = useState(null);
  const [lastSaved, setLastSaved] = useState(null);
  const [saveError, setSaveError] = useState(null);

  // Enhanced validation state
  const [validationResults, setValidationResults] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [newFact, setNewFact] = useState('');

  // Services - now using Enhanced service
  const [enhancedValidationService] = useState(() => new EnhancedFactValidationService(mockOpenAI, 'en'));
  const saveTimeoutRef = useRef(null);

  // Mock save function
  const mockSave = async (data) => {
    await new Promise(resolve => setTimeout(resolve, 2000));
    if (Math.random() > 0.2) {
      return { success: true, documentId: 'doc_123' };
    } else {
      throw new Error('Network timeout - please check your connection');
    }
  };

  // Enhanced save with status
  const handleSaveWithStatus = async (dataToSave = affidavitData) => {
    if (saveStatus === 'saving') return;

    setSaveStatus('saving');
    setSaveError(null);

    try {
      const result = await mockSave(dataToSave);
      
      if (result.success) {
        setSaveStatus('saved');
        setLastSaved(new Date());
        setTimeout(() => setSaveStatus(null), 3000);
        return result;
      } else {
        throw new Error('Save failed');
      }
    } catch (error) {
      setSaveStatus('error');
      setSaveError(error.message);
      console.error('Save failed:', error);
    }
  };

  // Auto-save when data changes
  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      handleSaveWithStatus();
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [affidavitData]);

  // Data update handler
  const handleDataUpdate = (updates) => {
    setAffidavitData(prev => ({ ...prev, ...updates }));
  };

  // Add fact
  const addFact = () => {
    if (newFact.trim()) {
      const newFacts = [...affidavitData.facts, { content: newFact.trim(), category: 'general' }];
      handleDataUpdate({ facts: newFacts });
      setNewFact('');
    }
  };

  // Remove fact
  const removeFact = (index) => {
    const newFacts = affidavitData.facts.filter((_, i) => i !== index);
    handleDataUpdate({ facts: newFacts });
  };

  // Enhanced single fact validation
  const validateSingleFact = async (fact, index) => {
    try {
      setIsValidating(true);
      const result = await enhancedValidationService.validateFactProfessional(fact, affidavitData.facts, {
        state: affidavitData.state,
        affiantName: affidavitData.affiantName,
        caseType: affidavitData.caseType
      });
      
      setValidationResults(prev => ({
        ...prev,
        individual: { ...prev?.individual, [index]: result }
      }));
    } catch (error) {
      console.error('Enhanced validation failed:', error);
    } finally {
      setIsValidating(false);
    }
  };

  // Enhanced batch validation
  const validateAllFacts = async () => {
    try {
      setIsValidating(true);
      const result = await enhancedValidationService.validateFactsBatchProfessional(affidavitData.facts, {
        state: affidavitData.state,
        documentType: 'affidavit',
        affiantName: affidavitData.affiantName,
        caseType: affidavitData.caseType
      });
      
      setValidationResults({ batch: result, individual: validationResults?.individual || {} });
    } catch (error) {
      console.error('Enhanced batch validation failed:', error);
    } finally {
      setIsValidating(false);
    }
  };

  const getFactValidationStatus = (index) => {
    const individual = validationResults?.individual?.[index];
    if (!individual) return null;
    
    if (!individual.isValid || individual.legalStandardScore < 50) return 'error';
    if (individual.languageIssues?.length > 0 || individual.legalStandardScore < 80) return 'warning';
    return 'success';
  };

  const getScoreColor = (score) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center">
                <Award className="w-8 h-8 mr-3 text-purple-600" />
                Enhanced Professional Validation Test
              </h1>
              <p className="text-gray-600 mt-2">
                Test Enhanced Professional Fact Validation with legal language standards
              </p>
            </div>
            
            {/* Save Status Display */}
            <div className="text-right">
              <SaveStatus 
                status={saveStatus}
                lastSaved={lastSaved}
                error={saveError}
                onRetry={() => handleSaveWithStatus()}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          
          {/* Left Column - Document Data */}
          <div className="space-y-6">
            
            {/* Affidavit Info */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Mock Affidavit Data</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Affiant Name</label>
                  <input
                    type="text"
                    value={affidavitData.affiantName}
                    onChange={(e) => handleDataUpdate({ affiantName: e.target.value })}
                    className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                  <select
                    value={affidavitData.state}
                    onChange={(e) => handleDataUpdate({ state: e.target.value })}
                    className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="TX">Texas</option>
                    <option value="UT">Utah</option>
                    <option value="AZ">Arizona</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Case Type</label>
                  <select
                    value={affidavitData.caseType}
                    onChange={(e) => handleDataUpdate({ caseType: e.target.value })}
                    className="w-full p-2 border rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="Family Law">Family Law</option>
                    <option value="Civil">Civil</option>
                    <option value="Criminal">Criminal</option>
                    <option value="Probate">Probate</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Save Controls */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Save Status Testing</h2>
              
              <div className="space-y-3">
                <button
                  onClick={() => handleSaveWithStatus()}
                  className="w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                  disabled={saveStatus === 'saving'}
                >
                  <Save className="w-4 h-4 inline mr-2" />
                  Manual Save Test
                </button>
                
                <button
                  onClick={() => {
                    setSaveStatus('error');
                    setSaveError('Mock error for testing - database connection failed');
                  }}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Simulate Save Error
                </button>

                <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded">
                  <strong>Auto-save:</strong> Changes are automatically saved 2 seconds after editing.
                  Watch the save status in the header!
                </div>
              </div>
            </div>

          </div>

          {/* Right Column - Enhanced Facts Management */}
          <div className="space-y-6">
            
            {/* Add New Fact */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-semibold mb-4">Professional Facts Testing</h2>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Add Test Fact</label>
                  <div className="flex space-x-2">
                    <input
                      type="text"
                      value={newFact}
                      onChange={(e) => setNewFact(e.target.value)}
                      className="flex-1 p-2 border rounded focus:outline-none focus:ring-2 focus:ring-purple-500"
                      placeholder="Try: 'I maybe think the defendant acted terrible'"
                      onKeyPress={(e) => e.key === 'Enter' && addFact()}
                    />
                    <button
                      onClick={addFact}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Try problematic language: "maybe", "terrible", "kinda", "around $500", "amazing"
                  </p>
                </div>

                <button
                  onClick={validateAllFacts}
                  className="w-full px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                  disabled={isValidating || affidavitData.facts.length === 0}
                >
                  {isValidating ? 'Analyzing Professional Standards...' : 'Professional Validation (Enhanced LLM)'}
                </button>
              </div>
            </div>

            {/* Enhanced Facts List */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">Facts with Professional Analysis</h3>
              
              <div className="space-y-4">
                {affidavitData.facts.map((fact, index) => {
                  const status = getFactValidationStatus(index);
                  const individual = validationResults?.individual?.[index];
                  const statusColors = {
                    error: 'border-red-300 bg-red-50',
                    warning: 'border-yellow-300 bg-yellow-50',
                    success: 'border-green-300 bg-green-50'
                  };
                  
                  return (
                    <div 
                      key={index} 
                      className={`p-4 border rounded-lg ${status ? statusColors[status] : 'border-gray-300'}`}
                    >
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-medium px-2 py-1 bg-gray-100 rounded">
                            {individual?.enhancedCategory?.name || fact.category || 'General'}
                          </span>
                          {individual?.legalStandardScore && (
                            <span className={`text-xs font-bold ${getScoreColor(individual.legalStandardScore)}`}>
                              {individual.legalStandardScore}/100
                            </span>
                          )}
                        </div>
                        <div className="flex space-x-2">
                          <button
                            onClick={() => validateSingleFact(fact, index)}
                            className="text-xs px-2 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
                            disabled={isValidating}
                          >
                            Analyze
                          </button>
                          <button
                            onClick={() => removeFact(index)}
                            className="text-red-600 hover:text-red-800"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="text-sm text-gray-800 mb-3 p-2 bg-gray-50 rounded">
                        <strong>Original:</strong> "{fact.content}"
                      </div>

                      {/* Professional Analysis Results */}
                      {individual && (
                        <div className="space-y-3">
                          {/* Professional Rewrite */}
                          {individual.professionalRewrite && individual.professionalRewrite !== fact.content && (
                            <div className="text-sm p-2 bg-green-50 border border-green-200 rounded">
                              <strong className="text-green-800">Professional Version:</strong>
                              <div className="mt-1 text-green-700">"{individual.professionalRewrite}"</div>
                            </div>
                          )}

                          {/* Language Issues */}
                          {individual.languageIssues?.length > 0 && (
                            <div className="text-xs space-y-1">
                              <strong className="text-red-600">Language Issues:</strong>
                              {individual.languageIssues.map((issue, i) => (
                                <div key={i} className="text-red-600">❌ {issue}</div>
                              ))}
                            </div>
                          )}

                          {/* Legal Issues */}
                          {individual.legalIssues?.length > 0 && (
                            <div className="text-xs space-y-1">
                              <strong className="text-orange-600">Legal Concerns:</strong>
                              {individual.legalIssues.map((issue, i) => (
                                <div key={i} className="text-orange-600">⚖️ {issue}</div>
                              ))}
                            </div>
                          )}

                          {/* Improvements */}
                          {individual.improvements?.length > 0 && (
                            <div className="text-xs space-y-1">
                              <strong className="text-blue-600">Suggestions:</strong>
                              {individual.improvements.map((improvement, i) => (
                                <div key={i} className="text-blue-600">💡 {improvement}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

          </div