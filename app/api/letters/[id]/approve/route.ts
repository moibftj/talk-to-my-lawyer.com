/**
 * Letter approval endpoint
 * POST /api/letters/[id]/approve
 *
 * Uses consolidated admin action handler to reduce duplication
 */
import { NextRequest, NextResponse } from 'next/server'
import { getAdminCSRFToken, handleAdminLetterAction } from '@/lib/api/admin-action-handler'

// GET endpoint to provide CSRF token
export async function GET(
  request: NextRequest,
  _params: { params: Promise<{ id: string }> }
) {
  return getAdminCSRFToken()
}

// POST endpoint to approve a letter
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleAdminLetterAction(request, params, 'approve')
}
