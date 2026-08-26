# Adding a New State Template

This guide provides step-by-step instructions for adding support for a new state to the affidavit-maker application.

## Prerequisites

- Basic JavaScript/Node.js knowledge
- Understanding of the state's affidavit legal requirements
- Access to state statutes and forms
- Text editor

## Overview

Adding a new state requires:
1. Creating a state directory
2. Configuring metadata
3. Implementing the template class
4. Testing the template
5. Restarting the server (auto-discovery)

**Estimated time: 1-3 hours** (depending on legal research)

---

## Step 1: Research State Requirements

Before writing code, research your state's legal requirements:

### Questions to Answer

1. **What is the statutory authority for affidavits?**
   - Find the relevant state code sections
   - Note any prescriptive form requirements

2. **Is a perjury statement required?**
   - Some states require explicit perjury warning
   - Others rely on the oath alone

3. **What is the notary jurat format?**
   - Many states have statutory jurat language
   - This is CRITICAL for legal compliance

4. **What fields are required?**
   - Affiant name (always)
   - County (usually)
   - State (always)
   - Case information (if court filing)

5. **What are the formatting requirements?**
   - Header format (all caps vs. sentence case)
   - Venue format
   - Case number terminology ("CAUSE NO." vs. "CASE NO.")

6. **What are the exhibit rules?**
   - Letter labels (A, B, C) or number labels (1, 2, 3)?
   - Cover pages required?
   - Any specific formatting?

### Resources

- State legislature website (statutes)
- State court websites (forms and rules)
- State bar association resources
- Legal treatises and practice guides

---

## Step 2: Create State Directory

Create a new directory for your state:

```bash
cd templates/states
mkdir california  # Use full state name, lowercase
cd california
```

**Naming convention:** Full state name, lowercase, no spaces

Examples:
- `texas` ✓
- `newyork` ✓
- `new-york` ✗ (no hyphens)
- `NY` ✗ (use full name)

---

## Step 3: Create metadata.json

Copy the template starter:

```bash
cp ../../_template/metadata.json .
```

Edit `metadata.json`:

```json
{
  "stateCode": "CA",
  "stateName": "California",
  "documentTypes": ["affidavit"],
  "version": "1.0",
  "legallyCompliant": true,
  "requiredFields": [
    "affiantName",
    "state",
    "county"
  ],
  "optionalFields": [
    "caseNumber",
    "courtName",
    "plaintiff",
    "defendant"
  ],
  "features": {
    "perjuryStatement": true,
    "notaryBlock": true,
    "notaryInstruction": false,
    "caseNumberLabel": "CASE NO.",
    "caseNumberRequired": false,
    "headerFormat": "uppercase",
    "venueFormat": "sentencecase"
  },
  "legalCitations": [
    {
      "code": "Cal. Code Civ. Proc. § 2015.5",
      "description": "Certification and declaration requirements"
    }
  ],
  "exhibitRules": {
    "labelStyle": "letters",
    "requireCoverPage": true,
    "instructions": "Exhibits should be labeled with letters (A, B, C, etc.)."
  }
}
```

### Metadata Field Guide

**stateCode:** Two-letter postal abbreviation (uppercase)

**stateName:** Full state name

**version:** Start at "1.0", increment when laws change

**legallyCompliant:** Set to `true` only after legal review

**requiredFields:** Fields that MUST be provided
- Always include: `affiantName`, `state`
- Usually include: `county`

**features.perjuryStatement:**
- `true` if state requires perjury statement in document
- `false` if oath alone provides perjury warning

**features.notaryBlock:**
- Always `true` for sworn affidavits

**features.notaryInstruction:**
- `true` if template includes specific oath language for notary
- `false` otherwise

**features.caseNumberLabel:**
- `"CAUSE NO."` for Texas
- `"CASE NO."` for most other states
- Check local court rules

**legalCitations:** Array of relevant statutes
- First entry should be primary authority
- Include all relevant codes

---

## Step 4: Create AffidavitTemplate.js

Copy the template starter:

```bash
cp ../../_template/AffidavitTemplate.js .
```

### Basic Template Structure

```javascript
const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * [State Name] Affidavit Template
 *
 * Governing Law: [Primary statute citation]
 *
 * COMPLIANCE NOTES:
 * - [Note 1 about state requirements]
 * - [Note 2 about special rules]
 */
class [State]AffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();

    // Load metadata
    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;

    // Configure perjury statement
    this.sections.perjuryStatement = this.metadata.features.perjuryStatement;
  }

  // Override methods as needed...
}

module.exports = [State]AffidavitTemplate;
```

