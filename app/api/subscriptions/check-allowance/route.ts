import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeApplyRateLimit, apiRateLimit } from "@/lib/rate-limit-redis";
import { errorResponses, handleApiError } from "@/lib/api/api-error-handler";

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await safeApplyRateLimit(request, apiRateLimit, 100, "1 m");
    if (rateLimitResponse) return rateLimitResponse;

    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return errorResponses.unauthorized();
    }

    // Call check_letter_allowance function
    const { data, error } = await supabase
      .rpc('check_letter_allowance', { u_id: user.id })
      .single<{ has_access: boolean; letters_remaining: number; plan_type: string; is_active: boolean }>();

    if (error) {
      console.error('[CheckAllowance] RPC error:', error);
      return errorResponses.internalError("Failed to check allowance");
    }

    return NextResponse.json({
      hasAllowance: data?.has_access,
      remaining: data?.letters_remaining,
      plan: data?.plan_type
    });

  } catch (error) {
    return handleApiError(error, "CheckAllowance");
  }
}
