# CLAUDE.md — AI Assistant Developer Notes

Talk-To-My-Lawyer: AI legal letter drafts with **mandatory attorney review**.

Last updated: 2026-01-15

## Non‑negotiables (security + roles)

1. **Only subscribers can generate letters.** Employees and admins must never access letter generation APIs.
2. **Admin review is mandatory.** No “raw AI” letters reach subscribers.
3. **Employees never see letter content.** They only see coupon stats + commissions.
4. **Respect Supabase RLS.** Never disable Row Level Security.
5. **Do not leak secrets.** Never log env var values.
6. Use **pnpm only** (`pnpm-lock.yaml` is source of truth).

## Stack (high level)

- Next.js App Router + TypeScript + Tailwind
- Supabase (Postgres + Auth + RLS)
- OpenAI (draft generation)
- Stripe (payments)
- Resend (email) + email queue
- Upstash Redis (rate limiting; falls back to in-memory)
- Workflow DevKit (durable workflows for letter generation)
- OpenTelemetry tracing

## Key flows (mental model)

- **Letter lifecycle**: `draft` → `generating` → `pending_review` → `under_review` → `approved|rejected` → `completed|failed|sent`
  - After approval, letters can be marked as `completed` (downloaded) or `sent` (emailed)
  - **New letters** use Workflow DevKit for durable execution (see Workflows section below)
  - **Legacy letters** use direct API endpoints (gradually being phased out)
- **Subscription lifecycle**: `pending` (created) → payment verification → `active|past_due|canceled`
- **Allowance**: check/deduct via DB RPCs (atomic), refund on failures where applicable.
- **Review**: attorneys approve/reject with CSRF protection; audit trail tracks state changes.

## Repo "where is what"

- API routes: `app/api/**/route.ts`
- Subscriber UI: `app/dashboard/**`
- Admin portals: `app/secure-admin-gateway/**` (super admin) and `app/attorney-portal/**`
- Workflows: `app/workflows/**` (workflow definitions and steps)
- Server Supabase client: `lib/supabase/server.ts`
- Client Supabase client: `lib/supabase/client.ts`
- Shared API responses/errors: `lib/api/api-error-handler.ts`
- Rate limiting: `lib/rate-limit-redis.ts`
- Validation: `lib/validation/**`
- Request proxy: `proxy.ts` (Next.js request proxy)

## API route pattern (copy/paste)

All sensitive routes should follow this order:

1) rate limit → 2) auth → 3) role check → 4) validate/sanitize → 5) business logic → 6) consistent response

