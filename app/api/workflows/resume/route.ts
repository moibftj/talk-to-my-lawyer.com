/**
 * Workflow Resume Endpoint
 * POST /api/workflows/resume
 *
 * Handles attorney approval/rejection decision for a letter.
 *
 * This replaces the old /api/letters/[id]/approve and /api/letters/[id]/reject endpoints.
 */
import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { requireAdminAuth } from "@/lib/auth/admin-guard"
import { successResponse, errorResponses, handleApiError } from "@/lib/api/api-error-handler"
import { validateCsrfToken } from "@/lib/security/csrf"
import { handleAttorneyDecision } from "@/app/workflows/letter-generation.workflow"
import { z } from "zod"

export const runtime = "nodejs"

// Request schema
const resumeSchema = z.object({
  letterId: z.string().uuid(),
  approved: z.boolean(),
  editedContent: z.string().optional(),
  notes: z.string().optional(),
  reason: z.string().optional(),
  csrfToken: z.string(),
})

/**
 * Handle attorney decision for a letter
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
      return errorResponses.badRequest("Invalid input", validation.error.flatten().fieldErrors)
    }

    const { letterId, approved, editedContent, notes, reason, csrfToken } = validation.data

    // 3. CSRF protection (critical for state-changing admin actions)
    const isCsrfValid = await validateCsrfToken(csrfToken)
    if (!isCsrfValid) {
      return errorResponses.forbidden("Invalid CSRF token")
    }

    // 4. Get the letter to find the user ID
    const supabase = await createClient()
    const { data: letter, error: letterError } = await supabase
      .from("letters")
      .select("user_id")
      .eq("id", letterId)
      .single()

    if (letterError || !letter) {
      return errorResponses.notFound("Letter not found")
    }

    // 5. Handle the attorney decision
    console.log(`[ResumeWorkflow] Processing decision for letter ${letterId}`)

    const result = await handleAttorneyDecision(letterId, letter.user_id, {
      approved,
      attorneyId: adminAuth.data.admin.id,
      editedContent,
      notes,
      reason,
    })

    if (!result.success) {
      return errorResponses.serverError(result.reason || "Failed to process decision")
    }

    console.log(`[ResumeWorkflow] Letter ${approved ? "approved" : "rejected"}`)

    return successResponse({
      message: `Letter ${approved ? "approved" : "rejected"} successfully`,
      letterId,
      status: result.status,
    })
  } catch (error) {
    return handleApiError(error, "ResumeWorkflow")
  }
}
