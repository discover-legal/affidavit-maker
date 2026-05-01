// client/src/components/DocumentIngestion.js
// Route: /ingest — Add to App.js inside <TOSGuard> protected routes:
//   <Route path="/ingest" element={<TOSGuard><DocumentIngestion /></TOSGuard>} />

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';
import {
  Upload,
  FileText,
  AlertCircle,
  CheckCircle,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Calendar,
  MapPin,
  Users,
  Scale,
  Clock,
  AlertTriangle,
  Edit3,
  Check,
  X,
  Shield,
  Hash,
  FileSearch,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { trackEvent } from '../utils/analytics';
import { SUPPORTED_JURISDICTIONS } from '../config/jurisdictions';

// Use relative URLs in production (empty string), localhost in development
const API_BASE_URL = process.env.REACT_APP_API_URL !== undefined
  ? process.env.REACT_APP_API_URL
  : 'http://localhost:3001';

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB

// Step indicator labels
const STEPS = [
  { key: 'upload', label: 'Upload' },
  { key: 'review', label: 'Review' },
  { key: 'confirm', label: 'Confirm' },
];

// ─── Utilities ───────────────────────────────────────────────────────────────

const formatFileSize = (bytes) => {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (dateStr) => {
  if (!dateStr) return null;
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return dateStr;
  }
};

const toInputDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return '';
    return d.toISOString().split('T')[0];
  } catch {
    return '';
  }
};

const daysUntil = (dateStr) => {
  if (!dateStr) return null;
  try {
    const deadline = new Date(dateStr);
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    deadline.setHours(0, 0, 0, 0);
    return Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
  } catch {
    return null;
  }
};

const getDeadlineColor = (days) => {
  if (days === null) return 'text-gray-600';
  if (days < 0) return 'text-red-700';
  if (days <= 7) return 'text-red-600';
  if (days <= 14) return 'text-orange-600';
  return 'text-green-700';
};

const getDeadlineBg = (days) => {
  if (days === null) return 'bg-gray-50 border-gray-200';
  if (days < 0) return 'bg-red-50 border-red-300';
  if (days <= 7) return 'bg-red-50 border-red-200';
  if (days <= 14) return 'bg-orange-50 border-orange-200';
  return 'bg-green-50 border-green-200';
};

const confidenceLabel = (score) => {
  if (!score && score !== 0) return { text: 'Unknown', color: 'text-gray-500' };
  const pct = typeof score === 'number' && score <= 1 ? score * 100 : score;
  if (pct >= 85) return { text: 'High', color: 'text-green-700' };
  if (pct >= 60) return { text: 'Medium', color: 'text-yellow-700' };
  return { text: 'Low', color: 'text-red-700' };
};

// Lookup jurisdiction name from code
const jurisdictionName = (code) => {
  if (!code) return '';
  const match = SUPPORTED_JURISDICTIONS.find(
    (j) => j.code.toUpperCase() === code.toUpperCase()
  );
  return match ? `${match.code} - ${match.name}` : code;
};


// ─── Step Progress Bar ───────────────────────────────────────────────────────

