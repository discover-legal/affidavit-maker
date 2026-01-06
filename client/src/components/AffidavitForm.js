// client/src/components/AffidavitForm.js
/**
 * Affidavit Form Component with Optimized State Management
 * Uses useReducer for complex state and prevents unnecessary re-renders
 * 
 * @version 2.0.0
 */

import React, { useReducer, useCallback, useMemo, useRef, useEffect } from 'react';
import { debounce } from 'lodash';
// NOTE: EnhancedFactValidationService import removed - validation is handled server-side

// Action types
const ActionTypes = {
  UPDATE_DATA: 'UPDATE_DATA',
  ADD_FACT: 'ADD_FACT',
  REMOVE_FACT: 'REMOVE_FACT',
  UPDATE_FACT: 'UPDATE_FACT',
  SET_VALIDATION_RESULTS: 'SET_VALIDATION_RESULTS',
  SET_VALIDATION_STATUS: 'SET_VALIDATION_STATUS',
  SET_SAVE_STATUS: 'SET_SAVE_STATUS',
  SET_SAVE_ERROR: 'SET_SAVE_ERROR',
  SET_LAST_SAVED: 'SET_LAST_SAVED',
  RESET_FORM: 'RESET_FORM',
  SET_LOADING: 'SET_LOADING',
  BATCH_UPDATE: 'BATCH_UPDATE'
};

// Initial state
const initialState = {
  affidavitData: {
    affiantName: '',
    state: 'TX',
    caseType: 'general',
    facts: []
  },
  validation: {
    results: null,
    isValidating: false,
    lastValidated: null
  },
  save: {
    status: null, // 'saving', 'saved', 'error', null
    lastSaved: null,
    error: null,
    autoSaveEnabled: true
  },
  ui: {
    isLoading: false,
    activeFactIndex: null,
    expandedSections: ['facts']
  }
};

// Reducer function
function affidavitReducer(state, action) {
  switch (action.type) {
    case ActionTypes.UPDATE_DATA:
      return {
        ...state,
        affidavitData: {
          ...state.affidavitData,
          ...action.payload
        }
      };
    
    case ActionTypes.ADD_FACT:
      return {
        ...state,
        affidavitData: {
          ...state.affidavitData,
          facts: [...state.affidavitData.facts, action.payload]
        }
      };
    
    case ActionTypes.REMOVE_FACT:
      return {
        ...state,
        affidavitData: {
          ...state.affidavitData,
          facts: state.affidavitData.facts.filter((_, index) => index !== action.payload)
        }
      };
    
    case ActionTypes.UPDATE_FACT:
      return {
        ...state,
        affidavitData: {
          ...state.affidavitData,
          facts: state.affidavitData.facts.map((fact, index) =>
            index === action.payload.index ? action.payload.fact : fact
          )
        }
      };
    
    case ActionTypes.SET_VALIDATION_RESULTS:
      return {
        ...state,
        validation: {
          ...state.validation,
          results: action.payload,
          lastValidated: new Date().toISOString()
        }
      };
    
    case ActionTypes.SET_VALIDATION_STATUS:
      return {
        ...state,
        validation: {
          ...state.validation,
          isValidating: action.payload
        }
      };
    
    case ActionTypes.SET_SAVE_STATUS:
      return {
        ...state,
        save: {
          ...state.save,
          status: action.payload.status,
          error: action.payload.error || null
        }
      };
    
    case ActionTypes.SET_LAST_SAVED:
      return {
        ...state,
        save: {
          ...state.save,
          lastSaved: action.payload
        }
      };
    
    case ActionTypes.SET_LOADING:
      return {
        ...state,
        ui: {
          ...state.ui,
          isLoading: action.payload
        }
      };
    
    case ActionTypes.BATCH_UPDATE:
      return {
        ...state,
        ...action.payload
      };
    
    case ActionTypes.RESET_FORM:
      return initialState;
    
    default:
      return state;
  }
}

// Custom hook for auto-save
function useAutoSave(data, saveFunction, enabled = true, delay = 2000) {
  const timeoutRef = useRef(null);
  const previousDataRef = useRef(data);
  
  useEffect(() => {
    if (!enabled) return;
    
    // Check if data actually changed
    const dataChanged = JSON.stringify(data) !== JSON.stringify(previousDataRef.current);
    
    if (dataChanged) {
      previousDataRef.current = data;
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      
      timeoutRef.current = setTimeout(() => {
        saveFunction(data);
      }, delay);
    }
    
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, saveFunction, enabled, delay]);
}

