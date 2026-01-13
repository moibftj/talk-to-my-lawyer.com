# Email Setup Quick Guide

## Problem
Emails were not being sent because they were queued to a database table and only processed by a cron job that wasn't running.

## Solution Implemented

1. **Modified email sending to be immediate**: Changed `queueTemplateEmail()` to send emails directly first, then fall back to the queue only if sending fails.

2. **Updated signup flow**: The welcome email is now sent immediately when a user signs up.

## Setup Steps

### 1. Get a Resend API Key

1. Go to https://resend.com
2. Sign up for a free account
3. Navigate to **API Keys** in the dashboard
4. Click **Create API Key**
5. Copy the API key (starts with `re_`)

### 2. Configure Environment Variables

Open the `.env.local` file and update these values:

```bash
# REQUIRED - Your Resend API Key
RESEND_API_KEY=re_YOUR_ACTUAL_KEY_HERE

# For testing, use Resend's test domain (no verification needed)
EMAIL_FROM=onboarding@resend.dev
EMAIL_FROM_NAME=Talk-To-My-Lawyer

# For production, use your verified domain
# EMAIL_FROM=noreply@yourdomain.com
```

### 3. (Optional) Verify Your Own Domain

If you want to send emails from your own domain:

1. In Resend dashboard, go to **Domains**
2. Click **Add Domain**
3. Enter your domain (e.g., `talk-to-my-lawyer.com`)
4. Add the DNS records provided by Resend
5. Wait for verification (usually 5-15 minutes)
6. Update `EMAIL_FROM` to use your domain (e.g., `noreply@yourdomain.com`)

### 4. Test Email Sending

Run the test script to verify everything works:

```bash
# Option 1: Using the test script
node test-email-send.js

# Option 2: Test via API during signup
# Just sign up a new user and check if the welcome email arrives
```

### 5. Update Other Environment Variables

Make sure you also have these configured in `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-supabase-publishable-key
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key  # Legacy fallback
SUPABASE_SECRET_KEY=your-supabase-secret-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key  # Legacy fallback
OPENAI_API_KEY=sk-your-openai-key
```

## How Emails Work Now

### Before (Not Working)
- Email → Queue → Database → Wait for cron job → Send
- Cron job never ran → Emails never sent

### After (Working)
- Email → Send immediately via Resend API
- If sending fails → Queue for retry
- Queue processed by cron (optional backup)

## Testing

1. **Start the development server:**
   ```bash
   pnpm dev
   ```

2. **Sign up a new user:**
   - Go to http://localhost:3000/auth/signup
   - Create a new account
   - Check your email inbox for the welcome email

3. **Check the console:**
   - You should see logs like:
     ```
     [Email] Sent immediately: { to: 'user@example.com', subject: 'Welcome to Talk-To-My-Lawyer', messageId: 'xxx' }
     ```

## Email Templates Available

All these emails now send immediately:

- `welcome` - Sent after signup
- `password-reset` - Password reset link
- `letter-approved` - When attorney approves a letter
- `letter-rejected` - When attorney rejects a letter
- `letter-generated` - When AI generates a letter
- `letter-under-review` - When letter submitted for review
- `commission-earned` - Employee commission notification
- `subscription-confirmation` - Payment confirmation
- And more...

## Troubleshooting

### Emails not sending?

1. **Check environment variables:**
   ```bash
   # Make sure RESEND_API_KEY is set
   echo $RESEND_API_KEY
   ```

2. **Check console logs:**
   - Look for `[EmailService] Resend is not configured!`
   - Look for `[Email] Sent immediately:` (success)
   - Look for error messages

3. **Verify Resend API key:**
   - Log into Resend dashboard
   - Check API key is active
   - Check rate limits (free plan has limits)

4. **Check spam folder:**
   - Emails might be filtered to spam initially
   - Mark as "Not Spam" to train your email provider

5. **Use Resend's test domain:**
   - `onboarding@resend.dev` works without domain verification
   - Perfect for development/testing

### Still having issues?

Check the Resend logs:
1. Go to https://resend.com/logs
2. View delivery status for recent emails
3. Check for error messages

## Production Deployment

When deploying to production (Vercel, etc.):

1. Add environment variables in your hosting platform
2. Use a verified domain for `EMAIL_FROM`
3. Set up the cron job for email queue backup (optional)
4. Monitor Resend logs for delivery issues

## Rate Limits

Resend free plan:
- 100 emails/day
- 3,000 emails/month

Upgrade if you need more.
