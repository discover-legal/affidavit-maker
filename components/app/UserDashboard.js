'use client';

// client/src/components/UserDashboard.js
import React, { useState, useEffect } from 'react';
import { useAuth0 } from '@/lib/auth0-client';
import { FileText, FileDown, Gavel, Loader2, PlusCircle, Trash2, Edit, Check, X, Heart, Scale, ChevronLeft, Briefcase, ArrowRight, BookOpen, Reply, Send, UserCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import Header from './Header';
import CaseStepper from './CaseStepper';
import { useDocumentList, useUIState, useDocumentActions } from '@/contexts/DocumentContext';
import { computeNextSteps, detectPerspective } from '@/lib/api/procedure';
import { getInitialLang } from '@/lib/i18n';
import { useFirm } from '@/contexts/FirmContext';
import { trackEvent } from '@/lib/utils/analytics';
import ConfirmDialog from './ConfirmDialog';
import { formatPrice } from '@/lib/pricing';

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
  handleFilingPacket, packetDownloadingId, packetErrorId, packetUnavailable,
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
              <button
                type="button"
                className="text-left text-base font-semibold text-blue-700 truncate cursor-pointer hover:underline"
                title="Click to rename"
                onClick={() => startRename(doc)}
              >
                {displayTitle}
              </button>
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
          {!packetUnavailable && (
            <button
              onClick={() => handleFilingPacket(doc)}
              disabled={packetDownloadingId === doc.id}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded-lg hover:border-blue-300 hover:text-blue-700 font-semibold transition-colors disabled:opacity-60"
              title="Download a ready-to-file PDF packet of this document"
            >
              {packetDownloadingId === doc.id
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <FileDown className="h-4 w-4" />}
              <span className="hidden sm:inline">Filing packet</span>
            </button>
          )}
          <button
            onClick={() => handleContinueDocument(doc)}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors"
          >
            {doc.status === 'completed' ? 'View' : 'Continue'}
          </button>
        </div>
      </div>
      {packetErrorId === doc.id && (
        <p className="mt-2 text-right text-xs text-red-600">
          The filing packet couldn’t be prepared. Please try again.
        </p>
      )}
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
  const [pendingDeleteId, setPendingDeleteId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [notice, setNotice] = useState(null);

  // New document creation flow: null → 'caseType' → 'documentType'
  // Persist case type so the user doesn't re-pick every time
  const [newDocStep, setNewDocStep] = useState(null);
  const [selectedCaseType, setSelectedCaseType] = useState(() => {
    try { return localStorage.getItem('preferredCaseType') || null; } catch { return null; }
  });

  // Cases loaded from /api/cases
  const [cases, setCases] = useState([]);
  const [isCasesLoading, setIsCasesLoading] = useState(false);

  // Case stepper data — both fetches are enhancements: any failure just
  // means no stepper (and no respond button), never an error state.
  const [profile, setProfile] = useState(null);
  const [procedure, setProcedure] = useState(null);
  const [stepperLang, setStepperLang] = useState('en');

  // Filing packet downloads (POST /api/documents/packet). A 404/501 means
  // the endpoint isn't live yet — hide the buttons instead of erroring.
  const [packetDownloadingId, setPacketDownloadingId] = useState(null);
  const [packetErrorId, setPacketErrorId] = useState(null);
  const [packetUnavailable, setPacketUnavailable] = useState(false);

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

  // Life-story profile + state procedure → the visual case stepper.
  useEffect(() => {
    setStepperLang(getInitialLang());
    let cancelled = false;
    (async () => {
      try {
        const profileRes = await fetch(`${API_BASE}/api/profile`);
        if (!profileRes.ok) return;
        const profileJson = await profileRes.json();
        if (cancelled || !profileJson?.success) return;
        const p = profileJson.data?.profile || {};
        setProfile(p);

        const state = (typeof p.state === 'string' && p.state.trim())
          ? p.state.trim().toUpperCase()
          : 'UT';
        const procRes = await fetch(`${API_BASE}/api/procedure/${encodeURIComponent(state)}`);
        if (!procRes.ok) return;
        const procJson = await procRes.json();
        if (cancelled || !procJson?.success || !procJson.data || typeof procJson.data !== 'object') return;
        // The route may return the procedure directly or wrapped as { procedure }.
        const raw = procJson.data;
        setProcedure(raw.procedure && typeof raw.procedure === 'object' ? raw.procedure : raw);
      } catch {
        // Stepper is an enhancement — no profile or procedure, no stepper.
      }
    })();
    return () => { cancelled = true; };
  }, []);

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

  // Deleting is a two-step flow: the row button only records intent, the
  // accessible ConfirmDialog performs the destructive action.
  const handleDeleteDocument = async (docId) => {
    setPendingDeleteId(docId);
  };

  const confirmDeleteDocument = async () => {
    const docId = pendingDeleteId;
    if (!docId) return;
    setIsDeleting(true);
    setNotice(null);
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
        setPendingDeleteId(null);
        setNotice({ type: 'success', message: 'Document deleted.' });
      } else {
        const errData = await response.json();
        console.error('❌ Delete failed:', errData);
        setNotice({ type: 'error', message: `Could not delete the document: ${errData.error || 'Please try again.'}` });
      }
    } catch (error) {
      console.error('❌ Delete failed:', error);
      setNotice({ type: 'error', message: `Could not delete the document: ${error.message}` });
    } finally {
      setIsDeleting(false);
    }
  };

  // Download a ready-to-file PDF packet for a saved document.
  const handleFilingPacket = async (doc) => {
    setPacketDownloadingId(doc.id);
    setPacketErrorId(null);
    try {
      const response = await fetch(`${API_BASE}/api/documents/packet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId: doc.id }),
      });
      if (response.status === 404 || response.status === 501) {
        // Endpoint not deployed yet — quietly retire the buttons.
        setPacketUnavailable(true);
        return;
      }
      if (!response.ok) throw new Error(`Packet request failed (${response.status})`);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `filing-packet-${doc.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      trackEvent('filing_packet_downloaded', { document_id: doc.id });
    } catch (error) {
      console.error('Filing packet download failed:', error);
      setPacketErrorId(doc.id);
      setTimeout(() => setPacketErrorId((id) => (id === doc.id ? null : id)), 4000);
    } finally {
      setPacketDownloadingId((id) => (id === doc.id ? null : id));
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
        setNotice({ type: 'error', message: `Could not rename the document: ${errData.details ? errData.details[0].message : errData.error}` });
      }
    } catch (error) {
      console.error('Rename error:', error);
      setNotice({ type: 'error', message: 'Could not rename the document. Please try again.' });
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

  // Stepper + respond button, derived from the fetched profile/procedure.
  // The stepper only appears once the case has some substance (key events
  // from ingested papers, or at least one saved document).
  const isRespondent = profile ? detectPerspective(profile) === 'respondent' : false;
  const hasCaseActivity = Boolean(
    profile &&
    ((Array.isArray(profile.keyEvents) && profile.keyEvents.length > 0) || documents.length > 0)
  );
  let caseSteps = [];
  if (profile && procedure && hasCaseActivity) {
    try {
      caseSteps = computeNextSteps(profile, procedure);
    } catch {
      caseSteps = [];
    }
  }

  // Case-backed documents are already rendered inside their case cards. Keep the
  // legacy list from rendering those records a second time.
  const standaloneDocuments = documents.filter((doc) => !doc.case_id);

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
      <ConfirmDialog
        open={pendingDeleteId !== null}
        title="Delete document?"
        message="This permanently deletes the document and cannot be undone."
        confirmLabel="Delete document"
        destructive
        busy={isDeleting}
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={confirmDeleteDocument}
      />
      <Header
        currentView="dashboard"
        onBackToDashboard={handleBackToDashboard}
      />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
      {notice && (
        <div
          role={notice.type === 'error' ? 'alert' : 'status'}
          aria-live="polite"
          className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
            notice.type === 'error'
              ? 'border-red-200 bg-red-50 text-red-800'
              : 'border-green-200 bg-green-50 text-green-800'
          }`}
        >
          <div className="flex items-center justify-between gap-4">
            <span>{notice.message}</span>
            <button type="button" onClick={() => setNotice(null)} className="font-medium underline">Dismiss</button>
          </div>
        </div>
      )}
      <div className="mb-6 sm:mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Dashboard</h1>
          <p className="text-sm sm:text-base text-gray-600">Create new documents or continue working on your drafts.</p>
        </div>
        {newDocStep === null && (
          <div className="flex items-center gap-2 flex-wrap justify-end">
            {firmMode && (
              <button
                onClick={() => navigate('/legal-profile')}
                className="flex items-center gap-2 px-4 py-2 border border-blue-600 text-blue-700 rounded-lg hover:bg-blue-50 transition-colors font-semibold text-sm"
                title={`Your legal profile with ${firmName || 'your law firm'}`}
              >
                <UserCircle className="h-4 w-4" />
                My Legal Profile
              </button>
            )}
            {isRespondent && (
              <button
                onClick={() => navigate('/respond')}
                className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-semibold text-sm"
                title="Answer the papers you were served"
              >
                <Reply className="h-4 w-4" />
                <span className="hidden sm:inline">Respond to the papers</span>
                <span className="sm:hidden">Respond</span>
              </button>
            )}
            <button
              onClick={() => navigate('/profile')}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:border-blue-300 hover:text-blue-700 transition-colors font-semibold text-sm"
              title="What your assistant remembers about you"
            >
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Your life story</span>
              <span className="sm:hidden">Story</span>
            </button>
            <button
              onClick={() => navigate('/serve')}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:border-blue-300 hover:text-blue-700 transition-colors font-semibold text-sm"
              title="How to serve your papers on the other party"
            >
              <Send className="h-4 w-4" />
              <span className="hidden sm:inline">Serve the papers</span>
              <span className="sm:hidden">Serve</span>
            </button>
            <button
              onClick={() => navigate('/hearing')}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:border-blue-300 hover:text-blue-700 transition-colors font-semibold text-sm"
              title="How to prepare for your day in court"
            >
              <Gavel className="h-4 w-4" />
              <span className="hidden sm:inline">Your day in court</span>
              <span className="sm:hidden">Hearing</span>
            </button>
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
          </div>
        )}
      </div>

      {/* Where the case is — visual stepper from the life-story profile. */}
      {caseSteps.length > 0 && (
        <div className="mb-8 bg-white rounded-lg shadow-sm border p-5 sm:p-6">
          <CaseStepper
            steps={caseSteps}
            perspective={isRespondent ? 'respondent' : 'petitioner'}
            lang={stepperLang}
          />
        </div>
      )}

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
                <p className="text-sm text-gray-500 mt-1">Affidavit drafts and guided divorce petition/decree drafts.</p>
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
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                    {formatPrice('us', 'single_affidavit')}
                  </span>
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
                  <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">
                    {formatPrice('us', 'divorce_package')}
                  </span>
                </div>
                <h4 className="font-semibold text-gray-900 mb-1">Divorce Package</h4>
                <p className="text-sm text-gray-600">A guided divorce interview that prepares petition and proposed decree drafts tailored to your jurisdiction.</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {['Petition', 'Proposed Decree'].map(tag => (
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
                        handleFilingPacket={handleFilingPacket}
                        packetDownloadingId={packetDownloadingId}
                        packetErrorId={packetErrorId}
                        packetUnavailable={packetUnavailable}
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
            {standaloneDocuments.length === 0
              ? 'No standalone documents'
              : `${standaloneDocuments.length} document${standaloneDocuments.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {standaloneDocuments.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 mb-4">
              {cases.length > 0
                ? 'All your documents are organized in cases above.'
                : "You haven't created any documents yet."}
            </p>
            {cases.length === 0 && (
            <button
              onClick={() => setNewDocStep(selectedCaseType ? 'documentType' : 'caseType')}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Your First Document
            </button>
            )}
          </div>
        ) : (
          <ul className="divide-y">
            {standaloneDocuments.map((doc) => (
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
                handleFilingPacket={handleFilingPacket}
                packetDownloadingId={packetDownloadingId}
                packetErrorId={packetErrorId}
                packetUnavailable={packetUnavailable}
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
