'use client';

// client/src/components/ValidationSidebar.js - WITH DRAG & DROP + EVIDENCE
import React, { useState } from 'react';
import {
  AlertTriangle,
  Info,
  Edit2,
  Trash2,
  Save,
  X,
  Sparkles,
  Loader2,
  CheckCircle,
  XCircle,
  GripVertical,  // ✅ Drag handle icon
  FileText,      // Evidence icon
  Upload,        // Upload icon
  FilePlus,      // Add evidence button
  ChevronUp,     // Move up button
  ChevronDown    // Move down button
} from 'lucide-react';
import { useAuth0 } from '@/lib/auth0-client';
import { useDocumentData, useDocumentActions } from '@/contexts/DocumentContext';
import EvidenceUploadModal from './EvidenceUploadModal';

// Import evidence helper functions
import {
  isEvidence,
  evidenceHasFile,
  calculateExhibitLabels,
  createEvidencePlaceholder
} from '@/lib/utils/factNormalizer';

// ✅ Import drag & drop
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// ✅ Draggable Fact Card Component
const DraggableFactCard = ({
  fact,
  index,
  totalFacts,
  isEditing,
  isGenerating,
  editedFactContent,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  onRequestRewrite,
  onApplyRewrite,
  onContentChange,
  onMoveUp,
  onMoveDown
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: fact.id || `fact-${index}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  // Helper functions
  const getFactContent = (fact) => {
    if (typeof fact === 'string') return fact;
    return fact?.content || '';
  };

  const getFactMetadata = (fact) => {
    if (typeof fact !== 'object' || fact === null) {
      return {
        category: null,
        hasRewrite: false,
        professionalRewrite: null,
        issues: [],
        suggestions: []
      };
    }

    return {
      category: fact.category || null,
      hasRewrite: !!fact.professionalRewrite,
      professionalRewrite: fact.professionalRewrite || null,
      issues: Array.isArray(fact.issues) ? fact.issues : [],
      suggestions: Array.isArray(fact.suggestions) ? fact.suggestions : []
    };
  };

  const getCategoryEmoji = (category) => {
    const emojiMap = {
      'financial': '💰',
      'property': '🏠',
      'relational': '👨‍👩‍👧‍👦',
      'temporal': '📅',
      'witness': '👁️',
      'communication': '💬',
      'parental': '👶',
      'general': '📝'
    };
    return emojiMap[category?.toLowerCase()] || '📝';
  };

  const content = getFactContent(fact);
  const metadata = getFactMetadata(fact);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-3 border border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors ${
        isDragging ? 'shadow-lg' : ''
      }`}
    >
      {/* Fact Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {/* ✅ DRAG HANDLE */}
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 text-gray-400 hover:text-gray-600"
            title="Drag to reorder"
          >
            <GripVertical className="h-4 w-4" />
          </button>

          <span className="text-xs font-medium text-gray-500">
            #{index + 1}
          </span>
          
          {/* Category with emoji */}
          {metadata.category && (
            <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
              {getCategoryEmoji(metadata.category)} {metadata.category}
            </span>
          )}
        </div>

        {/* Action Buttons */}
        {!isEditing && (
          <div className="flex items-center gap-1">
            {/* Move Up/Down Buttons - Mobile-friendly reordering */}
            <button
              onClick={() => onMoveUp(index)}
              disabled={index === 0}
              className="p-1 text-gray-500 hover:text-blue-600 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Move up"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              onClick={() => onMoveDown(index)}
              disabled={index === totalFacts - 1}
              className="p-1 text-gray-500 hover:text-blue-600 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Move down"
            >
              <ChevronDown className="h-4 w-4" />
            </button>

            {/* Sparkle Icon */}
            {!isGenerating && (
              <button
                onClick={() => onRequestRewrite(index)}
                className="p-1 text-purple-500 hover:text-purple-700 hover:bg-purple-50 rounded transition-colors"
                title="Generate professional rewrite"
              >
                <Sparkles className="h-4 w-4" />
              </button>
            )}

            {isGenerating && (
              <Loader2 className="h-4 w-4 text-purple-500 animate-spin" />
            )}

            <button
              onClick={() => onEdit(index)}
              className="p-1 text-gray-500 hover:text-blue-600 rounded transition-colors"
              title="Edit fact"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => onDelete(index)}
              className="p-1 text-gray-500 hover:text-red-600 rounded transition-colors"
              title="Delete fact"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Fact Content */}
      {isEditing ? (
        <div className="space-y-2">
          <textarea
            value={editedFactContent}
            onChange={(e) => onContentChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={3}
          />
          <div className="flex gap-2">
            <button
              onClick={onSave}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 flex items-center gap-1"
            >
              <Save className="h-3 w-3" />
              Save
            </button>
            <button
              onClick={onCancel}
              className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 flex items-center gap-1"
            >
              <X className="h-3 w-3" />
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-800 mb-2">{content}</p>

          {/* Professional Rewrite */}
          {metadata.hasRewrite && metadata.professionalRewrite && metadata.professionalRewrite !== content && (
            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-blue-800 flex items-center">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Professional Version:
                </span>
                <button
                  onClick={() => onApplyRewrite(index, metadata.professionalRewrite)}
                  className="px-2 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
                >
                  Apply
                </button>
              </div>
              <p className="text-xs text-blue-700 italic">
                "{metadata.professionalRewrite}"
              </p>
            </div>
          )}

          {/* Issues */}
          {metadata.issues.length > 0 && (
            <div className="mt-2 space-y-1">
              {metadata.issues.map((issue, i) => (
                <p key={i} className="text-xs text-yellow-700 flex items-start gap-1">
                  <AlertTriangle className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  {issue}
                </p>
              ))}
            </div>
          )}

          {/* Suggestions */}
          {metadata.suggestions.length > 0 && (
            <div className="mt-2 space-y-1">
              {metadata.suggestions.map((suggestion, i) => (
                <p key={i} className="text-xs text-blue-700 flex items-start gap-1">
                  <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                  {suggestion}
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ✅ Draggable Evidence Card Component
const DraggableEvidenceCard = ({
  evidence,
  index,
  totalFacts,
  isEditing,
  editedDescription,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  onUpload,
  onDescriptionChange,
  onMoveUp,
  onMoveDown
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: evidence.id || `evidence-${index}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const evidenceData = evidence.evidenceData || {};
  const hasFile = evidenceHasFile(evidence);
  const exhibitLabel = evidenceData.exhibitLabel || '[TBD]';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`p-3 border-2 border-blue-200 rounded-lg bg-blue-50 hover:bg-blue-100 transition-colors ${
        isDragging ? 'shadow-lg' : ''
      }`}
    >
      {/* Evidence Header */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {/* ✅ DRAG HANDLE */}
          <button
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing p-1 text-blue-400 hover:text-blue-600"
            title="Drag to reorder"
          >
            <GripVertical className="h-4 w-4" />
          </button>

          <span className="text-xs font-medium text-blue-700 flex items-center gap-1">
            <FileText className="h-3 w-3" />
            Exhibit {exhibitLabel}
          </span>
        </div>

        {/* Action Buttons */}
        {!isEditing && (
          <div className="flex items-center gap-1">
            {/* Move Up/Down Buttons - Mobile-friendly reordering */}
            <button
              onClick={() => onMoveUp(index)}
              disabled={index === 0}
              className="p-1 text-blue-600 hover:text-blue-800 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Move up"
            >
              <ChevronUp className="h-4 w-4" />
            </button>
            <button
              onClick={() => onMoveDown(index)}
              disabled={index === totalFacts - 1}
              className="p-1 text-blue-600 hover:text-blue-800 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              title="Move down"
            >
              <ChevronDown className="h-4 w-4" />
            </button>

            {!hasFile && (
              <button
                onClick={() => onUpload(evidence)}
                className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors"
                title="Upload evidence file"
              >
                <Upload className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => onEdit(index)}
              className="p-1 text-blue-600 hover:text-blue-800 rounded transition-colors"
              title="Edit description"
            >
              <Edit2 className="h-4 w-4" />
            </button>
            <button
              onClick={() => onDelete(index)}
              className="p-1 text-blue-600 hover:text-red-600 rounded transition-colors"
              title="Delete evidence"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      {/* Evidence Content */}
      {isEditing ? (
        <div className="space-y-2">
          <label className="text-xs font-medium text-blue-800">Description:</label>
          <textarea
            value={editedDescription}
            onChange={(e) => onDescriptionChange(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={2}
            placeholder="Describe this evidence..."
          />
          <div className="flex gap-2">
            <button
              onClick={onSave}
              className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 flex items-center gap-1"
            >
              <Save className="h-3 w-3" />
              Save
            </button>
            <button
              onClick={onCancel}
              className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 flex items-center gap-1"
            >
              <X className="h-3 w-3" />
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-blue-900 mb-2">
            {evidenceData.description || 'No description'}
          </p>

          {/* File Status */}
          {hasFile ? (
            <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <div className="flex-1">
                <p className="text-xs font-medium text-green-800">
                  {evidenceData.fileName}
                </p>
                {evidenceData.fileSizeBytes && (
                  <p className="text-xs text-green-600">
                    {(evidenceData.fileSizeBytes / 1024).toFixed(1)} KB
                    {evidenceData.filePages && ` • ${evidenceData.filePages} page${evidenceData.filePages > 1 ? 's' : ''}`}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <p className="text-xs text-yellow-800">
                File upload required
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
};

// ✅ Main ValidationSidebar Component
const ValidationSidebar = () => {
  const { currentDocument } = useDocumentData();
  const { updateDocumentData, updateDocumentDataWithoutPreview, saveDocument } = useDocumentActions();
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  const [editingFactIndex, setEditingFactIndex] = useState(null);
  const [editedFactContent, setEditedFactContent] = useState('');
  const [generatingRewrite, setGeneratingRewrite] = useState(new Set());

  // Evidence state
  const [editingEvidenceIndex, setEditingEvidenceIndex] = useState(null);
  const [editedEvidenceDescription, setEditedEvidenceDescription] = useState('');
  const [showEvidenceUpload, setShowEvidenceUpload] = useState(false);
  const [currentEvidence, setCurrentEvidence] = useState(null);

  // Rewrite-all state
  const [isRewritingAll, setIsRewritingAll] = useState(false);
  const [rewriteAllProgress, setRewriteAllProgress] = useState({ current: 0, total: 0 });

  // Lock to prevent concurrent rewrite operations from racing
  const rewriteLockRef = React.useRef(Promise.resolve());
  // Ref to always get the latest document state
  const latestDocumentRef = React.useRef(currentDocument);

  // Keep ref updated with latest document
  React.useEffect(() => {
    latestDocumentRef.current = currentDocument;
  }, [currentDocument]);

  // ✅ Drag & Drop sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  if (!currentDocument) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <p className="text-sm text-gray-500">Loading document...</p>
      </div>
    );
  }

  // ✅ Handle drag end - supports both facts and evidence
  const handleDragEnd = (event) => {
    const { active, over } = event;

    if (!over || active.id === over.id) return;

    const oldIndex = currentDocument.facts.findIndex(
      (fact, idx) => {
        const factId = fact.id || `fact-${idx}`;
        const evidenceId = isEvidence(fact) ? (fact.id || `evidence-${idx}`) : null;
        return factId === active.id || evidenceId === active.id;
      }
    );
    const newIndex = currentDocument.facts.findIndex(
      (fact, idx) => {
        const factId = fact.id || `fact-${idx}`;
        const evidenceId = isEvidence(fact) ? (fact.id || `evidence-${idx}`) : null;
        return factId === over.id || evidenceId === over.id;
      }
    );

    if (oldIndex === -1 || newIndex === -1) return;

    let reorderedFacts = arrayMove(currentDocument.facts, oldIndex, newIndex);

    // Recalculate exhibit labels after reordering
    reorderedFacts = calculateExhibitLabels(reorderedFacts, { style: 'letters' });

    // updateDocumentData handles preview regeneration and auto-save for facts
    updateDocumentData({ facts: reorderedFacts });
  };

  // Handle move up/down with arrow buttons (mobile-friendly)
  const handleMoveUp = (index) => {
    if (index === 0) return; // Already at top

    let reorderedFacts = arrayMove(currentDocument.facts, index, index - 1);
    reorderedFacts = calculateExhibitLabels(reorderedFacts, { style: 'letters' });

    // updateDocumentData handles preview regeneration and auto-save for facts
    updateDocumentData({ facts: reorderedFacts });
  };

  const handleMoveDown = (index) => {
    if (index === currentDocument.facts.length - 1) return; // Already at bottom

    let reorderedFacts = arrayMove(currentDocument.facts, index, index + 1);
    reorderedFacts = calculateExhibitLabels(reorderedFacts, { style: 'letters' });

    // updateDocumentData handles preview regeneration and auto-save for facts
    updateDocumentData({ facts: reorderedFacts });
  };

  // Request professional rewrite for a single fact
  const requestProfessionalRewrite = (index) => {
    // Set loading state immediately so icon changes to spinner
    setGeneratingRewrite(prev => new Set(prev).add(index));

    // Capture the previous lock SYNCHRONOUSLY before any async work
    // This ensures concurrent calls properly chain (each sees the updated lock)
    const previousLock = rewriteLockRef.current;

    const operationPromise = (async () => {
      try {
        // Wait for previous operation to complete (serializes concurrent calls)
        await previousLock;

        // Read from ref to get the LATEST facts array
        const fact = latestDocumentRef.current.facts[index];
        if (!fact) {
          throw new Error(`Fact at index ${index} not found`);
        }

        const API_BASE = '';

        let headers = { 'Content-Type': 'application/json' };
        if (isAuthenticated) {
          try {
            const token = await getAccessTokenSilently();
          } catch (authError) {
            console.warn('Auth failed for rewrite request');
          }
        }

        const response = await fetch(`${API_BASE}/api/facts/rewrite`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            fact: {
              content: typeof fact === 'string' ? fact : fact.content,
              originalContent: typeof fact === 'string' ? fact : (fact.originalContent || fact.content),
              initialRewrite: typeof fact === 'object' ? fact.initialRewrite : null,
              category: fact.category || 'general',
              subcategory: fact.subcategory
            },
            allFacts: latestDocumentRef.current.facts.map(f => ({
              content: typeof f === 'string' ? f : f.content,
              category: f.category || 'general',
              subcategory: f.subcategory
            })),
            factIndex: index,
            context: {
              state: latestDocumentRef.current.state,
              caseType: latestDocumentRef.current.caseType,
              affiantName: latestDocumentRef.current.affiantName
            }
          })
        });

        const data = await response.json();

        if (data.success && data.professionalRewrite) {
          // Read LATEST facts to avoid race condition
          const updatedFacts = [...latestDocumentRef.current.facts];
          const currentFact = updatedFacts[index];

          if (typeof currentFact === 'object' && currentFact !== null) {
            updatedFacts[index] = {
              ...currentFact,
              professionalRewrite: data.professionalRewrite,
              initialRewrite: currentFact.initialRewrite || data.professionalRewrite,
              originalContent: currentFact.originalContent || currentFact.content,
              hasRewrite: true
            };
          } else {
            updatedFacts[index] = {
              content: currentFact,
              originalContent: currentFact,
              initialRewrite: data.professionalRewrite,
              professionalRewrite: data.professionalRewrite,
              category: 'general',
              hasRewrite: true
            };
          }

          // Update UI immediately
          updateDocumentDataWithoutPreview({ facts: updatedFacts });

          // Save is best-effort - don't fail the rewrite if save fails
          try {
            await saveDocument({ facts: updatedFacts });
          } catch (saveError) {
            console.warn('Auto-save after rewrite failed (rewrite still applied):', saveError.message);
          }
        } else {
          throw new Error(data.error || 'Failed to generate rewrite');
        }
      } catch (error) {
        console.error('Professional rewrite failed:', error);
        alert('Failed to generate professional rewrite. Please try again.');
      } finally {
        setGeneratingRewrite(prev => {
          const next = new Set(prev);
          next.delete(index);
          return next;
        });
      }
    })();

    // Update lock SYNCHRONOUSLY so the next concurrent call chains onto this one
    rewriteLockRef.current = operationPromise;

    return operationPromise;
  };

  // Rewrite all facts professionally (sequential, chained)
  const rewriteAllFacts = async () => {
    const facts = latestDocumentRef.current.facts || [];
    // Only rewrite non-evidence facts that don't already have a rewrite
    const factIndices = facts
      .map((f, i) => ({ fact: f, index: i }))
      .filter(({ fact }) => !isEvidence(fact) && !fact.professionalRewrite)
      .map(({ index }) => index);

    if (factIndices.length === 0) {
      // All facts already have rewrites - offer to rewrite all anyway
      const allFactIndices = facts
        .map((f, i) => ({ fact: f, index: i }))
        .filter(({ fact }) => !isEvidence(fact))
        .map(({ index }) => index);

      if (allFactIndices.length === 0) return;

      if (!window.confirm('All facts already have professional rewrites. Regenerate them all?')) {
        return;
      }
      factIndices.push(...allFactIndices);
    }

    setIsRewritingAll(true);
    setRewriteAllProgress({ current: 0, total: factIndices.length });

    for (let i = 0; i < factIndices.length; i++) {
      setRewriteAllProgress({ current: i + 1, total: factIndices.length });
      try {
        await requestProfessionalRewrite(factIndices[i]);
      } catch (error) {
        console.error(`Failed to rewrite fact ${factIndices[i]}:`, error);
        // Continue with remaining facts
      }
    }

    setIsRewritingAll(false);
    setRewriteAllProgress({ current: 0, total: 0 });
  };

  // Apply professional rewrite
  const applyProfessionalRewrite = async (index, rewrite) => {
    try {
      // Use ref to get LATEST facts and avoid stale closure state
      const updatedFacts = [...latestDocumentRef.current.facts];
      const currentFact = updatedFacts[index];

      if (typeof currentFact === 'object' && currentFact !== null) {
        updatedFacts[index] = {
          ...currentFact,
          content: rewrite,
          professionalRewrite: rewrite,
          // Preserve originalContent and initialRewrite (never change)
          originalContent: currentFact.originalContent || currentFact.content,
          initialRewrite: currentFact.initialRewrite || currentFact.professionalRewrite,
          lastEdited: new Date().toISOString()
        };
      } else {
        // Handle legacy string facts
        updatedFacts[index] = {
          content: rewrite,
          originalContent: currentFact,
          initialRewrite: rewrite,
          professionalRewrite: rewrite,
          category: 'general',
          lastEdited: new Date().toISOString()
        };
      }

      // updateDocumentData triggers preview regeneration AND an immediate save
      // for fact changes (inside DocumentContext), so no need to call saveDocument again
      updateDocumentData({ facts: updatedFacts });
    } catch (error) {
      console.error('Failed to apply professional rewrite:', error);
    }
  };

  // Start editing
  const startEditingFact = (index) => {
    const fact = currentDocument.facts[index];
    const factContent = typeof fact === 'string' ? fact : fact.content || '';
    setEditingFactIndex(index);
    setEditedFactContent(factContent);
  };

  // Save edited fact
  const saveEditedFact = async () => {
    if (editingFactIndex === null) return;

    const updatedFacts = [...currentDocument.facts];
    const currentFact = updatedFacts[editingFactIndex];

    if (typeof currentFact === 'object' && currentFact !== null) {
      updatedFacts[editingFactIndex] = {
        ...currentFact,
        content: editedFactContent,
        lastEdited: new Date().toISOString()
      };
    } else {
      updatedFacts[editingFactIndex] = editedFactContent;
    }

    // ✅ FIX: Update state first
    updateDocumentData({ facts: updatedFacts });
    setEditingFactIndex(null);
    setEditedFactContent('');

    try {
      // ✅ FIX: Pass the updated facts directly to saveDocument
      await saveDocument({ facts: updatedFacts });
    } catch (error) {
      console.error('Failed to save fact:', error);
    }
  };

  // Cancel editing
  const cancelEditingFact = () => {
    setEditingFactIndex(null);
    setEditedFactContent('');
  };

  // Delete fact
  const deleteFact = async (index) => {
    if (!window.confirm('Are you sure you want to delete this fact?')) return;

    const updatedFacts = currentDocument.facts.filter((_, i) => i !== index);

    // ✅ FIX: Update state first
    updateDocumentData({ facts: updatedFacts });

    try {
      // ✅ FIX: Pass the updated facts directly to saveDocument
      await saveDocument({ facts: updatedFacts });
    } catch (error) {
      console.error('Failed to delete fact:', error);
    }
  };

  // ===== EVIDENCE HANDLERS =====

  // Add new evidence
  const addNewEvidence = () => {
    const newEvidence = createEvidencePlaceholder({
      description: ''
    });

    console.log('📌 Adding new evidence:', newEvidence);
    console.log('📌 Current facts before add:', currentDocument.facts?.map(f => ({
      id: f.id,
      type: f.type,
      content: f.content?.substring(0, 30)
    })));

    let updatedFacts = [...(currentDocument.facts || []), newEvidence];

    console.log('📌 Facts after adding, before recalc:', updatedFacts.map(f => ({
      id: f.id,
      type: f.type,
      content: f.content?.substring(0, 30)
    })));

    // Recalculate exhibit labels
    updatedFacts = calculateExhibitLabels(updatedFacts, { style: 'letters' });

    console.log('📌 Facts after recalc:', updatedFacts.map(f => ({
      id: f.id,
      type: f.type,
      content: f.content?.substring(0, 30)
    })));

    updateDocumentData({ facts: updatedFacts });

    // Auto-open for editing
    setEditingEvidenceIndex(updatedFacts.length - 1);
    setEditedEvidenceDescription('');
  };

  // Start editing evidence
  const startEditingEvidence = (index) => {
    const item = currentDocument.facts[index];
    if (isEvidence(item)) {
      const description = item.evidenceData?.description || '';
      setEditingEvidenceIndex(index);
      setEditedEvidenceDescription(description);
    }
  };

  // Save edited evidence
  const saveEditedEvidence = async () => {
    if (editingEvidenceIndex === null) return;

    let updatedFacts = [...currentDocument.facts];
    const currentItem = updatedFacts[editingEvidenceIndex];

    if (isEvidence(currentItem)) {
      updatedFacts[editingEvidenceIndex] = {
        ...currentItem,
        evidenceData: {
          ...currentItem.evidenceData,
          description: editedEvidenceDescription
        },
        content: `I attach as Exhibit ${currentItem.evidenceData?.exhibitLabel || '[TBD]'} ${editedEvidenceDescription}.`
      };
    }

    // Recalculate exhibit labels
    updatedFacts = calculateExhibitLabels(updatedFacts, { style: 'letters' });

    updateDocumentData({ facts: updatedFacts });
    setEditingEvidenceIndex(null);
    setEditedEvidenceDescription('');

    try {
      await saveDocument({ facts: updatedFacts });
    } catch (error) {
      console.error('Failed to save evidence:', error);
    }
  };

  // Cancel editing evidence
  const cancelEditingEvidence = () => {
    setEditingEvidenceIndex(null);
    setEditedEvidenceDescription('');
  };

  // Delete evidence
  const deleteEvidence = async (index) => {
    if (!window.confirm('Are you sure you want to delete this evidence?')) return;

    let updatedFacts = currentDocument.facts.filter((_, i) => i !== index);

    // Recalculate exhibit labels
    updatedFacts = calculateExhibitLabels(updatedFacts, { style: 'letters' });

    updateDocumentData({ facts: updatedFacts });

    try {
      await saveDocument({ facts: updatedFacts });
    } catch (error) {
      console.error('Failed to delete evidence:', error);
    }
  };

  // Open upload modal for evidence
  const openEvidenceUpload = (evidence) => {
    setCurrentEvidence(evidence);
    setShowEvidenceUpload(true);
  };

  // Handle successful upload
  const handleUploadSuccess = (updatedEvidence) => {
    console.log('✅ Evidence uploaded:', updatedEvidence);
    console.log('📌 Current evidence ID:', currentEvidence?.id);
    console.log('📌 Updated evidence ID:', updatedEvidence?.id);
    console.log('📌 Current facts before update:', currentDocument.facts?.map(f => ({
      id: f.id,
      type: f.type,
      content: f.content?.substring(0, 30)
    })));

    // Update the fact in the document by matching ID (not reference)
    let updatedFacts = (currentDocument.facts || []).map(fact => {
      const isMatch = fact.id === currentEvidence?.id;
      if (isMatch) {
        console.log('📌 Found matching fact to update:', fact.id);
      }
      return isMatch ? updatedEvidence : fact;
    });

    console.log('📌 Facts after update, before recalc:', updatedFacts.map(f => ({
      id: f.id,
      type: f.type,
      content: f.content?.substring(0, 30)
    })));

    // Recalculate exhibit labels
    updatedFacts = calculateExhibitLabels(updatedFacts, { style: 'letters' });

    console.log('📌 Facts after recalc:', updatedFacts.map(f => ({
      id: f.id,
      type: f.type,
      content: f.content?.substring(0, 30)
    })));

    updateDocumentData({ facts: updatedFacts });
    setShowEvidenceUpload(false);
  };

  // Detect divorce document type (read-only order, no reorder/rewrite)
  const isDivorceDocument = currentDocument.documentType === 'divorce_package' ||
    currentDocument.documentType === 'divorce_petition' ||
    currentDocument.documentType === 'divorce_decree';

  // Count facts and evidence separately
  const factCount = currentDocument.facts?.filter(f => !isEvidence(f)).length || 0;
  const evidenceCount = currentDocument.facts?.filter(f => isEvidence(f)).length || 0;

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            {isDivorceDocument ? 'Divorce Facts' : 'Facts & Evidence'}
          </h3>
          {!isDivorceDocument && (
            <button
              onClick={addNewEvidence}
              className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
              title="Add evidence"
            >
              <FilePlus className="h-4 w-4" />
              Add Evidence
            </button>
          )}
        </div>
        <p className="text-sm text-gray-600 mt-2">
          {isDivorceDocument
            ? `${factCount} fact${factCount !== 1 ? 's' : ''}`
            : `${factCount} fact${factCount !== 1 ? 's' : ''} • ${evidenceCount} exhibit${evidenceCount !== 1 ? 's' : ''}`
          }
        </p>
        {/* Rewrite All Facts button - not for divorce docs */}
        {!isDivorceDocument && factCount > 0 && (
          <button
            onClick={rewriteAllFacts}
            disabled={isRewritingAll || generatingRewrite.size > 0}
            className="mt-2 w-full flex items-center justify-center gap-2 px-3 py-1.5 bg-purple-50 text-purple-700 text-sm rounded-lg border border-purple-200 hover:bg-purple-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title="Professionally rewrite all facts"
          >
            {isRewritingAll ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Rewriting {rewriteAllProgress.current}/{rewriteAllProgress.total}...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Rewrite All Facts
              </>
            )}
          </button>
        )}
        {!isDivorceDocument && (
          <p className="text-xs text-gray-500 mt-1">
            Drag to reorder
          </p>
        )}
      </div>

      {/* Facts & Evidence List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {currentDocument.facts && currentDocument.facts.length > 0 ? (
          isDivorceDocument ? (
            /* Divorce documents: simple read-only list (no drag/reorder) */
            currentDocument.facts.filter(f => !isEvidence(f)).map((item, index) => {
              const content = typeof item === 'string' ? item : item?.content || '';
              const category = typeof item === 'object' && item?.category ? item.category : null;
              const actualIndex = currentDocument.facts.indexOf(item);
              const isEditing = editingFactIndex === actualIndex;

              return (
                <div
                  key={item.id || `divorce-fact-${index}`}
                  className="p-3 border border-gray-200 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-500">
                        #{index + 1}
                      </span>
                      {category && (
                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                          {category}
                        </span>
                      )}
                    </div>
                    {!isEditing && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => startEditingFact(actualIndex)}
                          className="p-1 text-gray-500 hover:text-blue-600 rounded transition-colors"
                          title="Edit fact"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => deleteFact(actualIndex)}
                          className="p-1 text-gray-500 hover:text-red-600 rounded transition-colors"
                          title="Delete fact"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                  {isEditing ? (
                    <div className="space-y-2">
                      <textarea
                        value={editedFactContent}
                        onChange={(e) => setEditedFactContent(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                        rows={3}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={saveEditedFact}
                          className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 flex items-center gap-1"
                        >
                          <Save className="h-3 w-3" />
                          Save
                        </button>
                        <button
                          onClick={cancelEditingFact}
                          className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300 flex items-center gap-1"
                        >
                          <X className="h-3 w-3" />
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-gray-800">{content}</p>
                  )}
                </div>
              );
            })
          ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={currentDocument.facts.map((item, idx) => {
                // Generate unique ID for each item
                if (isEvidence(item)) {
                  return item.id || `evidence-${idx}`;
                } else {
                  return item.id || `fact-${idx}`;
                }
              })}
              strategy={verticalListSortingStrategy}
            >
              {currentDocument.facts.map((item, index) => {
                // Render evidence card or fact card based on type
                if (isEvidence(item)) {
                  return (
                    <DraggableEvidenceCard
                      key={item.id || `evidence-${index}`}
                      evidence={item}
                      index={index}
                      totalFacts={currentDocument.facts.length}
                      isEditing={editingEvidenceIndex === index}
                      editedDescription={editedEvidenceDescription}
                      onEdit={startEditingEvidence}
                      onSave={saveEditedEvidence}
                      onCancel={cancelEditingEvidence}
                      onDelete={deleteEvidence}
                      onUpload={openEvidenceUpload}
                      onDescriptionChange={setEditedEvidenceDescription}
                      onMoveUp={handleMoveUp}
                      onMoveDown={handleMoveDown}
                    />
                  );
                } else {
                  return (
                    <DraggableFactCard
                      key={item.id || `fact-${index}`}
                      fact={item}
                      index={index}
                      totalFacts={currentDocument.facts.length}
                      isEditing={editingFactIndex === index}
                      isGenerating={generatingRewrite.has(index)}
                      editedFactContent={editedFactContent}
                      onEdit={startEditingFact}
                      onSave={saveEditedFact}
                      onCancel={cancelEditingFact}
                      onDelete={deleteFact}
                      onRequestRewrite={requestProfessionalRewrite}
                      onApplyRewrite={applyProfessionalRewrite}
                      onContentChange={setEditedFactContent}
                      onMoveUp={handleMoveUp}
                      onMoveDown={handleMoveDown}
                    />
                  );
                }
              })}
            </SortableContext>
          </DndContext>
          )
        ) : (
          <div className="text-center text-gray-500 py-8">
            <Info className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{isDivorceDocument ? 'No divorce facts added yet' : 'No facts or evidence added yet'}</p>
            <p className="text-xs mt-1">{isDivorceDocument ? 'Start chatting to add facts about your divorce' : 'Start chatting to add facts, or click "Add Evidence" to attach exhibits'}</p>
          </div>
        )}
      </div>

      {/* Requirements Section */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <h4 className="text-sm font-medium text-gray-700 mb-2">Requirements</h4>
        <div className="space-y-1">
          <div className="flex items-center text-sm">
            {currentDocument.affiantName ? (
              <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
            ) : (
              <XCircle className="h-4 w-4 text-gray-300 mr-2" />
            )}
            <span className={currentDocument.affiantName ? 'text-gray-700' : 'text-gray-400'}>
              Name provided
            </span>
          </div>
          <div className="flex items-center text-sm">
            {currentDocument.state ? (
              <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
            ) : (
              <XCircle className="h-4 w-4 text-gray-300 mr-2" />
            )}
            <span className={currentDocument.state ? 'text-gray-700' : 'text-gray-400'}>
              State selected
            </span>
          </div>
          <div className="flex items-center text-sm">
            {factCount >= 3 ? (
              <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
            ) : (
              <XCircle className="h-4 w-4 text-gray-300 mr-2" />
            )}
            <span className={factCount >= 3 ? 'text-gray-700' : 'text-gray-400'}>
              At least 3 facts ({factCount}/3)
            </span>
          </div>
          {/* Evidence upload requirement */}
          {evidenceCount > 0 && (
            <div className="flex items-center text-sm">
              {currentDocument.facts?.filter(f => isEvidence(f)).every(e => evidenceHasFile(e)) ? (
                <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-yellow-500 mr-2" />
              )}
              <span className={
                currentDocument.facts?.filter(f => isEvidence(f)).every(e => evidenceHasFile(e))
                  ? 'text-gray-700'
                  : 'text-yellow-700'
              }>
                All evidence files uploaded (
                {currentDocument.facts?.filter(f => isEvidence(f) && evidenceHasFile(f)).length}/{evidenceCount}
                )
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Evidence Upload Modal */}
      <EvidenceUploadModal
        isOpen={showEvidenceUpload}
        onClose={() => setShowEvidenceUpload(false)}
        onUploadSuccess={handleUploadSuccess}
        evidence={currentEvidence}
        documentId={currentDocument?.documentId}
      />
    </div>
  );
};

export default ValidationSidebar;
