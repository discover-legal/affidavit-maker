# Pull Request: Add Evidence/Exhibits System for Affidavit PDFs

**Branch:** `claude/add-evidence-exhibits-0116JtCdUsQaUrzmuWJZi2Jv`
**Base:** `main`
**Type:** Feature Addition

## Summary

Implements a complete evidence/exhibits system that allows users to attach supporting documents (PDFs, images) to their affidavits. Evidence items are detected by AI during conversation, uploaded through a modal interface, managed in the ValidationSidebar with drag-and-drop reordering, and automatically appended to the final PDF with state-specific formatting.

## Features Implemented

### Phase 1: Backend Infrastructure ✅
- **Evidence Storage Service** (`services/evidenceStorage.js`)
  - Local filesystem storage with S3-ready architecture
  - File type validation (PDF, JPG, PNG)
  - Size limits: 25MB per file, 100MB total
  - Automatic thumbnail generation for PDFs
  - Metadata extraction (file size, page count)

- **Evidence API Routes** (`routes/evidence.js`)
  - `POST /api/evidence/upload` - Upload evidence file with multer
  - `GET /api/evidence/:documentId/:fileKey` - Retrieve evidence file
  - `DELETE /api/evidence/:documentId/:evidenceId` - Delete evidence
  - Full Auth0 authentication and document ownership verification

- **Data Model** (`utils/factNormalizer.js`)
  - Evidence items as specialized facts with `type: 'evidence'`
  - `evidenceData` object with exhibit metadata
  - Helper functions: `isEvidence()`, `evidenceHasFile()`, `calculateExhibitLabels()`
  - **17 passing tests** for evidence normalization

### Phase 2: AI Detection & Upload Modal ✅
- **AI Evidence Detection** (`services/affidavitService.js`)
  - Enhanced system prompt to detect document mentions
  - Strict enforcement: **ONE evidence item per document mentioned**
  - Handles explicit quantities ("I have 2 letters" → creates 2 evidence items)
  - Function schema with `is_evidence`, `evidence_description` fields
  - Returns evidence items with proper `type: 'evidence'` field

- **Evidence Upload Modal** (`client/src/components/EvidenceUploadModal.js`)
  - Drag-and-drop file upload interface
  - Real-time file validation and preview
  - State reset on open/close to prevent modal state bugs
  - Shows upload progress and success/error states

- **Chat Integration** (`client/src/components/ChatInterface.js`)
  - Inline upload buttons appear below bot messages
  - Each evidence item gets its own upload button
  - ID-based matching for correct evidence updates

### Phase 3: ValidationSidebar Enhancement ✅
- **DraggableEvidenceCard Component**
  - Blue-themed cards (distinct from gray fact cards)
  - Display exhibit label (A, B, C...)
  - File upload status indicators (green=uploaded, yellow=pending)
  - Edit description, delete, and upload actions

- **Unified Drag-and-Drop**
  - Facts and evidence in single sortable list
  - Auto-recalculation of exhibit labels on reorder
  - Seamless drag between facts and evidence

- **"Add Evidence" Button**
  - FilePlus icon button in sidebar header
  - Creates evidence placeholder with auto-edit mode
  - Exhibit labels assigned automatically

- **Requirements Checklist**
  - Tracks evidence upload progress (X/Y files uploaded)
  - Warning indicator if evidence files pending
  - Separate counts for facts and exhibits

### Phase 4: PDF Generation with Exhibits ✅
- **State-Specific Exhibit Rules** (`templates/StateTemplateManager.js`)
  - **Texas**: Letters (A, B, C...), cover pages **REQUIRED**
  - **Utah**: Letters (A, B, C...), cover pages **RECOMMENDED**
  - **Arizona**: Letters (A, B, C...), cover pages **REQUIRED**
  - `getExhibitRules()` method on all state templates

- **PDF Exhibit Attachment** (`services/pdfService.js`)
  - Three-pass PDF generation:
    1. Pass 1: Count pages (existing)
    2. Pass 2: Generate affidavit with footers (existing)
    3. Pass 3: **NEW** - Append exhibits after affidavit

- **Exhibit Cover Pages**
  - Auto-generated using PDFKit
  - Centered exhibit letter (EXHIBIT A, EXHIBIT B...)
  - Description displayed below title
  - Only created for states that require them

- **PDF Merging & Image Embedding**
  - PDF exhibits merged page-by-page using `pdf-lib`
  - JPG/PNG images embedded and scaled to fit
  - Maintains aspect ratio with 1-inch margins
  - Graceful error handling (returns original PDF if attachment fails)

## Bug Fixes

1. **documentId Field Name** (`3d8395f`)
   - Fixed: Upload validation failed because `currentDocument.id` → `currentDocument.documentId`

2. **Evidence Type Preservation** (`528825c`)
   - Fixed: Backend was returning raw `extractedFacts` instead of `processedFacts` with `type` field
   - Critical bug that prevented evidence detection from working

3. **Evidence ID Matching** (`2dbeda7`)
   - Fixed: Upload success handlers used `===` reference equality instead of ID matching
   - Caused uploads from chat to fail silently

