drop policy "Admins can view audit log" on "public"."admin_audit_log";

drop policy "Service role can insert audit log" on "public"."admin_audit_log";

drop policy "Admins create commissions" on "public"."commissions";

drop policy "Admins update commissions" on "public"."commissions";

drop policy "Admins view all commissions" on "public"."commissions";

drop policy "Employees view own commissions" on "public"."commissions";

drop policy "Users can view own data access logs" on "public"."data_access_logs";

drop policy "Users can create deletion requests" on "public"."data_deletion_requests";

drop policy "Users can view own deletion requests" on "public"."data_deletion_requests";

drop policy "Users can create export requests" on "public"."data_export_requests";

drop policy "Users can view own export requests" on "public"."data_export_requests";

drop policy "Service role can manage email delivery log" on "public"."email_delivery_log";

drop policy "Service role can manage email queue" on "public"."email_queue";

drop policy "Admins manage all coupons" on "public"."employee_coupons";

drop policy "Employees create own coupon" on "public"."employee_coupons";

drop policy "Employees view own coupons" on "public"."employee_coupons";

drop policy "Admins view all audit logs" on "public"."letter_audit_trail";

drop policy "Users view own letter audit" on "public"."letter_audit_trail";

drop policy "Admins full letter access" on "public"."letters";

drop policy "Subscribers create own letters" on "public"."letters";

drop policy "Subscribers update own letters" on "public"."letters";

drop policy "Subscribers view own letters" on "public"."letters";

drop policy "Employees can create payout requests" on "public"."payout_requests";

drop policy "Employees can view own payout requests" on "public"."payout_requests";

drop policy "Users can insert own privacy acceptances" on "public"."privacy_policy_acceptances";

drop policy "Users can view own privacy acceptances" on "public"."privacy_policy_acceptances";

drop policy "Admins can view all profiles" on "public"."profiles";

drop policy "Users can insert own profile" on "public"."profiles";

drop policy "Users can update own profile" on "public"."profiles";

drop policy "Users can view own profile" on "public"."profiles";

drop policy "Admins view security audit log" on "public"."security_audit_log";

drop policy "System can insert security events" on "public"."security_audit_log";

drop policy "Admins only access security config" on "public"."security_config";

drop policy "Admins view all subscriptions" on "public"."subscriptions";

drop policy "Users can create subscriptions" on "public"."subscriptions";

drop policy "Users view own subscriptions" on "public"."subscriptions";

alter table "public"."commissions" drop constraint "commissions_commission_amount_check";

alter table "public"."commissions" drop constraint "commissions_commission_rate_check";

alter table "public"."commissions" drop constraint "commissions_subscription_amount_check";

alter table "public"."coupon_usage" drop constraint "coupon_usage_amount_after_check";

alter table "public"."coupon_usage" drop constraint "coupon_usage_amount_before_check";

alter table "public"."coupon_usage" drop constraint "coupon_usage_discount_percent_check";

alter table "public"."coupon_usage" drop constraint "coupon_usage_subscription_id_fkey";

alter table "public"."data_access_logs" drop constraint "fk_user";

alter table "public"."data_deletion_requests" drop constraint "fk_user";

alter table "public"."data_export_requests" drop constraint "fk_user";

alter table "public"."employee_coupons" drop constraint "employee_coupons_employee_id_key";

alter table "public"."employee_coupons" drop constraint "employee_coupons_usage_count_check";

alter table "public"."profiles" drop constraint "admin_sub_role_only_for_admins";

alter table "public"."subscriptions" drop constraint "subscriptions_discount_check";

alter table "public"."subscriptions" drop constraint "subscriptions_price_check";

alter table "public"."coupon_usage" drop constraint "coupon_usage_employee_id_fkey";

alter table "public"."letter_audit_trail" drop constraint "letter_audit_trail_performed_by_fkey";

drop view if exists "public"."active_subscriptions_view";

drop function if exists "public"."detect_suspicious_activity"(p_user_id uuid, action_type text);

drop view if exists "public"."pending_review_letters_view";

drop function if exists "public"."get_admin_dashboard_stats"();

