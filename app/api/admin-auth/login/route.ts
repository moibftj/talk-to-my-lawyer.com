import { NextRequest, NextResponse } from 'next/server'
import { verifyAdminCredentials, createAdminSession } from '@/lib/auth/admin-session'
import { adminRateLimit, safeApplyRateLimit } from '@/lib/rate-limit-redis'

/**
 * Admin login endpoint - Role-based authentication
 *
 * No shared secret required. Each admin uses their own credentials.
 * Access is determined solely by the `role = 'admin'` field in the profiles table.
 *
 * Security benefits:
 * - Individual accountability (each admin has unique credentials)
 * - No shared secret to leak or rotate
 * - Easy deactivation (just change the user's role)
 * - Full audit trail of which admin performed each action
 */
export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResponse = await safeApplyRateLimit(request, adminRateLimit, 10, "15 m")
    if (rateLimitResponse) {
      return rateLimitResponse
    }

    const body = await request.json()
    const { email, password } = body

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    // Verify credentials and check admin role
    const result = await verifyAdminCredentials(email, password)

    if (!result.success) {
      // Log failed login attempt for security monitoring
      console.warn('[AdminAuth] Failed login attempt:', {
        email,
        timestamp: new Date().toISOString(),
        error: result.error
      })

      return NextResponse.json(
        { error: result.error || 'Authentication failed' },
        { status: 401 }
      )
    }

    // Create admin session
    await createAdminSession(result.userId!, email)

    return NextResponse.json({
      success: true,
      message: 'Admin authentication successful'
    })

  } catch (error) {
    console.error('[AdminAuth] Login error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
