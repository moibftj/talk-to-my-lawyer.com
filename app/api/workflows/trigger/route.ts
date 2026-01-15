/**
 * Workflow Trigger Endpoint
 * POST /api/workflows/trigger
 *
 * Starts a new letter generation workflow.
 *
 * This replaces the old /api/generate-letter endpoint.
 */
import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { safeApplyRateLimit, letterGenerationRateLimit } from "@/lib/rate-limit-redis"
import { successResponse, errorResponses, handleApiError } from "@/lib/api/api-error-handler"
import { validateLetterGenerationRequest } from "@/lib/validation/letter-schema"
import { generateLetterWorkflow } from "@/app/workflows/letter-generation.workflow"
import { runWorkflow } from "workflow/next"

export const runtime = "nodejs"

/**
 * Start a new letter generation workflow
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Rate limiting
    const rateLimitResponse = await safeApplyRateLimit(
      request,
      letterGenerationRateLimit,
      5,
      "1 h"
    )
    if (rateLimitResponse) return rateLimitResponse

    // 2. Authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return errorResponses.unauthorized()

    // 3. Role check - only subscribers can generate letters
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (profile?.role !== "subscriber") {
      return errorResponses.forbidden("Only subscribers can generate letters")
    }

    // 4. Validate input
    const body = await request.json()
    const { letterType, intakeData, recipientInfo, title } = body

    const validation = validateLetterGenerationRequest(letterType, intakeData)
    if (!validation.valid) {
      console.error("[TriggerWorkflow] Validation failed:", validation.errors)
      return errorResponses.validation("Invalid input data", validation.errors)
    }

    // 5. Start the workflow
    console.log('[TriggerWorkflow] Starting letter generation workflow')

    const workflowRun = await runWorkflow(generateLetterWorkflow, {
      userId: user.id,
      letterType,
      intakeData: validation.data!,
      recipientInfo,
      title,
    })

    console.log(`[TriggerWorkflow] Workflow started: ${workflowRun.id}`)

    return successResponse({
      workflowId: workflowRun.id,
      message: "Letter generation started",
      status: "processing",
    })

  } catch (error) {
    return handleApiError(error, "TriggerWorkflow")
  }
}
