# Talk-To-My-Lawyer Architecture Plan

This document provides a detailed architectural overview of the Talk-To-My-Lawyer platform, including function signatures, type definitions, data flow, and component interactions.

---

## Table of Contents

1. [Type Definitions](#type-definitions)
2. [Function Signatures](#function-signatures)
3. [Data Flow](#data-flow)
4. [File Structure](#file-structure)
5. [Component Interactions](#component-interactions)
6. [API Route Specifications](#api-route-specifications)
7. [Database Schema](#database-schema)

---

## Type Definitions

### Core Domain Types

```typescript
// Location: /types/index.ts

// User Role Types
export type UserRole = 'subscriber' | 'employee' | 'admin'

// Letter Status Lifecycle
export type LetterStatus =
  | 'draft'          // Initial state - user is filling form
  | 'generating'     // AI is generating content
  | 'pending_review' // Waiting for attorney review
  | 'under_review'   // Attorney has started review
  | 'approved'       // Attorney approved the letter
  | 'completed'      // Letter delivered to user
  | 'rejected'       // Attorney rejected the letter
  | 'failed'         // Generation failed

// Subscription Status Types
export type SubscriptionStatus = 'active' | 'canceled' | 'past_due' | 'pending' | 'payment_failed' | 'expired'

// Commission Status Types
export type CommissionStatus = 'pending' | 'paid' | 'cancelled'
```

### Entity Interfaces

```typescript
// Location: /types/index.ts & /lib/database.types.ts

// Profile Entity
export interface Profile {
  id: string                    // UUID - FK to auth.users
  email: string                 // User email
  full_name: string | null      // Display name
  role: UserRole                // User role
  is_super_user: boolean        // Bypass subscription checks
  phone: string | null          // Contact phone
  company_name: string | null   // Business name
  avatar_url: string | null     // Profile image
  bio: string | null            // User biography
  total_letters_generated: number // Prevents free trial abuse
  created_at: string            // ISO timestamp
  updated_at: string            // ISO timestamp
}

// Letter Entity
export interface Letter {
  id: string                    // UUID
  user_id: string               // FK to profiles
  title: string                 // Letter title
  letter_type: string           // Type of letter (Demand, Cease & Desist, etc.)
  status: LetterStatus          // Current status
  recipient_name: string | null // Recipient info
  recipient_address: string | null
  subject: string | null        // Letter subject
  content: string | null        // Legacy field
  intake_data: Record<string, any> // Form data from user
  ai_draft_content: string | null  // AI-generated draft
  final_content: string | null     // Attorney-approved content
  reviewed_by: string | null       // Admin who reviewed
  reviewed_at: string | null       // Review timestamp
  review_notes: string | null      // Attorney notes
  rejection_reason: string | null  // If rejected
  approved_at: string | null       // Approval timestamp
  completed_at: string | null      // Completion timestamp
  sent_at: string | null           // Delivery timestamp
  notes: string | null             // Additional notes
  created_at: string
  updated_at: string
}

// Subscription Entity
export interface Subscription {
  id: string
  user_id: string
  plan: string                  // Plan name
  plan_type: string             // single, monthly, yearly
  status: SubscriptionStatus
  price: number                 // Amount paid
  discount: number              // Discount applied
  coupon_code: string | null    // Employee coupon used
  employee_id: string | null    // Referring employee
  credits_remaining: number     // Letters remaining
  remaining_letters: number     // Alias for credits_remaining
  current_period_start: string
  current_period_end: string
  stripe_session_id: string | null
  stripe_customer_id: string | null
  created_at: string
  updated_at: string
  expires_at: string | null
}

// Employee Coupon Entity
export interface EmployeeCoupon {
  id: string
  employee_id: string
  code: string                  // Unique coupon code
  discount_percent: number      // 10-50%
  is_active: boolean
  usage_count: number
  created_at: string
  updated_at: string
}

// Commission Entity
export interface Commission {
  id: string
  user_id: string               // Subscriber who used coupon
  employee_id: string           // Employee who earns commission
  subscription_id: string
  subscription_amount: number
  commission_rate: number       // 0.10 = 10%
  commission_amount: number     // Calculated commission
  status: CommissionStatus
  paid_at: string | null
  created_at: string
  updated_at: string
}

// Audit Trail Entity
export interface LetterAuditTrail {
  id: string
  letter_id: string
  performed_by: string          // User who performed action
  action: string                // Action type
  old_status: string | null
  new_status: string | null
  notes: string | null
  created_at: string
}
```

### Email Types

```typescript
// Location: /lib/email/types.ts

// Note: Currently implemented providers are 'brevo', 'smtp', and 'console'
// 'sendgrid' and 'resend' are defined in types but not yet implemented
export type EmailProvider = 'sendgrid' | 'brevo' | 'resend' | 'smtp' | 'console'

export interface EmailMessage {
  to: string | string[]
  from?: { email: string; name?: string }
  subject: string
  text?: string
  html?: string
  attachments?: EmailAttachment[]
  replyTo?: string
  cc?: string | string[]
  bcc?: string | string[]
}

export interface EmailResult {
  success: boolean
  messageId?: string
  error?: string
  provider: EmailProvider
}

export type EmailTemplate =
  | 'welcome'
  | 'password-reset'
  | 'letter-approved'
  | 'letter-rejected'
  | 'letter-generated'
  | 'commission-earned'
  | 'subscription-confirmation'
  // ... more templates
```

### Validation Types

```typescript
// Location: /lib/validation/letter-schema.ts

export interface LetterIntakeSchema {
  senderName: { type: 'string'; required: true; maxLength: 100 }
  senderAddress: { type: 'string'; required: true; maxLength: 500 }
  senderEmail?: { type: 'email'; required: false }
  senderPhone?: { type: 'string'; required: false; maxLength: 20 }
  recipientName: { type: 'string'; required: true; maxLength: 100 }
  recipientAddress: { type: 'string'; required: true; maxLength: 500 }
  recipientEmail?: { type: 'email'; required: false }
  recipientPhone?: { type: 'string'; required: false; maxLength: 20 }
  issueDescription: { type: 'string'; required: true; maxLength: 2000 }
  desiredOutcome: { type: 'string'; required: true; maxLength: 1000 }
  amountDemanded?: { type: 'number'; required: false; min: 0; max: 10000000 }
  deadlineDate?: { type: 'string'; required: false; maxLength: 50 }
  incidentDate?: { type: 'string'; required: false; maxLength: 50 }
  additionalDetails?: { type: 'string'; required: false; maxLength: 3000 }
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  data?: Record<string, unknown>
}
```

### API Response Types

```typescript
// Location: /types/index.ts

export interface ApiResponse<T = unknown> {
  success?: boolean
  data?: T
  error?: string
  message?: string
}

// Letter Generation Response
export interface GenerateLetterResponse {
  success: boolean
  letterId: string
  status: LetterStatus
  isFreeTrial: boolean
  aiDraft: string
}

// Rate Limit Response Headers
interface RateLimitHeaders {
  'X-RateLimit-Limit': string
  'X-RateLimit-Remaining': string
  'X-RateLimit-Reset': string
  'Retry-After': string
}
```

---

## Function Signatures

### Authentication Functions

```typescript
// Location: /lib/supabase/server.ts
export async function createClient(): Promise<SupabaseClient>

// Location: /lib/auth/admin-session.ts
export async function requireAdminAuth(): Promise<NextResponse | null>
export async function getAdminSession(): Promise<AdminSession | null>
export async function isAdmin(userId: string): Promise<boolean>
```

### Letter Generation Functions

```typescript
// Location: /app/api/generate-letter/route.ts
export async function POST(request: NextRequest): Promise<NextResponse>

// Internal helper
function buildPrompt(
  letterType: string, 
  intakeData: Record<string, unknown>
): string
```

### Validation Functions

```typescript
// Location: /lib/validation/letter-schema.ts
export function validateLetterType(letterType: string): { valid: boolean; error?: string }

export function validateIntakeData(
  letterType: string, 
  intakeData: unknown
): ValidationResult

export function validateLetterGenerationRequest(
  letterType: unknown,
  intakeData: unknown
): ValidationResult

export function sanitizePromptInput(text: string): string

export function containsForbiddenPatterns(input: string): boolean
```

### Input Sanitization Functions

```typescript
// Location: /lib/security/input-sanitizer.ts
export function sanitizeString(input: unknown, maxLength?: number): string
export function sanitizeEmail(input: unknown): string
export function sanitizeUrl(input: unknown): string
export function sanitizeHtml(input: unknown): string
export function sanitizeJson(input: unknown): Record<string, unknown>
export function sanitizeNumber(input: unknown, min?: number, max?: number): number | null
export function sanitizeBoolean(input: unknown): boolean
export function sanitizeArray(input: unknown, maxLength?: number): unknown[]
export function sanitizeFileName(input: unknown): string
export function validateInput(
  input: Record<string, unknown>,
  schema: Record<string, SchemaField>
): ValidationResult
```

### AI Service Functions

```typescript
// Location: /lib/ai/openai-retry.ts
export async function generateTextWithRetry(params: {
  prompt: string
  system?: string
  temperature?: number
  maxOutputTokens?: number
  model?: string
}): Promise<{ text: string; attempts: number; duration: number }>

export async function checkOpenAIHealth(): Promise<{
  healthy: boolean
  responseTime?: number
  error?: string
}>

export function generateCacheKey(params: GenerateTextParams): string

// OpenAI Retry Client Class
export class OpenAIRetryClient {
  async generateTextWithRetry(params: GenerateTextParams): Promise<RetryResult<string>>
  getCircuitBreakerState(): CircuitBreakerState
  resetCircuitBreaker(): void
}
```

### Email Service Functions

```typescript
// Location: /lib/email/service.ts
export function getEmailService(): EmailService
export async function sendEmail(message: EmailMessage): Promise<EmailResult>
export async function sendTemplateEmail(
  template: EmailTemplate,
  to: string | string[],
  data: TemplateData
): Promise<EmailResult>

// EmailService Class
class EmailService {
  getProvider(name?: EmailProvider): EmailProviderInterface
  isConfigured(): boolean
  getDefaultFrom(): { email: string; name: string }
  async send(message: EmailMessage, provider?: EmailProvider): Promise<EmailResult>
  async sendTemplate(
    template: EmailTemplate,
    to: string | string[],
    data: TemplateData,
    provider?: EmailProvider
  ): Promise<EmailResult>
  async sendWithRetry(
    message: EmailMessage,
    maxRetries?: number,
    delayMs?: number
  ): Promise<EmailResult>
}
```

### Rate Limiting Functions

```typescript
// Location: /lib/rate-limit-redis.ts
export async function applyRateLimit(
  request: NextRequest,
  rateLimiter: Ratelimit,
  identifier?: string
): Promise<NextResponse | null>

export async function safeApplyRateLimit(
  request: NextRequest,
  rateLimiter: Ratelimit | null,
  fallbackLimit: number,
  fallbackWindow: string,
  identifier?: string,
  prefixName?: string
): Promise<NextResponse | null>

// Rate Limiter Instances
export const authRateLimit: Ratelimit | null      // 5 requests per 15 minutes
export const apiRateLimit: Ratelimit | null       // 100 requests per 1 minute
export const adminRateLimit: Ratelimit | null     // 10 requests per 15 minutes
export const letterGenerationRateLimit: Ratelimit | null // 5 requests per 1 hour
export const subscriptionRateLimit: Ratelimit | null     // 3 requests per 1 hour
```

### CSRF Protection Functions

```typescript
// Location: /lib/security/csrf.ts
export function generateAdminCSRF(): {
  signedToken: string
  expiresAt: number
  cookieHeader: string
}

export async function validateAdminRequest(request: NextRequest): Promise<{
  valid: boolean
  error?: string
}>
```

### Database RPC Functions (Supabase)

```typescript
// Defined in SQL scripts, called via supabase.rpc()

// Letter allowance management
check_letter_allowance(u_id: UUID): {
  has_allowance: boolean
  remaining: number
  is_super: boolean
}

deduct_letter_allowance(u_id: UUID): boolean

add_letter_allowances(u_id: UUID, amount: number): void

// Audit logging
log_letter_audit(
  p_letter_id: UUID,
  p_action: string,
  p_old_status: string,
  p_new_status: string,
  p_notes: string
): void

// User management
increment_total_letters(p_user_id: UUID): void

// Employee coupon management
get_employee_coupon(p_employee_id: UUID): EmployeeCoupon
```

---

## Data Flow

### 1. User Registration Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER REGISTRATION FLOW                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   [User]                                                                    │
│      │                                                                      │
│      ▼                                                                      │
│   /auth/signup (Page)                                                       │
│      │                                                                      │
│      ▼                                                                      │
│   supabase.auth.signUp({email, password})                                   │
│      │                                                                      │
│      ▼                                                                      │
│   Supabase Auth ─────► Email Confirmation                                   │
│      │                                                                      │
│      ▼                                                                      │
│   Database Trigger: handle_new_user()                                       │
│      │                                                                      │
│      ▼                                                                      │
│   Creates Profile Record (role: 'subscriber')                               │
│      │                                                                      │
│      ▼                                                                      │
│   Redirect to /dashboard                                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2. Letter Generation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          LETTER GENERATION FLOW                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   [User]                                                                    │
│      │                                                                      │
│      ▼                                                                      │
│   /dashboard/letters/new (Page Component)                                   │
│      │                                                                      │
│      │ 1. Select letter type                                                │
│      │ 2. Fill intake form                                                  │
│      ▼                                                                      │
│   POST /api/generate-letter                                                 │
│      │                                                                      │
│      ▼                                                                      │
│   ┌─────────────────────────────────────┐                                   │
│   │     Rate Limit Check                │                                   │
│   │  letterGenerationRateLimit (5/hr)   │                                   │
│   └─────────────────────────────────────┘                                   │
│      │                                                                      │
│      ▼                                                                      │
│   ┌─────────────────────────────────────┐                                   │
│   │     Auth Check                      │                                   │
│   │  supabase.auth.getUser()            │                                   │
│   └─────────────────────────────────────┘                                   │
│      │                                                                      │
│      ▼                                                                      │
│   ┌─────────────────────────────────────┐                                   │
│   │     Role Check                      │                                   │
│   │  Must be 'subscriber'               │                                   │
│   └─────────────────────────────────────┘                                   │
│      │                                                                      │
│      ▼                                                                      │
│   ┌─────────────────────────────────────┐                                   │
│   │     Allowance Check                 │                                   │
│   │  - Free trial? (0 letters)          │                                   │
│   │  - Has subscription credits?        │                                   │
│   │  - Is super user?                   │                                   │
│   └─────────────────────────────────────┘                                   │
│      │                                                                      │
│      ▼                                                                      │
│   ┌─────────────────────────────────────┐                                   │
│   │     Input Validation                │                                   │
│   │  validateLetterGenerationRequest()  │                                   │
│   │  - Letter type validation           │                                   │
│   │  - Intake data validation           │                                   │
│   │  - Forbidden pattern check          │                                   │
│   └─────────────────────────────────────┘                                   │
│      │                                                                      │
│      ▼                                                                      │
│   ┌─────────────────────────────────────┐                                   │
│   │     Deduct Allowance (BEFORE AI)    │                                   │
│   │  deduct_letter_allowance(u_id)      │                                   │
│   │  (Prevents race condition)          │                                   │
│   └─────────────────────────────────────┘                                   │
│      │                                                                      │
│      ▼                                                                      │
│   ┌─────────────────────────────────────┐                                   │
│   │     Create Letter Record            │                                   │
│   │  status: 'generating'               │                                   │
│   └─────────────────────────────────────┘                                   │
│      │                                                                      │
│      ▼                                                                      │
│   ┌─────────────────────────────────────┐                                   │
│   │     AI Generation                   │                                   │
│   │  generateTextWithRetry()            │                                   │
│   │  - Circuit breaker check            │                                   │
│   │  - Exponential backoff              │                                   │
│   │  - Up to 3 retries                  │                                   │
│   └─────────────────────────────────────┘                                   │
│      │                                                                      │
│      ├────────────────────────┬─────────────────────────┐                   │
│      ▼                        ▼                         ▼                   │
│   [Success]              [Failure]                 [Refund]                 │
│      │                        │                         │                   │
│      ▼                        ▼                         ▼                   │
│   Update letter           Update letter            add_letter_allowances()  │
│   - ai_draft_content      - status: 'failed'                                │
│   - status: 'pending_review'                                                │
│      │                        │                                             │
│      ▼                        ▼                                             │
│   increment_total_letters()   log_letter_audit()                            │
│      │                                                                      │
│      ▼                                                                      │
│   log_letter_audit()                                                        │
│      │                                                                      │
│      ▼                                                                      │
│   Return { letterId, status, aiDraft }                                      │
│      │                                                                      │
│      ▼                                                                      │
│   Redirect to /dashboard/letters/[id]                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3. Attorney Review Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ATTORNEY REVIEW FLOW                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   [Admin/Attorney]                                                          │
│      │                                                                      │
│      ▼                                                                      │
│   /secure-admin-gateway/dashboard (Admin Dashboard)                         │
│      │                                                                      │
│      │ Lists letters with status: 'pending_review'                          │
│      ▼                                                                      │
│   POST /api/letters/[id]/start-review                                       │
│      │                                                                      │
│      ▼                                                                      │
│   ┌─────────────────────────────────────┐                                   │
│   │  Rate Limit + Auth + CSRF Check     │                                   │
│   └─────────────────────────────────────┘                                   │
│      │                                                                      │
│      ▼                                                                      │
│   Update letter: status = 'under_review'                                    │
│      │                                                                      │
│      ▼                                                                      │
│   ┌──────────────────┬───────────────────┐                                  │
│   │                  │                   │                                  │
│   ▼                  ▼                   ▼                                  │
│ [Approve]        [Reject]           [Improve]                               │
│   │                  │                   │                                  │
│   ▼                  ▼                   ▼                                  │
│ POST /api/       POST /api/         POST /api/                              │
│ letters/[id]/    letters/[id]/      letters/[id]/                           │
│ approve          reject             improve                                 │
│   │                  │                   │                                  │
│   ▼                  ▼                   ▼                                  │
│ Update letter:   Update letter:     Generate new                            │
│ - status:        - status:          AI content with                         │
│   'approved'       'rejected'       improvements                            │
│ - final_content  - rejection_reason                                         │
│ - reviewed_by                                                               │
│ - approved_at                                                               │
│   │                  │                   │                                  │
│   ▼                  ▼                   │                                  │
│ Send email:      Send email:            │                                   │
│ letter-approved  letter-rejected        │                                   │
│   │                  │                   │                                  │
│   └──────────────────┼───────────────────┘                                  │
│                      │                                                      │
│                      ▼                                                      │
│                log_letter_audit()                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4. Subscription & Payment Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        SUBSCRIPTION & PAYMENT FLOW                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   [User]                                                                    │
│      │                                                                      │
│      ▼                                                                      │
│   /dashboard/subscription (Page)                                            │
│      │                                                                      │
│      │ Select plan + Optional coupon code                                   │
│      ▼                                                                      │
│   POST /api/create-checkout                                                 │
│      │                                                                      │
│      ▼                                                                      │
│   ┌─────────────────────────────────────┐                                   │
│   │     Validate Coupon (if provided)   │                                   │
│   │  - Check employee_coupons table     │                                   │
│   │  - Verify is_active = true          │                                   │
│   │  - Apply discount_percent           │                                   │
│   └─────────────────────────────────────┘                                   │
│      │                                                                      │
│      ▼                                                                      │
│   ┌─────────────────────────────────────┐                                   │
│   │     Create Stripe Checkout Session  │                                   │
│   │  - Set price with discount          │                                   │
│   │  - Include metadata (userId, plan)  │                                   │
│   │  - Set success/cancel URLs          │                                   │
│   └─────────────────────────────────────┘                                   │
│      │                                                                      │
│      ▼                                                                      │
│   Redirect to Stripe Checkout                                               │
│      │                                                                      │
│      │ User completes payment                                               │
│      ▼                                                                      │
│   ┌─────────────────────────────────────┐                                   │
│   │  Stripe Webhook: checkout.completed │                                   │
│   │  POST /api/stripe/webhook           │                                   │
│   └─────────────────────────────────────┘                                   │
│      │                                                                      │
│      ▼                                                                      │
│   ┌─────────────────────────────────────┐                                   │
│   │     Create Subscription Record      │                                   │
│   │  - Set credits_remaining            │                                   │
│   │  - Set period dates                 │                                   │
│   │  - status: 'active'                 │                                   │
│   └─────────────────────────────────────┘                                   │
│      │                                                                      │
│      ├─────────────────────────────────────────────┐                        │
│      ▼                                             ▼                        │
│   If coupon used:                           Send email:                     │
│   ┌─────────────────────────────────────┐   subscription-confirmation       │
│   │  Create Commission Record           │                                   │
│   │  - employee_id from coupon          │                                   │
│   │  - commission_rate: 10%             │                                   │
│   │  - status: 'pending'                │                                   │
│   └─────────────────────────────────────┘                                   │
│      │                                                                      │
│      ▼                                                                      │
│   increment coupon usage_count                                              │
│      │                                                                      │
│      ▼                                                                      │
│   Redirect to /dashboard?payment=success                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5. Employee Referral Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          EMPLOYEE REFERRAL FLOW                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   [Employee]                                                                │
│      │                                                                      │
│      ▼                                                                      │
│   /dashboard/coupons (Employee Dashboard)                                   │
│      │                                                                      │
│      │ View auto-generated coupon code                                      │
│      │ (Created via trigger on role = 'employee')                           │
│      ▼                                                                      │
│   Share coupon code with potential customers                                │
│      │                                                                      │
│   ─────────────────────────────────────────                                 │
│                                                                             │
│   [Customer uses coupon at checkout]                                        │
│      │                                                                      │
│      ▼                                                                      │
│   ┌─────────────────────────────────────┐                                   │
│   │  Coupon validated during checkout   │                                   │
│   │  Discount applied to subscription   │                                   │
│   └─────────────────────────────────────┘                                   │
│      │                                                                      │
│      ▼                                                                      │
│   Commission record created (pending)                                       │
│      │                                                                      │
│   ─────────────────────────────────────────                                 │
│                                                                             │
│   [Employee views commissions]                                              │
│      │                                                                      │
│      ▼                                                                      │
│   /dashboard/commissions                                                    │
│      │                                                                      │
│      │ View pending/paid commissions                                        │
│      ▼                                                                      │
│   POST /api/employee/payouts (Request payout)                               │
│      │                                                                      │
│      ▼                                                                      │
│   Admin processes payout manually                                           │
│      │                                                                      │
│      ▼                                                                      │
│   Commission status updated to 'paid'                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## File Structure

### Application Routes (`/app`)

```
app/
├── api/
│   ├── admin/
│   │   ├── analytics/          # Admin analytics endpoints
│   │   ├── coupons/            # Coupon management
│   │   ├── email-queue/        # Email queue management
│   │   └── letters/            # Admin letter operations
│   │
│   ├── admin-auth/             # Admin authentication
│   │
│   ├── auth/
│   │   ├── reset-password/     # Password reset request
│   │   └── update-password/    # Password update
│   │
│   ├── create-checkout/        # Stripe checkout creation
│   ├── create-profile/         # Profile creation
│   │
│   ├── cron/                   # Scheduled tasks
│   │
│   ├── employee/
│   │   ├── payouts/            # Payout requests
│   │   └── referral-link/      # Referral link generation
│   │
│   ├── gdpr/                   # GDPR compliance endpoints
│   ├── generate-letter/        # AI letter generation
│   ├── health/                 # Health check endpoint
│   │
│   ├── letters/
│   │   ├── [id]/
│   │   │   ├── approve/        # Attorney approval
│   │   │   ├── audit/          # Audit trail
│   │   │   ├── complete/       # Mark complete
│   │   │   ├── delete/         # Delete letter
│   │   │   ├── improve/        # AI improvement
│   │   │   ├── pdf/            # PDF generation
│   │   │   ├── reject/         # Attorney rejection
│   │   │   ├── resubmit/       # User resubmission
│   │   │   ├── send-email/     # Send letter via email
│   │   │   ├── start-review/   # Begin attorney review
│   │   │   └── submit/         # User submission
│   │   ├── drafts/             # Draft letters
│   │   └── improve/            # Batch improvements
│   │
│   ├── stripe/                 # Stripe webhooks
│   │
│   ├── subscriptions/
│   │   ├── activate/           # Activate subscription
│   │   ├── billing-history/    # Payment history
│   │   ├── check-allowance/    # Check letter credits
│   │   └── reset-monthly/      # Reset monthly credits
│   │
│   └── verify-payment/         # Payment verification
│
├── auth/
│   ├── login/                  # Login page
│   ├── signup/                 # Signup page
│   └── reset-password/         # Password reset page
│
├── dashboard/
│   ├── billing/                # Billing management
│   ├── commissions/            # Employee commissions
│   ├── coupons/                # Employee coupons
│   ├── employee-settings/      # Employee settings
│   ├── letters/
│   │   ├── [id]/               # Letter detail page
│   │   └── new/                # New letter creation
│   ├── payouts/                # Payout requests
│   ├── referrals/              # Referral tracking
│   ├── settings/               # User settings
│   └── subscription/           # Subscription management
│
├── secure-admin-gateway/
│   ├── dashboard/              # Admin dashboard
│   ├── login/                  # Admin login
│   └── review/                 # Letter review interface
│
├── layout.tsx                  # Root layout
├── page.tsx                    # Landing page
└── globals.css                 # Global styles
```

### Library Code (`/lib`)

```
lib/
├── admin/                      # Admin utilities
├── ai/
│   └── openai-retry.ts         # OpenAI with retry logic & circuit breaker
│
├── auth/
│   └── admin-session.ts        # Admin session management
│
├── constants.ts                # Application constants
├── database.types.ts           # Database type definitions
├── design-tokens.ts            # Design system tokens
│
├── email/
│   ├── index.ts                # Email exports
│   ├── providers/
│   │   ├── brevo.ts            # Brevo provider
│   │   ├── console.ts          # Console provider (dev)
│   │   └── smtp.ts             # SMTP provider
│   ├── queue.ts                # Email queue
│   ├── service.ts              # Email service class
│   ├── templates.ts            # Email templates
│   ├── types.ts                # Email types
│   └── verify-providers.ts     # Provider verification
│
├── errors/                     # Error handling utilities
├── fraud-detection/            # Fraud detection system
├── helpers.ts                  # General helpers
│
├── logging/                    # Logging utilities
├── monitoring/                 # Monitoring utilities
│
├── pdf/                        # PDF generation
│
├── rate-limit-redis.ts         # Redis rate limiting
├── rate-limit.ts               # Fallback rate limiting
│
├── security/
│   ├── csrf.ts                 # CSRF protection
│   └── input-sanitizer.ts      # Input sanitization
│
├── server/                     # Server utilities
│
├── supabase/
│   ├── client.ts               # Browser client
│   ├── config.ts               # Configuration
│   ├── middleware.ts           # Auth middleware
│   └── server.ts               # Server client
│
├── types/                      # Additional types
├── utils/                      # Utility functions
├── utils.ts                    # General utilities
│
└── validation/
    └── letter-schema.ts        # Letter validation schemas
```

### Components (`/components`)

```
components/
├── admin/                      # Admin-specific components
├── ui/                         # shadcn/ui components
│   ├── button.tsx
│   ├── card.tsx
│   ├── dialog.tsx
│   ├── form.tsx
│   ├── input.tsx
│   ├── select.tsx
│   ├── textarea.tsx
│   └── ... (60+ components)
│
├── admin-logout-button.tsx
├── coupon-card.tsx
├── coupon-insights-card.tsx
├── dashboard-layout.tsx
├── generate-button.tsx
├── generation-tracker-modal.tsx
├── letter-actions.tsx
├── pay-commission-button.tsx
├── payment-verifier.tsx
├── review-letter-modal.tsx
├── review-status-modal.tsx
├── subscription-card.tsx
├── subscription-modal.tsx
├── success-message.tsx
└── theme-provider.tsx
```

### Database Scripts (`/scripts`)

```
scripts/
├── 001_setup_schema.sql              # Initial schema
├── 002_setup_rls.sql                 # Row Level Security
├── 003_seed_data.sql                 # Seed data
├── 004_create_functions.sql          # Database functions
├── 005_letter_allowance_system.sql   # Allowance system
├── 006_audit_trail.sql               # Audit trail
├── 007_add_missing_letter_statuses.sql
├── 008_employee_coupon_auto_generation.sql
├── 009_add_missing_subscription_fields.sql
├── 010_add_missing_functions.sql
├── 011_security_hardening.sql
├── 012_add_promo_coupons.sql
├── 013_fix_search_path_handle_new_user.sql
├── 014_fix_all_search_paths.sql
├── 015_all_search_paths_final.sql
├── 016_add_coupon_usage_table.sql
├── 017_add_missing_get_employee_coupon.sql
├── 018_add_coupon_usage_trigger.sql
├── 019_add_is_licensed_attorney_to_profiles.sql
├── 020_decrement_credits_atomic.sql
├── 021_add_total_letters_generated.sql
├── 022_fix_deduct_letter_allowance.sql
├── 023_add_fraud_detection_tables.sql
├── create-admin-user.ts
├── health-check.js
└── validate-env.js
```

---

## Component Interactions

### 1. Letter Creation Component Tree

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        LETTER CREATION COMPONENT TREE                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   NewLetterPage (/dashboard/letters/new/page.tsx)                           │
│   │                                                                         │
│   ├── SubscriptionModal                                                     │
│   │   │   Props: show, onClose, message                                     │
│   │   │   Displays pricing plans when user lacks subscription               │
│   │   └── Button (Select Plan)                                              │
│   │                                                                         │
│   ├── Letter Type Selection Grid                                            │
│   │   │   Maps LETTER_TYPES array to cards                                  │
│   │   └── Button cards (demand_letter, cease_desist, etc.)                  │
│   │                                                                         │
│   ├── Letter Intake Form (when type selected)                               │
│   │   ├── Input (senderName, recipientName)                                 │
│   │   ├── Textarea (addresses, issueDescription, desiredOutcome)            │
│   │   ├── Input (amountDemanded - conditional)                              │
│   │   └── GenerateButton                                                    │
│   │       │   Props: loading, disabled, hasSubscription                     │
│   │       │   State: Shows different states based on subscription           │
│   │       └── Calls handleSubmit() → POST /api/generate-letter              │
│   │                                                                         │
│   └── AI Draft Preview (when generated)                                     │
│       ├── Draft content display (blurred if free trial)                     │
│       ├── Pricing Overlay (conditional for free trial)                      │
│       │   └── Plan cards with "Choose" buttons                              │
│       └── Submit for Review Button                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2. Admin Review Component Tree

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ADMIN REVIEW COMPONENT TREE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   AdminDashboard (/secure-admin-gateway/dashboard/page.tsx)                 │
│   │                                                                         │
│   ├── Stats Overview                                                        │
│   │   └── Card components showing:                                          │
│   │       - Pending reviews count                                           │
│   │       - Letters completed today                                         │
│   │       - Total revenue                                                   │
│   │                                                                         │
│   ├── Letters Table                                                         │
│   │   │   Fetches letters with status = 'pending_review'                    │
│   │   ├── Table headers (Title, Type, User, Status, Created, Actions)       │
│   │   └── Table rows with:                                                  │
│   │       ├── Letter info display                                           │
│   │       └── LetterActions component                                       │
│   │           ├── StartReviewButton                                         │
│   │           │   └── POST /api/letters/[id]/start-review                   │
│   │           ├── ApproveButton                                             │
│   │           │   └── Opens ReviewLetterModal                               │
│   │           ├── RejectButton                                              │
│   │           │   └── Opens rejection modal                                 │
│   │           └── ImproveButton                                             │
│   │               └── POST /api/letters/[id]/improve                        │
│   │                                                                         │
│   └── ReviewLetterModal                                                     │
│       │   Props: letter, isOpen, onClose                                    │
│       ├── AI Draft Display (read-only)                                      │
│       ├── RichTextEditor (final content editing)                            │
│       ├── Textarea (review notes)                                           │
│       └── Action Buttons                                                    │
│           ├── Approve → POST /api/letters/[id]/approve                      │
│           │   Body: { finalContent, reviewNotes }                           │
│           └── Request Changes → POST /api/letters/[id]/reject               │
│               Body: { rejectionReason }                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3. Subscription Component Tree

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       SUBSCRIPTION COMPONENT TREE                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   SubscriptionPage (/dashboard/subscription/page.tsx)                       │
│   │                                                                         │
│   ├── Current Subscription Card (if active)                                 │
│   │   ├── Plan name & status badge                                          │
│   │   ├── Credits remaining display                                         │
│   │   ├── Renewal date                                                      │
│   │   └── Manage/Cancel buttons                                             │
│   │                                                                         │
│   ├── Plan Selection Grid                                                   │
│   │   └── PricingCard × 3 (Single, Monthly, Yearly)                         │
│   │       │   Props: plan, price, features, popular                         │
│   │       ├── Plan details                                                  │
│   │       ├── Feature list                                                  │
│   │       ├── Coupon code input                                             │
│   │       └── Subscribe Button                                              │
│   │           └── POST /api/create-checkout                                 │
│   │               Body: { planType, couponCode }                            │
│   │               Response: { checkoutUrl }                                 │
│   │               → Redirect to Stripe                                      │
│   │                                                                         │
│   └── PaymentVerifier (after Stripe redirect)                               │
│       │   Verifies payment status via session_id                            │
│       ├── Loading state                                                     │
│       ├── Success message                                                   │
│       └── Error handling                                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4. Dashboard Layout Component Tree

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       DASHBOARD LAYOUT COMPONENT TREE                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│   DashboardLayout (/components/dashboard-layout.tsx)                        │
│   │                                                                         │
│   ├── Sidebar                                                               │
│   │   ├── Logo                                                              │
│   │   ├── Navigation Links (role-based)                                     │
│   │   │   ├── [All Roles]                                                   │
│   │   │   │   ├── Dashboard                                                 │
│   │   │   │   ├── My Letters                                                │
│   │   │   │   ├── Subscription                                              │
│   │   │   │   └── Settings                                                  │
│   │   │   │                                                                 │
│   │   │   ├── [Employee Role]                                               │
│   │   │   │   ├── My Coupons                                                │
│   │   │   │   ├── Commissions                                               │
│   │   │   │   ├── Payouts                                                   │
│   │   │   │   └── Referrals                                                 │
│   │   │   │                                                                 │
│   │   │   └── [Admin Role]                                                  │
│   │   │       └── Admin Portal (external link)                              │
│   │   │                                                                     │
│   │   └── User Profile Section                                              │
│   │       ├── Avatar                                                        │
│   │       ├── Name & Email                                                  │
│   │       └── Logout Button                                                 │
│   │                                                                         │
│   ├── Header                                                                │
│   │   ├── Breadcrumbs                                                       │
│   │   ├── Search (optional)                                                 │
│   │   └── Notifications (optional)                                          │
│   │                                                                         │
│   └── Main Content Area                                                     │
│       └── {children} - Page content                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Route Specifications

### Letter Generation API

| Endpoint | Method | Auth | Rate Limit | Request Body | Response |
|----------|--------|------|------------|--------------|----------|
| `/api/generate-letter` | POST | Required (subscriber) | 5/hour | `{ letterType: string, intakeData: object }` | `{ success: boolean, letterId: string, status: string, aiDraft: string, isFreeTrial: boolean }` |

### Letter Management APIs

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/letters/[id]/submit` | POST | User | Submit letter for review |
| `/api/letters/[id]/start-review` | POST | Admin | Begin attorney review |
| `/api/letters/[id]/approve` | POST | Admin | Approve with final content |
| `/api/letters/[id]/reject` | POST | Admin | Reject with reason |
| `/api/letters/[id]/improve` | POST | Admin | Generate improved AI draft |
| `/api/letters/[id]/complete` | POST | Admin | Mark as completed |
| `/api/letters/[id]/pdf` | GET | User/Admin | Generate PDF |
| `/api/letters/[id]/delete` | DELETE | User | Delete letter |
| `/api/letters/[id]/audit` | GET | Admin | Get audit trail |

### Subscription APIs

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/create-checkout` | POST | User | Create Stripe checkout session |
| `/api/verify-payment` | POST | User | Verify payment completion |
| `/api/subscriptions/check-allowance` | GET | User | Check remaining letter credits |
| `/api/subscriptions/billing-history` | GET | User | Get payment history |
| `/api/subscriptions/activate` | POST | System | Activate subscription (webhook) |
| `/api/stripe/webhook` | POST | Stripe | Handle Stripe webhooks |

### Employee APIs

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/employee/referral-link` | GET | Employee | Get referral link |
| `/api/employee/payouts` | POST | Employee | Request payout |

### Admin APIs

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/api/admin/analytics` | GET | Admin | Get platform analytics |
| `/api/admin/letters` | GET | Admin | List all letters |
| `/api/admin/coupons` | GET/POST | Admin | Manage coupons |
| `/api/admin/email-queue` | GET | Admin | View email queue |

---

## Database Schema

### Tables Overview

```sql
-- Core Tables
profiles           -- User profiles (extends auth.users)
letters            -- Letter documents
subscriptions      -- User subscriptions
employee_coupons   -- Employee referral coupons
commissions        -- Employee commissions
coupon_usage       -- Coupon usage tracking

-- Audit & Security Tables
letter_audit_trail -- Letter change history
security_audit_log -- Security events
security_config    -- Security configuration

-- Fraud Detection Tables
fraud_detection_rules
fraud_alerts
ip_reputation
```

### Key Relationships

```
profiles (1) ──────────────< (N) letters
profiles (1) ──────────────< (N) subscriptions
profiles (1) ──────────────< (N) employee_coupons (where role = 'employee')
profiles (1) ──────────────< (N) commissions (as employee_id)
subscriptions (1) ─────────< (N) commissions
employee_coupons (1) ──────< (N) coupon_usage
letters (1) ───────────────< (N) letter_audit_trail
```

### Row Level Security (RLS) Policies

```sql
-- Profiles: Users can only read/update their own profile
-- Letters: Users can only access their own letters
-- Subscriptions: Users can only access their own subscriptions
-- Admin: Admins can access all records
-- Employee: Employees can access their own coupons and commissions
```

---

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=          # Public Supabase project URL (safe for client)
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # Public anonymous key (safe for client)
SUPABASE_SERVICE_ROLE_KEY=         # ⚠️ SERVER-ONLY: Full database access - never expose to client

# Stripe
STRIPE_SECRET_KEY=                 # ⚠️ SERVER-ONLY: Stripe secret key
STRIPE_WEBHOOK_SECRET=             # ⚠️ SERVER-ONLY: Webhook signature verification
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY= # Public Stripe key (safe for client)

# OpenAI
OPENAI_API_KEY=                    # ⚠️ SERVER-ONLY: OpenAI API key

# Email (Brevo SMTP)
EMAIL_FROM=                        # Default sender email address
EMAIL_FROM_NAME=                   # Default sender display name
EMAIL_PROVIDER=smtp                # Email provider selection

# Redis (Upstash)
KV_REST_API_URL=                   # ⚠️ SERVER-ONLY: Upstash REST API URL
KV_REST_API_TOKEN=                 # ⚠️ SERVER-ONLY: Upstash authentication token

# Application
NEXT_PUBLIC_SITE_URL=              # Public site URL for links in emails
ADMIN_SECRET_KEY=                  # ⚠️ SERVER-ONLY: Admin authentication secret
CSRF_SECRET=                       # ⚠️ SERVER-ONLY: CSRF token signing secret
```

---

## Security Checklist

> Note: All items marked [x] are currently implemented in the codebase.

- [x] Rate limiting on all API routes
- [x] CSRF protection for admin actions
- [x] Input sanitization and validation
- [x] SQL injection prevention (parameterized queries via Supabase)
- [x] XSS prevention (input sanitization)
- [x] Row Level Security in database
- [x] Authentication required for all dashboard routes
- [x] Role-based access control
- [x] Secure session management
- [x] Audit trail for sensitive actions
- [x] Circuit breaker for AI service
- [x] Atomic credit deduction to prevent race conditions

---

## Future Considerations

1. **Horizontal Scaling**: Consider Redis cluster for rate limiting
2. **AI Fallback**: Implement Google Generative AI as backup
3. **PDF Storage**: Consider cloud storage for generated PDFs
4. **Real-time Updates**: WebSocket for letter status updates
5. **Mobile App**: React Native with shared business logic
6. **Internationalization**: i18n support for multiple languages
7. **Analytics**: Enhanced analytics dashboard
8. **Testing**: Automated E2E testing with Playwright
