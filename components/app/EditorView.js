'use client';

// client/src/views/EditorView.js - FIXED VERSION WITH PAYMENT
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { ArrowLeft, Gavel, Save, Download, MessageSquare, Eye, Settings, GripVertical, Scale, Send } from 'lucide-react';
import { useAuth0 } from '@/lib/auth0-client';
import { useDocumentData, useSaveMetadata, useUIState, useDocumentActions } from '@/contexts/DocumentContext';
import { useFirm } from '@/contexts/FirmContext';
import ChatInterface from './ChatInterface';
import DocumentPreview from './DocumentPreview';
import ValidationSidebar from './ValidationSidebar';
import PaymentModal from './PaymentModal';
import { trackEvent } from '@/lib/utils/analytics';

// Use relative URLs in production (empty string), localhost in development
const API_BASE_URL = '';

// Resizer component for adjusting pane widths
const Resizer = ({ onResize, isResizing, setIsResizing, position = 'between-chat-preview' }) => {
  const handleMouseDown = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);

    const startX = e.clientX;
    const container = e.target.closest('.editor-layout');
    const containerRect = container.getBoundingClientRect();
    const containerWidth = containerRect.width;

    const handleMouseMove = (e) => {
      const deltaX = e.clientX - startX;
      const deltaPercentage = (deltaX / containerWidth) * 100;
      
      if (position === 'between-chat-preview') {
        onResize(deltaPercentage, 'chat-preview');
      } else if (position === 'between-preview-validation') {
        onResize(deltaPercentage, 'preview-validation');
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [onResize, setIsResizing, position]);

  return (
    <div
      className={`w-2 bg-gray-200 cursor-col-resize hover:bg-blue-300 transition-colors group flex items-center justify-center ${
        isResizing ? 'bg-blue-200' : ''
      }`}
      onMouseDown={handleMouseDown}
      style={{ minWidth: '8px' }}
    >
      <div className={`flex flex-col justify-center h-full opacity-0 group-hover:opacity-100 transition-opacity ${
        isResizing ? 'opacity-100' : ''
      }`}>
        <GripVertical className="h-4 w-4 text-gray-400" />
      </div>
    </div>
  );
};

