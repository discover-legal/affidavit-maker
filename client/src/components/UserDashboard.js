import React, { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { PlusCircle, Loader2, FileText, AlertCircle } from 'lucide-react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';

const UserDashboard = ({ onNewDocument, onContinueDocument }) => {
  const { getAccessTokenSilently, isLoading, isAuthenticated } = useAuth0();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchDocuments = async () => {
      if (!isAuthenticated) {
        return;
      }
      try {
        const token = await getAccessTokenSilently();
        const response = await fetch(`${API_BASE}/api/documents`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch documents.');
        }

        const data = await response.json();
        setDocuments(data.documents || []);
      } catch (err) {
        setError(err.message);
        console.error("Fetch documents error:", err);
      } finally {
        setLoading(false);
      }
    };

    if (!isLoading) {
      fetchDocuments();
    }
  }, [getAccessTokenSilently, isLoading, isAuthenticated]);

  if (loading) {
    return (
      <div className="text-center p-10">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
        <p className="mt-4 text-gray-600">Loading your documents...</p>
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Your Documents</h1>
        <button
          onClick={onNewDocument}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
        >
          <PlusCircle className="h-5 w-5 mr-2" />
          New Affidavit
        </button>
      </div>

      {documents.length === 0 ? (
        <div className="text-center bg-white border rounded-lg p-12">
          <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No documents yet</h3>
          <p className="text-gray-500 mt-1">
            Click "New Affidavit" to get started.
          </p>
        </div>
      ) : (
        <div className="bg-white shadow-sm border rounded-lg">
          <ul className="divide-y divide-gray-200">
            {documents.map((doc) => (
              <li key={doc.id} className="p-4 sm:p-6 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-semibold text-blue-700">
                      {doc.affiantName || `Affidavit for ${doc.state}`}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      State: {doc.state || 'N/A'} | Status: <span className="font-medium capitalize">{doc.status}</span>
                    </p>
                     <p className="text-xs text-gray-400 mt-2">
                      Last updated: {new Date(doc.updated_at).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => onContinueDocument(doc)}
                    className="px-4 py-2 text-sm bg-gray-100 text-gray-800 rounded-lg hover:bg-gray-200"
                  >
                    {doc.status === 'draft' ? 'Continue Draft' : 'View'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default UserDashboard;