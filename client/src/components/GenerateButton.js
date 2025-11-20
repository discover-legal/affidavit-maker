// client/src/components/GenerateButton.js - NEW COMPONENT (CREATE THIS FILE)
import React, { useState } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { Download, Loader, AlertCircle, CheckCircle } from 'lucide-react';

// Use relative URLs in production (empty string), localhost in development
const API_BASE_URL = process.env.REACT_APP_API_URL !== undefined
  ? process.env.REACT_APP_API_URL
  : 'http://localhost:3001';

const GenerateButton = ({ affidavitData, validation, onGenerate, className = "" }) => {
  const [generateStatus, setGenerateStatus] = useState('idle');
  const { isAuthenticated, getAccessTokenSilently, loginWithRedirect } = useAuth0();
  
  // Check if document is ready for generation
  const canGenerate = validation?.isValid && 
                     affidavitData?.affiantName && 
                     affidavitData?.state &&
                     affidavitData?.facts?.length > 0;
  
  const handleGenerateClick = async () => {
    if (!isAuthenticated) {
      // Redirect to login
      loginWithRedirect();
      return;
    }
    
    if (!canGenerate) {
      // Show validation errors
      setGenerateStatus('validation-error');
      setTimeout(() => setGenerateStatus('idle'), 3000);
      return;
    }
    
    await handleGenerate();
  };
  
  const handleGenerate = async () => {
    try {
      setGenerateStatus('generating');
      
      const token = await getAccessTokenSilently();

      const response = await fetch(`${API_BASE_URL}/api/documents/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          affidavitData,
          documentId: affidavitData.documentId,
          skipPayment: process.env.NODE_ENV === 'development' // Skip payment in development
        })
      });
      
      if (response.ok) {
        // Handle PDF download
        const blob = await response.blob();
        
        // Create download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `affidavit-${affidavitData.affiantName?.replace(/[^a-zA-Z0-9]/g, '_') || 'document'}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        
        setGenerateStatus('success');
        
        if (onGenerate) {
          onGenerate({ success: true, message: 'PDF downloaded successfully' });
        }
        
      } else {
        // Handle error response
        const errorData = await response.json().catch(() => ({ error: 'Generation failed' }));
        
        if (response.status === 402) {
          // Payment required
          setGenerateStatus('payment-required');
        } else {
          throw new Error(errorData.error || 'Generation failed');
        }
      }
      
    } catch (error) {
      console.error('Generate failed:', error);
      setGenerateStatus('error');
      
      if (onGenerate) {
        onGenerate({ success: false, error: error.message });
      }
    }
    
    // Reset status after showing result
    setTimeout(() => setGenerateStatus('idle'), 3000);
  };
  
  const getButtonText = () => {
    switch (generateStatus) {
      case 'generating': return 'Generating PDF...';
      case 'success': return 'Download Complete!';
      case 'error': return 'Generation Failed - Try Again';
      case 'validation-error': return 'Complete Required Fields First';
      case 'payment-required': return 'Payment Required';
      default: return canGenerate ? 'Generate Affidavit PDF' : 'Complete Document First';
    }
  };
  
  const getButtonClass = () => {
    const baseClass = `w-full px-6 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center ${className}`;
    
    if (!canGenerate) {
      return `${baseClass} bg-gray-200 text-gray-500 cursor-not-allowed`;
    }
    
    switch (generateStatus) {
      case 'generating':
        return `${baseClass} bg-blue-100 text-blue-700 cursor-not-allowed`;
      case 'success':
        return `${baseClass} bg-green-600 text-white`;
      case 'error':
      case 'validation-error':
        return `${baseClass} bg-red-100 text-red-700`;
      case 'payment-required':
        return `${baseClass} bg-yellow-100 text-yellow-800`;
      default:
        return `${baseClass} bg-blue-600 text-white hover:bg-blue-700`;
    }
  };
  
  const getIcon = () => {
    switch (generateStatus) {
      case 'generating':
        return <Loader className="h-5 w-5 mr-2 animate-spin" />;
      case 'success':
        return <CheckCircle className="h-5 w-5 mr-2" />;
      case 'error':
      case 'validation-error':
      case 'payment-required':
        return <AlertCircle className="h-5 w-5 mr-2" />;
      default:
        return <Download className="h-5 w-5 mr-2" />;
    }
  };
  
  return (
    <div className="space-y-3">
      <button
        onClick={handleGenerateClick}
        disabled={generateStatus === 'generating'}
        className={getButtonClass()}
      >
        {getIcon()}
        {getButtonText()}
      </button>
      
      {/* Validation Requirements */}
      {!canGenerate && validation && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
          <p className="font-medium mb-2">Complete these requirements to generate your affidavit:</p>
          <ul className="space-y-1">
            {validation.errors?.map((error, index) => (
              <li key={index} className="flex items-start">
                <span className="mr-2">•</span>
                <span>{error}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      
      {/* Status Messages */}
      {generateStatus === 'success' && (
        <div className="text-sm text-green-600 bg-green-50 p-3 rounded-lg">
          <div className="flex items-center">
            <CheckCircle className="h-4 w-4 mr-2" />
            <span>Your affidavit PDF has been downloaded successfully!</span>
          </div>
        </div>
      )}
      
      {generateStatus === 'error' && (
        <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="h-4 w-4 mr-2" />
            <span>Generation failed. Please try again or contact support if the problem persists.</span>
          </div>
        </div>
      )}
      
      {generateStatus === 'payment-required' && (
        <div className="text-sm text-yellow-800 bg-yellow-50 p-3 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="h-4 w-4 mr-2" />
            <span>Payment is required to generate the final PDF. This feature will be enabled in production.</span>
          </div>
        </div>
      )}
      
      {/* Development Note */}
      {process.env.NODE_ENV === 'development' && canGenerate && (
        <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded">
          <p>💡 Development Mode: PDF generation is free for testing</p>
        </div>
      )}
    </div>
  );
};

export default GenerateButton;