/**
 * Workflow Step: Notify User
 *
 * Sends email notification to the user about their letter status
 * (approved or rejected).
 *
 * Returns: boolean indicating if notification was sent
 */
import { step } from "workflow"
import { createClient } from "@/lib/supabase/server"
import { queueTemplateEmail } from "@/lib/email/service"

export interface NotifyUserInput {
  userId: string
  letterId: string
  letterTitle: string
  approved: boolean
  rejectionReason?: string
}

export async function notifyUserStep(input: NotifyUserInput): Promise<boolean> {
  return await step(
    "notify-user",
    async () => {
      const supabase = await createClient()

      // Get user email
      const { data: profile } = await supabase
        .from("profiles")
        .select("email, full_name")
        .eq("id", input.userId)
        .single()

      if (!profile?.email) {
        console.error("[NotifyUser] User email not found")
        return false
      }

      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

      if (input.approved) {
        // Send approval notification
        await queueTemplateEmail('letter-approved', [profile.email], {
          userName: profile.full_name || 'User',
          letterTitle: input.letterTitle,
          letterLink: `${siteUrl}/dashboard/letters/${input.letterId}`,
        })

        console.log(`[NotifyUser] Approval notification queued for ${profile.email}`)
      } else {
        // Send rejection notification
        await queueTemplateEmail('letter-rejected', [profile.email], {
          userName: profile.full_name || 'User',
          letterTitle: input.letterTitle,
          rejectionReason: input.rejectionReason || 'Please review the feedback and resubmit.',
          letterLink: `${siteUrl}/dashboard/letters/${input.letterId}`,
        })

        console.log(`[NotifyUser] Rejection notification queued for ${profile.email}`)
      }

      return true
    },
    {
      // Retry email operations
      maxAttempts: 3,
      backoff: "exponential"
    }
  )
}
