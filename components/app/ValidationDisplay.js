'use client';

// client/src/components/ValidationDisplay.js
import React from 'react';
import { AlertTriangle, AlertCircle, CheckCircle } from 'lucide-react';

const ValidationDisplay = ({ validation }) => {
  if (!validation) return null;

  return (
    <div className="mb-4">
      {validation.errors && validation.errors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-3">
          <div className="flex items-center mb-2">
            <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
            <h4 className="text-red-800 font-medium">Validation Errors</h4>
          </div>
          <ul className="text-red-700 text-sm">
            {validation.errors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      )}
      
      {validation.warnings && validation.warnings.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-3">
          <div className="flex items-center mb-2">
            <AlertCircle className="h-5 w-5 text-yellow-600 mr-2" />
            <h4 className="text-yellow-800 font-medium">Warnings</h4>
          </div>
          <ul className="text-yellow-700 text-sm">
            {validation.warnings.map((warning, index) => (
              <li key={index}>• {warning}</li>
            ))}
          </ul>
        </div>
      )}
      
      {validation.isValid && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
            <span className="text-green-800 font-medium">All requirements met!</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default ValidationDisplay;