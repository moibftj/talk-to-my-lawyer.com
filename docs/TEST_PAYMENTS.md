# Testing Dummy Payments with Stripe CLI

## Current Status

Stripe CLI is **running and forwarding webhooks** to your local development server.

## Payment Flow Overview

```
User → Checkout → Stripe Checkout Page → Payment → Webhook → Subscription Created
```

## How to Test Dummy Payments

### 1. Start Your Dev Server

```bash
pnpm dev
```

Your app should run on: `http://localhost:3000`

### 2. Stripe CLI is Already Running

The webhook forwarding is already active in the background and listening for:
- `checkout.session.completed` - Payment completed
- `customer.subscription.*` - Subscription events
- `invoice.paid` - Recurring payment
- `payment_intent.succeeded` - One-time payment success

### 3. Test the Payment Flow

**Step 1: Sign up/Login**
- Go to: `http://localhost:3000`
- Create an account or login

**Step 2: Navigate to Pricing/Subscription**
- Go to: `http://localhost:3000/dashboard/subscription`

**Step 3: Select a Plan**
- Choose Single Letter, Monthly, or Yearly plan
- Click "Subscribe" or "Get Started"

**Step 4: Complete Test Payment**

You'll be redirected to Stripe Checkout. Use these test card details:

```
Card Number: 4242 4242 4242 4242
Expiry: Any future date (e.g., 12/34)
CVC: Any 3 digits (e.g., 123)
Name: Test User
ZIP: Any 5 digits (e.g., 12345)
```

**Step 5: Submit Payment**
- Click "Pay" or "Subscribe"
- Stripe will process the test payment
- You'll be redirected back to your app
- Your subscription should be active!

### 4. Verify Subscription

After successful payment:
1. Check your dashboard - subscription should show as "Active"
2. You should have letter credits available
3. Check Stripe Dashboard: https://dashboard.stripe.com/test/payments

## Stripe CLI Commands

### Check Webhook Status
```bash
# Webhook forwarding is running in background (process b30ee57)
# To view logs:
cat /tmp/claude/-workspaces-talk-to-my-lawyer/tasks/b30ee57.output
```

### Restart Webhook Forwarding
If the webhook forwarding stops, restart it:

```bash
# 1. Kill the old process (if needed)
kill $(pgrep -f "stripe listen")

# 2. Start new forwarding
stripe listen --forward-to http://localhost:3000/api/stripe/webhook \
  --events checkout.session.completed \
  --events customer.subscription.created \
  --events customer.subscription.updated \
  --events customer.subscription.deleted \
  --events invoice.paid \
  --events invoice.payment_failed \
  --events payment_intent.succeeded \
  --events payment_intent.payment_failed

# 3. Copy the new webhook secret and update .env.local:
# STRIPE_WEBHOOK_SECRET=whsec_new_secret_here
```

### Trigger Test Events
```bash
# Test a checkout event
stripe trigger checkout.session.completed

# View recent events
stripe events list --limit 10
```

## Test Cards for Different Scenarios

### Successful Payment
```
Card: 4242 4242 4242 4242
Result: Payment succeeds
```

### Card Declined
```
Card: 4000 0000 0000 0002
Result: Payment declined
```

### Insufficient Funds
```
Card: 4000 0000 0000 9995
Result: Declined for insufficient funds
```

### Expired Card
```
Card: 4000 0000 0000 0069
Result: Card expired
```

### Requires Authentication
```
Card: 4000 0025 0000 3155
Result: Requires 3D Secure authentication
```

## Troubleshooting

### Payment Not Going Through

1. **Check Stripe CLI is running:**
   ```bash
   ps aux | grep "stripe listen"
   ```

2. **Check dev server is running:**
   - Visit `http://localhost:3000` in your browser

3. **Check webhook logs:**
   ```bash
   cat /tmp/claude/-workspaces-talk-to-my-lawyer/tasks/b30ee57.output
   ```

4. **Verify STRIPE_WEBHOOK_SECRET:**
   - Make sure `.env.local` has the correct secret from Stripe CLI output
   - Restart dev server after updating

### Webhook Signature Verification Failed

This means the `STRIPE_WEBHOOK_SECRET` doesn't match:

```bash
# Get the current webhook secret from the running CLI
cat /tmp/claude/-workspaces-talk-to-my-lawyer/tasks/b30ee57.output | grep "webhook signing secret"

# Update .env.local with the correct secret
# Then restart: pnpm dev
```

### No Webhook Received

1. Check the webhook endpoint is accessible: `http://localhost:3000/api/stripe/webhook`
2. Verify Stripe CLI is forwarding to the correct URL
3. Check browser console for errors
4. Check Stripe Dashboard for webhook delivery status

## Environment Variables (All Set)

```bash
# These are already configured in .env.local:
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY_HERE
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE
```

## Stripe Dashboard Links

- **Test Dashboard**: https://dashboard.stripe.com/test/dashboard
- **Payments**: https://dashboard.stripe.com/test/payments
- **Webhooks**: https://dashboard.stripe.com/test/webhooks
- **Events**: https://dashboard.stripe.com/test/events
- **Customers**: https://dashboard.stripe.com/test/customers

## Quick Test Command

To quickly test if webhooks are working:

```bash
# Trigger a test checkout event
stripe trigger checkout.session.completed

# You should see it in the CLI output:
# > 2025-12-28 ... --> checkout.session.completed [evt_xxx]
```

## Current Setup Summary

- **Stripe CLI Version**: 1.19.0 (update to 1.34.0 available)
- **API Version**: 2025-12-15.clover
- **Account ID**: acct_1SgHmxJvE2aH079F
- **Webhook URL**: http://localhost:3000/api/stripe/webhook
- **Webhook Secret**: set via `STRIPE_WEBHOOK_SECRET` in your `.env.local` (copy from Stripe Dashboard or Stripe CLI output)
- **Status**: ✅ Active and forwarding

You're all set to test dummy payments!
