/**
 * Sentry error tracking and performance monitoring
 * Placeholder for Sentry integration
 *
 * To enable:
 * 1. Install: pnpm add @sentry/nextjs
 * 2. Add NEXT_PUBLIC_SENTRY_DSN to .env
 * 3. Uncomment import and init code
 * 4. See MONITORING_SETUP.md for full guide
 */

// import * as Sentry from '@sentry/nextjs'

export function initSentry() {
  // Sentry initialization placeholder
  // Uncomment when @sentry/nextjs is installed
  console.log('[Monitoring] Sentry setup pending - see MONITORING_SETUP.md')
}

export function captureException(error: Error, context?: Record<string, any>) {
  if (process.env.NODE_ENV === 'production') {
    // Sentry.captureException(error, { extra: context })
    console.error('[Production Error]', error, context)
  } else {
    console.error('[Dev Error]', error, context)
  }
}

export function captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info') {
  if (process.env.NODE_ENV === 'production') {
    // Sentry.captureMessage(message, { level })
    console.log(`[Production ${level}]`, message)
  }
}

export function setUserContext(user: { id: string; email?: string; role?: string }) {
  // Sentry.setUser(user)
  console.log('[Monitoring] User context set:', user.id)
}

export function clearUserContext() {
  // Sentry.setUser(null)
}