drop function if exists "public"."get_letter_statistics"(days_back integer);

drop function if exists "public"."get_revenue_summary"(months_back integer);

drop function if exists "public"."get_subscription_analytics"();

drop index if exists "public"."employee_coupons_employee_id_key";

drop index if exists "public"."idx_commissions_employee_status";

drop index if exists "public"."idx_commissions_pending";

drop index if exists "public"."idx_coupon_usage_created_at";

drop index if exists "public"."idx_coupon_usage_subscription";

drop index if exists "public"."idx_letters_created_status";

drop index if exists "public"."idx_letters_pending";

drop index if exists "public"."idx_letters_user_status";

drop index if exists "public"."idx_security_audit_created";

drop index if exists "public"."idx_security_audit_event";

drop index if exists "public"."idx_security_audit_user";

drop index if exists "public"."idx_subscriptions_active";

drop index if exists "public"."idx_subscriptions_user_status";

alter table "public"."letters" alter column "status" drop default;

alter table "public"."subscriptions" alter column "status" drop default;

alter type "public"."admin_sub_role" rename to "admin_sub_role__old_version_to_be_dropped";

create type "public"."admin_sub_role" as enum ('system_admin', 'attorney_admin', 'super_admin');

alter type "public"."letter_status" rename to "letter_status__old_version_to_be_dropped";

create type "public"."letter_status" as enum ('draft', 'pending_review', 'approved', 'rejected', 'generating', 'under_review', 'completed', 'failed', 'sent');

alter type "public"."subscription_status" rename to "subscription_status__old_version_to_be_dropped";

create type "public"."subscription_status" as enum ('active', 'canceled', 'past_due', 'pending');

alter table "public"."letters" alter column status type "public"."letter_status" using status::text::"public"."letter_status";

alter table "public"."profiles" alter column admin_sub_role type "public"."admin_sub_role" using admin_sub_role::text::"public"."admin_sub_role";

alter table "public"."subscriptions" alter column status type "public"."subscription_status" using status::text::"public"."subscription_status";

alter table "public"."letters" alter column "status" set default 'draft'::public.letter_status;

alter table "public"."subscriptions" alter column "status" set default 'active'::public.subscription_status;

drop type "public"."admin_sub_role__old_version_to_be_dropped";

drop type "public"."letter_status__old_version_to_be_dropped";

drop type "public"."subscription_status__old_version_to_be_dropped";

alter table "public"."coupon_usage" drop column "subscription_id";

alter table "public"."coupon_usage" add column "fingerprint" text;

alter table "public"."coupon_usage" add column "fraud_detection_data" jsonb;

alter table "public"."coupon_usage" add column "fraud_risk_score" integer default 0;

alter table "public"."coupon_usage" add column "ip_address" inet;

alter table "public"."coupon_usage" add column "user_agent" text;

alter table "public"."coupon_usage" alter column "amount_after" set not null;

alter table "public"."coupon_usage" alter column "amount_before" set not null;

alter table "public"."coupon_usage" alter column "discount_percent" set not null;

alter table "public"."employee_coupons" alter column "employee_id" drop not null;

alter table "public"."letters" drop column "is_attorney_reviewed";

alter table "public"."profiles" add column "free_trial_used" boolean default false;

alter table "public"."subscriptions" add column "letters_per_period" integer default 0;

alter table "public"."subscriptions" add column "letters_remaining" integer default 0;

CREATE INDEX idx_coupon_usage_created ON public.coupon_usage USING btree (created_at DESC);

CREATE INDEX idx_coupon_usage_fingerprint ON public.coupon_usage USING btree (fingerprint);

CREATE INDEX idx_coupon_usage_ip_address ON public.coupon_usage USING btree (ip_address);

CREATE INDEX idx_coupon_usage_user_agent ON public.coupon_usage USING btree (user_agent);

CREATE INDEX idx_data_deletion_requests_approved_by ON public.data_deletion_requests USING btree (approved_by);

CREATE INDEX idx_email_delivery_log_email_queue_id ON public.email_delivery_log USING btree (email_queue_id);

