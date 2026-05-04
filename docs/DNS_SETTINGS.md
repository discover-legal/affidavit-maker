# DNS Settings — `make.discover.legal` SPA

**Last Updated**: 2026-05-04
**Scope**: DNS records for the app SPA at `make.discover.legal` (Render.com)

---

## Domain Layout

| Hostname                   | Hosted On     | Purpose                          |
| -------------------------- | ------------- | -------------------------------- |
| `discover.legal`           | Webflow       | Marketing / landing site (apex)  |
| `www.discover.legal`       | Webflow       | Marketing (redirects to apex)    |
| `make.discover.legal`      | Render.com    | **SPA — this app**               |
| `ca.discover.legal`        | Render.com    | Canada locale (CORS-allowed)     |
| `canada.discover.legal`    | Render.com    | Canada locale alias              |

The apex (`discover.legal`) and `www` are **NOT** to be added to Render's custom-domains list — they belong to Webflow.

---

## Records to Set at the DNS Registrar

Replace `affidavit-maker.onrender.com` with the actual Render service hostname shown in **Render Dashboard → Service → Settings → Custom Domain**.

### 1. SPA (Render)

```
Type    Name      Value                              TTL
CNAME   make      affidavit-maker.onrender.com.      300
CNAME   ca        affidavit-maker.onrender.com.      300
CNAME   canada    affidavit-maker.onrender.com.      300
```

If the registrar requires a flattened/ALIAS for a CNAME at a subdomain (rare), use the IP shown in Render's verification panel.

### 2. Marketing (Webflow) — leave as-is

```
Type    Name      Value                              TTL
A       @         75.2.60.5                          3600
A       @         99.83.190.102                      3600
CNAME   www       proxy-ssl.webflow.com.             3600
```

> Verify the current Webflow values in **Webflow → Project Settings → Publishing → Custom Domain** before changing — Webflow occasionally rotates targets.

### 3. Email / TXT / MX

Do not modify. Keep existing MX, SPF (`TXT @`), DKIM (`TXT default._domainkey…`), and DMARC (`TXT _dmarc`) records untouched.

---

## After Updating DNS

1. **Render Dashboard → affidavit-maker → Settings → Custom Domain**
   - Add `make.discover.legal` (and `ca.discover.legal`, `canada.discover.legal` if used).
   - Wait for "Verified" + "Certificate Issued" (TLS via Let's Encrypt is automatic).

2. **Auth0 → Application Settings** (must include `make.discover.legal`):
   - Allowed Callback URLs: `https://make.discover.legal/callback`
   - Allowed Logout URLs:   `https://make.discover.legal`
   - Allowed Web Origins:   `https://make.discover.legal`

3. **Stripe → Webhooks**
   - Endpoint: `https://make.discover.legal/api/payment/webhook`
   - Copy the new signing secret into Render env var `STRIPE_WEBHOOK_SECRET`.

4. **CORS / CSRF / CSP** — already include `make.discover.legal`, `ca.discover.legal`, `canada.discover.legal`. If a new subdomain is introduced, update all three:
   - `server.js` → `getAllowedOrigins()`
   - `middleware/csrfProtection.js`
   - `middleware/validation.js` → `connectSrc`

---

## Verification

```bash
# DNS resolves to Render
dig +short make.discover.legal
dig +short ca.discover.legal

# TLS + health
curl -I https://make.discover.legal/health
# Expect: HTTP/2 200

# Apex still on Webflow
dig +short discover.legal
curl -I https://discover.legal/
# Expect: served by Webflow (no Render headers)

# www redirects to apex (Webflow setting)
curl -I https://www.discover.legal/
# Expect: 301 → https://discover.legal/
```

---

## Rollback

If `make.discover.legal` traffic needs to be cut over to a different host, change only the `make` CNAME — apex and `www` records stay on Webflow and are unaffected.
