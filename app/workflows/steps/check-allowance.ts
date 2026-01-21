/**
 * Workflow Step: Check and Deduct Allowance
 *
 * Atomically checks if the user has letter credits and deducts one.
 * This prevents race conditions in concurrent requests.
 *
 * Returns:
 * - success: boolean
 * - remaining: number of credits after deduction
 * - isFreeTrial: boolean
 * - isSuperAdmin: boolean
 */
import { checkAndDeductAllowance } from "@/lib/services/allowance-service"

export interface AllowanceResult {
  success: boolean
  remaining: number
  errorMessage?: string
  isFreeTrial: boolean
  isSuperAdmin: boolean
}

export async function checkAllowanceStep(userId: string): Promise<AllowanceResult> {
  const result = await checkAndDeductAllowance(userId)

  return {
    success: result.success,
    remaining: result.remaining || 0,
    errorMessage: result.errorMessage,
    isFreeTrial: result.isFreeTrial || false,
    isSuperAdmin: result.isSuperAdmin || false,
  }
}
