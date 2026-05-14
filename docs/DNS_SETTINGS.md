# DNS Settings — `discover.legal` (Single SPA on Render)

**Last Updated**: 2026-05-04
**Scope**: Consolidate every hostname onto the one `affidavit-maker` Render service. Webflow is retired; the SPA serves marketing and app routes.

---

## Domain Layout

All hostnames point to the **same** Render service (`affidavit-maker`). The SPA's React Router handles route splitting (marketing routes vs. app routes).

| Hostname                   | Resolves To                | Notes                                |
| -------------------------- | -------------------------- | ------------------------------------ |
| `discover.legal` (apex)    | `affidavit-maker` (Render) | Primary canonical host               |
| `www.discover.legal`       | `affidavit-maker` (Render) | 301 → apex (Render redirect setting) |
| `ca.discover.legal`        | `affidavit-maker` (Render) | Canada locale                        |
| `canada.discover.legal`    | `affidavit-maker` (Render) | Canada locale alias                  |

Add every hostname under **Render → affidavit-maker → Settings → Custom Domain**. Render auto-issues Let's Encrypt TLS once DNS verifies.

---

## Records to Set at the Registrar

Replace `affidavit-maker.onrender.com` / the apex IP with the exact values Render shows in the Custom Domain panel — these are the source of truth.

### 1. Apex — `discover.legal`

CNAME isn't allowed at the apex. Pick the option your registrar supports:

**A) ALIAS / ANAME (preferred)** — Cloudflare CNAME flattening, DNSimple ALIAS, Route 53 alias, NS1 ALIAS, etc.:

```
Type            Name   Value                            TTL
ALIAS / ANAME   @      affidavit-maker.onrender.com.    300
```

**B) A record fallback** — registrar only supports A at apex:

```
Type    Name   Value           TTL
A       @      216.24.57.1     300
```

> `216.24.57.1` is Render's documented apex IP. Confirm the value in the Custom Domain panel before applying — Render may show a different target.

### 2. Subdomains

```
Type    Name      Value                              TTL
CNAME   www       affidavit-maker.onrender.com.      300
CNAME   ca        affidavit-maker.onrender.com.      300
CNAME   canada    affidavit-maker.onrender.com.      300
```

In Render, configure `www.discover.legal` as a **Redirect** to `discover.legal` so the apex stays canonical (Render handles the 301).

### 3. Email / TXT / MX

Do not change. Keep MX, SPF (`TXT @`), DKIM (`TXT *._domainkey…`), and DMARC (`TXT _dmarc`) as-is.

---

## Cutover Order (Webflow → Render)

1. **Lower TTL** on existing apex/`www` records to 300 a few hours before the cutover.
2. **Add the custom domains in Render** (`discover.legal`, `www.discover.legal`, plus `make`, `ca`, `canada` if not already there). Render shows verification status + the exact target values.
3. **Flip DNS** to the values above. Render verifies + issues TLS within minutes.
4. **Remove the domain from Webflow** (Project Settings → Publishing) so Webflow stops serving the host.
5. **Cancel the Webflow hosting plan** once apex + `www` are served by Render for ≥ 24 hours.

---

## After DNS Updates

1. **`FRONTEND_URL`** — already set to `https://discover.legal` in `render.yaml`. The Render env var should match.

2. **Auth0 → Application Settings** — every hostname that hits the app must be present:
   - Allowed Callback URLs: `https://discover.legal`, `https://www.discover.legal`, `https://ca.discover.legal`, `https://canada.discover.legal`
   - Allowed Logout URLs:   `https://discover.legal`, `https://www.discover.legal`, `https://ca.discover.legal`, `https://canada.discover.legal`
   - Allowed Web Origins:   `https://discover.legal`, `https://www.discover.legal`, `https://ca.discover.legal`, `https://canada.discover.legal`

   Note: the SPA's `redirect_uri` is `window.location.origin` (no `/callback` path), so Auth0 redirects back to `/`. The `RootRoute` component detects `?code=&state=` query params and defers to the loading handler.

3. **Stripe webhooks**: endpoint URL is unchanged at the application level (path is the same; host migrates with the canonical).

4. **CORS / CSRF / CSP** — already include `discover.legal`, `www.discover.legal`, `ca.discover.legal`, `canada.discover.legal`. No change needed.

5. **CLAUDE.md** — already updated to reflect Render-only hosting.

---

## Verification

```bash
# Apex on Render (not Webflow)
dig +short discover.legal
curl -I https://discover.legal/
# Expect: served by Render, valid TLS, 200 on landing route

# www → apex
curl -I https://www.discover.legal/
# Expect: 301 → https://discover.legal/

# SPA hostnames all healthy
curl -I https://discover.legal/api/health
curl -I https://ca.discover.legal/api/health
curl -I https://canada.discover.legal/api/health
# Expect: HTTP/2 200
```

---

## Rollback

Keep a copy of the pre-change zone file. With TTL at 300, reverting any record propagates back to the previous host (Webflow) within minutes.
