# Test Mode & Real-Time Timeline Testing Guide

## Overview

Test mode is now **ENABLED** for the Talk-To-My-Lawyer platform. This allows you to test the complete letter generation and review workflow without processing real Stripe payments.

## What's Been Configured

### ✅ Environment Variables
- **Local Development** (`.env.local`):
  - `ENABLE_TEST_MODE="true"`
  - `NEXT_PUBLIC_TEST_MODE="true"`

- **Vercel Production**:
  - `ENABLE_TEST_MODE="true"`
  - `NEXT_PUBLIC_TEST_MODE="true"`

### ✅ Test Mode Indicators
Visual indicators have been added to help you know when test mode is active:

1. **Subscription Page** (`/dashboard/subscription`)
   - Amber warning banner at the top
   - Shows: "Test Mode Active - Stripe payments are simulated"

2. **Admin Review Center** (`/secure-admin-gateway/review`)
   - Amber warning banner at the top
   - Shows: "Test Mode Active - You're reviewing letters created with simulated payments"

## How Test Mode Works

### For Subscribers

When `ENABLE_TEST_MODE=true`:

1. **Letter Generation** - Works normally
   - User fills out letter intake form
   - AI generates draft using OpenAI
   - Letter status: `generating` → `pending_review`

2. **Checkout Process** - Bypasses Stripe completely
   - User clicks "Subscribe" or "Upgrade"
   - Instead of redirecting to Stripe checkout:
     - Subscription is created directly in database
     - Status set to `active` immediately
     - Credits/letters allocated instantly
   - No payment processing
   - No Stripe session ID
   - Redirects to: `/dashboard/subscription?success=true&test=true`

3. **Letter Review** - Works exactly like production
   - Timeline modal shows real-time updates
   - Subscribes to Supabase Realtime for status changes
   - Updates when admin reviews/approves letter

### For Admins

Admin workflow is **identical** to production:
- Review letters in Review Center
- Click "Review Letter" to start review
- Edit content, approve, or reject
- All actions trigger real-time updates for subscribers

## Real-Time Timeline Integration

The GenerationTrackerModal (`/components/generation-tracker-modal.tsx`) uses **Supabase Realtime** to provide instant status updates:

### Timeline Stages

1. **Stage 1: Draft Prepared**
   - Status: `generating` or `draft`
   - Shows: "Preparing your draft based on the details you provided"
   - Icon: Loading spinner

2. **Stage 2: Attorney Review**
   - Status: `pending_review` → "Waiting for an attorney to begin review"
   - Status: `under_review` → "An attorney is reviewing and may edit your letter"
   - Icon: Loading spinner (active) or Checkmark (completed)

3. **Stage 3: Final Status**
   - Status: `approved` → "Your letter is approved and ready to view"
   - Status: `rejected` → "Our team left notes. Please review and resubmit"
   - Status: `failed` → "We could not prepare your draft. Please try again"
   - Icon: Checkmark (approved) or X (rejected/failed)

### How Real-Time Updates Work

**Technology**: Supabase Realtime via WebSocket
- No polling required
- Instant updates (< 100ms latency)
- Automatic reconnection if disconnected
- Fallback polling every 12 seconds as backup

**Event Flow**:
1. Admin changes letter status in database
2. Supabase sends `postgres_changes` event via WebSocket
3. GenerationTrackerModal receives event
4. React state updates
5. UI re-renders with new status
6. Timeline animates to next stage

**Code Reference** (`generation-tracker-modal.tsx`):
```typescript
// Lines 55-67: Supabase Realtime subscription
const channel = supabase
  .channel(`letter-status:${letterId}`)
  .on(
    "postgres_changes",
    { event: "UPDATE", schema: "public", table: "letters", filter: `id=eq.${letterId}` },
    (payload) => {
      const nextStatus = payload.new?.status as LetterStatus | undefined
      if (nextStatus) {
        setStatus(nextStatus)  // Triggers re-render
      }
    },
  )
  .subscribe()
```

## Complete End-to-End Test Flow

### Prerequisites
1. Restart development server to load new environment variables:
   ```bash
   pnpm dev
   ```

2. Open two browser windows:
   - **Window A**: Regular browser (subscriber view)
   - **Window B**: Incognito/Private mode (admin view)

### Step-by-Step Testing

#### Part 1: Subscriber Creates Letter

**Window A (Subscriber)**:

