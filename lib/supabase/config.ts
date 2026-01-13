import { getSupabasePublicKey, getSupabaseUrl } from './keys'

export function getSupabaseConfig() {
  const supabaseUrl = getSupabaseUrl()
  const supabasePublicKey = getSupabasePublicKey()

  if (!supabaseUrl || !supabasePublicKey) {
    throw new Error(
      `Missing Supabase environment variables.

Local setup:
- Copy ".env.example" to ".env.local" in the project root
- Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (preferred) or NEXT_PUBLIC_SUPABASE_ANON_KEY
- Restart the dev server after editing env files

You can find the values in Supabase project settings:
https://supabase.com/dashboard/project/_/settings/api`
    )
  }

  return { supabaseUrl, supabaseAnonKey: supabasePublicKey.key }
}
