// client/src/components/UserDashboard.js - FIXED VERSION
import React, { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { FileText, Loader2, PlusCircle, Trash2, Edit, Check, X, Heart, Scale } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Header from './Header';
import { useDocumentList, useUIState, useDocumentActions } from '../contexts/DocumentContext';
import { trackEvent } from '../utils/analytics';

// Use relative URLs in production (empty string), localhost in development
const API_BASE = process.env.REACT_APP_API_URL !== undefined
  ? process.env.REACT_APP_API_URL
  : 'http://localhost:3001';

const UserDashboard = ({ onNewDocument, onContinueDocument }) => {
  const { getAccessTokenSilently, isLoading } = useAuth0();
  const navigate = useNavigate();

  // Use split contexts to prevent unnecessary re-renders
  const { documents, isDocumentsLoading } = useDocumentList();
  const { error } = useUIState();
  const { loadDocuments } = useDocumentActions();

  const [renamingDocId, setRenamingDocId] = useState(null);
  const [newName, setNewName] = useState('');
  const [isSubmittingRename, setIsSubmittingRename] = useState(false);

  // Reset scroll position and refresh documents when dashboard loads
  useEffect(() => {
    window.scrollTo(0, 0);
    // Refresh documents list to show any updates from editor
    loadDocuments();
  }, [loadDocuments]);

  // ✅ FIXED: Delete handler now properly uses the hook
  const handleDeleteDocument = async (docId) => {
    if (!window.confirm('Are you sure you want to permanently delete this affidavit?')) return;

    console.log('🗑️ Attempting to delete document:', docId);

    try {
      // ✅ This is correct - calling the hook at component level, not inside nested function
      const token = await getAccessTokenSilently();

      const response = await fetch(`${API_BASE}/api/documents/${docId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
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
    setRenamingDocId(doc.id);
    setNewName(doc.affiantName || `Affidavit #${doc.id}`);
  };

  const cancelRename = () => {
    setRenamingDocId(null);
    setNewName('');
  };

  const submitRename = async (docId) => {
    if (!newName || newName.trim() === '') return;
    setIsSubmittingRename(true);
    try {
      const token = await getAccessTokenSilently();
      const response = await fetch(`${API_BASE}/api/documents/${docId}/rename`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ newName: newName.trim() })
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

  const handleNewDocumentClick = (documentType = 'affidavit') => {
    // Track new document creation
    trackEvent('new_document_clicked', {
      source: 'dashboard',
      document_type: documentType
    });
    onNewDocument(documentType);
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
      <div className="mb-6 sm:mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Dashboard</h2>
        <p className="text-sm sm:text-base text-gray-600">Create new affidavits or continue working on your drafts.</p>
      </div>

      {/* Document Type Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Create New Affidavit */}
        <div className="bg-white rounded-lg shadow-sm border p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between mb-4">
              <FileText className="h-8 w-8 text-blue-600" />
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">$79</span>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Create New Affidavit</h3>
            <p className="text-sm text-gray-600">Our AI assistant will guide you through creating a state-compliant sworn statement. Perfect for court filings, custody matters, and more.</p>
          </div>
          <button
            onClick={() => handleNewDocumentClick('affidavit')}
            className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center font-semibold"
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            Get Started
          </button>
        </div>

        {/* Create Divorce Package */}
        <div className="bg-white rounded-lg shadow-sm border p-6 flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Scale className="h-8 w-8 text-purple-600" />
                <Heart className="h-5 w-5 text-purple-400 -ml-3 mt-3" />
              </div>
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800">$249</span>
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">Create Divorce Package</h3>
            <p className="text-sm text-gray-600">Get both your Divorce Petition and Divorce Decree in one package. Our AI assistant guides you through documenting all required information.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700">
                Petition Included
              </span>
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-50 text-purple-700">
                Decree Included
              </span>
            </div>
          </div>
          <button
            onClick={() => handleNewDocumentClick('divorce_package')}
            className="w-full mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center font-semibold"
          >
            <PlusCircle className="h-4 w-4 mr-2" />
            Get Started
          </button>
        </div>
      </div>

      {/* Existing Documents List */}
      <div className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Your Documents</h3>
          <p className="text-sm text-gray-500 mt-1">
            {documents.length === 0 ? 'No documents yet' : `${documents.length} document${documents.length !== 1 ? 's' : ''}`}
          </p>
        </div>

        {documents.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-gray-300 mb-4" />
            <p className="text-gray-500 mb-4">You haven't created any documents yet</p>
            <button
              onClick={handleNewDocumentClick}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Create Your First Affidavit
            </button>
          </div>
        ) : (
          <ul className="divide-y">
            {documents.map((doc) => (
              <li key={doc.id} className="p-6 hover:bg-gray-50 transition-colors">
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
                        <button
                          onClick={() => submitRename(doc.id)}
                          className="p-2 text-green-600 hover:bg-green-100 rounded-full"
                          disabled={isSubmittingRename}
                        >
                          {isSubmittingRename ? <Loader2 className="h-5 w-5 animate-spin"/> : <Check className="h-5 w-5"/>}
                        </button>
                        <button
                          onClick={cancelRename}
                          className="p-2 text-red-600 hover:bg-red-100 rounded-full"
                          disabled={isSubmittingRename}
                        >
                          <X className="h-5 w-5"/>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <h4
                          className="text-lg font-semibold text-blue-700 truncate cursor-pointer hover:underline"
                          title="Click to edit"
                          onClick={() => startRename(doc)}
                        >
                          {doc.documentTitle || (doc.affiantName ? `${doc.affiantName}'s Affidavit` : (doc.firstName && doc.lastName ? `${doc.firstName} ${doc.lastName}'s Affidavit` : `Affidavit #${doc.id}`))}
                        </h4>
                        {(doc.documentType === 'divorce_petition' || doc.documentType === 'divorce_decree') && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-purple-100 text-purple-700">
                            Divorce Package
                          </span>
                        )}
                      </div>
                    )}
                    <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                      <span>State: <span className='font-medium'>{doc.state || 'N/A'}</span></span>
                      <span>Facts: <span className='font-medium'>{doc.facts?.length || 0}</span></span>
                      <span className="text-xs text-gray-400">
                        Updated {new Date(doc.updated_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => startRename(doc)}
                      className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      title="Rename"
                      aria-label="Rename document"
                    >
                      <Edit className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteDocument(doc.id)}
                      className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete"
                      aria-label="Delete document"
                    >
                      <Trash2 className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() => handleContinueDocument(doc)}
                      className="px-3 sm:px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold transition-colors min-w-[80px] sm:min-w-[100px]"
                    >
                      {doc.status === 'completed' ? 'View' : 'Continue'}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
    </>
  );
};

export default UserDashboard;
