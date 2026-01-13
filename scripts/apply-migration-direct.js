#!/usr/bin/env node
/**
 * Apply admin role separation migration using direct PostgreSQL connection
 */

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
const dns = require('dns');

// Force IPv4 to avoid ENETUNREACH on IPv6
dns.setDefaultResultOrder('ipv4first');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL;

if (!connectionString) {
  console.error('❌ Missing DATABASE_URL (or SUPABASE_DB_URL) in the environment.');
  console.error('   Example: DATABASE_URL=postgresql://postgres:<password>@db.<project>.supabase.co:5432/postgres');
  process.exit(1);
}

async function runMigration() {
  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('🚀 Connecting to PostgreSQL...');
    await client.connect();
    console.log('✅ Connected to database');

    console.log('📝 Reading migration SQL...');
    const migrationPath = path.join(__dirname, '../supabase/migrations/20250102000000_013_admin_role_separation.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('⚡ Executing migration...');
    await client.query(migrationSQL);
    
    console.log('✅ Admin role separation migration applied successfully!');
    
    // Verify the migration
    const result = await client.query('SELECT column_name FROM information_schema.columns WHERE table_name = \'profiles\' AND column_name = \'admin_sub_role\'');
    if (result.rows.length > 0) {
      console.log('✅ Verified: admin_sub_role column exists');
    }

    console.log('🎯 Next steps:');
    console.log('   1. Create system admin: npx dotenv-cli -e .env.local -- npx tsx scripts/create-additional-admin.ts <email> <password> --role=system');
    console.log('   2. Create attorney admin: npx dotenv-cli -e .env.local -- npx tsx scripts/create-additional-admin.ts <email> <password> --role=attorney');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
