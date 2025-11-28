# Template System Documentation

## Overview

The affidavit-maker template system provides a flexible, extensible architecture for generating state-specific legal documents. Templates are organized by state and automatically discovered at runtime, making it easy to add new states without modifying core application code.

## Architecture

### Directory Structure

```
templates/
├── core/                                    # Core infrastructure
│   ├── BaseAffidavitTemplate.js            # Abstract base class for all templates
│   ├── TemplateRegistry.js                  # Dynamic template registry
│   ├── TemplateLoader.js                    # Auto-discovery system
│   ├── validateMetadata.js                  # Metadata validation utility
│   └── templateMetadata.schema.json         # JSON schema for metadata
├── states/                                   # State-specific templates
│   ├── texas/
│   │   ├── AffidavitTemplate.js            # TX template implementation
│   │   └── metadata.json                    # TX configuration
│   ├── utah/
│   │   ├── AffidavitTemplate.js            # UT template implementation
│   │   └── metadata.json                    # UT configuration
│   ├── arizona/
│   │   ├── AffidavitTemplate.js            # AZ template implementation
│   │   └── metadata.json                    # AZ configuration
│   └── [new-state]/                         # Add new states here!
│       ├── AffidavitTemplate.js
│       └── metadata.json
├── _template/                               # Boilerplate for new states
│   ├── AffidavitTemplate.js                # Template starter code
│   └── metadata.json                        # Metadata starter
├── initialize.js                            # System initialization
├── StateTemplateManager.js                  # LEGACY (to be removed)
├── README.md                                # This file
└── ADDING_A_STATE.md                        # Quick start guide
```

### Key Components

#### 1. BaseAffidavitTemplate (`core/BaseAffidavitTemplate.js`)

Abstract base class that provides:
- Common document generation methods
- Default formatting rules
- Validation framework
- Section generation (header, venue, facts, etc.)

**All state templates must extend this class.**

#### 2. TemplateRegistry (`core/TemplateRegistry.js`)

Central registry that:
- Stores template instances by state code
- Provides consistent interface for template access
- Manages template metadata
- Delegates validation and generation to templates

**Replaces the legacy StateTemplateManager.**

#### 3. TemplateLoader (`core/TemplateLoader.js`)

Auto-discovery system that:
- Scans `templates/states/` for subdirectories
- Loads template classes and metadata
- Validates templates against base class
- Registers templates with the registry

**No code changes needed to add new states!**

## How It Works

### 1. Server Initialization

When the server starts (`server.js`):

```javascript
const { initializeTemplates } = require('./templates/initialize');
const templateManager = await initializeTemplates();
app.locals.templateManager = templateManager;
```

### 2. Template Discovery

The `TemplateLoader`:
1. Scans `templates/states/` for subdirectories
2. For each directory, checks for:
   - `metadata.json` (configuration)
   - `AffidavitTemplate.js` (implementation)
3. Validates metadata against schema
4. Instantiates template class
5. Registers with `TemplateRegistry`

### 3. Template Access

Application code accesses templates through the registry:

```javascript
// Get template for a state
const template = templateManager.getTemplate('TX');

// Validate data
const validation = templateManager.validateAffidavitData('TX', data);

// Generate document
const document = templateManager.generateAffidavit('TX', data);
```

### 4. State-Specific Customization

Each state template can override base methods:

```javascript
class TexasAffidavitTemplate extends BaseAffidavitTemplate {
  generateNotaryBlock(affidavitData) {
    // Texas-specific notary block
    return `SWORN TO AND SUBSCRIBED before me...`;
  }

  performStateSpecificValidation(affidavitData) {
    // Texas-specific validation rules
    const errors = [];
    if (!affidavitData.county) {
      errors.push('County is required for Texas');
    }
    return { errors, warnings: [] };
  }
}
```

## Metadata Schema

Each state's `metadata.json` defines:

```json
{
  "stateCode": "TX",                         // Two-letter code
  "stateName": "Texas",                      // Full name
  "documentTypes": ["affidavit"],           // Supported types
  "version": "2.0",                         // Template version
  "legallyCompliant": true,                 // Compliance flag
  "requiredFields": [                       // Required data fields
    "affiantName",
    "state",
    "county"
  ],
  "optionalFields": [                       // Optional fields
    "caseNumber",
    "courtName"
  ],
  "features": {                             // State-specific features
    "perjuryStatement": false,
    "notaryBlock": true,
    "caseNumberLabel": "CAUSE NO."
  },
  "legalCitations": [                       // Legal references
    {
      "code": "Tex. Gov't Code § 312.011",
      "description": "Affidavit requirements"
    }
  ]
}
```

