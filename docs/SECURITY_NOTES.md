# Security Notes - 2026-01-14

## Active Security Observations

### ⚠️ Multiple Permissive RLS Policies Detected

**Table:** `public.suspicious_patterns`
**Issue:** Multiple permissive policies for role `anon` for action `DELETE`

**Policies:**
1. "Admins can manage suspicious patterns"
2. "Service role can manage suspicious patterns"

**Impact:**
- Multiple permissive policies use OR logic (any matching policy grants access)
- This may grant broader DELETE permissions than intended
- Anonymous users (role: anon) might have unintended DELETE access

**Recommendation:**
\`\`\`sql
-- Review and consolidate policies
-- Option 1: Use restrictive policies instead of permissive
-- Option 2: Combine into single permissive policy with proper conditions

-- Check current policies:
SELECT * FROM pg_policies
WHERE tablename = 'suspicious_patterns'
AND cmd = 'DELETE';

-- Verify anonymous users cannot delete:
-- Test as unauthenticated user
DELETE FROM suspicious_patterns WHERE id = 'test-id';
-- Should fail with permission denied
\`\`\`

**Next Steps:**
1. Audit all policies on suspicious_patterns table
2. Ensure DELETE is restricted to admins only
3. Verify service_role policies don't affect anon role
4. Consider using restrictive policies for fine-grained control

---

## RLS Policy Best Practices

### Use Restrictive Policies When Possible
\`\`\`sql
-- Permissive (OR logic - any matching policy grants access)
CREATE POLICY "policy_name" ON table_name AS PERMISSIVE ...

-- Restrictive (AND logic - all policies must pass)
CREATE POLICY "policy_name" ON table_name AS RESTRICTIVE ...
\`\`\`

### Avoid Multiple Permissive Policies for Same Role+Action
- Can lead to unintended access grants
- Harder to audit and understand
- Prefer single comprehensive policy

### Always Test Anonymous Access
\`\`\`sql
-- Switch to anonymous role
SET ROLE anon;

-- Try restricted operations
SELECT * FROM sensitive_table;
DELETE FROM sensitive_table WHERE id = 'test';
UPDATE sensitive_table SET field = 'value';

-- Reset role
RESET ROLE;
\`\`\`

---

**Last Updated:** 2026-01-14
