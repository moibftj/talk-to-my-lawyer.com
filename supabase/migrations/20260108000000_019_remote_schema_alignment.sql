/*
  Migration: 019_remote_schema_alignment
  Description: Aligns local migrations with remote fraud/promo schema and policy definitions.
*/

-- Drop local-only policies that are not present in remote
DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all coupon usage" ON public.coupon_usage;
DROP POLICY IF EXISTS "Admins manage all subscriptions" ON public.subscriptions;
DROP POLICY IF EXISTS "Employees can view their coupon usage" ON public.coupon_usage;
DROP POLICY IF EXISTS "Public can validate active coupons" ON public.employee_coupons;
DROP POLICY IF EXISTS "System can insert audit logs" ON public.letter_audit_trail;
DROP POLICY IF EXISTS "System can insert coupon usage" ON public.coupon_usage;
DROP POLICY IF EXISTS "Users can view own coupon usage" ON public.coupon_usage;

-- Drop local-only functions not present in remote
DROP FUNCTION IF EXISTS public.cleanup_failed_letters CASCADE;
DROP FUNCTION IF EXISTS public.count_user_letters CASCADE;
DROP FUNCTION IF EXISTS public.get_user_activity_summary CASCADE;

-- Remote-only tables
CREATE TABLE IF NOT EXISTS "public"."fraud_detection_config" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "config_key" "text" NOT NULL,
    "config_value" "jsonb" NOT NULL,
    "description" "text",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"()
);
CREATE TABLE IF NOT EXISTS "public"."fraud_detection_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "coupon_code" "text" NOT NULL,
    "ip_address" "inet" NOT NULL,
    "user_agent" "text",
    "user_id" "uuid",
    "risk_score" integer NOT NULL,
    "action" "text" NOT NULL,
    "reasons" "text"[] DEFAULT '{}'::"text"[],
    "patterns" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "fraud_detection_logs_action_check" CHECK (("action" = ANY (ARRAY['allow'::"text", 'flag'::"text", 'block'::"text"]))),
    CONSTRAINT "fraud_detection_logs_risk_score_check" CHECK ((("risk_score" >= 0) AND ("risk_score" <= 100)))
);
CREATE TABLE IF NOT EXISTS "public"."promotional_code_usage" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "discount_percent" integer DEFAULT 100 NOT NULL,
    "plan_id" "text",
    "subscription_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"()
);
CREATE TABLE IF NOT EXISTS "public"."suspicious_patterns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "pattern_type" "text" NOT NULL,
    "severity" "text" NOT NULL,
    "description" "text" NOT NULL,
    "evidence" "jsonb",
    "threshold_value" numeric,
    "actual_value" numeric,
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "suspicious_patterns_pattern_type_check" CHECK (("pattern_type" = ANY (ARRAY['velocity'::"text", 'distribution'::"text", 'timing'::"text", 'behavior'::"text", 'technical'::"text"]))),
    CONSTRAINT "suspicious_patterns_severity_check" CHECK (("severity" = ANY (ARRAY['low'::"text", 'medium'::"text", 'high'::"text", 'critical'::"text"])))
);

-- Constraints for remote-only tables
DO $$ BEGIN
    ALTER TABLE ONLY "public"."fraud_detection_config"
    ADD CONSTRAINT "fraud_detection_config_config_key_key" UNIQUE ("config_key");
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE ONLY "public"."fraud_detection_config"
    ADD CONSTRAINT "fraud_detection_config_pkey" PRIMARY KEY ("id");
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE ONLY "public"."fraud_detection_logs"
    ADD CONSTRAINT "fraud_detection_logs_pkey" PRIMARY KEY ("id");
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE ONLY "public"."fraud_detection_logs"
    ADD CONSTRAINT "fraud_detection_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE ONLY "public"."promotional_code_usage"
    ADD CONSTRAINT "promotional_code_usage_pkey" PRIMARY KEY ("id");
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE ONLY "public"."promotional_code_usage"
    ADD CONSTRAINT "promotional_code_usage_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE ONLY "public"."promotional_code_usage"
    ADD CONSTRAINT "promotional_code_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;