\`\`\`ts
import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { safeApplyRateLimit, apiRateLimit } from "@/lib/rate-limit-redis"
import { successResponse, errorResponses, handleApiError } from "@/lib/api/api-error-handler"

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await safeApplyRateLimit(request, apiRateLimit, 100, "1 m")
    if (rateLimitResponse) return rateLimitResponse

    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return errorResponses.unauthorized()

    // Role check example
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
    // if (profile?.role !== "subscriber") return errorResponses.forbidden("Only subscribers can ...")

    // Validate input + do work...
    return successResponse({ ok: true })
  } catch (error) {
    return handleApiError(error, "API")
  }
}
\`\`\`

## Endpoints (objective only)

### Auth

- `POST /api/auth/reset-password` — Send a password reset email.
- `POST /api/auth/update-password` — Update the user password after reset.

### Admin auth

- `POST /api/admin-auth/login` — Admin login (creates admin session; routes by sub-role).
- `POST /api/admin-auth/logout` — Admin logout (clears admin session).

### Profile

- `POST /api/create-profile` — Create/update the user profile row after signup.

### Checkout & billing

- `POST /api/create-checkout` — Create a checkout flow (Stripe session or free flow) for a plan/coupon.
- `POST /api/verify-payment` — Verify checkout and finalize subscription/credits.
- `GET /api/subscriptions/check-allowance` — Return remaining letter credits/allowance.
- `GET /api/subscriptions/billing-history` — Return billing history for the current user.
- `POST /api/subscriptions/activate` — Activate the current user’s subscription and apply allowances.
- `POST /api/subscriptions/reset-monthly` — Cron reset of monthly allowances.

### Letters

- `POST /api/generate-letter` — Generate an AI draft letter for a subscriber (for attorney review).
- `POST /api/letters/drafts` — Create/update a draft letter (autosave).
- `GET /api/letters/drafts` — List the user’s draft letters.

- `POST /api/letters/[id]/submit` — Submit a letter for attorney review.
- `POST /api/letters/[id]/start-review` — Mark a letter as under review (attorney/admin).

- `GET /api/letters/[id]/approve` — Get CSRF token for the approve action.
- `POST /api/letters/[id]/approve` — Approve a letter (attorney/admin action).
- `POST /api/letters/[id]/reject` — Reject a letter with a reason (attorney/admin action).
- `POST /api/letters/[id]/resubmit` — Resubmit a rejected letter.

- `POST /api/letters/[id]/complete` — Mark a letter as completed.
- `DELETE /api/letters/[id]/delete` — Delete a letter (when permitted).

- `POST /api/letters/[id]/improve` — Improve a specific letter via AI.
- `POST /api/letters/improve` — Improve provided letter content via AI (admin tool).

- `GET /api/letters/[id]/pdf` — Generate/download a letter PDF.
- `POST /api/letters/[id]/send-email` — Queue sending a letter by email.
- `GET /api/letters/[id]/audit` — Fetch a letter's audit trail.

### Workflows (new letter generation system)

- `POST /api/workflows/trigger` — Start a new letter generation workflow (replaces /api/generate-letter for new letters).
- `POST /api/workflows/resume` — Resume a paused workflow with attorney approval/rejection decision.
- `GET /api/workflows/status/[id]` — Query workflow execution status and history.

### Admin

- `GET /api/admin/csrf` — Get a CSRF token for admin actions.
- `GET /api/admin/letters` — List letters for admin review/management.
- `POST /api/admin/letters/[id]/update` — Update a letter (admin edit).
- `POST /api/admin/letters/batch` — Bulk update letters (admin).

- `GET /api/admin/analytics` — Fetch admin analytics/stats.

- `GET /api/admin/coupons` — List coupons and usage stats.
- `POST /api/admin/coupons/create` — Create a promo coupon.
- `PATCH /api/admin/coupons/create` — Toggle promo coupon active status.

- `GET /api/admin/email-queue` — View email queue items + stats.
- `POST /api/admin/email-queue` — Trigger queue processing or manage retries/cleanup.

### Employee

- `GET /api/employee/referral-link` — Get employee coupon + referral/share links.
- `GET /api/employee/payouts` — Get employee commission/payout summary.
- `POST /api/employee/payouts` — Request a commission payout.

### GDPR

- `POST /api/gdpr/accept-privacy-policy` — Record privacy policy acceptance/consents.
- `GET /api/gdpr/accept-privacy-policy` — Check acceptance for a required version.

- `POST /api/gdpr/export-data` — Create (and possibly immediately fulfill) a user data export request.
- `GET /api/gdpr/export-data` — List recent export requests for the current user.

- `POST /api/gdpr/delete-account` — Create an account deletion request.
- `GET /api/gdpr/delete-account` — List deletion requests/status for the current user.
- `DELETE /api/gdpr/delete-account` — Admin executes an approved deletion request.

### Email queue cron

- `POST /api/cron/process-email-queue` — Process queued emails (cron-secured).
- `GET /api/cron/process-email-queue` — Health/status for the cron endpoint.

### Stripe

- `POST /api/stripe/webhook` — Handle Stripe webhook events.

### Health

- `GET /api/health` — Basic service health check.
- `GET /api/health/detailed` — Detailed health diagnostics.

## Admin auth

- Prefer `requireAdminAuth()` from `lib/auth/admin-guard.ts` for admin-only routes.
- "Admin portal key" is a **3rd factor** for admin login (do not bypass).
- **Admin sub-roles**:
  - `super_admin` - Full system access (super admin gateway)
  - `attorney_admin` - Letter review and approval only (attorney portal)
  - `system_admin` - Legacy/deprecated (use super_admin instead)

## Environment variables (minimum)

- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- OpenAI: `OPENAI_API_KEY`
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`
- Admin: `ADMIN_PORTAL_KEY`
- Cron: `CRON_SECRET`
- Security: `CSRF_SECRET` (min 32 chars for CSRF token signing)
- Workflows: `WORKFLOW_DB_URL` (Postgres connection string for workflow state storage - same as Supabase)
- Email (at least one provider): `RESEND_API_KEY` + `EMAIL_FROM`
- Rate limiting (optional): `KV_REST_API_URL`, `KV_REST_API_TOKEN` (Upstash Redis)

## Workflows (Workflow DevKit)

The letter generation process now uses **Workflow DevKit** for durable, resumable execution. This replaces the manual state machine with automatic retries, sleep functionality, and full observability.

