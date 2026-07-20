'use client';

// client/src/components/GenerateButton.js - NEW COMPONENT (CREATE THIS FILE)
import React, { useState } from 'react';
import { useAuth0 } from '@/lib/auth0-client';
import { Download, FileText, Loader, AlertCircle, CheckCircle } from 'lucide-react';
import { trackEvent } from '@/lib/utils/analytics';
import ReviewGate from './ReviewGate';
import CoffeeLink from './CoffeeLink';

// Use relative URLs in production (empty string), localhost in development
const API_BASE_URL = '';

const GenerateButton = ({ affidavitData, validation, onGenerate, className = "" }) => {
  const [generateStatus, setGenerateStatus] = useState('idle');
  // "Verify before you swear" review gate state
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [pendingFormat, setPendingFormat] = useState('pdf');
  const { isAuthenticated, getAccessTokenSilently, loginWithRedirect } = useAuth0();

  // Check if document is ready for generation
  const canGenerate = validation?.isValid &&
                     affidavitData?.affiantName &&
                     affidavitData?.state &&
                     affidavitData?.facts?.length > 0;

  // Open the review gate for the requested format; generation only
  // happens after the user confirms their own statements.
  const openReview = (format = 'pdf') => {
    setPendingFormat(format);
    setIsReviewOpen(true);
  };

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

    openReview('pdf');
  };

  // Review gate confirmed — the user verified their own statements.
  const handleReviewConfirm = async () => {
    setIsReviewOpen(false);
    await handleGenerate(pendingFormat);
  };
  
  /**
   * Generate and download a document in the given format ('pdf' or 'docx').
   */
  const handleGenerate = async (format = 'pdf') => {
    try {
      setGenerateStatus('generating');

      const docType = affidavitData.documentType || 'affidavit';
      const ext = format === 'docx' ? 'docx' : 'pdf';

      trackEvent('document_generation_started', {
        document_id: affidavitData.documentId,
        state: affidavitData.state,
        facts_count: affidavitData.facts?.length || 0,
        format,
        document_type: docType
      });

      const token = await getAccessTokenSilently();

      const response = await fetch(`${API_BASE_URL}/api/documents/generate?format=${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          affidavitData,
          documentId: affidavitData.documentId
        })
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;

        // Name file based on document type + person name
        const nameSlug = (affidavitData.affiantName || affidavitData.petitionerName || 'document')
          .replace(/[^a-zA-Z0-9]/g, '_');
        const prefix = docType.includes('petition') ? 'petition'
          : docType.includes('decree') ? 'decree'
          : 'affidavit';
        a.download = `${prefix}-${nameSlug}.${ext}`;

        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        setGenerateStatus('success');

        trackEvent('document_generated_successfully', {
          document_id: affidavitData.documentId,
          state: affidavitData.state,
          format,
          document_type: docType
        });

        if (onGenerate) {
          onGenerate({ success: true, message: `${ext.toUpperCase()} downloaded successfully` });
        }

      } else {
        const errorData = await response.json().catch(() => ({ error: 'Generation failed' }));

        if (response.status === 402) {
          setGenerateStatus('payment-required');
          trackEvent('document_generation_payment_required', {
            document_id: affidavitData.documentId
          });
        } else {
          throw new Error(errorData.error || 'Generation failed');
        }
      }

    } catch (error) {
      console.error('Generate failed:', error);
      setGenerateStatus('error');

      trackEvent('document_generation_failed', {
        document_id: affidavitData.documentId,
        error_message: error.message
      });

      if (onGenerate) {
        onGenerate({ success: false, error: error.message });
      }
    }

    setTimeout(() => setGenerateStatus('idle'), 3000);
  };
  
  const docLabel = (() => {
    const dt = affidavitData?.documentType || 'affidavit';
    if (dt.includes('petition')) return 'Petition';
    if (dt.includes('decree')) return 'Decree';
    return 'Affidavit';
  })();

  const getButtonText = () => {
    switch (generateStatus) {
      case 'generating': return 'Generating...';
      case 'success': return 'Download Complete!';
      case 'error': return 'Generation Failed - Try Again';
      case 'validation-error': return 'Complete Required Fields First';
      case 'payment-required': return 'Payment Required';
      default: return canGenerate ? `Download ${docLabel} PDF` : 'Complete Document First';
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
      <div className="flex gap-2">
        <button
          onClick={handleGenerateClick}
          disabled={generateStatus === 'generating'}
          className={getButtonClass()}
          style={{ flex: 1 }}
        >
          {getIcon()}
          {getButtonText()}
        </button>

        {canGenerate && generateStatus !== 'generating' && (
          <button
            onClick={() => openReview('docx')}
            disabled={generateStatus === 'generating'}
            className="px-4 py-3 rounded-lg font-semibold transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200 flex items-center"
            title={`Download ${docLabel} as Word document`}
          >
            <FileText className="h-5 w-5 mr-1" />
            .docx
          </button>
        )}
      </div>
      
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
        <div className="space-y-2">
          <div className="text-sm text-green-600 bg-green-50 p-3 rounded-lg">
            <div className="flex items-center">
              <CheckCircle className="h-4 w-4 mr-2" />
              <span>Your {docLabel.toLowerCase()} has been downloaded successfully!</span>
            </div>
          </div>
          <CoffeeLink />
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
          <p>Development Mode: PDF/Word generation is free for testing</p>
        </div>
      )}

      {/* Review gate: verify statements before the sworn document downloads */}
      <ReviewGate
        isOpen={isReviewOpen}
        affidavitData={affidavitData}
        onConfirm={handleReviewConfirm}
        onCancel={() => setIsReviewOpen(false)}
      />
    </div>
  );
};

export default GenerateButton;