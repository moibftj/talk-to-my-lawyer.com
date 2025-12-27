#!/usr/bin/env node
/**
 * Direct PostgreSQL migration runner
 * Run with: node scripts/run-direct-migration.js
 */

const { Client } = require('pg');
const dns = require('dns');

// Force IPv4 to avoid ENETUNREACH on IPv6
dns.setDefaultResultOrder('ipv4first');

const DATABASE_URL = 'postgresql://postgres:fIYe2RoUEKxTsxff@db.nomiiqzxaxyxnxndvkbe.supabase.co:5432/postgres';

const migrationSQL = `
-- Fix employee coupon auto-generation system
-- Step 1: Add unique constraint on employee_id (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'employee_coupons_employee_id_key'
  ) THEN
    ALTER TABLE employee_coupons ADD CONSTRAINT employee_coupons_employee_id_key UNIQUE (employee_id);
  END IF;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- Step 2: Create coupons for existing employees who don't have one
INSERT INTO employee_coupons (employee_id, code, discount_percent, is_active)
SELECT 
  p.id,
  'EMP-' || UPPER(SUBSTR(MD5(p.id::TEXT || RANDOM()::TEXT || NOW()::TEXT), 1, 6)),
  20,
  true
FROM profiles p
WHERE p.role = 'employee'
  AND NOT EXISTS (
    SELECT 1 FROM employee_coupons ec WHERE ec.employee_id = p.id
  )
ON CONFLICT (employee_id) DO NOTHING;

-- Step 3: Update the trigger function
CREATE OR REPLACE FUNCTION create_employee_coupon()
RETURNS TRIGGER AS $$
DECLARE
  coupon_code TEXT;
  attempts INT := 0;
  max_attempts INT := 5;
BEGIN
  IF NEW.role = 'employee' THEN
    IF EXISTS (SELECT 1 FROM employee_coupons WHERE employee_id = NEW.id) THEN
      RETURN NEW;
    END IF;

    LOOP
      coupon_code := 'EMP-' || UPPER(SUBSTR(MD5(NEW.id::TEXT || RANDOM()::TEXT || NOW()::TEXT || attempts::TEXT), 1, 6));
      
      BEGIN
        INSERT INTO employee_coupons (employee_id, code, discount_percent, is_active)
        VALUES (NEW.id, coupon_code, 20, true);
        EXIT;
      EXCEPTION 
        WHEN unique_violation THEN
          attempts := attempts + 1;
          IF attempts >= max_attempts THEN
            EXIT;
          END IF;
        WHEN OTHERS THEN
          EXIT;
      END;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Step 4: Ensure trigger exists
DROP TRIGGER IF EXISTS trigger_create_employee_coupon ON profiles;
CREATE TRIGGER trigger_create_employee_coupon
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_employee_coupon();

-- Step 5: Handle role updates
CREATE OR REPLACE FUNCTION handle_employee_role_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'employee' AND (OLD.role IS NULL OR OLD.role != 'employee') THEN
    IF NOT EXISTS (SELECT 1 FROM employee_coupons WHERE employee_id = NEW.id) THEN
      INSERT INTO employee_coupons (employee_id, code, discount_percent, is_active)
      VALUES (
        NEW.id,
        'EMP-' || UPPER(SUBSTR(MD5(NEW.id::TEXT || RANDOM()::TEXT || NOW()::TEXT), 1, 6)),
        20,
        true
      )
      ON CONFLICT (employee_id) DO NOTHING;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trigger_handle_employee_role_change ON profiles;
CREATE TRIGGER trigger_handle_employee_role_change
  AFTER UPDATE OF role ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION handle_employee_role_change();
`;

async function runMigration() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🔗 Connecting to Supabase PostgreSQL...');
    await client.connect();
    console.log('✅ Connected!\n');

    // Check current state
    const beforeCheck = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM profiles WHERE role = 'employee') as total_employees,
        (SELECT COUNT(*) FROM employee_coupons) as total_coupons
    `);
    console.log('📊 Before migration:');
    console.log(`   Employees: ${beforeCheck.rows[0].total_employees}`);
    console.log(`   Coupons: ${beforeCheck.rows[0].total_coupons}\n`);

    console.log('🚀 Running migration...\n');
    await client.query(migrationSQL);
    console.log('✅ Migration completed!\n');

    // Check after state
    const afterCheck = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM profiles WHERE role = 'employee') as total_employees,
        (SELECT COUNT(*) FROM employee_coupons) as total_coupons
    `);
    console.log('📊 After migration:');
    console.log(`   Employees: ${afterCheck.rows[0].total_employees}`);
    console.log(`   Coupons: ${afterCheck.rows[0].total_coupons}\n`);

    // List employees and their coupons
    const employeeCoupons = await client.query(`
      SELECT p.email, p.full_name, ec.code, ec.discount_percent, ec.is_active
      FROM profiles p
      LEFT JOIN employee_coupons ec ON ec.employee_id = p.id
      WHERE p.role = 'employee'
      ORDER BY p.created_at DESC
      LIMIT 10
    `);
    
    if (employeeCoupons.rows.length > 0) {
      console.log('👥 Employee coupons:');
      employeeCoupons.rows.forEach(row => {
        console.log(`   ${row.email}: ${row.code || 'NO COUPON'} (${row.discount_percent}% off, active: ${row.is_active})`);
      });
    }

    console.log('\n🎉 All done!');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

runMigration().catch(console.error);
