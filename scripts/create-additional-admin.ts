/**
 * Create an additional admin user
 * Usage: npx tsx scripts/create-additional-admin.ts <email> <password>
 *
 * Example:
 *   npx tsx scripts/create-additional-admin.ts john@company.com SecurePass123!
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
const password = process.argv[3]

if (!email || !password) {
  console.error('❌ Usage: npx tsx scripts/create-additional-admin.ts <email> <password>')
  console.error('   Example: npx tsx scripts/create-additional-admin.ts john@company.com SecurePass123!')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function createAdminUser() {
  console.log(`\n🔐 Creating admin user: ${email}`)

  // Check if user already exists
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id, email, role')
    .eq('email', email)
    .single()

  if (existingProfile) {
    if (existingProfile.role === 'admin') {
      console.log('⚠️  User already exists and is already an admin!')
      console.log(`   User ID: ${existingProfile.id}`)
      return
    } else {
      // Update existing user to admin role
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ role: 'admin', updated_at: new Date().toISOString() })
        .eq('email', email)

      if (updateError) {
        console.error('❌ Error updating user role:', updateError)
        return
      }

      console.log('✅ Existing user promoted to admin!')
      console.log(`   User ID: ${existingProfile.id}`)
      console.log(`   Email: ${email}`)
      console.log('\n   They can now login at: /secure-admin-gateway/login')
      return
    }
  }

  // Create user with Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: email.split('@')[0], // Use part of email as default name
      role: 'admin'
    }
  })

  if (authError) {
    console.error('❌ Error creating auth user:', authError.message)
    return
  }

  console.log('✅ Auth user created:', authData.user.id)

  // Create or update profile with admin role
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: authData.user.id,
      email,
      full_name: email.split('@')[0],
      role: 'admin',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })

  if (profileError) {
    console.error('❌ Error creating admin profile:', profileError)
    return
  }

  console.log('\n✅ Admin user created successfully!')
  console.log('   Email:', email)
  console.log('   User ID:', authData.user.id)
  console.log('   Role: admin')
  console.log('\n   They can now login at: /secure-admin-gateway/login')
  console.log('   They will need the ADMIN_PORTAL_KEY from your environment variables')
}

createAdminUser()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('❌ Script error:', error)
    process.exit(1)
  })
