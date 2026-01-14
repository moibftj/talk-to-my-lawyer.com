import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { safeApplyRateLimit, apiRateLimit } from '@/lib/rate-limit-redis'
import { errorResponses, handleApiError } from '@/lib/api/api-error-handler'

export const runtime = 'nodejs'

// POST - Save draft letter content (auto-save)
export async function POST(request: NextRequest) {
  try {
    // Rate limiting - generous for auto-save (200 per minute)
    const rateLimitResponse = await safeApplyRateLimit(request, apiRateLimit, 200, "1 m");
    if (rateLimitResponse) return rateLimitResponse;

    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return errorResponses.unauthorized()
    }

    const body = await request.json()
    const { letterId, title, content, letterType, recipientInfo, senderInfo, metadata } = body

    // If letterId is provided, update existing draft
    if (letterId) {
      // Verify ownership
      const { data: existingLetter, error: fetchError } = await supabase
        .from('letters')
        .select('id, user_id, status')
        .eq('id', letterId)
        .single()

      if (fetchError || !existingLetter) {
        return errorResponses.notFound('Draft not found')
      }

      if (existingLetter.user_id !== user.id) {
        return errorResponses.forbidden('Unauthorized')
      }

      // Only allow updating drafts
      if (existingLetter.status !== 'draft') {
        return errorResponses.badRequest('Can only auto-save draft letters')
      }

      // Update the draft
      const { data: updated, error: updateError } = await supabase
        .from('letters')
        .update({
          title: title || null,
          letter_type: letterType || null,
          ai_draft_content: content || null,
          recipient_name: recipientInfo?.name || null,
          recipient_email: recipientInfo?.email || null,
          recipient_company: recipientInfo?.company || null,
          recipient_address: recipientInfo?.address || null,
          sender_name: senderInfo?.name || null,
          sender_company: senderInfo?.company || null,
          draft_metadata: metadata || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', letterId)
        .select('id, updated_at')
        .single()

      if (updateError) {
        console.error('[AutoSave] Update error:', updateError)
        return errorResponses.internalError('Failed to save draft')
      }

      return NextResponse.json({
        success: true,
        message: 'Draft saved',
        letterId: updated.id,
        savedAt: updated.updated_at
      })
    }

    // Create new draft
    const { data: newDraft, error: createError } = await supabase
      .from('letters')
      .insert({
        user_id: user.id,
        title: title || 'Untitled Draft',
        letter_type: letterType || null,
        status: 'draft',
        ai_draft_content: content || null,
        recipient_name: recipientInfo?.name || null,
        recipient_email: recipientInfo?.email || null,
        recipient_company: recipientInfo?.company || null,
        recipient_address: recipientInfo?.address || null,
        sender_name: senderInfo?.name || null,
        sender_company: senderInfo?.company || null,
        draft_metadata: metadata || null
      })
      .select('id, created_at')
      .single()

    if (createError) {
      console.error('[AutoSave] Create error:', createError)
      return errorResponses.internalError('Failed to create draft')
    }

    return NextResponse.json({
      success: true,
      message: 'Draft created',
      letterId: newDraft.id,
      savedAt: newDraft.created_at,
      isNew: true
    })
  } catch (error) {
    return handleApiError(error, "AutoSave")
  }
}

// GET - Get list of drafts
export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await safeApplyRateLimit(request, apiRateLimit, 100, "1 m");
    if (rateLimitResponse) return rateLimitResponse;

    const supabase = await createClient()

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return errorResponses.unauthorized()
    }

    const { data: drafts, error } = await supabase
      .from('letters')
      .select('id, title, letter_type, updated_at, created_at')
      .eq('user_id', user.id)
      .eq('status', 'draft')
      .order('updated_at', { ascending: false })
      .limit(10)

    if (error) {
      return errorResponses.internalError('Failed to fetch drafts')
    }

    return NextResponse.json({
      success: true,
      drafts: drafts || []
    })
  } catch (error) {
    return handleApiError(error, "GetDrafts")
  }
}
