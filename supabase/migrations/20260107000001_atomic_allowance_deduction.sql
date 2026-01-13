/*
  P0-1: Fix Race Condition in Letter Allowance System

  This migration adds an atomic function to check and deduct letter allowance
  in a single database operation using SELECT FOR UPDATE row-level locking.

  Problem: The previous implementation had a race condition where:
  1. checkGenerationEligibility() checks if user has allowance
  2. deductLetterAllowance() deducts from allowance
  Between these two calls, concurrent requests could both pass the check,
  resulting in over-generation of letters.

  Solution: Combine both operations into a single atomic RPC function.
*/

-- Drop old functions if they exist
DROP FUNCTION IF EXISTS public.check_letter_allowance(UUID);
DROP FUNCTION IF EXISTS public.deduct_letter_allowance(UUID);
DROP FUNCTION IF EXISTS public.add_letter_allowances(UUID, INTEGER);

-- Create atomic check_and_deduct_allowance function
-- This function atomically checks eligibility AND deducts allowance
-- Returns success=true only if deduction was successful
CREATE OR REPLACE FUNCTION public.check_and_deduct_allowance(
    u_id UUID
)
RETURNS TABLE(
    success BOOLEAN,
    remaining INTEGER,
    error_message TEXT,
    is_free_trial BOOLEAN,
    is_super_admin BOOLEAN
) AS $$
DECLARE
    user_record RECORD;
    sub_record RECORD;
    v_has_allowance BOOLEAN := FALSE;
    v_remaining INTEGER := 0;
    v_is_free_trial BOOLEAN := FALSE;
    v_is_super_admin BOOLEAN := FALSE;
    v_total_generated INTEGER := 0;
    v_admin_sub_role TEXT;
    letters_to_deduct INTEGER := 1;
BEGIN
    -- Lock the user's profile row to prevent concurrent modifications
    SELECT p.role, p.total_letters_generated
    INTO user_record
    FROM public.profiles p
    WHERE p.id = u_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, 0::INTEGER, 'User not found'::TEXT, FALSE, FALSE;
        RETURN;
    END IF;

    v_total_generated := COALESCE(user_record.total_letters_generated, 0);

    -- Check if user is System Admin (super_admin sub-role) - unlimited letters, no deduction needed
    IF user_record.role = 'admin' THEN
        -- Check if this admin has super_admin sub-role
        SELECT admin_sub_role INTO v_admin_sub_role FROM profiles WHERE id = p_user_id;
        IF v_admin_sub_role = 'super_admin' THEN
            v_is_super_admin := TRUE;
            RETURN QUERY SELECT TRUE, NULL::INTEGER, NULL::TEXT, FALSE, TRUE;
            RETURN;
        END IF;
    END IF;

    -- Lock and check the user's active subscription
    SELECT s.id, s.credits_remaining, s.remaining_letters
    INTO sub_record
    FROM public.subscriptions s
    WHERE s.user_id = u_id
      AND s.status = 'active'
    FOR UPDATE;

    -- Check free trial eligibility (first letter)
    IF v_total_generated = 0 AND sub_record IS NULL THEN
        v_is_free_trial := TRUE;
        -- Increment total letters generated for free trial
        UPDATE public.profiles
        SET total_letters_generated = total_letters_generated + 1,
            updated_at = NOW()
        WHERE id = u_id;

        RETURN QUERY SELECT TRUE, 1::INTEGER, NULL::TEXT, TRUE, FALSE;
        RETURN;
    END IF;

    -- Check if user has an active subscription with remaining letters
    IF sub_record IS NULL THEN
        RETURN QUERY SELECT FALSE, 0::INTEGER, 'No active subscription found'::TEXT, FALSE, FALSE;
        RETURN;
    END IF;

    -- Use credits_remaining if available, otherwise use remaining_letters
    v_remaining := COALESCE(sub_record.credits_remaining, 0);
    IF v_remaining = 0 THEN
        v_remaining := COALESCE(sub_record.remaining_letters, 0);
    END IF;

    IF v_remaining <= 0 THEN
        RETURN QUERY SELECT FALSE, 0::INTEGER, 'No letter credits remaining'::TEXT, FALSE, FALSE;
        RETURN;
    END IF;

    -- Deduct from credits_remaining first, then remaining_letters
    IF sub_record.credits_remaining IS NOT NULL AND sub_record.credits_remaining > 0 THEN
        UPDATE public.subscriptions
        SET credits_remaining = GREATEST(0, credits_remaining - letters_to_deduct),
            remaining_letters = GREATEST(0, COALESCE(remaining_letters, 0) -
                CASE WHEN credits_remaining >= letters_to_deduct THEN 0
                     ELSE letters_to_deduct - credits_remaining END),
            updated_at = NOW()
        WHERE id = sub_record.id;
    ELSE
        UPDATE public.subscriptions
        SET remaining_letters = GREATEST(0, COALESCE(remaining_letters, 0) - letters_to_deduct),
            updated_at = NOW()
        WHERE id = sub_record.id;
    END IF;

    -- Increment total letters generated
    UPDATE public.profiles
    SET total_letters_generated = total_letters_generated + 1,
        updated_at = NOW()
    WHERE id = u_id;

    -- Return remaining count
    v_remaining := v_remaining - letters_to_deduct;

    RETURN QUERY SELECT TRUE, v_remaining::INTEGER, NULL::TEXT, FALSE, FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Add refund function (for when generation fails)
