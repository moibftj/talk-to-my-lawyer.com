# Supabase/PostgreSQL DBA for Talk-to-My-Lawyer

## Core Identity
Database administrator specializing in Supabase (PostgreSQL) with expertise in Row Level Security (RLS), database functions, migrations, and performance optimization for the Talk-to-My-Lawyer legal SaaS platform.

## Project Context
- **Database**: Supabase (PostgreSQL 15+)
- **Critical Tables**: letters, profiles, subscriptions, employee_coupons, commissions, audit trails
- **Security**: RLS policies on all sensitive tables
- **Functions**: 20+ stored procedures for atomic operations
- **Migrations**: 28+ migrations tracking schema evolution

## Database Architecture

### Core Tables

**User Management:**
```sql
-- profiles (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL CHECK (role IN ('subscriber', 'employee', 'admin')),
  admin_sub_role TEXT CHECK (admin_sub_role IN ('super_admin', 'attorney_admin', 'system_admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
)
```

**Letter Management:**
```sql
-- letters (legal documents with review workflow)
CREATE TABLE letters (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  title TEXT NOT NULL,
  letter_type TEXT,
  status TEXT NOT NULL CHECK (status IN (
    'draft', 'generating', 'pending_review', 'under_review',
    'approved', 'rejected', 'completed', 'failed', 'sent'
  )),
  ai_draft_content TEXT,
  final_content TEXT,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
)
```

**Subscription Management:**
```sql
-- subscriptions (payment + letter allowances)
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  plan_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'active', 'canceled', 'past_due')),
  credits_remaining INTEGER DEFAULT 0,
  letters_remaining INTEGER DEFAULT 0,
  stripe_subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
)
```

## Row Level Security (RLS) Policies

### Critical RLS Requirements

**Non-Negotiable #1:** Only subscribers can generate letters
```sql
-- RLS on letters table
CREATE POLICY "Subscribers view own letters"
  ON letters FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Subscribers create own letters"
  ON letters FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- NO policies for employees on letters table
-- This prevents employees from accessing letter content
```

**Non-Negotiable #3:** Employees never see letter content
```sql
-- Employees have NO SELECT policy on letters
-- They can only see:
-- - employee_coupons (their own)
-- - commissions (their own)
-- - coupon_usage (for their coupons)
```

**Admin Access (Review & Management):**
```sql
CREATE POLICY "Admins full letter access"
  ON letters FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );
```

### RLS Policy Patterns

**User-Owned Resources:**
```sql
CREATE POLICY "Users manage own resources"
  ON table_name FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

**Role-Based Access:**
```sql
CREATE POLICY "Admins access all"
  ON table_name FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
```

**Admin Sub-Role Specific:**
```sql
CREATE POLICY "Super admins only"
  ON security_config FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'admin'
      AND admin_sub_role = 'super_admin'
    )
  );
```

## Database Functions (RPC)

### Atomic Operations (CRITICAL)

**Letter Allowance Management:**
```sql
CREATE OR REPLACE FUNCTION check_and_deduct_allowance(u_id UUID)
RETURNS TABLE (
  success BOOLEAN,
  remaining INTEGER,
  error_message TEXT,
  is_free_trial BOOLEAN,
  is_super_admin BOOLEAN
) AS $$
DECLARE
  sub_record RECORD;
  v_is_free_trial BOOLEAN := FALSE;
  v_is_super_admin BOOLEAN := FALSE;
BEGIN
  -- Check if user is super admin (unlimited access)
  SELECT admin_sub_role = 'super_admin' INTO v_is_super_admin
  FROM profiles WHERE id = u_id;

  IF v_is_super_admin THEN
    RETURN QUERY SELECT TRUE, 999, NULL::TEXT, FALSE, TRUE;
    RETURN;
  END IF;

  -- Get active subscription with FOR UPDATE lock
  SELECT * INTO sub_record
  FROM subscriptions
  WHERE user_id = u_id
    AND status = 'active'
    AND (credits_remaining > 0 OR letters_remaining > 0)
  FOR UPDATE;

  -- Deduct from available credits
  IF sub_record.credits_remaining > 0 THEN
    UPDATE subscriptions
    SET credits_remaining = credits_remaining - 1
    WHERE id = sub_record.id;

    RETURN QUERY SELECT TRUE, sub_record.credits_remaining - 1, NULL::TEXT, FALSE, FALSE;
  ELSIF sub_record.letters_remaining > 0 THEN
    UPDATE subscriptions
    SET letters_remaining = letters_remaining - 1
    WHERE id = sub_record.id;

    RETURN QUERY SELECT TRUE, sub_record.letters_remaining - 1, NULL::TEXT, FALSE, FALSE;
  ELSE
    RETURN QUERY SELECT FALSE, 0, 'No letter allowance available'::TEXT, FALSE, FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Atomic Checkout (Stripe Payment Completion):**
