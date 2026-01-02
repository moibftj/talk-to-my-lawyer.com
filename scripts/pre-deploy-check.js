#!/usr/bin/env node

/**
 * Pre-Deployment Production Check
 *
 * This script validates that the application is ready for production deployment.
 * It should be run as part of CI/CD pipeline before deploying to production.
 *
 * Usage: node scripts/pre-deploy-check.js
 */

const fs = require('fs')
const path = require('path')

console.log('\n=== Pre-Deployment Production Check ===\n')

let hasErrors = false
let hasWarnings = false

// 1. Check for TypeScript build errors disabled
console.log('1. Checking Next.js configuration...')
const nextConfigPath = path.join(process.cwd(), 'next.config.mjs')
const nextConfigContent = fs.readFileSync(nextConfigPath, 'utf-8')

if (nextConfigContent.includes('ignoreBuildErrors: true')) {
  console.error('  [ERROR] TypeScript build errors are being ignored in next.config.mjs')
  console.error('  [ERROR] This must be set to false for production deployment')
  hasErrors = true
} else if (nextConfigContent.includes('ignoreBuildErrors: false')) {
  console.log('  [OK] TypeScript build errors are NOT being ignored')
} else {
  console.log('  [WARN] Could not determine TypeScript build error configuration')
  hasWarnings = true
}

// 2. Check for test mode in production
console.log('\n2. Checking test mode configuration...')
const testModeEnabled = process.env.ENABLE_TEST_MODE === 'true'
const isProduction = process.env.NODE_ENV === 'production'

if (isProduction && testModeEnabled) {
  console.error('  [CRITICAL] ENABLE_TEST_MODE is true in production environment!')
  console.error('  [CRITICAL] This bypasses important security and payment checks')
  console.error('  [CRITICAL] Deployment should be ABORTED')
  hasErrors = true
} else if (!isProduction && testModeEnabled) {
  console.log('  [OK] Test mode enabled (appropriate for non-production)')
} else {
  console.log('  [OK] Test mode is disabled')
}

// 3. Verify git status is clean (if in git repo)
console.log('\n3. Checking git status...')
const gitDir = path.join(process.cwd(), '.git')
if (fs.existsSync(gitDir)) {
  const { execSync } = require('child_process')
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf-8' })
    if (status.trim()) {
      console.log('  [WARN] Git working directory is not clean')
      console.log('  [WARN] Uncommitted changes may be deployed')
      hasWarnings = true
    } else {
      console.log('  [OK] Git working directory is clean')
    }
  } catch (error) {
    console.log('  [INFO] Could not check git status')
  }
} else {
  console.log('  [INFO] Not a git repository, skipping git check')
}

// 4. Check for committed secrets
console.log('\n4. Checking for potential secrets in files...')
const dangerousPatterns = [
  { pattern: /sk_live_[a-zA-Z0-9]{24,}/, name: 'Stripe live key' },
  { pattern: /sk_test_[a-zA-Z0-9]{24,}/, name: 'Stripe test key' },
  { pattern: /xoxb-[0-9]{10,}-[0-9]{10,}-[a-zA-Z0-9]{24}/, name: 'Slack token' },
  { pattern: /AIza[a-zA-Z0-9_-]{35}/, name: 'Google API key' },
  { pattern: /AKIA[0-9A-Z]{16}/, name: 'AWS access key' },
  { pattern: /postgresql:\/\/[a-zA-Z0-9_\-:@.\/]+/, name: 'Database connection string' },
]

const filesToCheck = [
  'next.config.mjs',
  'vercel.json',
  'package.json',
  'tsconfig.json',
]

let foundSecrets = false
for (const file of filesToCheck) {
  const filePath = path.join(process.cwd(), file)
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf-8')
    for (const { pattern, name } of dangerousPatterns) {
      if (pattern.test(content)) {
        console.error(`  [ERROR] Potential ${name} found in ${file}`)
        hasErrors = true
        foundSecrets = true
      }
    }
  }
}

if (!foundSecrets) {
  console.log('  [OK] No secrets detected in configuration files')
}

// 5. Check required environment variables for production
console.log('\n5. Checking production environment variables...')
const requiredProductionVars = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'OPENAI_API_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'STRIPE_SECRET_KEY',
  'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
  'STRIPE_WEBHOOK_SECRET',
  'ADMIN_EMAIL',
  'ADMIN_PORTAL_KEY',
  'CRON_SECRET',
  'NEXT_PUBLIC_SITE_URL',
]

if (isProduction) {
  const missing = requiredProductionVars.filter(varName => !process.env[varName])
  if (missing.length > 0) {
    console.error('  [ERROR] Missing required production variables:')
    missing.forEach(varName => console.error(`    - ${varName}`))
    hasErrors = true
  } else {
    console.log('  [OK] All required production variables are set')
  }
} else {
  console.log('  [INFO] Skipping production variable check (not in production mode)')
}

// 6. Summary
console.log('\n=== Check Summary ===')
console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
console.log(`Test Mode: ${testModeEnabled ? 'ENABLED' : 'disabled'}`)

if (hasErrors) {
  console.log('\n[FAILED] Pre-deployment check failed with errors')
  console.log('[FAILED] Please address the errors above before deploying')
  process.exit(1)
} else if (hasWarnings) {
  console.log('\n[PASSED WITH WARNINGS] Review warnings before deploying')
  process.exit(0)
} else {
  console.log('\n[PASSED] Pre-deployment check successful')
  console.log('[READY] Safe to proceed with deployment')
  process.exit(0)
}
