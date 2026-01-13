/*
  Migration: 015_function_grants
  Description: Grants execute permissions for updated core functions.
*/

GRANT EXECUTE ON FUNCTION public.deduct_letter_allowance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_letter_allowance(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_credits_atomic(UUID, INT) TO authenticated;
