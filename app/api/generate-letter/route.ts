/**
 * Letter generation endpoint
 * POST /api/generate-letter
 *
 * Handles AI-powered letter generation with:
 * - User authentication and authorization
 * - Allowance checking (free trial, paid, super user)
 * - AI generation with retry logic
 * - Audit trail logging
 * - Admin notifications
 */
import { createClient } from "@/lib/supabase/server"
import { type NextRequest } from "next/server"
import { letterGenerationRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'
import { validateLetterGenerationRequest } from '@/lib/validation/letter-schema'
import { generateTextWithRetry } from '@/lib/ai/openai-retry'
import { getAdminEmails } from '@/lib/admin/letter-actions'
import { sendTemplateEmail } from '@/lib/email/service'
import { successResponse, errorResponses, handleApiError } from '@/lib/api/api-error-handler'
import {
  checkGenerationEligibility,
  deductLetterAllowance,
  refundLetterAllowance,
  incrementTotalLetters,
  shouldSkipDeduction,
} from '@/lib/services/allowance-service'
import type { LetterGenerationResponse } from '@/lib/types/letter.types'

export const runtime = "nodejs"

/**
 * Generate a letter using AI
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Apply rate limiting
    const rateLimitResponse = await safeApplyRateLimit(request, letterGenerationRateLimit, 5, "1 h")
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    const supabase = await createClient()

    // 2. Auth Check
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return errorResponses.unauthorized()
    }

    // 3. Role Check
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()

    if (profile?.role !== "subscriber") {
      return errorResponses.forbidden("Only subscribers can generate letters")
    }

    // 4. Check generation eligibility (free trial, allowance, super user)
    const eligibility = await checkGenerationEligibility(user.id)

    if (!eligibility.canGenerate) {
      return errorResponses.validation(
        eligibility.reason || "No letter credits remaining",
        { needsSubscription: true }
      )
    }

    // 5. Parse and validate request body
    const body = await request.json()
    const { letterType, intakeData } = body

    const validation = validateLetterGenerationRequest(letterType, intakeData)
    if (!validation.valid) {
      console.error("[GenerateLetter] Validation failed:", validation.errors)
      return errorResponses.validation("Invalid input data", validation.errors)
    }

    const sanitizedLetterType = letterType
    const sanitizedIntakeData = validation.data!

    // 6. Check API configuration
    if (!process.env.OPENAI_API_KEY) {
      console.error("[GenerateLetter] Missing OPENAI_API_KEY")
      return errorResponses.serverError("Server configuration error")
    }

    // 7. Deduct allowance BEFORE generation (skip for free trial/super user)
    if (!shouldSkipDeduction(eligibility)) {
      const deductionResult = await deductLetterAllowance(user.id)

      if (!deductionResult.success || !deductionResult.wasDeducted) {
        return errorResponses.validation(
          deductionResult.error || "No letter allowances remaining",
          { needsSubscription: true }
        )
      }
    }

    // 8. Create letter record with 'generating' status
    const { data: newLetter, error: insertError } = await supabase
      .from("letters")
      .insert({
        user_id: user.id,
        letter_type: sanitizedLetterType,
        title: `${sanitizedLetterType} - ${new Date().toLocaleDateString()}`,
        intake_data: sanitizedIntakeData,
        status: "generating",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (insertError) {
      console.error("[GenerateLetter] Database insert error:", insertError)

      // Refund if we deducted
      if (!shouldSkipDeduction(eligibility)) {
        await refundLetterAllowance(user.id, 1)
      }

      return errorResponses.serverError("Failed to create letter record")
    }

    // 9. Generate letter using AI with retry logic
    try {
      const generatedContent = await generateLetterContent(
        sanitizedLetterType,
        sanitizedIntakeData
      )

      // 10. Update letter with generated content
      const { error: updateError } = await supabase
        .from("letters")
        .update({
          ai_draft_content: generatedContent,
          status: "pending_review",
          updated_at: new Date().toISOString(),
        })
        .eq("id", newLetter.id)

      if (updateError) {
        throw updateError
      }

      // 11. Increment total letters generated
      await incrementTotalLetters(user.id)

      // 12. Log audit trail
      await logLetterAudit(
        supabase,
        newLetter.id,
        'created',
        'generating',
        'pending_review',
        'Letter generated successfully by AI'
      )

      // 13. Notify admins
      await notifyAdminsAboutNewLetter(newLetter.id, newLetter.title, sanitizedLetterType)

      // 14. Return success response
      return successResponse<LetterGenerationResponse>({
        success: true,
        letterId: newLetter.id,
        status: "pending_review",
        isFreeTrial: eligibility.isFreeTrial,
        aiDraft: generatedContent,
      })

    } catch (generationError: unknown) {
      return handleGenerationFailure(
        supabase,
        newLetter.id,
        user.id,
        generationError,
        eligibility
      )
    }

  } catch (error: unknown) {
    return handleApiError(error, 'GenerateLetter')
  }
}

/**
 * Generate letter content using AI with retry logic
 */
async function generateLetterContent(
  letterType: string,
  intakeData: Record<string, unknown>
): Promise<string> {
  const prompt = buildPrompt(letterType, intakeData)

  console.log('[GenerateLetter] Starting AI generation with retry logic')
  const generationStartTime = Date.now()

  const { text: generatedContent, attempts, duration } = await generateTextWithRetry({
    prompt,
    system: "You are a professional legal attorney drafting formal legal letters. Always produce professional, legally sound content with proper formatting.",
    temperature: 0.7,
    maxOutputTokens: 2048,
    model: "gpt-4-turbo"
  })

  const generationTime = Date.now() - generationStartTime
  console.log(`[GenerateLetter] AI generation completed:`, {
    attempts,
    duration,
    generationTime,
    contentLength: generatedContent.length
  })

  if (!generatedContent) {
    throw new Error("AI returned empty content")
  }

  return generatedContent
}

/**
 * Handle letter generation failure with proper cleanup
 */
async function handleGenerationFailure(
  supabase: Awaited<ReturnType<typeof createClient>>,
  letterId: string,
  userId: string,
  error: unknown,
  eligibility: Awaited<ReturnType<typeof checkGenerationEligibility>>
) {
  console.error("[GenerateLetter] Generation failed:", error)

  // Update letter status to failed
  await supabase
    .from("letters")
    .update({
      status: "failed",
      updated_at: new Date().toISOString()
    })
    .eq("id", letterId)

  // Refund if we deducted
  if (!shouldSkipDeduction(eligibility)) {
    await refundLetterAllowance(userId, 1)
  }

  // Log audit trail
  const errorMessage = error instanceof Error ? error.message : "Unknown error"
  await logLetterAudit(
    supabase,
    letterId,
    'generation_failed',
    'generating',
    'failed',
    `Generation failed: ${errorMessage}`
  )

  return errorResponses.serverError(errorMessage || "AI generation failed")
}

/**
 * Log letter audit trail
 */
async function logLetterAudit(
  supabase: Awaited<ReturnType<typeof createClient>>,
  letterId: string,
  action: string,
  oldStatus: string,
  newStatus: string,
  notes: string
) {
  await supabase.rpc('log_letter_audit', {
    p_letter_id: letterId,
    p_action: action,
    p_old_status: oldStatus,
    p_new_status: newStatus,
    p_notes: notes
  })
}

/**
 * Notify admins about new letter pending review
 */
async function notifyAdminsAboutNewLetter(letterId: string, title: string, letterType: string) {
  const adminEmails = await getAdminEmails()
  if (adminEmails.length === 0) {
    return
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  // Send asynchronously - don't wait
  sendTemplateEmail('admin-alert', adminEmails, {
    alertMessage: `New letter "${title}" requires review. Letter type: ${letterType}`,
    actionUrl: `${siteUrl}/secure-admin-gateway/review/${letterId}`,
    pendingReviews: 1,
  }).catch(error => {
    console.error('[GenerateLetter] Failed to send admin notification:', error)
  })
}

/**
 * Build AI prompt from letter type and intake data
 */
function buildPrompt(letterType: string, intakeData: Record<string, unknown>) {
  const fields = (key: string) => {
    const value = intakeData[key]
    if (value === undefined || value === null || value === '') return ''
    const fieldName = key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .replace(/_/g, ' ')
    return `${fieldName}: ${String(value)}`
  }

  const amountField = intakeData["amountDemanded"]
    ? `Amount Demanded: $${Number(intakeData["amountDemanded"]).toLocaleString()}`
    : ""

  const deadlineField = intakeData["deadlineDate"]
    ? `Deadline: ${intakeData["deadlineDate"]}`
    : ""

  const incidentDateField = intakeData["incidentDate"]
    ? `Incident Date: ${intakeData["incidentDate"]}`
    : ""

  const basePrompt = [
    `Draft a professional ${letterType} letter with the following details:`,
    "",
    "Sender Information:",
    fields("senderName"),
    fields("senderAddress"),
    fields("senderEmail"),
    fields("senderPhone"),
    "",
    "Recipient Information:",
    fields("recipientName"),
    fields("recipientAddress"),
    fields("recipientEmail"),
    fields("recipientPhone"),
    "",
    "Case Details:",
    fields("issueDescription"),
    fields("desiredOutcome"),
    amountField,
    deadlineField,
    incidentDateField,
    fields("additionalDetails"),
    "",
    "Requirements:",
    "- Write a professional, legally sound letter (300-500 words)",
    "- Include proper date and formal letter format",
    "- Present facts clearly and objectively",
    "- State clear demands with specific deadlines (if applicable)",
    "- Maintain professional legal tone throughout",
    "- Include proper salutations and closing",
    "- Format as a complete letter with all standard elements",
    "- Avoid any legal advice beyond standard letter writing",
    "",
    "Important: Only return the letter content itself, no explanations or commentary."
  ]

  return basePrompt.filter(Boolean).join("\n")
}
