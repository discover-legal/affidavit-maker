# Billing Data Migration to Stripe

## Overview
This migration defers billing address storage to Stripe, keeping only the postal/ZIP code locally for tax compliance and analytics. This reduces PII exposure while maintaining business intelligence capabilities.

## Changes Made

### 1. Database Schema Updates

#### Migration File
- **File**: `migrations/002_defer_billing_to_stripe.sql`
- **Actions**:
  - ❌ Removed `payments.billing_address` (JSONB) - full address now stored in Stripe
  - ✅ Added `payments.billing_postal_code` (VARCHAR) - for tax compliance and analytics
  - ✅ Added `users.stripe_customer_id` (VARCHAR) - created on first payment
  - ✅ Added indexes for performance

#### Updated Schema Files
- `database_schema_complete.sql`
- `database-schema.sql`

**To Apply Migration**:
```bash
psql -d your_database -f migrations/002_defer_billing_to_stripe.sql
```

---

### 2. Backend Payment Routes

#### File: `routes/payment.js` (Active Route)

**Customer Creation** (Lines 76-106):
- Creates Stripe Customer on first payment
- Stores `stripe_customer_id` in users table
- Enables recurring billing, customer portal, and payment method reuse

**Webhook Handler** (Lines 328-377):
- Updated `payment_intent.succeeded` handler
- Extracts only postal code from Stripe billing_details
- Stores minimal payment method info (last 4, brand, expiration)
- Links payment to Stripe customer

**What's Stored**:
```javascript
{
  billing_postal_code: "12345",
  payment_method_details: {
    type: "card",
    card: {
      brand: "visa",
      last4: "4242",
      exp_month: 12,
      exp_year: 2025
    }
  },
  stripe_customer_id: "cus_..."
}
```

**What's NOT Stored** (deferred to Stripe):
- Full street address
- City
- State/Province
- Country
- Full card number
- CVV
- Billing contact name

#### File: `routes/payments.js` (Inactive/Backup)
- Updated for consistency with same changes

---

### 3. Frontend Payment Integration

#### File: `client/src/components/PaymentModal.js`

**Major Upgrade**:
- ✅ Integrated Stripe Payment Element
- ✅ Automatic address collection (handled by Stripe)
- ✅ Payment method validation
- ✅ Error handling and loading states
- ✅ Responsive design

**New Dependencies** (`client/package.json`):
```json
{
  "@stripe/react-stripe-js": "^2.4.0",
  "@stripe/stripe-js": "^2.4.0"
}
```

**Environment Variable** (`.env`):
```bash
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_...
```

**Features**:
- Stripe-hosted payment form (PCI compliant)
- Automatic address validation
- Support for multiple payment methods
- Mobile-responsive
- Real-time error feedback

---

## Deployment Steps

### 1. Install Dependencies
```bash
# Backend (if any new packages were added)
npm install

# Frontend
cd client
npm install
```

### 2. Run Database Migration
```bash
psql -d affidavit_db -f migrations/002_defer_billing_to_stripe.sql
```

### 3. Environment Variables
Ensure these are set:

**Backend** (`.env`):
```bash
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

**Frontend** (`client/.env`):
```bash
REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_live_...
```

### 4. Verify Stripe Webhook
Ensure webhook endpoint is configured in Stripe Dashboard:
- URL: `https://your-domain.com/api/payment/webhook`
- Events to listen for:
  - `payment_intent.succeeded`
  - `payment_intent.payment_failed`
  - `payment_intent.canceled`

### 5. Test Payment Flow
1. Create a payment intent
2. Complete payment with test card: `4242 4242 4242 4242`
3. Verify postal code is captured in database
4. Check Stripe Dashboard for full address

---

## Benefits

### Security & Compliance
- ✅ Reduced PII exposure (no full addresses in your database)
- ✅ Stripe handles PCI compliance for payment data
- ✅ Stripe manages address validation
- ✅ Easier GDPR/privacy compliance

### Business Intelligence
- ✅ Postal codes retained for geographic analytics
- ✅ Payment method details for reporting
- ✅ Stripe Customer IDs for advanced analytics via Stripe API

### Developer Experience
- ✅ Less data to manage and secure
- ✅ Stripe handles address edge cases
- ✅ Easier recurring billing setup
- ✅ Customer portal access (future feature)

### Customer Experience
- ✅ Professional payment UI
- ✅ Automatic address validation
- ✅ Support for multiple payment methods
- ✅ Save payment methods for future use

---

## Backward Compatibility

### Existing Payments
- Old payments with `billing_address` data will be preserved (column dropped with `IF EXISTS`)
- Historical data can be migrated if needed before dropping column
- No impact on existing payment records

### Existing Customers
- Users without `stripe_customer_id` will have one created on next payment
- No action needed from existing users

---

## Retrieving Full Address (If Needed)

If you need the full billing address for a payment (e.g., for disputes, refunds):

```javascript
// Retrieve payment intent from Stripe
const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
  expand: ['charges.data.billing_details']
});

const billingAddress = paymentIntent.charges.data[0].billing_details.address;
// Returns: { line1, line2, city, state, postal_code, country }
```

Or retrieve from Stripe Customer:

```javascript
const customer = await stripe.customers.retrieve(customerId);
const address = customer.address;
```

---

## Rollback Plan

If you need to rollback this migration:

```sql
BEGIN;

-- Add back billing_address column
ALTER TABLE payments ADD COLUMN billing_address JSONB;

-- Remove new columns
ALTER TABLE payments DROP COLUMN billing_postal_code;
ALTER TABLE users DROP COLUMN stripe_customer_id;

-- Remove indexes
DROP INDEX IF EXISTS idx_payments_postal_code;
DROP INDEX IF EXISTS idx_users_stripe_customer;

COMMIT;
```

---

## Analytics Queries

### Geographic Distribution by Postal Code
```sql
SELECT
  billing_postal_code,
  COUNT(*) as payment_count,
  SUM(amount_cents) / 100.0 as total_revenue
FROM payments
WHERE status = 'succeeded'
  AND billing_postal_code IS NOT NULL
GROUP BY billing_postal_code
ORDER BY total_revenue DESC
LIMIT 20;
```

### Payment Method Distribution
```sql
SELECT
  payment_method_details->>'type' as payment_type,
  payment_method_details->'card'->>'brand' as card_brand,
  COUNT(*) as count
FROM payments
WHERE status = 'succeeded'
GROUP BY payment_type, card_brand;
```

---

## Questions?

For issues or questions about this migration:
1. Check Stripe Dashboard for payment details
2. Review webhook logs for integration issues
3. Check browser console for frontend errors
4. Verify environment variables are set correctly
