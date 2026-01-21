#!/bin/bash
# GitHub Secrets Setup Helper
# This script outputs the commands you need to run to set up GitHub Repository Secrets

echo "=== GitHub Repository Secrets Setup ==="
echo ""
echo "1. Go to your repository on GitHub"
echo "2. Navigate to Settings → Secrets and variables → Actions"
echo "3. Click 'New repository secret' for each secret below:"
echo ""

# Core secrets (required)
echo "REQUIRED SECRETS:"
echo "=================="
echo "NEXT_PUBLIC_SUPABASE_URL"
echo "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (preferred) or NEXT_PUBLIC_SUPABASE_ANON_KEY"
echo "SUPABASE_SECRET_KEY (preferred) or SUPABASE_SERVICE_ROLE_KEY"
echo "OPENAI_API_KEY"
echo "STRIPE_SECRET_KEY"
echo "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"
echo "STRIPE_WEBHOOK_SECRET"
echo "ADMIN_EMAIL"
echo "ADMIN_PORTAL_KEY"
echo "CRON_SECRET"
echo "KV_REST_API_URL"
echo "KV_REST_API_TOKEN"
echo "RESEND_API_KEY"

echo ""
echo "OPTIONAL SECRETS:"
echo "=================="
echo "NEXT_PUBLIC_APP_URL (for production deployment)"
echo "NEXT_PUBLIC_SITE_URL (for production deployment)"
echo "DATABASE_URL"
echo "AI_GATEWAY_API_KEY"

echo ""
echo "VERCEL DEPLOYMENT SECRETS:"
echo "=========================="
echo "VERCEL_TOKEN           # Get from: https://vercel.com/account/tokens"
echo "VERCEL_ORG_ID          # Found in vercel.json or project settings"
echo "VERCEL_PROJECT_ID      # Found in .vercel/project.json"

echo ""
echo "GITHUB VARIABLES (not secrets):"
echo "================================"
echo "Settings → Secrets and variables → Actions → Variables → New repository variable"
echo ""
echo "PRODUCTION_URL=https://www.talk-to-my-lawyer.com"

echo ""
echo "=== Security Reminder ==="
echo "🔒 NEVER commit real API keys to your repository"
echo "✅ Use GitHub Repository Secrets for all sensitive data"
echo "🧪 Use .env.ci for local CI testing with dummy values"

echo ""
echo "Once you've added the secrets, your CI pipeline should pass!"
echo "You can check the status at: https://github.com/moizjmj-pk/talk-to-my-lawyer/actions"
