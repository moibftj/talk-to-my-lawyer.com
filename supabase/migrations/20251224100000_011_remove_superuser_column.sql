/*
  Remove is_superuser column - no unlimited access for anyone

  1. Overview
    - Removes is_superuser column from profiles table
    - Everyone is limited by their subscription/letter allowance
    - Updates functions that previously checked is_superuser

  2. Changes
    - Drops is_superuser column from profiles table
    - Simplifies allowance checking functions (remove super user bypass)
*/

-- Drop the is_superuser column
ALTER TABLE public.profiles DROP COLUMN IF EXISTS is_super_user;

-- Drop existing functions first (to recreate with new signature)
DROP FUNCTION IF EXISTS public.check_letter_allowance(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.can_generate_letter(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.deduct_letter_allowance(UUID) CASCADE;

-- Recreate check_letter_allowance function to remove super user bypass
CREATE OR REPLACE FUNCTION public.check_letter_allowance(u_id UUID)
RETURNS TABLE (
  has_access BOOLEAN,
  letters_remaining INTEGER,
  plan_type TEXT,
  is_active BOOLEAN
) SET search_path = public, pg_catalog
AS $$
DECLARE
    user_profile RECORD;
    active_subscription RECORD;
    remaining_count INTEGER;
BEGIN
    -- Get user profile
    SELECT * INTO user_profile FROM public.profiles WHERE id = u_id;

    -- Get active subscription
    SELECT * INTO active_subscription
    FROM public.subscriptions
    WHERE user_id = u_id
    AND status = 'active'
    AND (end_date IS NULL OR end_date > NOW())
    ORDER BY created_at DESC
    LIMIT 1;

    -- No active subscription
    IF active_subscription IS NULL THEN
        RETURN QUERY SELECT false, 0, 'none'::TEXT, false;
        RETURN;
    END IF;

    -- Calculate remaining letters
    remaining_count := active_subscription.letters_allowed - active_subscription.letters_used;

    -- Check if user has access
    IF remaining_count > 0 THEN
        RETURN QUERY SELECT true, remaining_count, active_subscription.plan_type::TEXT, true;
    ELSE
        RETURN QUERY SELECT false, 0, active_subscription.plan_type::TEXT, false;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update can_generate_letter function to remove super user check
CREATE OR REPLACE FUNCTION public.can_generate_letter(u_id UUID)
RETURNS BOOLEAN SET search_path = public, pg_catalog
AS $$
DECLARE
    allowance RECORD;
BEGIN
    -- Check letter allowance
    SELECT * INTO allowance FROM public.check_letter_allowance(u_id);

    RETURN allowance.has_access;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update deduct_letter_allowance function to remove super user bypass
CREATE OR REPLACE FUNCTION public.deduct_letter_allowance(u_id UUID)
RETURNS BOOLEAN SET search_path = public, pg_catalog
AS $$
DECLARE
    current_credits INTEGER;
    v_plan_type TEXT;
BEGIN
    -- Get current credits and plan type
    SELECT s.letters_allowed - s.letters_used, s.plan_type
    INTO current_credits, v_plan_type
    FROM public.subscriptions s
    WHERE s.user_id = u_id
    AND s.status = 'active'
    AND (s.end_date IS NULL OR s.end_date > NOW())
    ORDER BY s.created_at DESC
    LIMIT 1;

    -- No active subscription or no credits
    IF current_credits IS NULL OR current_credits <= 0 THEN
        RETURN false;
    END IF;

    -- Increment letters used (update most recent active subscription)
    UPDATE public.subscriptions
    SET letters_used = letters_used + 1,
        updated_at = NOW()
    WHERE id = (
        SELECT id FROM public.subscriptions
        WHERE user_id = u_id
        AND status = 'active'
        AND (end_date IS NULL OR end_date > NOW())
        ORDER BY created_at DESC
        LIMIT 1
    );

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.check_letter_allowance TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_generate_letter TO authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_letter_allowance TO authenticated;

COMMENT ON FUNCTION public.check_letter_allowance IS 'Check user letter allowance based on subscription (no super user bypass)';
COMMENT ON FUNCTION public.can_generate_letter IS 'Check if user can generate a letter based on allowance';
COMMENT ON FUNCTION public.deduct_letter_allowance IS 'Deduct one letter from user allowance (no super user bypass)';
