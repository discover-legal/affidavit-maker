# Template Starter Files

This directory contains boilerplate files for creating new state templates.

## Usage

To create a new state template:

1. **Create your state directory:**
   ```bash
   cd templates/states
   mkdir yourstate  # lowercase, no spaces
   ```

2. **Copy the starter files:**
   ```bash
   cp ../\_template/metadata.json yourstate/
   cp ../\_template/AffidavitTemplate.js yourstate/
   ```

3. **Edit the files:**
   - Update `metadata.json` with your state's configuration
   - Implement required methods in `AffidavitTemplate.js`
   - Follow the TODO comments in each file

4. **Test and validate:**
   - Restart the server to auto-discover your template
   - Test document generation
   - Verify legal compliance

## Files Included

### metadata.json

Template configuration with placeholders for:
- State code and name
- Required and optional fields
- Feature flags (perjury statement, notary block, etc.)
- Legal citations
- Exhibit rules

### AffidavitTemplate.js

Skeleton template class with:
- Basic structure extending BaseAffidavitTemplate
- TODO comments for all methods
- Examples of common overrides
- Placeholders for state-specific logic

## Documentation

See [ADDING_A_STATE.md](../ADDING_A_STATE.md) for complete step-by-step instructions.

## Important Notes

- **DO NOT** modify the files in `_template/` - they are starters only
- **ALWAYS** research your state's legal requirements before implementing
- **TEST** thoroughly before deploying to production
- **DOCUMENT** your legal research and compliance decisions

## Quick Start Checklist

- [ ] Create state directory
- [ ] Copy starter files
- [ ] Research state law requirements
- [ ] Update metadata.json
- [ ] Implement generateNotaryBlock()
- [ ] Implement other state-specific methods
- [ ] Add legal citations
- [ ] Test validation
- [ ] Test document generation
- [ ] Review for legal compliance
- [ ] Commit changes

## Support

For help:
- Review existing templates (texas, utah, arizona)
- Read [README.md](../README.md)
- Check [ADDING_A_STATE.md](../ADDING_A_STATE.md)