DO $$ BEGIN
    ALTER TABLE ONLY "public"."suspicious_patterns"
    ADD CONSTRAINT "suspicious_patterns_pkey" PRIMARY KEY ("id");
EXCEPTION WHEN duplicate_object OR duplicate_table OR invalid_table_definition THEN NULL;
END $$;

-- Indexes for remote-only tables
CREATE INDEX IF NOT EXISTS "idx_fraud_logs_action" ON "public"."fraud_detection_logs" USING "btree" ("action");
CREATE INDEX IF NOT EXISTS "idx_fraud_logs_coupon_code" ON "public"."fraud_detection_logs" USING "btree" ("coupon_code");
CREATE INDEX IF NOT EXISTS "idx_fraud_logs_created_at" ON "public"."fraud_detection_logs" USING "btree" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_fraud_logs_ip_address" ON "public"."fraud_detection_logs" USING "btree" ("ip_address");
CREATE INDEX IF NOT EXISTS "idx_fraud_logs_risk_score" ON "public"."fraud_detection_logs" USING "btree" ("risk_score");
CREATE INDEX IF NOT EXISTS "idx_fraud_logs_user_id" ON "public"."fraud_detection_logs" USING "btree" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_promo_usage_code" ON "public"."promotional_code_usage" USING "btree" ("code");
CREATE INDEX IF NOT EXISTS "idx_promo_usage_user" ON "public"."promotional_code_usage" USING "btree" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_promotional_code_usage_subscription_id" ON "public"."promotional_code_usage" USING "btree" ("subscription_id");
CREATE INDEX IF NOT EXISTS "idx_suspicious_patterns_active" ON "public"."suspicious_patterns" USING "btree" ("is_active");
CREATE INDEX IF NOT EXISTS "idx_suspicious_patterns_severity" ON "public"."suspicious_patterns" USING "btree" ("severity");
CREATE INDEX IF NOT EXISTS "idx_suspicious_patterns_type" ON "public"."suspicious_patterns" USING "btree" ("pattern_type");

