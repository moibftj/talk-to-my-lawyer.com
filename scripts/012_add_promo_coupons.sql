-- Add promotional coupon codes
-- These are special promo codes not tied to any employee

-- TALK3: 100% discount code for testing/VIP access
INSERT INTO employee_coupons (
  employee_id, 
  code, 
  discount_percent, 
  is_active,
  usage_count
) VALUES (
  NULL,  -- No employee (promo code)
  'TALK3',
  100,
  true,
  0
) ON CONFLICT (code) DO UPDATE SET
  discount_percent = 100,
  is_active = true;

-- Additional promo codes can be added here
-- Example: 
-- INSERT INTO employee_coupons (employee_id, code, discount_percent, is_active)
-- VALUES (NULL, 'LAUNCH50', 50, true)
-- ON CONFLICT (code) DO UPDATE SET discount_percent = 50, is_active = true;

