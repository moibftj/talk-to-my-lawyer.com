import { NextRequest, NextResponse } from 'next/server'
import { adminRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'
import {
  validateAdminAction,
  handleCSRFTokenRequest,
  updateLetterStatus,
  notifyLetterOwner,
  sanitizeReviewData
} from '@/lib/admin/letter-actions'

// GET endpoint to provide CSRF token
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    return await handleCSRFTokenRequest()
  } catch (error) {
    console.error('[Approve] CSRF token endpoint error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await safeApplyRateLimit(request, adminRateLimit, 10, "15 m")
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    // Validate admin authentication and CSRF
    const validationError = await validateAdminAction(request)
    if (validationError) return validationError

    const { id: letterId } = await params
    const body = await request.json()
    const { finalContent, reviewNotes } = body

    if (!finalContent) {
      return NextResponse.json({ error: 'Final content is required for approval' }, { status: 400 })
    }

    // Sanitize and validate input
    const sanitizationResult = sanitizeReviewData({ finalContent, reviewNotes })
    if (!sanitizationResult.valid) {
      return NextResponse.json({ error: sanitizationResult.error }, { status: 400 })
    }

    // Update letter status with audit trail
    const { letter } = await updateLetterStatus({
      letterId,
      status: 'approved',
      additionalFields: {
        final_content: sanitizationResult.sanitized.finalContent,
        review_notes: sanitizationResult.sanitized.reviewNotes,
        approved_at: new Date().toISOString(),
      },
      auditAction: 'approved',
      auditNotes: sanitizationResult.sanitized.reviewNotes || 'Letter approved by admin'
    })

    // Send approval notification email (non-blocking)
    if (letter?.user_id) {
      await notifyLetterOwner({
        userId: letter.user_id,
        letterId,
        templateName: 'letter-approved',
        templateData: {
          letterTitle: letter.title || 'Your letter',
        }
      })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Approve] Letter approval error:', error)
    return NextResponse.json(
      { error: 'Failed to approve letter' },
      { status: 500 }
    )
  }
}