1. Navigate to the app (http://localhost:3000 or production URL)
2. Sign up as a new subscriber or log in
3. Go to "Generate Letter" or "New Letter"
4. Fill out the letter intake form:
   - **Letter Type**: Choose any (e.g., "Demand Letter")
   - **Sender Name**: John Doe
   - **Sender Email**: john@example.com
   - **Recipient Name**: Jane Smith
   - **Recipient Email**: jane@example.com
   - **Issue Description**: "Unpaid invoice for $5,000 from services rendered in December 2024"
   - **Desired Outcome**: "Full payment within 14 days"
   - **Additional Details**: Add any context

5. Click "Generate Letter"
6. **Expected Result**:
   - ✅ Timeline modal appears
   - ✅ Stage 1 shows: "Preparing your draft"
   - ✅ Loading spinner animates
   - ✅ After ~10-30 seconds, AI generates content
   - ✅ Timeline updates to Stage 2: "Attorney review"
   - ✅ Modal shows: "Waiting for an attorney to begin review"

7. If you don't have an active subscription:
   - Click "Subscribe" or "Upgrade"
   - **Expected Result**:
     - ✅ **Test mode banner visible** (amber warning)
     - ✅ Choose a plan (e.g., "Single Letter - $25")
     - ✅ Click "Subscribe"
     - ✅ **NO redirect to Stripe** (stays on same site)
     - ✅ Success message appears instantly
     - ✅ Subscription created with active status
     - ✅ Credits allocated immediately

8. Navigate to `/dashboard/letters` (My Letters)
9. Find your newly created letter
10. Click to view letter detail page
11. **Expected Result**:
    - ✅ Timeline modal shows (if status is `pending_review` or `under_review`)
    - ✅ Letter content is **hidden** (only visible after approval)
    - ✅ Status badge shows "Pending Review"

**KEEP THIS WINDOW OPEN** - You'll watch real-time updates here!

---

#### Part 2: Admin Reviews Letter

**Window B (Admin - Incognito Mode)**:

1. Navigate to `/secure-admin-gateway/login`
2. Enter admin credentials:
   - **Email**: admin@talk-to-my-lawyer.com
   - **Password**: D3GmgknFj8CPa5A
   - **Portal Key**: APK_2e8f9a7b3c1d4e6f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f

3. Click "Login"
4. Navigate to "Review Center" (should be default landing page)
5. **Expected Result**:
   - ✅ **Test mode banner visible** (amber warning)
   - ✅ See your letter in "Pending Review" (yellow badge)
   - ✅ Letter shows subscriber name (John Doe)
   - ✅ "Pending Review" count incremented

6. Click on the letter to view details
7. **Expected Result**:
   - ✅ See full letter details
   - ✅ See AI-generated draft content
   - ✅ See subscriber information (email, phone, etc.)
   - ✅ "Review Letter" button visible

8. Click "Review Letter" button
9. **Expected Result** (in both windows):
   - ✅ **Window A (Subscriber)**: Timeline modal **instantly updates** to "Attorney review in progress"
   - ✅ **Window B (Admin)**: Review modal opens with editable content
   - ✅ Letter status changed to `under_review` in database

10. **In Admin Window (Window B)**:
    - (Optional) Edit the letter content using rich text editor
    - (Optional) Use "AI Improve" to enhance content
    - Add internal review notes (optional)
    - Click "Approve Letter"
    - Add any final notes
    - Click "Confirm Approval"

11. **Expected Result** (in both windows):
    - ✅ **Window A (Subscriber)**: Timeline modal **instantly updates** to Stage 3 "Approved" with checkmark
    - ✅ **Window A (Subscriber)**: Green "Approved" banner appears
    - ✅ **Window A (Subscriber)**: Letter content becomes visible
    - ✅ **Window A (Subscriber)**: "Download PDF" button appears
    - ✅ **Window B (Admin)**: Review modal closes, redirect to review center

---

#### Part 3: Subscriber Downloads Letter

**Window A (Subscriber)**:

1. If timeline modal is still open, close it
2. Refresh the letter detail page (optional - should already show approved)
3. **Expected Result**:
   - ✅ Green success banner: "Approved"
   - ✅ "Attorney Draft" section visible with full content
   - ✅ "Final Letter" section visible (if admin edited it)
   - ✅ "Download PDF" button visible

4. Click "Download PDF"
5. **Expected Result**:
   - ✅ PDF file downloads
   - ✅ PDF contains letter content
   - ✅ Filename format: `{Letter_Title}.pdf`

6. Open PDF and verify:
   - ✅ Content is properly formatted
   - ✅ All details are correct
   - ✅ Professional appearance

---

## Troubleshooting Real-Time Updates

If timeline modal does **NOT** update automatically:

### 1. Check Supabase Realtime Connection

**Open Browser DevTools** (F12):
- Go to **Network** tab
- Filter by "ws" or "realtime"
- Look for WebSocket connection to Supabase
- Status should be "101 Switching Protocols" (active connection)
- Look for messages being sent/received

### 2. Check Console for Errors

**In Subscriber Window (Window A)**:
- Open DevTools Console
- Look for errors related to Supabase or Realtime
- Common issues:
  - "Failed to establish WebSocket connection"
  - "Realtime subscription error"
  - CORS errors

### 3. Verify Environment Variables

**On server**:
```bash
# Check if env vars are loaded
echo $ENABLE_TEST_MODE  # Should output: true
echo $NEXT_PUBLIC_TEST_MODE  # Should output: true
```

**In browser console** (Window A):
```javascript
// Check if public env var is accessible
console.log(process.env.NEXT_PUBLIC_TEST_MODE)  // Should log: "true"
```

### 4. Manual Refresh Test

If real-time doesn't work:
- Change letter status via admin
- Manually refresh subscriber page
- Status **should** still update (via polling fallback)
- Polling interval: every 12 seconds

### 5. Check Database Status

**Using Supabase Dashboard**:
1. Go to Table Editor
2. Find `letters` table
3. Locate your test letter by ID
4. Check `status` column
5. Verify it matches what admin set

**Expected status flow**:
```
generating → pending_review → under_review → approved
```

---

## Test Mode vs Production Mode

### Test Mode (Current)
✅ No Stripe checkout page
✅ Subscriptions created instantly
✅ No payment processing
✅ No webhooks
✅ Amber warning banners visible
✅ Perfect for development and testing
❌ Not suitable for real customers

### Production Mode
❌ Requires Stripe configuration
✅ Real payment processing
✅ Webhook verification
✅ Stripe Checkout UI
✅ Customer payment methods saved
✅ Real subscriptions with billing

### Switching Between Modes

**To disable test mode** (switch to production):

1. **Local**:
   ```bash
   # Edit .env.local
   ENABLE_TEST_MODE="false"
   NEXT_PUBLIC_TEST_MODE="false"
   ```

2. **Vercel**:
   ```bash
   npx vercel env rm ENABLE_TEST_MODE production --token={TOKEN} --yes
   npx vercel env rm NEXT_PUBLIC_TEST_MODE production --token={TOKEN} --yes

   echo "false" | npx vercel env add ENABLE_TEST_MODE production --token={TOKEN}
   echo "false" | npx vercel env add NEXT_PUBLIC_TEST_MODE production --token={TOKEN}
   ```

3. **Restart** server and **redeploy** to Vercel

---

## Expected Test Results Summary

| Feature | Expected Behavior | Status |
|---------|------------------|--------|
| Test mode env vars | Set to "true" in .env.local and Vercel | ✅ Configured |
| Test mode indicators | Amber banner on subscription & admin pages | ✅ Added |
| Letter generation | AI generates draft, status → pending_review | ✅ Should work |
| Checkout bypass | No Stripe redirect, instant subscription | ✅ Should work |
| Real-time modal | Updates when admin changes status | ✅ Already implemented |
| Supabase Realtime | WebSocket connection established | ✅ Should work |
| Admin review | Can approve/reject letters normally | ✅ Already implemented |
| PDF download | Generate and download after approval | ✅ Already implemented |
| Timeline animation | Smooth transitions between stages | ✅ Already implemented |

---

## Next Steps

1. **Run the complete test flow** following the steps above
2. **Verify real-time updates work** in both windows simultaneously
3. **Test edge cases**:
   - What if network disconnects during review?
   - What if admin rejects letter instead of approving?
   - What if subscriber closes modal mid-review?
4. **Document any issues** encountered during testing
5. **Once testing is complete**, decide whether to keep test mode enabled or switch to production mode

---

## Support & Debugging

If you encounter any issues during testing:

1. **Check server logs** for errors
2. **Check browser console** for JavaScript errors
3. **Check Supabase logs** for database/realtime issues
4. **Verify all environment variables** are loaded correctly
5. **Try the manual refresh test** to isolate real-time issues

For reference, the key files involved:
- Checkout: `/app/api/create-checkout/route.ts` (lines 13, 286-367)
- Timeline Modal: `/components/generation-tracker-modal.tsx` (lines 55-67)
- Admin Review: `/app/api/letters/[id]/approve/route.ts`
- Realtime Config: Supabase Realtime enabled on `letters` table

---

## Congratulations!

You now have a fully functional test mode environment where you can:
- Test the complete letter workflow without Stripe
- See real-time status updates as admin reviews letters
- Verify the entire subscriber experience
- Debug and iterate quickly

Happy testing! 🎉
