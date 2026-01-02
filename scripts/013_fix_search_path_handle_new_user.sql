-- Fix search_path for handle_new_user function
-- This addresses the lint warning about mutable search_path

-- Step 1: Drop the trigger that depends on the function
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Step 2: Drop the existing function
DROP FUNCTION IF EXISTS public.handle_new_user();

-- Step 3: Recreate the function with a secure, fixed search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $function$
BEGIN
    INSERT INTO public.profiles (id, email, full_name)
    VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
    RETURN NEW;
END;
$function$;

-- Step 4: Recreate the trigger
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Grant necessary permissions (if needed)
-- GRANT EXECUTE ON FUNCTION public.handle_new_user() TO authenticated;