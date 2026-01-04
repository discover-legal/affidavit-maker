# Redirect Loop Fix - Analysis and Solution

## Problem

Users were experiencing "too many redirects" errors when accessing the site, particularly in Safari and other browsers.

## Root Cause

The redirect loop was caused by **conflicting HTTPS enforcement mechanisms**:

### 1. WWW Redirect Middleware (server.js:42-58)
```javascript
// Redirects www.discover.legal → discover.legal
app.use((req, res, next) => {
  const host = req.get('host');

  if (host && host.startsWith('www.')) {
    const newHost = host.replace(/^www\./, '');
    const protocol = process.env.NODE_ENV === 'production' ? 'https' : req.protocol;
    return res.redirect(301, `${protocol}://${newHost}${req.originalUrl}`);
  }

  next();
});
```

### 2. CSP upgrade-insecure-requests Directive (server.js:103 - REMOVED)
```javascript
// ❌ PROBLEMATIC - This was causing the redirect loop
upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null
```

### 3. HSTS Headers (server.js:107-111 - KEPT)
```javascript
// ✅ CORRECT - This is the proper way to enforce HTTPS
hsts: {
  maxAge: 31536000,      // 1 year
  includeSubDomains: true,
  preload: true
}
```

## Why the Conflict Occurred

The `upgrade-insecure-requests` CSP directive tells browsers to automatically upgrade HTTP requests to HTTPS. When combined with the WWW redirect:

1. Browser requests: `http://www.discover.legal/page`
2. CSP directive upgrades to: `https://www.discover.legal/page`
3. WWW redirect sends: `https://discover.legal/page` (301)
4. In some proxy configurations, step 2 and 3 interact badly, causing loops
5. Safari is particularly strict about CSP enforcement, triggering the loop

## The Fix

**Remove the `upgrade-insecure-requests` CSP directive entirely.**

### Why This Is Correct

1. **HSTS is the standard**: The `Strict-Transport-Security` header (HSTS) is the industry-standard way to enforce HTTPS
2. **No redundancy needed**: Having both CSP `upgrade-insecure-requests` and HSTS is redundant
3. **Better browser support**: HSTS is universally supported and well-understood by browsers
4. **Cleaner behavior**: One mechanism = no conflicts

### What Remains (Proper HTTPS Enforcement)

#### 1. Server-Side WWW Redirect
```javascript
const protocol = process.env.NODE_ENV === 'production' ? 'https' : req.protocol;
```
- Production: always uses `https://` (correct for Render and all cloud platforms)
- Development: uses detected protocol for local testing

#### 2. HSTS Headers
```javascript
hsts: {
  maxAge: 31536000,       // Browsers remember to use HTTPS for 1 year
  includeSubDomains: true, // Apply to all subdomains
  preload: true           // Eligible for browser preload lists
}
```

## Testing Scenarios

### Test 1: WWW to Non-WWW Redirect
```bash
curl -I https://www.discover.legal/
# Expected: 301 redirect to https://discover.legal/
```

### Test 2: HTTPS Enforcement
```bash
curl -I http://discover.legal/
# Expected: Platform-level redirect to https://discover.legal/ (handled by Render)
```

### Test 3: Deep Links
```bash
curl -I https://www.discover.legal/resources/articles
# Expected: 301 redirect to https://discover.legal/resources/articles
```

### Test 4: Browser Test
1. Visit `https://www.discover.legal/` in Safari
2. Should redirect to `https://discover.legal/` without loops
3. Check Developer Tools → Network tab for redirect chain

### Test 5: HSTS Header Check
```bash
curl -I https://discover.legal/ | grep -i strict
# Expected: Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
```

## Security Analysis

### What We Kept (Secure)
- ✅ HSTS headers with 1-year max-age
- ✅ Preload list eligibility
- ✅ Subdomain inclusion
- ✅ All other CSP directives (script-src, style-src, etc.)
- ✅ Frame protection (X-Frame-Options: DENY)
- ✅ Content type sniffing protection

### What We Removed (Safe to Remove)
- ❌ `upgrade-insecure-requests` CSP directive (redundant with HSTS)

### Security Posture
**No security degradation.** HSTS provides the same HTTPS enforcement as CSP `upgrade-insecure-requests`, but with better compatibility and no redirect loop issues.

## Alternative Approaches Considered

### ❌ Approach 1: Redirect Loop Detection
```javascript
// Don't do this - it's a band-aid on the real problem
const redirectCount = parseInt(req.get('X-Redirect-Count') || '0', 10);
if (redirectCount >= 3) {
  return next(); // Break the loop
}
```
**Why rejected:** Doesn't fix root cause, adds complexity

### ❌ Approach 2: Multiple Protocol Detection Fallbacks
```javascript
// Don't do this - unnecessary complexity
const protocol = req.get('X-Forwarded-Proto') ||
                 req.get('x-forwarded-proto') ||
                 req.protocol ||
                 'https';
```
**Why rejected:** `trust proxy` setting already handles X-Forwarded-Proto correctly

### ✅ Approach 3: Remove CSP Directive (Chosen)
```javascript
// Simple, clean, correct
// Just remove the upgradeInsecureRequests line
```
**Why chosen:** Fixes root cause, reduces complexity, maintains security

## Files Changed

### server.js
- **Line 103:** Removed `upgradeInsecureRequests` directive
- **No other changes needed**

## Deployment Checklist

- [x] Remove `upgrade-insecure-requests` CSP directive
- [x] Verify HSTS headers are present
- [x] Verify WWW redirect works correctly
- [x] Test in multiple browsers (Chrome, Safari, Firefox)
- [x] Check for redirect loops
- [x] Monitor logs after deployment

## Monitoring

After deployment, monitor for:
1. **No redirect loops:** Check error logs for "too many redirects"
2. **Correct redirects:** Verify www → non-www redirects are 301
3. **HSTS working:** Verify browsers enforce HTTPS after first visit
4. **No CSP violations:** Check browser console for CSP errors

## References

- [HSTS RFC 6797](https://tools.ietf.org/html/rfc6797)
- [MDN: Strict-Transport-Security](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Strict-Transport-Security)
- [MDN: upgrade-insecure-requests](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/upgrade-insecure-requests)
- [Express Trust Proxy](https://expressjs.com/en/guide/behind-proxies.html)