// Main component
export default function AffidavitForm({
  initialData = {},
  onSave,
  validationService
}) {
  const [state, dispatch] = useReducer(
    affidavitReducer,
    {
      ...initialState,
      affidavitData: {
        ...initialState.affidavitData,
        ...initialData
      }
    }
  );

  const [newFactInput, setNewFactInput] = React.useState('');
  const [availableStates, setAvailableStates] = React.useState([]);
  const [statesLoading, setStatesLoading] = React.useState(true);

  // Fetch available states from API
  useEffect(() => {
    const fetchStates = async () => {
      try {
        const response = await fetch('/api/templates/states');
        if (response.ok) {
          const states = await response.json();
          setAvailableStates(states);
        } else {
          console.error('Failed to fetch states:', response.statusText);
          // Fallback to empty array, will show message
          setAvailableStates([]);
        }
      } catch (error) {
        console.error('Error fetching states:', error);
        setAvailableStates([]);
      } finally {
        setStatesLoading(false);
      }
    };

    fetchStates();
  }, []);
  
  // Memoized validation service (validation is handled server-side)
  const validator = useMemo(() => {
    return validationService || null;
  }, [validationService]);
  
  // Callbacks with useCallback to prevent unnecessary re-renders
  const updateData = useCallback((updates) => {
    dispatch({ type: ActionTypes.UPDATE_DATA, payload: updates });
  }, []);
  
  const addFact = useCallback(() => {
    if (newFactInput.trim()) {
      const trimmedContent = newFactInput.trim();
      dispatch({
        type: ActionTypes.ADD_FACT,
        payload: {
          content: trimmedContent,
          originalContent: trimmedContent, // Preserve original user input
          category: 'general',
          id: Date.now().toString()
        }
      });
      setNewFactInput('');
    }
  }, [newFactInput]);
  
  const removeFact = useCallback((index) => {
    dispatch({ type: ActionTypes.REMOVE_FACT, payload: index });
  }, []);
  
  const updateFact = useCallback((index, fact) => {
    dispatch({
      type: ActionTypes.UPDATE_FACT,
      payload: { index, fact }
    });
  }, []);
  
  // Save function
  const handleSave = useCallback(async (dataToSave = state.affidavitData) => {
    if (state.save.status === 'saving') return;
    
    dispatch({
      type: ActionTypes.SET_SAVE_STATUS,
      payload: { status: 'saving', error: null }
    });
    
    try {
      const result = await (onSave || defaultSaveFunction)(dataToSave);
      
      dispatch({
        type: ActionTypes.SET_SAVE_STATUS,
        payload: { status: 'saved' }
      });
      
      dispatch({
        type: ActionTypes.SET_LAST_SAVED,
        payload: new Date().toISOString()
      });
      
      // Clear saved status after 3 seconds
      setTimeout(() => {
        dispatch({
          type: ActionTypes.SET_SAVE_STATUS,
          payload: { status: null }
        });
      }, 3000);
      
      return result;
    } catch (error) {
      dispatch({
        type: ActionTypes.SET_SAVE_STATUS,
        payload: { 
          status: 'error', 
          error: error.message || 'Save failed'
        }
      });
      
      console.error('Save failed:', error);
      throw error;
    }
  }, [state.affidavitData, state.save.status, onSave]);
  
  // Debounced save for auto-save
  const debouncedSave = useMemo(
    () => debounce(handleSave, 2000),
    [handleSave]
  );
  
  // Use auto-save hook
  useAutoSave(
    state.affidavitData, 
    debouncedSave, 
    state.save.autoSaveEnabled,
    2000
  );
  
  // Validation functions
  const validateSingleFact = useCallback(async (fact, index) => {
    dispatch({
      type: ActionTypes.SET_VALIDATION_STATUS,
      payload: true
    });
    
    try {
      const result = await validator.validateFactProfessional(
        fact,
        state.affidavitData.facts,
        {
          state: state.affidavitData.state,
          affiantName: state.affidavitData.affiantName,
          caseType: state.affidavitData.caseType
        }
      );
      
      dispatch({
        type: ActionTypes.SET_VALIDATION_RESULTS,
        payload: {
          ...state.validation.results,
          individual: {
            ...state.validation.results?.individual,
            [index]: result
          }
        }
      });
    } catch (error) {
      console.error('Validation failed:', error);
    } finally {
      dispatch({
        type: ActionTypes.SET_VALIDATION_STATUS,
        payload: false
      });
    }
  }, [state.affidavitData, validator, state.validation.results]);
  
  const validateAllFacts = useCallback(async () => {
    dispatch({
      type: ActionTypes.SET_VALIDATION_STATUS,
      payload: true
    });
    
    try {
      const result = await validator.validateFactsBatchProfessional(
        state.affidavitData.facts,
        {
          state: state.affidavitData.state,
          documentType: 'affidavit',
          affiantName: state.affidavitData.affiantName,
          caseType: state.affidavitData.caseType
        }
      );
      
      dispatch({
        type: ActionTypes.SET_VALIDATION_RESULTS,
        payload: {
          batch: result,
          individual: state.validation.results?.individual || {}
        }
      });
    } catch (error) {
      console.error('Batch validation failed:', error);
    } finally {
      dispatch({
        type: ActionTypes.SET_VALIDATION_STATUS,
        payload: false
      });
    }
  }, [state.affidavitData, validator, state.validation.results]);
  
  // Memoized values for performance
  const saveStatusDisplay = useMemo(() => {
    if (state.save.status === 'saving') return 'Saving...';
    if (state.save.status === 'saved') return '✓ Saved';
    if (state.save.status === 'error') return `❌ ${state.save.error}`;
    return null;
  }, [state.save]);
  
  const validationSummary = useMemo(() => {
    const batch = state.validation.results?.batch;
    if (!batch) return null;
    
    return {
      total: batch.totalFacts,
      valid: batch.validFacts,
      critical: batch.criticalIssues,
      warnings: batch.warnings
    };
  }, [state.validation.results]);
  
  return (
    <div className="affidavit-form-container">
      {/* Header with save status */}
      <div className="form-header">
        <h2>Affidavit Builder</h2>
        <div className="save-status">
          {saveStatusDisplay && (
            <span className={`status-${state.save.status}`}>
              {saveStatusDisplay}
            </span>
          )}
          {state.save.lastSaved && (
            <span className="last-saved">
              Last saved: {new Date(state.save.lastSaved).toLocaleTimeString()}
            </span>
          )}
        </div>
      </div>
      
      {/* Basic Information */}
      <section className="form-section">
        <h3>Basic Information</h3>
        
        <div className="form-group">
          <label htmlFor="affiantName">Your Name</label>
          <input
            id="affiantName"
            type="text"
            value={state.affidavitData.affiantName}
            onChange={(e) => updateData({ affiantName: e.target.value })}
            placeholder="Enter your full legal name"
            className="form-input"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="state">State</label>
          <select
            id="state"
            value={state.affidavitData.state}
            onChange={(e) => updateData({ state: e.target.value })}
            className="form-select"
            disabled={statesLoading}
          >
            {statesLoading ? (
              <option value="">Loading states...</option>
            ) : availableStates.length === 0 ? (
              <option value="">No states available</option>
            ) : (
              <>
                <option value="">Select a state...</option>
                {availableStates.map((stateInfo) => (
                  <option key={stateInfo.stateCode} value={stateInfo.stateCode}>
                    {stateInfo.stateName}
                  </option>
                ))}
              </>
            )}
          </select>
        </div>
        
        <div className="form-group">
          <label htmlFor="caseType">Case Type</label>
          <select
            id="caseType"
            value={state.affidavitData.caseType}
            onChange={(e) => updateData({ caseType: e.target.value })}
            className="form-select"
          >
            <option value="general">General</option>
            <option value="family">Family Law</option>
            <option value="civil">Civil</option>
            <option value="criminal">Criminal</option>
            <option value="probate">Probate</option>
          </select>
        </div>
      </section>
      
      {/* Facts Section */}
      <section className="form-section">
        <div className="section-header">
          <h3>Facts & Statements</h3>
          <button
            onClick={validateAllFacts}
            disabled={state.validation.isValidating || state.affidavitData.facts.length === 0}
            className="btn-validate"
          >
            {state.validation.isValidating ? 'Validating...' : 'Validate All'}
          </button>
        </div>
        
        {/* Validation Summary */}
        {validationSummary && (
          <div className="validation-summary">
            <span className="summary-item">
              Total: {validationSummary.total}
            </span>
            <span className="summary-item valid">
              Valid: {validationSummary.valid}
            </span>
            {validationSummary.critical > 0 && (
              <span className="summary-item critical">
                Critical: {validationSummary.critical}
              </span>
            )}
            {validationSummary.warnings > 0 && (
              <span className="summary-item warning">
                Warnings: {validationSummary.warnings}
              </span>
            )}
          </div>
        )}
        
        {/* Add new fact */}
        <div className="add-fact-container">
          <input
            type="text"
            value={newFactInput}
            onChange={(e) => setNewFactInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addFact()}
            placeholder="Enter a fact or statement..."
            className="fact-input"
          />
          <button
            onClick={addFact}
            disabled={!newFactInput.trim()}
            className="btn-add"
          >
            Add Fact
          </button>
        </div>
        
        {/* Facts list */}
        <div className="facts-list">
          {state.affidavitData.facts.map((fact, index) => {
            const validation = state.validation.results?.individual?.[index];
            const batchValidation = state.validation.results?.batch?.results?.[index];
            const result = validation || batchValidation;
            
            return (
              <FactItem
                key={fact.id || index}
                fact={fact}
                index={index}
                validation={result}
                onUpdate={(updatedFact) => updateFact(index, updatedFact)}
                onRemove={() => removeFact(index)}
                onValidate={() => validateSingleFact(fact, index)}
                isValidating={state.validation.isValidating}
              />
            );
          })}
          
          {state.affidavitData.facts.length === 0 && (
            <div className="empty-state">
              No facts added yet. Add your first fact above.
            </div>
          )}
        </div>
      </section>
      
      {/* Actions */}
      <div className="form-actions">
        <button
          onClick={() => handleSave()}
          disabled={state.save.status === 'saving'}
          className="btn-primary"
        >
          {state.save.status === 'saving' ? 'Saving...' : 'Save Draft'}
        </button>
        
        <button
          onClick={() => dispatch({ type: ActionTypes.RESET_FORM })}
          className="btn-secondary"
        >
          Reset Form
        </button>
        
        <label className="auto-save-toggle">
          <input
            type="checkbox"
            checked={state.save.autoSaveEnabled}
            onChange={(e) => updateData({ autoSaveEnabled: e.target.checked })}
          />
          Auto-save enabled
        </label>
      </div>
    </div>
  );
}

