import React from 'react'
import { cn } from '@/lib/utils'

interface SkipLinkProps {
  targetId: string
  label?: string
  className?: string
}

/**
 * Skip link component for keyboard navigation accessibility
 * Allows users to skip repetitive navigation and jump to main content
 *
 * Usage:
 * <SkipLink targetId="main-content" />
 * <main id="main-content" tabIndex={-1}>...</main>
 */
export function SkipLink({
  targetId,
  label = "Skip to main content",
  className
}: SkipLinkProps) {
  return (
    <a
      href={`#${targetId}`}
      className={cn(
        // Hidden by default
        "sr-only",
        // Visible when focused
        "focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50",
        "focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground",
        "focus:rounded-md focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring",
        // Smooth transition
        "transition-opacity",
        className
      )}
      onClick={(e) => {
        // Ensure target element receives focus after navigation
        const target = document.getElementById(targetId)
        if (target) {
          e.preventDefault()
          target.setAttribute('tabindex', '-1')
          target.focus()
          target.scrollIntoView({ behavior: 'smooth', block: 'start' })

          // Update URL hash without triggering scroll
          if (window.history.pushState) {
            window.history.pushState(null, '', `#${targetId}`)
          }
        }
      }}
    >
      {label}
    </a>
  )
}
