/**
 * Workflow Step: Save Letter to Database
 *
 * Creates or updates a letter record in the database.
 *
 * Returns: Letter ID
 */
import { createClient } from "@/lib/supabase/server"

export interface SaveLetterInput {
  userId: string
  letterId?: string // If provided, updates existing letter
  letterType: string
  title?: string
  status: string
  aiDraftContent?: string
  finalContent?: string
  intakeData?: Record<string, unknown>
  recipientInfo?: {
    name?: string
    email?: string
    address?: string
  }
}

export async function saveLetterStep(input: SaveLetterInput): Promise<string> {
  const supabase = await createClient()

  if (input.letterId) {
    // Update existing letter
    const { error: updateError } = await supabase
      .from("letters")
      .update({
        ...(input.aiDraftContent && { ai_draft_content: input.aiDraftContent }),
        ...(input.finalContent && { final_content: input.finalContent }),
        ...(input.status && { status: input.status }),
        updated_at: new Date().toISOString(),
      })
      .eq("id", input.letterId)

    if (updateError) {
      console.error("[SaveLetter] Update error:", updateError)
      throw updateError
    }

    console.log(`[SaveLetter] Updated letter ${input.letterId}`)
    return input.letterId
  } else {
    // Create new letter
    const title = input.title || `${input.letterType} - ${new Date().toLocaleDateString()}`

    const { data: newLetter, error: insertError } = await supabase
      .from("letters")
      .insert({
        user_id: input.userId,
        letter_type: input.letterType,
        title,
        intake_data: input.intakeData || {},
        recipient_name: input.recipientInfo?.name,
        recipient_email: input.recipientInfo?.email,
        status: input.status,
        ai_draft_content: input.aiDraftContent,
        final_content: input.finalContent,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select("id")
      .single()

    if (insertError || !newLetter) {
      console.error("[SaveLetter] Insert error:", insertError)
      throw insertError || new Error("Failed to create letter")
    }

    console.log(`[SaveLetter] Created letter ${newLetter.id}`)
    return newLetter.id
  }
}

/**
 * Helper to log audit trail for letter changes
 */
export async function logLetterAuditStep(
  letterId: string,
  action: string,
  oldStatus: string,
  newStatus: string,
  notes?: string
): Promise<void> {
  const supabase = await createClient()

  const { error } = await supabase.rpc("log_letter_audit", {
    p_letter_id: letterId,
    p_action: action,
    p_old_status: oldStatus,
    p_new_status: newStatus,
    p_notes: notes,
    p_metadata: {
      timestamp: new Date().toISOString(),
    },
  })

  if (error) {
    console.error("[LogAudit] Error logging audit trail:", error)
    // Don't throw - audit logging shouldn't fail the workflow
  }
}