// Main Editor View Component with 35/35/30 proportions
const EditorView = ({ isNew = false, onBack }) => {
  const { isAuthenticated, getAccessTokenSilently } = useAuth0();
  const params = useParams();
  const documentId = Array.isArray(params?.documentId) ? params.documentId[0] : params?.documentId;
  const searchParams = useSearchParams();

  // ✅ Get document type and case type from URL query params (for new documents)
  const documentTypeFromUrl = searchParams.get('type') || 'affidavit';
  const caseTypeFromUrl = searchParams.get('caseType') || 'family';
  const isDivorcePackage = documentTypeFromUrl === 'divorce_package';

  // ✅ FIX: Track if initialization was done for a specific documentId
  // This prevents multiple initializations due to dependency changes
  const initializationDone = React.useRef(false);
  const lastDocumentId = React.useRef(null);
  const lastAuthState = React.useRef(isAuthenticated);

  // Layout state with new proportions (30/40/30)
  const [chatWidth, setChatWidth] = useState(30);
  const [previewWidth, setPreviewWidth] = useState(40);
  const [validationWidth, setValidationWidth] = useState(30);
  const [isResizing, setIsResizing] = useState(false);
  const [activePanel, setActivePanel] = useState('chat');
  const [isMobileView, setIsMobileView] = useState(false);

  // Payment modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [, setIsPaidDocument] = useState(false);
  const [isCheckingPayment, setIsCheckingPayment] = useState(false);

  // Firm mode: send-to-lawyer state ('idle' | 'sending' | 'sent' | 'error')
  const { firmMode, firmName } = useFirm();
  const [firmSubmitStatus, setFirmSubmitStatus] = useState('idle');
  const [firmSubmitMessage, setFirmSubmitMessage] = useState('');

  // Use split contexts to prevent unnecessary re-renders
  const { currentDocument, preview } = useDocumentData();
  const { isSaving, lastSaved, hasUnsavedChanges, justSaved } = useSaveMetadata();
  const { sessionInitialized } = useUIState();
  const { saveDocument, loadDocument, initializeNewDocument } = useDocumentActions();

  // Check for mobile view
  useEffect(() => {
    const checkMobileView = () => {
      setIsMobileView(window.innerWidth < 768);
    };

    checkMobileView();
    window.addEventListener('resize', checkMobileView);
    return () => window.removeEventListener('resize', checkMobileView);
  }, []);

  // Reset scroll position when editor loads
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  // Reset scroll position when switching mobile tabs
  useEffect(() => {
    if (isMobileView) {
      window.scrollTo(0, 0);
    }
  }, [activePanel, isMobileView]);

  // Check payment status for a document
  const checkPaymentStatus = useCallback(async (docId) => {
    try {
      setIsCheckingPayment(true);

      const response = await fetch(`${API_BASE_URL}/api/documents/${docId}`, {
        method: 'GET',
      });

      if (!response.ok) {
        throw new Error('Failed to check payment status');
      }

      const data = await response.json();
      // Access payment_status from the document object
      const paymentStatus = data.document?.payment_status || data.payment_status;
      // Valid paid statuses: paid, completed, free, succeeded
      const validPaidStatuses = ['paid', 'completed', 'free', 'succeeded'];
      const isPaid = validPaidStatuses.includes(paymentStatus);
      setIsPaidDocument(isPaid);
      console.log('💰 Payment status checked:', { docId, paymentStatus, isPaid });
      return isPaid;
    } catch (error) {
      console.error('❌ Payment status check failed:', error);
      return false;
    } finally {
      setIsCheckingPayment(false);
    }
  }, [getAccessTokenSilently, setIsPaidDocument]);

  // Check payment status when document loads
  useEffect(() => {
    if (currentDocument.documentId && isAuthenticated && !isNew) {
      checkPaymentStatus(currentDocument.documentId);
    } else {
      // Reset payment status for new documents
      setIsPaidDocument(false);
    }
  }, [currentDocument.documentId, isAuthenticated, isNew, setIsPaidDocument, checkPaymentStatus]);

  // ✅ FIXED: Properly handle document loading and switching
  useEffect(() => {
    const hasDocumentIdChanged = lastDocumentId.current !== documentId;

    // Update refs
    lastAuthState.current = isAuthenticated;

    if (hasDocumentIdChanged) {
      // DocumentId changed - reset initialization flag
      console.log('📂 Document ID changed from', lastDocumentId.current, 'to', documentId);
      initializationDone.current = false;
      lastDocumentId.current = documentId;
    }

    // Initialize session based on route
    const initializeSession = async () => {
      // Skip if already initialized (prevents duplicate runs on auth state changes)
      if (initializationDone.current) {
        return;
      }

      // Wait for Auth0 session to finish loading before proceeding.
      // Without this guard, initializationDone gets set to true while
      // isAuthenticated is still false (the useUser() hook fetches /api/auth/me
      // asynchronously on mount), and the document is never created when the
      // session finally resolves and the effect re-fires.
      if (!isAuthenticated) {
        return;
      }

      // Log what we're doing
      console.log('📂 Loading document from URL:', documentId, 'isNew:', isNew);

      if (isNew) {
        // For new documents, initialize with forceNew=true and document type.
        // Only mark done AFTER success so a retry is possible if auth was
        // still loading when this first ran.
        try {
          await initializeNewDocument(true, documentTypeFromUrl, caseTypeFromUrl);
          initializationDone.current = true;
          // Track new document editor opened
          trackEvent('editor_opened', {
            is_new_document: true,
            document_type: documentTypeFromUrl,
            case_type: caseTypeFromUrl
          });
        } catch (err) {
          console.error('Failed to initialize new document on server:', err);
          initializationDone.current = false;
        }
      } else if (documentId && isAuthenticated) {
        // Loading existing document from URL
        if (sessionInitialized && currentDocument.documentId === documentId) {
          console.log('✅ Document already loaded:', documentId);
          initializationDone.current = true;
          return;
        }

        initializationDone.current = true;

        console.log('📂 Loading existing document:', documentId);
        try {
          await loadDocument(documentId);
          console.log('✅ Document loaded:', documentId);
          // Track existing document editor opened
          trackEvent('editor_opened', {
            is_new_document: false,
            document_id: documentId
          });
        } catch (error) {
          console.error('❌ Failed to load document:', error);
          initializationDone.current = false;
        }
      }
    };

    initializeSession();

    return () => {
      console.log('🧹 Cleaning up document session');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, isNew, isAuthenticated]);

  // Handle pane resizing with constraints
  const handlePaneResize = useCallback((deltaPercentage, resizeType) => {
    if (resizeType === 'chat-preview') {
      const newChatWidth = Math.max(20, Math.min(50, chatWidth + deltaPercentage));
      const newPreviewWidth = Math.max(20, Math.min(50, previewWidth - deltaPercentage));
      
      const availableSpace = 100 - validationWidth;
      const totalNewWidth = newChatWidth + newPreviewWidth;
      
      if (totalNewWidth <= availableSpace) {
        setChatWidth(newChatWidth);
        setPreviewWidth(newPreviewWidth);
      }
    } else if (resizeType === 'preview-validation') {
      const newPreviewWidth = Math.max(20, Math.min(50, previewWidth + deltaPercentage));
      const newValidationWidth = Math.max(20, Math.min(50, validationWidth - deltaPercentage));
      
      const availableSpace = 100 - chatWidth;
      const totalNewWidth = newPreviewWidth + newValidationWidth;
      
      if (totalNewWidth <= availableSpace) {
        setPreviewWidth(newPreviewWidth);
        setValidationWidth(newValidationWidth);
      }
    }
  }, [chatWidth, previewWidth, validationWidth]);

  // Handle manual save
  const handleSaveProgress = async () => {
    if (!isAuthenticated) {
      console.warn('Cannot save: User not authenticated');
      return;
    }
    
    try {
      const documentId = await saveDocument();
      if (documentId) {
        console.log('✅ Document saved:', documentId);
      }
    } catch (error) {
      console.error('Save error:', error);
    }
  };

  // Perform the actual PDF download
  const performDownload = async () => {
    try {
      console.log('📥 Starting PDF download...', {
        documentId: currentDocument.documentId,
        affiantName: currentDocument.affiantName
      });

      const response = await fetch(`${API_BASE_URL}/api/documents/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          affidavitData: currentDocument,
          documentId: currentDocument.documentId,
          // Don't skip payment - let backend check payment status
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Download failed' }));
        throw new Error(errorData.error || 'Failed to generate PDF');
      }

      const blob = await response.blob();
      console.log('✅ PDF generated, size:', blob.size, 'bytes');

      // Build a meaningful filename based on document type and sub-document
      const safe = (s) => (s || '').replace(/[^a-zA-Z0-9]/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
      let downloadName;
      if (currentDocument.documentType === 'divorce_package') {
        const subDoc = currentDocument.activeSubDocument || 'divorce_petition';
        const partyName = currentDocument.petitionerName ||
          [currentDocument.petitionerFirstName, currentDocument.petitionerLastName].filter(Boolean).join(' ');
        downloadName = `${subDoc.replace(/_/g, '-')}-${safe(partyName) || 'document'}.pdf`;
      } else {
        downloadName = `affidavit-${safe(currentDocument.affiantName) || 'document'}.pdf`;
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      console.log('✅ PDF download started');

    } catch (error) {
      console.error('❌ PDF download failed:', error);
      alert(`Failed to download PDF: ${error.message}`);
      throw error;
    }
  };

  // Handle PDF download - check payment first
  const handleDownload = async () => {
    if (!currentDocument.documentId) {
      alert('Please save the document first');
      return;
    }

    if (!isAuthenticated) {
      alert('Please log in to download your document');
      return;
    }

    try {
      // Firm mode: the firm covers generation (the server marks the document
      // 'free' when it's sent to the lawyer), so never show the payment modal.
      if (firmMode) {
        await performDownload();
        return;
      }

      // Check if document has been paid for
      const isPaid = await checkPaymentStatus(currentDocument.documentId);

      if (isPaid) {
        // Document already paid - proceed with download
        await performDownload();
      } else {
        // Payment required - show payment modal
        setIsPaymentModalOpen(true);
      }
    } catch (error) {
      console.error('❌ Download initiation failed:', error);
      alert(`Failed to initiate download: ${error.message}`);
    }
  };

  // Firm mode: save the draft, then submit it to the firm's BigLaw platform
  const handleSendToLawyer = async () => {
    if (!currentDocument.documentId) {
      alert('Please save the document first');
      return;
    }

    if (!isAuthenticated) {
      alert('Please log in to send your document');
      return;
    }

    setFirmSubmitStatus('sending');
    setFirmSubmitMessage('');

    try {
      // Persist the latest edits so the lawyer receives the current draft
      await saveDocument();

      const response = await fetch(`${API_BASE_URL}/api/firm/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: Number(currentDocument.documentId) })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to send document to your lawyer');
      }

      const status = data.data?.submission?.status || 'received';
      setFirmSubmitStatus('sent');
      setFirmSubmitMessage(`Sent to ${firmName || 'your law firm'} — status: ${status.replace(/_/g, ' ')}`);

      trackEvent('firm_submission_sent', {
        document_id: currentDocument.documentId,
        status
      });
    } catch (error) {
      console.error('❌ Send to lawyer failed:', error);
      setFirmSubmitStatus('error');
      setFirmSubmitMessage(`Failed to send: ${error.message}`);
    }
  };

  // Handle successful payment
  const handlePaymentSuccess = async () => {
    console.log('✅ Payment successful, starting download...');
    setIsPaymentModalOpen(false);
    setIsPaidDocument(true);

    try {
      // Wait a moment for webhook to process
      await new Promise(resolve => setTimeout(resolve, 1000));
      await performDownload();
    } catch (error) {
      console.error('❌ Post-payment download failed:', error);
      alert('Payment successful, but download failed. Please try downloading again.');
    }
  };
  // Mobile panel navigation
  const renderMobileNavigation = () => (
    <div className="flex border-b bg-white sticky top-0 z-10 shadow-sm">
      <button
        onClick={() => setActivePanel('chat')}
        className={`flex-1 py-3 px-2 border-b-2 font-medium text-xs sm:text-sm transition-colors ${
          activePanel === 'chat'
            ? 'border-blue-600 text-blue-600 bg-blue-50'
            : 'border-transparent text-gray-600 hover:text-blue-600 hover:bg-gray-50'
        }`}
      >
        <MessageSquare className="h-5 w-5 mx-auto mb-1" />
        <span className="block">Chat</span>
      </button>
      <button
        onClick={() => setActivePanel('preview')}
        className={`flex-1 py-3 px-2 border-b-2 font-medium text-xs sm:text-sm transition-colors ${
          activePanel === 'preview'
            ? 'border-blue-600 text-blue-600 bg-blue-50'
            : 'border-transparent text-gray-600 hover:text-blue-600 hover:bg-gray-50'
        }`}
      >
        <Eye className="h-5 w-5 mx-auto mb-1" />
        <span className="block">Preview</span>
      </button>
      <button
        onClick={() => setActivePanel('validation')}
        className={`flex-1 py-3 px-2 border-b-2 font-medium text-xs sm:text-sm transition-colors ${
          activePanel === 'validation'
            ? 'border-blue-600 text-blue-600 bg-blue-50'
            : 'border-transparent text-gray-600 hover:text-blue-600 hover:bg-gray-50'
        }`}
      >
        <Settings className="h-5 w-5 mx-auto mb-1" />
        <span className="block">Validate</span>
      </button>
    </div>
  );

  // Desktop layout with new proportions
  const renderDesktopLayout = () => (
    <div className="flex-1 flex min-h-0 editor-layout">
      {/* Chat Panel - 35% default */}
      <div 
        className="bg-white border-r flex flex-col"
        style={{ width: `${chatWidth}%` }}
      >
        <ChatInterface />
      </div>

      {/* Resizer between Chat and Preview */}
      <Resizer
        onResize={handlePaneResize}
        isResizing={isResizing}
        setIsResizing={setIsResizing}
        position="between-chat-preview"
      />

      {/* Preview Panel - 35% default */}
      <div 
        className="bg-gray-50 flex flex-col min-h-0"
        style={{ width: `${previewWidth}%` }}
      >
        <DocumentPreview />
      </div>

      {/* Resizer between Preview and Validation */}
      <Resizer
        onResize={handlePaneResize}
        isResizing={isResizing}
        setIsResizing={setIsResizing}
        position="between-preview-validation"
      />

      {/* Validation Panel - 30% default */}
      <div 
        className="bg-white border-l flex flex-col"
        style={{ width: `${validationWidth}%` }}
      >
        <ValidationSidebar />
      </div>
    </div>
  );

  // Mobile layout - Keep all components mounted to preserve state
  const renderMobileLayout = () => (
    <div className="flex-1 flex flex-col min-h-0">
      {renderMobileNavigation()}

      <div className="flex-1 min-h-0 overflow-hidden">
        <div className={`h-full ${activePanel === 'chat' ? 'block' : 'hidden'}`}>
          <ChatInterface />
        </div>
        <div className={`h-full ${activePanel === 'preview' ? 'block' : 'hidden'}`}>
          <DocumentPreview />
        </div>
        <div className={`h-full ${activePanel === 'validation' ? 'block' : 'hidden'}`}>
          <ValidationSidebar />
        </div>
      </div>
    </div>
  );

  // Calculate save status text
  const getSaveStatusText = () => {
    if (isSaving) return 'Saving...';
    if (hasUnsavedChanges) return 'Unsaved changes';
    if (lastSaved) {
      const timeAgo = Math.floor((Date.now() - new Date(lastSaved).getTime()) / 1000);
      if (timeAgo < 60) return 'Saved just now';
      if (timeAgo < 3600) return `Saved ${Math.floor(timeAgo / 60)}m ago`;
      return `Saved ${Math.floor(timeAgo / 3600)}h ago`;
    }
    return '';
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm border-b px-3 sm:px-6 py-3 sm:py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center min-w-0">
            <button
              onClick={onBack}
              className="mr-2 sm:mr-4 p-2 text-gray-500 hover:text-gray-700 rounded-lg transition-colors flex-shrink-0"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center min-w-0">
              {isDivorcePackage || currentDocument.documentType === 'divorce_petition' || currentDocument.documentType === 'divorce_decree' ? (
                <Scale className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600 mr-2 flex-shrink-0" />
              ) : (
                <Gavel className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 mr-2 flex-shrink-0" />
              )}
              <h1 className="text-base sm:text-xl font-semibold truncate">
                {isDivorcePackage || currentDocument.documentType === 'divorce_petition' || currentDocument.documentType === 'divorce_decree'
                  ? (isNew ? 'New Divorce Package' : 'Edit Divorce Package')
                  : (isNew ? 'New Affidavit' : 'Edit Affidavit')}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            {/* Save status - hidden on very small screens */}
            <div className="hidden sm:block text-sm text-gray-600">
              {getSaveStatusText()}
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-1 sm:gap-2">
              <button
                onClick={handleSaveProgress}
                disabled={isSaving || justSaved || !isAuthenticated}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                <Save className="h-4 w-4" />
                <span className="hidden sm:inline">{isSaving ? 'Saving...' : justSaved ? 'Saved' : 'Save'}</span>
              </button>

              {firmMode && (
                <button
                  onClick={handleSendToLawyer}
                  disabled={!currentDocument.documentId || firmSubmitStatus === 'sending' || !isAuthenticated}
                  className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                  title={`Send this draft to ${firmName || 'your law firm'} for review`}
                >
                  <Send className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {firmSubmitStatus === 'sending' ? 'Sending...' : firmSubmitStatus === 'sent' ? 'Sent' : 'Send to My Lawyer'}
                  </span>
                </button>
              )}

              <button
                onClick={handleDownload}
                disabled={!currentDocument.documentId || isCheckingPayment}
                className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">{isCheckingPayment ? 'Checking...' : (() => {
                  if (currentDocument.documentType !== 'divorce_package') return 'Download PDF';
                  const LABELS = {
                    divorce_petition: 'Download Petition', petition_dissolution: 'Download Petition',
                    divorce_decree: 'Download Decree', judgment_dissolution: 'Download Decree',
                    final_judgment: 'Download Judgment', proposed_judgment: 'Download Proposed Judgment',
                    waiver_of_service: 'Download Waiver', acknowledgment_of_service: 'Download Acknowledgment',
                    acknowledgment_of_receipt: 'Download Acknowledgment', cert_last_known_address: 'Download Certificate',
                    prove_up_affidavit: 'Download Prove-Up', military_status_affidavit: 'Download Military Affidavit',
                    indigency_affidavit: 'Download Indigency Affidavit', parenting_plan: 'Download Parenting Plan',
                    child_support_worksheet: 'Download Worksheet', child_support_order: 'Download Support Order',
                    spousal_support_order: 'Download Support Order', child_custody_order: 'Download Custody Order',
                    summons_with_notice: 'Download Summons', verified_complaint: 'Download Complaint',
                  };
                  return LABELS[currentDocument.activeSubDocument] || 'Download Document';
                })()}</span>
              </button>
            </div>
          </div>
        </div>
        
        {/* Firm submission status */}
        {firmMode && firmSubmitMessage && (
          <div
            className={`mt-2 text-xs sm:text-sm font-medium ${
              firmSubmitStatus === 'error' ? 'text-red-600' : 'text-green-700'
            }`}
          >
            {firmSubmitMessage}
          </div>
        )}

        {/* Document info bar */}
        <div className="mt-2 sm:mt-3 flex flex-wrap items-center gap-3 sm:gap-6 text-xs sm:text-sm text-gray-600">
          <div className="flex items-center gap-2 min-w-0">
            <span className="hidden sm:inline">Document:</span>
            <span className="font-medium truncate">
              {currentDocument.affiantName || 'Unnamed'}{currentDocument.state && ` - ${currentDocument.state}`}
            </span>
          </div>

          {currentDocument.facts?.length > 0 && (
            <div className="flex items-center gap-2">
              <span>Facts:</span>
              <span className="font-medium">{currentDocument.facts.length}</span>
            </div>
          )}

          {preview?.metadata?.estimatedPages && (
            <div className="flex items-center gap-2">
              <span>Pages:</span>
              <span className="font-medium">{preview.metadata.estimatedPages}</span>
            </div>
          )}

          {/* Current document ID (for debugging) */}
          {!isMobileView && documentId && (
            <div className="text-xs text-gray-400 ml-auto hidden lg:block">
              Doc ID: {documentId} | Layout: {Math.round(chatWidth)}% | {Math.round(previewWidth)}% | {Math.round(validationWidth)}%
            </div>
          )}
        </div>
      </header>

      {/* Main content area */}
      {isMobileView ? renderMobileLayout() : renderDesktopLayout()}

      {/* Payment Modal */}
      <PaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        affidavitData={currentDocument}
        onPaymentSuccess={handlePaymentSuccess}
        documentId={currentDocument.documentId}
        documentType={
          currentDocument.documentType === 'divorce_petition' || currentDocument.documentType === 'divorce_decree'
            ? 'divorce_package'
            : 'single_affidavit'
        }
      />
    </div>
  );
};

export default EditorView;
