-- Complete fix for all SECURITY DEFINER functions with search_path
-- This addresses ALL lint warnings about mutable search_path
-- Applied: 2025-11-27

-- All functions below now have: SET search_path = public, pg_catalog
-- This ensures deterministic behavior and prevents search_path manipulation attacks

-- Note: This file is for reference and backup.
-- All functions have already been applied to the database.

-- Functions Fixed:
-- 1. add_letter_allowances
-- 2. check_letter_allowance
-- 3. create_employee_coupon
-- 4. deduct_letter_allowance
-- 5. detect_suspicious_activity
-- 6. get_commission_summary
-- 7. get_user_role
-- 8. handle_new_user
-- 9. increment_usage
-- 10. log_letter_audit
-- 11. log_security_event
-- 12. reset_monthly_allowances
-- 13. sanitize_input
-- 14. validate_coupon

-- Verification Query:
-- SELECT
--     p.proname as function_name,
--     CASE WHEN p.proconfig IS NOT NULL AND p.proconfig::text LIKE '%search_path%'
--          THEN 'SECURE' ELSE 'VULNERABLE' END as status
-- FROM pg_proc p
-- JOIN pg_namespace n ON p.pronamespace = n.oid
-- WHERE p.prosecdef = true
--   AND n.nspname = 'public'
-- ORDER BY p.proname;