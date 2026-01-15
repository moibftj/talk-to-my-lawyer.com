# Testing Guide

This directory contains the test suite for Talk-To-My-Lawyer application.

## Structure

```
tests/
├── setup.ts                 # Test setup and mocks
├── lib/                     # Unit tests for library functions
│   ├── services/           # Service layer tests
│   └── validation/         # Validation schema tests
├── api/                     # Integration tests for API routes
│   └── stripe/             # Stripe webhook tests
└── e2e/                     # End-to-end tests
    ├── auth.spec.ts        # Authentication flows
    └── letter-generation.spec.ts  # Letter generation flows
```

## Running Tests

### Unit & Integration Tests (Vitest)

```bash
# Run all tests
pnpm test

# Run with coverage
pnpm test:coverage

# Watch mode
pnpm test:watch

# Run specific test file
pnpm test tests/lib/services/allowance-service.test.ts
```

### E2E Tests (Playwright)

```bash
# Install browsers (first time only)
pnpm exec playwright install

# Run all E2E tests
pnpm test:e2e

# Run in UI mode
pnpm test:e2e:ui

# Run specific browser
pnpm exec playwright test --project=chromium

# Debug mode
pnpm exec playwright test --debug
```

## Writing Tests

### Unit Tests

```typescript
import { describe, it, expect, vi } from 'vitest'

describe('Feature Name', () => {
  it('should do something', () => {
    expect(true).toBe(true)
  })
})
```

### E2E Tests

```typescript
import { test, expect } from '@playwright/test'

test('should display page', async ({ page }) => {
  await page.goto('/path')
  await expect(page.getByRole('heading')).toBeVisible()
})
```

## Coverage Goals

- **Lines**: 70%+
- **Functions**: 70%+
- **Branches**: 70%+
- **Statements**: 70%+

## Critical Paths to Test

1. **Payment Processing**: Stripe webhooks, subscription activation
2. **Allowance Management**: Credit deduction, rollback, concurrency
3. **Letter Generation**: AI generation, workflow execution, state transitions
4. **Authentication**: Login, signup, password reset, admin auth
5. **Security**: Input validation, CSRF protection, RLS enforcement

## Test Environment

Tests use `.env.test` or mocked environment variables. Never use production credentials in tests.

## CI/CD Integration

Tests run automatically on:
- Pull request creation
- Push to main branch
- Pre-deployment checks

## TODO: Expand Coverage

- [ ] API route integration tests
- [ ] Workflow step tests
- [ ] Email service tests
- [ ] Rate limiting tests
- [ ] RLS policy tests (requires database)
- [ ] Component unit tests
- [ ] Admin portal E2E tests
- [ ] Attorney portal E2E tests
