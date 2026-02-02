# Divorce Package Integration Roadmap

**Created**: 2026-02-02
**Status**: Planning Phase
**Scope**: Integration of divorce petition and decree templates for 7 states (TX, UT, AZ, CA, FL, IL, NY)

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Current State Assessment](#current-state-assessment)
3. [Legal Requirements Verification](#legal-requirements-verification)
4. [Integration Phases](#integration-phases)
5. [Phase 1: Template System Enhancement](#phase-1-template-system-enhancement)
6. [Phase 2: Base Template Completion](#phase-2-base-template-completion)
7. [Phase 3: State Template Implementation](#phase-3-state-template-implementation)
8. [Phase 4: API Integration](#phase-4-api-integration)
9. [Phase 5: Frontend Integration](#phase-5-frontend-integration)
10. [Phase 6: AI Chat Integration](#phase-6-ai-chat-integration)
11. [Phase 7: Testing & QA](#phase-7-testing--qa)
12. [Phase 8: Documentation & Deployment](#phase-8-documentation--deployment)
13. [Risk Assessment](#risk-assessment)
14. [Dependencies](#dependencies)
15. [Success Criteria](#success-criteria)

---

## Executive Summary

This roadmap outlines the integration of divorce document packages into the existing Affidavit Maker platform. The work builds on completed research and initial template creation for all 7 supported states.

### What's Already Done
- Comprehensive legal research for all 7 states (`docs/DIVORCE_PACKAGE_RESEARCH.md`)
- Base template classes (`BaseDivorcePetitionTemplate.js`, `BaseDivorceDecreeTemplate.js`)
- State-specific petition templates for all 7 states
- Divorce metadata files for all 7 states with legal citations and requirements

### What Needs to Be Done
- Template system enhancement to support multiple document types per state
- Complete state-specific decree templates
- API route additions for divorce-specific endpoints
- Frontend form updates for divorce data collection
- AI chat system prompt modifications
- Comprehensive testing across all states

---

## Current State Assessment

### Existing Infrastructure Readiness

| Component | Status | Notes |
|-----------|--------|-------|
| Database Schema | Ready | `document_type` field accepts any string |
| TemplateRegistry | Needs Enhancement | Currently single-type per state |
| TemplateLoader | Needs Enhancement | Only discovers `AffidavitTemplate.js` |
| PDF Service | Ready | Generic document structure support |
| Preview Renderer | Ready | Works with any section structure |
| Payment Processing | Ready | `family_law_package` pricing exists ($119.99) |
| Authentication | Ready | No changes needed |
| Rate Limiting | Ready | No changes needed |

### Files Created (Already Committed)

```
templates/core/
├── BaseDivorcePetitionTemplate.js   ✓ Created
└── BaseDivorceDecreeTemplate.js     ✓ Created

templates/states/
├── texas/
│   ├── DivorcePetitionTemplate.js   ✓ Created
│   ├── DivorceDecreeTemplate.js     ✓ Created
│   └── divorce-metadata.json        ✓ Created
├── utah/
│   ├── DivorcePetitionTemplate.js   ✓ Created
│   └── divorce-metadata.json        ✓ Created
├── california/
│   ├── DivorcePetitionTemplate.js   ✓ Created
│   └── divorce-metadata.json        ✓ Created
├── arizona/
│   ├── DivorcePetitionTemplate.js   ✓ Created
│   └── divorce-metadata.json        ✓ Created
├── florida/
│   ├── DivorcePetitionTemplate.js   ✓ Created
│   └── divorce-metadata.json        ✓ Created
├── illinois/
│   ├── DivorcePetitionTemplate.js   ✓ Created
│   └── divorce-metadata.json        ✓ Created
└── new-york/
    ├── DivorcePetitionTemplate.js   ✓ Created
    └── divorce-metadata.json        ✓ Created
```

---

## Legal Requirements Verification

Legal requirements have been verified as of 2026-02-02. All template data matches current state laws.

### State-by-State Summary

| State | Residency | Waiting Period | Primary Ground | Key Forms |
|-------|-----------|----------------|----------------|-----------|
| **Texas** | 6 mo state + 90 days county | 60 days | Insupportability | Original Petition |
| **Utah** | 90 days county | 30 days | Irreconcilable differences | Verified Petition |
| **Arizona** | 90 days state | 60 days | Irretrievably broken | DRDA10f |
| **California** | 6 mo state | 6 months | Irreconcilable differences | FL-100 |
| **Florida** | 6 mo state | None (simplified) | Irretrievably broken | 12.901(a) |
| **Illinois** | 90 days state | None (if agreed) | Irreconcilable differences | Petition |
| **New York** | 1-2 years (varies) | None | Irretrievable breakdown | UD-2 |

### Recent Law Changes to Note

1. **New York (January 2025)**: Joint filing now available for uncontested divorces
2. **New York (February 2025)**: New venue rules (CPLR 515) - must file where party or minor child resides
3. **Illinois (January 2025)**: Maintenance continues during incarceration

### Sources Verified
- Texas: Texas Family Code § 6.301, § 6.702
- California: California Family Code § 2339, Forms FL-100 series
- New York: DRL § 170(7), new joint filing procedures
- Florida: Florida Statutes § 61.021, Rule 12.105
- Illinois: 750 ILCS 5/401, IMDMA amendments
- Arizona: A.R.S. § 25-312, covenant marriage provisions
- Utah: Utah Code § 81-4-402

---

## Integration Phases

### Overview Timeline

```
Phase 1: Template System Enhancement     ████████░░░░░░░░
Phase 2: Base Template Completion        ████░░░░░░░░░░░░
Phase 3: State Template Implementation   ████████████░░░░
Phase 4: API Integration                 ████████░░░░░░░░
Phase 5: Frontend Integration            ████████████░░░░
Phase 6: AI Chat Integration             ████░░░░░░░░░░░░
Phase 7: Testing & QA                    ████████████░░░░
Phase 8: Documentation & Deployment      ████░░░░░░░░░░░░
```

### Phase Dependencies

```
Phase 1 ─┬─> Phase 2 ─┬─> Phase 3 ─┬─> Phase 7
         │            │            │
         └─> Phase 4 ─┴─> Phase 5 ─┤
                      │            │
                      └─> Phase 6 ─┘
                                   │
                                   └─> Phase 8
```

---

## Phase 1: Template System Enhancement

**Goal**: Modify TemplateRegistry and TemplateLoader to support multiple document types per state.

### 1.1 TemplateRegistry Modifications

**Current Structure** (`templates/core/TemplateRegistry.js`):
```javascript
// Current: Single template per state
Map<stateCode, { template, metadata }>
```

**Required Structure**:
```javascript
// New: Multiple document types per state
Map<stateCode, Map<documentType, { template, metadata }>>

// Or flat structure with composite key:
Map<`${stateCode}_${documentType}`, { template, metadata }>
```

**Methods to Modify**:

| Method | Current | Required Change |
|--------|---------|-----------------|
| `register(stateCode, Template, metadata)` | Registers single template | Add `documentType` parameter |
| `get(stateCode)` | Returns single template | Add `documentType` parameter |
| `has(stateCode)` | Checks single template | Add `documentType` parameter |
| `getMetadata(stateCode)` | Returns single metadata | Add `documentType` parameter |
| `getSupportedStates()` | Returns state list | No change needed |
| NEW: `getDocumentTypes(stateCode)` | N/A | Return available doc types for state |
| NEW: `getSupportedDocuments()` | N/A | Return all state/type combinations |

**Proposed API**:
```javascript
// Registration
registry.register('TX', 'affidavit', AffidavitTemplate, affidavitMetadata);
registry.register('TX', 'divorce_petition', DivorcePetitionTemplate, divorceMetadata);
registry.register('TX', 'divorce_decree', DivorceDecreeTemplate, decreeMetadata);

// Retrieval
const template = registry.get('TX', 'divorce_petition');
const metadata = registry.getMetadata('TX', 'divorce_petition');
const docTypes = registry.getDocumentTypes('TX'); // ['affidavit', 'divorce_petition', 'divorce_decree']

// Backwards compatibility
const affidavitTemplate = registry.get('TX'); // Defaults to 'affidavit'
```

### 1.2 TemplateLoader Modifications

**Current Discovery Pattern** (`templates/core/TemplateLoader.js`):
```javascript
// Only looks for:
// - metadata.json
// - AffidavitTemplate.js
```

**Required Discovery Pattern**:
```javascript
// Discover all template types:
// - metadata.json → affidavit
// - AffidavitTemplate.js → affidavit
// - divorce-metadata.json → divorce_petition, divorce_decree
// - DivorcePetitionTemplate.js → divorce_petition
// - DivorceDecreeTemplate.js → divorce_decree
```

**Implementation Approach**:
```javascript
async loadStateTemplate(stateName, registry) {
  const stateDir = path.join(this.statesDir, stateName);

  // 1. Load affidavit template (existing behavior)
  await this.loadDocumentType(stateDir, stateName, registry, {
    metadataFile: 'metadata.json',
    templateFile: 'AffidavitTemplate.js',
    documentType: 'affidavit'
  });

  // 2. Load divorce petition template
  await this.loadDocumentType(stateDir, stateName, registry, {
    metadataFile: 'divorce-metadata.json',
    templateFile: 'DivorcePetitionTemplate.js',
    documentType: 'divorce_petition'
  });

  // 3. Load divorce decree template
  await this.loadDocumentType(stateDir, stateName, registry, {
    metadataFile: 'divorce-metadata.json', // Same metadata
    templateFile: 'DivorceDecreeTemplate.js',
    documentType: 'divorce_decree'
  });
}
```

### 1.3 StateTemplateManager Updates

**File**: `templates/StateTemplateManager.js`

**Required Changes**:
- Update all method signatures to accept `documentType` parameter
- Update preview generation to route to correct template
- Update PDF generation calls
- Maintain backwards compatibility for affidavits

**Methods to Update**:
- `generatePreview(state, data, documentType = 'affidavit')`
- `generatePDF(state, data, documentType = 'affidavit')`
- `validateDocument(state, data, documentType = 'affidavit')`
- `getRequirements(state, documentType = 'affidavit')`

### 1.4 Deliverables

- [ ] Modified `TemplateRegistry.js` with multi-type support
- [ ] Modified `TemplateLoader.js` with multi-file discovery
- [ ] Modified `StateTemplateManager.js` with documentType routing
- [ ] Unit tests for all modifications
- [ ] Backwards compatibility tests for existing affidavit flow

---

## Phase 2: Base Template Completion

**Goal**: Review and finalize base template classes for divorce documents.

### 2.1 BaseDivorcePetitionTemplate Review

**File**: `templates/core/BaseDivorcePetitionTemplate.js`

**Required Sections**:
| Section | Status | Notes |
|---------|--------|-------|
| Case Caption | Implemented | Needs state-specific override capability |
| Parties Information | Implemented | Petitioner/Respondent details |
| Jurisdiction Statement | Implemented | Residency verification |
| Marriage Information | Implemented | Date, place, separation |
| Grounds for Divorce | Implemented | State-specific grounds |
| Children Information | Implemented | Custody, support |
| Property Division | Implemented | Community/equitable distribution |
| Spousal Support | Implemented | Alimony/maintenance |
| Relief Requested | Implemented | Prayer for relief |
| Verification/Oath | Implemented | Perjury statement |
| Signature Block | Implemented | Petitioner signature |
| Certificate of Service | Needs Review | May need state variations |

**Validation Methods to Verify**:
```javascript
validateData(data) {
  // Required fields check
  // Residency requirements check
  // Date logic validation (marriage before separation)
  // Children data if hasChildren = true
  // Property data if hasProperty = true
}
```

### 2.2 BaseDivorceDecreeTemplate Review

**File**: `templates/core/BaseDivorceDecreeTemplate.js`

**Required Sections**:
| Section | Status | Notes |
|---------|--------|-------|
| Case Caption | Implemented | Match petition |
| Appearances | Implemented | Parties present or defaulted |
| Jurisdiction Findings | Implemented | Court authority confirmed |
| Dissolution Order | Implemented | Marriage legally dissolved |
| Property Division Orders | Needs Review | Specific asset allocation |
| Child Custody Orders | Needs Review | Conservatorship terms |
| Child Support Orders | Needs Review | Payment amounts, schedules |
| Spousal Support Orders | Needs Review | Maintenance terms |
| Name Change | Implemented | Optional restoration |
| Final Orders | Implemented | Effective date |
| Judge Signature Block | Implemented | Judicial signature |

### 2.3 Additional Base Templates (Future Consideration)

Consider whether these warrant their own base classes:
- `BaseFinancialDisclosureTemplate.js` - Required in most states
- `BaseWaiverOfServiceTemplate.js` - When respondent agrees
- `BaseParentingPlanTemplate.js` - For cases with children
- `BaseMaritalSettlementAgreementTemplate.js` - Property settlement

**Recommendation**: Start with petition and decree only. Add others in future phases based on user demand.

### 2.4 Deliverables

- [ ] Reviewed and finalized `BaseDivorcePetitionTemplate.js`
- [ ] Reviewed and finalized `BaseDivorceDecreeTemplate.js`
- [ ] Method documentation (JSDoc comments)
- [ ] Unit tests for base template methods

---

## Phase 3: State Template Implementation

**Goal**: Complete all state-specific divorce templates with full legal compliance.

### 3.1 Template Completion Status

| State | Petition | Decree | Metadata | Tests |
|-------|----------|--------|----------|-------|
| Texas | ✓ Done | ✓ Done | ✓ Done | Needed |
| Utah | ✓ Done | Needed | ✓ Done | Needed |
| California | ✓ Done | Needed | ✓ Done | Needed |
| Arizona | ✓ Done | Needed | ✓ Done | Needed |
| Florida | ✓ Done | Needed | ✓ Done | Needed |
| Illinois | ✓ Done | Needed | ✓ Done | Needed |
| New York | ✓ Done | Needed | ✓ Done | Needed |

### 3.2 State-Specific Requirements

#### Texas
- **Terminology**: "Conservatorship" not "custody"
- **Case Number Label**: "CAUSE NO."
- **Special Forms**: Original Petition for Divorce
- **Property**: Community property state
- **Waiting Period**: 60 days from filing
- **Children**: Standard Possession Order references

#### Utah
- **Format**: Verified Petition (under oath)
- **Case Number Label**: "Case No."
- **Required Classes**: Divorce education + orientation
- **Waiting Period**: 30 days
- **Header Style**: Sentence case

#### California
- **Forms**: FL-100 series (FL-100, FL-110, FL-120, FL-105)
- **Disclosures**: Mandatory preliminary/final financial disclosure
- **ATROs**: Automatic Temporary Restraining Orders
- **Waiting Period**: 6 months from service
- **Declaration**: Under penalty of perjury (CCP § 2015.5)

#### Arizona
- **Format**: 14pt font required
- **Preliminary Injunction**: Automatically issued upon filing
- **Covenant Marriage**: Special handling if applicable
- **Parent Information Program**: Required for cases with children
- **Waiting Period**: 60 days from service

#### Florida
- **Simplified Dissolution**: Available if no children, no pregnancy, assets divided
- **Form Types**: 12.901(a), 12.901(b)(1), 12.901(b)(2), 12.901(b)(3)
- **Financial Affidavit**: Short form (<$50k income) or long form
- **Waiting Period**: None for simplified dissolution

#### Illinois
- **Pure No-Fault**: Only irreconcilable differences (since 2016)
- **Maintenance Formula**: Statutory calculation
- **Financial Affidavit**: Mandatory (750 ILCS 5/501(a)(1))
- **Waiting Period**: None if both agree; 6 months if contested

#### New York
- **Terminology**: "Plaintiff"/"Defendant" (not Petitioner/Respondent)
- **Case Number Label**: "Index No."
- **Forms**: UD series (UD-1 through UD-15)
- **Joint Filing**: Available since January 2025
- **Residency**: Complex (1-2 years depending on circumstances)
- **Venue**: New rules effective February 2025

### 3.3 Decree Templates to Create

Each state needs a `DivorceDecreeTemplate.js` that extends `BaseDivorceDecreeTemplate`:

```javascript
// Example: templates/states/utah/DivorceDecreeTemplate.js
const BaseDivorceDecreeTemplate = require('../../core/BaseDivorceDecreeTemplate');

class UtahDivorceDecreeTemplate extends BaseDivorceDecreeTemplate {
  constructor() {
    super();
    this.state = 'UT';
    this.documentTitle = 'DECREE OF DIVORCE';
  }

  // Override methods for Utah-specific requirements
  generateHeader(data) { /* ... */ }
  generateFindings(data) { /* ... */ }
  // etc.
}

module.exports = UtahDivorceDecreeTemplate;
```

### 3.4 Deliverables

- [ ] `DivorceDecreeTemplate.js` for Utah
- [ ] `DivorceDecreeTemplate.js` for California
- [ ] `DivorceDecreeTemplate.js` for Arizona
- [ ] `DivorceDecreeTemplate.js` for Florida
- [ ] `DivorceDecreeTemplate.js` for Illinois
- [ ] `DivorceDecreeTemplate.js` for New York
- [ ] Unit tests for all state templates
- [ ] Integration tests for template rendering

---

## Phase 4: API Integration

**Goal**: Add API endpoints for divorce document operations.

### 4.1 New Endpoints

#### Templates Routes (`routes/templates.js`)

```javascript
// Get states that support divorce documents
GET /api/templates/divorce/states
Response: {
  success: true,
  data: {
    states: ['TX', 'UT', 'AZ', 'CA', 'FL', 'IL', 'NY'],
    documentTypes: ['divorce_petition', 'divorce_decree']
  }
}

// Get divorce requirements for a state
GET /api/templates/divorce/requirements/:state
Response: {
  success: true,
  data: {
    stateCode: 'TX',
    stateName: 'Texas',
    residencyRequirements: { stateMonths: 6, countyDays: 90 },
    waitingPeriod: { days: 60, exceptions: [...] },
    groundsForDivorce: { noFault: [...], fault: [...] },
    requiredForms: [...],
    terminology: { petitioner: 'Petitioner', custody: 'Conservatorship' },
    fees: { filing: '$300-$350' }
  }
}

// Get available document types for a state
GET /api/templates/divorce/document-types/:state
Response: {
  success: true,
  data: {
    documentTypes: [
      { type: 'divorce_petition', name: 'Original Petition for Divorce', available: true },
      { type: 'divorce_decree', name: 'Final Decree of Divorce', available: true }
    ]
  }
}

// Validate divorce document data
POST /api/templates/divorce/validate
Body: { state: 'TX', documentType: 'divorce_petition', data: {...} }
Response: {
  success: true,
  data: {
    isValid: true,
    errors: [],
    warnings: ['Consider adding separation date for clarity'],
    completionPercentage: 85
  }
}
```

#### Documents Routes (`routes/documents.js`)

**Existing endpoints that need modification**:

```javascript
// POST /api/documents/save
// Already accepts documentType - verify it works with divorce types

// POST /api/documents/preview
// Needs to route to correct template based on documentType

// POST /api/documents/generate
// Needs to route to correct template for PDF generation
```

**Changes Required**:
```javascript
// In preview endpoint
const template = STATE_TEMPLATE_MANAGER.getTemplate(
  affidavitData.state,
  affidavitData.documentType || 'affidavit'  // Add documentType routing
);

// In generate endpoint
const pdf = await STATE_TEMPLATE_MANAGER.generatePDF(
  document.template_state,
  document.content,
  document.document_type || 'affidavit'  // Add documentType routing
);
```

### 4.2 Validation Middleware Updates

**File**: `middleware/validation.js`

**New Validators**:
```javascript
const validateDivorceData = [
  body('state').isIn(['TX', 'UT', 'AZ', 'CA', 'FL', 'IL', 'NY']),
  body('documentType').isIn(['divorce_petition', 'divorce_decree']),
  body('petitionerName').trim().notEmpty().isLength({ max: 255 }),
  body('respondentName').trim().notEmpty().isLength({ max: 255 }),
  body('marriageDate').isISO8601().optional(),
  body('separationDate').isISO8601().optional(),
  body('groundsForDivorce').isString().optional(),
  body('hasChildren').isBoolean().optional(),
  body('hasProperty').isBoolean().optional(),
  // Custom validation for state-specific requirements
  validateStateRequirements
];

const validateStateRequirements = (req, res, next) => {
  const { state, documentType, data } = req.body;
  const metadata = STATE_TEMPLATE_MANAGER.getMetadata(state, documentType);

  // Validate required fields per state
  for (const field of metadata.requiredFields) {
    if (!data[field]) {
      return res.status(400).json({
        success: false,
        error: `Missing required field: ${field}`,
        errorType: 'validation_error'
      });
    }
  }

  next();
};
```

### 4.3 Rate Limiting Considerations

**File**: `middleware/rateLimiting.js`

Divorce documents may need adjusted rate limits:
- Preview generation: Same as current (10/hour)
- PDF generation: Same as current (10/hour)
- Validation: May need higher limit (20/hour) for form filling

### 4.4 Deliverables

- [ ] New divorce-specific routes in `routes/templates.js`
- [ ] Updated `routes/documents.js` for documentType routing
- [ ] New validation middleware for divorce data
- [ ] API documentation updates
- [ ] Route tests for all new endpoints

---

## Phase 5: Frontend Integration

**Goal**: Add UI components for divorce document creation and management.

### 5.1 Component Architecture

**New/Modified Components**:

```
client/src/components/
├── DocumentTypeSelector.js      (NEW) - Choose affidavit vs divorce
├── DivorceForm.js              (NEW) - Main divorce form
├── DivorceFormSections/        (NEW) - Form section components
│   ├── PartiesSection.js       - Petitioner/Respondent info
│   ├── MarriageInfoSection.js  - Marriage and separation dates
│   ├── GroundsSection.js       - Grounds for divorce
│   ├── ChildrenSection.js      - Minor children information
│   ├── PropertySection.js      - Property and debt division
│   ├── SupportSection.js       - Spousal/child support
│   └── ReliefSection.js        - Prayer for relief
├── StateRequirements.js        (NEW) - Display state-specific requirements
├── DocumentPreview.js          (MODIFY) - Handle divorce document preview
└── AffidavitForm.js            (MODIFY) - Or rename to DocumentForm.js
```

### 5.2 Form Data Structure

```javascript
// DivorceForm state structure
const divorceData = {
  // Document metadata
  documentType: 'divorce_petition',
  state: 'TX',
  county: 'Travis',

  // Parties
  petitionerName: '',
  petitionerAddress: '',
  petitionerPhone: '',
  petitionerEmail: '',
  respondentName: '',
  respondentAddress: '',
  respondentKnown: true,  // For service purposes

  // Marriage information
  marriageDate: '',
  marriagePlace: '',
  separationDate: '',

  // Grounds
  groundsForDivorce: 'insupportability',  // State-specific options

  // Children
  hasChildren: false,
  children: [
    { name: '', dateOfBirth: '', livesWithPetitioner: true }
  ],
  custodyRequested: '',  // or 'conservatorship' for TX
  supportRequested: false,

  // Property
  hasProperty: false,
  hasSeparateProperty: false,
  hasCommunityProperty: false,
  propertyAgreement: false,
  propertyDetails: '',

  // Support
  requestingSpousalSupport: false,
  spousalSupportDetails: '',

  // Relief
  reliefRequested: [],

  // Filing info
  isSimplifiedDissolution: false,  // Florida
  isJointFiling: false,  // New York 2025
};
```

### 5.3 Routing Updates

**File**: `client/src/App.js`

```javascript
// New routes needed
<Route path="/divorce" element={<DivorceFlow />} />
<Route path="/divorce/new" element={<DivorceForm />} />
<Route path="/divorce/:documentId" element={<DivorceForm />} />
<Route path="/divorce/:documentId/preview" element={<DocumentPreview />} />
```

### 5.4 Context Updates

**File**: `client/src/contexts/DocumentContext.js`

**Consideration**: Rename `affidavitData` to `documentData` for clarity, or create a separate `DivorceContext.js`.

**Recommendation**: Keep single context, rename field:
```javascript
const initialState = {
  currentDocument: {
    id: null,
    title: '',
    status: 'draft',
    documentType: 'affidavit',  // or 'divorce_petition'
    documentData: {  // Renamed from affidavitData
      // Generic fields
      state: 'TX',
      county: '',
      // Document-specific fields populated based on type
    }
  }
};
```

### 5.5 Form Validation (Client-Side)

```javascript
// client/src/utils/divorceValidation.js
export const validateDivorceForm = (data, state) => {
  const errors = {};

  // Required fields
  if (!data.petitionerName) errors.petitionerName = 'Required';
  if (!data.respondentName) errors.respondentName = 'Required';
  if (!data.marriageDate) errors.marriageDate = 'Required';
  if (!data.groundsForDivorce) errors.groundsForDivorce = 'Required';

  // State-specific validation
  if (state === 'FL' && data.isSimplifiedDissolution) {
    if (data.hasChildren) {
      errors.isSimplifiedDissolution = 'Simplified dissolution not available with children';
    }
  }

  // Date validation
  if (data.marriageDate && data.separationDate) {
    if (new Date(data.separationDate) < new Date(data.marriageDate)) {
      errors.separationDate = 'Separation date cannot be before marriage date';
    }
  }

  return errors;
};
```

### 5.6 UI/UX Considerations

1. **Progressive Disclosure**: Show sections as user completes previous ones
2. **State-Aware Forms**: Change terminology and options based on selected state
3. **Tooltips/Help Text**: Explain legal terms in plain language
4. **Save Progress**: Auto-save with debouncing (existing functionality)
5. **Validation Feedback**: Real-time validation with helpful messages
6. **Document Preview**: WYSIWYG preview that updates as user types

### 5.7 Deliverables

- [ ] `DocumentTypeSelector.js` component
- [ ] `DivorceForm.js` component
- [ ] Form section components (7 total)
- [ ] `StateRequirements.js` component
- [ ] Updated routing in `App.js`
- [ ] Updated `DocumentContext.js`
- [ ] Client-side validation utilities
- [ ] Component tests
- [ ] CSS/Tailwind styling

---

## Phase 6: AI Chat Integration

**Goal**: Enable AI-assisted divorce document completion through the chat interface.

### 6.1 System Prompt Modifications

**File**: `services/affidavitService.js` (or create `divorceService.js`)

**Divorce-Specific System Prompts**:

```javascript
const DIVORCE_PETITION_SYSTEM_PROMPT = `You are a legal assistant helping a user complete a divorce petition for ${state}. Your role is to:

1. Ask clear, sensitive questions about their divorce situation
2. Gather all required information for the ${state} divorce petition
3. Use appropriate legal terminology for ${state} (e.g., "${terminology.custody}" instead of "custody")
4. Explain legal concepts in plain language when asked
5. Never provide legal advice - only help document facts

Required information to gather:
- Petitioner and respondent names and contact information
- Date and place of marriage
- Date of separation
- Grounds for divorce (${state} allows: ${grounds.join(', ')})
- Information about any minor children
- Property and debt information
- Support requests

Important for ${state}:
- Residency requirement: ${residencyRequirement}
- Waiting period: ${waitingPeriod}
- Special considerations: ${specialConsiderations}

Always be empathetic and professional. Divorce is emotionally difficult.`;

const DIVORCE_DECREE_SYSTEM_PROMPT = `You are a legal assistant helping finalize a divorce decree for ${state}...`;
```

### 6.2 Fact Extraction for Divorce

**Modify fact extraction to recognize divorce-specific entities**:

```javascript
const DIVORCE_ENTITY_PATTERNS = {
  marriageDate: /married\s+(?:on\s+)?(\w+\s+\d{1,2},?\s+\d{4})/i,
  separationDate: /separated\s+(?:on\s+)?(\w+\s+\d{1,2},?\s+\d{4})/i,
  childrenCount: /(\d+)\s+(?:minor\s+)?child(?:ren)?/i,
  propertyMention: /(house|home|vehicle|car|bank\s+account|retirement|401k|pension)/i,
  groundsMention: /(irreconcilable|insupportability|irretrievably\s+broken|adultery|abandonment)/i
};

function extractDivorceEntities(message, currentData) {
  const extracted = {};

  for (const [key, pattern] of Object.entries(DIVORCE_ENTITY_PATTERNS)) {
    const match = message.match(pattern);
    if (match) {
      extracted[key] = match[1];
    }
  }

  return extracted;
}
```

### 6.3 Conversation Flow

**Suggested question flow for divorce petition**:

1. **Introduction**: "I'll help you complete your divorce petition. Let's start with some basic information."
2. **Parties**: "What is your full legal name?" → "What is your spouse's full legal name?"
3. **Marriage**: "When and where did you get married?"
4. **Separation**: "When did you and your spouse separate?"
5. **Grounds**: "What is the reason for the divorce?" (offer state-specific options)
6. **Children**: "Do you have any children under 18?"
7. **Property**: "Do you and your spouse have any property or debts to divide?"
8. **Support**: "Are you requesting spousal support?"
9. **Relief**: "What are you asking the court to order?"

### 6.4 Sensitivity Considerations

- Use empathetic language
- Allow users to skip sensitive questions
- Provide content warnings for domestic violence questions
- Never judge or make assumptions
- Recommend professional legal help when appropriate

### 6.5 Deliverables

- [ ] Divorce-specific system prompts for each state
- [ ] Entity extraction for divorce-related facts
- [ ] Conversation flow logic
- [ ] Sensitivity handling
- [ ] Unit tests for extraction logic

---

## Phase 7: Testing & QA

**Goal**: Comprehensive testing to ensure legal accuracy and system reliability.

### 7.1 Unit Tests

**Template Tests**:
```
__tests__/templates/
├── core/
│   ├── BaseDivorcePetitionTemplate.test.js
│   ├── BaseDivorceDecreeTemplate.test.js
│   ├── TemplateRegistry.test.js (update)
│   └── TemplateLoader.test.js (update)
└── states/
    ├── texas/DivorceTemplates.test.js
    ├── utah/DivorceTemplates.test.js
    ├── california/DivorceTemplates.test.js
    ├── arizona/DivorceTemplates.test.js
    ├── florida/DivorceTemplates.test.js
    ├── illinois/DivorceTemplates.test.js
    └── new-york/DivorceTemplates.test.js
```

**Test Categories**:
1. **Validation Tests**: Required fields, data types, business rules
2. **Rendering Tests**: Section generation, formatting, page breaks
3. **State-Specific Tests**: Terminology, citations, form numbers
4. **Edge Cases**: Empty fields, special characters, long text

### 7.2 Integration Tests

```
__tests__/integration/
├── divorceWorkflow.test.js     # End-to-end document creation
├── divorcePreview.test.js      # Preview generation
├── divorcePDF.test.js          # PDF generation
└── divorceAPI.test.js          # API endpoint tests
```

### 7.3 Legal Accuracy Review

**Checklist per state**:
- [ ] Correct residency requirements stated
- [ ] Correct waiting period stated
- [ ] Correct grounds for divorce listed
- [ ] Proper legal citations included
- [ ] Correct terminology used throughout
- [ ] Proper court formatting (margins, fonts)
- [ ] Required sections present
- [ ] Signature and notary blocks correct

### 7.4 Manual Testing Matrix

| Test Case | TX | UT | AZ | CA | FL | IL | NY |
|-----------|----|----|----|----|----|----|----|
| Create petition | | | | | | | |
| Preview generation | | | | | | | |
| PDF generation | | | | | | | |
| With children | | | | | | | |
| Without children | | | | | | | |
| With property | | | | | | | |
| Without property | | | | | | | |
| Simplified (FL only) | N/A | N/A | N/A | N/A | | N/A | N/A |
| Joint filing (NY only) | N/A | N/A | N/A | N/A | N/A | N/A | |
| AI chat flow | | | | | | | |
| Save/load document | | | | | | | |
| Payment flow | | | | | | | |

### 7.5 Performance Testing

- Preview generation < 2 seconds
- PDF generation < 10 seconds
- API response times < 500ms
- Memory usage within limits

### 7.6 Deliverables

- [ ] Unit tests for all new components
- [ ] Integration tests for workflows
- [ ] Legal accuracy checklist completed
- [ ] Manual testing completed
- [ ] Performance benchmarks met
- [ ] Bug fixes from testing

---

## Phase 8: Documentation & Deployment

**Goal**: Complete documentation and deploy to production.

### 8.1 Documentation Updates

**Files to Update**:
- [ ] `CLAUDE.md` - Add divorce document types to supported features
- [ ] `docs/DIVORCE_PACKAGE_RESEARCH.md` - Mark as reference document
- [ ] `templates/README.md` - Add divorce template documentation
- [ ] `templates/ADDING_A_STATE.md` - Add divorce template instructions
- [ ] API documentation - Document new endpoints

**New Documentation**:
- [ ] `docs/DIVORCE_USER_GUIDE.md` - User-facing documentation
- [ ] `docs/DIVORCE_LEGAL_REQUIREMENTS.md` - Legal requirements summary

### 8.2 Database Considerations

**No migrations required** - existing schema supports divorce documents.

**Optional Enhancement**:
```sql
-- migrations/012_add_document_type_constraint.sql
-- Add constraint to enforce valid document types (optional)
ALTER TABLE documents
ADD CONSTRAINT check_document_type
CHECK (document_type IN (
  'affidavit',
  'divorce_petition',
  'divorce_decree'
));
```

### 8.3 Deployment Checklist

- [ ] All tests passing
- [ ] Code review completed
- [ ] Legal review completed
- [ ] Documentation updated
- [ ] Environment variables verified
- [ ] Feature flag (if applicable)
- [ ] Monitoring/alerts configured
- [ ] Rollback plan documented

### 8.4 Launch Plan

**Soft Launch**:
1. Deploy to staging environment
2. Internal testing with team
3. Beta testing with select users
4. Gather feedback and fix issues

**Production Launch**:
1. Deploy during low-traffic period
2. Monitor error rates and performance
3. Be ready to rollback if needed
4. Announce feature to users

### 8.5 Deliverables

- [ ] All documentation updated
- [ ] Deployment checklist completed
- [ ] Staging deployment successful
- [ ] Production deployment successful
- [ ] Post-launch monitoring verified

---

## Risk Assessment

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Template system changes break affidavits | Medium | High | Comprehensive backwards compatibility tests |
| PDF rendering issues | Medium | Medium | Extensive PDF testing across all states |
| Performance degradation | Low | Medium | Performance benchmarks before deployment |
| Data migration issues | Low | High | No migration needed - schema already supports |

### Legal Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Incorrect legal requirements | Low | High | Multiple verification sources, regular updates |
| Missing required sections | Low | High | State-specific test coverage |
| Outdated form references | Medium | Medium | Regular legal research updates |
| User misuse of documents | Medium | High | Clear disclaimers, not legal advice |

### Business Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Low adoption | Medium | Medium | User research, marketing |
| Support burden | Medium | Medium | Good documentation, clear error messages |
| Competitor features | Low | Low | Focus on quality and accuracy |

---

## Dependencies

### External Dependencies

- Legal research accuracy (verified 2026-02-02)
- State court form requirements (stable, update annually)
- Auth0 (no changes needed)
- Stripe (no changes needed)
- OpenAI API (system prompt changes only)

### Internal Dependencies

| Dependency | Phase | Status |
|------------|-------|--------|
| Base templates | Phase 1, 2 | Created |
| State templates | Phase 2, 3 | Petition done, Decree needed |
| Template system | Phase 1 | Modification needed |
| API routes | Phase 4 | New routes needed |
| Frontend | Phase 5 | New components needed |
| AI prompts | Phase 6 | New prompts needed |
| Tests | Phase 7 | All needed |
| Docs | Phase 8 | Updates needed |

---

## Success Criteria

### Functional Criteria

- [ ] Users can create divorce petitions for all 7 states
- [ ] Users can create divorce decrees for all 7 states
- [ ] Preview renders correctly for all document types
- [ ] PDF generates correctly for all document types
- [ ] AI chat helps users complete divorce documents
- [ ] Payment processing works for divorce documents
- [ ] Documents save and load correctly

### Quality Criteria

- [ ] All templates pass legal accuracy review
- [ ] Test coverage > 80% for new code
- [ ] No regression in existing affidavit functionality
- [ ] Performance within acceptable limits
- [ ] No critical or high-severity bugs

### Business Criteria

- [ ] Feature documented for users
- [ ] Support team trained (if applicable)
- [ ] Monitoring and alerts in place
- [ ] Rollback plan tested

---

## Appendix A: File Change Summary

### New Files

```
templates/core/
├── BaseDivorcePetitionTemplate.js     ✓ (exists)
└── BaseDivorceDecreeTemplate.js       ✓ (exists)

templates/states/*/
├── DivorcePetitionTemplate.js         ✓ (exists for all 7)
├── DivorceDecreeTemplate.js           (needed for 6 states)
└── divorce-metadata.json              ✓ (exists for all 7)

routes/
└── divorce.js                         (NEW - divorce-specific routes)

client/src/components/
├── DocumentTypeSelector.js            (NEW)
├── DivorceForm.js                     (NEW)
├── DivorceFormSections/               (NEW - 7 components)
└── StateRequirements.js               (NEW)

__tests__/
├── templates/states/*/DivorceTemplates.test.js  (NEW - 7 files)
└── integration/divorce*.test.js       (NEW - 4 files)

docs/
├── DIVORCE_USER_GUIDE.md              (NEW)
└── DIVORCE_LEGAL_REQUIREMENTS.md      (NEW)

roadmap/
└── DIVORCE_PACKAGE_INTEGRATION.md     ✓ (this file)
```

### Modified Files

```
templates/core/
├── TemplateRegistry.js                (add multi-type support)
├── TemplateLoader.js                  (add multi-file discovery)
└── validateMetadata.js                (add divorce validation)

templates/
└── StateTemplateManager.js            (add documentType routing)

routes/
├── templates.js                       (add divorce endpoints)
└── documents.js                       (add documentType handling)

middleware/
└── validation.js                      (add divorce validators)

services/
└── affidavitService.js                (add divorce prompts)

client/src/
├── App.js                             (add divorce routes)
├── contexts/DocumentContext.js        (rename affidavitData)
└── components/DocumentPreview.js      (handle divorce preview)

CLAUDE.md                              (update documentation)
```

---

## Appendix B: State Legal Citations

### Texas
- Texas Family Code § 6.001 (Insupportability)
- Texas Family Code § 6.301 (Residency)
- Texas Family Code § 6.702 (Waiting Period)
- Texas Family Code § 153 (Conservatorship)

### Utah
- Utah Code § 30-3-1 (Grounds)
- Utah Code § 81-4-402 (Residency, Waiting Period)
- Utah Code § 30-3-11.3 (Divorce Education)

### California
- California Family Code § 2310 (Grounds)
- California Family Code § 2320 (Residency)
- California Family Code § 2339 (Waiting Period)
- CCP § 2015.5 (Declarations)

### Arizona
- A.R.S. § 25-312 (Grounds)
- A.R.S. § 25-314 (Jurisdiction)
- A.R.S. § 25-315 (Waiting Period)
- A.R.S. § 25-901 (Covenant Marriage)

### Florida
- Florida Statutes § 61.052 (Grounds)
- Florida Statutes § 61.021 (Residency)
- Florida Family Law Rule 12.105 (Simplified)

### Illinois
- 750 ILCS 5/401 (Grounds)
- 750 ILCS 5/401(a-5) (Residency)
- 750 ILCS 5/504 (Maintenance)
- 750 ILCS 5/501(a)(1) (Financial Affidavit)

### New York
- DRL § 170 (Grounds)
- DRL § 230 (Residency)
- CPLR 515 (Venue - 2025)
- Joint Filing Rules (January 2025)

---

*End of Integration Roadmap*
