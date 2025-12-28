# Stripe Setup Guide

This guide explains how to configure Stripe for the Talk-To-My-Lawyer platform.

## Environment Variables

Your `.env.local` file should contain these Stripe variables:

```bash
# Stripe Configuration
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY_HERE
STRIPE_PUBLISHABLE_KEY=pk_test_YOUR_PUBLISHABLE_KEY_HERE
STRIPE_SECRET_KEY=sk_test_YOUR_SECRET_KEY_HERE
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET_HERE
```

## Stripe CLI Installation

The Stripe CLI is installed for webhook forwarding during local development.

### Verify Installation

```bash
stripe --version
# Should output: stripe version 1.19.0
```

## Local Development with Webhooks

### Option 1: Automated Setup (Recommended)

Run the webhook setup script:

```bash
./scripts/setup-stripe-webhooks.sh
```

This script will:

1. Authenticate with Stripe (using your STRIPE_SECRET_KEY)
2. Start forwarding webhooks to `http://localhost:3000/api/stripe/webhook`
3. Listen for relevant payment events

### Option 2: Manual Setup

1. **Start your dev server:**

   ```bash
   pnpm dev
   ```

2. **In a new terminal, login to Stripe:**

   ```bash
   stripe login --api-key sk_test_YOUR_SECRET_KEY_HERE
   ```

3. **Start webhook forwarding:**

   ```bash
   stripe listen --forward-to http://localhost:3000/api/stripe/webhook \
     --events checkout.session.completed \
     --events customer.subscription.created \
     --events customer.subscription.updated \
     --events customer.subscription.deleted \
     --events invoice.paid \
     --events invoice.payment_failed \
     --events payment_intent.succeeded \
     --events payment_intent.payment_failed
   ```

4. **Copy the webhook secret:**

   The CLI will output a webhook secret like:

   ```
   whsec_1234567890abcdef...
   ```

   Copy this and update your `.env.local`:

   ```bash
   STRIPE_WEBHOOK_SECRET=whsec_1234567890abcdef...
   ```

5. **Test a payment:**

   - Go to your local app: http://localhost:3000
   - Navigate to pricing/checkout
   - Use Stripe test card: `4242 4242 4242 4242`
   - Check the webhook logs in your terminal

## Important Endpoints

The platform uses these Stripe webhook events:

- `checkout.session.completed` - When a user completes payment
- `customer.subscription.created` - New subscription created
- `customer.subscription.updated` - Subscription changes (plan changes, etc.)
- `customer.subscription.deleted` - Subscription cancelled
- `invoice.paid` - Recurring payment succeeded
- `invoice.payment_failed` - Recurring payment failed
- `payment_intent.succeeded` - One-time payment succeeded
- `payment_intent.payment_failed` - One-time payment failed

## Webhook Endpoint

The webhook endpoint is located at:

```
/app/api/stripe/webhook/route.ts
```

## Testing Payments

Use these test card numbers:

- **Success:** `4242 4242 4242 4242`
- **Decline:** `4000 0000 0000 0002`
- **Insufficient funds:** `4000 0000 0000 9995`
- **Expired card:** `4000 0000 0000 0069`

For any test card:

- **Expiry:** Any future date
- **CVC:** Any 3 digits
- **ZIP:** Any 5 digits

## Troubleshooting

### Common Issues

1. **Webhook secret mismatch:**

   - Ensure `STRIPE_WEBHOOK_SECRET` in `.env.local` matches the CLI output
   - Restart your dev server after updating the secret

2. **Events not firing:**

   - Check that the Stripe CLI is running and connected
   - Verify the endpoint URL is correct (`http://localhost:3000/api/stripe/webhook`)
   - Check the webhook logs in both the CLI and your app logs

3. **Authentication errors:**
   - Verify your `STRIPE_SECRET_KEY` is correct and has the right permissions
   - Ensure you're using the test key (starts with `sk_test_`) for development

### Debug Commands

```bash
# Check Stripe CLI connection
stripe --version

# List webhook endpoints (if any are configured)
stripe webhook_endpoints list

# View recent events
stripe events list --limit 10

# Test webhook forwarding
stripe listen --forward-to http://localhost:3000/api/stripe/webhook --print-secret
```

## Production Setup

For production deployment:

1. **Get your live API keys from the Stripe Dashboard**
2. **Set up a production webhook endpoint** in the Stripe Dashboard
3. **Update environment variables** with production keys
4. **Configure webhook events** for your production endpoint

The production webhook URL will be:

```
https://yourdomain.com/api/stripe/webhook
```

Make sure to configure the same events that you're listening for in development.

## Security Notes

- Never commit actual API keys to version control
- Use environment variables for all sensitive configuration
- The webhook secret should be different between development and production
- Always use HTTPS for production webhook endpoints
- Verify webhook signatures in your endpoint handler
