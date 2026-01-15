# Accessibility Improvements - Implementation Guide

This document outlines accessibility improvements for WCAG 2.1 AA compliance.

## Critical Issues Addressed

### 1. ARIA Labels and Semantic HTML

**Status**: ⚠️ Partial - Utility created, needs implementation in components

**What was done**:
- Created `/lib/utils/accessibility.ts` with reusable ARIA label utilities
- Defined form field labels, descriptions, and error announcements
- Created keyboard navigation helpers

**What needs to be done**:

#### Login/Signup Pages
Apply to:
- `/app/auth/login/page.tsx`
- `/app/auth/signup/page.tsx`
- `/app/secure-admin-gateway/login/page.tsx`
- `/app/attorney-portal/login/page.tsx`

```tsx
import { getFormAriaLabels, generateFieldIds } from '@/lib/utils/accessibility'

const emailIds = generateFieldIds('email')
const emailLabels = getFormAriaLabels('email')

<label htmlFor={emailIds.field} id={emailIds.label}>
  {emailLabels.label}
  {emailLabels.required && <span aria-label="required">*</span>}
</label>
<input
  id={emailIds.field}
  type="email"
  aria-labelledby={emailIds.label}
  aria-describedby={emailIds.description}
  aria-required={emailLabels.required}
  aria-invalid={hasError}
  aria-errormessage={hasError ? emailIds.error : undefined}
/>
{emailLabels.description && (
  <p id={emailIds.description} className="text-sm text-muted-foreground">
    {emailLabels.description}
  </p>
)}
{hasError && (
  <p id={emailIds.error} role="alert" className="text-sm text-destructive">
    {errorMessage}
  </p>
)}
```

#### Letter Generation Form
Apply to: `/app/dashboard/letters/new/page.tsx`

```tsx
// Add live region for generation status
<div role="status" aria-live="polite" aria-atomic="true">
  {isGenerating && getLoadingAnnouncement('generating-letter')}
</div>

// Add progress indicator with ARIA
<div role="progressbar"
     aria-valuenow={progress}
     aria-valuemin={0}
     aria-valuemax={100}
     aria-label="Letter generation progress">
  {progress}%
</div>

// Form fields with proper labels
const situationIds = generateFieldIds('situation')
const situationLabels = getFormAriaLabels('situation')

<label htmlFor={situationIds.field}>{situationLabels.label}</label>
<textarea
  id={situationIds.field}
  aria-describedby={situationIds.description}
  aria-required={true}
  maxLength={5000}
  aria-label={`${situationLabels.label}. ${situationLabels.description}`}
/>
```

### 2. Keyboard Navigation

**Status**: ⚠️ Utility created, needs implementation

**What needs to be done**:

#### Modal/Dialog Components
```tsx
import { trapFocus, KEYBOARD_KEYS } from '@/lib/utils/accessibility'

useEffect(() => {
  if (isOpen && modalRef.current) {
    const handleKeyDown = trapFocus(modalRef.current)
    modalRef.current.addEventListener('keydown', handleKeyDown)

    // Focus first element
    const firstFocusable = modalRef.current.querySelector<HTMLElement>('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    firstFocusable?.focus()

    return () => {
      modalRef.current?.removeEventListener('keydown', handleKeyDown)
    }
  }
}, [isOpen])

// Close on Escape
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.key === KEYBOARD_KEYS.ESCAPE) {
    onClose()
  }
}
```

#### Interactive Elements
```tsx
// Make divs with click handlers accessible
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => {
    if (isActivationKey(e.key)) {
      e.preventDefault()
      handleClick()
    }
  }}
  aria-label="Action description"
>
  Content
</div>
```

### 3. Skip Links

**Status**: ❌ Not implemented

**Implementation needed**:

Create `/components/ui/skip-link.tsx`:
```tsx
export function SkipLink({ targetId, label = "Skip to main content" }: SkipLinkProps) {
  return (
    <a
      href={`#${targetId}`}
      className="sr-only focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:p-4 focus:bg-primary focus:text-primary-foreground"
    >
      {label}
    </a>
  )
}
```

Add to all layouts:
```tsx
// app/dashboard/layout.tsx
<SkipLink targetId="main-content" />
<main id="main-content" tabIndex={-1}>
  {children}
</main>
```

### 4. Screen Reader Announcements

**Status**: ✅ Utility created

**Usage in components**:

```tsx
import { announceToScreenReader, getLoadingAnnouncement, getErrorAnnouncement } from '@/lib/utils/accessibility'

