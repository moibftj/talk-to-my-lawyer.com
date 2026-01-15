# Workflow DevKit Implementation Plan

## Overview

Convert the letter generation process from manual state management to durable workflows using Workflow DevKit.

**Goal:** Simplify the letter lifecycle (9 states → 1 workflow) with automatic retries, observability, and cost-effective pausing.

---

## Current State vs Future State

### Current Implementation (Manual State Machine)

```
User → API → Database (status: draft)
         ↓
API → OpenAI → Database (status: generating)
         ↓
Database (status: pending_review) → Email to attorneys
         ↓
[POLLING] Check status repeatedly...
         ↓
Attorney UI → Database (status: under_review)
         ↓
Attorney UI → Database (status: approved)
         ↓
Cron job checks status → Send email → Database (status: sent)
```

**Problems:**
- ❌ 9 different status values to manage
- ❌ Polling for status changes (wasteful)
- ❌ Manual retry logic for each API call
- ❌ Manual audit trail logging
- ❌ Complex error recovery

### Future Implementation (Workflow DevKit)

```
User → Trigger Workflow
         ↓
[Workflow Step 1] Check allowance (atomic)
         ↓
[Workflow Step 2] Generate AI draft (auto-retry)
         ↓
[Workflow Step 3] Save to database
         ↓
[Workflow Step 4] Notify attorneys
         ↓
[SLEEP] Wait for approval (no server cost!)
         ↓
[Webhook] Attorney approves → Resume workflow
         ↓
[Workflow Step 5] Finalize letter
         ↓
[Workflow Step 6] Send to user (auto-retry)
         ↓
Done!
```

**Benefits:**
- ✅ Single workflow definition
- ✅ Automatic retries on all steps
- ✅ Sleep without server costs
- ✅ Full observability built-in
- ✅ Type-safe execution
- ✅ Automatic audit trail

---

## Implementation Phases

### Phase 1: Setup & Infrastructure (Week 1)

**1.1 Install Workflow DevKit**
```bash
pnpm add workflow
```

**1.2 Configure Next.js Integration**
```typescript
// next.config.mjs
import { withWorkflow } from "workflow/next"

const config = {
  // your existing config
}

export default withWorkflow(config)
```

**1.3 Create Workflow Directory Structure**
```
app/
  workflows/
    letter-generation.workflow.ts    # Main workflow
    steps/
      check-allowance.ts              # Atomic allowance check
      generate-ai-draft.ts            # OpenAI integration
      save-letter.ts                  # Database operations
      notify-attorneys.ts             # Email notifications
      finalize-letter.ts              # Final processing
      send-to-user.ts                 # User notification
  api/
    workflows/
      trigger/route.ts                # Start workflow
      resume/route.ts                 # Resume from webhook
      status/[id]/route.ts            # Check workflow status
```

**1.4 Setup Workflow Storage**

Workflow DevKit needs to store execution state. Options:
- **Local dev:** SQLite (automatic)
- **Production:** Vercel Postgres or Supabase (configure via env vars)

```env
# .env.local
WORKFLOW_DB_URL=postgresql://...  # Use Supabase connection string
```

---

### Phase 2: Convert Letter Generation (Week 2)

**2.1 Create Main Workflow**
```typescript
// app/workflows/letter-generation.workflow.ts
import { sleep, step } from "workflow"
import { checkAllowanceStep } from "./steps/check-allowance"
import { generateAIDraftStep } from "./steps/generate-ai-draft"
import { saveLetterStep } from "./steps/save-letter"
import { notifyAttorneysStep } from "./steps/notify-attorneys"
import { finalizeLetterStep } from "./steps/finalize-letter"
import { sendToUserStep } from "./steps/send-to-user"

export interface LetterGenerationInput {
  userId: string
  letterId: string
  letterType: string
  intakeData: any
  recipientInfo: any
}

export async function generateLetterWorkflow(input: LetterGenerationInput) {
  "use workflow"

  // Step 1: Check and deduct allowance (atomic)
  const allowance = await checkAllowanceStep(input.userId)
  if (!allowance.success) {
    throw new Error(`No allowance: ${allowance.error_message}`)
  }

  // Step 2: Generate AI draft (with automatic retries)
  const aiDraft = await generateAIDraftStep({
    letterType: input.letterType,
    intakeData: input.intakeData,
    recipientInfo: input.recipientInfo
  })

  // Step 3: Save draft to database
  await saveLetterStep(input.letterId, {
    status: "pending_review",
    ai_draft_content: aiDraft
  })

  // Step 4: Notify attorneys
  await notifyAttorneysStep({
    letterId: input.letterId,
    letterType: input.letterType
  })

  // Step 5: PAUSE until attorney approval
  // This is where the magic happens - no server cost!
  const approval = await sleep<AttorneyApproval>("attorney-approval")

  // Step 6: Process approval/rejection
  if (approval.approved) {
    // Finalize letter with attorney edits
    await finalizeLetterStep(input.letterId, {
      status: "approved",
      final_content: approval.editedContent,
      reviewed_by: approval.attorneyId,
      review_notes: approval.notes
    })

    // Send to user
    await sendToUserStep({
      userId: input.userId,
      letterId: input.letterId,
      letterType: input.letterType
    })

    return {
      success: true,
      status: "completed",
      letterId: input.letterId
    }
  } else {
    // Handle rejection
    await finalizeLetterStep(input.letterId, {
      status: "rejected",
      rejection_reason: approval.reason
    })

    // Notify user of rejection
    await sendToUserStep({
      userId: input.userId,
      letterId: input.letterId,
      letterType: input.letterType,
      rejected: true,
      reason: approval.reason
    })

    return {
      success: false,
      status: "rejected",
      letterId: input.letterId,
      reason: approval.reason
    }
  }
}

interface AttorneyApproval {
  approved: boolean
  attorneyId: string
  editedContent?: string
  notes?: string
  reason?: string
}
```

