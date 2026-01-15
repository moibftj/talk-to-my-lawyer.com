#!/bin/bash

# Deploy Supabase migration script
# Usage: ./scripts/deploy-migration.sh <migration-file> <access-token>

set -e

MIGRATION_FILE=$1
ACCESS_TOKEN=$2

if [ -z "$MIGRATION_FILE" ]; then
    echo "❌ Error: Migration file not specified"
    echo "Usage: ./scripts/deploy-migration.sh <migration-file> <access-token>"
    exit 1
fi

if [ -z "$ACCESS_TOKEN" ]; then
    echo "❌ Error: Supabase access token not provided"
    echo "Usage: ./scripts/deploy-migration.sh <migration-file> <access-token>"
    exit 1
fi

if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ Error: Migration file not found: $MIGRATION_FILE"
    exit 1
fi

echo "🚀 Deploying migration: $MIGRATION_FILE"
echo ""

# Set the Supabase access token
export SUPABASE_ACCESS_TOKEN=$ACCESS_TOKEN

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Installing..."
    npm install -g supabase
fi

# Initialize Supabase config if not exists
if [ ! -f "supabase/config.toml" ]; then
    echo "📝 Initializing Supabase configuration..."
    supabase init
fi

# Link to remote project (if not already linked)
if [ ! -f ".git/supabase" ]; then
    echo "🔗 Linking to Supabase project..."
    # This will prompt for project selection
    supabase link --project-ref auto
fi

# Push the specific migration
echo "📤 Pushing migration to Supabase..."
supabase db push

echo ""
echo "✅ Migration deployed successfully!"
echo ""
echo "To verify, run:"
echo "  supabase db remote commit"
