'use client';

// client/src/components/SaveProgressButton.js - NEW COMPONENT (CREATE THIS FILE)
import React, { useState, useEffect } from 'react';
import { Save, Loader, Check, AlertCircle, Clock } from 'lucide-react';
import { useAuth0 } from '@/lib/auth0-client';
import { trackEvent } from '@/lib/utils/analytics';

const SaveProgressButton = ({ 
  onSave, 
  isSaving = false, 
  lastSaved, 
  hasUnsavedChanges = false,
  disabled = false,
  className = "" 
}) => {
  const [saveStatus, setSaveStatus] = useState('idle'); // 'idle', 'saving', 'success', 'error'
  const { isAuthenticated, loginWithRedirect } = useAuth0();
  
  // Sync with external saving state
  useEffect(() => {
    if (isSaving) {
      setSaveStatus('saving');
    }
  }, [isSaving]);
  
  const handleSave = async () => {
    if (!isAuthenticated) {
      loginWithRedirect();
      return;
    }

    if (disabled || saveStatus === 'saving') {
      return;
    }

    try {
      setSaveStatus('saving');
      await onSave();
      setSaveStatus('success');

      // Track successful save
      trackEvent('document_saved', {
        has_unsaved_changes: hasUnsavedChanges
      });

      // Reset to idle after showing success
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch (error) {
      console.error('Save failed:', error);
      setSaveStatus('error');

      // Track save failure
      trackEvent('document_save_failed', {
        error_message: error.message
      });

      // Reset to idle after showing error
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };
  
  const getButtonText = () => {
    if (!isAuthenticated) {
      return 'Login to Save';
    }
    
    switch (saveStatus) {
      case 'saving': return 'Saving...';
      case 'success': return 'Saved!';
      case 'error': return 'Save Failed';
      default: return hasUnsavedChanges ? 'Save Progress' : 'Saved';
    }
  };
  
  const getButtonClass = () => {
    const baseClass = `px-4 py-2 rounded-lg font-medium transition-colors flex items-center ${className}`;
    
    if (!isAuthenticated) {
      return `${baseClass} bg-blue-600 text-white hover:bg-blue-700`;
    }
    
    if (disabled) {
      return `${baseClass} bg-gray-200 text-gray-500 cursor-not-allowed`;
    }
    
    switch (saveStatus) {
      case 'saving':
        return `${baseClass} bg-blue-100 text-blue-700 cursor-not-allowed`;
      case 'success':
        return `${baseClass} bg-green-100 text-green-700`;
      case 'error':
        return `${baseClass} bg-red-100 text-red-700`;
      default:
        return hasUnsavedChanges 
          ? `${baseClass} bg-blue-600 text-white hover:bg-blue-700` 
          : `${baseClass} bg-gray-100 text-gray-500 cursor-not-allowed`;
    }
  };
  
  const getIcon = () => {
    if (!isAuthenticated) {
      return <Save className="h-4 w-4 mr-2" />;
    }
    
    switch (saveStatus) {
      case 'saving':
        return <Loader className="h-4 w-4 mr-2 animate-spin" />;
      case 'success':
        return <Check className="h-4 w-4 mr-2" />;
      case 'error':
        return <AlertCircle className="h-4 w-4 mr-2" />;
      default:
        return <Save className="h-4 w-4 mr-2" />;
    }
  };
  
  const formatLastSaved = (date) => {
    if (!date) return null;
    
    const now = new Date();
    const diff = now - date;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    
    if (minutes < 1) return 'Just saved';
    if (minutes < 60) return `Saved ${minutes}m ago`;
    if (hours < 24) return `Saved ${hours}h ago`;
    return `Saved ${date.toLocaleDateString()}`;
  };
  
  return (
    <div className="flex flex-col items-end space-y-2">
      <button
        onClick={handleSave}
        disabled={!isAuthenticated ? false : (saveStatus === 'saving' || (!hasUnsavedChanges && saveStatus !== 'error') || disabled)}
        className={getButtonClass()}
      >
        {getIcon()}
        {getButtonText()}
      </button>
      
      {/* Last saved indicator */}
      {isAuthenticated && lastSaved && (
        <div className="flex items-center text-xs text-gray-500">
          <Clock className="h-3 w-3 mr-1" />
          <span>{formatLastSaved(lastSaved)}</span>
        </div>
      )}
      
      {/* Auto-save indicator */}
      {isAuthenticated && hasUnsavedChanges && saveStatus === 'idle' && (
        <div className="text-xs text-gray-400">
          Auto-save in progress...
        </div>
      )}
      
      {/* Error message */}
      {saveStatus === 'error' && (
        <div className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
          Failed to save. Try again.
        </div>
      )}
      
      {/* Success message */}
      {saveStatus === 'success' && (
        <div className="text-xs text-green-600 bg-green-50 px-2 py-1 rounded">
          Progress saved successfully
        </div>
      )}
    </div>
  );
};

export default SaveProgressButton;