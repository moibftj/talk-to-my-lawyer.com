/**
 * Workflow Status Endpoint
 * GET /api/workflows/status/[id]
 *
 * Returns the current status of a workflow execution.
 *
 * Useful for:
 * - Polling workflow progress in the UI
 * - Debugging workflow execution
 * - Displaying real-time status updates
 */
import { NextRequest } from "next/server"
import { getWorkflowStatus } from "workflow/next"
import { createClient } from "@/lib/supabase/server"
import { safeApplyRateLimit, apiRateLimit } from "@/lib/rate-limit-redis"
import { successResponse, errorResponses, handleApiError } from "@/lib/api/api-error-handler"

export const runtime = "nodejs"

interface RouteParams {
  params: Promise<{
    id: string
  }>
}

/**
 * Get workflow execution status
 */
export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    // 1. Rate limiting
    const rateLimitResponse = await safeApplyRateLimit(
      request,
      apiRateLimit,
      100,
      "1 m"
    )
    if (rateLimitResponse) return rateLimitResponse

    // 2. Authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return errorResponses.unauthorized()

    // 3. Get workflow status
    const { id: workflowId } = await params

    if (!workflowId) {
      return errorResponses.badRequest("Workflow ID is required")
    }

    console.log(`[WorkflowStatus] Fetching status for ${workflowId}`)

    const status = await getWorkflowStatus(workflowId)

    if (!status) {
      return errorResponses.notFound("Workflow not found")
    }

    // 4. Authorization check - verify user owns this workflow
    // (Workflow DevKit should have user context, but we add extra check)
    // TODO: Add workflow ownership verification if needed

    console.log(`[WorkflowStatus] Status: ${status.status}`)

    return successResponse({
      workflowId,
      status: status.status,
      currentStep: status.currentStep,
      startedAt: status.startedAt,
      completedAt: status.completedAt,
      error: status.error,
      history: status.history,
    })

  } catch (error) {
    return handleApiError(error, "WorkflowStatus")
  }
}
