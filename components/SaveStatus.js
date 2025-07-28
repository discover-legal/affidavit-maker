// components/SaveStatus.js
import React from 'react';
import { Check, AlertCircle, Loader2, RefreshCw } from 'lucide-react';

const SaveStatus = ({ status, lastSaved, error, onRetry, className = '' }) => {
  const getStatusDisplay = () => {
    switch (status) {
      case 'saving':
        return (
          <div className="flex items-center text-blue-600">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            <span className="text-sm">Saving...</span>
          </div>
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
                title="Retry save"
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

  // Show error details if available
  const errorDetails = error && status === 'error' ? (
    <div className="mt-1 text-xs text-red-500 max-w-md">
      {error}
    </div>
  ) : null;

  return (
    <div className={`transition-all duration-300 ${className}`}>
      {getStatusDisplay()}
      {errorDetails}
    </div>
  );
};

export default SaveStatus;