import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { getSupabasePublicKey, getSupabaseUrl } from './keys'

export async function createClient() {
  const cookieStore = await cookies()
  
  const supabaseUrl = getSupabaseUrl()
  const supabasePublicKey = getSupabasePublicKey()

  if (!supabaseUrl || !supabasePublicKey) {
    throw new Error(
      'Missing Supabase environment variables. Create a .env.local (cp .env.example .env.local), set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (preferred) or NEXT_PUBLIC_SUPABASE_ANON_KEY, then restart the dev server.'
    )
  }

  return createServerClient(
    supabaseUrl,
    supabasePublicKey.key,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component - ignored, proxy handles session refresh
          }
        },
      },
    }
  )
}
