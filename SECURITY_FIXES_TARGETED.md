# Targeted Security Fixes Plan

**Date**: 2026-01-26
**Scope**: Prioritized fixes per user request
**Approach**: Minimal, elegant changes grouped by file proximity

---

## Fixes Requested

From user review, focusing on:
- ✅ Path traversal (PDF + evidence)
- ✅ MIME spoofing (magic bytes)
- ✅ HTML content injection
- ✅ CSRF path matching
- ✅ Error message exposure
- ✅ Auth0 ID validation
- ✅ RLS failure handling
- ✅ CSP (keep only GA-required)
- ✅ Console logging cleanup
- ✅ PDF bomb protection
- ✅ Loosen Stripe rate limiting
- ✅ Filename header injection
- ✅ CSP for file downloads

**Explicitly excluded**: LLM prompt injection (facts are user-provided, perjury is on them)

---

## Implementation Groups

### Group 1: Path & File Security
**Files**: `services/pdfService.js`, `services/evidenceStorage.js`, `routes/evidence.js`

### Group 2: CSRF & Rate Limiting
**Files**: `middleware/csrfProtection.js`, `routes/payment.js`, `routes/validation.js`

### Group 3: Error Sanitization
**Files**: `middleware/errorMiddleware.js`, `routes/evidence.js`, `routes/documents.js`, `routes/payment.js`

### Group 4: HTML Escaping
**Files**: `templates/core/BaseAffidavitTemplate.js`

### Group 5: Auth Hardening
**Files**: `middleware/auth0Middleware.js`, `routes/auth0-webhooks.js`

### Group 6: Headers & Logging
**Files**: `server.js`, `routes/evidence.js`, various services

---

## Group 1: Path & File Security

### 1.1 Path Validation Helper

Add a shared utility for path validation:

```javascript
// utils/pathSecurity.js
const path = require('path');

/**
 * Validate that a path stays within a base directory
 * Returns resolved path or throws
 */
function validatePath(basePath, relativePath) {
  const resolved = path.resolve(basePath, relativePath);
  const normalizedBase = path.resolve(basePath) + path.sep;

  if (!resolved.startsWith(normalizedBase) && resolved !== path.resolve(basePath)) {
    throw new Error('Path traversal attempt blocked');
  }
  return resolved;
}

module.exports = { validatePath };
```

### 1.2 Fix PDF Exhibit Path Traversal

**File**: `services/pdfService.js:647-662`

```javascript
// Before
const filePath = path.join(evidenceBasePath, fileKey);

// After
const { validatePath } = require('../utils/pathSecurity');
const filePath = validatePath(evidenceBasePath, fileKey);
```

### 1.3 Fix Evidence GET Endpoint

**File**: `routes/evidence.js:185-188`

Add fileKey validation before use:

```javascript
router.get('/:documentId/:fileKey',
  auth0Middleware,
  asyncHandler(async (req, res) => {
    const { documentId, fileKey } = req.params;

    // Validate fileKey format (alphanumeric, slashes, dots, hyphens, underscores only)
    if (!/^[\w.\-\/]+$/.test(fileKey) || fileKey.includes('..')) {
      return res.status(400).json({ success: false, error: 'Invalid file key format' });
    }
    // ... rest unchanged
```

### 1.4 Magic Byte Validation

**Dependency**: `npm install file-type@16.5.4` (CommonJS-compatible)

**File**: `services/evidenceStorage.js` - add method:

```javascript
const FileType = require('file-type');

const ALLOWED_TYPES = new Map([
  ['application/pdf', 'pdf'],
  ['image/jpeg', 'jpg'],
  ['image/png', 'png']
]);

async validateFileContent(filepath) {
  const detected = await FileType.fromFile(filepath);

  if (!detected || !ALLOWED_TYPES.has(detected.mime)) {
    const fs = require('fs').promises;
    await fs.unlink(filepath).catch(() => {});  // Clean up
    throw new Error('File type not allowed or could not be verified');
  }

  return { mime: detected.mime, ext: ALLOWED_TYPES.get(detected.mime) };
}
```

Call after file move in `uploadEvidence()`:

```javascript
// After: await fs.rename(file.path, filepath);
await this.validateFileContent(filepath);
```

### 1.5 PDF Bomb Protection

**File**: `services/evidenceStorage.js:93-115`

Add limits in `getFileMetadata()`:

```javascript
if (ext.toLowerCase() === '.pdf') {
  // ... existing page counting ...

  // PDF bomb protection
  const MAX_PAGES = 500;
  const MIN_BYTES_PER_PAGE = 100;

  if (metadata.filePages > MAX_PAGES) {
    throw new Error(`PDF exceeds maximum ${MAX_PAGES} pages`);
  }

  if (metadata.filePages > 1 && metadata.fileSizeBytes / metadata.filePages < MIN_BYTES_PER_PAGE) {
    throw new Error('PDF structure appears malformed');
  }
}
```

---

## Group 2: CSRF & Rate Limiting

### 2.1 CSRF Webhook Whitelist

**File**: `middleware/csrfProtection.js:58`

```javascript
// Before
const isWebhook = req.path.includes('/webhook') || req.path.includes('/webhooks');

// After
const WEBHOOK_PATHS = new Set([
  '/api/payment/webhook',
  '/api/auth0-webhooks/user-update',
  '/api/auth0-webhooks/email-update',
  '/api/auth0-webhooks/user-delete'
]);
const isWebhook = WEBHOOK_PATHS.has(req.path);
```

### 2.2 Remove Stripe Webhook Rate Limit

**File**: `routes/payment.js:330-331`

```javascript
// Before
router.post('/webhook',
  strictLimiter,
  asyncHandler(...

// After
router.post('/webhook',
  // Stripe webhooks have signature verification - rate limiting can drop legitimate events
  asyncHandler(...
```

### 2.3 Add Rate Limit to Validation Endpoint

**File**: `routes/validation.js` - near top

```javascript
const { chatLimiter } = require('../middleware/rateLimiting');

router.post('/',
  chatLimiter,  // Add before auth
  auth0Middleware,
  asyncHandler(...
```

---

## Group 3: Error Sanitization

### 3.1 Safe Error Helper

**File**: `middleware/errorMiddleware.js` - add export:

```javascript
/**
 * Get safe error message for client responses
 */
const safeErrorMessage = (error, fallback = 'An error occurred') => {
  // Known safe errors can pass through
  if (error instanceof ValidationError ||
      error instanceof NotFoundError ||
      error instanceof AuthenticationError) {
    return error.message;
  }

  // Production: hide internal details
  if (process.env.NODE_ENV === 'production') {
    return fallback;
  }

  return error.message || fallback;
};

module.exports = { /* existing */, safeErrorMessage };
```

### 3.2 Apply to Endpoints

**evidence.js:264**:
```javascript
error: safeErrorMessage(error, 'Failed to retrieve evidence')
```

**evidence.js:175**:
```javascript
error: safeErrorMessage(error, 'Failed to upload evidence')
```

**documents.js** - where applicable:
```javascript
error: safeErrorMessage(error, 'Failed to process document')
```

**payment.js:363** (webhook signature):
```javascript
// Keep minimal - don't expose signature details
error: 'Webhook verification failed'
```

---

## Group 4: HTML Content Injection

### 4.1 HTML Escape Utility

**File**: `templates/core/BaseAffidavitTemplate.js` - add at top:

```javascript
const escapeHtml = (str) => {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};
```

### 4.2 Apply in generateHTMLContent()

**File**: `templates/core/BaseAffidavitTemplate.js:438-526`

Wrap all user content with `escapeHtml()`:

```javascript
${sections.header ? `<div class="header">${escapeHtml(sections.header)}</div>` : ''}
${sections.venue ? `<div class="venue">${escapeHtml(sections.venue)}</div>` : ''}
// ... apply to all sections.* that contain user data
${sections.facts?.items ? sections.facts.items.map(f =>
  `<p class="fact">${f.number}. ${escapeHtml(f.content)}</p>`
).join('\n  ') : ''}
```

---

## Group 5: Auth Hardening

### 5.1 Auth0 ID Format Validation

**File**: `routes/auth0-webhooks.js` - add helper and use:

```javascript
// Near top
const isValidAuth0Id = (id) => /^[a-z0-9\-]+\|[a-zA-Z0-9_\-]+$/.test(id);

// In handlers, after user.user_id check:
if (!isValidAuth0Id(user.user_id)) {
  logger.logSecurity('invalid_auth0_id_format', {
    receivedId: String(user.user_id).substring(0, 30)
  });
  return res.status(400).json({ success: false, error: 'Invalid user ID format' });
}
```

### 5.2 RLS Failure Handling (optionalAuth)

**File**: `middleware/auth0Middleware.js:503-511`

The current behavior is intentional for optional auth - document the tradeoff:

```javascript
} catch (rlsError) {
  dbClient.release();
  // NOTE: For optionalAuth, we continue without RLS to avoid breaking public endpoints.
  // Handlers using optionalAuth must not rely on RLS for security when req.user is present.
  logger.warn('RLS setup failed in optionalAuth - continuing without DB-level isolation', {
    error: rlsError.message,
    userId: req.user.id
  });
  req.dbClient = null;  // Signal to handlers that RLS is not active
}
```

---

## Group 6: Headers & Logging

### 6.1 Evidence Download Headers

**File**: `routes/evidence.js:234-235`

```javascript
// Sanitize filename
const sanitizeFilename = (name) => name.replace(/[^\w.\-]/g, '_').substring(0, 100);

// Set headers
res.setHeader('Content-Type', contentType);
res.setHeader('Content-Disposition', `inline; filename="${sanitizeFilename(path.basename(evidence.filepath))}"`);
res.setHeader('X-Content-Type-Options', 'nosniff');
res.setHeader('Content-Security-Policy', "default-src 'none'");
```

### 6.2 CSP - Already Correct

**File**: `server.js:77-87`

Current CSP is acceptable:
- `'unsafe-eval'` required for gtag.js (documented)
- `'unsafe-inline'` only in development
- All sources are intentional

No changes needed unless removing Google Analytics.

### 6.3 Console Logging Cleanup

**Files**: `services/pdfService.js`, `services/evidenceStorage.js`

Replace console calls with logger:

```javascript
// Before
console.log(`📎 Processing Exhibit ${exhibitLabel}:`, { description, fileKey, filePath, exists });

// After
logger.debug('Processing exhibit', { exhibitLabel, description });
```

Remove emoji prefixes, file paths, and sensitive details from logs. Use:
- `logger.debug()` for development info
- `logger.info()` for important operations
- `logger.warn()` for concerning but recoverable
- `logger.error()` for failures

---

## Implementation Order

| Phase | Tasks | Files | Est. Time |
|-------|-------|-------|-----------|
| 1 | Path validation utility | `utils/pathSecurity.js` (new) | 15 min |
| 2 | PDF path traversal fix | `services/pdfService.js` | 10 min |
| 3 | Evidence GET validation | `routes/evidence.js` | 10 min |
| 4 | CSRF whitelist | `middleware/csrfProtection.js` | 10 min |
| 5 | Magic byte validation | `services/evidenceStorage.js` + npm install | 20 min |
| 6 | PDF bomb protection | `services/evidenceStorage.js` | 10 min |
| 7 | Error sanitization | `middleware/errorMiddleware.js` + routes | 20 min |
| 8 | HTML escaping | `templates/core/BaseAffidavitTemplate.js` | 15 min |
| 9 | Rate limiting adjustments | `routes/payment.js`, `routes/validation.js` | 10 min |
| 10 | Auth0 ID validation | `routes/auth0-webhooks.js` | 10 min |
| 11 | Response headers | `routes/evidence.js` | 10 min |
| 12 | Logging cleanup | Various services | 20 min |

**Total: ~2.5 hours**

---

## Dependencies

```bash
npm install file-type@16.5.4
```

---

## Testing Checklist

After implementation:

```bash
# Path traversal
curl -H "Authorization: Bearer $TOKEN" \
  "http://localhost:3001/api/evidence/1/../../../etc/passwd"
# Should return 400

# CSRF bypass attempt
curl -X POST -H "Origin: http://evil.com" \
  "http://localhost:3001/api/documents/webhook-test"
# Should return 403

# HTML injection (create fact with script tag, view preview)
# Should see escaped &lt;script&gt;

# PDF bomb (upload 1000-page PDF)
# Should reject with error

# Rate limiting on /api/validate
for i in {1..60}; do curl -X POST ...; done
# Should get 429 after limit
```

---

## Files Summary

| File | Change Type |
|------|------------|
| `utils/pathSecurity.js` | **NEW** |
| `services/pdfService.js` | Edit |
| `services/evidenceStorage.js` | Edit |
| `routes/evidence.js` | Edit |
| `routes/validation.js` | Edit |
| `routes/payment.js` | Edit |
| `routes/documents.js` | Edit |
| `routes/auth0-webhooks.js` | Edit |
| `middleware/csrfProtection.js` | Edit |
| `middleware/errorMiddleware.js` | Edit |
| `middleware/auth0Middleware.js` | Comment only |
| `templates/core/BaseAffidavitTemplate.js` | Edit |

**Total: 1 new file, 11 edits**