const StepProgress = ({ currentStep }) => (
  <nav aria-label="Progress" className="mb-8">
    <ol className="flex items-center justify-center gap-2 sm:gap-4">
      {STEPS.map((step, idx) => {
        const isActive = idx === currentStep;
        const isComplete = idx < currentStep;
        return (
          <li key={step.key} className="flex items-center gap-2 sm:gap-3">
            {idx > 0 && (
              <div
                className={`hidden sm:block w-8 md:w-16 h-0.5 ${
                  isComplete ? 'bg-blue-600' : 'bg-gray-300'
                }`}
              />
            )}
            <div className="flex items-center gap-2">
              <span
                className={`flex items-center justify-center w-8 h-8 rounded-full text-sm font-semibold border-2 transition-colors ${
                  isComplete
                    ? 'bg-blue-600 border-blue-600 text-white'
                    : isActive
                    ? 'border-blue-600 text-blue-600 bg-blue-50'
                    : 'border-gray-300 text-gray-400 bg-white'
                }`}
              >
                {isComplete ? <Check className="h-4 w-4" /> : idx + 1}
              </span>
              <span
                className={`text-sm font-medium ${
                  isActive ? 'text-blue-700' : isComplete ? 'text-blue-600' : 'text-gray-400'
                }`}
              >
                {step.label}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  </nav>
);


// ─── Inline Editable Field ───────────────────────────────────────────────────

const EditableField = ({ label, value, onSave, type = 'text', icon: Icon, options }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');
  const inputRef = useRef(null);

  useEffect(() => {
    setDraft(value || '');
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = () => {
    onSave(draft);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setDraft(value || '');
    setIsEditing(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleSave();
    if (e.key === 'Escape') handleCancel();
  };

  const displayValue = type === 'date' ? formatDate(value) : value;

  return (
    <div className="group flex items-start gap-3 py-2">
      {Icon && <Icon className="h-4 w-4 text-gray-400 mt-1 flex-shrink-0" />}
      <div className="flex-1 min-w-0">
        <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</dt>
        {isEditing ? (
          <div className="flex items-center gap-2 mt-1">
            {options ? (
              <select
                ref={inputRef}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 px-2 py-1 text-sm border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">-- Select --</option>
                {options.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                ref={inputRef}
                type={type}
                value={type === 'date' ? toInputDate(draft) : draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 px-2 py-1 text-sm border border-blue-400 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            )}
            <button
              onClick={handleSave}
              className="p-1 text-green-600 hover:bg-green-50 rounded"
              aria-label="Save"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={handleCancel}
              className="p-1 text-red-500 hover:bg-red-50 rounded"
              aria-label="Cancel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <dd className="flex items-center gap-2 mt-0.5">
            <span className={`text-sm ${displayValue ? 'text-gray-900' : 'text-gray-400 italic'}`}>
              {displayValue || 'Not detected'}
            </span>
            <button
              onClick={() => setIsEditing(true)}
              className="p-1 text-gray-400 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity rounded"
              aria-label={`Edit ${label}`}
              title="Click to edit"
            >
              <Edit3 className="h-3.5 w-3.5" />
            </button>
          </dd>
        )}
      </div>
    </div>
  );
};


// ─── Step 1: Upload ──────────────────────────────────────────────────────────

const UploadStep = ({ onUploadComplete }) => {
  const { getAccessTokenSilently } = useAuth0();
  const fileInputRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const validateFile = (file) => {
    if (file.type !== 'application/pdf') {
      return 'Only PDF files are accepted. Please upload a PDF document.';
    }
    if (file.size > MAX_FILE_SIZE) {
      return 'File exceeds the 25 MB limit. Please upload a smaller file.';
    }
    return null;
  };

  const handleFileSelect = (file) => {
    setError(null);
    const err = validateFile(file);
    if (err) {
      setError(err);
      return;
    }
    setSelectedFile(file);
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
    if (file) handleFileSelect(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setError(null);

    trackEvent('ingestion_upload_started', {
      file_size_mb: (selectedFile.size / (1024 * 1024)).toFixed(2),
    });

    try {
      const token = await getAccessTokenSilently();
      const formData = new FormData();
      formData.append('document', selectedFile);

      const response = await fetch(`${API_BASE_URL}/api/ingest/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Upload failed (HTTP ${response.status})`);
      }

      if (!data.success) {
        // 422 — partial extraction, still show what we have
        if (data.data?.ingestion_id) {
          trackEvent('ingestion_upload_partial', { ingestion_id: data.data.ingestion_id });
          onUploadComplete({
            ...data.data,
            fileName: selectedFile.name,
            ocrRequired: true,
          });
          return;
        }
        throw new Error(data.error || 'Upload processing failed.');
      }

      trackEvent('ingestion_upload_success', {
        ingestion_id: data.data.ingestion_id,
        document_class: data.data.document_class,
      });

      onUploadComplete({
        ...data.data,
        fileName: selectedFile.name,
        ocrRequired: false,
      });
    } catch (err) {
      console.error('Ingestion upload error:', err);
      setError(err.message || 'Failed to upload document. Please try again.');
      trackEvent('ingestion_upload_failed', { error: err.message });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-blue-100 mb-4">
          <FileSearch className="h-7 w-7 text-blue-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900">Upload a Served Document</h2>
        <p className="text-sm text-gray-600 mt-2">
          Upload the petition, complaint, or other document you were served.
          We will extract the key details so you can review them and start preparing your response.
        </p>
      </div>

      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          dragActive
            ? 'border-blue-500 bg-blue-50'
            : selectedFile
            ? 'border-green-400 bg-green-50'
            : 'border-gray-300 hover:border-gray-400 bg-white'
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
          accept="application/pdf"
          onChange={(e) => {
            const file = e.target.files[0];
            if (file) handleFileSelect(file);
          }}
        />

        {selectedFile ? (
          <div className="flex flex-col items-center">
            <FileText className="h-12 w-12 text-green-600 mb-3" />
            <p className="text-sm font-medium text-gray-900">{selectedFile.name}</p>
            <p className="text-xs text-gray-500 mt-1">{formatFileSize(selectedFile.size)}</p>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setSelectedFile(null);
                setError(null);
              }}
              className="mt-3 text-sm text-blue-600 hover:text-blue-700 hover:underline"
            >
              Choose a different file
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <Upload className="h-12 w-12 text-gray-400 mb-3" />
            <p className="text-sm font-medium text-gray-700">
              Click to select a file or drag and drop
            </p>
            <p className="text-xs text-gray-500 mt-1">PDF only, up to 25 MB</p>
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Upload button */}
      <button
        onClick={handleUpload}
        disabled={!selectedFile || uploading}
        className="mt-6 w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {uploading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Uploading and analyzing...
          </>
        ) : (
          <>
            <Upload className="h-5 w-5" />
            Upload and Analyze
          </>
        )}
      </button>
    </div>
  );
};


// ─── Step 2: Review Extraction ───────────────────────────────────────────────

const ReviewStep = ({ data, corrections, onCorrection, onBack, onNext }) => {
  const ext = data.extracted_data || {};
  const [showClaims, setShowClaims] = useState(false);

  const deadlineDays = daysUntil(data.response_deadline);
  const conf = confidenceLabel(data.classification_confidence);

  // Helper to apply a correction to a specific field
  const setField = (field, value) => {
    onCorrection({ ...corrections, [field]: value });
  };

  // Merged view: corrections override extracted values
  const merged = (field) =>
    corrections[field] !== undefined ? corrections[field] : ext[field];

  // Jurisdiction options for the dropdown
  const jurisdictionOptions = SUPPORTED_JURISDICTIONS.map((j) => ({
    value: j.code,
    label: `${j.code} - ${j.name}`,
  }));

  const parties = ext.parties || [];
  const claims = ext.claims || ext.allegations || [];

  return (
    <div className="max-w-2xl mx-auto">
      {/* OCR banner */}
      {data.ocrRequired && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-800">
              We could not fully extract text from this document.
            </p>
            <p className="text-xs text-yellow-700 mt-1">
              The file may be a scanned image. Please fill in or correct the details below manually.
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Review Extracted Details</h2>
          <p className="text-sm text-gray-600 mt-1">
            Verify the information below. Click any field to correct it.
          </p>
        </div>
        {data.fileName && (
          <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 bg-gray-100 rounded-full text-xs text-gray-600">
            <FileText className="h-3.5 w-3.5" />
            {data.fileName}
          </span>
        )}
      </div>

      {/* Deadline banner */}
      {data.response_deadline && (
        <div
          className={`mb-6 p-4 border rounded-lg flex items-start gap-3 ${getDeadlineBg(
            deadlineDays
          )}`}
        >
          <Clock className={`h-5 w-5 flex-shrink-0 mt-0.5 ${getDeadlineColor(deadlineDays)}`} />
          <div>
            <p className={`text-sm font-semibold ${getDeadlineColor(deadlineDays)}`}>
              Response Deadline: {formatDate(data.response_deadline)}
              {deadlineDays !== null && (
                <span className="ml-2 font-normal">
                  ({deadlineDays < 0
                    ? `${Math.abs(deadlineDays)} days overdue`
                    : deadlineDays === 0
                    ? 'Due today'
                    : `${deadlineDays} day${deadlineDays !== 1 ? 's' : ''} remaining`})
                </span>
              )}
            </p>
            {data.deadline_source && (
              <p className="text-xs text-gray-600 mt-0.5">Source: {data.deadline_source}</p>
            )}
            {data.deadline_note && (
              <p className="text-xs text-orange-700 mt-1">{data.deadline_note}</p>
            )}
          </div>
        </div>
      )}

      {!data.response_deadline && (
        <div className="mb-6 p-4 border rounded-lg bg-yellow-50 border-yellow-200 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-yellow-800">
              Response deadline could not be calculated.
            </p>
            <p className="text-xs text-yellow-700 mt-1">
              Enter your service date below so we can determine your response deadline.
            </p>
          </div>
        </div>
      )}

      {/* Classification card */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
          <Scale className="h-4 w-4" />
          Document Classification
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
          <div className="py-2">
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">Type</dt>
            <dd className="text-sm text-gray-900 mt-0.5">
              {(data.document_class || 'Unknown').replace(/_/g, ' ')}
            </dd>
          </div>
          <div className="py-2">
            <dt className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Confidence
            </dt>
            <dd className={`text-sm font-medium mt-0.5 ${conf.color}`}>
              {conf.text}
              {data.classification_confidence != null && (
                <span className="text-gray-400 font-normal ml-1">
                  ({(typeof data.classification_confidence === 'number' &&
                  data.classification_confidence <= 1
                    ? (data.classification_confidence * 100).toFixed(0)
                    : data.classification_confidence)}%)
                </span>
              )}
            </dd>
          </div>
        </div>
      </div>

      {/* Details card */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
          <FileText className="h-4 w-4" />
          Case Details
        </h3>
        <dl className="divide-y divide-gray-100">
          <EditableField
            label="Filing Jurisdiction"
            value={merged('state')}
            onSave={(v) => setField('state', v)}
            icon={MapPin}
            options={jurisdictionOptions}
          />
          <EditableField
            label="County"
            value={merged('county')}
            onSave={(v) => setField('county', v)}
            icon={MapPin}
          />
          <EditableField
            label="Court Name"
            value={merged('court_name')}
            onSave={(v) => setField('court_name', v)}
            icon={Scale}
          />
          <EditableField
            label="Case / Cause Number"
            value={merged('cause_number')}
            onSave={(v) => setField('cause_number', v)}
            icon={Hash}
          />
        </dl>
      </div>

      {/* Dates card */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          Key Dates
        </h3>
        <dl className="divide-y divide-gray-100">
          <EditableField
            label="Filing Date"
            value={merged('filing_date')}
            onSave={(v) => setField('filing_date', v)}
            type="date"
            icon={Calendar}
          />
          <EditableField
            label="Service Date"
            value={merged('service_date')}
            onSave={(v) => setField('service_date', v)}
            type="date"
            icon={Calendar}
          />
        </dl>
      </div>

      {/* Parties card */}
      <div className="bg-white border border-gray-200 rounded-lg p-5 mb-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3 flex items-center gap-2">
          <Users className="h-4 w-4" />
          Parties
        </h3>
        <dl className="divide-y divide-gray-100">
          <EditableField
            label="Petitioner / Plaintiff"
            value={merged('petitioner_name')}
            onSave={(v) => setField('petitioner_name', v)}
            icon={Users}
          />
          <EditableField
            label="Respondent / Defendant"
            value={merged('respondent_name')}
            onSave={(v) => setField('respondent_name', v)}
            icon={Users}
          />
        </dl>
        {parties.length > 2 && (
          <div className="mt-3 text-xs text-gray-500">
            + {parties.length - 2} additional {parties.length - 2 === 1 ? 'party' : 'parties'} detected
          </div>
        )}
      </div>

      {/* Claims / Allegations card */}
      {claims.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-5 mb-4 shadow-sm">
          <button
            onClick={() => setShowClaims(!showClaims)}
            className="w-full flex items-center justify-between"
          >
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Claims / Allegations ({claims.length})
            </h3>
            {showClaims ? (
              <ChevronUp className="h-4 w-4 text-gray-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-400" />
            )}
          </button>
          {showClaims && (
            <ul className="mt-3 space-y-2">
              {claims.map((claim, idx) => (
                <li
                  key={idx}
                  className="text-sm text-gray-700 pl-4 border-l-2 border-blue-200 py-1"
                >
                  {typeof claim === 'string' ? claim : claim.text || claim.description || JSON.stringify(claim)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Suggested response documents */}
      {data.suggested_documents && data.suggested_documents.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-5 mb-6">
          <h3 className="text-sm font-semibold text-blue-800 mb-2">
            Suggested Response Documents
          </h3>
          <ul className="space-y-1">
            {data.suggested_documents.map((doc, idx) => (
              <li key={idx} className="flex items-center gap-2 text-sm text-blue-700">
                <CheckCircle className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                {typeof doc === 'string' ? doc.replace(/_/g, ' ') : doc.name || doc.label || doc.code}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex gap-3 mt-6">
        <button
          onClick={onBack}
          className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <button
          onClick={onNext}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Continue to Confirm
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};


// ─── Step 3: Confirm & Create Case ──────────────────────────────────────────

const ConfirmStep = ({ data, corrections, onBack }) => {
  const { getAccessTokenSilently } = useAuth0();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const ext = data.extracted_data || {};
  const merged = (field) =>
    corrections[field] !== undefined ? corrections[field] : ext[field];

  const deadlineDays = daysUntil(data.response_deadline);
  const hasCorrectionKeys = Object.keys(corrections).length > 0;

  const handleConfirm = async () => {
    setSubmitting(true);
    setError(null);

    trackEvent('ingestion_review_confirmed', {
      ingestion_id: data.ingestion_id,
      has_corrections: hasCorrectionKeys,
    });

    try {
      const token = await getAccessTokenSilently();

      const body = {
        confirmed: true,
        corrections: hasCorrectionKeys ? corrections : undefined,
        service_date: corrections.service_date || ext.service_date || undefined,
      };

      const response = await fetch(`${API_BASE_URL}/api/ingest/${data.ingestion_id}/review`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `Confirmation failed (HTTP ${response.status})`);
      }

      trackEvent('ingestion_case_created', {
        case_id: result.data?.case_id,
        ingestion_id: data.ingestion_id,
      });

      // Navigate to the chat URL returned by the backend
      if (result.data?.chat_url) {
        // chat_url is a relative path like /chat?caseId=X&matterTypeCode=document_response
        // Route to the editor — map to /editor/new with query params
        const chatUrl = result.data.chat_url;
        navigate(chatUrl.startsWith('/') ? chatUrl : `/${chatUrl}`);
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('Ingestion confirm error:', err);
      setError(err.message || 'Failed to create case. Please try again.');
      trackEvent('ingestion_confirm_failed', { error: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  // Build a summary list of key fields
  const summaryItems = [
    { label: 'Document Type', value: (data.document_class || 'Unknown').replace(/_/g, ' ') },
    { label: 'Jurisdiction', value: jurisdictionName(merged('state')) || 'Not specified' },
    { label: 'County', value: merged('county') },
    { label: 'Court', value: merged('court_name') },
    { label: 'Case Number', value: merged('cause_number') },
    { label: 'Filing Date', value: formatDate(merged('filing_date')) },
    { label: 'Service Date', value: formatDate(merged('service_date')) },
    { label: 'Petitioner', value: merged('petitioner_name') },
    { label: 'Respondent', value: merged('respondent_name') },
  ].filter((item) => item.value);

  return (
    <div className="max-w-xl mx-auto">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-100 mb-4">
          <CheckCircle className="h-7 w-7 text-green-600" />
        </div>
        <h2 className="text-xl font-semibold text-gray-900">Confirm and Create Case</h2>
        <p className="text-sm text-gray-600 mt-2">
          Review the summary below. Once confirmed, we will create your case and guide you
          through preparing your response.
        </p>
      </div>

      {/* Deadline banner (repeated for emphasis) */}
      {data.response_deadline && (
        <div
          className={`mb-5 p-3 border rounded-lg flex items-center gap-3 ${getDeadlineBg(
            deadlineDays
          )}`}
        >
          <Clock className={`h-5 w-5 flex-shrink-0 ${getDeadlineColor(deadlineDays)}`} />
          <span className={`text-sm font-semibold ${getDeadlineColor(deadlineDays)}`}>
            Deadline: {formatDate(data.response_deadline)}
            {deadlineDays !== null && deadlineDays >= 0 && ` (${deadlineDays} days remaining)`}
            {deadlineDays !== null && deadlineDays < 0 && ` (${Math.abs(deadlineDays)} days overdue)`}
          </span>
        </div>
      )}

      {/* Summary table */}
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm divide-y divide-gray-100 mb-6">
        {summaryItems.map((item) => (
          <div key={item.label} className="flex justify-between px-5 py-3">
            <span className="text-sm text-gray-500">{item.label}</span>
            <span className="text-sm font-medium text-gray-900 text-right max-w-[60%] truncate">
              {item.value}
            </span>
          </div>
        ))}
      </div>

      {hasCorrectionKeys && (
        <div className="mb-5 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-2">
          <Edit3 className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-blue-700">
            You made corrections to {Object.keys(corrections).length} field{Object.keys(corrections).length !== 1 ? 's' : ''}.
            These will be applied when the case is created.
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-xs text-gray-500 mb-5 text-center">
        By confirming, you acknowledge that this tool provides document preparation assistance,
        not legal advice. Consult a licensed attorney for legal guidance.
      </p>

      {/* Buttons */}
      <div className="flex gap-3">
        <button
          onClick={onBack}
          disabled={submitting}
          className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors font-medium"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <button
          onClick={handleConfirm}
          disabled={submitting}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
        >
          {submitting ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Creating case...
            </>
          ) : (
            <>
              <CheckCircle className="h-5 w-5" />
              Create Case & Start Response
            </>
          )}
        </button>
      </div>
    </div>
  );
};


// ─── Main Component ──────────────────────────────────────────────────────────

const DocumentIngestion = () => {
  const navigate = useNavigate();
  const { isAuthenticated, isLoading: authLoading, loginWithRedirect } = useAuth0();

  const [currentStep, setCurrentStep] = useState(0);
  const [uploadData, setUploadData] = useState(null);
  const [corrections, setCorrections] = useState({});

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      loginWithRedirect({ appState: { returnTo: '/ingest' } });
    }
  }, [authLoading, isAuthenticated, loginWithRedirect]);

  // Scroll to top on step change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentStep]);

  const handleUploadComplete = useCallback((data) => {
    setUploadData(data);
    setCorrections({});
    setCurrentStep(1);
  }, []);

  const handleGoBackToUpload = useCallback(() => {
    setCurrentStep(0);
    setUploadData(null);
    setCorrections({});
  }, []);

  const handleGoBackToReview = useCallback(() => {
    setCurrentStep(1);
  }, []);

  const handleGoToConfirm = useCallback(() => {
    setCurrentStep(2);
  }, []);

  // Auth loading state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-3" />
          <p className="text-sm text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // loginWithRedirect will handle it
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 text-gray-500 hover:text-gray-700 rounded-lg transition-colors"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <FileSearch className="h-5 w-5 text-blue-600" />
              <h1 className="text-lg font-semibold text-gray-900">Document Ingestion</h1>
            </div>
          </div>
          {uploadData?.fileName && currentStep > 0 && (
            <span className="hidden sm:inline text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full truncate max-w-[200px]">
              {uploadData.fileName}
            </span>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        <StepProgress currentStep={currentStep} />

        {currentStep === 0 && <UploadStep onUploadComplete={handleUploadComplete} />}

        {currentStep === 1 && uploadData && (
          <ReviewStep
            data={uploadData}
            corrections={corrections}
            onCorrection={setCorrections}
            onBack={handleGoBackToUpload}
            onNext={handleGoToConfirm}
          />
        )}

        {currentStep === 2 && uploadData && (
          <ConfirmStep
            data={uploadData}
            corrections={corrections}
            onBack={handleGoBackToReview}
          />
        )}
      </main>
    </div>
  );
};

export default DocumentIngestion;
