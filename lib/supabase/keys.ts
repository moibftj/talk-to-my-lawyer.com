export type SupabasePublicKeyType = 'publishable' | 'anon'
export type SupabaseServiceKeyType = 'secret' | 'service_role'

export function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL
}

export function getSupabasePublicKey():
  | { key: string; type: SupabasePublicKeyType }
  | null {
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  if (publishableKey) {
    return { key: publishableKey, type: 'publishable' }
  }

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (anonKey) {
    return { key: anonKey, type: 'anon' }
  }

  return null
}

export function getSupabaseServiceKey():
  | { key: string; type: SupabaseServiceKeyType }
  | null {
  const secretKey = process.env.SUPABASE_SECRET_KEY
  if (secretKey) {
    return { key: secretKey, type: 'secret' }
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (serviceRoleKey) {
    return { key: serviceRoleKey, type: 'service_role' }
  }

  return null
}
