// client/src/views/EditorView.js - FIXED VERSION WITH PAYMENT
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { ArrowLeft, Gavel, Save, Download, MessageSquare, Eye, Settings, GripVertical } from 'lucide-react';
import { useAuth0 } from '@auth0/auth0-react';
import { useDocumentState, useDocumentActions } from '../contexts/DocumentContext';
import ChatInterface from '../components/ChatInterface';
import DocumentPreview from '../components/DocumentPreview';
import ValidationSidebar from '../components/ValidationSidebar';
import PaymentModal from '../components/PaymentModal';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

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
  const { documentId } = useParams(); // ✅ Get documentId from URL

  // ✅ FIX: Track if initialization was done for a specific documentId
  // This prevents multiple initializations due to dependency changes
  const initializationDone = React.useRef(false);
  const lastDocumentId = React.useRef(null);

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

  // Use DocumentContext for all document-related state
  const {
    currentDocument,
    preview,
    isSaving,
    lastSaved,
    hasUnsavedChanges,
    sessionInitialized,
    justSaved
  } = useDocumentState();
  
  const {
    saveDocument,
    loadDocument,
    initializeNewDocument
  } = useDocumentActions();

  // Check for mobile view
  useEffect(() => {
    const checkMobileView = () => {
      setIsMobileView(window.innerWidth < 768);
    };

    checkMobileView();
    window.addEventListener('resize', checkMobileView);
    return () => window.removeEventListener('resize', checkMobileView);
  }, []);

  // Check payment status for a document
  const checkPaymentStatus = useCallback(async (docId) => {
    try {
      setIsCheckingPayment(true);
      const token = await getAccessTokenSilently();

      const response = await fetch(`${API_BASE_URL}/api/documents/${docId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
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
  }, [currentDocument.documentId, isAuthenticated, isNew, checkPaymentStatus, setIsPaidDocument]);

  // ✅ FIXED: Properly handle document loading and switching
  useEffect(() => {
    console.log('📂 Loading document from URL:', documentId, 'isNew:', isNew);

    // ✅ FIX: Check if documentId has changed
    const hasDocumentIdChanged = lastDocumentId.current !== documentId;

    if (hasDocumentIdChanged) {
      // DocumentId changed - reset initialization flag
      console.log('📂 Document ID changed from', lastDocumentId.current, 'to', documentId);
      initializationDone.current = false;
      lastDocumentId.current = documentId;
    }

    // Initialize session based on route
    const initializeSession = async () => {
      // ✅ FIX: Prevent multiple initializations for the same documentId
      if (initializationDone.current) {
        console.log('✅ Initialization already done for this document, skipping');
        return;
      }

      if (isNew) {
        // ✅ For new documents, initialize with forceNew=true
        // This atomically resets state and creates a new document
        // Mark as done BEFORE async operations to prevent duplicate calls
        initializationDone.current = true;

        try {
          // forceNew=true handles both reset and creation in one atomic operation
          await initializeNewDocument(true);
        } catch (err) {
          console.error('Failed to initialize new document on server:', err);
          // Reset flag on error so user can retry
          initializationDone.current = false;
        }
      } else if (documentId && isAuthenticated) {
        // Loading existing document from URL
        // Only load if not already initialized with this specific document
        if (sessionInitialized && currentDocument.documentId === documentId) {
          console.log('✅ Document already loaded:', documentId);
          initializationDone.current = true;
          return;
        }

        // Mark as done BEFORE async operations to prevent duplicate calls
        initializationDone.current = true;

        console.log('📂 Loading existing document:', documentId);
        try {
          await loadDocument(documentId);
          console.log('✅ Document loaded:', documentId);
        } catch (error) {
          console.error('❌ Failed to load document:', error);
          // Reset flag on error so user can retry
          initializationDone.current = false;
        }
      }
    };

    initializeSession();

    // ✅ FIX: Only cleanup when component unmounts, not on every dependency change
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

      const token = await getAccessTokenSilently();

      const response = await fetch(`${API_BASE_URL}/api/documents/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
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

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `affidavit-${currentDocument.affiantName?.replace(/[^a-zA-Z0-9]/g, '_') || 'document'}.pdf`;
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
    <div className="flex border-b bg-white">
      <button
        onClick={() => setActivePanel('chat')}
        className={`flex-1 py-4 px-1 border-b-2 font-medium text-sm ${
          activePanel === 'chat'
            ? 'border-blue-600 text-blue-600'
            : 'border-transparent text-gray-600 hover:text-blue-600'
        }`}
      >
        <MessageSquare className="h-4 w-4 mx-auto mb-1" />
        Chat
      </button>
      <button
        onClick={() => setActivePanel('preview')}
        className={`flex-1 py-4 px-1 border-b-2 font-medium text-sm ${
          activePanel === 'preview'
            ? 'border-blue-600 text-blue-600'
            : 'border-transparent text-gray-600 hover:text-blue-600'
        }`}
      >
        <Eye className="h-4 w-4 mx-auto mb-1" />
        Preview
      </button>
      <button
        onClick={() => setActivePanel('validation')}
        className={`flex-1 py-4 px-1 border-b-2 font-medium text-sm ${
          activePanel === 'validation'
            ? 'border-blue-600 text-blue-600'
            : 'border-transparent text-gray-600 hover:text-blue-600'
        }`}
      >
        <Settings className="h-4 w-4 mx-auto mb-1" />
        Validate
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

  // Mobile layout
  const renderMobileLayout = () => (
    <div className="flex-1 flex flex-col min-h-0">
      {renderMobileNavigation()}
      
      <div className="flex-1 min-h-0 overflow-hidden">
        {activePanel === 'chat' && <ChatInterface />}
        {activePanel === 'preview' && <DocumentPreview />}
        {activePanel === 'validation' && <ValidationSidebar />}
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
      <header className="bg-white shadow-sm border-b px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={onBack}
              className="mr-4 p-2 text-gray-500 hover:text-gray-700 rounded-lg transition-colors"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center">
              <Gavel className="h-6 w-6 text-blue-600 mr-2" />
              <h1 className="text-xl font-semibold">
                {isNew ? 'New Affidavit' : 'Edit Affidavit'}
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Save status */}
            <div className="text-sm text-gray-600">
              {getSaveStatusText()}
            </div>
            
            {/* Action buttons */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleSaveProgress}
                disabled={isSaving || justSaved || !isAuthenticated}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Save className="h-4 w-4" />
                {isSaving ? 'Saving...' : justSaved ? 'Saved' : 'Save'}
              </button>
              
              <button
                onClick={handleDownload}
                disabled={!currentDocument.documentId || isCheckingPayment}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Download className="h-4 w-4" />
                {isCheckingPayment ? 'Checking...' : 'Download PDF'}
              </button>
            </div>
          </div>
        </div>
        
        {/* Document info bar */}
        <div className="mt-3 flex items-center gap-6 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <span>Document:</span>
            <span className="font-medium">
              {currentDocument.affiantName || 'Unnamed'} - {currentDocument.state || 'No state'}
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
              <span>Est. Pages:</span>
              <span className="font-medium">{preview.metadata.estimatedPages}</span>
            </div>
          )}
          
          {/* Current document ID (for debugging) */}
          {!isMobileView && documentId && (
            <div className="text-xs text-gray-400 ml-auto">
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
        documentType="single_affidavit"
      />
    </div>
  );
};

export default EditorView;