-- Remote-only functions
CREATE OR REPLACE FUNCTION "public"."cleanup_old_fraud_logs"("days_to_keep" integer DEFAULT 90) RETURNS integer
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$ DECLARE deleted_count INTEGER; BEGIN DELETE FROM fraud_detection_logs WHERE created_at < NOW() - INTERVAL '1 day' * days_to_keep; GET DIAGNOSTICS deleted_count = ROW_COUNT; RETURN deleted_count; END; $$;
CREATE OR REPLACE FUNCTION "public"."get_coupon_fraud_trends"("p_coupon_code" "text", "time_range_hours" integer DEFAULT 24) RETURNS TABLE("hour_bucket" timestamp with time zone, "request_count" bigint, "avg_risk_score" numeric, "blocked_count" bigint, "flagged_count" bigint, "unique_ips" bigint)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$ BEGIN RETURN QUERY SELECT date_trunc('hour', fl.created_at) as hour_bucket, COUNT(*) as request_count, ROUND(AVG(fl.risk_score), 2) as avg_risk_score, COUNT(*) FILTER (WHERE fl.action = 'block') as blocked_count, COUNT(*) FILTER (WHERE fl.action = 'flag') as flagged_count, COUNT(DISTINCT fl.ip_address) as unique_ips FROM fraud_detection_logs fl WHERE fl.coupon_code = p_coupon_code AND fl.created_at >= NOW() - INTERVAL '1 hour' * time_range_hours GROUP BY date_trunc('hour', fl.created_at) ORDER BY hour_bucket DESC; END; $$;
CREATE OR REPLACE FUNCTION "public"."get_coupon_statistics"("p_employee_id" "uuid" DEFAULT NULL::"uuid") RETURNS TABLE("employee_id" "uuid", "employee_name" "text", "total_coupons" bigint, "total_usage" bigint, "active_coupons" bigint, "total_discount_given" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$ BEGIN RETURN QUERY SELECT ec.employee_id, p.full_name as employee_name, COUNT(ec.id)::BIGINT as total_coupons, COALESCE(SUM(ec.usage_count), 0)::BIGINT as total_usage, COUNT(CASE WHEN ec.is_active = TRUE THEN 1 END)::BIGINT as active_coupons, COALESCE(SUM(cu.discount_amount), 0)::DECIMAL(10,2) as total_discount_given FROM employee_coupons ec LEFT JOIN profiles p ON ec.employee_id = p.id LEFT JOIN coupon_usage cu ON ec.id = cu.coupon_id WHERE (p_employee_id IS NULL OR ec.employee_id = p_employee_id) GROUP BY ec.employee_id, p.full_name ORDER BY total_usage DESC; END; $$;
CREATE OR REPLACE FUNCTION "public"."get_fraud_statistics"("time_range_hours" integer DEFAULT 24) RETURNS TABLE("total_checks" bigint, "blocked_requests" bigint, "flagged_requests" bigint, "allowed_requests" bigint, "avg_risk_score" numeric, "high_risk_count" bigint, "medium_risk_count" bigint, "low_risk_count" bigint, "unique_coupons" bigint, "unique_ips" bigint)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$ BEGIN RETURN QUERY SELECT COUNT(*) as total_checks, COUNT(*) FILTER (WHERE action = 'block') as blocked_requests, COUNT(*) FILTER (WHERE action = 'flag') as flagged_requests, COUNT(*) FILTER (WHERE action = 'allow') as allowed_requests, ROUND(AVG(risk_score), 2) as avg_risk_score, COUNT(*) FILTER (WHERE risk_score >= 75) as high_risk_count, COUNT(*) FILTER (WHERE risk_score >= 50 AND risk_score < 75) as medium_risk_count, COUNT(*) FILTER (WHERE risk_score >= 25 AND risk_score < 50) as low_risk_count, COUNT(DISTINCT coupon_code) as unique_coupons, COUNT(DISTINCT ip_address) as unique_ips FROM fraud_detection_logs WHERE created_at >= NOW() - INTERVAL '1 hour' * time_range_hours; END; $$;
CREATE OR REPLACE FUNCTION "public"."get_top_suspicious_ips"("limit_count" integer DEFAULT 10, "time_range_hours" integer DEFAULT 24) RETURNS TABLE("ip_address" "inet", "request_count" bigint, "avg_risk_score" numeric, "blocked_count" bigint, "flagged_count" bigint, "unique_coupons" bigint)
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$ BEGIN RETURN QUERY SELECT fl.ip_address, COUNT(*) as request_count, ROUND(AVG(fl.risk_score), 2) as avg_risk_score, COUNT(*) FILTER (WHERE fl.action = 'block') as blocked_count, COUNT(*) FILTER (WHERE fl.action = 'flag') as flagged_count, COUNT(DISTINCT fl.coupon_code) as unique_coupons FROM fraud_detection_logs fl WHERE fl.created_at >= NOW() - INTERVAL '1 hour' * time_range_hours GROUP BY fl.ip_address ORDER BY blocked_count DESC, avg_risk_score DESC LIMIT limit_count; END; $$;
CREATE OR REPLACE FUNCTION "public"."has_used_free_trial"("user_uuid" "uuid") RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  letter_count INT;
  trial_flag BOOLEAN;
BEGIN
  -- Check the flag first
  SELECT free_trial_used INTO trial_flag
  FROM profiles
  WHERE id = user_uuid;
  
  IF trial_flag = true THEN
    RETURN true;
  END IF;
  
  -- Check if user has any letters (means they used free trial)
  SELECT COUNT(*) INTO letter_count
  FROM letters
  WHERE user_id = user_uuid;
  
  RETURN letter_count > 0;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."is_system_admin"() RETURNS boolean
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'admin'::user_role
    AND admin_sub_role = 'super_admin'::admin_sub_role
  );
