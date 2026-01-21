# RLS Migration Verification Checklist

## Critical Migration: 20260113190657_remote_authoritative.sql

This migration dropped and recreated ALL Row Level Security (RLS) policies. This document provides steps to verify it was successfully applied.

## ⚠️ WHY THIS IS CRITICAL

If this migration was partially applied or failed:
- **All user data could be exposed** (no RLS = no access control)
- Employees could access letter content
- Users could access other users' data
- Subscriptions, payments, and sensitive data would be unprotected

## VERIFICATION STEPS

### 1. Check Migration Status (via Supabase Dashboard)

Navigate to: `Database > Migrations` in your Supabase dashboard

**Expected:** Migration `20260113190657_remote_authoritative.sql` should show as **"Applied"** with a checkmark.

### 2. Verify RLS is Enabled on All Tables

Run this SQL query in the Supabase SQL Editor:

\`\`\`sql
SELECT
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
\`\`\`

**Expected:** All sensitive tables should have `rls_enabled = true`:
- ✅ profiles
- ✅ letters
- ✅ subscriptions
- ✅ employee_coupons
- ✅ commissions
- ✅ coupon_usage
- ✅ letter_audit_trail
- ✅ security_audit_log
- ✅ admin_audit_log
- ✅ email_queue
- ✅ email_delivery_log
- ✅ privacy_policy_acceptances
- ✅ data_export_requests
- ✅ data_deletion_requests
- ✅ data_access_logs

### 3. Verify RLS Policies Exist

Run this SQL query:

\`\`\`sql
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
\`\`\`

**Expected:** Should return **50+ policies** across all tables.

### 4. Test Critical RLS Policies

#### Test 1: Subscribers Can Only See Their Own Letters

\`\`\`sql
-- As a subscriber user, run:
SELECT * FROM letters;

-- Should ONLY return letters where user_id = current user's ID
-- Should NOT return other users' letters
\`\`\`

#### Test 2: Employees CANNOT See Letter Content

\`\`\`sql
-- As an employee user, run:
SELECT * FROM letters;

-- Should return ZERO rows (employees have no SELECT policy on letters)
\`\`\`

#### Test 3: Admins Can See All Letters

\`\`\`sql
-- As an admin user, run:
SELECT COUNT(*) FROM letters;

-- Should return total count of all letters in the system
\`\`\`

#### Test 4: Users Can Only See Their Own Subscriptions

\`\`\`sql
-- As a subscriber user, run:
SELECT * FROM subscriptions;

-- Should ONLY return subscriptions where user_id = current user's ID
\`\`\`

### 5. Verify Database Functions Still Work

\`\`\`sql
-- Test allowance check
SELECT * FROM check_and_deduct_allowance('YOUR_USER_ID_HERE');

-- Test admin role check
SELECT is_super_admin();
SELECT is_attorney_admin();

-- Test coupon validation
SELECT * FROM validate_coupon('TEST-CODE');
\`\`\`

### 6. Application-Level Testing

After verifying database-level RLS:

1. **Log in as a subscriber** and verify:
   - ✅ Can only see own letters
   - ✅ Can generate new letters
   - ✅ Cannot see other users' data

2. **Log in as an employee** and verify:
   - ✅ Can see referral links and commissions
   - ✅ CANNOT access letter content
   - ✅ Cannot generate letters

3. **Log in as an attorney admin** and verify:
   - ✅ Can see all letters for review
   - ✅ Can approve/reject letters
   - ✅ Cannot see super admin features

4. **Log in as a super admin** and verify:
   - ✅ Can access all admin features
   - ✅ Can see all letters, users, subscriptions
   - ✅ Can manage coupons and analytics

## ROLLBACK PROCEDURE (If Issues Found)

If the migration failed or was partially applied:

### Option 1: Point-in-Time Recovery (Recommended)

1. Go to Supabase Dashboard > Database > Backups
2. Select a backup from **before January 13, 2026**
3. Restore to a new project
4. Migrate data manually

### Option 2: Re-run Migration

1. Check migration logs for errors
2. If safe, drop all policies manually:
   \`\`\`sql
   -- WARNING: Only run if you understand the implications
   DO $$
   DECLARE
     r RECORD;
   BEGIN
     FOR r IN SELECT policyname, tablename FROM pg_policies WHERE schemaname = 'public'
     LOOP
       EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON ' || quote_ident(r.tablename);
     END LOOP;
   END $$;
   \`\`\`
3. Re-run migration file

## MONITORING

After verification, monitor for:

- **Unauthorized access errors** in logs
- **403 Forbidden errors** from employees trying to access letters
- **Unexpected data visibility** reported by users
- **RLS policy violation errors** in Supabase logs

## STATUS

**Last Verified:** [PENDING - Needs manual verification]

**Verified By:** [Name]

**Verification Date:** [Date]

**Result:**
- [ ] ✅ All RLS policies applied successfully
- [ ] ⚠️ Some policies missing (see notes)
- [ ] ❌ Migration failed (rollback required)

**Notes:**

---

**IMPORTANT:** This verification should be done in both staging and production environments.
