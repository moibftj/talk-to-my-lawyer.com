/*
  Remove Single Admin Constraint - Enable Multiple Admins

  1. Overview
    - Removes the single-admin constraint that prevented multiple admin users
    - Allows multiple users with role='admin' to share the admin dashboard
    - Drops the unique index, trigger, and helper functions

  2. Changes
    - Drops unique index `one_admin_only`
    - Drops trigger `enforce_single_admin_trigger`
    - Drops function `enforce_single_admin()`
    - Updates admin_exists() to return true if any admin exists
    - Updates get_admin_user_id() to handle multiple admins (returns first or null)
*/

-- Drop the unique index that enforced single admin
DROP INDEX IF EXISTS public.one_admin_only;

-- Drop the trigger
DROP TRIGGER IF EXISTS enforce_single_admin_trigger ON public.profiles;

-- Drop the enforcement function
DROP FUNCTION IF EXISTS public.enforce_single_admin();

-- Update admin_exists() to simply check if any admin exists (removes single constraint)
CREATE OR REPLACE FUNCTION public.admin_exists()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles WHERE role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update get_admin_user_id() - now returns the first admin ID or null
-- Note: With multiple admins, this function is less useful. Consider removing if not used.
CREATE OR REPLACE FUNCTION public.get_admin_user_id()
RETURNS UUID AS $$
BEGIN
    RETURN (
        SELECT id FROM public.profiles WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update comments
COMMENT ON FUNCTION public.admin_exists IS 'Returns true if at least one admin user exists in the system';
COMMENT ON FUNCTION public.get_admin_user_id IS 'Returns the UUID of the first (oldest) admin user. Note: Multiple admins are now supported.';

-- Note: Admin count query for analytics
CREATE OR REPLACE FUNCTION public.get_admin_count()
RETURNS INTEGER AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER FROM public.profiles WHERE role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.admin_exists TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_user_id TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_count TO authenticated;

COMMENT ON FUNCTION public.get_admin_count IS 'Returns the total count of admin users in the system';
