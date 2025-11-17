// Evidence Upload Modal Component
import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, FileText, File, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { useAuth0 } from '@auth0/auth0-react';

/**
 * Modal for uploading evidence files
 * Supports PDF, JPG, PNG up to 25MB
 */
const EvidenceUploadModal = ({
  isOpen,
  onClose,
  onUploadSuccess,
  evidence,
  documentId
}) => {
  const { getAccessTokenSilently } = useAuth0();
  const fileInputRef = useRef(null);

  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  // Reset modal state when it opens/closes
  useEffect(() => {
    if (!isOpen) {
      // Reset when closing
      setSelectedFile(null);
      setError(null);
      setDragActive(false);
    }
  }, [isOpen]);

  const ALLOWED_TYPES = {
    'application/pdf': { ext: 'PDF', icon: FileText },
    'image/jpeg': { ext: 'JPG', icon: File },
    'image/png': { ext: 'PNG', icon: File }
  };

  const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

  const handleFileSelect = (file) => {
    setError(null);

    // Validate file type
    if (!ALLOWED_TYPES[file.type]) {
      setError('Invalid file type. Please upload a PDF, JPG, or PNG file.');
      return;
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      setError(`File is too large. Maximum size is 25MB.`);
      return;
    }

    setSelectedFile(file);
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleUpload = async () => {
    console.log('🔼 Upload initiated:', {
      hasFile: !!selectedFile,
      hasEvidence: !!evidence,
      hasDocId: !!documentId,
      evidenceId: evidence?.id,
      fileName: selectedFile?.name
    });

    if (!selectedFile || !evidence || !documentId) {
      console.error('❌ Upload validation failed:', {
        selectedFile: !!selectedFile,
        evidence: !!evidence,
        documentId: !!documentId
      });
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const token = await getAccessTokenSilently();

      const formData = new FormData();
      formData.append('evidence', selectedFile);
      formData.append('documentId', documentId);
      formData.append('evidenceId', evidence.id || Date.now().toString());
      formData.append('description', evidence.evidenceData?.description || '');

      console.log('📤 Uploading to /api/evidence/upload...');

      const response = await fetch('/api/evidence/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();

      console.log('📥 Upload response:', { ok: response.ok, status: response.status, data });

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      // Success!
      console.log('✅ Upload successful, calling onUploadSuccess');

      onUploadSuccess({
        ...evidence,
        evidenceData: {
          ...evidence.evidenceData,
          fileName: data.evidence.fileName,
          fileKey: data.evidence.fileKey,
          fileType: data.evidence.fileType,
          fileSizeBytes: data.evidence.fileSizeBytes,
          filePages: data.evidence.filePages,
          thumbnailKey: data.evidence.thumbnailKey,
          uploadedAt: data.evidence.uploadedAt,
          requiresUpload: false
        }
      });

      onClose();
    } catch (err) {
      console.error('❌ Upload error:', err);
      setError(err.message || 'Failed to upload evidence. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!isOpen) return null;

  const FileIcon = (selectedFile && ALLOWED_TYPES[selectedFile.type]?.icon) || FileText;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Upload Evidence
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Evidence Description */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Evidence Description
            </label>
            <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
              {evidence?.evidenceData?.description || 'No description provided'}
            </p>
          </div>

          {/* File Upload Area */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select File
            </label>

            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                dragActive
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileInputChange}
              />

              {selectedFile ? (
                <div className="flex flex-col items-center">
                  <FileIcon className="h-12 w-12 text-blue-600 mb-2" />
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    {selectedFile.name}
                  </p>
                  <p className="text-xs text-gray-500 mb-2">
                    {formatFileSize(selectedFile.size)}
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                      setError(null);
                    }}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    Choose different file
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  <Upload className="h-12 w-12 text-gray-400 mb-2" />
                  <p className="text-sm font-medium text-gray-900 mb-1">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-xs text-gray-500">
                    PDF, JPG, or PNG (max 25MB)
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start">
              <AlertCircle className="h-5 w-5 text-red-600 mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {/* Success Indicator */}
          {!uploading && !error && selectedFile && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-start">
              <CheckCircle className="h-5 w-5 text-green-600 mr-2 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-800">
                File ready to upload. Click "Upload" to proceed.
              </p>
            </div>
          )}

          {/* File Type Info */}
          <div className="text-xs text-gray-500 mb-4">
            <p className="font-medium mb-1">Supported file types:</p>
            <ul className="list-disc list-inside space-y-0.5">
              <li>PDF documents (.pdf)</li>
              <li>JPEG images (.jpg, .jpeg)</li>
              <li>PNG images (.png)</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            disabled={uploading}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EvidenceUploadModal;
