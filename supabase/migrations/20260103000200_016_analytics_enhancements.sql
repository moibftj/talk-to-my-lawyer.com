/*
  Migration: 016_analytics_enhancements
  Description: Adds comprehensive analytics functions for System Admin dashboard,
               including coupon usage tracking by employee and letter generation stats.
*/

-- 1. Get coupon usage statistics by employee (for System Admin analytics)
CREATE OR REPLACE FUNCTION public.get_coupon_usage_by_employee()
RETURNS TABLE(
    employee_id UUID,
    employee_name TEXT,
    employee_email TEXT,
    coupon_code TEXT,
    total_uses BIGINT,
    total_discount_given NUMERIC,
    total_revenue_after_discount NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    -- Only System Admins can access this
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Access denied: System Admin only';
    END IF;

    RETURN QUERY
    SELECT 
        p.id AS employee_id,
        p.full_name AS employee_name,
        p.email AS employee_email,
        ec.code AS coupon_code,
        COUNT(cu.id) AS total_uses,
        COALESCE(SUM(cu.amount_before - cu.amount_after), 0) AS total_discount_given,
        COALESCE(SUM(cu.amount_after), 0) AS total_revenue_after_discount
    FROM public.profiles p
    JOIN public.employee_coupons ec ON p.id = ec.employee_id
    LEFT JOIN public.coupon_usage cu ON ec.code = cu.coupon_code
    WHERE p.role = 'employee'
    GROUP BY p.id, p.full_name, p.email, ec.code
    ORDER BY total_uses DESC;
END;
$$;

-- 2. Get letter generation analytics (for System Admin)
CREATE OR REPLACE FUNCTION public.get_letter_analytics()
RETURNS TABLE(
    total_letters BIGINT,
    letters_pending_review BIGINT,
    letters_under_review BIGINT,
    letters_approved BIGINT,
    letters_rejected BIGINT,
    letters_today BIGINT,
    letters_this_week BIGINT,
    letters_this_month BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    -- Only System Admins can access this
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Access denied: System Admin only';
    END IF;

    RETURN QUERY
    SELECT 
        COUNT(*) AS total_letters,
        COUNT(*) FILTER (WHERE status = 'pending_review') AS letters_pending_review,
        COUNT(*) FILTER (WHERE status = 'under_review') AS letters_under_review,
        COUNT(*) FILTER (WHERE status = 'approved') AS letters_approved,
        COUNT(*) FILTER (WHERE status = 'rejected') AS letters_rejected,
        COUNT(*) FILTER (WHERE DATE(created_at) = CURRENT_DATE) AS letters_today,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '7 days') AS letters_this_week,
        COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE - INTERVAL '30 days') AS letters_this_month
    FROM public.letters;
END;
$$;

-- 3. Get subscriber analytics (for System Admin)
CREATE OR REPLACE FUNCTION public.get_subscriber_analytics()
RETURNS TABLE(
    total_subscribers BIGINT,
    active_subscriptions BIGINT,
    total_revenue NUMERIC,
    avg_subscription_value NUMERIC,
    new_subscribers_today BIGINT,
    new_subscribers_this_week BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    -- Only System Admins can access this
    IF NOT public.is_super_admin() THEN
        RAISE EXCEPTION 'Access denied: System Admin only';
    END IF;

    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM public.profiles WHERE role = 'subscriber') AS total_subscribers,
        (SELECT COUNT(*) FROM public.subscriptions WHERE status = 'active') AS active_subscriptions,
        (SELECT COALESCE(SUM(price - discount), 0) FROM public.subscriptions WHERE status = 'active') AS total_revenue,
        (SELECT COALESCE(AVG(price - discount), 0) FROM public.subscriptions WHERE status = 'active') AS avg_subscription_value,
        (SELECT COUNT(*) FROM public.profiles WHERE role = 'subscriber' AND DATE(created_at) = CURRENT_DATE) AS new_subscribers_today,
        (SELECT COUNT(*) FROM public.profiles WHERE role = 'subscriber' AND created_at >= CURRENT_DATE - INTERVAL '7 days') AS new_subscribers_this_week;
END;
$$;

-- 4. Get letters pending review for Attorney Admin (User Admin)
CREATE OR REPLACE FUNCTION public.get_letters_for_review()
RETURNS TABLE(
    letter_id UUID,
    title TEXT,
    letter_type TEXT,
    status TEXT,
    subscriber_name TEXT,
    subscriber_email TEXT,
    ai_draft_content TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
    -- Both System Admins and Attorney Admins can access this
    IF NOT (public.is_super_admin() OR public.is_attorney_admin()) THEN
        RAISE EXCEPTION 'Access denied: Admin only';
    END IF;

    RETURN QUERY
    SELECT 
        l.id AS letter_id,
        l.title,
        l.letter_type,
        l.status::TEXT,
        p.full_name AS subscriber_name,
        p.email AS subscriber_email,
        l.ai_draft_content,
        l.created_at
    FROM public.letters l
    JOIN public.profiles p ON l.user_id = p.id
    WHERE l.status IN ('pending_review', 'under_review')
    ORDER BY l.created_at ASC;
END;
$$;

-- 5. Update letter status (for Attorney Admin review workflow)
CREATE OR REPLACE FUNCTION public.update_letter_review(
    p_letter_id UUID,
    p_new_status TEXT,
    p_final_content TEXT DEFAULT NULL,
    p_review_notes TEXT DEFAULT NULL,
    p_rejection_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
    current_user_id UUID;
    old_status TEXT;
BEGIN
    -- Both System Admins and Attorney Admins can update letters
    IF NOT (public.is_super_admin() OR public.is_attorney_admin()) THEN
        RAISE EXCEPTION 'Access denied: Admin only';
    END IF;

    current_user_id := auth.uid();

    -- Get current status
    SELECT status::TEXT INTO old_status FROM public.letters WHERE id = p_letter_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;

    -- Update the letter
    UPDATE public.letters
    SET 
        status = p_new_status::letter_status,
        final_content = COALESCE(p_final_content, final_content),
        review_notes = COALESCE(p_review_notes, review_notes),
        rejection_reason = CASE WHEN p_new_status = 'rejected' THEN p_rejection_reason ELSE rejection_reason END,
        reviewed_by = current_user_id,
        reviewed_at = NOW(),
        approved_at = CASE WHEN p_new_status = 'approved' THEN NOW() ELSE approved_at END,
        updated_at = NOW()
    WHERE id = p_letter_id;

    -- Log to audit trail
    INSERT INTO public.letter_audit_trail (letter_id, action, performed_by, old_status, new_status, notes)
    VALUES (p_letter_id, 'status_change', current_user_id, old_status, p_new_status, p_review_notes);

    RETURN TRUE;
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_coupon_usage_by_employee TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_letter_analytics TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_subscriber_analytics TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_letters_for_review TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_letter_review TO authenticated;
