#!/bin/bash
# Add secrets to GitHub Repository using gh CLI
# Run this locally to batch-add secrets to your GitHub repo

set -e

echo "=== Adding Secrets to GitHub Repository ==="
echo ""
echo "Prerequisite: Install gh CLI and authenticate with 'gh auth login'"
echo ""

# Check if gh is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed"
    echo "Install it from: https://cli.github.com/"
    exit 1
fi

# Check authentication
if ! gh auth status &> /dev/null; then
    echo "❌ Not authenticated with GitHub"
    echo "Run: gh auth login"
    exit 1
fi

# Get repository name
REPO=$(git config --get remote.origin.url | sed -E 's|.*[:/]([^/:]+/[^/.]+)\.git|\1|')
if [ -z "$REPO" ]; then
    echo "❌ Could not detect repository name"
    echo "Usage: ./add-secrets-to-github.sh [owner/repo]"
    exit 1
fi

# Allow override
if [ -n "$1" ]; then
    REPO="$1"
fi

echo "📦 Adding secrets to repository: $REPO"
echo ""

# Function to add secret
add_secret() {
    local name="$1"
    local value="$2"

    if [ -z "$value" ]; then
        echo "⚠️  Skipping $name (empty value)"
        return
    fi

    echo "Adding: $name"
    echo -n "$value" | gh secret set "$name" --repo "$REPO"
}

# Read from .env.local if it exists, otherwise prompt
if [ -f ".env.local" ]; then
    echo "Reading from .env.local..."
    source .env.local
else
    echo "⚠️  .env.local not found. Please enter values manually."
fi

# Add each secret (modify values as needed)
echo ""
echo "Enter secret values (press Enter to skip):"

# Supabase
read -sp "NEXT_PUBLIC_SUPABASE_URL: " NEXT_PUBLIC_SUPABASE_URL
add_secret "NEXT_PUBLIC_SUPABASE_URL" "$NEXT_PUBLIC_SUPABASE_URL"

read -sp "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: " NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
add_secret "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" "$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"

read -sp "NEXT_PUBLIC_SUPABASE_ANON_KEY (optional legacy): " NEXT_PUBLIC_SUPABASE_ANON_KEY
add_secret "NEXT_PUBLIC_SUPABASE_ANON_KEY" "$NEXT_PUBLIC_SUPABASE_ANON_KEY"

read -sp "SUPABASE_SECRET_KEY: " SUPABASE_SECRET_KEY
add_secret "SUPABASE_SECRET_KEY" "$SUPABASE_SECRET_KEY"

read -sp "SUPABASE_SERVICE_ROLE_KEY (optional legacy): " SUPABASE_SERVICE_ROLE_KEY
add_secret "SUPABASE_SERVICE_ROLE_KEY" "$SUPABASE_SERVICE_ROLE_KEY"

# OpenAI
read -sp "OPENAI_API_KEY: " OPENAI_API_KEY
add_secret "OPENAI_API_KEY" "$OPENAI_API_KEY"

# Stripe
read -sp "STRIPE_SECRET_KEY: " STRIPE_SECRET_KEY
add_secret "STRIPE_SECRET_KEY" "$STRIPE_SECRET_KEY"

read -sp "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: " NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
add_secret "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY" "$NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY"

read -sp "STRIPE_WEBHOOK_SECRET: " STRIPE_WEBHOOK_SECRET
add_secret "STRIPE_WEBHOOK_SECRET" "$STRIPE_WEBHOOK_SECRET"

# Admin
read -sp "ADMIN_EMAIL: " ADMIN_EMAIL
add_secret "ADMIN_EMAIL" "$ADMIN_EMAIL"

read -sp "ADMIN_PORTAL_KEY: " ADMIN_PORTAL_KEY
add_secret "ADMIN_PORTAL_KEY" "$ADMIN_PORTAL_KEY"

read -sp "CRON_SECRET: " CRON_SECRET
add_secret "CRON_SECRET" "$CRON_SECRET"

# Upstash/Redis
read -sp "KV_REST_API_URL: " KV_REST_API_URL
add_secret "KV_REST_API_URL" "$KV_REST_API_URL"

read -sp "KV_REST_API_TOKEN: " KV_REST_API_TOKEN
add_secret "KV_REST_API_TOKEN" "$KV_REST_API_TOKEN"

# Email
read -sp "RESEND_API_KEY: " RESEND_API_KEY
add_secret "RESEND_API_KEY" "$RESEND_API_KEY"

# App URLs (optional - can also use GitHub Variables)
read -sp "NEXT_PUBLIC_APP_URL: " NEXT_PUBLIC_APP_URL
add_secret "NEXT_PUBLIC_APP_URL" "$NEXT_PUBLIC_APP_URL"

read -sp "NEXT_PUBLIC_SITE_URL: " NEXT_PUBLIC_SITE_URL
add_secret "NEXT_PUBLIC_SITE_URL" "$NEXT_PUBLIC_SITE_URL"

echo ""
echo "✅ Secrets added successfully!"
echo ""
echo "View secrets at: https://github.com/$REPO/settings/secrets/actions"