// On successful action
announceToScreenReader('Letter generated successfully', 'polite')

// On error (more urgent)
announceToScreenReader(getErrorAnnouncement('generation-failed'), 'assertive')

// During loading
announceToScreenReader(getLoadingAnnouncement('generating-letter'), 'polite')
```

### 5. Focus Management

**Status**: ⚠️ Needs implementation in key flows

**Implementation needed**:

#### After Form Submission
```tsx
const errorSummaryRef = useRef<HTMLDivElement>(null)

// After validation fails, focus error summary
if (hasErrors) {
  errorSummaryRef.current?.focus()
}

<div
  ref={errorSummaryRef}
  tabIndex={-1}
  role="alert"
  aria-labelledby="error-summary-title"
>
  <h2 id="error-summary-title">There are {errorCount} errors in the form</h2>
  <ul>
    {errors.map(error => (
      <li key={error.field}>
        <a href={`#field-${error.field}`}>{error.message}</a>
      </li>
    ))}
  </ul>
</div>
```

#### After Page Navigation
```tsx
// Focus main heading after client-side navigation
useEffect(() => {
  const mainHeading = document.querySelector('h1')
  if (mainHeading) {
    mainHeading.setAttribute('tabIndex', '-1')
    mainHeading.focus()
  }
}, [pathname])
```

### 6. Color Contrast

**Status**: ❌ Needs audit

**Action required**:
1. Run automated contrast checker on all pages
2. Ensure all text meets WCAG AA standards:
   - Normal text: 4.5:1 minimum
   - Large text (18pt+): 3:1 minimum
3. Check interactive elements (buttons, links, form fields)

**Tool**: Use browser DevTools Accessibility panel or axe DevTools extension

### 7. Form Validation

**Status**: ⚠️ Partial - Needs ARIA integration

**Implementation needed**:

```tsx
// Real-time validation feedback
<input
  aria-invalid={!!errors.email}
  aria-describedby={errors.email ? 'email-error' : 'email-description'}
/>
{errors.email && (
  <p id="email-error" role="alert" className="text-destructive">
    {errors.email}
  </p>
)}
```

## Implementation Priority

### Phase 1 (Immediate - This PR)
- ✅ Create accessibility utilities
- ❌ Add skip links to all layouts
- ❌ Add ARIA labels to login/signup forms
- ❌ Add live regions for loading states

### Phase 2 (Next Sprint)
- ❌ Keyboard navigation for all modals
- ❌ Focus management for forms
- ❌ Error summary pattern for multi-field forms
- ❌ Screen reader announcements for all async operations

### Phase 3 (Following Sprint)
- ❌ Color contrast audit and fixes
- ❌ Comprehensive keyboard testing
- ❌ Screen reader testing (NVDA, JAWS, VoiceOver)
- ❌ Automated accessibility testing in CI

## Testing Checklist

### Manual Testing
- [ ] Navigate entire app using only keyboard (Tab, Enter, Escape)
- [ ] Test with screen reader (NVDA on Windows, VoiceOver on Mac)
- [ ] Disable CSS and verify content order makes sense
- [ ] Test all forms with keyboard only
- [ ] Verify all interactive elements are focusable
- [ ] Check focus indicators are visible
- [ ] Test skip links work correctly
- [ ] Verify live regions announce changes

### Automated Testing
- [ ] Run axe DevTools on all pages
- [ ] Check Lighthouse accessibility score (target: 100)
- [ ] Add accessibility tests to Playwright suite
- [ ] Run WAVE browser extension checks

### Compliance Requirements
- [ ] WCAG 2.1 Level AA compliance
- [ ] Section 508 compliance
- [ ] ADA compliance (for US)

## Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [ARIA Authoring Practices](https://www.w3.org/WAI/ARIA/apg/)
- [WebAIM Checklist](https://webaim.org/standards/wcag/checklist)
- [MDN Accessibility](https://developer.mozilla.org/en-US/docs/Web/Accessibility)

## Notes

This is a foundational improvement. Full WCAG 2.1 AA compliance requires:
1. Component-by-component implementation
2. Comprehensive testing with assistive technologies
3. User testing with people who use screen readers
4. Ongoing monitoring and maintenance

The utilities created in this PR provide the building blocks. Each component needs individual attention to ensure proper implementation.
