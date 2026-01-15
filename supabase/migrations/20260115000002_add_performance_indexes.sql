-- Migration: Add Performance Indexes for Query Optimization
-- Created: 2026-01-15
-- Purpose: Add composite and single-column indexes to improve query performance
--          for common access patterns across letters, subscriptions, and commissions tables

-- ============================================================================
-- LETTERS TABLE INDEXES
-- ============================================================================

-- Composite index for user's letters filtered by status (most common query pattern)
-- Used by: Dashboard letter list, admin portal filtering, status-based queries
CREATE INDEX IF NOT EXISTS idx_letters_user_status
ON letters(user_id, status);

-- Composite index for user's letters ordered by creation date
-- Used by: Dashboard "recent letters" view, chronological listings
CREATE INDEX IF NOT EXISTS idx_letters_user_created
ON letters(user_id, created_at DESC);

-- Composite index for workflow status queries
-- Used by: Workflow monitoring, status-based filtering
CREATE INDEX IF NOT EXISTS idx_letters_workflow_status
ON letters(workflow_id, workflow_status)
WHERE workflow_id IS NOT NULL;

-- Index for attorney review queue (pending_review and under_review letters)
-- Used by: Attorney portal letter queue
CREATE INDEX IF NOT EXISTS idx_letters_review_queue
ON letters(status, created_at DESC)
WHERE status IN ('pending_review', 'under_review');

-- ============================================================================
-- SUBSCRIPTIONS TABLE INDEXES
-- ============================================================================

-- Index for Stripe customer lookups (webhook processing)
-- Used by: Stripe webhook handlers, payment verification
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer
ON subscriptions(stripe_customer_id)
WHERE stripe_customer_id IS NOT NULL;

-- Composite index for user's active subscription lookup
-- Used by: Subscription status checks, allowance verification
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_status
ON subscriptions(user_id, status);

-- Index for subscription expiry monitoring
-- Used by: Cron jobs for subscription renewal checks
CREATE INDEX IF NOT EXISTS idx_subscriptions_current_period_end
ON subscriptions(current_period_end)
WHERE status = 'active';

-- ============================================================================
-- COMMISSIONS TABLE INDEXES
-- ============================================================================

-- Composite index for employee commission tracking
-- Used by: Employee portal payout calculations, commission reports
CREATE INDEX IF NOT EXISTS idx_commissions_employee_status
ON commissions(employee_id, status);

-- Index for pending payout processing
-- Used by: Admin payout approval queue
CREATE INDEX IF NOT EXISTS idx_commissions_pending_payouts
ON commissions(status, created_at)
WHERE status = 'pending';

-- ============================================================================
-- COUPON_USAGE TABLE INDEXES
-- ============================================================================

-- Index for coupon usage analytics
-- Used by: Admin analytics, coupon performance tracking
CREATE INDEX IF NOT EXISTS idx_coupon_usage_code
ON coupon_usage(coupon_code, used_at DESC);

-- Composite index for employee referral tracking
-- Used by: Employee commission calculations, referral stats
CREATE INDEX IF NOT EXISTS idx_coupon_usage_employee
ON coupon_usage(employee_id, used_at DESC)
WHERE employee_id IS NOT NULL;

-- ============================================================================
-- AUDIT_TRAIL TABLE INDEXES
-- ============================================================================

-- Composite index for letter audit history
-- Used by: Letter audit trail queries, compliance reporting
CREATE INDEX IF NOT EXISTS idx_audit_trail_letter
ON audit_trail(letter_id, created_at DESC)
WHERE letter_id IS NOT NULL;

-- Index for admin action auditing
-- Used by: Admin activity monitoring, security audits
CREATE INDEX IF NOT EXISTS idx_audit_trail_actor
ON audit_trail(actor_id, action, created_at DESC);

-- ============================================================================
-- EMAIL_QUEUE TABLE INDEXES
-- ============================================================================

-- Composite index for email processing queue
-- Used by: Email queue processor cron job
CREATE INDEX IF NOT EXISTS idx_email_queue_processing
ON email_queue(status, next_retry_at)
WHERE status IN ('pending', 'retrying');

-- Index for email delivery monitoring
-- Used by: Admin email queue dashboard, failure tracking
CREATE INDEX IF NOT EXISTS idx_email_queue_status_created
ON email_queue(status, created_at DESC);

-- ============================================================================
-- PROFILES TABLE INDEXES
-- ============================================================================

-- Index for role-based queries
-- Used by: Admin user management, role filtering
CREATE INDEX IF NOT EXISTS idx_profiles_role
ON profiles(role);

-- Index for stripe customer association
-- Used by: Payment processing, customer lookups
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer
ON profiles(stripe_customer_id)
WHERE stripe_customer_id IS NOT NULL;

-- ============================================================================
-- ANALYTICS VIEWS SUPPORT
-- ============================================================================

-- Index for daily analytics aggregation
-- Used by: Admin analytics dashboard, reporting
CREATE INDEX IF NOT EXISTS idx_letters_created_date
ON letters(DATE(created_at));

-- Index for subscription revenue analytics
-- Used by: Revenue reports, financial analytics
CREATE INDEX IF NOT EXISTS idx_subscriptions_created_plan
ON subscriptions(created_at, plan_id);

-- ============================================================================
-- COMMENTS
-- ============================================================================

COMMENT ON INDEX idx_letters_user_status IS
'Composite index for user letter queries filtered by status - primary dashboard query pattern';

COMMENT ON INDEX idx_subscriptions_stripe_customer IS
'Critical index for Stripe webhook processing - prevents table scans on payment events';

COMMENT ON INDEX idx_commissions_employee_status IS
'Employee commission tracking and payout calculation optimization';

COMMENT ON INDEX idx_email_queue_processing IS
'Email queue processing optimization - used by cron job for pending/retry emails';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Query to verify indexes were created
DO $$
DECLARE
    index_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO index_count
    FROM pg_indexes
    WHERE indexname LIKE 'idx_%'
    AND schemaname = 'public';

    RAISE NOTICE 'Total custom indexes in public schema: %', index_count;
END $$;