CREATE OR REPLACE FUNCTION public.refund_letter_allowance(
    u_id UUID,
    amount INTEGER DEFAULT 1
)
RETURNS TABLE(
    success BOOLEAN,
    error_message TEXT
) AS $$
DECLARE
    sub_record RECORD;
BEGIN
    -- Lock the subscription row
    SELECT s.id
    INTO sub_record
    FROM public.subscriptions s
    WHERE s.user_id = u_id
      AND s.status = 'active'
    FOR UPDATE;

    IF sub_record IS NULL THEN
        RETURN QUERY SELECT FALSE, 'No active subscription found'::TEXT;
        RETURN;
    END IF;

    -- Refund by adding back to both credits and remaining
    UPDATE public.subscriptions
    SET credits_remaining = credits_remaining + amount,
        remaining_letters = COALESCE(remaining_letters, 0) + amount,
        updated_at = NOW()
    WHERE id = sub_record.id;

    RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Helper function to increment total letters (for free trials)
CREATE OR REPLACE FUNCTION public.increment_total_letters(
    p_user_id UUID
)
RETURNS BOOLEAN AS $$
BEGIN
    UPDATE public.profiles
    SET total_letters_generated = total_letters_generated + 1,
        updated_at = NOW()
    WHERE id = p_user_id;
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Legacy compatibility functions (deprecated - use check_and_deduct_allowance)
CREATE OR REPLACE FUNCTION public.check_letter_allowance(
    u_id UUID
)
RETURNS TABLE(
    has_access BOOLEAN,
    letters_remaining INTEGER
) AS $$
DECLARE
    v_remaining INTEGER := 0;
    sub_record RECORD;
BEGIN
    SELECT s.credits_remaining, s.remaining_letters
    INTO sub_record
    FROM public.subscriptions s
    WHERE s.user_id = u_id
      AND s.status = 'active'
    LIMIT 1;

    IF sub_record IS NOT NULL THEN
        v_remaining := COALESCE(sub_record.credits_remaining, 0);
        IF v_remaining = 0 THEN
            v_remaining := COALESCE(sub_record.remaining_letters, 0);
        END IF;
    END IF;

    RETURN QUERY SELECT (v_remaining > 0)::BOOLEAN, v_remaining::INTEGER;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.check_and_deduct_allowance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.refund_letter_allowance(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.increment_total_letters(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_letter_allowance(UUID) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.check_and_deduct_allowance IS 'Atomically checks letter allowance and deducts one letter. Uses row-level locking (SELECT FOR UPDATE) to prevent race conditions.';
