'use client';

// client/src/components/EnhancedValidationDisplay.js - Shows all validation including county

import React from 'react';
import { AlertTriangle, AlertCircle, CheckCircle, MapPin, Info } from 'lucide-react';

const EnhancedValidationDisplay = ({ validation, countyValidation }) => {
  if (!validation && !countyValidation) return null;

  return (
    <div className="mb-4 space-y-3">
      {/* Standard validation errors */}
      {validation?.errors && validation.errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
            <h4 className="text-red-800 font-medium">Validation Errors</h4>
          </div>
          <ul className="text-red-700 text-sm space-y-1">
            {validation.errors.map((error, index) => (
              <li key={index} className="flex items-start">
                <span className="mr-2">•</span>
                <span>{error}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Standard validation warnings */}
      {validation?.warnings && validation.warnings.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
            <h4 className="text-yellow-800 font-medium">Warnings</h4>
          </div>
          <ul className="text-yellow-700 text-sm space-y-1">
            {validation.warnings.map((warning, index) => (
              <li key={index} className="flex items-start">
                <span className="mr-2">•</span>
                <span>{warning}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* County validation results */}
      {countyValidation && (
        <CountyValidationCard validation={countyValidation} />
      )}
      
      {/* Success message */}
      {validation?.isValid && !countyValidation && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
            <span className="text-green-800 font-medium">All requirements met!</span>
          </div>
        </div>
      )}

      {/* Combined success with county validation */}
      {validation?.isValid && countyValidation?.isValid && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
            <span className="text-green-800 font-medium">
              All requirements met! County validation passed.
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

const CountyValidationCard = ({ validation }) => {
  if (!validation) return null;

  const getCardStyle = () => {
    if (validation.isValid) {
      return "bg-green-50 border-green-200 text-green-800";
    } else if (validation.confidence > 0.7) {
      return "bg-yellow-50 border-yellow-200 text-yellow-800";
    } else {
      return "bg-red-50 border-red-200 text-red-800";
    }
  };

  const getIcon = () => {
    if (validation.isValid) {
      return <CheckCircle className="h-5 w-5 text-green-600" />;
    } else if (validation.confidence > 0.7) {
      return <AlertCircle className="h-5 w-5 text-yellow-600" />;
    } else {
      return <AlertTriangle className="h-5 w-5 text-red-600" />;
    }
  };

  const getTitle = () => {
    if (validation.isValid) {
      return "County Verified";
    } else if (validation.confidence > 0.7) {
      return "County Needs Attention";
    } else {
      return "County Invalid";
    }
  };

  return (
    <div className={`border rounded-lg p-4 ${getCardStyle()}`}>
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0 mt-0.5">
          <MapPin className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2 mb-2">
            {getIcon()}
            <h4 className="font-medium">{getTitle()}</h4>
            {validation.confidence < 1.0 && (
              <span className="text-xs px-2 py-1 bg-white bg-opacity-50 rounded">
                {Math.round(validation.confidence * 100)}% confidence
              </span>
            )}
          </div>
          
          <p className="text-sm mb-2">{validation.reasoning}</p>
          
          {/* Show normalized county name if different */}
          {validation.normalizedCounty && 
           validation.normalizedCounty !== validation.county && (
            <p className="text-sm">
              <strong>Suggested:</strong> {validation.normalizedCounty}
            </p>
          )}
          
          {/* Show suggestions */}
          {validation.suggestions && validation.suggestions.length > 0 && (
            <div className="mt-2">
              <p className="text-sm font-medium mb-1">Similar counties:</p>
              <div className="flex flex-wrap gap-1">
                {validation.suggestions.slice(0, 3).map((suggestion, index) => (
                  <span
                    key={index}
                    className="inline-block px-2 py-1 text-xs bg-white bg-opacity-50 rounded"
                  >
                    {suggestion}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {/* Source information */}
          {validation.source && (
            <div className="mt-2 flex items-center text-xs opacity-75">
              <Info className="h-3 w-3 mr-1" />
              <span>
                {validation.source === 'llm' ? 'AI-verified' :
                 validation.source === 'fallback_exact' ? 'Database match' :
                 validation.source === 'fallback_fuzzy' ? 'Fuzzy match' :
                 validation.source === 'error' ? 'Validation error' :
                 'System validated'}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EnhancedValidationDisplay;