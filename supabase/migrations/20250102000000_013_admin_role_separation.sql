/*
  # Admin Role Separation Migration

  This migration implements separation between System Admin and Attorney Admin roles:

  1. New enum type `admin_sub_role` with values: 'system_admin', 'attorney_admin'
  2. Add `admin_sub_role` column to profiles table
  3. Create helper function `get_admin_sub_role()` for permission checks
  4. Create helper function `get_admin_sub_role_by_id()` for server-side checks
  5. Default existing admins to 'system_admin'

  Role Permissions:
  - System Admin: Full access to all features (analytics, users, coupons, commissions, email queue, letters)
  - Attorney Admin: Access ONLY to letter review/approval workflow
*/

-- Create admin sub-role enum
CREATE TYPE admin_sub_role AS ENUM ('system_admin', 'attorney_admin');

-- Add admin_sub_role column to profiles table
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS admin_sub_role admin_sub_role;

-- Add comment for documentation
COMMENT ON COLUMN profiles.admin_sub_role IS 'Sub-role for admin users: system_admin (full access), attorney_admin (letter review only)';

-- Create helper function to get current user's admin sub-role
CREATE OR REPLACE FUNCTION public.get_admin_sub_role()
RETURNS admin_sub_role AS $$
DECLARE
  user_role user_role;
  admin_sub admin_sub_role;
BEGIN
  -- Get user's role from profiles
  SELECT role, admin_sub_role INTO user_role, admin_sub
  FROM public.profiles
  WHERE id = auth.uid();

  -- If not an admin, raise exception
  IF user_role IS NULL OR user_role != 'admin'::user_role THEN
    RAISE EXCEPTION 'User is not an admin';
  END IF;

  -- If admin_sub_role is NULL (existing admins), default to system_admin
  IF admin_sub IS NULL THEN
    RETURN 'system_admin'::admin_sub_role;
  END IF;

  RETURN admin_sub;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create helper function to get admin sub-role by user ID (for server-side checks)
CREATE OR REPLACE FUNCTION public.get_admin_sub_role_by_id(user_id UUID)
RETURNS admin_sub_role AS $$
DECLARE
  user_role user_role;
  admin_sub admin_sub_role;
BEGIN
  -- Get user's role from profiles
  SELECT role, admin_sub_role INTO user_role, admin_sub
  FROM public.profiles
  WHERE id = user_id;

  -- If not an admin, raise exception
  IF user_role IS NULL OR user_role != 'admin'::user_role THEN
    RAISE EXCEPTION 'User is not an admin';
  END IF;

  -- If admin_sub_role is NULL (existing admins), default to system_admin
  IF admin_sub IS NULL THEN
    RETURN 'system_admin'::admin_sub_role;
  END IF;

  RETURN admin_sub;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create helper function to check if user is system admin
CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'::user_role
    AND (admin_sub_role = 'system_admin'::admin_sub_role OR admin_sub_role IS NULL)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create helper function to check if user is attorney admin
CREATE OR REPLACE FUNCTION public.is_attorney_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'::user_role
    AND admin_sub_role = 'attorney_admin'::admin_sub_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create helper function to check if user can review letters (both system and attorney admins can)
CREATE OR REPLACE FUNCTION public.can_review_letters()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'::user_role
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Default existing admins to system_admin (if they don't have a sub-role set)
UPDATE profiles
SET admin_sub_role = 'system_admin'
WHERE role = 'admin'::user_role
AND admin_sub_role IS NULL;

-- Set NOT NULL constraint after setting defaults
ALTER TABLE profiles
ALTER COLUMN admin_sub_role SET NOT NULL;

-- Grant execute on helper functions
GRANT EXECUTE ON FUNCTION public.get_admin_sub_role TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_sub_role_by_id(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_system_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_attorney_admin TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_review_letters TO authenticated;

-- Add comments
COMMENT ON FUNCTION public.get_admin_sub_role IS 'Returns the current admin user''s sub-role (system_admin or attorney_admin)';
COMMENT ON FUNCTION public.get_admin_sub_role_by_id IS 'Returns the admin sub-role for a specific user ID';
COMMENT ON FUNCTION public.is_system_admin IS 'Returns true if current user is a system admin with full access';
COMMENT ON FUNCTION public.is_attorney_admin IS 'Returns true if current user is an attorney admin with letter review access only';
COMMENT ON FUNCTION public.can_review_letters IS 'Returns true if current user is any type of admin (can access letter review)';