### Methods to Override

#### 1. generateHeader() - OPTIONAL

Override if state requires specific header format:

```javascript
generateHeader() {
  // Most states use all caps
  return `STATE OF ${this.stateName.toUpperCase()}`;

  // Utah requires sentence case
  return 'State of Utah';
}
```

#### 2. generateVenue(county) - OPTIONAL

Override for specific venue formatting:

```javascript
generateVenue(county) {
  // Sentence case (most common)
  const countyName = county
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  return `County of ${countyName}`;

  // All caps (Texas style)
  return `COUNTY OF ${county.toUpperCase()}`;
}
```

#### 3. generateCaseCaption(affidavitData) - OPTIONAL

Override if state uses different terminology:

```javascript
generateCaseCaption(affidavitData) {
  let caption = '';

  const courtName = (affidavitData.court || '[COURT NAME]').toUpperCase();
  caption += `IN THE ${courtName}\n\n`;

  // Use metadata for case number label
  const caseNumber = affidavitData.caseNumber || '[CASE NUMBER]';
  caption += `${this.metadata.features.caseNumberLabel} ${caseNumber}\n\n`;

  const plaintiff = affidavitData.plaintiff || '[PLAINTIFF NAME]';
  const defendant = affidavitData.defendant || '[DEFENDANT NAME]';
  caption += `${plaintiff.toUpperCase()}\nV.\n${defendant.toUpperCase()}`;

  return {
    courtName,
    caseNumber: affidavitData.caseNumber,
    plaintiff: affidavitData.plaintiff,
    defendant: affidavitData.defendant,
    formatted: caption
  };
}
```

#### 4. generateNotaryBlock(affidavitData) - REQUIRED

**CRITICAL:** This must match your state's statutory requirements!

```javascript
generateNotaryBlock(affidavitData) {
  // Research your state's jurat requirements!
  // This is the most legally critical method

  // Example: Generic format
  return `Subscribed and sworn to before me this _____ day of _____________, 20___.


_________________________________
Notary Public

My commission expires: ___________`;

  // Example: Texas statutory format
  return `SWORN TO AND SUBSCRIBED before me on this _____ day of _____________, 20___.


_________________________________
Notary Public, State of Texas

Notary's printed name: _______________________

My commission expires: ___________`;
}
```

#### 5. generatePerjuryStatement() - CONDITIONAL

Override if state requires perjury statement:

```javascript
generatePerjuryStatement() {
  // If state requires it
  if (this.metadata.features.perjuryStatement) {
    return `I declare under penalty of perjury under the laws of the State of ${this.stateName} that the foregoing is true and correct.`;
  }

  // If state doesn't require it
  return null;
}
```

#### 6. performStateSpecificValidation(affidavitData) - RECOMMENDED

Add state-specific validation rules:

```javascript
performStateSpecificValidation(affidavitData) {
  const errors = [];
  const warnings = [];

  // Enforce required county
  if (this.requiredFields.includes('county')) {
    if (!affidavitData.county || affidavitData.county.trim().length === 0) {
      errors.push(`County is required for ${this.stateName} affidavits`);
    }
  }

  // Add state-specific checks
  // Example: Check for conflicting data
  // Example: Validate against state-specific rules

  return { errors, warnings };
}
```

#### 7. generateCompetencyStatement(affiantName) - OPTIONAL

Override if state requires enhanced competency language:

```javascript
generateCompetencyStatement(affiantName) {
  const name = affiantName || 'I';
  return {
    number: 1,
    content: `${name} am over the age of eighteen (18) years, of sound mind, and otherwise competent to make this affidavit. The facts stated herein are within my personal knowledge and are true and correct. I am competent to testify to the matters stated in this affidavit.`,
    type: 'competency'
  };
}
```

#### 8. getExhibitRules() - OPTIONAL

Override for state-specific exhibit requirements:

```javascript
getExhibitRules() {
  return {
    labelStyle: this.metadata.exhibitRules.labelStyle,
    requireCoverPage: this.metadata.exhibitRules.requireCoverPage,
    coverPageFormat: {
      title: 'EXHIBIT [LABEL]',
      centered: true,
      description: true
    },
    allowedFormats: ['PDF', 'JPG', 'PNG'],
    maxFileSize: 25 * 1024 * 1024,
    maxTotalSize: 100 * 1024 * 1024,
    instructions: this.metadata.exhibitRules.instructions
  };
}
```

