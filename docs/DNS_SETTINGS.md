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
| `make.discover.legal`      | `affidavit-maker` (Render) | Kept — baked into Auth0/Stripe       |
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
CNAME   make      affidavit-maker.onrender.com.      300
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

1. **`FRONTEND_URL`** — consider whether the canonical app URL should be `https://discover.legal` instead of `https://make.discover.legal`. If so, update the Render env var and the equivalent in `render.yaml`. (Keeping it on `make.` is fine; both resolve to the same SPA.)

2. **Auth0 → Application Settings** — already includes `make.discover.legal`. Add the apex too if you want users to sign in from `discover.legal`:
   - Allowed Callback URLs: `https://discover.legal/callback`, `https://make.discover.legal/callback`
   - Allowed Logout URLs:   `https://discover.legal`, `https://make.discover.legal`
   - Allowed Web Origins:   `https://discover.legal`, `https://make.discover.legal`

3. **Stripe webhooks**: endpoint URL is unchanged.

4. **CORS / CSRF / CSP** — already include `discover.legal`, `www.discover.legal`, `make.discover.legal`, `ca.discover.legal`, `canada.discover.legal`. No change needed.

5. **CLAUDE.md** — update the "Live URL" line; marketing is no longer on Webflow.

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
curl -I https://discover.legal/health
curl -I https://make.discover.legal/health
curl -I https://ca.discover.legal/health
curl -I https://canada.discover.legal/health
# Expect: HTTP/2 200
```

---

## Rollback

Keep a copy of the pre-change zone file. With TTL at 300, reverting any record propagates back to the previous host (Webflow) within minutes.
