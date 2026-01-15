# Migration Deployment Instructions

## New Migration: Performance Indexes

**File**: `supabase/migrations/20260115000002_add_performance_indexes.sql`

This migration adds critical performance indexes for:
- Letters table (user_id + status, user_id + created_at, workflow queries, review queue)
- Subscriptions table (stripe_customer_id, user_id + status)
- Commissions table (employee_id + status)
- Coupon usage, audit trail, email queue, profiles

## Option 1: Deploy via Supabase Dashboard (Recommended for immediate deployment)

1. Go to your Supabase project dashboard
2. Navigate to: **SQL Editor** → **New query**
3. Copy the contents of `supabase/migrations/20260115000002_add_performance_indexes.sql`
4. Paste and click **Run**
5. Verify success by checking the output message

**Dashboard URL**: https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql

## Option 2: Deploy via Supabase CLI

### Prerequisites

```bash
# Install dependencies if not already done
pnpm install

# Set your access token
export SUPABASE_ACCESS_TOKEN="sbp_e71eaab3228888c5b3d82468e5950d7fa837fc35"
```

### Deploy Steps

```bash
# Initialize Supabase (if not already done)
npx supabase init

# Link to your project
npx supabase link --project-ref YOUR_PROJECT_REF

# Push all pending migrations
npx supabase db push

# Or apply specific migration
npx supabase migration up
```

## Option 3: Automatic Deployment (CI/CD)

If you have CI/CD set up, the migration will be automatically applied on next deployment.

## Verification

After deploying, verify the indexes were created:

```sql
-- Run this query in Supabase SQL Editor
SELECT
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE indexname LIKE 'idx_%'
AND schemaname = 'public'
ORDER BY tablename, indexname;
```

Expected indexes:
- `idx_letters_user_status`
- `idx_letters_user_created`
- `idx_letters_workflow_status`
- `idx_letters_review_queue`
- `idx_subscriptions_stripe_customer`
- `idx_subscriptions_user_status`
- `idx_commissions_employee_status`
- And 15+ more...

## Performance Impact

Expected improvements:
- **Dashboard letter list**: 5-10x faster (table scan → index scan)
- **Stripe webhooks**: 10-20x faster (no more customer_id table scans)
- **Admin review queue**: 3-5x faster (filtered index on review states)
- **Employee commissions**: 5-10x faster (composite index on employee + status)

## Rollback

If needed, you can rollback by running:

```sql
-- Drop all indexes created in this migration
DROP INDEX IF EXISTS idx_letters_user_status;
DROP INDEX IF EXISTS idx_letters_user_created;
DROP INDEX IF EXISTS idx_letters_workflow_status;
DROP INDEX IF EXISTS idx_letters_review_queue;
DROP INDEX IF EXISTS idx_subscriptions_stripe_customer;
DROP INDEX IF EXISTS idx_subscriptions_user_status;
DROP INDEX IF EXISTS idx_subscriptions_current_period_end;
DROP INDEX IF EXISTS idx_commissions_employee_status;
DROP INDEX IF EXISTS idx_commissions_pending_payouts;
DROP INDEX IF EXISTS idx_coupon_usage_code;
DROP INDEX IF EXISTS idx_coupon_usage_employee;
DROP INDEX IF EXISTS idx_audit_trail_letter;
DROP INDEX IF EXISTS idx_audit_trail_actor;
DROP INDEX IF EXISTS idx_email_queue_processing;
DROP INDEX IF EXISTS idx_email_queue_status_created;
DROP INDEX IF EXISTS idx_profiles_role;
DROP INDEX IF EXISTS idx_profiles_stripe_customer;
DROP INDEX IF EXISTS idx_letters_created_date;
DROP INDEX IF EXISTS idx_subscriptions_created_plan;
```