CREATE INDEX idx_letters_reviewed_by ON public.letters USING btree (reviewed_by);

CREATE INDEX idx_payout_requests_processed_by ON public.payout_requests USING btree (processed_by);

CREATE INDEX idx_profiles_free_trial ON public.profiles USING btree (free_trial_used);

CREATE INDEX idx_security_audit_log_user_id ON public.security_audit_log USING btree (user_id);

CREATE INDEX idx_subscriptions_letters ON public.subscriptions USING btree (user_id, status, letters_remaining) WHERE (status = 'active'::public.subscription_status);

alter table "public"."commissions" add constraint "check_commission_amount" CHECK ((commission_amount >= (0)::numeric)) not valid;

alter table "public"."commissions" validate constraint "check_commission_amount";

alter table "public"."commissions" add constraint "check_commission_rate" CHECK (((commission_rate >= (0)::numeric) AND (commission_rate <= (1)::numeric))) not valid;

alter table "public"."commissions" validate constraint "check_commission_rate";

alter table "public"."data_access_logs" add constraint "fk_user_access" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."data_access_logs" validate constraint "fk_user_access";

alter table "public"."data_deletion_requests" add constraint "fk_user_deletion" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."data_deletion_requests" validate constraint "fk_user_deletion";

alter table "public"."data_export_requests" add constraint "fk_user_export" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE not valid;

alter table "public"."data_export_requests" validate constraint "fk_user_export";

alter table "public"."employee_coupons" add constraint "check_coupon_discount" CHECK (((discount_percent >= 0) AND (discount_percent <= 100))) not valid;

alter table "public"."employee_coupons" validate constraint "check_coupon_discount";

alter table "public"."employee_coupons" add constraint "check_coupon_usage" CHECK ((usage_count >= 0)) not valid;

alter table "public"."employee_coupons" validate constraint "check_coupon_usage";

alter table "public"."subscriptions" add constraint "check_subscription_discount" CHECK (((discount >= (0)::numeric) AND (discount <= price))) not valid;

alter table "public"."subscriptions" validate constraint "check_subscription_discount";

alter table "public"."subscriptions" add constraint "check_subscription_price" CHECK (((price >= (0)::numeric) AND (price <= 99999.99))) not valid;

alter table "public"."subscriptions" validate constraint "check_subscription_price";

alter table "public"."coupon_usage" add constraint "coupon_usage_employee_id_fkey" FOREIGN KEY (employee_id) REFERENCES public.profiles(id) ON DELETE CASCADE not valid;

alter table "public"."coupon_usage" validate constraint "coupon_usage_employee_id_fkey";

alter table "public"."letter_audit_trail" add constraint "letter_audit_trail_performed_by_fkey" FOREIGN KEY (performed_by) REFERENCES public.profiles(id) ON DELETE SET NULL not valid;

alter table "public"."letter_audit_trail" validate constraint "letter_audit_trail_performed_by_fkey";

set check_function_bodies = off;

create or replace view "public"."admin_coupon_analytics" as  SELECT cu.coupon_code,
    count(*) AS total_uses,
    sum((cu.amount_before - cu.amount_after)) AS total_discount_given,
    sum(cu.amount_after) AS total_revenue,
    max(cu.created_at) AS last_used,
    ec.employee_id,
    p.full_name AS employee_name
   FROM ((public.coupon_usage cu
     LEFT JOIN public.employee_coupons ec ON ((upper(cu.coupon_code) = upper(ec.code))))
     LEFT JOIN public.profiles p ON ((ec.employee_id = p.id)))
  GROUP BY cu.coupon_code, ec.employee_id, p.full_name
  ORDER BY (count(*)) DESC;


