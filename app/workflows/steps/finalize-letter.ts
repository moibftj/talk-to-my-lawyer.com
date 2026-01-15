/**
 * Workflow Step: Finalize Letter
 *
 * Updates letter with final attorney review decision (approved or rejected).
 *
 * Returns: Final status ("approved" or "rejected")
 */
import { step } from "workflow"
import { createClient } from "@/lib/supabase/server"

export interface FinalizeLetterInput {
  letterId: string
  approved: boolean
  finalContent?: string  // Attorney-edited content (if approved)
  reviewedBy: string     // Attorney/admin user ID
  reviewNotes?: string
  rejectionReason?: string
}

export async function finalizeLetterStep(input: FinalizeLetterInput): Promise<string> {
  return await step("finalize-letter", async () => {
    const supabase = await createClient()

    const newStatus = input.approved ? "approved" : "rejected"

    const { error: updateError } = await supabase
      .from("letters")
      .update({
        status: newStatus,
        final_content: input.finalContent || null,
        reviewed_by: input.reviewedBy,
        reviewed_at: new Date().toISOString(),
        rejection_reason: input.rejectionReason || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.letterId)

    if (updateError) {
      console.error("[FinalizeLetter] Update error:", updateError)
      throw updateError
    }

    // Log audit trail
    await supabase.rpc('log_letter_audit', {
      p_letter_id: input.letterId,
      p_action: input.approved ? 'approve' : 'reject',
      p_old_status: 'under_review',
      p_new_status: newStatus,
      p_notes: input.reviewNotes || input.rejectionReason || `Letter ${newStatus} by attorney`,
      p_metadata: {
        reviewed_by: input.reviewedBy,
        reviewed_at: new Date().toISOString(),
      }
    }).catch(err => {
      console.error("[FinalizeLetter] Audit log error:", err)
      // Don't fail workflow on audit error
    })

    console.log(`[FinalizeLetter] Letter ${input.letterId} ${newStatus}`)
    return newStatus
  })
}
