#!/usr/bin/env node

const requiredEnvVars = {
  critical: [
    { name: 'NEXT_PUBLIC_SUPABASE_URL', description: 'Supabase project URL' },
    {
      name: ['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'],
      description: 'Supabase publishable key (preferred) or anon key'
    },
    { name: 'OPENAI_API_KEY', description: 'OpenAI API key for letter generation' },
  ],
  production: [
    {
      name: ['SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY'],
      description: 'Supabase secret key (preferred) or service role key (server-only)',
      sensitive: true
    },
    { name: 'STRIPE_SECRET_KEY', description: 'Stripe secret key (server-only)' },
    { name: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', description: 'Stripe publishable key' },
    { name: 'STRIPE_WEBHOOK_SECRET', description: 'Stripe webhook secret (server-only)' },
    { name: 'ADMIN_EMAIL', description: 'Admin email address' },
    { name: 'ADMIN_PORTAL_KEY', description: 'Admin portal access key (server-only)' },
    { name: 'CRON_SECRET', description: 'Cron job authentication secret (server-only)' },
    { name: 'NEXT_PUBLIC_SITE_URL', description: 'Production site URL for email links' },
  ],
  email: [
    { name: 'RESEND_API_KEY', description: 'Resend API key for email delivery (server-only)' },
    { name: 'SENDGRID_API_KEY', description: 'SendGrid API key for emails (server-only, alternative)' },
    { name: 'BREVO_API_KEY', description: 'Brevo API key for emails (server-only, alternative)' },
    { name: 'EMAIL_FROM', description: 'From email address for transactional emails' },
  ],
  rateLimit: [
    { name: 'KV_REST_API_URL', description: 'Upstash Redis URL for rate limiting (server-only)' },
    { name: 'KV_REST_API_TOKEN', description: 'Upstash Redis token (server-only)' },
  ],
  optional: [
    { name: 'NEXT_PUBLIC_APP_URL', description: 'Application URL (legacy, use NEXT_PUBLIC_SITE_URL)', default: 'http://localhost:3000' },
    { name: 'ENABLE_TEST_MODE', description: 'Enable test mode (MUST be false in production)', default: 'false' },
  ],
}

function formatEnvLabel(name) {
  return Array.isArray(name) ? name.join(' | ') : name
}

function resolveEnvValue(name) {
  const names = Array.isArray(name) ? name : [name]
  for (const key of names) {
    const value = process.env[key]
    if (value) {
      return { value, resolvedName: key }
    }
  }
  return { value: null, resolvedName: names[0] }
}

function maskValue(value, prefixLength, sensitive) {
  if (sensitive) {
    return 'SET'
  }
  const prefix = value.substring(0, prefixLength)
  return value.length > prefixLength ? `${prefix}...` : prefix
}

function validateEnv() {
  console.log('\n=== Environment Validation ===\n')

  const isProduction = process.env.NODE_ENV === 'production'
  const testMode = process.env.ENABLE_TEST_MODE === 'true'
  const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true'

  let hasErrors = false
  let hasWarnings = false

  // WARNING: Test mode should never be enabled in production
  if (isProduction && testMode) {
    console.error('\n[CRITICAL WARNING] ENABLE_TEST_MODE is true in production environment!')
    console.error('[CRITICAL WARNING] This bypasses important security and validation checks.')
    console.error('[CRITICAL WARNING] Set ENABLE_TEST_MODE=false immediately!')
    hasErrors = true
  }

  console.log('Critical Variables:')
  requiredEnvVars.critical.forEach(({ name, description, sensitive }) => {
    const label = formatEnvLabel(name)
    const { value, resolvedName } = resolveEnvValue(name)
    if (!value) {
      if (isCI && testMode) {
        console.log(`  [WARN] ${label}: Missing (CI mode) - ${description}`)
        hasWarnings = true
      } else {
        console.log(`  [ERROR] ${label}: Missing - ${description}`)
        hasErrors = true
      }
    } else {
      const masked = maskValue(value, 8, sensitive)
      const resolvedSuffix = label === resolvedName ? '' : ` (${resolvedName})`
      if (isCI && (value.includes('dummy') || value.includes('test'))) {
        console.log(`  [INFO] ${label}: ${masked}${resolvedSuffix} (CI dummy value)`)
      } else {
        console.log(`  [OK] ${label}: ${masked}${resolvedSuffix}`)
      }
    }
  })

  if (isProduction && !testMode) {
    console.log('\nProduction Variables:')
    requiredEnvVars.production.forEach(({ name, description, sensitive }) => {
      const label = formatEnvLabel(name)
      const { value, resolvedName } = resolveEnvValue(name)
      if (!value) {
        console.log(`  [ERROR] ${label}: Missing - ${description}`)
        hasErrors = true
      } else {
        const masked = maskValue(value, 8, sensitive)
        const resolvedSuffix = label === resolvedName ? '' : ` (${resolvedName})`
        console.log(`  [OK] ${label}: ${masked}${resolvedSuffix}`)
      }
    })
  } else if (!isProduction) {
    console.log('\nProduction Variables (optional in development):')
    requiredEnvVars.production.forEach(({ name, description, sensitive }) => {
      const label = formatEnvLabel(name)
      const { value, resolvedName } = resolveEnvValue(name)
      if (!value) {
        console.log(`  [WARN] ${label}: Not set - ${description}`)
        hasWarnings = true
      } else {
        const masked = maskValue(value, 8, sensitive)
        const resolvedSuffix = label === resolvedName ? '' : ` (${resolvedName})`
        console.log(`  [OK] ${label}: ${masked}${resolvedSuffix}`)
      }
    })
  }

  // Email service configuration (at least one provider required in production)
  const hasEmailProvider = requiredEnvVars.email.some(({ name }) => process.env[name])
  if (isProduction && !testMode && !hasEmailProvider) {
    console.log('\n[ERROR] Email Configuration: At least one email provider (RESEND_API_KEY, SENDGRID_API_KEY, or BREVO_API_KEY) is required in production')
    hasErrors = true
  } else if (hasEmailProvider) {
    console.log('\nEmail Configuration:')
    requiredEnvVars.email.forEach(({ name, description, sensitive }) => {
      const label = formatEnvLabel(name)
      const { value, resolvedName } = resolveEnvValue(name)
      if (!value) {
        console.log(`  [INFO] ${label}: Not configured - ${description}`)
      } else {
        const masked = maskValue(value, 12, sensitive)
        const resolvedSuffix = label === resolvedName ? '' : ` (${resolvedName})`
        console.log(`  [OK] ${label}: ${masked}${resolvedSuffix}`)
      }
    })
  } else {
    console.log('\nEmail Configuration: No email provider configured (emails will fail in production)')
    hasWarnings = true
  }

  // Rate limiting configuration (strongly recommended for production)
  const hasRateLimitConfig = requiredEnvVars.rateLimit.every(({ name }) => process.env[name])
  if (isProduction && !hasRateLimitConfig) {
    console.log('\n[WARN] Rate Limiting: Upstash Redis not configured. Rate limiting protection is disabled.')
    hasWarnings = true
  } else if (hasRateLimitConfig) {
    console.log('\nRate Limiting Configuration:')
    requiredEnvVars.rateLimit.forEach(({ name, description, sensitive }) => {
      const label = formatEnvLabel(name)
      const { value, resolvedName } = resolveEnvValue(name)
      if (!value) {
        console.log(`  [WARN] ${label}: Not set - ${description}`)
        hasWarnings = true
      } else {
        const masked = maskValue(value, 15, sensitive)
        const resolvedSuffix = label === resolvedName ? '' : ` (${resolvedName})`
        console.log(`  [OK] ${label}: ${masked}${resolvedSuffix}`)
      }
    })
  }

  console.log('\nOptional Variables:')
  requiredEnvVars.optional.forEach(({ name, description, default: defaultValue, sensitive }) => {
    const label = formatEnvLabel(name)
    const { value, resolvedName } = resolveEnvValue(name)
    if (!value) {
      if (defaultValue) {
        console.log(`  [INFO] ${label}: Using default "${defaultValue}" - ${description}`)
      } else {
        console.log(`  [WARN] ${label}: Not set - ${description}`)
        hasWarnings = true
      }
    } else {
      const masked = maskValue(value, 20, sensitive)
      const resolvedSuffix = label === resolvedName ? '' : ` (${resolvedName})`
      console.log(`  [OK] ${label}: ${masked}${resolvedSuffix}`)
    }
  })

  console.log('\n=== Validation Summary ===')
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`Test Mode: ${testMode ? 'Enabled' : 'Disabled'}`)
  console.log(`CI Mode: ${isCI ? 'Yes' : 'No'}`)

  if (hasErrors) {
    console.log('\n[FAILED] Missing critical environment variables')
    process.exit(1)
  } else if (hasWarnings) {
    if (isCI && testMode) {
      console.log('\n[PASSED] CI validation successful (using dummy values)')
      process.exit(0)
    } else {
      console.log('\n[PASSED WITH WARNINGS] Some optional variables are missing')
      process.exit(0)
    }
  } else {
    console.log('\n[PASSED] All environment variables are configured')
    process.exit(0)
  }
}

if (require.main === module) {
  require('dotenv').config({ path: '.env.local' })
  require('dotenv').config({ path: '.env' })
  validateEnv()
}

module.exports = { validateEnv, requiredEnvVars }