## Adding a New State

See [ADDING_A_STATE.md](./ADDING_A_STATE.md) for detailed instructions.

**Quick summary:**

1. Create directory: `templates/states/newstate/`
2. Copy starter files from `templates/_template/`
3. Update `metadata.json` with state configuration
4. Implement `AffidavitTemplate.js` with state-specific methods
5. Restart server - template auto-discovered!

## Template Development Guide

### Extending BaseAffidavitTemplate

#### Required Setup

```javascript
const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

class NewStateAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    // Load metadata from same directory
    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // Configure sections
    this.sections.perjuryStatement = this.metadata.features.perjuryStatement;
  }
}

module.exports = NewStateAffidavitTemplate;
```

### Commonly Overridden Methods

#### 1. `generateHeader()`

State-specific header format:

```javascript
generateHeader() {
  // Utah requires sentence case
  return 'State of Utah';

  // Most states use all caps
  return `STATE OF ${this.stateName.toUpperCase()}`;
}
```

#### 2. `generateVenue(county)`

Venue section formatting:

```javascript
generateVenue(county) {
  // Title case
  const countyName = county.split(' ')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
  return `County of ${countyName}`;
}
```

#### 3. `generateCaseCaption(affidavitData)`

Case caption with state-specific terminology:

```javascript
generateCaseCaption(affidavitData) {
  let caption = '';
  const courtName = (affidavitData.court || '[COURT NAME]').toUpperCase();
  caption += `IN THE ${courtName}\n\n`;

  // Texas uses "CAUSE NO.", others use "CASE NO."
  const caseLabel = this.state === 'TX' ? 'CAUSE NO.' : 'CASE NO.';
  const caseNumber = affidavitData.caseNumber || '[CASE NUMBER]';
  caption += `${caseLabel} ${caseNumber}\n\n`;

  return { formatted: caption, /* ... */ };
}
```

#### 4. `generateNotaryBlock(affidavitData)`

**CRITICAL**: Must comply with state law!

```javascript
generateNotaryBlock(affidavitData) {
  // Research state notary requirements
  // Implement statutory jurat format
  return `SWORN TO AND SUBSCRIBED before me on...`;
}
```

#### 5. `generatePerjuryStatement()`

Required in some states:

```javascript
generatePerjuryStatement() {
  // Some states require this, others don't
  if (this.metadata.features.perjuryStatement) {
    return 'I declare under penalty of perjury...';
  }
  return null;
}
```

#### 6. `performStateSpecificValidation(affidavitData)`

Custom validation rules:

```javascript
performStateSpecificValidation(affidavitData) {
  const errors = [];
  const warnings = [];

  // Check state-specific requirements
  if (this.requiredFields.includes('county')) {
    if (!affidavitData.county) {
      errors.push(`County is required for ${this.stateName}`);
    }
  }

  return { errors, warnings };
}
```

## Testing Templates

### Manual Testing

1. Start server: `npm start`
2. Check logs for successful template loading
3. Test document generation through API or UI
4. Verify PDF output matches expectations

### Automated Testing

```javascript
const TexasTemplate = require('./states/texas/AffidavitTemplate');

describe('Texas Template', () => {
  let template;

  beforeEach(() => {
    template = new TexasTemplate();
  });

  test('generates correct header', () => {
    expect(template.generateHeader()).toBe('THE STATE OF TEXAS');
  });

  test('validates county requirement', () => {
    const result = template.validateData({ affiantName: 'John Doe' });
    expect(result.errors).toContain('County is required for Texas affidavits');
  });
});
```

## Legal Compliance

### Critical Requirements

1. **Research state law** before implementing templates
2. **Cite legal authorities** in metadata
3. **Test with legal counsel** for production use
4. **Version templates** when laws change
5. **Document compliance** in code comments

### Common Legal Issues

- Notary block format (often statutory)
- Perjury statement requirements
- Oath administration procedures
- Required fields (venue, county, etc.)
- Court naming conventions
- Exhibit labeling rules

### Compliance Checklist

