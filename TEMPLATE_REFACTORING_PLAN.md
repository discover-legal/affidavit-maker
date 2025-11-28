# Template Refactoring Implementation Plan

## Overview
Refactor template organization to make templates independently organized by state and type, enabling easy extensibility for new states and document types while reusing existing components (chat, validation, preview).

---

## Phase 1: Setup and Foundation (No Breaking Changes)

### Task 1.1: Create New Directory Structure
**Objective**: Set up the new directory structure without affecting existing code

**Steps**:
1. Create `templates/core/` directory
2. Create `templates/states/` directory
3. Create `templates/states/texas/` directory
4. Create `templates/states/utah/` directory
5. Create `templates/states/arizona/` directory
6. Create `templates/types/` directory
7. Create `templates/types/affidavit/` directory

**Validation**: Directories exist, existing code still works

---

### Task 1.2: Extract BaseAffidavitTemplate
**Objective**: Move BaseAffidavitTemplate to a standalone file

**Steps**:
1. Create `templates/core/BaseAffidavitTemplate.js`
2. Copy BaseAffidavitTemplate class from `StateTemplateManager.js`
3. Add proper module.exports
4. Ensure all dependencies are imported (none currently)
5. Keep original in StateTemplateManager.js (don't delete yet)

**Files Changed**:
- NEW: `templates/core/BaseAffidavitTemplate.js`

**Validation**:
- New file has valid syntax
- Class exports correctly
- Can be required without errors

---

### Task 1.3: Create Template Metadata Schema
**Objective**: Define the structure for template metadata files

**Steps**:
1. Create `templates/core/templateMetadata.schema.json`
2. Define JSON schema for metadata validation
3. Document all required and optional fields
4. Include examples in comments

**Files Changed**:
- NEW: `templates/core/templateMetadata.schema.json`

**Schema Structure**:
```json
{
  "stateCode": "string (required, 2 chars)",
  "stateName": "string (required)",
  "documentTypes": "array (required, ['affidavit'])",
  "version": "string (required, semantic version)",
  "legallyCompliant": "boolean (required)",
  "requiredFields": "array of strings",
  "optionalFields": "array of strings",
  "features": {
    "perjuryStatement": "boolean",
    "notaryBlock": "boolean",
    "notaryInstruction": "boolean",
    "caseNumberLabel": "string",
    "caseNumberRequired": "boolean"
  },
  "legalCitations": "array of citation objects"
}
```

---

### Task 1.4: Create Texas Template Metadata
**Objective**: Extract Texas-specific configuration into metadata file

**Steps**:
1. Create `templates/states/texas/metadata.json`
2. Populate with Texas-specific data from TexasTemplate class
3. Include all required fields, features, and legal citations
4. Validate against schema

**Files Changed**:
- NEW: `templates/states/texas/metadata.json`

**Content**:
```json
{
  "stateCode": "TX",
  "stateName": "Texas",
  "documentTypes": ["affidavit"],
  "version": "2.0",
  "legallyCompliant": true,
  "requiredFields": ["affiantName", "state", "county"],
  "optionalFields": ["caseNumber", "courtName", "causeNumber"],
  "features": {
    "perjuryStatement": false,
    "notaryBlock": true,
    "notaryInstruction": false,
    "caseNumberLabel": "CAUSE NO.",
    "caseNumberRequired": false
  },
  "legalCitations": [
    {
      "code": "Texas Government Code § 312.011",
      "description": "Affidavit requirements"
    }
  ]
}
```

---

### Task 1.5: Create Utah Template Metadata
**Objective**: Extract Utah-specific configuration into metadata file

**Steps**:
1. Create `templates/states/utah/metadata.json`
2. Populate with Utah-specific data from UtahTemplate class
3. Include all required fields, features, and legal citations
4. Validate against schema

**Files Changed**:
- NEW: `templates/states/utah/metadata.json`

---

### Task 1.6: Create Arizona Template Metadata
**Objective**: Extract Arizona-specific configuration into metadata file

**Steps**:
1. Create `templates/states/arizona/metadata.json`
2. Populate with Arizona-specific data from ArizonaTemplate class
3. Include all required fields, features, and legal citations
4. Validate against schema

**Files Changed**:
- NEW: `templates/states/arizona/metadata.json`

---

## Phase 2: Create Core Infrastructure

### Task 2.1: Create TemplateRegistry Class
**Objective**: Build the new registry system that replaces StateTemplateManager

**Steps**:
1. Create `templates/core/TemplateRegistry.js`
2. Implement constructor with Map-based storage
3. Implement `register(stateCode, TemplateClass, metadata)` method
4. Implement `getTemplate(stateCode)` method with caching
5. Implement `getSupportedStates()` method
6. Implement `validateAffidavitData(stateCode, data)` method (delegates to template)
7. Implement `generateAffidavit(stateCode, data)` method (delegates to template)
8. Implement `getLegalCitations(stateCode)` method
9. Add error handling for unknown states
10. Add logging for debugging

**Files Changed**:
- NEW: `templates/core/TemplateRegistry.js`

**Interface** (must match StateTemplateManager):
```javascript
class TemplateRegistry {
  register(stateCode, TemplateClass, metadata)
  getTemplate(stateCode)
  getSupportedStates()
  validateAffidavitData(stateCode, data)
  generateAffidavit(stateCode, data)
  getLegalCitations(stateCode)
}
```

**Validation**:
- All methods match StateTemplateManager signature
- Can be drop-in replacement
- Unit tests pass

---

### Task 2.2: Create TemplateLoader Class
**Objective**: Build auto-discovery system for templates

**Steps**:
1. Create `templates/core/TemplateLoader.js`
2. Implement `loadAllTemplates(registry)` async method
3. Scan `templates/states/` directory for subdirectories
4. For each state directory:
   - Check for `AffidavitTemplate.js`
   - Check for `metadata.json`
   - Load and validate metadata
   - Require template class
   - Register with registry
5. Add error handling for missing/invalid templates
6. Add logging for loaded templates
7. Add validation that loaded template extends BaseAffidavitTemplate

**Files Changed**:
- NEW: `templates/core/TemplateLoader.js`

**Dependencies**:
- `fs/promises` for async file operations
- `path` for directory traversal
- `TemplateRegistry` for registration

**Validation**:
- Can discover all existing templates
- Handles missing files gracefully
- Logs all loaded templates

---

### Task 2.3: Create Metadata Validator Utility
**Objective**: Validate metadata.json files against schema

**Steps**:
1. Create `templates/core/validateMetadata.js`
2. Implement validation function using schema
3. Add helpful error messages for common mistakes
4. Export validator function

**Files Changed**:
- NEW: `templates/core/validateMetadata.js`

**Usage**:
```javascript
const { validateMetadata } = require('./validateMetadata');
const metadata = require('../states/texas/metadata.json');
const result = validateMetadata(metadata);
if (!result.valid) {
  throw new Error(result.errors.join(', '));
}
```

---

## Phase 3: Extract Individual State Templates

### Task 3.1: Extract Texas Template
**Objective**: Move TexasTemplate to its own file

**Steps**:
1. Create `templates/states/texas/AffidavitTemplate.js`
2. Copy TexasTemplate class from StateTemplateManager.js
3. Rename class to `TexasAffidavitTemplate` (for clarity)
4. Import BaseAffidavitTemplate from `../../core/BaseAffidavitTemplate.js`
5. Load metadata in constructor: `this.metadata = require('./metadata.json')`
6. Set state properties from metadata: `this.state = this.metadata.stateCode`
7. Add JSDoc comments for class and methods
8. Export class: `module.exports = TexasAffidavitTemplate;`
9. Keep original in StateTemplateManager.js (don't delete yet)

**Files Changed**:
- NEW: `templates/states/texas/AffidavitTemplate.js`

**Validation**:
- File can be required without errors
- Class properly extends BaseAffidavitTemplate
- Metadata loads correctly
- All methods work as expected

---

### Task 3.2: Extract Utah Template
**Objective**: Move UtahTemplate to its own file

**Steps**: (Same as Task 3.1 but for Utah)
1. Create `templates/states/utah/AffidavitTemplate.js`
2. Copy UtahTemplate class from StateTemplateManager.js
3. Rename to `UtahAffidavitTemplate`
4. Import BaseAffidavitTemplate
5. Load metadata from `./metadata.json`
6. Set properties from metadata
7. Add JSDoc comments
8. Export class

**Files Changed**:
- NEW: `templates/states/utah/AffidavitTemplate.js`

---

### Task 3.3: Extract Arizona Template
**Objective**: Move ArizonaTemplate to its own file

**Steps**: (Same as Task 3.1 but for Arizona)
1. Create `templates/states/arizona/AffidavitTemplate.js`
2. Copy ArizonaTemplate class from StateTemplateManager.js
3. Rename to `ArizonaAffidavitTemplate`
4. Import BaseAffidavitTemplate
5. Load metadata from `./metadata.json`
6. Set properties from metadata
7. Add JSDoc comments
8. Export class

**Files Changed**:
- NEW: `templates/states/arizona/AffidavitTemplate.js`

---

## Phase 4: Integration and Testing

### Task 4.1: Create Integration Tests
**Objective**: Ensure new system works identically to old system

**Steps**:
1. Create `__tests__/templates/core/TemplateRegistry.test.js`
2. Test template registration
3. Test template retrieval
4. Test getSupportedStates()
5. Test validation delegation
6. Test generation delegation
7. Test error handling for unknown states

**Files Changed**:
- NEW: `__tests__/templates/core/TemplateRegistry.test.js`

**Test Cases**:
- Register and retrieve templates
- getSupportedStates returns all states
- validateAffidavitData works for all states
- generateAffidavit works for all states
- Unknown state throws appropriate error

---

### Task 4.2: Create TemplateLoader Tests
**Objective**: Test auto-discovery system

**Steps**:
1. Create `__tests__/templates/core/TemplateLoader.test.js`
2. Test loading all templates
3. Test handling missing templates
4. Test handling invalid metadata
5. Test that all templates are registered correctly

**Files Changed**:
- NEW: `__tests__/templates/core/TemplateLoader.test.js`

---

### Task 4.3: Create Individual Template Tests
**Objective**: Test each state template in isolation

**Steps**:
1. Create `__tests__/templates/states/texas/AffidavitTemplate.test.js`
2. Create `__tests__/templates/states/utah/AffidavitTemplate.test.js`
3. Create `__tests__/templates/states/arizona/AffidavitTemplate.test.js`
4. Test each template's specific methods
5. Test metadata loading
6. Test state-specific validation
7. Test state-specific generation

**Files Changed**:
- NEW: `__tests__/templates/states/texas/AffidavitTemplate.test.js`
- NEW: `__tests__/templates/states/utah/AffidavitTemplate.test.js`
- NEW: `__tests__/templates/states/arizona/AffidavitTemplate.test.js`

---

### Task 4.4: Create Compatibility Test Suite
**Objective**: Ensure new system produces identical output to old system

**Steps**:
1. Create `__tests__/templates/compatibility.test.js`
2. Load both old StateTemplateManager and new TemplateRegistry
3. For each state:
   - Generate affidavit with old system
   - Generate affidavit with new system
   - Assert outputs are identical
4. Test with various input data scenarios
5. Test edge cases and validation errors

**Files Changed**:
- NEW: `__tests__/templates/compatibility.test.js`

**Critical Test**: This ensures zero regressions

---

## Phase 5: Server Integration

### Task 5.1: Create Template Initialization Module
**Objective**: Create a clean initialization module for server.js

**Steps**:
1. Create `templates/initialize.js`
2. Import TemplateRegistry and TemplateLoader
3. Export async `initializeTemplates()` function
4. Function creates registry, loads templates, returns registry
5. Add error handling and logging
6. Add startup validation

**Files Changed**:
- NEW: `templates/initialize.js`

**Code**:
```javascript
const { TemplateRegistry } = require('./core/TemplateRegistry');
const { TemplateLoader } = require('./core/TemplateLoader');

async function initializeTemplates() {
  console.log('Initializing template system...');

  const registry = new TemplateRegistry();
  const loader = new TemplateLoader();

  await loader.loadAllTemplates(registry);

  const states = registry.getSupportedStates();
  console.log(`Loaded templates for ${states.length} states:`,
              states.map(s => s.code).join(', '));

  return registry;
}

module.exports = { initializeTemplates };
```

---

### Task 5.2: Update server.js (Feature Flag)
**Objective**: Add new system alongside old system with feature flag

**Steps**:
1. Add environment variable `USE_NEW_TEMPLATE_SYSTEM=false`
2. Keep existing StateTemplateManager initialization
3. Add new initialization in else block:
   ```javascript
   if (process.env.USE_NEW_TEMPLATE_SYSTEM === 'true') {
     const { initializeTemplates } = require('./templates/initialize');
     templateManager = await initializeTemplates();
   } else {
     const { StateTemplateManager } = require('./templates/StateTemplateManager');
     templateManager = new StateTemplateManager();
   }
   ```
4. Set on app.locals as before
5. Document flag in `.env.example`

**Files Changed**:
- MODIFIED: `server.js` (lines around 286-290)
- MODIFIED: `.env.example`

**Validation**:
- Server starts with flag=false (old system)
- Server starts with flag=true (new system)
- Both work identically

---

### Task 5.3: Test Server with New System
**Objective**: Verify server works with new template system

**Steps**:
1. Set `USE_NEW_TEMPLATE_SYSTEM=true`
2. Start server
3. Test `/api/templates/states` endpoint
4. Test document preview generation
5. Test PDF generation
6. Test validation
7. Test chat interface
8. Test all three states
9. Compare outputs with old system

**Validation**:
- All endpoints work
- Outputs are identical
- No errors in console
- Performance is acceptable

---

## Phase 6: Cleanup and Documentation

### Task 6.1: Remove Feature Flag
**Objective**: Make new system the default

**Steps**:
1. Remove `USE_NEW_TEMPLATE_SYSTEM` environment variable
2. Remove old StateTemplateManager initialization code
3. Always use new system
4. Clean up server.js

**Files Changed**:
- MODIFIED: `server.js`
- MODIFIED: `.env.example`

---

### Task 6.2: Delete Old StateTemplateManager
**Objective**: Remove legacy code

**Steps**:
1. Delete `templates/StateTemplateManager.js`
2. Update any remaining requires/imports
3. Remove from git

**Files Changed**:
- DELETED: `templates/StateTemplateManager.js`

**Validation**:
- No broken imports
- All tests pass
- Grep for any remaining references

---

### Task 6.3: Update Existing Tests
**Objective**: Migrate old tests to new system

**Steps**:
1. Update `__tests__/templates/StateTemplateManager.test.js`
2. Rename to `__tests__/templates/core/TemplateRegistry.test.js` (if not already done)
3. Update imports to use TemplateRegistry
4. Ensure all test cases still pass
5. Add new test cases for new functionality

**Files Changed**:
- MODIFIED/MOVED: `__tests__/templates/StateTemplateManager.test.js`

---

### Task 6.4: Create README for Templates
**Objective**: Document the new template system

**Steps**:
1. Create `templates/README.md`
2. Document directory structure
3. Document how to add a new state
4. Document metadata.json schema
5. Document BaseAffidavitTemplate interface
6. Provide examples
7. Document testing approach

**Files Changed**:
- NEW: `templates/README.md`

**Sections**:
- Overview
- Directory Structure
- Adding a New State (step-by-step guide)
- Template Development Guide
- Metadata Reference
- Testing Templates
- Architecture Decisions

---

### Task 6.5: Create State Template Guide
**Objective**: Provide cookbook for adding new states

**Steps**:
1. Create `templates/ADDING_A_STATE.md`
2. Provide step-by-step instructions with examples
3. Include checklist of required files
4. Include common pitfalls
5. Include testing checklist
6. Provide template starter files

**Files Changed**:
- NEW: `templates/ADDING_A_STATE.md`

**Content**:
- Prerequisites
- Step 1: Create directory
- Step 2: Create metadata.json
- Step 3: Create AffidavitTemplate.js
- Step 4: Implement state-specific methods
- Step 5: Add tests
- Step 6: Test integration
- Checklist

---

### Task 6.6: Create Template Starter Files
**Objective**: Provide boilerplate for new states

**Steps**:
1. Create `templates/_template/` directory
2. Create `templates/_template/metadata.json` with example structure
3. Create `templates/_template/AffidavitTemplate.js` with boilerplate code
4. Add TODO comments for customization points
5. Document in README

**Files Changed**:
- NEW: `templates/_template/metadata.json`
- NEW: `templates/_template/AffidavitTemplate.js`
- NEW: `templates/_template/README.md`

---

### Task 6.7: Update Main README
**Objective**: Document new template system in main README

**Steps**:
1. Open `README.md`
2. Update template section
3. Link to `templates/README.md`
4. Update architecture diagram if exists
5. Update contributing guidelines

**Files Changed**:
- MODIFIED: `README.md`

---

## Phase 7: Validation and Performance

### Task 7.1: Run Full Test Suite
**Objective**: Ensure all tests pass

**Steps**:
1. Run `npm test`
2. Fix any failing tests
3. Ensure code coverage is maintained
4. Review coverage report

**Validation**:
- All tests pass
- Coverage ≥ current coverage
- No new warnings

---

### Task 7.2: Performance Testing
**Objective**: Ensure no performance regression

**Steps**:
1. Create `__tests__/performance/templateLoading.test.js`
2. Benchmark template loading time
3. Benchmark template generation time
4. Compare with old system
5. Ensure comparable or better performance

**Files Changed**:
- NEW: `__tests__/performance/templateLoading.test.js`

**Metrics**:
- Template initialization time
- First template access time
- Generate affidavit time (avg over 100 iterations)
- Memory usage

---

### Task 7.3: Manual QA Testing
**Objective**: Test all user-facing functionality

**Test Scenarios**:
1. Select Texas, generate affidavit, preview, download PDF
2. Select Utah, generate affidavit, preview, download PDF
3. Select Arizona, generate affidavit, preview, download PDF
4. Test chat interface with each state
5. Test validation with each state
6. Test with invalid data
7. Test state switching
8. Test with complex affidavits (many facts, exhibits)

**Validation Checklist**:
- [ ] All states work
- [ ] PDFs generate correctly
- [ ] Validation works
- [ ] Chat works
- [ ] Preview works
- [ ] No console errors
- [ ] UI responsive

---

## Phase 8: Future Extensibility Demo

### Task 8.1: Create Example Fourth State
**Objective**: Prove extensibility by adding a new state

**Steps**:
1. Choose a fourth state (e.g., California)
2. Create `templates/states/california/` directory
3. Create `metadata.json` with California requirements
4. Create `AffidavitTemplate.js` with California-specific logic
5. Research California affidavit requirements (for realism)
6. Restart server
7. Verify California appears in supported states
8. Generate test affidavit
9. Document how easy it was

**Files Changed**:
- NEW: `templates/states/california/metadata.json`
- NEW: `templates/states/california/AffidavitTemplate.js`

**Success Criteria**:
- Add new state WITHOUT modifying any core files
- Server auto-discovers new state
- New state works immediately
- Under 1 hour to add new state

---

### Task 8.2: Document Extensibility Win
**Objective**: Show before/after comparison

**Steps**:
1. Create `docs/TEMPLATE_REFACTORING_RESULTS.md`
2. Document old approach (edit StateTemplateManager.js, manual registration)
3. Document new approach (drop in new directory)
4. Show lines of code comparison
5. Show time to add new state comparison
6. Include screenshots/examples

**Files Changed**:
- NEW: `docs/TEMPLATE_REFACTORING_RESULTS.md`

---

## Phase 9: Final Review and Deployment

### Task 9.1: Code Review Preparation
**Objective**: Prepare for code review

**Steps**:
1. Review all changed files
2. Ensure consistent code style
3. Ensure all JSDoc comments present
4. Remove console.logs (except intentional logging)
5. Remove commented-out code
6. Check for TODOs and resolve or document

**Validation**:
- ESLint passes
- Prettier formatted
- No debugging code
- All TODOs addressed

---

### Task 9.2: Create Migration Notes
**Objective**: Document what changed for team

**Steps**:
1. Create `docs/TEMPLATE_MIGRATION_NOTES.md`
2. Summarize changes
3. List breaking changes (none expected)
4. Document new file locations
5. Document new development workflow
6. Include FAQ section

**Files Changed**:
- NEW: `docs/TEMPLATE_MIGRATION_NOTES.md`

---

### Task 9.3: Update CHANGELOG
**Objective**: Document changes for version history

**Steps**:
1. Open `CHANGELOG.md` (create if doesn't exist)
2. Add new section for this refactoring
3. List all changes
4. Categorize: Added, Changed, Removed
5. Date the entry

**Files Changed**:
- MODIFIED: `CHANGELOG.md`

---

### Task 9.4: Final Testing on Clean Environment
**Objective**: Test on fresh install

**Steps**:
1. Clone repo fresh
2. Install dependencies
3. Run migrations if any
4. Start server
5. Run test suite
6. Test manual scenarios
7. Document any issues

**Validation**:
- Works on fresh install
- No missing dependencies
- Clear error messages
- Documentation is sufficient

---

### Task 9.5: Commit and Push
**Objective**: Save work to remote

**Steps**:
1. Stage all changes: `git add .`
2. Review staged changes: `git status`
3. Create comprehensive commit message
4. Commit: `git commit -m "Refactor template organization for extensibility"`
5. Push: `git push -u origin claude/refactor-template-organization-01XTJt1WDBX2siPR2RWqSEGE`

**Commit Message Template**:
```
Refactor template organization for extensibility

BREAKING CHANGES: None (backward compatible)

Changes:
- Extract BaseAffidavitTemplate to core module
- Create TemplateRegistry for dynamic template management
- Create TemplateLoader for auto-discovery
- Split state templates into individual files organized by state
- Add metadata.json for declarative template configuration
- Update server.js to use new template system
- Add comprehensive tests for new system
- Add documentation for adding new states

Benefits:
- Add new states without modifying core files
- Drop-in template extensibility
- Better separation of concerns
- Easier testing and maintenance
- Foundation for multiple document types

Files changed: [count]
Tests added: [count]
Test coverage: [percentage]
```

---

## Summary of Deliverables

### New Files Created (43)
**Core Infrastructure (5)**:
- `templates/core/BaseAffidavitTemplate.js`
- `templates/core/TemplateRegistry.js`
- `templates/core/TemplateLoader.js`
- `templates/core/validateMetadata.js`
- `templates/core/templateMetadata.schema.json`
- `templates/initialize.js`

**State Templates (9 - 3 per state)**:
- `templates/states/texas/metadata.json`
- `templates/states/texas/AffidavitTemplate.js`
- `templates/states/utah/metadata.json`
- `templates/states/utah/AffidavitTemplate.js`
- `templates/states/arizona/metadata.json`
- `templates/states/arizona/AffidavitTemplate.js`

**Template Starter (3)**:
- `templates/_template/metadata.json`
- `templates/_template/AffidavitTemplate.js`
- `templates/_template/README.md`

**Tests (7)**:
- `__tests__/templates/core/TemplateRegistry.test.js`
- `__tests__/templates/core/TemplateLoader.test.js`
- `__tests__/templates/states/texas/AffidavitTemplate.test.js`
- `__tests__/templates/states/utah/AffidavitTemplate.test.js`
- `__tests__/templates/states/arizona/AffidavitTemplate.test.js`
- `__tests__/templates/compatibility.test.js`
- `__tests__/performance/templateLoading.test.js`

**Documentation (6)**:
- `templates/README.md`
- `templates/ADDING_A_STATE.md`
- `docs/TEMPLATE_MIGRATION_NOTES.md`
- `docs/TEMPLATE_REFACTORING_RESULTS.md`
- `TEMPLATE_REFACTORING_PLAN.md` (this file)
- `CHANGELOG.md` (updated)

**Example Fourth State (2)**:
- `templates/states/california/metadata.json`
- `templates/states/california/AffidavitTemplate.js`

### Files Modified (3)
- `server.js` (template initialization)
- `.env.example` (feature flag)
- `README.md` (documentation update)

### Files Deleted (1)
- `templates/StateTemplateManager.js` (replaced by new system)

---

## Risk Mitigation

### Risks and Mitigations

1. **Risk**: Breaking existing functionality
   - **Mitigation**: Feature flag, compatibility tests, parallel systems

2. **Risk**: Performance degradation
   - **Mitigation**: Performance tests, benchmarking

3. **Risk**: Missing edge cases
   - **Mitigation**: Comprehensive test suite, compatibility tests

4. **Risk**: Documentation incomplete
   - **Mitigation**: Multiple documentation files, examples, starter templates

5. **Risk**: Team confusion during transition
   - **Mitigation**: Migration notes, clear commit messages, README updates

---

## Success Criteria

### Technical Success
- [ ] All tests pass
- [ ] No performance regression
- [ ] Zero breaking changes
- [ ] Code coverage maintained
- [ ] All three states work identically

### Extensibility Success
- [ ] Can add fourth state in < 1 hour
- [ ] No core file modifications needed for new state
- [ ] Clear documentation for adding states
- [ ] Template starter files work out of box

### Code Quality Success
- [ ] ESLint passes
- [ ] All files properly documented
- [ ] Consistent code style
- [ ] No technical debt introduced

---

## Estimated Effort

### Time Estimates (Developer Hours)

| Phase | Tasks | Estimated Hours |
|-------|-------|----------------|
| Phase 1: Setup and Foundation | 6 tasks | 4 hours |
| Phase 2: Core Infrastructure | 3 tasks | 8 hours |
| Phase 3: Extract State Templates | 3 tasks | 6 hours |
| Phase 4: Integration and Testing | 4 tasks | 10 hours |
| Phase 5: Server Integration | 3 tasks | 4 hours |
| Phase 6: Cleanup and Documentation | 7 tasks | 8 hours |
| Phase 7: Validation and Performance | 3 tasks | 6 hours |
| Phase 8: Future Extensibility Demo | 2 tasks | 3 hours |
| Phase 9: Final Review and Deployment | 5 tasks | 3 hours |
| **TOTAL** | **36 tasks** | **52 hours** |

### Task Breakdown by Type
- **Development**: 20 tasks (30 hours)
- **Testing**: 8 tasks (14 hours)
- **Documentation**: 8 tasks (8 hours)

---

## Next Steps

1. **Review this plan** with team/stakeholders
2. **Adjust estimates** based on feedback
3. **Begin Phase 1** with low-risk foundational tasks
4. **Proceed incrementally** through phases
5. **Test continuously** after each phase
6. **Document as you go** to maintain clarity

---

## Notes

- This plan prioritizes **safety** and **incrementality**
- Feature flag allows **A/B testing** old vs new system
- Compatibility tests ensure **zero regressions**
- Documentation enables **team adoption**
- Starter templates enable **rapid expansion**
- Performance tests prevent **degradation**

**Philosophy**: Refactor in place, test continuously, document thoroughly, deploy confidently.
