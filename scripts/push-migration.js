#!/usr/bin/env node
/**
 * Script to push SQL migrations to remote Supabase database
 * Usage: node scripts/push-migration.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Read database URL from environment or use direct value
const DATABASE_URL = process.env.DATABASE_URL || 
  'postgresql://postgres:fIYe2RoUEKxTsxff@db.nomiiqzxaxyxnxndvkbe.supabase.co:5432/postgres';

// Migration file to run
const migrationFile = process.argv[2] || 'scripts/023_fix_employee_coupons.sql';

async function runMigration() {
  try {
    const sqlPath = path.resolve(process.cwd(), migrationFile);
    
    if (!fs.existsSync(sqlPath)) {
      console.error(`❌ Migration file not found: ${sqlPath}`);
      process.exit(1);
    }
    
    console.log(`📦 Running migration: ${migrationFile}`);
    console.log(`🔗 Connecting to database...`);
    
    // Use psql to execute the SQL file
    const command = `psql "${DATABASE_URL}" -f "${sqlPath}"`;
    
    const output = execSync(command, { 
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    console.log(`✅ Migration completed successfully!\n`);
    console.log('Output:', output);
    
  } catch (error) {
    console.error(`❌ Migration failed:`, error.message);
    if (error.stderr) {
      console.error('Error details:', error.stderr);
    }
    process.exit(1);
  }
}

runMigration();
