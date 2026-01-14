import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { safeApplyRateLimit, subscriptionRateLimit } from "@/lib/rate-limit-redis";
import { errorResponses, handleApiError } from "@/lib/api/api-error-handler";

export async function POST(request: NextRequest) {
  try {
    // Rate limiting - subscription operations are limited
    const rateLimitResponse = await safeApplyRateLimit(request, subscriptionRateLimit, 3, "1 h");
    if (rateLimitResponse) return rateLimitResponse;

    const supabase = await createClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponses.unauthorized();
    }

    const body = await request.json();
    const { subscriptionId, planType } = body;

    if (!subscriptionId || !planType) {
      return errorResponses.badRequest("Missing subscriptionId or planType");
    }

    // Verify subscription belongs to user
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('id', subscriptionId)
      .eq('user_id', user.id)
      .single();

    if (subError || !subscription) {
      return errorResponses.notFound("Subscription not found");
    }

    // Call add_letter_allowances function
    const { error: rpcError } = await supabase
      .rpc('add_letter_allowances', {
        sub_id: subscriptionId,
        plan: planType
      });

    if (rpcError) {
      console.error('[ActivateSubscription] RPC error:', rpcError);
      return errorResponses.internalError("Failed to add allowances");
    }

    // Update subscription status to active
    const { error: updateError } = await supabase
      .from('subscriptions')
      .update({ status: 'active', updated_at: new Date().toISOString() })
      .eq('id', subscriptionId);

    if (updateError) {
      console.error('[ActivateSubscription] Update error:', updateError);
      return errorResponses.internalError("Failed to activate subscription");
    }

    return NextResponse.json({
      message: "Subscription activated successfully",
      subscriptionId
    });

  } catch (error) {
    return handleApiError(error, "ActivateSubscription");
  }
}