END;
$$;
CREATE OR REPLACE FUNCTION "public"."mark_free_trial_used"("user_uuid" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
  UPDATE profiles
  SET free_trial_used = true
  WHERE id = user_uuid;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."sanitize_input"("input_text" "text") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_catalog'
    AS $$
BEGIN
    -- Remove potentially dangerous characters using safe regex patterns
    RETURN regexp_replace(
        regexp_replace(input_text, '[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', 'g'),
        '[<>]', '', 'g'
    );
END;
$$;
CREATE OR REPLACE FUNCTION "public"."update_coupon_usage_count"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
BEGIN
    -- Increment the usage count on the coupon
    UPDATE employee_coupons
    SET usage_count = usage_count + 1
    WHERE id = NEW.coupon_id;

    RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION "public"."update_fraud_detection_config_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION "public"."update_suspicious_patterns_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    SET "search_path" TO 'public'
    AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION "public"."validate_promotional_code"("code_input" "text") RETURNS TABLE("is_valid" boolean, "discount_percent" integer, "is_promotional" boolean, "employee_id" "uuid")
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
  promo_codes TEXT[] := ARRAY['TALK3', 'LAUNCH50', 'BETA100', 'VIP100'];
BEGIN
  -- Check if it's a known promotional code
  IF UPPER(code_input) = ANY(promo_codes) THEN
    RETURN QUERY SELECT 
      true AS is_valid,
      CASE UPPER(code_input)
        WHEN 'TALK3' THEN 100
        WHEN 'BETA100' THEN 100
        WHEN 'VIP100' THEN 100
        WHEN 'LAUNCH50' THEN 50
        ELSE 0
      END AS discount_percent,
      true AS is_promotional,
      NULL::UUID AS employee_id;
    RETURN;
  END IF;
  
  -- Check employee_coupons table
  RETURN QUERY SELECT 
    COALESCE(ec.is_active, false) AS is_valid,
    COALESCE(ec.discount_percent, 0) AS discount_percent,
    (ec.employee_id IS NULL) AS is_promotional,
    ec.employee_id
  FROM employee_coupons ec
  WHERE UPPER(ec.code) = UPPER(code_input)
  LIMIT 1;
  
  -- If no rows returned, return invalid
  IF NOT FOUND THEN
    RETURN QUERY SELECT 
      false AS is_valid,
      0 AS discount_percent,
      false AS is_promotional,
      NULL::UUID AS employee_id;
  END IF;
END;
$$;

-- Remote-only triggers
DROP TRIGGER IF EXISTS trigger_update_coupon_usage_count ON public.coupon_usage;
CREATE OR REPLACE TRIGGER "trigger_update_coupon_usage_count" AFTER INSERT ON "public"."coupon_usage" FOR EACH ROW EXECUTE FUNCTION "public"."update_coupon_usage_count"();
DROP TRIGGER IF EXISTS update_fraud_detection_config_updated_at ON public.fraud_detection_config;
CREATE OR REPLACE TRIGGER "update_fraud_detection_config_updated_at" BEFORE UPDATE ON "public"."fraud_detection_config" FOR EACH ROW EXECUTE FUNCTION "public"."update_fraud_detection_config_updated_at"();
DROP TRIGGER IF EXISTS update_suspicious_patterns_updated_at ON public.suspicious_patterns;
CREATE OR REPLACE TRIGGER "update_suspicious_patterns_updated_at" BEFORE UPDATE ON "public"."suspicious_patterns" FOR EACH ROW EXECUTE FUNCTION "public"."update_suspicious_patterns_updated_at"();

-- Remote policy definitions
DROP POLICY IF EXISTS "Admins can insert fraud logs" ON public.fraud_detection_logs;
CREATE POLICY "Admins can insert fraud logs" ON "public"."fraud_detection_logs" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"public"."user_role")))));
DROP POLICY IF EXISTS "Admins can manage fraud detection config" ON public.fraud_detection_config;
CREATE POLICY "Admins can manage fraud detection config" ON "public"."fraud_detection_config" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"public"."user_role")))));
DROP POLICY IF EXISTS "Admins can manage profiles" ON public.profiles;
CREATE POLICY "Admins can manage profiles" ON "public"."profiles" USING (("public"."get_user_role"() = 'admin'::"text"));
DROP POLICY IF EXISTS "Admins can manage suspicious patterns" ON public.suspicious_patterns;
CREATE POLICY "Admins can manage suspicious patterns" ON "public"."suspicious_patterns" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"public"."user_role")))));
DROP POLICY IF EXISTS "Admins can view all fraud logs" ON public.fraud_detection_logs;
CREATE POLICY "Admins can view all fraud logs" ON "public"."fraud_detection_logs" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"public"."user_role")))));
DROP POLICY IF EXISTS "Admins can view all promo usage" ON public.promotional_code_usage;
CREATE POLICY "Admins can view all promo usage" ON "public"."promotional_code_usage" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"public"."user_role")))));
DROP POLICY IF EXISTS "Admins can view fraud detection config" ON public.fraud_detection_config;
CREATE POLICY "Admins can view fraud detection config" ON "public"."fraud_detection_config" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"public"."user_role")))));
DROP POLICY IF EXISTS "Admins can view suspicious patterns" ON public.suspicious_patterns;
CREATE POLICY "Admins can view suspicious patterns" ON "public"."suspicious_patterns" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"public"."user_role")))));
DROP POLICY IF EXISTS "Admins manage all coupon usage" ON public.coupon_usage;
CREATE POLICY "Admins manage all coupon usage" ON "public"."coupon_usage" USING ((EXISTS ( SELECT 1
   FROM "public"."profiles"
  WHERE (("profiles"."id" = ( SELECT "auth"."uid"() AS "uid")) AND ("profiles"."role" = 'admin'::"public"."user_role")))));
