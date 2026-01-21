/**
 * Letter Generation Workflow
 *
 * Orchestrates the complete letter lifecycle from generation to approval.
 *
 * Flow:
 * 1. Check allowance (atomic)
 * 2. Generate AI draft (auto-retry)
 * 3. Save draft to database
 * 4. Notify attorneys for review
 * 5. Wait for attorney approval/rejection (via API)
 * 6. Finalize letter with decision
 * 7. Notify user
 */

import { checkAllowanceStep } from "./steps/check-allowance"
import { generateDraftStep } from "./steps/generate-draft"
import { saveLetterStep, logLetterAuditStep } from "./steps/save-letter"
import { notifyAttorneysStep } from "./steps/notify-attorneys"
import { finalizeLetterStep } from "./steps/finalize-letter"
import { notifyUserStep } from "./steps/notify-user"
import { refundLetterAllowance, incrementTotalLetters } from "@/lib/services/allowance-service"

export interface LetterGenerationInput {
  userId: string
  letterType: string
  intakeData: Record<string, unknown>
  recipientInfo?: {
    name?: string
    email?: string
    address?: string
  }
  title?: string
}

export interface AttorneyApproval {
  approved: boolean
  attorneyId: string
  editedContent?: string
  notes?: string
  reason?: string
}

export interface LetterGenerationResult {
  success: boolean
  status: string
  letterId: string
  reason?: string
}

/**
 * Main workflow function
 *
 * This function handles the letter generation process up to the point
 * where attorney review is needed. The approval/rejection is handled
 * separately via API endpoints.
 */
export async function generateLetterWorkflow(
  input: LetterGenerationInput
): Promise<LetterGenerationResult> {
  let letterId: string | null = null
  let allowanceDeducted = false
  let isFreeTrial = false
  let isSuperAdmin = false

  try {
    // Step 1: Check and deduct allowance (atomic operation)
    console.log("[Workflow] Step 1: Checking allowance")
    const allowance = await checkAllowanceStep(input.userId)

    if (!allowance.success) {
      throw new Error(allowance.errorMessage || "No letter allowance available")
    }

    allowanceDeducted = true
    isFreeTrial = allowance.isFreeTrial
    isSuperAdmin = allowance.isSuperAdmin

    console.log(`[Workflow] Allowance deducted. Remaining: ${allowance.remaining}`)

    // Step 2: Generate AI draft (with automatic retries)
    console.log("[Workflow] Step 2: Generating AI draft")
    const aiDraft = await generateDraftStep({
      letterType: input.letterType,
      intakeData: input.intakeData,
      recipientInfo: input.recipientInfo,
    })

    console.log(`[Workflow] AI draft generated (${aiDraft.length} chars)`)

    // Step 3: Save draft to database with 'pending_review' status
    console.log("[Workflow] Step 3: Saving letter to database")
    letterId = await saveLetterStep({
      userId: input.userId,
      letterType: input.letterType,
      title: input.title,
      status: "pending_review",
      aiDraftContent: aiDraft,
      intakeData: input.intakeData,
      recipientInfo: input.recipientInfo,
    })

    console.log(`[Workflow] Letter saved: ${letterId}`)

    // Step 4: Log audit trail
    await logLetterAuditStep(
      letterId,
      "created",
      "generating",
      "pending_review",
      "Letter generated successfully by AI"
    )

    // Step 5: Increment total letters generated
    await incrementTotalLetters(input.userId)

    // Step 6: Notify attorneys for review
    console.log("[Workflow] Step 4: Notifying attorneys")
    const title = input.title || `${input.letterType} - ${new Date().toLocaleDateString()}`
    await notifyAttorneysStep({
      letterId,
      letterTitle: title,
      letterType: input.letterType,
    })

    console.log("[Workflow] Attorneys notified")

    // Return success - letter is now pending review
    // Attorney approval/rejection will be handled via separate API endpoints
    return {
      success: true,
      status: "pending_review",
      letterId,
    }
  } catch (error) {
    console.error("[Workflow] Error:", error)

    // Handle failure with cleanup
    if (letterId) {
      // Update letter status to failed
      await saveLetterStep({
        userId: input.userId,
        letterId,
        letterType: input.letterType,
        status: "failed",
      }).catch((err) => {
        console.error("[Workflow] Failed to update letter status:", err)
      })

      // Log failure audit
      await logLetterAuditStep(
        letterId,
        "failed",
        "generating",
        "failed",
        error instanceof Error ? error.message : "Unknown error"
      ).catch((err) => {
        console.error("[Workflow] Failed to log audit:", err)
      })
    }

    // Refund allowance if we deducted it (unless free trial or super admin)
    if (allowanceDeducted && !isFreeTrial && !isSuperAdmin) {
      console.log("[Workflow] Refunding allowance due to failure")
      await refundLetterAllowance(input.userId, 1).catch((err) => {
        console.error("[Workflow] Failed to refund allowance:", err)
      })
    }

    // Return failure result
    return {
      success: false,
      status: "failed",
      letterId: letterId || "",
      reason: error instanceof Error ? error.message : "Unknown error occurred",
    }
  }
}

/**
 * Handle attorney approval for a letter
 * Called when an attorney approves or rejects a letter
 */
export async function handleAttorneyDecision(
  letterId: string,
  userId: string,
  approval: AttorneyApproval
): Promise<LetterGenerationResult> {
  try {
    const title = `Letter ${letterId}`

    // Finalize letter based on approval decision
    console.log("[Workflow] Finalizing letter")
    await finalizeLetterStep({
      letterId,
      approved: approval.approved,
      finalContent: approval.editedContent,
      reviewedBy: approval.attorneyId,
      reviewNotes: approval.notes,
      rejectionReason: approval.reason,
    })

    // Notify user of the decision
    console.log("[Workflow] Notifying user")
    await notifyUserStep({
      userId,
      letterId,
      letterTitle: title,
      approved: approval.approved,
      rejectionReason: approval.reason,
    })

    return {
      success: true,
      status: approval.approved ? "completed" : "rejected",
      letterId,
      reason: approval.reason,
    }
  } catch (error) {
    console.error("[Workflow] Error handling attorney decision:", error)
    return {
      success: false,
      status: "failed",
      letterId,
      reason: error instanceof Error ? error.message : "Unknown error occurred",
    }
  }
}
