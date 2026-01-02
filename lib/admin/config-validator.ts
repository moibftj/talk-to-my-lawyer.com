/**
 * Admin Configuration Validator
 *
 * Validates required admin environment variables on application startup.
 * Supports multiple admin mode - only ADMIN_PORTAL_KEY is required.
 * Admin users are managed in the database with role='admin'.
 */

interface AdminConfig {
  adminPortalKey?: string
  isValid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * Validate admin environment variables
 * Returns validation result with any errors or warnings
 * Multi-admin mode: Only ADMIN_PORTAL_KEY is required
 */
export function validateAdminConfig(): AdminConfig {
  const config: AdminConfig = {
    isValid: true,
    errors: [],
    warnings: []
  }

  // Check admin portal key (required for security)
  const adminPortalKey = process.env.ADMIN_PORTAL_KEY
  if (!adminPortalKey) {
    config.isValid = false
    config.errors.push('ADMIN_PORTAL_KEY environment variable is required')
  } else if (adminPortalKey.length < 16) {
    config.warnings.push('ADMIN_PORTAL_KEY should be at least 16 characters long for security')
  } else {
    config.adminPortalKey = adminPortalKey
  }

  // Optional: Check if legacy admin credentials are set (for backward compatibility)
  const adminEmail = process.env.ADMIN_EMAIL
  const adminPassword = process.env.ADMIN_PASSWORD

  if (adminEmail || adminPassword) {
    if (!adminEmail || !adminPassword) {
      config.warnings.push('ADMIN_EMAIL and ADMIN_PASSWORD are deprecated. Admin users should be created in the database with role="admin"')
    } else {
      config.warnings.push('ADMIN_EMAIL and ADMIN_PASSWORD are deprecated but still set. Consider removing them and using database-managed admin users')
    }
  }

  // Additional security checks
  const nodeEnv = process.env.NODE_ENV
  if (nodeEnv === 'production') {
    // Check for default portal keys
    if (adminPortalKey && ['admin', 'portal', 'key', 'default'].includes(adminPortalKey.toLowerCase())) {
      config.isValid = false
      config.errors.push('Using default portal keys in production is not allowed')
    }
  }

  return config
}

/**
 * Validate admin config and log results
 * Should be called during application startup
 */
export function validateAndLogAdminConfig(): void {
  const config = validateAdminConfig()

  if (!config.isValid) {
    console.error('\n❌ ADMIN CONFIGURATION VALIDATION FAILED')
    console.error('Admin authentication will not work properly!')
    console.error('\nErrors:')
    config.errors.forEach(error => {
      console.error(`  - ${error}`)
    })
    console.error('\nPlease set these environment variables before starting the application.\n')

    // In development, continue with warnings but in production, we should not
    if (process.env.NODE_ENV === 'production') {
      process.exit(1)
    }
  } else {
    console.log('✅ Admin configuration is valid')

    if (config.warnings.length > 0) {
      console.log('\n⚠️  Warnings:')
      config.warnings.forEach(warning => {
        console.log(`  - ${warning}`)
      })
      console.log()
    }
  }
}

/**
 * Check if admin authentication is configured
 * Returns true if all required variables are set
 */
export function isAdminAuthConfigured(): boolean {
  const config = validateAdminConfig()
  return config.isValid
}

/**
 * Get admin configuration status (for health checks)
 */
export function getAdminConfigStatus() {
  const config = validateAdminConfig()
  return {
    configured: config.isValid,
    portalKeySet: !!process.env.ADMIN_PORTAL_KEY,
    errorCount: config.errors.length,
    warningCount: config.warnings.length,
    multiAdminMode: true
  }
}