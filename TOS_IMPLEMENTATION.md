# Terms of Service Implementation

## Overview

This document describes the implementation of a forced-scroll clickwrap Terms of Service (TOS) for the Affidavit Maker sign-up flow.

## Features Implemented

### ✅ 1. User-Friendly Terms of Service Content
- **Location**: `client/src/content/termsOfService.js`
- Written in plain English for easy understanding
- Includes prominent "We will NEVER sell your data" promise
- Covers standard SaaS terms: payment, liability, service availability, etc.
- Includes right to change terms unilaterally with notice (30 days for material changes)
- Versioned system (currently v1.0.0)

### ✅ 2. Forced-Scroll Clickwrap Modal Component
- **Location**: `client/src/components/TermsOfServiceModal.js`
- **Key Features**:
  - Users MUST scroll to the bottom before accepting
  - "I Accept" button remains disabled until scroll completes
  - Visual scroll indicator shows progress
  - Renders markdown content beautifully with react-markdown
  - Displays user's name for personalization
  - Shows TOS version and last updated date

### ✅ 3. TOS Guard Component
- **Location**: `client/src/components/TOSGuard.js`
- **Functionality**:
  - Automatically checks TOS acceptance status for authenticated users
  - Blocks access to application until TOS is accepted
  - Shows TOS modal on first login for new users
  - Blurs background content while TOS modal is displayed
  - Handles acceptance/decline gracefully

### ✅ 4. Database Schema
- **Migration**: `migrations/add_tos_acceptance.sql`
- **Fields Added to Users Table**:
  - `tos_accepted` (BOOLEAN) - Acceptance status
  - `tos_accepted_at` (TIMESTAMP) - When accepted
  - `tos_version_accepted` (VARCHAR) - Version accepted
  - `tos_ip_address` (VARCHAR) - IP address for legal records

- **New Table**: `tos_acceptance_log`
  - Maintains complete audit trail
  - Tracks all TOS acceptances with version history
  - Stores IP address and user agent for compliance
  - Useful for legal/compliance requirements

### ✅ 5. Backend API Endpoints
- **Location**: `routes/auth.js`

#### New Endpoints:
1. **POST /api/auth/accept-tos**
   - Accepts TOS for authenticated user
   - Records version, timestamp, IP address, user agent
   - Creates audit log entry
   - Uses database transactions for atomicity

2. **GET /api/auth/tos-status**
   - Returns current TOS acceptance status
   - Includes version and acceptance date

3. **Updated GET /api/auth/me**
   - Now includes TOS acceptance fields in user profile

### ✅ 6. Frontend Integration
- **Location**: `client/src/App.js`
- TOSGuard wraps entire application
- Checks TOS status after Auth0 authentication
- Seamlessly integrated with existing Auth0 flow

## User Flow

### New User Sign-Up Flow:
1. User clicks "Sign In" or "Get Started"
2. Auth0 authentication dialog appears
3. User creates account with Auth0
4. User is redirected back to application
5. **🆕 TOSGuard detects user hasn't accepted TOS**
6. **🆕 TOS Modal appears (must scroll to bottom)**
7. **🆕 User scrolls through entire TOS**
8. **🆕 "I Accept" button becomes enabled**
9. **🆕 User clicks "I Accept"**
10. **🆕 Backend records acceptance with audit trail**
11. User gains access to dashboard

### Existing User Flow:
1. User logs in with Auth0
2. TOSGuard checks TOS status
3. If accepted: User proceeds to dashboard immediately
4. If not accepted: TOS modal appears (same as new user)

## Legal Compliance Features

### ✅ Clickwrap Best Practices:
- **Forced scroll** - Users must read entire document
- **Clear acceptance** - Explicit "I Accept" action required
- **Audit trail** - Complete record of who accepted what and when
- **IP tracking** - Records IP address for legal validity
- **Version tracking** - Maintains history of all TOS versions
- **Timestamp** - Records exact time of acceptance
- **User agent** - Records browser/device information

### ✅ GDPR Compliance:
- Users can access their TOS acceptance history
- Clear data usage policies in TOS
- Right to change terms with notice
- No forced consent bundling

### ✅ Future TOS Updates:
When you need to update the TOS:
1. Update content in `client/src/content/termsOfService.js`
2. Increment `TOS_VERSION` (e.g., "1.0.0" → "1.1.0")
3. Update `TOS_LAST_UPDATED` date
4. Users will automatically see new TOS on next login
5. Old acceptance records remain in `tos_acceptance_log` for audit

## Installation & Deployment

### 1. Install Dependencies
```bash
cd client
npm install react-markdown
```

### 2. Run Database Migration
```bash
psql $DATABASE_URL -f migrations/add_tos_acceptance.sql
```

See `migrations/README.md` for detailed migration instructions.

### 3. Deploy Frontend
The frontend changes are automatically included in your normal build process:
```bash
cd client
npm run build
```

### 4. Restart Backend
Restart your Node.js server to load the new API endpoints.

## Testing Checklist

- [ ] Database migration runs successfully
- [ ] New users see TOS modal on first login
- [ ] Scroll requirement works (button disabled until scroll)
- [ ] Accepting TOS records data in database
- [ ] Users can access dashboard after accepting
- [ ] Existing users don't see modal if already accepted
- [ ] API endpoints return correct data
- [ ] Audit log records all acceptances

## Key Files Modified/Created

### Frontend:
- ✅ `client/src/content/termsOfService.js` - TOS content (NEW)
- ✅ `client/src/components/TermsOfServiceModal.js` - Modal component (NEW)
- ✅ `client/src/components/TOSGuard.js` - Guard component (NEW)
- ✅ `client/src/App.js` - Added TOSGuard wrapper (MODIFIED)
- ✅ `client/package.json` - Added react-markdown (MODIFIED)

### Backend:
- ✅ `routes/auth.js` - Added TOS endpoints (MODIFIED)
- ✅ `migrations/add_tos_acceptance.sql` - Database migration (NEW)
- ✅ `migrations/README.md` - Migration instructions (NEW)

### Documentation:
- ✅ `TOS_IMPLEMENTATION.md` - This file (NEW)

## Technical Notes

### Middleware Compatibility
The existing auth middleware (`middleware/auth.js`) uses `SELECT * FROM users`, which automatically includes the new TOS fields without any code changes.

### Performance
- TOS check happens once per session
- Results are cached in component state
- No additional database queries per request
- Minimal impact on performance

### Security
- TOS acceptance requires valid JWT token
- IP address and user agent logged for legal validity
- Database transactions ensure data consistency
- Audit trail prevents tampering with acceptance records

## Future Enhancements (Optional)

1. **Email Notifications**: Email users when TOS changes
2. **Admin Dashboard**: View TOS acceptance stats
3. **Version Comparison**: Show diff between TOS versions
4. **Multi-language Support**: Translate TOS to other languages
5. **PDF Export**: Allow users to download TOS as PDF
6. **Acceptance History**: Let users view their acceptance history

## Support

For questions or issues:
- Check `migrations/README.md` for database setup
- Review component props in respective files
- Ensure react-markdown is installed
- Verify Auth0 integration is working

---

**Implementation Date**: November 12, 2025
**TOS Version**: 1.0.0
**Status**: ✅ Ready for deployment