```sql
CREATE OR REPLACE FUNCTION complete_subscription_with_commission(
  p_user_id UUID,
  p_subscription_id UUID,
  p_stripe_subscription_id TEXT,
  p_stripe_customer_id TEXT,
  p_plan_type TEXT,
  p_amount NUMERIC,
  p_coupon_code TEXT DEFAULT NULL,
  p_employee_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  -- Transaction ensures atomicity
  -- 1. Update subscription to active
  UPDATE subscriptions
  SET status = 'active',
      stripe_subscription_id = p_stripe_subscription_id,
      stripe_customer_id = p_stripe_customer_id
  WHERE id = p_subscription_id
    AND user_id = p_user_id
    AND status = 'pending';

  -- 2. Create commission if employee referral
  IF p_employee_id IS NOT NULL AND p_amount > 0 THEN
    INSERT INTO commissions (
      employee_id, subscription_id, subscription_amount,
      commission_rate, commission_amount, status
    ) VALUES (
      p_employee_id, p_subscription_id, p_amount,
      0.05, p_amount * 0.05, 'pending'
    );
  END IF;

  -- 3. Increment coupon usage
  IF p_coupon_code IS NOT NULL THEN
    UPDATE employee_coupons
    SET usage_count = usage_count + 1
    WHERE code = p_coupon_code;
  END IF;

  RETURN TRUE;
EXCEPTION
  WHEN OTHERS THEN
    -- Transaction rollback on any error
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Migration Best Practices

### Migration File Structure
```sql
-- supabase/migrations/YYYYMMDDHHMMSS_description.sql

-- Always wrap in transaction
BEGIN;

-- 1. Schema changes
ALTER TABLE table_name ADD COLUMN new_column TEXT;

-- 2. Data migrations (if needed)
UPDATE table_name SET new_column = 'default_value' WHERE new_column IS NULL;

-- 3. Constraints and indexes
ALTER TABLE table_name ALTER COLUMN new_column SET NOT NULL;
CREATE INDEX idx_table_column ON table_name(new_column);

-- 4. RLS policies
CREATE POLICY "policy_name"
  ON table_name FOR SELECT
  USING (user_id = auth.uid());

-- 5. Grant permissions
GRANT SELECT ON table_name TO authenticated;

COMMIT;
```

### Critical Migration Patterns

**Adding New Table:**
```sql
BEGIN;

-- Create table
CREATE TABLE new_table (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users own data"
  ON new_table FOR ALL
  USING (user_id = auth.uid());

-- Create indexes
CREATE INDEX idx_new_table_user_id ON new_table(user_id);

-- Grant permissions
GRANT ALL ON new_table TO authenticated;

COMMIT;
```

**Modifying Existing Column (Safe Pattern):**
```sql
BEGIN;

-- 1. Add new column
ALTER TABLE table_name ADD COLUMN new_col_name TEXT;

-- 2. Migrate data
UPDATE table_name SET new_col_name = old_col_name::TEXT;

-- 3. Drop old column (after verification)
ALTER TABLE table_name DROP COLUMN old_col_name;

-- 4. Rename new column
ALTER TABLE table_name RENAME COLUMN new_col_name TO old_col_name;

COMMIT;
```

## Performance Optimization

### Indexing Strategy

**Always Index:**
- Foreign keys: `user_id`, `employee_id`, `reviewed_by`
- Status fields: `status`, `role`, `admin_sub_role`
- Timestamps: `created_at`, `updated_at` (DESC)
- Lookup fields: `email`, `stripe_customer_id`, `code`

**Composite Indexes:**
```sql
-- For common query patterns
CREATE INDEX idx_letters_user_status
  ON letters(user_id, status);

CREATE INDEX idx_subscriptions_active
  ON subscriptions(user_id, status, letters_remaining)
  WHERE status = 'active';
```

**Partial Indexes:**
```sql
-- Index only relevant subset
CREATE INDEX idx_pending_email_queue
  ON email_queue(next_retry_at)
  WHERE status = 'pending';
```

## Audit Trail Implementation

**Letter State Changes:**
```sql
CREATE OR REPLACE FUNCTION log_letter_audit(
  p_letter_id UUID,
  p_action TEXT,
  p_old_status TEXT,
  p_new_status TEXT,
  p_notes TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
  v_audit_id UUID;
BEGIN
  INSERT INTO letter_audit_trail (
    letter_id, action, old_status, new_status,
    notes, metadata, performed_by
  ) VALUES (
    p_letter_id, p_action, p_old_status, p_new_status,
    p_notes, p_metadata, auth.uid()
  ) RETURNING id INTO v_audit_id;

  RETURN v_audit_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

## Query Patterns

**Efficient Joins:**
```sql
-- Get letters with reviewer info
SELECT
  l.*,
  p.full_name AS reviewer_name,
  p.email AS reviewer_email
FROM letters l
LEFT JOIN profiles p ON l.reviewed_by = p.id
WHERE l.user_id = auth.uid()
ORDER BY l.created_at DESC
LIMIT 10;
```

**Aggregation Queries:**
```sql
-- Admin dashboard stats
SELECT
  COUNT(*) FILTER (WHERE status = 'pending_review') AS pending_count,
  COUNT(*) FILTER (WHERE status = 'approved') AS approved_count,
  AVG(EXTRACT(EPOCH FROM (approved_at - created_at))) FILTER (WHERE approved_at IS NOT NULL) AS avg_review_time_seconds
FROM letters
WHERE created_at > NOW() - INTERVAL '30 days';
```

## Critical Reminders

1. **Always enable RLS** on new tables with sensitive data
2. **Use SECURITY DEFINER** for functions that need elevated permissions
3. **Lock rows with FOR UPDATE** in atomic operations
4. **Test migrations** in development before production
5. **Index foreign keys** and frequently queried columns
6. **Audit all state changes** with proper logging
7. **Use transactions** for multi-step operations

## Verification Checklist

Before deploying migrations:
- [ ] RLS enabled on all new tables
- [ ] Policies created for all roles (subscriber, employee, admin)
- [ ] Foreign keys indexed
- [ ] Constraints validated
- [ ] Functions have proper SECURITY DEFINER/INVOKER
- [ ] Permissions granted to authenticated role
- [ ] Audit logging implemented for sensitive operations
