#!/usr/bin/env node

/**
 * Simple script to test email configuration
 * Run: node check-email-config.js
 */

console.log('📧 Checking Email Configuration...\n')

// Check if .env.local exists
const fs = require('fs')
const path = require('path')

const envPath = path.join(process.cwd(), '.env.local')

if (!fs.existsSync(envPath)) {
  console.error('❌ .env.local file not found!')
  console.log('\n💡 Create .env.local file with:')
  console.log('   RESEND_API_KEY=re_your_api_key_here')
  console.log('   EMAIL_FROM=onboarding@resend.dev')
  process.exit(1)
}

// Load environment variables
require('dotenv').config({ path: envPath })

const supabasePublicKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY

const checks = {
  'RESEND_API_KEY': { value: process.env.RESEND_API_KEY, sensitive: true },
  'EMAIL_FROM': { value: process.env.EMAIL_FROM, sensitive: false },
  'NEXT_PUBLIC_SUPABASE_URL': { value: process.env.NEXT_PUBLIC_SUPABASE_URL, sensitive: false },
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | NEXT_PUBLIC_SUPABASE_ANON_KEY': { value: supabasePublicKey, sensitive: false },
  'SUPABASE_SECRET_KEY | SUPABASE_SERVICE_ROLE_KEY': { value: supabaseServiceKey, sensitive: true },
}

let allGood = true

console.log('Environment Variables Status:\n')

for (const [key, { value, sensitive }] of Object.entries(checks)) {
  const status = value ? '✅' : '❌'
  const displayValue = value
    ? (sensitive ? 'SET' : (value.substring(0, 10) + '...' + value.substring(value.length - 4)))
    : 'NOT SET'
  
  console.log(`${status} ${key}: ${displayValue}`)
  
  if (!value) {
    allGood = false
  }
}

console.log('\n' + '='.repeat(50))

if (!allGood) {
  console.log('\n❌ Some environment variables are missing!')
  console.log('\n📝 Steps to fix:')
  console.log('   1. Open .env.local file')
  console.log('   2. Add missing environment variables')
  console.log('   3. Get Resend API key from https://resend.com/api-keys')
  console.log('   4. Get Supabase keys from your project settings')
  process.exit(1)
}

console.log('\n✅ All required environment variables are set!')
console.log('\n📧 Email configuration looks good!')
console.log('\n💡 Next steps:')
console.log('   1. Run: pnpm dev')
console.log('   2. Sign up a new user')
console.log('   3. Check email inbox for welcome message')
console.log('\n   Or test directly with: node test-email-send.js')
