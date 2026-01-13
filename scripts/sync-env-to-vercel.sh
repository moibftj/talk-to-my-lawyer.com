#!/bin/bash

# Sync Environment Variables to Vercel Production
# This script helps you add all required environment variables to Vercel

set -e

VERCEL_TOKEN="${VERCEL_TOKEN:-}"

if [ -z "$VERCEL_TOKEN" ]; then
  echo "❌ Error: VERCEL_TOKEN not set"
  echo "Please run: export VERCEL_TOKEN=your-token"
  exit 1
fi

echo "🚀 Syncing Environment Variables to Vercel Production"
echo "=================================================="
echo ""

# Required variables list
declare -a REQUIRED_VARS=(
  "NEXT_PUBLIC_SUPABASE_URL"
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
  "SUPABASE_SECRET_KEY"
  "OPENAI_API_KEY"
  "STRIPE_SECRET_KEY"
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"
  "STRIPE_WEBHOOK_SECRET"
  "ADMIN_EMAIL"
  "ADMIN_PORTAL_KEY"
  "CRON_SECRET"
  "NEXT_PUBLIC_SITE_URL"
  "RESEND_API_KEY"
  "EMAIL_FROM"
  "KV_REST_API_URL"
  "KV_REST_API_TOKEN"
)

# Optional legacy fallback variables
declare -a OPTIONAL_VARS=(
  "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  "SUPABASE_SERVICE_ROLE_KEY"
  "ENABLE_TEST_MODE"
  "NEXT_PUBLIC_TEST_MODE"
)

echo "📋 Checking current Vercel environment variables..."
vercel env ls --token "$VERCEL_TOKEN"
echo ""

read -p "Do you want to add environment variables interactively? (y/n): " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "ℹ️  Skipping. You can add them manually at:"
  echo "   https://vercel.com/moizs-projects-34494b93/talk-to-my-lawyer.com/settings/environment-variables"
  exit 0
fi

echo ""
echo "⚠️  IMPORTANT: Make sure you have these values ready!"
echo "   - Supabase: New publishable/secret keys (or legacy anon/service_role)"
echo "   - OpenAI: API key"
echo "   - Stripe: Secret, publishable, and webhook secret"
echo "   - Email: Resend API key and from address"
echo "   - Redis: Upstash KV REST API URL and token"
echo "   - Admin: Email, portal key, cron secret"
echo ""
read -p "Press Enter to continue or Ctrl+C to cancel..."
echo ""

# Function to add env var
add_env_var() {
  local var_name=$1
  local is_required=$2
  
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  if [ "$is_required" = "true" ]; then
    echo "📌 REQUIRED: $var_name"
  else
    echo "📝 OPTIONAL: $var_name"
  fi
  
  read -p "Enter value (or press Enter to skip): " -r var_value
  
  if [ -n "$var_value" ]; then
    echo "Adding $var_name to Vercel production..."
    echo "$var_value" | vercel env add "$var_name" production --token "$VERCEL_TOKEN" || true
    echo "✅ Added $var_name"
  else
    echo "⏭️  Skipped $var_name"
  fi
  echo ""
}

# Add required variables
echo "📋 REQUIRED VARIABLES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
for var in "${REQUIRED_VARS[@]}"; do
  add_env_var "$var" "true"
done

echo ""
echo "📋 OPTIONAL VARIABLES (Legacy/Fallback)"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
read -p "Do you want to add optional variables? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
  for var in "${OPTIONAL_VARS[@]}"; do
    add_env_var "$var" "false"
  done
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Environment variables sync complete!"
echo ""
echo "📋 Current variables in Vercel:"
vercel env ls --token "$VERCEL_TOKEN"
echo ""
echo "🚀 Next steps:"
echo "   1. Verify variables at: https://vercel.com/moizs-projects-34494b93/talk-to-my-lawyer.com/settings/environment-variables"
echo "   2. Redeploy: vercel --prod --token \$VERCEL_TOKEN"
echo "   3. Or wait for next git push to trigger auto-deploy"
echo ""
