'use client';

// client/src/components/UserDashboard.js
import React, { useState, useEffect } from 'react';
import { useAuth0 } from '@/lib/auth0-client';
import { FileText, Loader2, PlusCircle, Trash2, Edit, Check, X, Heart, Scale, ChevronLeft, Briefcase, ArrowRight, UserCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Header from './Header';
import { useDocumentList, useUIState, useDocumentActions } from '@/contexts/DocumentContext';
import { useFirm } from '@/contexts/FirmContext';
import { trackEvent } from '@/lib/utils/analytics';

// Use relative URLs in production (empty string), localhost in development
const API_BASE = '';

// Human-readable label for a document's underlying type
const getDocTypeLabel = (docType) => {
  switch (docType) {
    case 'divorce_package': return 'Divorce Package';
    case 'divorce_petition': return 'Divorce Petition';
    case 'divorce_decree': return 'Divorce Decree';
    case 'affidavit':
    case 'general':
    default: return 'Affidavit';
  }
};

// Firm-mode submission status pill styling/labels (unknown statuses render
// as "In review" — the contract treats unknown values as in_review)
const FIRM_STATUS_STYLES = {
  received: 'bg-blue-100 text-blue-700',
  conflict_hold: 'bg-amber-100 text-amber-700',
  in_review: 'bg-indigo-100 text-indigo-700',
  ready: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
};
const FIRM_STATUS_LABELS = {
  received: 'Sent to firm',
  conflict_hold: 'Conflict hold',
  in_review: 'In review',
  ready: 'Ready',
  rejected: 'Declined',
};

// Shared document row used in both the cases view and the standalone list
const DocumentRow = ({
  doc, renamingDocId, newName, setNewName, isSubmittingRename,
  startRename, cancelRename, submitRename, handleDeleteDocument, handleContinueDocument,
  firmSubmission
}) => {
  const docTypeLabel = (doc.document_type || doc.documentType);
  const isDivorce = ['divorce_package', 'divorce_petition', 'divorce_decree'].includes(docTypeLabel);
  const typeName = getDocTypeLabel(docTypeLabel);
  const displayTitle = doc.documentTitle || doc.title ||
    (doc.affiantName
      ? (isDivorce ? `${doc.affiantName} — ${typeName}` : `${doc.affiantName}'s ${typeName}`)
      : `${typeName} #${doc.id}`);

  return (
    <li className="p-5 hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          {renamingDocId === doc.id ? (
            <div className="flex items-center gap-2 mb-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitRename(doc.id);
                  if (e.key === 'Escape') cancelRename();
                }}
                className="flex-1 px-3 py-2 border border-blue-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                autoFocus
                disabled={isSubmittingRename}
              />
              <button onClick={() => submitRename(doc.id)} className="p-2 text-green-600 hover:bg-green-100 rounded-full" disabled={isSubmittingRename}>
                {isSubmittingRename ? <Loader2 className="h-5 w-5 animate-spin"/> : <Check className="h-5 w-5"/>}
              </button>
              <button onClick={cancelRename} className="p-2 text-red-600 hover:bg-red-100 rounded-full" disabled={isSubmittingRename}>
                <X className="h-5 w-5"/>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <h4
                className="text-base font-semibold text-blue-700 truncate cursor-pointer hover:underline"
                title="Click to rename"
                onClick={() => startRename(doc)}
              >
                {displayTitle}
              </h4>
              <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${isDivorce ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                {typeName}
              </span>
              {firmSubmission && (
                <span
                  className={`px-2 py-0.5 text-xs font-medium rounded-full ${FIRM_STATUS_STYLES[firmSubmission.status] || FIRM_STATUS_STYLES.in_review}`}
                  title={firmSubmission.note || 'Firm review status'}
                >
                  {FIRM_STATUS_LABELS[firmSubmission.status] || FIRM_STATUS_LABELS.in_review}
                </span>
              )}
            </div>
          )}
          <div className="flex items-center space-x-3 text-xs text-gray-500 mt-1">
            {doc.state && <span>State: <span className="font-medium">{doc.state}</span></span>}
            {doc.facts?.length > 0 && <span>Facts: <span className="font-medium">{doc.facts.length}</span></span>}
            <span>Updated {new Date(doc.updated_at).toLocaleDateString()}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => startRename(doc)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Rename" aria-label="Rename">
            <Edit className="h-4 w-4" />
          </button>
          <button onClick={() => handleDeleteDocument(doc.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete" aria-label="Delete">
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => handleContinueDocument(doc)}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors"
          >
            {doc.status === 'completed' ? 'View' : 'Continue'}
          </button>
        </div>
      </div>
    </li>
  );
};

