# Render.com WWW to Non-WWW Redirect Setup

## Overview

This guide explains how to set up a redirect from `www.discover.legal` to `discover.legal` to eliminate duplicate content issues that negatively impact Google indexing.

## Why This Is Important

Google Search Console is reporting "Page with redirect" issues because both `www.discover.legal` and `discover.legal` are accessible, creating duplicate content. This causes:

- Wasted crawl budget on duplicate pages
- Split PageRank between two versions
- Confusion about which version to index
- Lower search rankings

## Solution: Redirect at the Render.com Level

The best approach is to handle the redirect at the hosting level (Render.com) before the application even loads. This is more efficient than server-side code.

## Setup Instructions

### Option 1: Using Render Custom Domains (Recommended)

1. **Log in to Render Dashboard**
   - Go to https://dashboard.render.com
   - Select your `affidavit-maker` web service

2. **Navigate to Custom Domains**
   - Click on the "Settings" tab
   - Scroll to "Custom Domains" section

3. **Configure Primary Domain**
   - Set `discover.legal` as your **primary custom domain**
   - Ensure it's marked as the canonical version

4. **Add WWW Domain with Redirect**
   - Add `www.discover.legal` as a secondary custom domain
   - In Render, there should be an option to "Redirect to primary domain"
   - Enable this option for `www.discover.legal`

5. **Verify DNS Settings**
   - Ensure both domains point to Render:
     - `discover.legal` → A record or CNAME to Render
     - `www.discover.legal` → CNAME to Render

6. **Test the Redirect**
   ```bash
   # Should return a 301 redirect
   curl -I https://www.discover.legal/

   # Expected output:
   # HTTP/1.1 301 Moved Permanently
   # Location: https://discover.legal/
   ```

### Option 2: Using Render.yaml Configuration (If Supported)

If Render supports redirect rules in YAML (check their latest docs):

```yaml
services:
  - type: web
    name: affidavit-maker
    # ... existing config ...

    # Add redirect rules
    redirects:
      - source: https://www.discover.legal/*
        destination: https://discover.legal/:splat
        status: 301
```

**Note:** As of this writing, Render may not support redirect rules in render.yaml. Check their documentation: https://render.com/docs/redirects

### Option 3: Using Cloudflare (If Using CDN)

If you're using Cloudflare in front of Render:

1. **Log in to Cloudflare**
2. **Go to Rules → Page Rules**
3. **Create a new Page Rule:**
   - URL Pattern: `www.discover.legal/*`
   - Setting: Forwarding URL (301 - Permanent Redirect)
   - Destination: `https://discover.legal/$1`
4. **Save and Deploy**

### Option 4: DNS-Level (Not Recommended)

You could configure DNS to only resolve `discover.legal`, but this would cause `www.discover.legal` to fail completely rather than redirect, which is poor UX.

## Verification Steps

After setting up the redirect:

1. **Test with curl:**
   ```bash
   curl -I https://www.discover.legal/
   curl -I https://www.discover.legal/resources
   curl -I https://www.discover.legal/privacy
   ```

   All should return:
   ```
   HTTP/1.1 301 Moved Permanently
   Location: https://discover.legal/[path]
   ```

2. **Test in browser:**
   - Visit https://www.discover.legal/
   - URL bar should show https://discover.legal/ (without www)

3. **Verify in Google Search Console:**
   - After 1-2 weeks, the "Page with redirect" issues should resolve
   - Google will consolidate indexing to the non-www version

## Update CORS Configuration (Already Done)

The server already accepts both domains in CORS:

```javascript
// server.js:120-122
origins.push(
  'https://discover.legal',
  'https://www.discover.legal',  // Still needed during transition
);
```

This is fine to keep temporarily. Once the redirect is in place and Google has updated, you can optionally remove the www domain from CORS, but it won't hurt to keep it.

## Timeline

- **Immediate:** Set up redirect (takes minutes)
- **1-3 days:** Google recrawls and discovers the redirect
- **1-2 weeks:** Search Console issues resolve
- **2-4 weeks:** Full consolidation in search results

## Additional Resources

- [Render Custom Domains Documentation](https://render.com/docs/custom-domains)
- [Google's URL Canonicalization Guide](https://developers.google.com/search/docs/crawling-indexing/canonicalization)
- [301 Redirect Best Practices](https://developers.google.com/search/docs/crawling-indexing/301-redirects)

## Questions?

If you encounter issues or need help with Render-specific configuration, contact Render support at:
- https://render.com/support
- Their community forum: https://community.render.com/
