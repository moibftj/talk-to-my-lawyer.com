-- Auto-generate employee coupon when a new employee profile is created
-- First ensure we have a unique constraint on employee_id to prevent duplicates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employee_coupons_employee_id_key'
  ) THEN
    ALTER TABLE employee_coupons ADD CONSTRAINT employee_coupons_employee_id_key UNIQUE (employee_id);
  END IF;
EXCEPTION WHEN duplicate_object THEN
  -- Constraint already exists, ignore
  NULL;
END $$;

CREATE OR REPLACE FUNCTION create_employee_coupon()
RETURNS TRIGGER AS $$
DECLARE
  coupon_code TEXT;
  attempts INT := 0;
  max_attempts INT := 5;
BEGIN
  -- Only create coupon for employee role
  IF NEW.role = 'employee' THEN
    -- Generate unique coupon code with retry logic
    LOOP
      coupon_code := 'EMP-' || UPPER(SUBSTR(MD5(NEW.id::TEXT || RANDOM()::TEXT || NOW()::TEXT), 1, 6));
      
      BEGIN
        INSERT INTO employee_coupons (employee_id, code, discount_percent, is_active)
        VALUES (
          NEW.id,
          coupon_code,
          20,
          true
        );
        -- Success, exit loop
        EXIT;
      EXCEPTION WHEN unique_violation THEN
        attempts := attempts + 1;
        IF attempts >= max_attempts THEN
          RAISE WARNING 'Failed to generate unique coupon code for employee % after % attempts', NEW.id, max_attempts;
          EXIT;
        END IF;
        -- Continue loop to try again with new code
      END;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to auto-generate coupon on new employee
DROP TRIGGER IF EXISTS trigger_create_employee_coupon ON profiles;
CREATE TRIGGER trigger_create_employee_coupon
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_employee_coupon();