- [ ] Researched current state statutes
- [ ] Implemented statutory forms (if prescribed)
- [ ] Included required legal warnings
- [ ] Documented legal citations
- [ ] Tested with sample data
- [ ] Reviewed by legal counsel (if possible)
- [ ] Versioned template (set `version` in metadata)

## Future Extensibility

### Supporting Multiple Document Types

The system is designed to support multiple document types beyond affidavits:

```
templates/
├── types/
│   ├── affidavit/
│   │   └── BaseAffidavitTemplate.js
│   ├── petition/
│   │   └── BasePetitionTemplate.js
│   └── motion/
│       └── BaseMotionTemplate.js
└── states/
    └── texas/
        ├── AffidavitTemplate.js
        ├── PetitionTemplate.js
        └── metadata.json  # documentTypes: ["affidavit", "petition"]
```

### Plugin Architecture

Templates are essentially plugins:
- Self-contained in their directory
- Auto-discovered at runtime
- No changes to core code needed
- Can be distributed separately

## Troubleshooting

### Template Not Loading

**Check:**
1. Directory name in `templates/states/`
2. File names: `metadata.json` and `AffidavitTemplate.js`
3. Valid JSON in metadata
4. Template class extends `BaseAffidavitTemplate`
5. Template exports correctly: `module.exports = ClassName;`

**View logs:**
```
npm start
# Look for "Template loading complete: X loaded, Y failed"
```

### Validation Errors

**Check metadata:**
- All required fields present
- `stateCode` is 2 uppercase letters
- `features` object has required fields
- `legalCitations` array is valid

**Run validation:**
```javascript
const { validateMetadata } = require('./core/validateMetadata');
const metadata = require('./states/texas/metadata.json');
const result = validateMetadata(metadata);
console.log(result);
```

### Document Generation Issues

**Debug steps:**
1. Test template in isolation
2. Check required fields in affidavitData
3. Verify overridden methods return correct types
4. Review logs for errors

## API Reference

### TemplateRegistry

```javascript
// Get template instance
const template = registry.getTemplate('TX');

// Get all supported states
const states = registry.getSupportedStates();
// Returns: [{ code: 'TX', name: 'Texas', requirements: {...} }, ...]

// Validate data
const validation = registry.validateAffidavitData('TX', data);
// Returns: { isValid: boolean, errors: [], warnings: [] }

// Generate document
const document = registry.generateAffidavit('TX', data);
// Returns: { id, state, sections, fullText, htmlContent, validation, ... }

// Get legal citations
const citations = registry.getLegalCitations('TX');
// Returns: { primary: '...', secondary: [...], notes: '...' }
```

### BaseAffidavitTemplate Methods

**Document Generation:**
- `generateDocument(affidavitData)` - Main entry point
- `generateHeader()` - Document header
- `generateVenue(county)` - Venue section
- `generateCaseCaption(affidavitData)` - Case caption
- `generateTitle(affiantName)` - Document title
- `generateIntroduction(affidavitData)` - Intro paragraph
- `generateCompetencyStatement(affiantName)` - Competency fact
- `processFactsForDocument(facts)` - Process facts array
- `generateConclusion()` - Conclusion paragraph
- `generatePerjuryStatement()` - Perjury warning
- `generateSignatureBlock(affiantName)` - Signature lines
- `generateNotaryBlock(affidavitData)` - Notary jurat
- `generateFooter()` - Document footer

**Validation:**
- `validateData(affidavitData)` - Validate affidavit data
- `performStateSpecificValidation(affidavitData)` - State rules

**Configuration:**
- `getRequirements()` - Get template requirements
- `getFormattingRules()` - Get formatting config
- `getExhibitRules()` - Get exhibit rules

## Best Practices

1. **Keep templates focused** - One state, one document type per file
2. **Document legal requirements** - Comment why code exists
3. **Cite legal authorities** - Include statute references
4. **Version templates** - Update version when laws change
5. **Test thoroughly** - Legal documents must be correct
6. **Use metadata** - Don't hardcode what can be configured
7. **Follow conventions** - Match existing template patterns
8. **Validate strictly** - Better to reject bad data than generate bad documents

## Support

For questions or issues:
1. Check this documentation
2. Review existing templates for examples
3. See `ADDING_A_STATE.md` for step-by-step guide
4. Check server logs for errors
5. Run metadata validation

## License

[Your license here]

## Contributing

See [ADDING_A_STATE.md](./ADDING_A_STATE.md) for contribution guidelines.
