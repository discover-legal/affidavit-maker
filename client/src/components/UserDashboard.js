import React, { useState, useEffect, useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { 
    PlusCircle, Loader2, FileText, AlertTriangle, Trash2, Edit, Check, X,
    AlertCircle, Scale // Added AlertCircle and Scale for card icons
} from 'lucide-react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const UserDashboard = ({ onNewDocument, onContinueDocument }) => {
  const { getAccessTokenSilently, isLoading, isAuthenticated, loginWithRedirect } = useAuth0();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // State for the new inline rename functionality
  const [renamingDocId, setRenamingDocId] = useState(null);
  const [newName, setNewName] = useState('');

  const fetchDocuments = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const token = await getAccessTokenSilently();
      const response = await fetch(`${API_BASE}/api/documents`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch documents.');
      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (err) {
      if (err.error === 'login_required') loginWithRedirect();
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [getAccessTokenSilently, isAuthenticated, loginWithRedirect]);

  useEffect(() => {
    if (isAuthenticated && !isLoading) {
      fetchDocuments();
    } else if (!isLoading && !isAuthenticated) {
        loginWithRedirect();
    }
  }, [isAuthenticated, isLoading, fetchDocuments, loginWithRedirect]);

  const handleDelete = async (docId) => {
    if (!window.confirm('Are you sure you want to permanently delete this affidavit?')) return;
    try {
      const token = await getAccessTokenSilently();
      const response = await fetch(`${API_BASE}/api/documents/${docId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setDocuments(prev => prev.filter(doc => doc.id !== docId));
      } else {
        alert('Failed to delete document.');
      }
    } catch (error) {
      console.error('Delete error:', error);
    }
  };

  // --- New Inline Rename Functions ---

  const startRename = (doc) => {
    setRenamingDocId(doc.id);
    setNewName(doc.affiantName || '');
  };

  const cancelRename = () => {
    setRenamingDocId(null);
    setNewName('');
  };

  const submitRename = async (docId) => {
    if (!newName || newName.trim() === '') return;
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
        fetchDocuments(); // Refresh list on success
        cancelRename();   // Exit editing mode
      } else {
        alert('Failed to rename document.');
      }
    } catch (error) {
      console.error('Rename error:', error);
    }
  };
  // --- End New Inline Rename Functions ---

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'paid': return 'bg-blue-100 text-blue-800';
      case 'draft': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading || isLoading) {
    return (
      <div className="text-center p-10">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
        <p className="mt-4 text-gray-600">Loading your dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-10">
        <AlertCircle className="h-8 w-8 mx-auto text-red-500" />
        <p className="mt-4 text-red-700">Error: {error}</p>
      </div>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h2>
            <p className="text-gray-600">Create new affidavits or continue working on your drafts.</p>
        </div>

        {/* --- Feature Cards (for improved look and feel) --- */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {/* Main Action Card */}
            <div className="bg-white rounded-lg shadow-sm border p-6 flex flex-col justify-between">
                <div>
                    <div className="flex items-center justify-between mb-4">
                        <FileText className="h-8 w-8 text-blue-600" />
                        <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">Start Here</span>
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-2">Create New Affidavit</h3>
                    <p className="text-sm text-gray-600">Our AI assistant will guide you through the entire process, ensuring state-specific compliance.</p>
                </div>
                <button onClick={onNewDocument} className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center font-semibold">
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Get Started
                </button>
            </div>
            {/* Coming Soon Cards */}
            <div className="bg-white rounded-lg shadow-sm border border-dashed p-6 opacity-70">
                <div className="flex items-center justify-between mb-4">
                    <Scale className="h-8 w-8 text-gray-400" />
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">Coming Soon</span>
                </div>
                <h3 className="font-semibold text-gray-600 mb-2">Document Templates</h3>
                <p className="text-sm text-gray-500">Access a library of pre-filled forms for various family law matters to save even more time.</p>
            </div>
            <div className="bg-white rounded-lg shadow-sm border border-dashed p-6 opacity-70">
                <div className="flex items-center justify-between mb-4">
                    <FileText className="h-8 w-8 text-gray-400" />
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">Coming Soon</span>
                </div>
                <h3 className="font-semibold text-gray-600 mb-2">Smart Forms</h3>
                <p className="text-sm text-gray-500">Automatically fill information from previous documents and track cases with multi-document suites.</p>
            </div>
        </div>

        {/* --- Document List --- */}
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Your Documents</h2>
        {documents.length === 0 ? (
            <div className="text-center bg-white border-2 border-dashed rounded-lg p-12">
                <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-medium text-gray-900">Your saved documents will appear here.</h3>
            </div>
        ) : (
            <div className="bg-white shadow-sm border rounded-lg">
                <ul className="divide-y divide-gray-200">
                    {documents.map((doc) => (
                        <li key={doc.id} className="p-4 sm:p-6 hover:bg-gray-50 transition-colors">
                            <div className="flex items-center justify-between space-x-4">
                                <div className="flex-grow min-w-0">
                                    {renamingDocId === doc.id ? (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={newName}
                                                onChange={(e) => setNewName(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && submitRename(doc.id)}
                                                className="block w-full px-3 py-1.5 text-base font-semibold text-gray-900 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
                                                autoFocus
                                            />
                                            <button onClick={() => submitRename(doc.id)} className="p-2 text-green-600 hover:text-green-800"><Check className="h-5 w-5"/></button>
                                            <button onClick={cancelRename} className="p-2 text-red-600 hover:text-red-800"><X className="h-5 w-5"/></button>
                                        </div>
                                    ) : (
                                        <h4 className="text-lg font-semibold text-blue-700 truncate" title={doc.affiantName || `Affidavit #${doc.id}`}>
                                            {doc.affiantName ? `${doc.affiantName}'s Affidavit` : `Affidavit #${doc.id}`}
                                        </h4>
                                    )}
                                    <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                                        <span>State: <span className='font-medium'>{doc.state || 'N/A'}</span></span>
                                        <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusColor(doc.status)}`}>{doc.status}</span>
                                        {doc.validation && !doc.validation.isValid && (
                                            <div className="flex items-center text-red-600">
                                                <AlertTriangle className="h-4 w-4 mr-1" />
                                                <span className="text-xs font-medium">Needs attention</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center space-x-2 md:space-x-4 flex-shrink-0">
                                    <button onClick={() => startRename(doc)} className="p-2 text-gray-500 hover:text-blue-600" title="Rename"><Edit className="h-5 w-5" /></button>
                                    <button onClick={() => handleDelete(doc.id)} className="p-2 text-gray-500 hover:text-red-600" title="Delete"><Trash2 className="h-5 w-5" /></button>
                                    <button
                                      onClick={() => onContinueDocument(doc)}
                                      className="px-4 py-2 text-sm bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200 font-semibold"
                                    >
                                      {doc.status === 'completed' ? 'View' : 'Continue'}
                                    </button>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        )}
    </main>
  );
};

export default UserDashboard;