-- Fix search_path for all SECURITY DEFINER functions
-- This addresses lint warnings about mutable search_path

-- Functions to fix:
-- 1. check_letter_allowance
-- 2. deduct_letter_allowance
-- 3. detect_suspicious_activity
-- 4. get_commission_summary
-- 5. get_user_role
-- 6. log_letter_audit
-- 7. log_security_event
-- 8. reset_monthly_allowances
-- 9. validate_coupon

-- 1. check_letter_allowance
CREATE OR REPLACE FUNCTION public.check_letter_allowance(u_id UUID)
RETURNS TABLE(has_allowance BOOLEAN, remaining INTEGER, plan_name TEXT, is_super BOOLEAN)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    is_superuser BOOLEAN;
    active_subscription RECORD;
    remaining_count INTEGER;
BEGIN
    -- Check if user is a super user
    SELECT is_super_user INTO is_superuser
    FROM public.profiles
    WHERE id = u_id;

    IF is_superuser THEN
        RETURN QUERY SELECT true, 999, 'unlimited', true;
        RETURN;
    END IF;

    -- Get active subscription
    SELECT * INTO active_subscription
    FROM public.subscriptions
    WHERE user_id = u_id
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > NOW());

    IF active_subscription.id IS NULL THEN
        -- Check for free trial (first letter)
        DECLARE
            letter_count INTEGER;
        BEGIN
            SELECT COUNT(*) INTO letter_count
            FROM public.letters
            WHERE user_id = u_id;

            IF letter_count = 0 THEN
                RETURN QUERY SELECT true, 1, 'free_trial', false;
            ELSE
                RETURN QUERY SELECT false, 0, NULL, false;
            END IF;
            RETURN;
        END;
    END IF;

    remaining_count := COALESCE(active_subscription.credits_remaining, 0);

    RETURN QUERY SELECT
        remaining_count > 0,
        remaining_count,
        active_subscription.plan_type,
        false;
END;
$$;

-- 2. deduct_letter_allowance
CREATE OR REPLACE FUNCTION public.deduct_letter_allowance(u_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    sub_record RECORD;
BEGIN
    -- Get active subscription
    SELECT id INTO sub_record
    FROM public.subscriptions
    WHERE user_id = u_id
    AND status = 'active'
    AND (expires_at IS NULL OR expires_at > NOW());

    IF sub_record.id IS NULL THEN
        -- Check if it's their first letter
        DECLARE
            letter_count INTEGER;
        BEGIN
            SELECT COUNT(*) INTO letter_count
            FROM public.letters
            WHERE user_id = u_id;

            IF letter_count = 0 THEN
                RETURN true; -- First letter is free
            END IF;
            RETURN false;
        END;
    END IF;

    -- Deduct 1 letter
    UPDATE public.subscriptions
    SET remaining_letters = remaining_letters - 1,
        updated_at = NOW()
    WHERE id = sub_record.id;

    RETURN true;
END;
$$;

-- 3. detect_suspicious_activity
CREATE OR REPLACE FUNCTION public.detect_suspicious_activity(user_id UUID, action_type TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    action_count INTEGER;
    time_window INTERVAL := '1 hour';
BEGIN
    -- Count actions in the last hour
    SELECT COUNT(*) INTO action_count
    FROM public.letter_audit_trail
    WHERE performed_by = user_id
    AND created_at > NOW() - time_window
    AND action = action_type;

    -- Flag as suspicious if more than 20 actions per hour
    RETURN action_count > 20;
END;
$$;

-- 4. get_commission_summary
CREATE OR REPLACE FUNCTION public.get_commission_summary(emp_id UUID)
RETURNS TABLE(total_earned NUMERIC, pending_amount NUMERIC, paid_amount NUMERIC, commission_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(SUM(commission_amount), 0) as total_earned,
        COALESCE(SUM(CASE WHEN status = 'pending' THEN commission_amount ELSE 0 END), 0) as pending_amount,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN commission_amount ELSE 0 END), 0) as paid_amount,
        COUNT(*)::INTEGER as commission_count
    FROM public.commissions
    WHERE employee_id = emp_id;
END;
$$;

-- 5. get_user_role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    RETURN COALESCE(
        (SELECT role::TEXT FROM public.profiles WHERE id = auth.uid()),
        'subscriber'
    );
END;
$$;

-- 6. log_letter_audit
CREATE OR REPLACE FUNCTION public.log_letter_audit(
    p_letter_id UUID,
    p_action TEXT,
    p_old_status TEXT DEFAULT NULL,
    p_new_status TEXT DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    INSERT INTO public.letter_audit_trail (
        letter_id,
        action,
        performed_by,
        old_status,
        new_status,
        notes,
        metadata
    ) VALUES (
        p_letter_id,
        p_action,
        auth.uid(),
        p_old_status,
        p_new_status,
        p_notes,
        p_metadata
    );
END;
$$;

-- 7. log_security_event
CREATE OR REPLACE FUNCTION public.log_security_event(
    p_user_id UUID,
    p_event_type TEXT,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL,
    p_details JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    INSERT INTO public.security_audit_log (
        user_id,
        event_type,
        ip_address,
        user_agent,
        details
    ) VALUES (
        p_user_id,
        p_event_type,
        p_ip_address,
        p_user_agent,
        p_details
    );
END;
$$;

-- 8. reset_monthly_allowances
CREATE OR REPLACE FUNCTION public.reset_monthly_allowances()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    UPDATE public.subscriptions
    SET remaining_letters = CASE
            WHEN plan_type IN ('standard_4_month', 'monthly_standard') THEN 4
            WHEN plan_type IN ('premium_8_month', 'monthly_premium') THEN 8
            ELSE remaining_letters -- one_time doesn't reset
        END,
        last_reset_at = NOW(),
        updated_at = NOW()
    WHERE status = 'active'
      AND plan_type IN ('standard_4_month', 'premium_8_month', 'monthly_standard', 'monthly_premium')
      AND DATE_TRUNC('month', last_reset_at) < DATE_TRUNC('month', NOW());
END;
$$;

-- 9. validate_coupon
CREATE OR REPLACE FUNCTION public.validate_coupon(coupon_code TEXT)
RETURNS TABLE(is_valid BOOLEAN, discount_percent INTEGER, employee_id UUID, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    coupon_record RECORD;
BEGIN
    -- Check if coupon exists and is active
    SELECT * INTO coupon_record
    FROM public.employee_coupons
    WHERE code = coupon_code
    AND is_active = true;

    IF coupon_record.id IS NULL THEN
        RETURN QUERY SELECT false, 0, NULL::UUID, 'Invalid coupon code'::TEXT;
        RETURN;
    END IF;

    RETURN QUERY SELECT
        true,
        coupon_record.discount_percent,
        coupon_record.employee_id,
        'Coupon valid'::TEXT;
END;
$$;