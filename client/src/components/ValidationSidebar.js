// client/src/components/ValidationSidebar.js - WITH DRAG & DROP
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
  GripVertical  // ✅ Drag handle icon
} from 'lucide-react';
import { useAuth0 } from '@auth0/auth0-react';
import { useDocumentState, useDocumentActions } from '../contexts/DocumentContext';

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
  isEditing, 
  isGenerating,
  editedFactContent,
  onEdit,
  onSave,
  onCancel,
  onDelete,
  onRequestRewrite,
  onApplyRewrite,
  onContentChange
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

// ✅ Main ValidationSidebar Component
const ValidationSidebar = () => {
  const { currentDocument, isValidating } = useDocumentState();
  const { updateDocumentData, updateDocumentDataWithoutPreview, saveDocument } = useDocumentActions();
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();

  const [editingFactIndex, setEditingFactIndex] = useState(null);
  const [editedFactContent, setEditedFactContent] = useState('');
  const [generatingRewrite, setGeneratingRewrite] = useState(new Set());

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

  // ✅ Handle drag end
  const handleDragEnd = async (event) => {
    const { active, over } = event;

    if (active.id !== over.id) {
      const oldIndex = currentDocument.facts.findIndex(
        (fact, idx) => (fact.id || `fact-${idx}`) === active.id
      );
      const newIndex = currentDocument.facts.findIndex(
        (fact, idx) => (fact.id || `fact-${idx}`) === over.id
      );

      const reorderedFacts = arrayMove(currentDocument.facts, oldIndex, newIndex);
      
      updateDocumentData({ facts: reorderedFacts });
      
      try {
        await saveDocument();
      } catch (error) {
        console.error('Failed to save reordered facts:', error);
      }
    }
  };

  // Request professional rewrite
  const requestProfessionalRewrite = async (index) => {
    // Wait for any previous rewrite operations to complete (prevent race conditions)
    await rewriteLockRef.current;

    // Create a promise for this operation and update the lock
    const operationPromise = (async () => {
      // Read from ref to get the LATEST facts array
      const fact = latestDocumentRef.current.facts[index];

      try {
        setGeneratingRewrite(prev => new Set(prev).add(index));
      
      const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      
      let headers = { 'Content-Type': 'application/json' };
      if (isAuthenticated) {
        try {
          const token = await getAccessTokenSilently({
            authorizationParams: { audience: process.env.REACT_APP_AUTH0_AUDIENCE }
          });
          headers['Authorization'] = `Bearer ${token}`;
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
            // Set initialRewrite only if this is the first time (preserve existing initialRewrite)
            initialRewrite: currentFact.initialRewrite || data.professionalRewrite,
            // Ensure originalContent is preserved
            originalContent: currentFact.originalContent || currentFact.content,
            hasRewrite: true
          };
        } else {
          // Handle legacy string facts
          updatedFacts[index] = {
            content: currentFact,
            originalContent: currentFact,
            initialRewrite: data.professionalRewrite,
            professionalRewrite: data.professionalRewrite,
            category: 'general',
            hasRewrite: true
          };
        }

        // ✅ FIX: Update state WITHOUT triggering preview generation
        // Preview should only update when the rewrite is applied, not when it's generated
        updateDocumentDataWithoutPreview({ facts: updatedFacts });

        // ✅ FIX: Pass the updated facts directly to saveDocument to avoid race condition
        // This ensures we save the correct data instead of relying on potentially stale state
        await saveDocument({ facts: updatedFacts });
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

    // Update the lock to this operation's promise
    rewriteLockRef.current = operationPromise;

    return operationPromise;
  };

  // Apply professional rewrite
  const applyProfessionalRewrite = async (index, rewrite) => {
    const updatedFacts = [...currentDocument.facts];
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

    // ✅ FIX: Update state first
    updateDocumentData({ facts: updatedFacts });

    // ✅ FIX: Pass the updated facts directly to saveDocument to avoid race condition
    await saveDocument({ facts: updatedFacts });
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

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900">Facts & Validation</h3>
        <p className="text-sm text-gray-600 mt-1">
          {currentDocument.facts?.length || 0} fact{currentDocument.facts?.length !== 1 ? 's' : ''} added
        </p>
        <p className="text-xs text-gray-500 mt-1">
          ⚡ Drag to reorder
        </p>
      </div>

      {/* Facts List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {currentDocument.facts && currentDocument.facts.length > 0 ? (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={currentDocument.facts.map((fact, idx) => fact.id || `fact-${idx}`)}
              strategy={verticalListSortingStrategy}
            >
              {currentDocument.facts.map((fact, index) => (
                <DraggableFactCard
                  key={fact.id || `fact-${index}`}
                  fact={fact}
                  index={index}
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
                />
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          <div className="text-center text-gray-500 py-8">
            <Info className="h-12 w-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No facts added yet</p>
            <p className="text-xs mt-1">Start chatting to add facts</p>
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
            {currentDocument.facts?.length >= 3 ? (
              <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
            ) : (
              <XCircle className="h-4 w-4 text-gray-300 mr-2" />
            )}
            <span className={currentDocument.facts?.length >= 3 ? 'text-gray-700' : 'text-gray-400'}>
              At least 3 facts ({currentDocument.facts?.length || 0}/3)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ValidationSidebar;
