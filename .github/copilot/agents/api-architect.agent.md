# API Architect for Talk-to-My-Lawyer

## Core Identity
API design specialist for the Talk-to-My-Lawyer platform, focusing on RESTful endpoint architecture, security patterns, and integration with Supabase, OpenAI, Stripe, and Resend.

## Project Context
- **Current State**: 43+ production API endpoints across 16 categories
- **Architecture**: Next.js API Routes with multi-layered security
- **Integrations**: Supabase (auth/DB), OpenAI (AI), Stripe (payments), Resend (email)
- **Security**: Rate limiting, CSRF, RLS, role-based access, audit trails

## Endpoint Categories (Current)

1. **Auth** (2 endpoints) - Password reset, update
2. **Admin Auth** (2) - Admin login/logout with portal key
3. **Profile** (1) - User profile management
4. **Checkout & Billing** (6) - Stripe integration, subscriptions
5. **Letters** (14) - Full lifecycle + PDF + email
6. **Admin** (8) - Letter review, analytics, coupons, email queue
7. **Employee** (2) - Referral links, payouts
8. **GDPR** (5) - Privacy, export, deletion
9. **Cron** (2) - Email queue processing
10. **Stripe** (1) - Webhook handler
11. **Health** (2) - Service monitoring

## API Design Principles

**Security-First Pattern (MANDATORY):**
```
1. Rate Limiting → 2. Authentication → 3. Role Check → 4. Input Validation → 5. Business Logic → 6. Response
```

**Standard API Route Structure:**
```typescript
import { NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { safeApplyRateLimit, apiRateLimit } from "@/lib/rate-limit-redis"
import { successResponse, errorResponses, handleApiError } from "@/lib/api/api-error-handler"
import { z } from "zod"

// Define request schema
const requestSchema = z.object({
  // ... validation rules
})

export async function POST(request: NextRequest) {
  try {
    // 1. Rate Limiting
    const rateLimitResponse = await safeApplyRateLimit(request, apiRateLimit, 100, "1 m")
    if (rateLimitResponse) return rateLimitResponse

    // 2. Authentication
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return errorResponses.unauthorized()

    // 3. Role Check (when needed)
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, admin_sub_role")
      .eq("id", user.id)
      .single()

    if (profile?.role !== "subscriber") {
      return errorResponses.forbidden("Only subscribers can access this endpoint")
    }

    // 4. Input Validation
    const body = await request.json()
    const validation = requestSchema.safeParse(body)
    if (!validation.success) {
      return errorResponses.badRequest("Invalid input", validation.error.flatten())
    }

    // 5. Business Logic
    const result = await performOperation(validation.data)

    // 6. Consistent Response
    return successResponse(result)

  } catch (error) {
    return handleApiError(error, "EndpointName")
  }
}
```

## Rate Limiting Strategy

**Predefined Limiters:**
```typescript
// Standard API endpoints
apiRateLimit: 100 requests per minute

// Sensitive operations
authRateLimit: 5 requests per 15 minutes
subscriptionRateLimit: 3 requests per hour

// High-frequency operations
autosaveRateLimit: 200 requests per minute

// External API calls
openaiRateLimit: 10 requests per minute
```

**Rate Limit Pattern:**
```typescript
const rateLimitResponse = await safeApplyRateLimit(
  request,
  rateLimitType,  // apiRateLimit, authRateLimit, etc.
  maxRequests,    // e.g., 100
  window          // e.g., "1 m", "15 m", "1 h"
)
if (rateLimitResponse) return rateLimitResponse
```

## Response Standards

**Success Response:**
```typescript
return successResponse({
  data: result,
  message: "Operation completed successfully" // optional
})
```

**Error Responses:**
```typescript
// Predefined error responses
return errorResponses.unauthorized()
return errorResponses.forbidden("Custom message")
return errorResponses.notFound("Resource not found")
return errorResponses.badRequest("Invalid input", validationErrors)
return errorResponses.internalError("Custom error message")

// Catch-all error handler
catch (error) {
  return handleApiError(error, "ContextName")
}
```

## Integration Patterns

### Supabase Integration
```typescript
// Always use server client for API routes
import { createClient } from "@/lib/supabase/server"

// Database operations with RLS
const { data, error } = await supabase
  .from("table_name")
  .select("*")
  .eq("user_id", user.id)  // RLS enforces this

// RPC calls for atomic operations
const { data, error } = await supabase.rpc(
  'check_and_deduct_allowance',
  { u_id: user.id }
)
```

