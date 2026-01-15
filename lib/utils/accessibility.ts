/**
 * Accessibility utilities for WCAG 2.1 AA compliance
 */

/**
 * Skip link component props for main content navigation
 */
export interface SkipLinkProps {
  targetId: string
  label?: string
}

/**
 * Generate ARIA labels for form fields
 */
export function getFormAriaLabels(fieldName: string) {
  const labels: Record<string, { label: string; description?: string; required?: boolean }> = {
    email: {
      label: 'Email address',
      description: 'Enter your email address for account access',
      required: true,
    },
    password: {
      label: 'Password',
      description: 'Enter your password',
      required: true,
    },
    situation: {
      label: 'Legal situation description',
      description: 'Describe your legal situation in detail (maximum 5000 characters)',
      required: true,
    },
    recipient: {
      label: 'Letter recipient',
      description: 'Who should receive this letter?',
      required: true,
    },
    desired_outcome: {
      label: 'Desired outcome',
      description: 'What do you want to achieve with this letter?',
      required: true,
    },
    context: {
      label: 'Additional context',
      description: 'Any additional information that might be relevant (optional)',
      required: false,
    },
  }

  return labels[fieldName] || { label: fieldName, required: false }
}

/**
 * Generate accessible loading state announcement
 */
export function getLoadingAnnouncement(action: string): string {
  const announcements: Record<string, string> = {
    'generating-letter': 'Generating your letter. This may take up to 30 seconds. Please wait.',
    'submitting-form': 'Submitting form. Please wait.',
    'processing-payment': 'Processing payment. Please do not close this window.',
    'saving-draft': 'Saving draft. Please wait.',
    'uploading': 'Uploading file. Please wait.',
  }

  return announcements[action] || `${action}. Please wait.`
}

/**
 * Generate accessible error announcements
 */
export function getErrorAnnouncement(errorType: string, details?: string): string {
  const errorMessages: Record<string, string> = {
    'auth-failed': 'Authentication failed. Please check your credentials and try again.',
    'network-error': 'Network error. Please check your connection and try again.',
    'validation-error': 'Form validation failed. Please review the errors below.',
    'insufficient-credits': 'Insufficient letter credits. Please upgrade your plan to continue.',
    'generation-failed': 'Letter generation failed. Please try again or contact support.',
    'payment-failed': 'Payment processing failed. Please check your payment details.',
  }

  const baseMessage = errorMessages[errorType] || 'An error occurred.'
  return details ? `${baseMessage} Details: ${details}` : baseMessage
}

/**
 * Keyboard navigation utilities
 */
export const KEYBOARD_KEYS = {
  ENTER: 'Enter',
  SPACE: ' ',
  ESCAPE: 'Escape',
  TAB: 'Tab',
  ARROW_UP: 'ArrowUp',
  ARROW_DOWN: 'ArrowDown',
  ARROW_LEFT: 'ArrowLeft',
  ARROW_RIGHT: 'ArrowRight',
} as const

/**
 * Check if element should handle keyboard event
 */
export function isActivationKey(key: string): boolean {
  return key === KEYBOARD_KEYS.ENTER || key === KEYBOARD_KEYS.SPACE
}

/**
 * Generate unique IDs for form field associations
 */
export function generateFieldIds(fieldName: string) {
  return {
    field: `field-${fieldName}`,
    label: `label-${fieldName}`,
    description: `description-${fieldName}`,
    error: `error-${fieldName}`,
  }
}

/**
 * Focus management utilities
 */
export function trapFocus(containerElement: HTMLElement) {
  const focusableElements = containerElement.querySelectorAll<HTMLElement>(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )

  const firstElement = focusableElements[0]
  const lastElement = focusableElements[focusableElements.length - 1]

  return (event: KeyboardEvent) => {
    if (event.key !== KEYBOARD_KEYS.TAB) return

    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault()
      lastElement?.focus()
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault()
      firstElement?.focus()
    }
  }
}

/**
 * Announce message to screen readers
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite') {
  const announcement = document.createElement('div')
  announcement.setAttribute('role', 'status')
  announcement.setAttribute('aria-live', priority)
  announcement.setAttribute('aria-atomic', 'true')
  announcement.className = 'sr-only'
  announcement.textContent = message

  document.body.appendChild(announcement)

  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement)
  }, 1000)
}
