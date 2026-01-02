/**
 * Update admin user password
 * Usage: npx tsx scripts/update-admin-password.ts <email> <new_password>
 *
 * Example:
 *   npx tsx scripts/update-admin-password.ts admin@talk-to-my-lawyer.com SecurePass123!
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set')
  process.exit(1)
}

// Get email and password from command line args
const email = process.argv[2]
const newPassword = process.argv[3]

if (!email || !newPassword) {
  console.error('❌ Usage: npx tsx scripts/update-admin-password.ts <email> <new_password>')
  console.error('   Example: npx tsx scripts/update-admin-password.ts admin@talk-to-my-lawyer.com SecurePass123!')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function updateAdminPassword() {
  console.log(`\n🔐 Updating password for: ${email}`)

  // Check if user exists
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id, email, role')
    .eq('email', email)
    .single()

  if (!existingProfile) {
    console.error('❌ User not found in profiles table')
    process.exit(1)
  }

  if (existingProfile.role !== 'admin') {
    console.error('❌ User is not an admin')
    process.exit(1)
  }

  console.log(`   User ID: ${existingProfile.id}`)

  // Update user password using Supabase Auth Admin API
  const { data: authData, error: authError } = await supabase.auth.admin.updateUserById(
    existingProfile.id,
    { password: newPassword }
  )

  if (authError) {
    console.error('❌ Error updating password:', authError.message)
    process.exit(1)
  }

  console.log('\n✅ Password updated successfully!')
  console.log('   Email:', email)
  console.log('   User ID:', authData.user.id)
  console.log('\n   You can now login with the new password at: /secure-admin-gateway/login')
}

updateAdminPassword()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Script error:', error)
    process.exit(1)
  })