DROP POLICY IF EXISTS "Block employees from letters" ON public.letters;
CREATE POLICY "Block employees from letters" ON "public"."letters" USING (("public"."get_user_role"() <> 'employee'::"text"));
DROP POLICY IF EXISTS "Employees view coupon usage from their codes" ON public.coupon_usage;
CREATE POLICY "Employees view coupon usage from their codes" ON "public"."coupon_usage" FOR SELECT USING (("employee_id" = ( SELECT "auth"."uid"() AS "uid")));
DROP POLICY IF EXISTS "Public can validate coupons" ON public.employee_coupons;
CREATE POLICY "Public can validate coupons" ON "public"."employee_coupons" FOR SELECT USING (("is_active" = true));
DROP POLICY IF EXISTS "Service can insert coupon usage" ON public.coupon_usage;
CREATE POLICY "Service can insert coupon usage" ON "public"."coupon_usage" FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Service can insert promo usage" ON public.promotional_code_usage;
CREATE POLICY "Service can insert promo usage" ON "public"."promotional_code_usage" FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Service role can manage fraud config" ON public.fraud_detection_config;
CREATE POLICY "Service role can manage fraud config" ON "public"."fraud_detection_config" USING ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));
DROP POLICY IF EXISTS "Service role can manage suspicious patterns" ON public.suspicious_patterns;
CREATE POLICY "Service role can manage suspicious patterns" ON "public"."suspicious_patterns" USING ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));
DROP POLICY IF EXISTS "Service role full access to fraud logs" ON public.fraud_detection_logs;
CREATE POLICY "Service role full access to fraud logs" ON "public"."fraud_detection_logs" USING ((( SELECT "auth"."role"() AS "role") = 'service_role'::"text"));
DROP POLICY IF EXISTS "Users can view own promo usage" ON public.promotional_code_usage;
CREATE POLICY "Users can view own promo usage" ON "public"."promotional_code_usage" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));
DROP POLICY IF EXISTS "Users view own coupon usage" ON public.coupon_usage;
CREATE POLICY "Users view own coupon usage" ON "public"."coupon_usage" FOR SELECT USING (("user_id" = ( SELECT "auth"."uid"() AS "uid")));

