#!/bin/bash
set -e

export VERCEL_TOKEN=GS9U0OrPGsdFOOjzssUTY1K1

echo "🚀 Syncing environment variables to Vercel Production"
echo "======================================================"
echo ""

# Load .env.local
source .env.local

# Helper function to add env var
add_env() {
  local name=$1
  local value=$2
  echo "Adding $name..."
  echo "$value" | vercel env add "$name" production --token "$VERCEL_TOKEN" --force 2>&1 | grep -v "Warning:" || true
}

# Supabase (NEW)
add_env "NEXT_PUBLIC_SUPABASE_URL" "$NEXT_PUBLIC_SUPABASE_URL"
add_env "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" "$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
add_env "SUPABASE_SECRET_KEY" "$SUPABASE_SECRET_KEY"

# OpenAI
add_env "OPENAI_API_KEY" "$OPENAI_API_KEY"

# Stripe
add_env "STRIPE_SECRET_KEY" "$STRIPE_SECRET_KEY"
add_env "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" "$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"
add_env "STRIPE_WEBHOOK_SECRET" "$STRIPE_WEBHOOK_SECRET"

# Admin & Security
add_env "ADMIN_EMAIL" "$ADMIN_EMAIL"
add_env "ADMIN_PORTAL_KEY" "$ADMIN_PORTAL_KEY"
add_env "CRON_SECRET" "$CRON_SECRET"

# Site (production URL)
add_env "NEXT_PUBLIC_SITE_URL" "https://talk-to-my-lawyercom.vercel.app"

# Email
add_env "RESEND_API_KEY" "$RESEND_API_KEY"
add_env "EMAIL_FROM" "$EMAIL_FROM"

# Rate Limiting
add_env "KV_REST_API_URL" "$KV_REST_API_URL"
add_env "KV_REST_API_TOKEN" "$KV_REST_API_TOKEN"

# Test Mode (MUST be false in production!)
add_env "ENABLE_TEST_MODE" "false"
add_env "NEXT_PUBLIC_TEST_MODE" "false"

echo ""
echo "✅ Environment variables synced!"
echo ""
echo "📋 Verifying..."
vercel env ls --token "$VERCEL_TOKEN"