---

## Step 5: Test Your Template

### Validation Test

Create a test file to validate your template:

```javascript
// test-california.js
const CaliforniaTemplate = require('./templates/states/california/AffidavitTemplate');

const template = new CaliforniaTemplate();

// Test data
const testData = {
  affiantName: 'John Doe',
  state: 'CA',
  county: 'Los Angeles',
  facts: [
    'I have personal knowledge of the events described herein.',
    'On January 1, 2024, I witnessed the incident.'
  ]
};

// Test validation
console.log('Validation:', template.validateData(testData));

// Test document generation
const doc = template.generateDocument(testData);
console.log('Generated document ID:', doc.id);
console.log('Sections:', Object.keys(doc.sections));
console.log('Header:', doc.sections.header);
console.log('Venue:', doc.sections.venue);
```

Run test:
```bash
node test-california.js
```

### Manual Testing

1. **Start the server:**
   ```bash
   npm start
   ```

2. **Check logs for successful loading:**
   ```
   ✓ Loaded template: California (CA)
   Template loading complete: 4 loaded, 0 failed
   Loaded templates for 4 states: AZ, CA, TX, UT
   ```

3. **Test through API:**
   ```bash
   curl http://localhost:3000/api/templates/states
   ```

4. **Test document generation:**
   - Use the web interface
   - Select your new state
   - Generate a test affidavit
   - Review the preview
   - Download the PDF

---

## Step 6: Verify Legal Compliance

### Compliance Checklist

- [ ] Researched current state statutes
- [ ] Notary block matches statutory requirements
- [ ] Perjury statement included if required
- [ ] Venue format matches state conventions
- [ ] Required fields enforced
- [ ] Legal citations documented in metadata
- [ ] Tested with realistic data
- [ ] Reviewed by legal counsel (if possible)

### Common Issues

**Notary Block:**
- Most common compliance issue
- Must match state statute exactly
- Include all required elements

**Perjury Statement:**
- Some states require, some don't
- Wording matters - check statute

**Header/Venue Format:**
- Some states prescribe exact format
- Check for all caps vs. sentence case

**Required Fields:**
- County usually required for venue
- Some states have additional requirements

---

## Step 7: Document Your Work

Add comments to your template:

```javascript
/**
 * California Affidavit Template - Version 1.0
 *
 * Governing Law:
 * - Cal. Code Civ. Proc. § 2015.5 (verification requirements)
 * - Cal. Gov't Code § 8202 (notary acknowledgments)
 *
 * COMPLIANCE NOTES:
 * - Perjury statement required per § 2015.5
 * - Notary block follows Gov't Code § 8202 format
 * - County is required for venue
 * - Declaration language must reference "penalty of perjury"
 *
 * LEGAL REVIEW:
 * - Last reviewed: [Date]
 * - Reviewed by: [Name/Role]
 * - Status: Compliant with current law
 *
 * @class CaliforniaAffidavitTemplate
 * @extends BaseAffidavitTemplate
 * @version 1.0
 */
```

---

## Step 8: Commit Your Changes

```bash
# Add your new files
git add templates/states/california/

# Commit with descriptive message
git commit -m "Add California affidavit template

- Implements Cal. Code Civ. Proc. § 2015.5 requirements
- Statutory notary block per Gov't Code § 8202
- Includes required perjury statement
- County required for venue
- Letter-labeled exhibits with cover pages

Legal compliance: Reviewed and compliant"

# Push to your branch
git push
```

---

## Troubleshooting

### Template Not Loading

**Check server logs:**
```
npm start
```

Look for error messages like:
- "Missing metadata.json in [state]/"
- "Missing AffidavitTemplate.js in [state]/"
- "Invalid metadata: ..."

**Common fixes:**
- Ensure file names match exactly: `metadata.json`, `AffidavitTemplate.js`
- Validate JSON syntax in metadata.json
- Ensure template class extends BaseAffidavitTemplate
- Check for typos in state code

### Metadata Validation Errors

**Run validation manually:**
```javascript
const { validateMetadata } = require('./templates/core/validateMetadata');
const metadata = require('./templates/states/california/metadata.json');
const result = validateMetadata(metadata);
console.log(result);
```

**Common errors:**
- stateCode not 2 uppercase letters
- Missing required features fields
- Invalid version format
- Empty arrays for required fields