CREATE OR REPLACE FUNCTION public.create_employee_coupon(emp_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
      DECLARE
          coupon_code TEXT;
      BEGIN
          coupon_code := 'EMP' || UPPER(substring(md5(emp_id || extract(epoch from now())), 1, 8));

          INSERT INTO public.employee_coupons (
              employee_id,
              code,
              discount_percent,
              is_active
          ) VALUES (
              emp_id,
              coupon_code,
              20,
              true
          );

          RETURN coupon_code;
      END;
      $function$
;

CREATE OR REPLACE FUNCTION public.detect_suspicious_activity(user_id uuid, action_type text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.add_letter_allowances(sub_id uuid, plan text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    letters_to_add INT;
BEGIN
    IF plan = 'one_time' THEN
        letters_to_add := 1;
    ELSIF plan = 'standard_4_month' THEN
        letters_to_add := 4;
    ELSIF plan = 'premium_8_month' THEN
        letters_to_add := 8;
    ELSE
        RAISE EXCEPTION 'Invalid plan type: %', plan;
    END IF;

    UPDATE public.subscriptions
    SET remaining_letters = letters_to_add,
        last_reset_at = NOW(),
        updated_at = NOW()
    WHERE id = sub_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.admin_exists()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles WHERE role = 'admin'
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.can_generate_letter(u_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
    allowance RECORD;
BEGIN
    -- Check letter allowance
    SELECT * INTO allowance FROM public.check_letter_allowance(u_id);

    RETURN allowance.has_access;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.create_employee_coupon()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    IF NEW.role = 'employee' THEN
        INSERT INTO public.employee_coupons (employee_id, code, discount_percent, is_active)
        VALUES (
            NEW.id,
            'EMP-' || UPPER(SUBSTR(MD5(NEW.id::TEXT), 1, 6)),
            20,
            true
        )
        ON CONFLICT (employee_id) DO NOTHING;
    END IF;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_admin_count()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN (
        SELECT COUNT(*)::INTEGER FROM public.profiles WHERE role = 'admin'
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_admin_dashboard_stats()
 RETURNS TABLE(total_users bigint, total_subscribers bigint, total_employees bigint, pending_letters bigint, approved_letters_today bigint, total_revenue numeric, pending_commissions numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM profiles) as total_users,
    (SELECT COUNT(*) FROM profiles WHERE role = 'subscriber') as total_subscribers,
    (SELECT COUNT(*) FROM profiles WHERE role = 'employee') as total_employees,
    (SELECT COUNT(*) FROM letters WHERE status IN ('pending_review', 'under_review')) as pending_letters,
    (SELECT COUNT(*) FROM letters WHERE status = 'approved' AND DATE(approved_at) = CURRENT_DATE) as approved_letters_today,
    (SELECT COALESCE(SUM(price - discount), 0) FROM subscriptions WHERE status = 'active') as total_revenue,
    (SELECT COALESCE(SUM(commission_amount), 0) FROM commissions WHERE status = 'pending') as pending_commissions;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_admin_sub_role()
 RETURNS public.admin_sub_role
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_role user_role;
  admin_sub admin_sub_role;
BEGIN
  SELECT role, admin_sub_role INTO user_role, admin_sub
  FROM public.profiles
  WHERE id = auth.uid();

  IF user_role IS NULL OR user_role != 'admin'::user_role THEN
    RAISE EXCEPTION 'User is not an admin';
  END IF;

  IF admin_sub IS NULL THEN
    RETURN 'system_admin'::admin_sub_role;
  END IF;

  RETURN admin_sub;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_admin_sub_role_by_id(user_id uuid)
 RETURNS public.admin_sub_role
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  user_role user_role;
  admin_sub admin_sub_role;
BEGIN
  SELECT role, admin_sub_role INTO user_role, admin_sub
  FROM public.profiles
  WHERE id = user_id;

  IF user_role IS NULL OR user_role != 'admin'::user_role THEN
    RAISE EXCEPTION 'User is not an admin';
  END IF;

  IF admin_sub IS NULL THEN
    RETURN 'system_admin'::admin_sub_role;
  END IF;

  RETURN admin_sub;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_admin_user_id()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN (
        SELECT id FROM public.profiles WHERE role = 'admin' ORDER BY created_at ASC LIMIT 1
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_commission_summary(emp_id uuid)
 RETURNS TABLE(total_earned numeric, pending_amount numeric, paid_amount numeric, commission_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(SUM(commission_amount), 0) as total_earned,
    COALESCE(SUM(CASE WHEN status = 'pending' THEN commission_amount ELSE 0 END), 0) as pending_amount,
    COALESCE(SUM(CASE WHEN status = 'paid' THEN commission_amount ELSE 0 END), 0) as paid_amount,
    COUNT(*)::INTEGER as commission_count
  FROM commissions
  WHERE employee_id = emp_id;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_employee_coupon(p_employee_id uuid)
 RETURNS TABLE(id uuid, code text, discount_percent integer, is_active boolean, usage_count integer, created_at timestamp with time zone)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        ec.id,
        ec.code,
        ec.discount_percent,
        ec.is_active,
        ec.usage_count,
        ec.created_at
    FROM employee_coupons ec
    WHERE ec.employee_id = get_employee_coupon.p_employee_id
    ORDER BY ec.created_at DESC
    LIMIT 1;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_letter_statistics(days_back integer DEFAULT 30)
 RETURNS TABLE(total_letters bigint, pending_count bigint, approved_count bigint, rejected_count bigint, failed_count bigint, avg_review_time_hours numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM letters WHERE created_at >= NOW() - (days_back || ' days')::INTERVAL) as total_letters,
    (SELECT COUNT(*) FROM letters WHERE status IN ('pending_review', 'under_review') AND created_at >= NOW() - (days_back || ' days')::INTERVAL) as pending_count,
    (SELECT COUNT(*) FROM letters WHERE status = 'approved' AND created_at >= NOW() - (days_back || ' days')::INTERVAL) as approved_count,
    (SELECT COUNT(*) FROM letters WHERE status = 'rejected' AND created_at >= NOW() - (days_back || ' days')::INTERVAL) as rejected_count,
    (SELECT COUNT(*) FROM letters WHERE status = 'failed' AND created_at >= NOW() - (days_back || ' days')::INTERVAL) as failed_count,
    (SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (approved_at - created_at)) / 3600), 0)
     FROM letters 
     WHERE status = 'approved' 
     AND approved_at IS NOT NULL 
     AND created_at >= NOW() - (days_back || ' days')::INTERVAL
    ) as avg_review_time_hours;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_revenue_summary(months_back integer DEFAULT 12)
 RETURNS TABLE(month_year text, subscription_revenue numeric, commission_paid numeric, net_revenue numeric, new_subscriptions bigint)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH monthly_data AS (
    SELECT
      TO_CHAR(DATE_TRUNC('month', s.created_at), 'Mon YYYY') as month_year,
      DATE_TRUNC('month', s.created_at) as month_date,
      COALESCE(SUM(s.price - s.discount), 0) as subscription_revenue,
      COUNT(*) as new_subscriptions
    FROM subscriptions s
    WHERE s.created_at >= NOW() - (months_back || ' months')::INTERVAL
    GROUP BY DATE_TRUNC('month', s.created_at)
  ),
  monthly_commissions AS (
    SELECT
      DATE_TRUNC('month', c.created_at) as month_date,
      COALESCE(SUM(c.commission_amount), 0) as commission_paid
    FROM commissions c
    WHERE c.status = 'paid'
    AND c.created_at >= NOW() - (months_back || ' months')::INTERVAL
    GROUP BY DATE_TRUNC('month', c.created_at)
  )
  SELECT
    md.month_year,
    md.subscription_revenue,
    COALESCE(mc.commission_paid, 0) as commission_paid,
    md.subscription_revenue - COALESCE(mc.commission_paid, 0) as net_revenue,
    md.new_subscriptions
  FROM monthly_data md
  LEFT JOIN monthly_commissions mc ON md.month_date = mc.month_date
  ORDER BY md.month_date DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_subscription_analytics()
 RETURNS TABLE(active_subscriptions bigint, monthly_subscriptions bigint, yearly_subscriptions bigint, one_time_purchases bigint, total_credits_remaining bigint, avg_credits_per_user numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM subscriptions WHERE status = 'active') as active_subscriptions,
    (SELECT COUNT(*) FROM subscriptions WHERE status = 'active' AND plan_type = 'monthly') as monthly_subscriptions,
    (SELECT COUNT(*) FROM subscriptions WHERE status = 'active' AND plan_type = 'yearly') as yearly_subscriptions,
    (SELECT COUNT(*) FROM subscriptions WHERE status = 'active' AND plan_type = 'one_time') as one_time_purchases,
    (SELECT COALESCE(SUM(credits_remaining), 0) FROM subscriptions WHERE status = 'active') as total_credits_remaining,
    (SELECT COALESCE(AVG(credits_remaining), 0) FROM subscriptions WHERE status = 'active') as avg_credits_per_user;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.increment_usage(row_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
DECLARE
  current_count INTEGER;
BEGIN
  SELECT usage_count INTO current_count
  FROM employee_coupons
  WHERE id = row_id;
  
  RETURN current_count + 1;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.log_letter_audit(p_letter_id uuid, p_action text, p_old_status text DEFAULT NULL::text, p_new_status text DEFAULT NULL::text, p_notes text DEFAULT NULL::text, p_metadata jsonb DEFAULT NULL::jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    INSERT INTO letter_audit_trail (
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
$function$
;

CREATE OR REPLACE FUNCTION public.reset_monthly_allowances()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
    UPDATE subscriptions
    SET remaining_letters = CASE
            WHEN plan_type = 'standard_4_month' THEN 4
            WHEN plan_type = 'premium_8_month' THEN 8
            ELSE remaining_letters -- one_time doesn't reset
        END,
        last_reset_at = NOW(),
        updated_at = NOW()
    WHERE status = 'active'
      AND plan_type IN ('standard_4_month', 'premium_8_month')
      AND DATE_TRUNC('month', last_reset_at) < DATE_TRUNC('month', NOW());
END;
$function$
;

CREATE OR REPLACE FUNCTION public.validate_coupon(coupon_code text)
 RETURNS TABLE(is_valid boolean, discount_percent integer, employee_id uuid, message text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  coupon_record RECORD;
BEGIN
  SELECT * INTO coupon_record
  FROM employee_coupons
  WHERE code = UPPER(coupon_code)
  AND is_active = true;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT false, 0, NULL::UUID, 'Invalid coupon code'::TEXT;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT 
    true, 
    coupon_record.discount_percent, 
    coupon_record.employee_id, 
    'Coupon valid'::TEXT;
END;
$function$
;


  create policy "Admins can view audit log"
  on "public"."admin_audit_log"
  as permissive
  for select
  to public
using (((admin_id = ( SELECT auth.uid() AS uid)) OR (EXISTS ( SELECT 1
   FROM public.profiles
  WHERE ((profiles.id = ( SELECT auth.uid() AS uid)) AND (profiles.role = 'admin'::public.user_role))))));



  create policy "Service role can insert audit log"
  on "public"."admin_audit_log"
  as permissive
  for insert
  to public
with check ((( SELECT auth.role() AS role) = 'service_role'::text));



  create policy "Admins create commissions"
  on "public"."commissions"
  as permissive
  for insert
  to public
with check ((public.get_user_role() = 'admin'::text));



  create policy "Admins update commissions"
  on "public"."commissions"
  as permissive
  for update
  to public
using ((public.get_user_role() = 'admin'::text));



  create policy "Admins view all commissions"
  on "public"."commissions"
  as permissive
  for select
  to public
using ((public.get_user_role() = 'admin'::text));



  create policy "Employees view own commissions"
  on "public"."commissions"
  as permissive
  for select
  to public
using ((employee_id = ( SELECT auth.uid() AS uid)));



  create policy "Users can view own data access logs"
  on "public"."data_access_logs"
  as permissive
  for select
  to public
using ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Users can create deletion requests"
  on "public"."data_deletion_requests"
  as permissive
  for insert
  to public
with check ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Users can view own deletion requests"
  on "public"."data_deletion_requests"
  as permissive
  for select
  to public
using ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Users can create export requests"
  on "public"."data_export_requests"
  as permissive
  for insert
  to public
with check ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Users can view own export requests"
  on "public"."data_export_requests"
  as permissive
  for select
  to public
using ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Service role can manage email delivery log"
  on "public"."email_delivery_log"
  as permissive
  for all
  to public
using ((( SELECT auth.role() AS role) = 'service_role'::text));



  create policy "Service role can manage email queue"
  on "public"."email_queue"
  as permissive
  for all
  to public
using ((( SELECT auth.role() AS role) = 'service_role'::text));



  create policy "Admins manage all coupons"
  on "public"."employee_coupons"
  as permissive
  for all
  to public
using ((public.get_user_role() = 'admin'::text));



  create policy "Employees create own coupon"
  on "public"."employee_coupons"
  as permissive
  for insert
  to public
with check ((employee_id = ( SELECT auth.uid() AS uid)));



  create policy "Employees view own coupons"
  on "public"."employee_coupons"
  as permissive
  for select
  to public
using ((employee_id = ( SELECT auth.uid() AS uid)));



  create policy "Admins view all audit logs"
  on "public"."letter_audit_trail"
  as permissive
  for select
  to public
using ((public.get_user_role() = 'admin'::text));



  create policy "Users view own letter audit"
  on "public"."letter_audit_trail"
  as permissive
  for select
  to public
using ((EXISTS ( SELECT 1
   FROM public.letters
  WHERE ((letters.id = letter_audit_trail.letter_id) AND (letters.user_id = ( SELECT auth.uid() AS uid))))));



  create policy "Admins full letter access"
  on "public"."letters"
  as permissive
  for all
  to public
using ((public.get_user_role() = 'admin'::text));



  create policy "Subscribers create own letters"
  on "public"."letters"
  as permissive
  for insert
  to public
with check ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Subscribers update own letters"
  on "public"."letters"
  as permissive
  for update
  to public
using ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Subscribers view own letters"
  on "public"."letters"
  as permissive
  for select
  to public
using ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Employees can create payout requests"
  on "public"."payout_requests"
  as permissive
  for insert
  to public
with check ((employee_id = ( SELECT auth.uid() AS uid)));



  create policy "Employees can view own payout requests"
  on "public"."payout_requests"
  as permissive
  for select
  to public
using ((employee_id = ( SELECT auth.uid() AS uid)));



  create policy "Users can insert own privacy acceptances"
  on "public"."privacy_policy_acceptances"
  as permissive
  for insert
  to public
with check ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Users can view own privacy acceptances"
  on "public"."privacy_policy_acceptances"
  as permissive
  for select
  to public
using ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Admins can view all profiles"
  on "public"."profiles"
  as permissive
  for select
  to public
using ((public.get_user_role() = 'admin'::text));



  create policy "Users can insert own profile"
  on "public"."profiles"
  as permissive
  for insert
  to public
with check ((id = ( SELECT auth.uid() AS uid)));



  create policy "Users can update own profile"
  on "public"."profiles"
  as permissive
  for update
  to public
using ((id = ( SELECT auth.uid() AS uid)));



  create policy "Users can view own profile"
  on "public"."profiles"
  as permissive
  for select
  to public
using ((id = ( SELECT auth.uid() AS uid)));



  create policy "Admins view security audit log"
  on "public"."security_audit_log"
  as permissive
  for select
  to public
using ((public.get_user_role() = 'admin'::text));



  create policy "System can insert security events"
  on "public"."security_audit_log"
  as permissive
  for insert
  to public
with check (true);



  create policy "Admins only access security config"
  on "public"."security_config"
  as permissive
  for all
  to public
using ((public.get_user_role() = 'admin'::text));



  create policy "Admins view all subscriptions"
  on "public"."subscriptions"
  as permissive
  for select
  to public
using ((public.get_user_role() = 'admin'::text));



  create policy "Users can create subscriptions"
  on "public"."subscriptions"
  as permissive
  for insert
  to public
with check ((user_id = ( SELECT auth.uid() AS uid)));



  create policy "Users view own subscriptions"
  on "public"."subscriptions"
  as permissive
  for select
  to public
using ((user_id = ( SELECT auth.uid() AS uid)));