const UserDashboard = ({ onNewDocument, onContinueDocument }) => {
  const { getAccessTokenSilently, isLoading } = useAuth0();
  const router = useRouter();
  const navigate = (href) => router.push(href);

  // Use split contexts to prevent unnecessary re-renders
  const { documents, isDocumentsLoading } = useDocumentList();
  const { error } = useUIState();
  const { loadDocuments } = useDocumentActions();

  const [renamingDocId, setRenamingDocId] = useState(null);
  const [newName, setNewName] = useState('');
  const [isSubmittingRename, setIsSubmittingRename] = useState(false);

  // New document creation flow: null → 'caseType' → 'documentType'
  // Persist case type so the user doesn't re-pick every time
  const [newDocStep, setNewDocStep] = useState(null);
  const [selectedCaseType, setSelectedCaseType] = useState(() => {
    try { return localStorage.getItem('preferredCaseType') || null; } catch { return null; }
  });

  // Cases loaded from /api/cases
  const [cases, setCases] = useState([]);
  const [isCasesLoading, setIsCasesLoading] = useState(false);

  // Firm mode: submission status by document id (from /api/firm/submissions)
  const { firmMode, firmName } = useFirm();
  const [firmSubmissions, setFirmSubmissions] = useState({});

  // Reset scroll position and refresh documents when dashboard loads
  useEffect(() => {
    window.scrollTo(0, 0);
    loadDocuments();
    loadCases();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadDocuments]);

  // Load firm submission statuses once when firm mode is active
  useEffect(() => {
    if (!firmMode) return;

    let cancelled = false;
    const loadFirmSubmissions = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/firm/submissions`);
        if (!response.ok) return;
        const data = await response.json();
        if (cancelled) return;
        const byDocumentId = {};
        (data.data?.submissions || []).forEach((submission) => {
          byDocumentId[String(submission.documentId)] = submission;
        });
        setFirmSubmissions(byDocumentId);
      } catch (err) {
        // Firm statuses are an enhancement — fail silently, rows render without pills
      }
    };

    loadFirmSubmissions();
    return () => { cancelled = true; };
  }, [firmMode]);

  const loadCases = async () => {
    setIsCasesLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/cases`);
      if (response.ok) {
        const data = await response.json();
        setCases(data.data?.cases || []);
      }
    } catch (err) {
      // Cases are an enhancement — fail silently, fall back to flat document list
    } finally {
      setIsCasesLoading(false);
    }
  };

  // ✅ FIXED: Delete handler now properly uses the hook
  const handleDeleteDocument = async (docId) => {
    if (!window.confirm('Are you sure you want to permanently delete this document?')) return;

    console.log('🗑️ Attempting to delete document:', docId);

    try {
      const response = await fetch(`${API_BASE}/api/documents/${docId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        console.log('✅ Document deleted successfully:', docId);
        // Track document deletion
        trackEvent('document_deleted', {
          document_id: docId
        });
        // Reload documents from context
        loadDocuments();
      } else {
        const errData = await response.json();
        console.error('❌ Delete failed:', errData);
        alert(`Failed to delete document: ${errData.error}`);
      }
    } catch (error) {
      console.error('❌ Delete failed:', error);
      alert(`Error deleting document: ${error.message}`);
    }
  };

  // Rename handlers
  const startRename = (doc) => {
    const docType = doc.document_type || doc.documentType;
    const typeName = getDocTypeLabel(docType);
    setRenamingDocId(doc.id);
    setNewName(doc.documentTitle || doc.title || doc.affiantName || `${typeName} #${doc.id}`);
  };

  const cancelRename = () => {
    setRenamingDocId(null);
    setNewName('');
  };

  const submitRename = async (docId) => {
    if (!newName || newName.trim() === '') return;
    setIsSubmittingRename(true);
    try {
      const response = await fetch(`${API_BASE}/api/documents/${docId}/rename`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName: newName.trim() }),
      });
      if (response.ok) {
        await loadDocuments();
        cancelRename();
      } else {
        const errData = await response.json();
        alert(`Failed to rename document: ${errData.details ? errData.details[0].message : errData.error}`);
      }
    } catch (error) {
      console.error('Rename error:', error);
      alert('An error occurred. Please try again.');
    } finally {
      setIsSubmittingRename(false);
    }
  };

  const handleContinueDocument = (doc) => {
    console.log('📂 Opening document:', doc.id);
    // Track document open
    trackEvent('document_opened', {
      document_id: doc.id,
      state: doc.state,
      facts_count: doc.facts?.length || 0,
      status: doc.status
    });
    onContinueDocument(doc);
  };

  const handleNewDocumentClick = (documentType = 'affidavit', caseType = 'family') => {
    trackEvent('new_document_clicked', {
      source: 'dashboard',
      document_type: documentType,
      case_type: caseType
    });
    setNewDocStep(null);
    setSelectedCaseType(null);
    onNewDocument(documentType, caseType);
  };

  const handleCaseTypeSelect = (caseType) => {
    setSelectedCaseType(caseType);
    setNewDocStep('documentType');
    try { localStorage.setItem('preferredCaseType', caseType); } catch { /* ignore */ }
  };

  const handleCancelNewDoc = () => {
    setNewDocStep(null);
    // Keep selectedCaseType from localStorage so next open skips to document type
  };

  const handleBackToDashboard = () => {
    // Already on dashboard, navigate to home
    navigate('/');
  };

  if (isDocumentsLoading || isLoading) {
    return (
      <>
        <Header
          currentView="dashboard"
          onBackToDashboard={handleBackToDashboard}
        />
        <div className="text-center p-10">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
          <p className="mt-4 text-gray-600">Loading your dashboard...</p>
        </div>
      </>
    );
  }

  if (error) {
    return (
      <>
        <Header
          currentView="dashboard"
          onBackToDashboard={handleBackToDashboard}
        />
        <div className="text-center p-10">
          <p className="text-red-600 mb-4">Error: {error}</p>
          <button onClick={loadDocuments} className="px-4 py-2 bg-blue-600 text-white rounded-lg">
            Retry
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <Header
        currentView="dashboard"
        onBackToDashboard={handleBackToDashboard}
      />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      <div className="mb-6 sm:mb-8 flex items-center justify-between">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Dashboard</h2>
          <p className="text-sm sm:text-base text-gray-600">Create new documents or continue working on your drafts.</p>
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          {firmMode && (
            <button
              onClick={() => navigate('/profile')}
              className="flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors font-semibold text-sm"
              title={`Your legal profile with ${firmName || 'your law firm'}`}
            >
              <UserCircle className="h-4 w-4" />
              My Legal Profile
            </button>
          )}
          {newDocStep === null && (
            <button
              onClick={() => {
                // Skip case type step if user already has a preference
                if (selectedCaseType) {
                  setNewDocStep('documentType');
                } else {
                  setNewDocStep('caseType');
                }
              }}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold text-sm"
            >
              <PlusCircle className="h-4 w-4" />
              New Document
            </button>
          )}
        </div>
      </div>

      {/* Step 1: Case Type Selection */}
      {newDocStep === 'caseType' && (
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">What type of case is this?</h3>
            <button onClick={handleCancelNewDoc} className="p-1 text-gray-400 hover:text-gray-600 rounded">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Family Law */}
            <button
              onClick={() => handleCaseTypeSelect('family')}
              className="flex items-start gap-4 p-5 border-2 border-gray-200 rounded-lg hover:border-purple-400 hover:bg-purple-50 transition-all text-left group"
            >
              <div className="flex items-center gap-1 mt-0.5">
                <Scale className="h-7 w-7 text-purple-600" />
                <Heart className="h-4 w-4 text-purple-400 -ml-2 mt-3" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-gray-900 group-hover:text-purple-800">Family Law</h4>
                  <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-purple-600" />
                </div>
                <p className="text-sm text-gray-500 mt-1">Divorce, custody, support, and family court filings.</p>
              </div>
            </button>

            {/* Civil Litigation — Coming Soon */}
            <div className="flex items-start gap-4 p-5 border-2 border-gray-100 rounded-lg bg-gray-50 opacity-60 cursor-not-allowed relative">
              <Briefcase className="h-7 w-7 text-gray-400 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-gray-500">Civil Litigation</h4>
                  <span className="text-xs font-medium px-2 py-0.5 bg-gray-200 text-gray-500 rounded-full">Coming Soon</span>
                </div>
                <p className="text-sm text-gray-400 mt-1">Contract disputes, personal injury, small claims, and more.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 2: Document Type Selection (within selected case type) */}
      {newDocStep === 'documentType' && selectedCaseType === 'family' && (
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setNewDocStep('caseType');
                  setSelectedCaseType(null);
                  try { localStorage.removeItem('preferredCaseType'); } catch { /* ignore */ }
                }}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h3 className="text-lg font-semibold text-gray-900">Family Law — Choose your document</h3>
            </div>
            <button onClick={handleCancelNewDoc} className="p-1 text-gray-400 hover:text-gray-600 rounded">
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* General Affidavit */}
            <div className="bg-white rounded-lg border p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <FileText className="h-7 w-7 text-blue-600" />
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">$79</span>
                </div>
                <h4 className="font-semibold text-gray-900 mb-1">General Affidavit</h4>
                <p className="text-sm text-gray-600">A sworn statement of facts for court filings, custody matters, and more. AI-guided interview.</p>
              </div>
              <button
                onClick={() => handleNewDocumentClick('affidavit', 'family')}
                className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center font-semibold text-sm"
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                Get Started
              </button>
            </div>

            {/* Divorce Package */}
            <div className="bg-white rounded-lg border p-5 flex flex-col justify-between hover:shadow-md transition-shadow">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1">
                    <Scale className="h-7 w-7 text-purple-600" />
                    <Heart className="h-4 w-4 text-purple-400 -ml-2 mt-3" />
                  </div>
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">$249</span>
                </div>
                <h4 className="font-semibold text-gray-900 mb-1">Divorce Package</h4>
                <p className="text-sm text-gray-600">Complete divorce filing package tailored to your state or province. AI walks you through the full interview — petition, decree, and all required supporting documents.</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {['Petition', 'Decree', 'Supporting Docs'].map(tag => (
                    <span key={tag} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
              <button
                onClick={() => handleNewDocumentClick('divorce_package', 'family')}
                className="w-full mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center font-semibold text-sm"
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                Get Started
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cases-grouped document list */}
      {!isCasesLoading && cases.length > 0 && (
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">My Cases</h3>
          <div className="space-y-4">
            {cases.map((c) => (
              <div key={c.id} className="bg-white rounded-lg shadow-sm border">
                <div className="px-6 py-4 border-b flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-semibold text-gray-900">
                        {c.title || (c.petitioner_last_name
                          ? `In re: ${c.petitioner_last_name} v. ${c.respondent_last_name || '—'}`
                          : `Case #${c.id}`)}
                      </h4>
                      <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700 capitalize">
                        {c.practice_area === 'family' ? 'Family Law' : c.practice_area}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {[c.court_name, c.county && `${c.county} County`, c.state].filter(Boolean).join(' · ')}
                      {c.cause_number && ` · Cause No. ${c.cause_number}`}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">
                    {c.document_count} doc{c.document_count !== 1 ? 's' : ''}
                  </span>
                </div>
                {c.documents && c.documents.length > 0 ? (
                  <ul className="divide-y">
                    {c.documents.map((doc) => (
                      <DocumentRow
                        key={doc.id}
                        doc={doc}
                        renamingDocId={renamingDocId}
                        newName={newName}
                        setNewName={setNewName}
                        isSubmittingRename={isSubmittingRename}
                        startRename={startRename}
                        cancelRename={cancelRename}
                        submitRename={submitRename}
                        handleDeleteDocument={handleDeleteDocument}
                        handleContinueDocument={handleContinueDocument}
                        firmSubmission={firmSubmissions[String(doc.id)]}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className="px-6 py-3 text-sm text-gray-400">No documents in this case yet.</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Standalone / legacy documents (no case_id) */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">
            {cases.length > 0 ? 'Other Documents' : 'Your Documents'}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {documents.length === 0 ? 'No documents yet' : `${documents.length} document${documents.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {documents.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 mb-4">You haven't created any documents yet</p>
            <button
              onClick={() => setNewDocStep(selectedCaseType ? 'documentType' : 'caseType')}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Your First Document
            </button>
          </div>
        ) : (
          <ul className="divide-y">
            {documents.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                renamingDocId={renamingDocId}
                newName={newName}
                setNewName={setNewName}
                isSubmittingRename={isSubmittingRename}
                startRename={startRename}
                cancelRename={cancelRename}
                submitRename={submitRename}
                handleDeleteDocument={handleDeleteDocument}
                handleContinueDocument={handleContinueDocument}
                firmSubmission={firmSubmissions[String(doc.id)]}
              />
            ))}
          </ul>
        )}
      </div>
    </main>
    </>
  );
};

export default UserDashboard;