-- Enable RLS on remote-only tables
ALTER TABLE "public"."fraud_detection_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."fraud_detection_logs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."promotional_code_usage" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."suspicious_patterns" ENABLE ROW LEVEL SECURITY;

-- Grants for remote-only tables
GRANT ALL ON TABLE "public"."fraud_detection_config" TO "anon";
GRANT ALL ON TABLE "public"."fraud_detection_config" TO "authenticated";
GRANT ALL ON TABLE "public"."fraud_detection_config" TO "service_role";
GRANT ALL ON TABLE "public"."fraud_detection_logs" TO "anon";
GRANT ALL ON TABLE "public"."fraud_detection_logs" TO "authenticated";
GRANT ALL ON TABLE "public"."fraud_detection_logs" TO "service_role";
GRANT ALL ON TABLE "public"."promotional_code_usage" TO "anon";
GRANT ALL ON TABLE "public"."promotional_code_usage" TO "authenticated";
GRANT ALL ON TABLE "public"."promotional_code_usage" TO "service_role";
GRANT ALL ON TABLE "public"."suspicious_patterns" TO "anon";
GRANT ALL ON TABLE "public"."suspicious_patterns" TO "authenticated";
GRANT ALL ON TABLE "public"."suspicious_patterns" TO "service_role";

-- Grants for remote-only functions
GRANT ALL ON FUNCTION "public"."cleanup_old_fraud_logs"("days_to_keep" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."cleanup_old_fraud_logs"("days_to_keep" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."cleanup_old_fraud_logs"("days_to_keep" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."get_coupon_fraud_trends"("p_coupon_code" "text", "time_range_hours" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_coupon_fraud_trends"("p_coupon_code" "text", "time_range_hours" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_coupon_fraud_trends"("p_coupon_code" "text", "time_range_hours" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."get_coupon_statistics"("p_employee_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_coupon_statistics"("p_employee_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_coupon_statistics"("p_employee_id" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."get_fraud_statistics"("time_range_hours" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_fraud_statistics"("time_range_hours" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_fraud_statistics"("time_range_hours" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."get_top_suspicious_ips"("limit_count" integer, "time_range_hours" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."get_top_suspicious_ips"("limit_count" integer, "time_range_hours" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_top_suspicious_ips"("limit_count" integer, "time_range_hours" integer) TO "service_role";
GRANT ALL ON FUNCTION "public"."has_used_free_trial"("user_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."has_used_free_trial"("user_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."has_used_free_trial"("user_uuid" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."is_system_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_system_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_system_admin"() TO "service_role";
GRANT ALL ON FUNCTION "public"."mark_free_trial_used"("user_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."mark_free_trial_used"("user_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."mark_free_trial_used"("user_uuid" "uuid") TO "service_role";
GRANT ALL ON FUNCTION "public"."sanitize_input"("input_text" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."sanitize_input"("input_text" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sanitize_input"("input_text" "text") TO "service_role";
GRANT ALL ON FUNCTION "public"."update_coupon_usage_count"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_coupon_usage_count"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_coupon_usage_count"() TO "service_role";
GRANT ALL ON FUNCTION "public"."update_fraud_detection_config_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_fraud_detection_config_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_fraud_detection_config_updated_at"() TO "service_role";
GRANT ALL ON FUNCTION "public"."update_suspicious_patterns_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_suspicious_patterns_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_suspicious_patterns_updated_at"() TO "service_role";
GRANT ALL ON FUNCTION "public"."validate_promotional_code"("code_input" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."validate_promotional_code"("code_input" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."validate_promotional_code"("code_input" "text") TO "service_role";