**Key benefits:**
- Single workflow definition replaces 10+ API endpoints
- Automatic retries on all steps (OpenAI, email, database)
- Sleep without server cost during attorney review (can pause for days)
- Full execution history and observability
- Type-safe execution throughout

**Architecture:**

\`\`\`ts
// app/workflows/letter-generation.workflow.ts
export async function generateLetterWorkflow(input: LetterInput) {
  "use workflow"

  // Step 1: Check allowance (atomic)
  const allowance = await checkAllowanceStep(input.userId)

  // Step 2: Generate AI draft (auto-retry)
  const aiDraft = await generateDraftStep(input)

  // Step 3: Save to database
  await saveDraftStep(input.letterId, aiDraft)

  // Step 4: Notify attorneys
  await notifyAttorneysStep(input.letterId)

  // Step 5: SLEEP until approval (no server cost!)
  const approval = await sleep<ApprovalDecision>("attorney-approval")

  // Step 6: Finalize letter
  await finalizeLetterStep(input.letterId, approval)

  // Step 7: Notify user (auto-retry)
  await notifyUserStep(input.userId, input.letterId, approval)
}
\`\`\`

**Workflow steps** live in `app/workflows/steps/`:
- `check-allowance.ts` - Atomic credit check/deduction
- `generate-draft.ts` - AI generation with retries
- `save-letter.ts` - Database operations
- `notify-attorneys.ts` - Admin notifications
- `finalize-letter.ts` - Process approval/rejection
- `notify-user.ts` - User notifications

**API endpoints:**
- `POST /api/workflows/trigger` - Start new workflow
- `POST /api/workflows/resume` - Resume with attorney decision
- `GET /api/workflows/status/[id]` - Query workflow status

**Database tracking:**

Letters table includes workflow tracking columns:
- `workflow_id` - Workflow execution ID
- `workflow_status` - Current status (running, completed, failed, paused)
- `workflow_started_at` - Start timestamp
- `workflow_completed_at` - Completion timestamp
- `workflow_error` - Error message if failed

**Migration status:**
- ✅ Week 1-2: Infrastructure and implementation complete
- ⏳ Week 3-4: UI integration, database migration, testing
- 🔄 **Dual running**: New letters use workflows, legacy letters use old endpoints
- 📝 **Future**: Gradually phase out legacy endpoints

**Configuration:**

See `docs/WORKFLOW_CONFIGURATION.md` for detailed setup instructions.

## Email (Resend)

- Templates live in `lib/email/templates.ts` and are keyed by `EmailTemplate` (see `lib/email/types.ts`).
- Use `sendTemplateEmail()` / `sendEmail()` from `lib/email/service.ts` for direct sends.
- For reliability (retries + persistence), enqueue via `lib/email/queue.ts` and process via `POST /api/cron/process-email-queue` (or the super-admin tools under `/api/admin/email-queue`).

**Send a template (direct):**

\`\`\`ts
import { sendTemplateEmail } from "@/lib/email/service"

await sendTemplateEmail("letter-approved", userEmail, {
  userName: "…",
  letterTitle: "…",
  letterLink: "…",
})
\`\`\`

**Add/modify a template:**

1) Update `EmailTemplate` (if adding a new key) in `lib/email/types.ts`.
2) Implement the template in `lib/email/templates.ts` (subject + `text` + `html`).

**Config:**

- Resend: `RESEND_API_KEY`
- Sender: `EMAIL_FROM` (and optional `EMAIL_FROM_NAME`)

## Commands

\`\`\`bash
pnpm install
pnpm dev
pnpm lint
CI=1 pnpm build
pnpm validate-env
\`\`\`

## Pointers (use these instead of duplicating details here)

- Setup/config: `docs/SETUP_AND_CONFIGURATION.md`
- Architecture/dev: `docs/ARCHITECTURE_AND_DEVELOPMENT.md`
- Security: `docs/SECURITY.md`
- DB & RLS: `docs/DATABASE.md`
- RLS migration verification: `docs/RLS_MIGRATION_VERIFICATION.md` (critical for production)
- API integrations: `docs/API_AND_INTEGRATIONS.md`
- Operations/deploy: `docs/OPERATIONS.md`, `docs/DEPLOYMENT_GUIDE.md`
- Workflows: `docs/WORKFLOW_IMPLEMENTATION_PLAN.md`, `docs/WORKFLOW_IMPLEMENTATION_PROGRESS.md`, `docs/WORKFLOW_CONFIGURATION.md`
