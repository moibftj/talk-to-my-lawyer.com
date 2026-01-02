import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { authRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await safeApplyRateLimit(request, authRateLimit, 5, "15 m")
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const supabase = await createClient()

    // Generate password reset token
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password`,
    })

    if (error) {
      console.error('[Reset Password] Error:', error)
      // Don't reveal if email exists or not for security
      return NextResponse.json(
        { error: 'If an account with this email exists, a password reset link has been sent.' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      message: 'If an account with this email exists, a password reset link has been sent.',
      success: true
    })

  } catch (error: any) {
    console.error('[Reset Password] Error:', error)
    return NextResponse.json(
      { error: 'Failed to send password reset email' },
      { status: 500 }
    )
  }
}