# Email System Setup Guide

## Overview

The Talk-To-My-Lawyer email system uses **Resend** as the email provider with a reliable queue-based delivery system that includes automatic retries, persistence, and cron-based processing.

## Architecture

### Components

1. **Email Service** (`lib/email/service.ts`)
   - Handles direct email sending via Resend
   - Provides template rendering
   - Manages email configuration

2. **Email Queue** (`lib/email/queue.ts`)
   - Stores emails in the database for reliable delivery
   - Implements retry logic with exponential backoff
   - Tracks email status (pending, sent, failed)

3. **Email Templates** (`lib/email/templates.ts`)
   - Pre-built HTML and text templates
   - Secure HTML escaping to prevent XSS
   - Responsive design for all email clients

4. **Cron Processor** (`app/api/cron/process-email-queue/route.ts`)
   - Runs every 10 minutes via Vercel Cron
   - Processes pending emails from the queue
   - Retries failed emails automatically

## Required Environment Variables

```bash
# Resend API Key (Required)
# Get from: https://resend.com/api-keys
RESEND_API_KEY=re_your-resend-api-key

# Email sender address (Required)
# Must be a verified domain in Resend
EMAIL_FROM=noreply@yourdomain.com

# Optional: Customize sender name
EMAIL_FROM_NAME=Talk-To-My-Lawyer

# Site URL for email links (Required)
NEXT_PUBLIC_SITE_URL=https://yourdomain.com

# Cron secret for queue processing (Required)
CRON_SECRET=your-random-cron-secret-key

# Supabase secret key (Required for queue; service role key legacy supported)
SUPABASE_SECRET_KEY=your-secret-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

## Setup Instructions

### 1. Configure Resend

1. Create a Resend account at https://resend.com
2. Verify your sending domain:
   - Go to Domains in Resend dashboard
   - Add your domain
   - Add the provided DNS records (SPF, DKIM, DMARC)
   - Wait for verification (usually 5-10 minutes)
3. Generate an API key:
   - Go to API Keys in Resend dashboard
   - Create a new API key
   - Copy the key and add to `.env.local` as `RESEND_API_KEY`

### 2. Set Environment Variables

Create or update your `.env.local` file:

```bash
RESEND_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM=noreply@yourdomain.com
EMAIL_FROM_NAME=Talk-To-My-Lawyer
NEXT_PUBLIC_SITE_URL=https://yourdomain.com
CRON_SECRET=your-secure-random-string
```

### 3. Verify Database Table

Ensure the `email_queue` table exists in Supabase:

```sql
CREATE TABLE IF NOT EXISTS email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to TEXT NOT NULL,
  subject TEXT NOT NULL,
  html TEXT,
  text TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status);