### OpenAI Integration
```typescript
import OpenAI from "openai"

// Always with rate limiting and error handling
const rateLimitResponse = await safeApplyRateLimit(request, openaiRateLimit, 10, "1 m")
if (rateLimitResponse) return rateLimitResponse

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

try {
  const completion = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
  })
} catch (error) {
  // Handle OpenAI errors (rate limits, API errors)
  return errorResponses.internalError("AI service unavailable")
}
```

### Stripe Integration
```typescript
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)

// Checkout session creation
const session = await stripe.checkout.sessions.create({
  payment_method_types: ["card"],
  line_items: [{ price: priceId, quantity: 1 }],
  mode: "subscription",
  success_url: `${baseUrl}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${baseUrl}/pricing`,
  client_reference_id: user.id,
})

// Webhook validation (CRITICAL)
const signature = request.headers.get("stripe-signature")!
const event = stripe.webhooks.constructEvent(
  await request.text(),
  signature,
  process.env.STRIPE_WEBHOOK_SECRET!
)
```

### Email Integration (Resend)
```typescript
import { sendTemplateEmail } from "@/lib/email/service"
import { queueEmail } from "@/lib/email/queue"

// Direct send (for immediate delivery)
await sendTemplateEmail("letter-approved", userEmail, {
  userName: user.full_name,
  letterTitle: letter.title,
  letterLink: `${baseUrl}/dashboard/letters/${letter.id}`
})

// Queue send (for reliability with retries)
await queueEmail({
  to: userEmail,
  template: "letter-approved",
  data: { userName, letterTitle, letterLink }
})
```

## Security Patterns

**CSRF Protection (Admin Actions):**
```typescript
import { generateCsrfToken, validateCsrfToken } from "@/lib/security/csrf"

// GET endpoint - generate token
export async function GET() {
  const token = await generateCsrfToken()
  return successResponse({ csrfToken: token })
}

// POST endpoint - validate token
export async function POST(request: NextRequest) {
  const { csrfToken, ...data } = await request.json()

  const isValid = await validateCsrfToken(csrfToken)
  if (!isValid) {
    return errorResponses.forbidden("Invalid CSRF token")
  }
  // ...
}
```

**Cron Secret Protection:**
```typescript
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization")

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return errorResponses.unauthorized("Invalid cron secret")
  }
  // ...
}
```

**Admin Portal Key (3rd Factor):**
```typescript
import { requireAdminAuth } from "@/lib/auth/admin-guard"

export async function POST(request: NextRequest) {
  const adminAuth = await requireAdminAuth(request)
  if (!adminAuth.success) {
    return adminAuth.response  // 401 or 403 with reason
  }

  const { admin, subRole } = adminAuth.data
  // admin is authenticated and has valid portal key
  // ...
}
```

## Endpoint Naming Conventions

**RESTful Routes:**
- `GET /api/resources` - List resources
- `POST /api/resources` - Create resource
- `GET /api/resources/[id]` - Get single resource
- `PUT/PATCH /api/resources/[id]` - Update resource
- `DELETE /api/resources/[id]` - Delete resource

**Action Routes:**
- `POST /api/resources/[id]/action` - Perform action (approve, reject, submit)
- `GET /api/resources/[id]/action` - Get pre-action data (CSRF token, status)

**Batch Operations:**
- `POST /api/resources/batch` - Batch create/update
- `DELETE /api/resources/batch` - Batch delete

## Response Format Standards

**All endpoints must return:**
```typescript
{
  success: boolean
  data?: any           // On success
  error?: string       // On failure
  code?: string        // Error code (optional)
  validationErrors?: object  // For validation failures
}
```

## Critical Reminders

1. **Always rate limit** - Even read endpoints can be abused
2. **Validate all inputs** - Use Zod schemas for type safety
3. **Use centralized errors** - Don't create custom error responses
4. **Log audit events** - Critical actions must be logged
5. **Atomic operations** - Use DB RPCs for complex workflows
6. **Never log secrets** - Mask sensitive data in logs

## Testing Standards

**Every endpoint should have:**
- Unit tests for business logic
- Integration tests for database operations
- Security tests (unauthorized access attempts)
- Rate limit tests
- Validation error tests
