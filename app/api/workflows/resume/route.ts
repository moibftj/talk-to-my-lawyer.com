/**
 * Workflow Resume Endpoint
 * POST /api/workflows/resume
 *
 * Resumes a paused workflow with attorney approval/rejection decision.
 *
 * This replaces the old /api/letters/[id]/approve and /api/letters/[id]/reject endpoints
 * for workflows.
 */
import { NextRequest } from "next/server"
import { resumeWorkflow } from "workflow/next"
import { requireAdminAuth } from "@/lib/auth/admin-guard"
import { successResponse, errorResponses, handleApiError } from "@/lib/api/api-error-handler"
import { validateCsrfToken } from "@/lib/security/csrf"
import { z } from "zod"

export const runtime = "nodejs"

// Request schema
const resumeSchema = z.object({
  workflowId: z.string().uuid(),
  approved: z.boolean(),
  editedContent: z.string().optional(),
  notes: z.string().optional(),
  reason: z.string().optional(),
  csrfToken: z.string(),
})

/**
 * Resume a workflow with attorney decision
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Admin auth required (attorneys only)
    const adminAuth = await requireAdminAuth(request)
    if (!adminAuth.success) return adminAuth.response

    // 2. Validate input
    const body = await request.json()
    const validation = resumeSchema.safeParse(body)

    if (!validation.success) {
      return errorResponses.badRequest(
        "Invalid input",
        validation.error.flatten().fieldErrors
      )
    }

    const { workflowId, approved, editedContent, notes, reason, csrfToken } = validation.data

    // 3. CSRF protection (critical for state-changing admin actions)
    const isCsrfValid = await validateCsrfToken(csrfToken)
    if (!isCsrfValid) {
      return errorResponses.forbidden("Invalid CSRF token")
    }

    // 4. Resume the workflow with approval decision
    console.log(`[ResumeWorkflow] Resuming workflow ${workflowId}`)

    await resumeWorkflow(workflowId, "attorney-approval", {
      approved,
      attorneyId: adminAuth.data.admin.id,
      editedContent,
      notes,
      reason,
    })

    console.log(`[ResumeWorkflow] Workflow resumed: ${approved ? 'approved' : 'rejected'}`)

    return successResponse({
      message: `Letter ${approved ? 'approved' : 'rejected'} successfully`,
      workflowId,
      status: approved ? "approved" : "rejected",
    })

  } catch (error) {
    return handleApiError(error, "ResumeWorkflow")
  }
}
