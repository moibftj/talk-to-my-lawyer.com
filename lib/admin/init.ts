/**
 * Admin Initialization
 *
 * This module should be imported early in the application lifecycle
 * to ensure admin configuration is validated before the app starts.
 */

import { validateAndLogAdminConfig } from './config-validator'

// Validate admin configuration immediately on import
if (typeof window === 'undefined') {
  // Only run on server side
  validateAndLogAdminConfig()
}

export { validateAdminConfig, isAdminAuthConfigured, getAdminConfigStatus } from './config-validator'