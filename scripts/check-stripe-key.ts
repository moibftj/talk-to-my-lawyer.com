#!/usr/bin/env tsx
/**
 * Diagnostic script to check STRIPE_SECRET_KEY environment variable
 * Run with: npx dotenv-cli -e .env.local -- npx tsx scripts/check-stripe-key.ts
 */

export {}

import Stripe from 'stripe'

function sanitizeStripeKey(key: string | undefined): string | undefined {
  if (!key) return undefined

  return key
    .trim() // Remove leading/trailing whitespace
    .replace(/^['"]|['"]$/g, '') // Remove surrounding quotes
    .replace(/\r?\n|\r/g, '') // Remove newlines
}

function checkKeyIssues(key: string): string[] {
  const issues: string[] = []

  // Check for whitespace
  if (key !== key.trim()) {
    issues.push('❌ Contains leading or trailing whitespace')
  }

  // Check for quotes
  if (key.startsWith('"') || key.startsWith("'") || key.endsWith('"') || key.endsWith("'")) {
    issues.push('❌ Contains quotes (these should be removed)')
  }

  // Check for newlines
  if (key.includes('\n') || key.includes('\r')) {
    issues.push('❌ Contains newline characters')
  }

  // Check format
  if (!key.match(/^sk_test_\w+|^sk_live_\w+/)) {
    issues.push('❌ Invalid format (should start with sk_test_ or sk_live_)')
  }

  // Check length (Stripe keys are typically longer)
  if (key.length < 20) {
    issues.push('❌ Key appears too short')
  }

  return issues
}

async function main() {
  console.log('🔍 Checking STRIPE_SECRET_KEY environment variable...\n')

  const rawKey = process.env.STRIPE_SECRET_KEY

  if (!rawKey) {
    console.error('❌ STRIPE_SECRET_KEY is not set in environment variables')
    console.log('\n💡 To fix this:')
    console.log('   1. Check your .env.local file')
    console.log('   2. Ensure STRIPE_SECRET_KEY is set')
    console.log('   3. Get your key from: https://dashboard.stripe.com/apikeys')
    process.exit(1)
  }

  console.log('Raw key value:')
  console.log(`  Length: ${rawKey.length} characters`)
  console.log(`  First 10 chars: ${rawKey.substring(0, 10)}...`)
  console.log(`  Last 4 chars: ...${rawKey.slice(-4)}`)

  // Show character codes for first few chars (helps debug hidden characters)
  console.log('\nCharacter codes (first 15 chars):')
  for (let i = 0; i < Math.min(15, rawKey.length); i++) {
    const char = rawKey[i]
    const code = rawKey.charCodeAt(i)
    const display = char === ' ' ? '[SPACE]' : char === '\n' ? '[NEWLINE]' : char === '\r' ? '[CR]' : char
    console.log(`  [${i}] "${display}" (code: ${code})`)
  }

  // Check for issues
  const issues = checkKeyIssues(rawKey)

  if (issues.length > 0) {
    console.log('\n⚠️  Issues found:')
    issues.forEach(issue => console.log(`  ${issue}`))

    console.log('\n💡 Sanitized version:')
    const sanitized = sanitizeStripeKey(rawKey)
    console.log(`  ${sanitized?.substring(0, 10)}...${sanitized?.slice(-4)}`)

    console.log('\n✅ Recommended fix:')
    console.log('   Update your .env.local file to use the sanitized key:')
    console.log(`   STRIPE_SECRET_KEY=${sanitized}`)
  } else {
    console.log('\n✅ No issues detected with STRIPE_SECRET_KEY format')

    const sanitized = sanitizeStripeKey(rawKey)
    console.log('\n📝 Sanitized key (safe to use):')
    console.log(`   ${sanitized?.substring(0, 10)}...${sanitized?.slice(-4)}`)
  }

  // Test with Stripe
  console.log('\n🧪 Testing Stripe connection...')
  try {
    const sanitizedKey = sanitizeStripeKey(rawKey)

    if (!sanitizedKey) {
      throw new Error('Sanitized key is empty')
    }

    const stripe = new Stripe(sanitizedKey, {
      apiVersion: '2025-12-15.clover' as any,
    })

    // Try to fetch account info (simple API test)
    await stripe.accounts.retrieve()
    console.log('✅ Stripe connection successful!')
  } catch (error: any) {
    console.error('❌ Stripe connection failed:', error.message)
    if (error.type === 'StripeConnectionError') {
      console.log('\n💡 This is likely still an environment variable issue.')
      console.log('   Double-check that your key starts with sk_test_ or sk_live_')
      console.log('   and contains no special characters besides the underscore.')
    }
  }
}

main().catch(console.error)
