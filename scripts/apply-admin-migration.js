#!/usr/bin/env node
/**
 * Apply admin role separation migration
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY (preferred) or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

async function runMigration() {
  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    console.log('🚀 Applying admin role separation migration...');

    // Read the migration file
    const migrationPath = path.join(__dirname, '../supabase/migrations/20250102000000_013_admin_role_separation.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: migrationSQL });

    if (error) {
      // If rpc doesn't exist, try direct SQL execution
      console.log('💡 Trying direct SQL execution...');
      const { error: directError } = await supabase.from('profiles').select('*').limit(1);
      if (directError) {
        console.error('❌ Database connection failed:', directError.message);
        process.exit(1);
      }
      
      console.log('✅ Database connection successful!');
      console.log('📝 Migration SQL ready - please run it manually in Supabase SQL Editor');
      console.log('🔗 Go to: https://supabase.com/dashboard/project/nomiiqzxaxyxnxndvkbe/sql/new');
      console.log('📋 Copy and paste the migration SQL from:');
      console.log('   supabase/migrations/20250102000000_013_admin_role_separation.sql');
      
    } else {
      console.log('✅ Migration applied successfully!');
    }

    console.log('🎯 Next steps:');
    console.log('   1. Create system admin: npx dotenv-cli -e .env.local -- npx tsx scripts/create-additional-admin.ts system@test.com Pass123! --role=system');
    console.log('   2. Create attorney admin: npx dotenv-cli -e .env.local -- npx tsx scripts/create-additional-admin.ts attorney@test.com Pass123! --role=attorney');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
