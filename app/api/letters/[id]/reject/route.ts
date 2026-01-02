/**
 * Letter rejection endpoint
 * POST /api/letters/[id]/reject
 *
 * Uses consolidated admin action handler to reduce duplication
 */
import { NextRequest, NextResponse } from 'next/server'
import { handleAdminLetterAction } from '@/lib/api/admin-action-handler'

// POST endpoint to reject a letter
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  return handleAdminLetterAction(request, params, 'reject')
}
