/**
 * Create all test accounts for E2E testing using MCP approach
 * This script uses the app's existing Supabase configuration
 */

const { createClient } = require('@supabase/supabase-js')
const dotenv = require('dotenv')

dotenv.config({ path: '.env.local' })

// Load environment from the app (should be available at runtime)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY
const passwordArg = process.argv.find(arg => arg.startsWith('--password='))
const testPassword = process.env.TEST_ACCOUNT_PASSWORD || (passwordArg ? passwordArg.split('=')[1] : null)

console.log('🔍 Checking environment variables...')
console.log('SUPABASE_URL:', supabaseUrl ? '✓ Set' : '✗ Missing')
console.log('SERVICE_KEY:', supabaseServiceKey ? '✓ Set' : '✗ Missing')

if (!supabaseUrl || !supabaseServiceKey || !testPassword) {
  console.error('\n❌ Error: Required environment variables are missing')
  console.log('\nPlease ensure these are set:')
  console.log('  - NEXT_PUBLIC_SUPABASE_URL')
  console.log('  - SUPABASE_SECRET_KEY (preferred) or SUPABASE_SERVICE_ROLE_KEY')
  console.log('  - TEST_ACCOUNT_PASSWORD')
  console.log('  - Or pass --password=<password>')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

const testAccounts = [
  {
    email: 'test-subscriber@ttml-test.com',
    password: testPassword,
    role: 'subscriber',
    fullName: 'Test Subscriber'
  },
  {
    email: 'test-employee@ttml-test.com',
    password: testPassword,
    role: 'employee',
    fullName: 'Test Employee'
  },
  {
    email: 'test-superadmin@ttml-test.com',
    password: testPassword,
    role: 'admin',
    adminSubRole: 'super_admin',
    fullName: 'Test System Admin'
  },
  {
    email: 'test-attorney@ttml-test.com',
    password: testPassword,
    role: 'admin',
    adminSubRole: 'attorney_admin',
    fullName: 'Test Attorney Admin'
  }
]

async function createTestAccount(account) {
  console.log(`\n🔐 Creating: ${account.email} (${account.role})`)

  try {
    // Check if user already exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('id, email, role, admin_sub_role')
      .eq('email', account.email)
      .single()

    if (existingProfile) {
      console.log(`⚠️  Account already exists: ${existingProfile.id}`)
      return existingProfile.id
    }

    // Create user with Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: account.email,
      password: account.password,
      email_confirm: true,
      user_metadata: {
        full_name: account.fullName,
        role: account.role,
        admin_sub_role: account.adminSubRole
      }
    })

    if (authError) {
      console.error(`❌ Auth error:`, authError.message)
      return null
    }

    console.log(`✅ Auth user created: ${authData.user.id}`)

    // Create profile
    const profileData = {
      id: authData.user.id,
      email: account.email,
      full_name: account.fullName,
      role: account.role,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    if (account.adminSubRole) {
      profileData.admin_sub_role = account.adminSubRole
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(profileData)

    if (profileError) {
      console.error(`❌ Profile error:`, profileError.message)
      return null
    }

    console.log(`✅ Profile created`)

    // For employee, create a coupon code
    if (account.role === 'employee') {
      const couponCode = `TEST${Math.random().toString(36).substring(2, 8).toUpperCase()}`
      const { error: couponError } = await supabase
        .from('employee_coupons')
        .insert({
          employee_id: authData.user.id,
          code: couponCode,
          discount_percent: 20,
          is_active: true
        })

      if (couponError) {
        console.error(`⚠️  Coupon error:`, couponError.message)
      } else {
        console.log(`✅ Coupon created: ${couponCode}`)
      }
    }

    return authData.user.id
  } catch (error) {
    console.error(`❌ Unexpected error:`, error.message)
    return null
  }
}

async function main() {
  console.log('\n🚀 Creating test accounts for E2E testing...\n')
  console.log('═══════════════════════════════════════════════════════\n')

  for (const account of testAccounts) {
    await createTestAccount(account)
  }

  console.log('\n═══════════════════════════════════════════════════════')
  console.log('\n📋 TEST ACCOUNTS SUMMARY\n')

  for (const account of testAccounts) {
    const loginUrl = account.role === 'admin'
      ? account.adminSubRole === 'attorney_admin'
        ? '/attorney-portal/login'
        : '/secure-admin-gateway/login'
      : '/auth/login'

    console.log(`${account.role.toUpperCase()}${account.adminSubRole ? ` (${account.adminSubRole})` : ''}:`)
    console.log(`  Email:    ${account.email}`)
    console.log(`  Password: ${account.password}`)
    console.log(`  Login:    https://www.talk-to-my-lawyer.com${loginUrl}`)
    console.log('')
  }

  console.log('═══════════════════════════════════════════════════════\n')
}

main()
  .then(() => {
    console.log('✅ Script completed successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Script failed:', error)
    process.exit(1)
  })
