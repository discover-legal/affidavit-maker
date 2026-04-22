// client/src/components/CountyValidationInput.js - Smart county input with validation

import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { useAuth0 } from '@auth0/auth0-react';

// Use relative URLs in production (empty string), localhost in development
const API_BASE = process.env.REACT_APP_API_URL !== undefined
  ? process.env.REACT_APP_API_URL
  : 'http://localhost:3001';

const CountyValidationInput = ({ 
  value, 
  onChange, 
  state, 
  disabled = false,
  placeholder = "Enter county name..."
}) => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const [validation, setValidation] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [availableCounties, setAvailableCounties] = useState([]);

  // Load available counties for autocomplete
  useEffect(() => {
    if (state && ['TX', 'UT', 'AZ', 'CA', 'FL', 'IL', 'NY'].includes(state)) {
      fetch(`${API_BASE}/api/counties/${state}`)
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setAvailableCounties(data.counties);
          }
        })
        .catch(err => console.error('Failed to load counties:', err));
    }
  }, [state]);

  // Debounced validation
  const validateCounty = useCallback(async (county, currentState) => {
    if (!county || !currentState || county.trim() === '') {
      setValidation(null);
      setSuggestions([]);
      return;
    }

    setIsValidating(true);
    
    try {
      let headers = { 'Content-Type': 'application/json' };
      
      if (isAuthenticated) {
        try {
          const token = await getAccessTokenSilently({
            authorizationParams: { audience: process.env.REACT_APP_AUTH0_AUDIENCE }
          });
          headers['Authorization'] = `Bearer ${token}`;
        } catch (authError) {
          // Continue without auth if token fails
        }
      }

      const response = await fetch(`${API_BASE}/api/validate/county`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ 
          county: county.trim(), 
          state: currentState 
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setValidation(data.validation);
        setSuggestions(data.validation.suggestions || []);
        setShowSuggestions(data.validation.suggestions?.length > 0);
      } else {
        setValidation({
          isValid: false,
          confidence: 0.5,
          reasoning: 'Validation service unavailable',
          source: 'error'
        });
      }
    } catch (error) {
      console.error('County validation error:', error);
      setValidation({
        isValid: false,
        confidence: 0.5,
        reasoning: 'Unable to validate county',
        source: 'error'
      });
    } finally {
      setIsValidating(false);
    }
  }, [isAuthenticated, getAccessTokenSilently]);

  // Debounce validation calls
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (value && state) {
        validateCounty(value, state);
      }
    }, 800); // Wait 800ms after user stops typing

    return () => clearTimeout(timeoutId);
  }, [value, state, validateCounty]);

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    onChange(newValue);
    
    // Reset validation state when typing
    if (validation && newValue !== value) {
      setValidation(null);
      setShowSuggestions(false);
    }

    // Show autocomplete suggestions
    if (newValue.length >= 2 && availableCounties.length > 0) {
      const filtered = availableCounties.filter(county =>
        county.toLowerCase().includes(newValue.toLowerCase())
      ).slice(0, 5);
      setSuggestions(filtered);
      setShowSuggestions(filtered.length > 0);
    } else {
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    onChange(suggestion);
    setShowSuggestions(false);
    setValidation(null); // Reset to trigger new validation
  };

  const getValidationIcon = () => {
    if (isValidating) {
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    }
    
    if (!validation) return null;
    
    if (validation.isValid) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    } else if (validation.confidence > 0.7) {
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    } else {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
  };

  const getValidationMessage = () => {
    if (!validation || isValidating) return null;
    
    if (validation.isValid) {
      return (
        <p className="text-sm text-green-600 mt-1">
          ✓ {validation.normalizedCounty} County, {state}
          {validation.confidence < 1.0 && ` (${Math.round(validation.confidence * 100)}% confidence)`}
        </p>
      );
    } else {
      return (
        <div className="mt-1">
          <p className="text-sm text-red-600">
            {validation.reasoning}
          </p>
          {validation.normalizedCounty && validation.normalizedCounty !== value && (
            <button
              onClick={() => handleSuggestionClick(validation.normalizedCounty)}
              className="text-sm text-blue-600 hover:text-blue-800 underline mt-1"
            >
              Did you mean "{validation.normalizedCounty}"?
            </button>
          )}
        </div>
      );
    }
  };

  const inputClasses = `
    w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
    ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}
    ${validation?.isValid === false ? 'border-red-300' : 
      validation?.isValid === true ? 'border-green-300' : 'border-gray-300'}
  `;

  return (
    <div className="relative">
      <div className="relative">
        <input
          type="text"
          value={value || ''}
          onChange={handleInputChange}
          onFocus={() => {
            if (suggestions.length > 0) {
              setShowSuggestions(true);
            }
          }}
          onBlur={() => {
            // Delay hiding suggestions to allow clicking
            setTimeout(() => setShowSuggestions(false), 200);
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={inputClasses}
        />
        
        {/* Validation icon */}
        <div className="absolute inset-y-0 right-0 flex items-center pr-3">
          {getValidationIcon()}
        </div>
      </div>

      {/* Validation message */}
      {getValidationMessage()}

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleSuggestionClick(suggestion)}
              className="w-full px-3 py-2 text-left hover:bg-blue-50 focus:bg-blue-50 focus:outline-none first:rounded-t-lg last:rounded-b-lg"
            >
              <span className="font-medium">{suggestion}</span>
              <span className="text-sm text-gray-500 ml-2">County, {state}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default CountyValidationInput;