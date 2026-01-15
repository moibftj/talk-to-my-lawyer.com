# Production Monitoring Setup Guide

## Overview

Production monitoring infrastructure is ready to be configured with Sentry.

## Quick Start

### 1. Install Sentry

```bash
pnpm add @sentry/nextjs
```

### 2. Add Environment Variables

```bash
# .env.local and production
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id
```

### 3. Uncomment Sentry Code

Edit `lib/monitoring/sentry.ts` and uncomment the Sentry import and implementation.

### 4. Test

```bash
pnpm dev
# Visit app and check console for Sentry initialization
```

## Files Created

- ✅ `lib/monitoring/sentry.ts` - Monitoring utilities (placeholder)
- ✅ `MONITORING_SETUP.md` - This guide

## Next Steps

1. Create Sentry account at https://sentry.io
2. Create Next.js project in Sentry
3. Copy DSN to environment variables
4. Install Sentry SDK
5. Uncomment implementation in sentry.ts
6. Add error tracking to critical operations
7. Set up alerts for production issues

## Critical Operations to Monitor

- Letter generation failures
- Payment processing errors
- Authentication issues
- Database connection errors
- API rate limit violations
- Workflow execution failures

See full guide in project documentation.