**2.2 Create Individual Steps**

Each step is a separate function with proper error handling and retries:

```typescript
// app/workflows/steps/check-allowance.ts
import { step } from "workflow"
import { createClient } from "@/lib/supabase/server"

export async function checkAllowanceStep(userId: string) {
  return await step("check-allowance", async () => {
    const supabase = await createClient()

    const { data, error } = await supabase.rpc(
      'check_and_deduct_allowance',
      { u_id: userId }
    )

    if (error) throw error

    return data
  })
}
```

```typescript
// app/workflows/steps/generate-ai-draft.ts
import { step } from "workflow"
import OpenAI from "openai"

export async function generateAIDraftStep(params: {
  letterType: string
  intakeData: any
  recipientInfo: any
}) {
  return await step("generate-ai-draft", async () => {
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })

    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a professional legal letter writer..."
        },
        {
          role: "user",
          content: JSON.stringify(params)
        }
      ]
    })

    return completion.choices[0].message.content
  }, {
    maxAttempts: 3,  // Retry up to 3 times
    backoff: "exponential"
  })
}
```

**2.3 Create API Routes**

```typescript
// app/api/workflows/trigger/route.ts
import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { safeApplyRateLimit, apiRateLimit } from "@/lib/rate-limit-redis"
import { successResponse, errorResponses, handleApiError } from "@/lib/api/api-error-handler"
import { generateLetterWorkflow } from "@/app/workflows/letter-generation.workflow"
import { runWorkflow } from "workflow/next"

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await safeApplyRateLimit(request, apiRateLimit, 10, "1 m")
    if (rateLimitResponse) return rateLimitResponse

    // Authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return errorResponses.unauthorized()

    // Role check
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (profile?.role !== "subscriber") {
      return errorResponses.forbidden("Only subscribers can generate letters")
    }

    // Get request body
    const body = await request.json()

    // Create letter record in database
    const { data: letter, error: letterError } = await supabase
      .from("letters")
      .insert({
        user_id: user.id,
        title: body.title,
        letter_type: body.letterType,
        status: "generating",
        intake_data: body.intakeData,
        recipient_name: body.recipientInfo?.name,
        recipient_email: body.recipientInfo?.email
      })
      .select()
      .single()

    if (letterError) throw letterError

    // Start the workflow
    const workflowRun = await runWorkflow(generateLetterWorkflow, {
      userId: user.id,
      letterId: letter.id,
      letterType: body.letterType,
      intakeData: body.intakeData,
      recipientInfo: body.recipientInfo
    })

    return successResponse({
      letterId: letter.id,
      workflowId: workflowRun.id,
      message: "Letter generation started"
    })
  } catch (error) {
    return handleApiError(error, "TriggerWorkflow")
  }
}
```

```typescript
// app/api/workflows/resume/route.ts
import { NextRequest } from "next/server"
import { resumeWorkflow } from "workflow/next"
import { requireAdminAuth } from "@/lib/auth/admin-guard"
import { successResponse, errorResponses, handleApiError } from "@/lib/api/api-error-handler"

export async function POST(request: NextRequest) {
  try {
    // Admin auth required (attorneys only)
    const adminAuth = await requireAdminAuth(request)
    if (!adminAuth.success) return adminAuth.response

    const body = await request.json()
    const { workflowId, approved, editedContent, notes, reason } = body

    // Resume the workflow with approval decision
    await resumeWorkflow(workflowId, "attorney-approval", {
      approved,
      attorneyId: adminAuth.data.admin.id,
      editedContent,
      notes,
      reason
    })

    return successResponse({
      message: "Workflow resumed",
      workflowId
    })
  } catch (error) {
    return handleApiError(error, "ResumeWorkflow")
  }
}
```

---

### Phase 3: Update UI & Attorney Portal (Week 3)

**3.1 Update Letter Generation Form**

Instead of submitting to `/api/generate-letter`, submit to `/api/workflows/trigger`:

```typescript
// components/letter-generation-form.tsx
async function handleSubmit(formData: FormData) {
  const response = await fetch("/api/workflows/trigger", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: formData.get("title"),
      letterType: formData.get("letterType"),
      intakeData: { /* ... */ },
      recipientInfo: { /* ... */ }
    })
  })

  const result = await response.json()

  if (result.success) {
    // Redirect to letter detail page
    router.push(`/dashboard/letters/${result.data.letterId}`)
  }
}
```

**3.2 Update Attorney Portal Review Actions**

```typescript
// app/attorney-portal/letters/[id]/page.tsx
async function handleApprove() {
  const response = await fetch("/api/workflows/resume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workflowId: letter.workflow_id,
      approved: true,
      editedContent: editedDraft,
      notes: reviewNotes
    })
  })

  if (response.ok) {
    toast.success("Letter approved!")
    router.push("/attorney-portal/letters")
  }
}

async function handleReject() {
  const response = await fetch("/api/workflows/resume", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workflowId: letter.workflow_id,
      approved: false,
      reason: rejectionReason
    })
  })

  if (response.ok) {
    toast.success("Letter rejected")
    router.push("/attorney-portal/letters")
  }
}
```

**3.3 Add Workflow Status Tracking**

```typescript
// components/letter-status.tsx
import { useWorkflowStatus } from "workflow/react"

export function LetterStatus({ workflowId }: { workflowId: string }) {
  const { status, currentStep, history } = useWorkflowStatus(workflowId)

  return (
    <div>
      <h3>Letter Status: {status}</h3>
      <p>Current Step: {currentStep}</p>

      {/* Timeline of all steps */}
      <ul>
        {history.map(step => (
          <li key={step.id}>
            {step.name}: {step.status}
            {step.error && <span>Error: {step.error}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}
```

---

### Phase 4: Migration Strategy (Week 4)

**4.1 Dual-Running Period**

Run both systems in parallel for 1-2 weeks:
- New letters use workflows
- Existing in-progress letters use old system
- Monitor workflow performance and errors

**4.2 Database Schema Updates**

Add workflow tracking to letters table:

```sql
-- Migration: Add workflow tracking
ALTER TABLE letters
  ADD COLUMN workflow_id TEXT,
  ADD COLUMN workflow_status TEXT;

CREATE INDEX idx_letters_workflow_id ON letters(workflow_id);
```

**4.3 Cleanup Old Code**

After validation period:
- Remove old state machine logic
- Archive old API endpoints
- Update CLAUDE.md with new workflow documentation
- Remove unused status values (keep for historical data)

---

## Benefits Summary

### Cost Savings
- **No polling:** Sleep during attorney review instead of checking status repeatedly
- **No queue infrastructure:** No Redis/RabbitMQ/SQS needed
- **Resource efficiency:** Server only active during actual work

### Developer Experience
- **Simpler code:** 1 workflow definition vs 9 state handlers
- **Type safety:** TypeScript throughout
- **Better debugging:** Full execution history and traces
- **Easier testing:** Test workflow steps independently

### Operational Benefits
- **Automatic retries:** OpenAI, email, database operations retry automatically
- **Full observability:** Every step logged with timing and errors
- **Audit trail:** Complete history of all operations
- **Error recovery:** Workflows can be manually resumed/repaired

### User Experience
- **Faster delivery:** No polling delays
- **More reliable:** Automatic retries prevent transient failures
- **Better visibility:** Real-time status updates
- **Consistent experience:** Predictable execution

---

## Risk Mitigation

### Risk 1: Workflow DevKit is new technology
**Mitigation:**
- Run in parallel with existing system initially
- Start with new letters only (don't migrate in-progress)
- Monitor closely for first 2 weeks
- Keep rollback plan ready

### Risk 2: Storage costs
**Mitigation:**
- Workflow state stored in Supabase (already paying for it)
- Archive completed workflows after 90 days
- Configure retention policies

### Risk 3: Learning curve
**Mitigation:**
- Start with one workflow (letter generation)
- Team training session (2 hours)
- Document patterns in CLAUDE.md
- Add to GitHub Copilot agents

---

## Success Metrics

**Week 1:**
- [ ] Workflow DevKit installed and configured
- [ ] First workflow running in dev
- [ ] Team trained on basics

**Week 2:**
- [ ] All workflow steps implemented
- [ ] Unit tests passing
- [ ] Integration tests passing

**Week 3:**
- [ ] UI updated to use workflows
- [ ] Attorney portal integrated
- [ ] Deployed to staging

**Week 4:**
- [ ] Running in production (new letters only)
- [ ] Monitoring dashboards configured
- [ ] No critical issues for 7 days

**Success Criteria:**
- 95%+ workflow success rate
- <1 minute from approval to user notification
- Zero polling-related costs
- Full audit trail for all letters

---

## Next Steps

1. **Review this plan** with the team
2. **Approve technology choice** (Workflow DevKit vs alternatives)
3. **Schedule implementation** (4-week timeline)
4. **Assign engineers** to each phase
5. **Start Phase 1** (setup & infrastructure)

---

**Questions? Concerns?**
- Is 4 weeks realistic for your team size?
- Should we do a proof-of-concept first?
- Any concerns about new dependencies?
