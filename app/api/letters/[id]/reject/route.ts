import { NextRequest, NextResponse } from 'next/server'
import {
  validateAdminAction,
  updateLetterStatus,
  notifyLetterOwner,
  sanitizeReviewData
} from '@/lib/admin/letter-actions'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Validate admin authentication and CSRF
    const validationError = await validateAdminAction(request)
    if (validationError) return validationError

    const { id: letterId } = await params
    const body = await request.json()
    const { rejectionReason, reviewNotes } = body

    if (!rejectionReason) {
      return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 })
    }

    // Sanitize and validate input
    const sanitizationResult = sanitizeReviewData({ rejectionReason, reviewNotes })
    if (!sanitizationResult.valid) {
      return NextResponse.json({ error: sanitizationResult.error }, { status: 400 })
    }

    // Update letter status with audit trail
    const { letter } = await updateLetterStatus({
      letterId,
      status: 'rejected',
      additionalFields: {
        rejection_reason: sanitizationResult.sanitized.rejectionReason,
        review_notes: sanitizationResult.sanitized.reviewNotes,
      },
      auditAction: 'rejected',
      auditNotes: `Rejection reason: ${sanitizationResult.sanitized.rejectionReason}`
    })

    // Send rejection notification email (non-blocking)
    if (letter?.user_id) {
      await notifyLetterOwner({
        userId: letter.user_id,
        letterId,
        templateName: 'letter-rejected',
        templateData: {
          letterTitle: letter.title || 'Your letter',
          rejectionReason: rejectionReason,
        }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Reject] Letter rejection error:', error)
    return NextResponse.json(
      { error: 'Failed to reject letter' },
      { status: 500 }
    )
  }
}
