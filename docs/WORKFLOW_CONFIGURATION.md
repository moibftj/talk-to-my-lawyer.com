# Workflow DevKit Configuration Guide

## Overview

The Workflow DevKit has been integrated into Talk-To-My-Lawyer to transform the letter generation process into a durable, resumable workflow. This guide explains how to configure the necessary environment variables and deploy the workflow system.

## Required Environment Variable

### WORKFLOW_DB_URL

The Workflow DevKit requires a PostgreSQL connection string to store workflow execution state. We use the existing Supabase database for this purpose.

**Format:**
```
WORKFLOW_DB_URL=postgresql://postgres:[PASSWORD]@db.nomiiqzxaxyxnxndvkbe.supabase.co:5432/postgres
```

## Getting Your Database Password

### Option 1: From Supabase Dashboard

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `nomiiqzxaxyxnxndvkbe`
3. Navigate to **Project Settings** → **Database**
4. Scroll to **Connection String** section
5. Select **URI** tab
6. Copy the connection string (it includes your password)
7. Paste it into your `.env.local` file

### Option 2: Reset Database Password

If you don't have the password:

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `nomiiqzxaxyxnxndvkbe`
3. Navigate to **Project Settings** → **Database**
4. Click **"Reset database password"**
5. Copy the new password
6. Update the connection string in `.env.local`:

```bash
WORKFLOW_DB_URL=postgresql://postgres:YOUR-NEW-PASSWORD@db.nomiiqzxaxyxnxndvkbe.supabase.co:5432/postgres
```

## Configuration Steps

### 1. Local Development

Update your `.env.local` file:

```bash
# Find this line:
WORKFLOW_DB_URL=postgresql://postgres:YOUR-DATABASE-PASSWORD@db.nomiiqzxaxyxnxndvkbe.supabase.co:5432/postgres

# Replace YOUR-DATABASE-PASSWORD with your actual Supabase password
WORKFLOW_DB_URL=postgresql://postgres:actual_password_here@db.nomiiqzxaxyxnxndvkbe.supabase.co:5432/postgres
```

**Important:** Never commit `.env.local` to git. It's already in `.gitignore`.

### 2. Vercel Production/Preview

1. Go to your Vercel project
2. Navigate to **Settings** → **Environment Variables**
3. Add a new variable:
   - **Name:** `WORKFLOW_DB_URL`
   - **Value:** `postgresql://postgres:YOUR-PASSWORD@db.nomiiqzxaxyxnxndvkbe.supabase.co:5432/postgres`
   - **Environments:** Select Production, Preview, and Development
   - **Type:** Mark as "Secret" (encrypted)
4. Click **Save**
5. Redeploy your application for changes to take effect

### 3. Verify Configuration

After setting the environment variable, verify it works:

```bash
# Start development server
pnpm dev

# In another terminal, test the workflow endpoint
curl -X POST http://localhost:3000/api/workflows/trigger \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SUPABASE_TOKEN" \
  -d '{
    "letterType": "demand_letter",
    "intakeData": {
      "senderName": "Test User",
      "recipientName": "Test Recipient",
      "issueDescription": "Test issue"
    }
  }'

# Should return: { "success": true, "data": { "workflowId": "...", ... } }
```

## Database Migration

Before workflows can fully function, you need to apply the database migration:

### Local Development

If you're running local Supabase:

```bash
supabase migration up
```

### Production (Supabase Cloud)

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project: `nomiiqzxaxyxnxndvkbe`
3. Navigate to **SQL Editor**
4. Click **New Query**
5. Copy the contents of `/supabase/migrations/20260115000001_add_workflow_tracking.sql`
6. Paste into the SQL editor
7. Click **Run** to execute the migration
8. Verify success: Check that `letters` table now has `workflow_id`, `workflow_status`, etc. columns

### Verify Migration

```sql
-- Run this query in Supabase SQL Editor to verify columns were added
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'letters'
  AND column_name LIKE 'workflow%';

-- Expected output:
-- workflow_id | text
-- workflow_status | text
-- workflow_started_at | timestamp with time zone
-- workflow_completed_at | timestamp with time zone
-- workflow_error | text
```

## Security Considerations

### Connection String Security

- ✅ **DO:** Store in environment variables
- ✅ **DO:** Mark as "Secret" in Vercel
- ✅ **DO:** Use different passwords for dev/staging/production
- ❌ **DON'T:** Commit to git
- ❌ **DON'T:** Share in Slack/email
- ❌ **DON'T:** Log in application code

### Connection Pooling

The Workflow DevKit automatically handles connection pooling. No additional configuration needed.

### SSL/TLS

Supabase connections use SSL by default. No additional configuration needed.

## Troubleshooting

### Error: "WORKFLOW_DB_URL is not defined"

**Cause:** Environment variable not set

**Fix:**
1. Check `.env.local` exists and contains `WORKFLOW_DB_URL`
2. Restart dev server: `pnpm dev`
3. Verify with: `echo $WORKFLOW_DB_URL` (Linux/Mac) or `echo %WORKFLOW_DB_URL%` (Windows)

### Error: "password authentication failed for user postgres"

**Cause:** Incorrect database password

**Fix:**
1. Go to Supabase Dashboard → Project Settings → Database
2. Reset database password
3. Update `WORKFLOW_DB_URL` with new password
4. Restart application

### Error: "relation workflow_executions does not exist"

**Cause:** Workflow DevKit hasn't initialized its tables

**Fix:**
1. Ensure `WORKFLOW_DB_URL` is correct
2. Restart application - Workflow DevKit auto-creates its tables on first run
3. Check Supabase SQL Editor for `workflow_executions` table

### Error: "column workflow_id does not exist"

**Cause:** Database migration not applied

**Fix:**
1. Apply migration: Copy contents of `20260115000001_add_workflow_tracking.sql`
2. Run in Supabase SQL Editor
3. Verify columns were added (see "Verify Migration" above)

## Performance Tuning

### Connection Pool Size

Default pool size is 10 connections. To adjust:

```env
# Add to .env.local if needed (optional)
WORKFLOW_DB_POOL_SIZE=20
```

Recommended values:
- Local development: 5-10
- Staging: 10-20
- Production: 20-50 (depending on load)

### Cleanup Old Workflows

Archive completed workflows after 90 days to reduce storage:

```sql
-- Run this periodically (or create a cron job)
DELETE FROM workflow_executions
WHERE status = 'completed'
  AND completed_at < NOW() - INTERVAL '90 days';
```

## Migration Timeline

The system now supports both legacy and workflow approaches:

### Phase 1: Dual Running (Current)
- ✅ New letters use workflows (`/api/workflows/trigger`)
- ✅ Old letters use legacy endpoints (`/api/generate-letter`)
- ✅ Attorney portal supports both

### Phase 2: Full Migration (Future)
- Move all in-progress letters to workflows
- Archive legacy endpoints
- Remove old code

## Support

If you encounter issues:

1. Check this documentation
2. Review `/docs/WORKFLOW_IMPLEMENTATION_PROGRESS.md`
3. Inspect workflow execution logs in Supabase
4. Check Vercel deployment logs

## Related Documentation

- Implementation Plan: `/docs/WORKFLOW_IMPLEMENTATION_PLAN.md`
- Implementation Progress: `/docs/WORKFLOW_IMPLEMENTATION_PROGRESS.md`
- API Documentation: `/CLAUDE.md`
- Database Schema: `/docs/DATABASE.md`