### Document Generation Issues

**Test template in isolation:**
```javascript
const template = new YourStateTemplate();
const doc = template.generateDocument(testData);
console.log(doc);
```

**Check for:**
- Missing required fields in test data
- Incorrect return types from overridden methods
- Errors in state-specific validation

---

## Example: Complete California Template

```javascript
const BaseAffidavitTemplate = require('../../core/BaseAffidavitTemplate');

/**
 * California Affidavit Template
 * Governing Law: Cal. Code Civ. Proc. § 2015.5
 */
class CaliforniaAffidavitTemplate extends BaseAffidavitTemplate {
  constructor() {
    super();
    this.metadata = require('./metadata.json');
    this.state = this.metadata.stateCode;
    this.stateName = this.metadata.stateName;
    this.requiredFields = this.metadata.requiredFields;
    this.sections.perjuryStatement = true;
  }

  generateNotaryBlock(affidavitData) {
    return `Subscribed and sworn to before me this _____ day of _____________, 20___.


_________________________________
Notary Public for California

My commission expires: ___________`;
  }

  generatePerjuryStatement() {
    return `I declare under penalty of perjury under the laws of the State of California that the foregoing is true and correct.`;
  }

  performStateSpecificValidation(affidavitData) {
    const errors = [];
    const warnings = [];

    if (!affidavitData.county) {
      errors.push('County is required for California affidavits');
    }

    return { errors, warnings };
  }
}

module.exports = CaliforniaAffidavitTemplate;
```

---

## Best Practices

1. **Start with existing templates** - Copy a similar state and modify
2. **Research thoroughly** - Legal compliance is critical
3. **Test extensively** - Generate multiple test documents
4. **Document your work** - Future developers will thank you
5. **Keep it simple** - Only override what's necessary
6. **Use metadata** - Avoid hardcoding configuration
7. **Cite sources** - Include statute references
8. **Version properly** - Track changes over time

---

## Getting Help

If you encounter issues:

1. Review existing templates (Texas, Utah, Arizona)
2. Check [README.md](./README.md) for architecture details
3. Run metadata validation
4. Check server logs
5. Test template in isolation

---

## Summary

Adding a new state takes ~1-3 hours:

1. ✅ Research state requirements (30-60 min)
2. ✅ Create directory and metadata (15 min)
3. ✅ Implement template class (30-60 min)
4. ✅ Test and verify (30 min)
5. ✅ Document and commit (15 min)

**The system handles the rest automatically!**

No changes to:
- Core application code
- Server initialization
- API endpoints
- UI components

Just drop in your new template and restart the server. The template loader will find it and register it automatically.

**That's the power of the new template system!**

---

## Non-US Jurisdictions: the Terminology Layer

The base classes (`BaseDivorcePetitionTemplate`, `BaseDivorceDecreeTemplate`,
`BaseAffidavitTemplate`, `BaseDocument`) default to US caption furniture:
`STATE OF X` / `COUNTY OF Y` header lines, `"X County"` body phrasing, and
`Petitioner`/`Respondent`/`Pro Se` labels. A non-US jurisdiction must NOT
override every section to fix this — it opts in via `this.terminology` in its
constructor (full field reference in `templates/core/terminology.js`):

```js
this.terminology = {
  ...this.terminology,
  jurisdictionLabel: null,           // null omits the "STATE OF X" header line
  jurisdictionTerm: 'Province',      // "the Province of X" / "this province"
  districtLabel: null,               // null omits the "COUNTY OF Y" venue line
  districtTerm: 'Judicial district', // noun for validation messages / 'prefix' style
  districtStyle: 'plain',            // 'suffix' "X County" | 'prefix' "the D of X" | 'plain' "X"
  districtPlaceholder: '[JUDICIAL DISTRICT]',
  filerLabel: 'Applicant',
  responderLabel: 'Respondent',
  selfRepresentedLabel: 'Self-Represented',
};
```

Defaults reproduce the historical US wording byte-for-byte, so US templates
need no changes. All 13 Canadian `DivorcePetitionTemplate`s are the reference
opt-ins. Where local practice is uncertain, prefer the neutral correct form:
the court-name caption line plus a `[COURT LOCATION]`/`[REGISTRY]`-style
placeholder — never "County".

`services/previewRenderer.js` (plain-facts preview) resolves its header via
`venueHeaderLines()` in the same module; extend that lookup when adding a
country whose documents must not open with `STATE OF` / `COUNTY OF`.