// Fact Item Component (Memoized for performance)
const FactItem = React.memo(function FactItem({
  fact,
  index,
  validation,
  onUpdate,
  onRemove,
  onValidate,
  isValidating
}) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editValue, setEditValue] = React.useState(fact.content);
  
  const handleSave = () => {
    onUpdate({ ...fact, content: editValue });
    setIsEditing(false);
  };
  
  const handleCancel = () => {
    setEditValue(fact.content);
    setIsEditing(false);
  };
  
  const getValidationClass = () => {
    if (!validation) return '';
    if (!validation.isValid) return 'invalid';
    if (validation.warnings?.length > 0) return 'warning';
    return 'valid';
  };
  
  return (
    <div className={`fact-item ${getValidationClass()}`}>
      <div className="fact-header">
        <span className="fact-number">#{index + 1}</span>
        <div className="fact-actions">
          {!isEditing && (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="btn-icon"
                title="Edit"
              >
                ✏️
              </button>
              <button
                onClick={onValidate}
                disabled={isValidating}
                className="btn-icon"
                title="Validate"
              >
                ✓
              </button>
            </>
          )}
          <button
            onClick={onRemove}
            className="btn-icon btn-danger"
            title="Remove"
          >
            🗑️
          </button>
        </div>
      </div>
      
      <div className="fact-content">
        {isEditing ? (
          <div className="edit-container">
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="edit-textarea"
              rows="3"
            />
            <div className="edit-actions">
              <button onClick={handleSave} className="btn-small btn-primary">
                Save
              </button>
              <button onClick={handleCancel} className="btn-small">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="fact-text">{fact.content}</p>
            
            {validation && (
              <div className="validation-details">
                {validation.professionalRewrite && 
                 validation.professionalRewrite !== fact.content && (
                  <div className="professional-version">
                    <strong>Suggested:</strong> {validation.professionalRewrite}
                    <button
                      onClick={() => onUpdate({ 
                        ...fact, 
                        content: validation.professionalRewrite 
                      })}
                      className="btn-apply"
                    >
                      Apply
                    </button>
                  </div>
                )}
                
                {validation.errors?.length > 0 && (
                  <div className="validation-errors">
                    {validation.errors.map((error, i) => (
                      <div key={i} className="error-item">❌ {error}</div>
                    ))}
                  </div>
                )}
                
                {validation.warnings?.length > 0 && (
                  <div className="validation-warnings">
                    {validation.warnings.map((warning, i) => (
                      <div key={i} className="warning-item">⚠️ {warning}</div>
                    ))}
                  </div>
                )}
                
                {validation.suggestions?.length > 0 && (
                  <div className="validation-suggestions">
                    {validation.suggestions.map((suggestion, i) => (
                      <div key={i} className="suggestion-item">💡 {suggestion}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
});

// Default save function if none provided
async function defaultSaveFunction(data) {
  // Simulate API call
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Simulate random failure for testing
  if (Math.random() > 0.9) {
    throw new Error('Network error - please try again');
  }
  
  return {
    success: true,
    documentId: `doc_${Date.now()}`,
    timestamp: new Date().toISOString()
  };
}