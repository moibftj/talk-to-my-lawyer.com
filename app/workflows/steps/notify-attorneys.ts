/**
 * Workflow Step: Notify Attorneys
 *
 * Sends email notifications to admin/attorney team when a new letter
 * is ready for review.
 *
 * Returns: Number of emails queued
 */
import { getAdminEmails } from "@/lib/admin/letter-actions"
import { queueTemplateEmail } from "@/lib/email/service"

export interface NotifyAttorneysInput {
  letterId: string
  letterTitle: string
  letterType: string
}

export async function notifyAttorneysStep(input: NotifyAttorneysInput): Promise<number> {
  const adminEmails = await getAdminEmails()

  if (adminEmails.length === 0) {
    console.warn("[NotifyAttorneys] No admin emails found")
    return 0
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"

  // Queue admin notification for reliable delivery
  await queueTemplateEmail("admin-alert", adminEmails, {
    alertMessage: `New letter "${input.letterTitle}" requires review. Letter type: ${input.letterType}`,
    actionUrl: `${siteUrl}/secure-admin-gateway/review/${input.letterId}`,
    pendingReviews: 1,
  })

  console.log(`[NotifyAttorneys] Queued notifications to ${adminEmails.length} admins`)
  return adminEmails.length
}