CREATE INDEX IF NOT EXISTS idx_email_queue_next_retry ON email_queue(next_retry_at);
```

### 4. Deploy Cron Job

The cron job is already configured in `vercel.json` to run every 10 minutes:

```json
{
  "crons": [
    {
      "path": "/api/cron/process-email-queue",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

When you deploy to Vercel, the cron job will automatically start processing emails.

## Email System Features

### Reliable Delivery

All emails are **queued** instead of sent directly:
- ✅ **Automatic retries** on failure (3 attempts by default)
- ✅ **Exponential backoff** (5min, 10min, 20min)
- ✅ **Persistence** - emails survive server restarts
- ✅ **Queue monitoring** - track email status in database

### Available Email Templates

| Template Name | Description | Use Case |
|--------------|-------------|----------|
| `welcome` | Welcome new users | After signup/profile creation |
| `password-reset` | Password reset link | Password recovery flow |
| `password-reset-confirmation` | Password changed | After successful password reset |
| `letter-approved` | Letter approved by attorney | Attorney approval workflow |
| `letter-rejected` | Letter needs revision | Attorney rejection workflow |
| `letter-generated` | Letter ready for review | After AI generation |
| `letter-under-review` | Letter being reviewed | Attorney starts review |
| `commission-earned` | Employee commission earned | After referral payment |
| `commission-paid` | Commission payment processed | Payout completed |
| `subscription-confirmation` | Subscription confirmed | After payment success |
| `subscription-renewal` | Renewal reminder | Before renewal |
| `subscription-cancelled` | Subscription cancelled | After cancellation |
| `payment-failed` | Payment failure | Failed payment attempt |
| `admin-alert` | Admin notification | System notifications |
| `security-alert` | Security notification | Security events |

### Sending Emails (Developer Guide)

**✅ RECOMMENDED: Queue emails for reliable delivery**

```typescript
import { queueTemplateEmail } from '@/lib/email'

// Queue an email (preferred method)
await queueTemplateEmail(
  'welcome',
  'user@example.com',
  {
    userName: 'John',
    actionUrl: 'https://yourdomain.com/dashboard'
  }
)
```

**⚠️ NOT RECOMMENDED: Direct send (no retries)**

```typescript
import { sendTemplateEmail } from '@/lib/email'

// Direct send - only for urgent notifications
await sendTemplateEmail(
  'security-alert',
  'admin@example.com',
  {
    alertMessage: 'Suspicious activity detected',
    actionUrl: 'https://yourdomain.com/admin'
  }
)
```

## Monitoring & Troubleshooting

### Check Email Queue Status

Query the database to see email status:

```sql
-- Check pending emails
SELECT * FROM email_queue WHERE status = 'pending' ORDER BY created_at DESC;

-- Check failed emails
SELECT * FROM email_queue WHERE status = 'failed' ORDER BY created_at DESC;

-- Queue statistics
SELECT
  status,
  COUNT(*) as count,
  AVG(attempts) as avg_attempts
FROM email_queue
GROUP BY status;
```

### Common Issues

#### 1. Emails not sending

**Symptoms:** Emails queued but never sent

**Solutions:**
- Check if `RESEND_API_KEY` is set correctly
- Verify cron job is running (check Vercel deployment logs)
- Check if `CRON_SECRET` matches between `.env` and cron calls
- Verify Resend domain is verified

#### 2. All emails failing

**Symptoms:** All emails have status = 'failed'

**Solutions:**
- Check Resend dashboard for API errors
- Verify `EMAIL_FROM` matches a verified domain
- Check Resend API key is valid and not expired
- Review error messages in `email_queue.error` column

#### 3. Emails stuck in pending

**Symptoms:** Emails remain in 'pending' status

**Solutions:**
- Verify cron job is configured in `vercel.json`
- Check cron job logs in Vercel dashboard
- Manually trigger: `POST /api/cron/process-email-queue?secret=YOUR_CRON_SECRET`
- Check `next_retry_at` is not in the future

#### 4. Duplicate emails

**Symptoms:** Users receiving multiple copies

**Solutions:**
- Check for multiple cron jobs configured
- Ensure not calling both `queueTemplateEmail()` and `sendTemplateEmail()` for same email
- Review application logs for duplicate triggers

### Manual Queue Processing

For testing or emergency processing:

```bash
# Using curl
curl -X POST "https://yourdomain.com/api/cron/process-email-queue?secret=YOUR_CRON_SECRET"

# Check queue status
curl "https://yourdomain.com/api/cron/process-email-queue?secret=YOUR_CRON_SECRET"
```

### Email Delivery Logs

Check Resend dashboard for delivery details:
1. Go to https://resend.com/emails
2. View delivery status, opens, clicks
3. Check bounce and spam reports

## Testing

### Local Development

1. Set up Resend API key in `.env.local`
2. Use a test email address
3. Manually trigger queue processing:

```bash
curl -X POST "http://localhost:3000/api/cron/process-email-queue?secret=your-local-secret"
```

### Production Testing

1. Create a test user account
2. Trigger an email event (e.g., signup)
3. Check database: `SELECT * FROM email_queue ORDER BY created_at DESC LIMIT 5;`
4. Wait for cron job (max 10 minutes) or manually trigger
5. Verify email received

## Performance Optimization

### Queue Processing

- Processes **10 emails per run** (every 10 minutes = 60 emails/hour max)
- To increase throughput:
  - Reduce cron schedule (e.g., `*/5 * * * *` for every 5 minutes)
  - Increase batch size in `queue.ts` (`limit(10)` → `limit(20)`)

### Database Cleanup

Old emails should be periodically cleaned:

```sql
-- Delete sent emails older than 30 days
DELETE FROM email_queue
WHERE status = 'sent'
AND sent_at < NOW() - INTERVAL '30 days';

-- Delete failed emails older than 7 days
DELETE FROM email_queue
WHERE status = 'failed'
AND created_at < NOW() - INTERVAL '7 days';
```

## Security Best Practices

1. **Never expose RESEND_API_KEY** to the client
2. **Always use queue for user-facing emails** (prevents DoS)
3. **Validate email addresses** before queueing
4. **Use templates** instead of raw HTML (prevents XSS)
5. **Rotate CRON_SECRET** regularly
6. **Monitor failed emails** for suspicious patterns
7. **Set up SPF, DKIM, DMARC** for your domain

## Support

- **Resend Documentation:** https://resend.com/docs
- **Resend Status:** https://status.resend.com
- **Email Queue Issues:** Check Supabase logs and `email_queue` table
- **Cron Issues:** Check Vercel deployment logs

## Migration Notes

### From Direct Sends to Queue

All email sends have been migrated to use `queueTemplateEmail()`:

- ✅ Welcome emails (signup)
- ✅ Letter approval/rejection notifications
- ✅ Admin alerts
- ✅ Commission notifications
- ✅ Subscription confirmations

**Breaking Changes:** None - the queue system is backward compatible.

## Next Steps

1. ✅ Set up Resend account and verify domain
2. ✅ Configure environment variables
3. ✅ Deploy to Vercel (cron auto-configures)
4. ✅ Test email delivery
5. ✅ Monitor queue and logs
6. ✅ Set up database cleanup job (optional)
