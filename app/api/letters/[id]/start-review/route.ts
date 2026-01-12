import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getAdminSession } from '@/lib/auth/admin-session'
import { validateAdminAction } from '@/lib/admin/letter-actions'
import { adminRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'
import { queueTemplateEmail } from '@/lib/email/service'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const rateLimitResponse = await safeApplyRateLimit(request, adminRateLimit, 10, '15 m')
    if (rateLimitResponse) return rateLimitResponse

    const validationError = await validateAdminAction(request)
    if (validationError) return validationError

    const { id } = await params
    const supabase = await createClient()
    const adminSession = await getAdminSession()

    const { data: letter } = await supabase
      .from('letters')
      .select('status, user_id, title')
      .eq('id', id)
      .single()

    if (!letter) {
      return NextResponse.json({ error: 'Letter not found' }, { status: 404 })
    }

    const { error: updateError } = await supabase
      .from('letters')
      .update({
        status: 'under_review',
        reviewed_by: adminSession?.userId,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)

    if (updateError) throw updateError

    await supabase.rpc('log_letter_audit', {
      p_letter_id: id,
      p_action: 'review_started',
      p_old_status: letter.status,
      p_new_status: 'under_review',
      p_notes: 'Admin started reviewing the letter'
    })

    // Send notification email to user
    if (letter.user_id) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', letter.user_id)
        .single()

      if (profile?.email) {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

        // Get count of pending reviews for context
        const { count: pendingCount } = await supabase
          .from('letters')
          .select('*', { count: 'exact', head: true })
          .in('status', ['pending_review', 'under_review'])

        queueTemplateEmail('letter-under-review', profile.email, {
          userName: profile.full_name || 'there',
          letterTitle: letter.title || 'Your letter',
          letterLink: `${siteUrl}/dashboard/letters/${id}`,
          actionUrl: `${siteUrl}/dashboard/letters/${id}`,
          alertMessage: 'Being reviewed for legal compliance and accuracy',
          pendingReviews: pendingCount || 1,
        }).catch(error => {
          console.error('[StartReview] Failed to queue notification email:', error)
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[v0] Start review error:', error)
    return NextResponse.json(
      { error: 'Failed to start review' },
      { status: 500 }
    )
  }
}