4. **Client-Side factNormalizer** (`cb5eb16`)
   - Fixed: React doesn't allow imports outside `src/` directory
   - Created client-side version of evidence helper functions

5. **Database Pool Initialization** (`2639506`)
   - Fixed: Race condition where routes loaded before `app.locals.pool` was set
   - Moved pool assignment before `initializeServices()` call

6. **AI Prompt Enhancements** (`3cb1896`, `70847c7`)
   - Fixed: AI wasn't creating separate evidence items for each document
   - Added explicit examples: "2 letters" → 2 evidence items

7. **Evidence Type Preservation in PDF Generation** (`8a2118e`)
   - Fixed: `StateTemplateManager.processFactsForDocument()` was hardcoding `type: 'fact'` for ALL facts
   - This destroyed evidence metadata during PDF generation
   - Solution: Preserve original `type` field and copy `evidenceData`, `id`, `category` for evidence items
   - Critical bug that prevented exhibit attachment from working

8. **StateTemplateManager Import Error** (`77535a8`)
   - Fixed: `TypeError: StateTemplateManager is not a constructor` in pdfService.js
   - StateTemplateManager is exported as named export, not default export
   - Changed from `const StateTemplateManager = require(...)` to `const { StateTemplateManager } = require(...)`

## Testing

- ✅ 17 unit tests for evidence normalization
- ✅ File upload with validation (type, size limits)
- ✅ Multiple evidence items from single chat message
- ✅ Drag-and-drop reordering updates exhibit labels
- ✅ PDF generation with exhibits (manual testing)

## Database Changes

**None** - Evidence leverages existing JSONB `content` field in `documents` table. No schema migrations required.

## Dependencies Added

- `multer` - File upload middleware
- `pdf-lib` - PDF merging and manipulation

## Breaking Changes

None - This is a purely additive feature. Existing affidavits without evidence continue to work unchanged.

## How to Test

1. **AI Evidence Detection:**
   - Start a new affidavit
   - Say "I have a bank statement and a pay stub"
   - Verify 2 upload buttons appear (one for each document)

2. **File Upload:**
   - Click an upload button
   - Drag a PDF/JPG/PNG file onto the modal
   - Verify upload succeeds and shows green checkmark

3. **ValidationSidebar:**
   - Navigate to ValidationSidebar (right panel)
   - Click "Add Evidence" button
   - Verify evidence card appears with upload status
   - Drag evidence items to reorder
   - Verify exhibit labels update (A, B, C...)

4. **PDF Generation:**
   - Create an affidavit with facts and evidence
   - Upload evidence files
   - Download PDF
   - Verify exhibits appear after affidavit with cover pages (TX/AZ)

## Commits

18 commits from `253b785` to `77535a8`:

```
77535a8 fix: Use destructuring for StateTemplateManager import in pdfService
8a2118e fix: Preserve evidence type and metadata in StateTemplateManager
75e6a33 fix: Correct facts access and file path for exhibit attachment
2639506 fix: Set database pool before route initialization
6e6e7f8 feat: Add exhibit attachment to PDF generation
872da1c feat: Add state-specific exhibit rules to StateTemplateManager
70847c7 fix: Strengthen evidence prompt to handle explicit quantities
3cb1896 fix: Enforce one evidence item per document in AI prompt
2dbeda7 fix: Use ID matching instead of reference equality for evidence updates
cb5eb16 fix: Create client-side factNormalizer and fix import path
2add8fd feat: Phase 3 - Add ValidationSidebar evidence support
3d8395f fix: Correct documentId field name in EvidenceUploadModal
9ee984a fix: Reset modal state and add upload debugging
4743007 feat: Add inline upload button in chat instead of auto-popup modal
528825c fix: Return processedFacts instead of extractedFacts to preserve type field
5709377 debug: Add comprehensive logging for evidence detection
fe048e4 fix: Resolve ESLint warning in EvidenceUploadModal
253b785 feat: Add evidence upload system - Phase 1 & 2
```

## Files Changed

### New Files
- `services/evidenceStorage.js` - Evidence file storage service
- `routes/evidence.js` - Evidence API routes
- `client/src/components/EvidenceUploadModal.js` - Upload modal component
- `client/src/utils/factNormalizer.js` - Client-side evidence helpers
- `__tests__/utils/factNormalizer.evidence.test.js` - Evidence tests

### Modified Files
- `utils/factNormalizer.js` - Added evidence helper functions
- `services/affidavitService.js` - Enhanced AI prompt for evidence detection
- `services/pdfService.js` - Added exhibit attachment functionality
- `templates/StateTemplateManager.js` - Added state-specific exhibit rules
- `client/src/components/ChatInterface.js` - Inline upload buttons
- `client/src/components/ValidationSidebar.js` - Evidence card UI
- `server.js` - Evidence routes, database pool fix
- `package.json` - Added multer and pdf-lib dependencies

## Next Steps

Future enhancements could include:
- Evidence validation before PDF generation (block if files missing)
- Bulk evidence upload (select multiple files at once)
- Evidence file preview in modal (thumbnail for PDFs/images)
- S3 storage integration for production environments
- Evidence reuse across multiple affidavits

---

**Ready for review and merge!** 🚀
