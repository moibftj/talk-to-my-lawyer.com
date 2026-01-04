# CLAUDE.md - AI Assistant Developer Guide

**Talk-To-My-Lawyer** - Complete Technical Reference for AI Assistants

Last Updated: 2026-01-04
Version: 1.0.0
Status: Production (Live)

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture & Stack](#architecture--stack)
3. [API Endpoints Reference](#api-endpoints-reference)
4. [Database Schema](#database-schema)
5. [Code Conventions](#code-conventions)
6. [Core Workflows](#core-workflows)
7. [Development Guidelines](#development-guidelines)
8. [Security Practices](#security-practices)
9. [Configuration](#configuration)
10. [Quick Reference](#quick-reference)

---

## Project Overview

### What is Talk-To-My-Lawyer?

AI-powered legal letter generation platform with mandatory attorney review. Users can generate professional legal letters (demand letters, cease & desist, etc.) using OpenAI GPT-4, which are then reviewed and approved by licensed attorneys before delivery.

### Live Production Details

- **Live Site**: https://www.talk-to-my-lawyer.com
- **Admin Portal**: https://www.talk-to-my-lawyer.com/secure-admin-gateway
- **System Health**: https://www.talk-to-my-lawyer.com/api/health
- **Status**: Production with real payment processing (Stripe Live Mode)

### Payment Plans

- **Single Letter**: $299 (one-time payment, 1 letter)
- **Monthly Plan**: $299/month (4 letters per month)
- **Yearly Plan**: $599/year (52 letters per year)
- **Free Trial**: First letter free for new users (no subscription required)

### Key Features

- Real Stripe payment processing
- AI letter generation via OpenAI GPT-4o-mini
- Multi-admin attorney review workflow
- Subscription management with credit system
- Employee referral program (5% commission)
- Professional email system via Resend
- Rate limiting via Upstash Redis
- GDPR compliance (data export/deletion)
- Comprehensive admin analytics

---

## Architecture & Stack

### Technology Stack

```
Frontend:
- Next.js 16.1.1 (App Router)
- React 19.2.3
- TypeScript 5 (strict mode)
- Tailwind CSS 4.1.9
- Radix UI components
- Motion (Framer Motion alternative) 12.23.24

Backend:
- Next.js API Routes
- Node.js (Standalone output for containers)
- Supabase (PostgreSQL + Auth)

AI & Integrations:
- OpenAI API (@ai-sdk/openai 3.0.1) - GPT-4o-mini
- Stripe 20.1.0 (payment processing)
- Resend 6.6.0 (email delivery)
- Upstash Redis (rate limiting)

Deployment:
- Vercel (serverless + cron jobs)
- Docker support (Standalone output)
- OpenTelemetry (distributed tracing)
```

### Project Structure

```
talk-to-my-lawyer/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes (42 endpoints)
│   │   ├── admin/                # Admin management endpoints
│   │   ├── admin-auth/           # Admin authentication
│   │   ├── auth/                 # User authentication
│   │   ├── letters/              # Letter operations
│   │   ├── subscriptions/        # Subscription management
│   │   ├── employee/             # Employee referral system
│   │   ├── gdpr/                 # GDPR compliance
│   │   ├── stripe/               # Stripe webhook
│   │   ├── cron/                 # Background jobs
│   │   └── health/               # Health checks
│   ├── auth/                     # Auth pages (login, signup, reset)
│   ├── dashboard/                # User dashboard
│   ├── secure-admin-gateway/     # Admin portal (super_admin)
│   └── attorney-portal/          # Attorney review portal
├── components/                   # React components
│   ├── admin/                    # Admin-specific components
│   └── ui/                       # Radix UI-based components
├── lib/                          # Utility libraries
│   ├── auth/                     # Authentication utilities
│   ├── email/                    # Email service & templates
│   ├── security/                 # CSRF, input validation
│   ├── ai/                       # OpenAI integration
│   ├── stripe/                   # Stripe client
│   ├── supabase/                 # Supabase clients
│   ├── monitoring/               # OpenTelemetry tracing
│   └── admin/                    # Admin operations
├── supabase/                     # Database migrations
│   └── migrations/               # 18+ migration files
├── scripts/                      # Utility scripts
│   ├── validate-env.js
│   ├── health-check.js
│   └── create-admin-user.ts
└── docs/                         # Documentation
```

### Authentication Architecture

**User Authentication**:
- Supabase Auth with JWT tokens
- Session stored in cookies (httpOnly)
- Password reset via email tokens
- Role-based access: `subscriber`, `employee`, `admin`

**Admin Authentication**:
- Individual admin credentials (NO shared secrets)
- Sub-roles: `super_admin` (full access), `attorney_admin` (review only)
- Separate session management
- Audit logging of all admin actions
- CSRF protection for sensitive operations

### Database Architecture

- **Provider**: Supabase (PostgreSQL 15+)
- **Security**: Row-Level Security (RLS) policies on all tables
- **Authentication**: Integrated with Supabase Auth
- **Service Role**: Used for webhooks and system operations (bypasses RLS safely)

---

## API Endpoints Reference

### Complete Endpoint List (42 Total)

#### Authentication Endpoints

**Admin Authentication**

```typescript
POST /api/admin-auth/login
Purpose: Admin login with role-based routing
Rate Limit: 10 requests per 15 minutes
Auth: Email + password (individual credentials)
Input:
  {
    email: string,
    password: string
  }
Response:
  {
    success: boolean,
    message: string,
    redirectUrl: string,  // /secure-admin-gateway or /attorney-portal
    subRole: 'super_admin' | 'attorney_admin'
  }
Features:
  - Individual admin accounts (no shared secret)
  - Sub-role routing based on admin type
  - Audit logging of login attempts
  - Session creation with 30-min timeout

POST /api/admin-auth/logout
Purpose: Destroy admin session
Auth: Admin session cookie
Response: { success: boolean, message: string }
```

**User Authentication**

```typescript
POST /api/auth/reset-password
Purpose: Send password reset email
Auth: Public (email validation only)
Input: { email: string }
Process: Supabase auth.resetPasswordForEmail()

POST /api/auth/update-password
Purpose: Update user password after reset
Auth: Authenticated + reset token
Input:
  {
    password: string,
    confirmPassword: string
  }
Validation: Passwords must match
```

#### Payment & Subscription Endpoints

**Checkout & Payment**

```typescript
POST /api/create-checkout
Purpose: Create Stripe checkout session or free subscription
Rate Limit: 3 requests per 1 hour
Auth: Authenticated user
Input:
  {
    planType: 'one_time' | 'standard_4_month' | 'premium_8_month',
    couponCode?: string
  }
Features:
  - Coupon validation with fraud detection
  - TALK3 special handling (100% discount)
  - Test mode support (ENABLE_TEST_MODE=true)
  - Employee referral commission tracking (5%)
  - Coupon usage logging
Response:
  // For test mode or free coupons:
  {
    success: true,
    testMode?: boolean,
    talk3Coupon?: boolean,
    subscriptionId: string,
    letters: number,
    redirectUrl: string
  }
  // For Stripe:
  {
    sessionId: string,
    url: string
  }

POST /api/verify-payment
Purpose: Verify Stripe payment and create subscription
Rate Limit: 3 requests per 1 hour
Auth: Authenticated user
Input: { sessionId: string }
Validation:
  - Session belongs to user
  - Not already processed
Response: { success: boolean, subscriptionId: string, message: string }

POST /api/stripe/webhook
Purpose: Handle Stripe events
Auth: Webhook signature verification (STRIPE_WEBHOOK_SECRET)
Events Handled:
  - checkout.session.completed: Update subscription, track coupons, create commissions
Features:
  - Uses service role (bypasses RLS)
  - Idempotent processing
  - Commission calculation (5% of final amount)
```

**Subscription Management**

```typescript
GET /api/subscriptions/check-allowance
Purpose: Check remaining letter credits
Auth: Authenticated user
Response:
  {
    hasAllowance: boolean,
    remaining: number,
    plan: string
  }

POST /api/subscriptions/activate
Purpose: Activate subscription (admin)
Auth: Admin
Input: { subscriptionId: string }

GET /api/subscriptions/billing-history
Purpose: Get user's billing history
Auth: Authenticated user
Response: Array of billing records

POST /api/subscriptions/reset-monthly
Purpose: Reset monthly allowances (cron job)
Auth: CRON_SECRET verification
Function: Calls reset_monthly_allowances() database function
```

#### Letter Generation & Management

**Generate & Draft**

```typescript
POST /api/generate-letter
Purpose: AI-powered letter generation
Rate Limit: 5 requests per 1 hour
Auth: Authenticated user (subscriber role)
Input:
  {
    letterType: string,  // From LETTER_TYPES constant
    intakeData: {
      senderName: string,
      senderAddress: string,
      senderEmail?: string,
      senderPhone?: string,
      recipientName: string,
      recipientAddress: string,
      recipientEmail?: string,
      recipientPhone?: string,
      issueDescription: string,  // max 2000 chars
      desiredOutcome: string,
      additionalDetails?: string,
      amountDemanded?: string,
      deadlineDate?: string,
      incidentDate?: string,
      attachments?: string[]
    }
  }
Features:
  - Free trial: First letter is free
  - Paid users: Deducts from credits
  - Super users: Unlimited letters
  - OpenAI retry logic (3 attempts, exponential backoff)
  - Comprehensive input validation & sanitization
  - Injection pattern detection (XSS, SQL, prompt injection)
  - Audit trail logging
  - Admin email notifications
Validation:
  - Letter allowance check
  - Input sanitization
  - Schema validation
Response:
  {
    letterId: string,
    status: string,
    aiDraft: string,
    aiModel: string  // "gpt-4o-mini"
  }

POST /api/letters/drafts
Purpose: Save or update draft (auto-save)
Auth: Authenticated user
Input:
  {
    letterId?: string,  // If updating existing
    title: string,
    content: string,
    letterType: string,
    recipientInfo: object,
    senderInfo: object,
    metadata?: object
  }

GET /api/letters/drafts
Purpose: List user's draft letters
Auth: Authenticated user
Response: Array of last 10 drafts (ordered by updated_at DESC)
```

**Letter Submission & Status**

```typescript
POST /api/letters/[id]/submit
Purpose: Submit letter for attorney review
Rate Limit: 100 requests per 1 minute
Auth: Authenticated user (must own letter)
Features:
  - Status transition validation (draft/generating/failed → pending_review)
  - Final allowance check before submission
  - Audit trail logging
Response: { success: boolean }

POST /api/letters/[id]/start-review
Purpose: Mark letter as under review
Auth: Attorney admin
Response: Updates status to 'under_review'

POST /api/letters/[id]/approve
Purpose: Approve letter (attorney)
Auth: Attorney admin
CSRF: Required token
Features:
  - Sets status to 'approved'
  - Stores final_content
  - Records approved_at timestamp and reviewed_by admin ID
Response: { success: boolean }

POST /api/letters/[id]/reject
Purpose: Reject letter with reason
Auth: Attorney admin
Input:
  {
    rejectionReason: string,
    notes?: string
  }
Response: Updates status to 'rejected', stores rejection_reason

POST /api/letters/[id]/resubmit
Purpose: User resubmits after rejection
Auth: Authenticated user (letter owner)
Features: Transitions from 'rejected' to 'pending_review'

POST /api/letters/[id]/complete
Purpose: Mark letter as completed
Auth: User or admin
Response: Sets status to 'completed'

POST /api/letters/[id]/delete
Purpose: Delete a letter
Auth: User (owns letter) or admin
Validation: Can only delete draft letters

POST /api/letters/[id]/improve
Purpose: Request AI improvement
Auth: Authenticated user
Features: Calls OpenAI with current letter context

GET /api/letters/[id]/pdf
Purpose: Generate and download PDF
Auth: Authenticated user
Features: Uses jsPDF to generate PDF with letter content

POST /api/letters/[id]/send-email
Purpose: Email letter to recipient
Auth: Authenticated user
Input: { recipientEmail: string }
Features: Queues email in email_queue table

GET /api/letters/[id]/audit
Purpose: Get audit trail for letter
Auth: User (letter owner) or admin
Response: Array of audit entries with timestamps, actions, status changes
```

#### Admin Endpoints

**Admin Letter Management**

```typescript
GET /api/admin/letters
Purpose: Get paginated list of all letters
Rate Limit: 30 requests per 1 minute
Auth: Attorney admin
Query Params:
  - limit: number (default: 50)
  - offset: number (default: 0)
  - status: string (optional filter)
Response:
  {
    success: true,
    letters: [
      {
        id: string,
        title: string,
        letter_type: string,
        status: string,
        created_at: string,
        approved_at: string | null,
        user: {
          full_name: string,
          email: string
        }
      }
    ],
    pagination: {
      total: number,
      limit: number,
      offset: number,
      hasMore: boolean
    }
  }

POST /api/admin/letters/[id]/update
Purpose: Update letter details (admin edit)
Auth: Admin
Input:
  {
    title?: string,
    content?: string,
    status?: string,
    notes?: string
  }

POST /api/admin/letters/batch
Purpose: Bulk update letters
Auth: Admin
Input:
  {
    letterIds: string[],
    action: string,
    updates: object
  }

GET /api/admin/csrf
Purpose: Get CSRF token for admin actions
Auth: Admin session
Response:
  {
    token: string,
    signedToken: string,
    expiresAt: string
  }

GET /api/admin/analytics
Purpose: Get application analytics
Auth: Admin
Response:
  {
    totalLetters: number,
    totalUsers: number,
    totalRevenue: number,
    lettersThisMonth: number,
    newUsersThisMonth: number,
    topLetterTypes: Array<{type: string, count: number}>,
    conversionRate: number
  }

GET /api/admin/email-queue
Purpose: View email queue status
Auth: Admin
Response:
  {
    pending: number,
    failed: number,
    total: number,
    nextRetryAt: string | null
  }

GET /api/admin/coupons
Purpose: List all coupons with usage stats
Auth: Admin
Response: Array of employee coupons

POST /api/admin/coupons/create
Purpose: Create custom coupon
Auth: Admin
Input:
  {
    code: string,
    discountPercent: number,  // 0-100
    employeeId?: string,
    isActive: boolean
  }
```

#### Employee Endpoints

```typescript
GET /api/employee/referral-link
Purpose: Get employee referral link and coupon info
Auth: Authenticated employee
Features:
  - Auto-generated coupon code: EMP-{MD5_HASH}
  - Share links for Twitter, LinkedIn, WhatsApp, Email
  - Usage count tracking
Response:
  {
    success: true,
    data: {
      hasCoupon: boolean,
      coupon: {
        code: string,
        discountPercent: number,
        usageCount: number,
        isActive: boolean
      },
      links: {
        referral: string,
        signup: string,
        share: {
          twitter: string,
          linkedin: string,
          whatsapp: string,
          email: string
        }
      }
    }
  }

GET /api/employee/payouts
Purpose: Get commission history and payout info
Auth: Authenticated employee
Response: Commission summary with pending/paid amounts

POST /api/employee/payouts
Purpose: Request commission payout
Auth: Authenticated employee
Features: Creates payout request for admin approval
```

#### GDPR Compliance Endpoints

```typescript
POST /api/gdpr/accept-privacy-policy
Purpose: Record privacy policy acceptance
Auth: Authenticated user
Features: Stores acceptance timestamp for compliance

POST /api/gdpr/delete-account
Purpose: Request account deletion (GDPR Article 17)
Auth: Authenticated user
Input:
  {
    reason?: string,
    confirmEmail: string  // Must match user's email
  }
Features:
  - Email confirmation required
  - Creates data_deletion_requests record
  - Access logging for compliance
  - Admin approval required before deletion
Response:
  {
    success: boolean,
    requestId: string,
    status: 'pending',
    message: string
  }

GET /api/gdpr/delete-account
Purpose: Check deletion request status
Auth: Authenticated user
Response: Array of deletion requests for user

DELETE /api/gdpr/delete-account
Purpose: Admin executes account deletion
Auth: Admin only
Input: { requestId: string, userId: string }
Process (in order):
  1. Delete letters
  2. Delete subscriptions
  3. Delete commissions
  4. Delete employee_coupons
  5. Delete profile
  6. Delete auth user (via service role)

GET /api/gdpr/export-data
Purpose: Export user's data (GDPR Article 20)
Auth: Authenticated user
Response: ZIP file with JSON export of all user data
```

#### Cron & Background Jobs

```typescript
POST /api/cron/process-email-queue
Purpose: Process pending emails in queue
Auth: CRON_SECRET environment variable
Frequency: Recommended every 5-15 minutes
Features:
  - Processes up to 100 pending emails per run
  - Retry logic (max 3 attempts)
  - Exponential backoff for failures
Response:
  {
    success: true,
    processed: number,
    failed: number,
    remaining: number,
    timestamp: string
  }

GET /api/cron/process-email-queue
Purpose: Health check for cron job
Auth: CRON_SECRET
Response: { status: string, endpoint: string, method: string, timestamp: string }
```

#### Health & Monitoring

```typescript
GET /api/health
Purpose: Basic application health check
Auth: Public
Checks: Database, Auth, Stripe, OpenAI, Redis
Response:
  {
    status: 'healthy' | 'degraded' | 'unhealthy',
    timestamp: string,
    version: string,
    uptime: number,
    services: {
      database: { status: string, latency?: number, error?: string },
      auth: { status: string, latency?: number, error?: string },
      stripe: { status: string },
      openai: { status: string },
      redis: { status: string }
    },
    environment: string
  }

GET /api/health/detailed
Purpose: Comprehensive health metrics
Auth: Public
Response: Extended health check with performance metrics
```

#### Other Endpoints

```typescript
POST /api/create-profile
Purpose: Create user profile after signup
Auth: Authenticated user
Input:
  {
    fullName: string,
    phone?: string,
    companyName?: string,
    role: 'subscriber' | 'employee'
  }
Features: Automatically called after signup
```

---

## Database Schema

### Core Tables

#### profiles

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role user_role NOT NULL,  -- 'subscriber', 'employee', 'admin'
  phone TEXT,
  company_name TEXT,
  is_super_user BOOLEAN DEFAULT FALSE,
  stripe_customer_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_profiles_role ON profiles(role);
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_stripe_customer ON profiles(stripe_customer_id);
```

**RLS Policies**:
- Users can view/update own profile
- Admins can view/update all profiles

#### subscriptions

```sql
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status subscription_status NOT NULL,  -- 'active', 'canceled', 'past_due', 'trialing'
  plan TEXT DEFAULT 'single_letter',
  plan_type TEXT,
  price NUMERIC(10,2),
  discount NUMERIC(10,2),
  coupon_code TEXT,
  remaining_letters INT DEFAULT 0,
  credits_remaining INT DEFAULT 0,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  last_reset_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_plan_type ON subscriptions(plan_type);
```

**RLS Policies**:
- Users can view own subscriptions
- Admins can view/manage all subscriptions

#### letters

```sql
CREATE TABLE letters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status letter_status NOT NULL,  -- 'draft', 'generating', 'pending_review', 'under_review', 'approved', 'rejected', 'completed', 'failed'
  letter_type TEXT,
  intake_data JSONB DEFAULT '{}',
  ai_draft_content TEXT,
  final_content TEXT,
  pdf_url TEXT,
  is_attorney_reviewed BOOLEAN DEFAULT FALSE,
  reviewed_by UUID REFERENCES profiles(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  rejection_reason TEXT,
  approved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_letters_user_id ON letters(user_id);
CREATE INDEX idx_letters_status ON letters(status);
CREATE INDEX idx_letters_reviewed_at ON letters(reviewed_at);
```

**RLS Policies**:
- Subscribers can view/create/update own letters
- Employees are BLOCKED from accessing letters (security)
- Admins have full access

#### employee_coupons

```sql
CREATE TABLE employee_coupons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,  -- Auto-generated as EMP-{HASH}
  discount_percent INT CHECK (discount_percent >= 0 AND discount_percent <= 100) DEFAULT 20,
  is_active BOOLEAN DEFAULT TRUE,
  usage_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_employee_coupons_code ON employee_coupons(code);
CREATE INDEX idx_employee_coupons_employee ON employee_coupons(employee_id);
```

**RLS Policies**:
- Employees can view own coupons
- Public (authenticated) can validate active coupons
- Admins can manage all coupons

#### commissions

```sql
CREATE TABLE commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  commission_rate NUMERIC(5,4) DEFAULT 0.05,  -- 5%
  subscription_amount NUMERIC(10,2),
  commission_amount NUMERIC(10,2),
  status commission_status NOT NULL,  -- 'pending', 'paid'
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_commissions_employee ON commissions(employee_id);
CREATE INDEX idx_commissions_status ON commissions(status);
```

**RLS Policies**:
- Employees can view own commissions
- Admins can view/create/update all commissions

#### letter_audit_trail

```sql
CREATE TABLE letter_audit_trail (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  letter_id UUID NOT NULL REFERENCES letters(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  performed_by UUID REFERENCES profiles(id),
  old_status TEXT,
  new_status TEXT,
  notes TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_audit_letter ON letter_audit_trail(letter_id);
CREATE INDEX idx_audit_performed_by ON letter_audit_trail(performed_by);
CREATE INDEX idx_audit_created_at ON letter_audit_trail(created_at DESC);
CREATE INDEX idx_audit_action ON letter_audit_trail(action);
```

**RLS Policies**:
- Admins can view all audit trails
- Users can view audit trails for own letters
- System can insert

#### email_queue

```sql
CREATE TABLE email_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  to TEXT NOT NULL,
  subject TEXT NOT NULL,
  html TEXT,
  text TEXT,
  status TEXT DEFAULT 'pending',  -- 'pending', 'sent', 'failed'
  attempts INT DEFAULT 0,
  max_retries INT DEFAULT 3,
  next_retry_at TIMESTAMPTZ,
  error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_email_queue_status ON email_queue(status);
CREATE INDEX idx_email_queue_next_retry ON email_queue(next_retry_at) WHERE status = 'pending';
CREATE INDEX idx_email_queue_created_at ON email_queue(created_at);
```

**RLS Policies**: Service role only (system access)

#### email_delivery_log

```sql
CREATE TABLE email_delivery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_queue_id UUID REFERENCES email_queue(id) ON DELETE SET NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  template_type TEXT,
  provider TEXT,
  status TEXT NOT NULL,  -- 'sent', 'failed', 'bounced'
  error_message TEXT,
  response_time_ms INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_email_delivery_log_recipient ON email_delivery_log(recipient_email);
CREATE INDEX idx_email_delivery_log_status ON email_delivery_log(status);
CREATE INDEX idx_email_delivery_log_created_at ON email_delivery_log(created_at);
CREATE INDEX idx_email_delivery_log_template ON email_delivery_log(template_type);
```

#### admin_audit_log

```sql
CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  changes JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_admin_audit_log_admin_id ON admin_audit_log(admin_id);
CREATE INDEX idx_admin_audit_log_action ON admin_audit_log(action);
CREATE INDEX idx_admin_audit_log_created_at ON admin_audit_log(created_at);
```

#### data_deletion_requests

```sql
CREATE TABLE data_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL,  -- 'pending', 'approved', 'completed', 'rejected'
  reason TEXT,
  ip_address TEXT,
  user_agent TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES profiles(id),
  completed_at TIMESTAMPTZ
);
```

#### coupon_usage

```sql
CREATE TABLE coupon_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  coupon_code TEXT NOT NULL,
  employee_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  discount_percent INT,
  amount_before NUMERIC(10,2),
  amount_after NUMERIC(10,2),
  ip_address TEXT,
  user_agent TEXT,
  fraud_risk_score INT,
  fraud_detection_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Database Functions

**Key Database Functions**:

```sql
-- User role for RLS policies
get_user_role() RETURNS user_role

-- Auto-create profile on auth signup
handle_new_user() RETURNS TRIGGER

-- Auto-generate employee coupon
create_employee_coupon() RETURNS TRIGGER

-- Validate coupon code
validate_coupon(coupon_code TEXT) RETURNS TABLE(...)

-- Increment coupon usage
increment_usage(coupon_id UUID) RETURNS VOID

-- Get employee coupon details
get_employee_coupon(employee_id UUID) RETURNS TABLE(...)

-- Get commission summary
get_commission_summary(employee_id UUID) RETURNS TABLE(...)

-- Check letter allowance
check_letter_allowance(user_id UUID) RETURNS TABLE(...)

-- Deduct letter allowance
deduct_letter_allowance(user_id UUID) RETURNS BOOLEAN

-- Add letter allowances
add_letter_allowances(subscription_id UUID, plan TEXT) RETURNS VOID

-- Reset monthly allowances (cron)
reset_monthly_allowances() RETURNS TABLE(...)

-- Count user letters (for free trial)
count_user_letters(user_id UUID) RETURNS INT

-- Log letter audit
log_letter_audit(...) RETURNS VOID

-- Cleanup old email queue
cleanup_old_email_queue() RETURNS INT

-- Cleanup old audit logs
cleanup_old_audit_logs() RETURNS INT
```

---

## Code Conventions

### API Response Standards

**Success Response**:
```typescript
{
  success: true,
  data: T,
  message?: string
}
```

**Error Response**:
```typescript
{
  error: string,
  message?: string,
  details?: object
}
```

**Validation Error**:
```typescript
{
  valid: false,
  errors: ValidationError[],
  data?: object
}
```

### Error Handling Pattern

**Use centralized error handlers** (`lib/api/api-error-handler.ts`):

```typescript
import { successResponse, errorResponses } from '@/lib/api/api-error-handler'

// Success
return successResponse({ letterId: 'abc123' }, 'Letter created successfully')

// Error responses
return errorResponses.unauthorized('Please log in')
return errorResponses.forbidden('Admin access required')
return errorResponses.validation('Invalid input', { field: 'email' })
return errorResponses.notFound('Letter')
return errorResponses.serverError('Failed to process request')
```

### Rate Limiting Pattern

**Use pre-configured limiters** (`lib/rate-limit-redis.ts`):

```typescript
import { safeApplyRateLimit, letterGenerationRateLimit } from '@/lib/rate-limit-redis'

// Apply rate limit
const rateLimitResponse = await safeApplyRateLimit(
  request,
  letterGenerationRateLimit,
  5,
  '1 h'
)
if (rateLimitResponse) return rateLimitResponse
```

**Available Rate Limiters**:
- `authRateLimit`: 5 requests per 15 minutes (login, signup)
- `apiRateLimit`: 100 requests per 1 minute (general API)
- `adminRateLimit`: 10 requests per 15 minutes (admin actions)
- `letterGenerationRateLimit`: 5 requests per 1 hour (letter generation)
- `subscriptionRateLimit`: 3 requests per 1 hour (subscription operations)

### Authentication Pattern

**User Authentication**:

```typescript
import { authenticateUser } from '@/lib/auth/authenticate-user'

const authResult = await authenticateUser()
if (!authResult.authenticated) {
  return authResult.errorResponse
}
const user = authResult.user
```

**Admin Authentication**:

```typescript
import { verifyAdminSession } from '@/lib/auth/admin-session'

const session = await verifyAdminSession()
if (!session) {
  return errorResponses.unauthorized('Admin access required')
}
const { userId, email, subRole } = session
```

**Role-Based Access**:

```typescript
const { data: profile } = await supabase
  .from('profiles')
  .select('role')
  .eq('id', user.id)
  .single()

if (profile?.role !== 'admin') {
  return errorResponses.forbidden('Admin access required')
}
```

### CSRF Protection Pattern

**For sensitive admin actions**:

```typescript
// Step 1: Client fetches CSRF token
GET /api/admin/csrf
Response: { token, signedToken, expiresAt }

// Step 2: Client includes token in request
POST /api/letters/[id]/approve
Headers: { 'x-csrf-token': signedToken }

// Step 3: Server verifies token
import { verifySignedCSRFToken } from '@/lib/security/csrf'

const csrfToken = request.headers.get('x-csrf-token')
const verification = verifySignedCSRFToken(
  csrfToken,
  process.env.CSRF_SECRET || process.env.ADMIN_PORTAL_KEY
)

if (!verification.valid) {
  return errorResponses.forbidden(verification.error)
}
```

### Input Validation Pattern

**Use Zod schemas and sanitization**:

```typescript
import { validateLetterGenerationRequest } from '@/lib/validation/letter-schema'
import { sanitizeString } from '@/lib/security/input-sanitizer'

// Validate and sanitize
const validation = validateLetterGenerationRequest(letterType, intakeData)
if (!validation.valid) {
  return errorResponses.validation('Invalid input', validation.errors)
}

// Sanitize individual fields
const cleanDescription = sanitizeString(intakeData.issueDescription)
```

**Injection Pattern Detection**:

Automatically blocks:
- XSS: `<script>`, `javascript:`, event handlers
- SQL injection: `UNION`, `DROP`, `--`, `/* */`
- Path traversal: `../`
- Command injection: `;`, `|`, `$(`
- Prompt injection: "ignore previous instructions", `[SYSTEM]`

### TypeScript Patterns

**Route Parameter Handling**:

```typescript
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params
  // Use id
}
```

**Type Exports**:

```typescript
// Define types
export type AdminSubRole = 'super_admin' | 'attorney_admin'
export interface AdminSession {
  userId: string
  email: string
  subRole: AdminSubRole
}

// Import and use
import type { AdminSession } from '@/lib/types/admin'
```

### Logging Pattern

**Use structured, prefixed logging**:

```typescript
console.log('[GenerateLetter] Starting letter generation:', {
  userId: user.id,
  letterType,
  timestamp: new Date().toISOString()
})

console.error('[GenerateLetter] Error:', {
  error: error.message,
  userId: user.id,
  timestamp: new Date().toISOString()
})

console.warn('[GenerateLetter] Warning:', {
  issue: 'Low credits',
  remaining: credits,
  userId: user.id
})
```

**Standard Prefixes**:
- `[AdminAuth]`, `[Checkout]`, `[GenerateLetter]`
- `[StripeWebhook]`, `[EmailQueue]`, `[HealthCheck]`

### Database Transaction Pattern

**Use database functions for atomic operations**:

```typescript
// Instead of multiple queries:
// ❌ BAD
const { data: subscription } = await supabase.from('subscriptions').select('*')
if (subscription.remaining_letters > 0) {
  await supabase.from('subscriptions').update({ remaining_letters: subscription.remaining_letters - 1 })
}

// ✅ GOOD - Use database function
const { data, error } = await supabase.rpc('deduct_letter_allowance', {
  user_id: user.id
})
```

### OpenTelemetry Tracing Pattern

**Create spans for important operations**:

```typescript
import { createBusinessSpan, recordSpanEvent, addSpanAttributes } from '@/lib/monitoring/tracing'

const span = createBusinessSpan('generate_letter', {
  'http.method': 'POST',
  'http.route': '/api/generate-letter',
  'user.id': user.id
})

try {
  recordSpanEvent('letter_generation_started')

  // Do work...

  addSpanAttributes({
    'letter.id': letterId,
    'letter.type': letterType
  })

  span.setStatus({ code: 1 }) // Success
} catch (error) {
  span.setStatus({ code: 2, message: error.message })
  throw error
} finally {
  span.end()
}
```

---

## Core Workflows

### 1. Letter Generation Workflow

```
1. User Initiates Generation
   ↓
2. Backend Validation
   - Rate limit check (5/hour)
   - Authentication (subscriber role)
   - Eligibility check:
     * Free trial: First letter free (count_user_letters == 0)
     * Paid users: Check remaining credits
     * Super users: Unlimited
   - Input validation & sanitization
   ↓
3. Create Letter Record
   - Status: 'draft' or 'generating'
   - Store intake data
   ↓
4. AI Generation
   - Call OpenAI with structured prompt
   - Retry logic: 3 attempts with exponential backoff
   - Store ai_draft_content
   - Update status to 'pending_review'
   ↓
5. Deduct Allowance (if not free trial)
   - Call deduct_letter_allowance()
   - Decrement remaining_letters and credits_remaining
   - Refund if generation fails
   ↓
6. Audit & Notification
   - Log to letter_audit_trail
   - Email admins about new letter
   - Return letter ID and draft to client
```

### 2. Letter Review & Approval Workflow

```
1. Attorney Review (Admin Portal)
   - View pending letters: GET /api/admin/letters?status=pending_review
   - Open detail: /secure-admin-gateway/review/[id]
   ↓
2. Review Actions
   a) Approve:
      - POST /api/letters/[id]/approve
      - Set status='approved'
      - Store final_content, approved_at, reviewed_by

   b) Reject:
      - POST /api/letters/[id]/reject
      - Set status='rejected'
      - Store rejection_reason

   c) Request Improvement:
      - Call OpenAI with context
   ↓
3. User Follow-up
   - If approved: Download PDF or email
   - If rejected: Fix and resubmit via /api/letters/[id]/resubmit
   - Audit trail tracks all changes
```

### 3. Payment & Subscription Flow

```
1. Subscription Creation (Checkout)
   - User selects plan type
   - Optional: Apply coupon code
   - Coupon validation:
     * Database lookup
     * Fraud detection (IP, user-agent, patterns)
   - Calculate final price with discount
   ↓
2. Payment Processing
   - Test Mode: Create subscription directly (ENABLE_TEST_MODE=true)
   - Production: Create Stripe checkout session
   - Free/100% Discount: Create subscription immediately
   ↓
3. Stripe Webhook (checkout.session.completed)
   - Verify payment_status='paid'
   - Update subscription:
     * status → 'active'
     * credits_remaining, remaining_letters → based on plan
   - Track coupon usage in coupon_usage table
   - Create commission if employee referral:
     * commission_amount = final_price × 0.05
     * status='pending'
   ↓
4. Monthly Reset (Cron)
   - Call reset_monthly_allowances()
   - Reset credits for monthly/yearly plans
```

### 4. Employee Referral & Commission System

```
1. Employee Setup
   - Employee signs up with role='employee'
   - Trigger auto-creates coupon:
     * Code: EMP-{MD5_HASH(employee_id)}
     * discount_percent: 20
     * is_active: true
   ↓
2. Referral Sharing
   - Employee gets /api/employee/referral-link
   - Shares generated links with coupon embedded
   ↓
3. Commission Tracking
   - When referred user completes checkout:
     * coupon_usage record created
     * commissions record created:
       - commission_amount = final_price × 0.05
       - status='pending'
     * Coupon usage_count incremented
   ↓
4. Payout Process
   - Employee views /api/employee/payouts
   - Requests payout (pending admin approval)
   - Admin marks commissions as status='paid'
```

### 5. Email Queue & Background Processing

```
1. Email Queuing
   - Email inserted to email_queue table
   - Initial: status='pending', attempts=0
   ↓
2. Cron Processing (every 5-15 minutes)
   - POST /api/cron/process-email-queue with CRON_SECRET
   - Query pending emails where next_retry_at <= NOW()
   - Send via Resend (primary) or fallback
   - Record in email_delivery_log
   - Update email_queue status
   ↓
3. Retry Logic
   - Failed email: attempts++, status='pending'
   - If attempts < max_retries (3):
     * Set next_retry_at with exponential backoff
   - Else: status='failed'
   - Old records cleaned up (>30 days)
```

### 6. GDPR Compliance Workflow

```
1. User Data Export
   - GET /api/gdpr/export-data
   - Package all user data (letters, subscriptions, etc.)
   - Return ZIP file with JSON
   ↓
2. Account Deletion Request
   - POST /api/gdpr/delete-account
   - User confirms by typing email
   - Create data_deletion_requests (status='pending')
   - Log access for compliance
   ↓
3. Admin Approval
   - Admin reviews deletion request
   - Approves via DELETE /api/gdpr/delete-account
   ↓
4. Data Deletion (in order)
   - Delete letters
   - Delete subscriptions
   - Delete commissions
   - Delete employee_coupons
   - Delete profile
   - Delete auth user (service role)
   - Update request: status='completed'
```

---

## Development Guidelines

### Setting Up Development Environment

1. **Prerequisites**:
   - Node.js 18+
   - pnpm 10.27.0
   - Supabase account
   - Stripe account (test mode)
   - OpenAI API key

2. **Installation**:
   ```bash
   # Clone repository
   git clone https://github.com/moizjmj-pk/talk-to-my-lawyer.git
   cd talk-to-my-lawyer

   # Install dependencies
   pnpm install

   # Copy environment file
   cp .env.example .env.local

   # Fill in environment variables
   # See Configuration section

   # Run database migrations
   pnpm db:migrate

   # Start development server
   pnpm dev
   ```

3. **Create Admin User**:
   ```bash
   # Create initial admin
   pnpm tsx scripts/create-admin-user.ts

   # Update admin password
   pnpm tsx scripts/update-admin-password.ts
   ```

### Adding a New API Endpoint

1. **Create route file**: `app/api/your-endpoint/route.ts`

2. **Structure**:
   ```typescript
   import { NextRequest, NextResponse } from 'next/server'
   import { authenticateUser } from '@/lib/auth/authenticate-user'
   import { successResponse, errorResponses } from '@/lib/api/api-error-handler'
   import { safeApplyRateLimit, apiRateLimit } from '@/lib/rate-limit-redis'

   export async function POST(request: NextRequest) {
     try {
       // Apply rate limiting
       const rateLimitResponse = await safeApplyRateLimit(
         request,
         apiRateLimit,
         100,
         '1 m'
       )
       if (rateLimitResponse) return rateLimitResponse

       // Authenticate user
       const authResult = await authenticateUser()
       if (!authResult.authenticated) {
         return authResult.errorResponse
       }
       const user = authResult.user

       // Parse and validate input
       const body = await request.json()
       // ... validation ...

       // Business logic
       // ...

       // Return success
       return successResponse({ data: result })

     } catch (error) {
       console.error('[YourEndpoint] Error:', error)
       return errorResponses.serverError('Failed to process request')
     }
   }
   ```

3. **Add to this documentation** in the API Endpoints section

### Adding a New Database Table

1. **Create migration**: `supabase/migrations/XXX_your_migration.sql`

2. **Structure**:
   ```sql
   -- Create table
   CREATE TABLE your_table (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
     -- ... columns ...
     created_at TIMESTAMPTZ DEFAULT NOW(),
     updated_at TIMESTAMPTZ DEFAULT NOW()
   );

   -- Create indexes
   CREATE INDEX idx_your_table_user ON your_table(user_id);

   -- Enable RLS
   ALTER TABLE your_table ENABLE ROW LEVEL SECURITY;

   -- Create policies
   CREATE POLICY "Users can view own records"
     ON your_table FOR SELECT
     USING (auth.uid() = user_id);

   CREATE POLICY "Admins can view all"
     ON your_table FOR SELECT
     USING (get_user_role() = 'admin');
   ```

3. **Run migration**: `pnpm db:migrate`

4. **Update TypeScript types**: `lib/types/database.types.ts`

### Adding a New Email Template

1. **Create template**: `lib/email/templates.ts`

2. **Structure**:
   ```typescript
   export function yourEmailTemplate(data: YourEmailData): EmailTemplate {
     return {
       subject: `Your Subject ${data.name}`,
       html: `
         <html>
           <body>
             <h1>Your Email</h1>
             <p>${data.message}</p>
           </body>
         </html>
       `,
       text: `Your Email\n\n${data.message}`
     }
   }
   ```

3. **Send email**:
   ```typescript
   import { EmailService } from '@/lib/email/service'

   const emailService = new EmailService()
   await emailService.send({
     to: 'user@example.com',
     subject: 'Subject',
     html: '...',
     text: '...'
   })
   ```

### Testing Workflows

**Test Mode** (NEVER use in production):

```bash
# In .env.local ONLY
ENABLE_TEST_MODE=true
```

- Bypasses real Stripe payment processing
- Creates dummy subscriptions
- Useful for testing workflows without charges

**Manual Testing Checklist**:

1. User signup and login
2. Letter generation (free trial)
3. Subscription purchase (test mode)
4. Letter review and approval
5. Email delivery
6. Employee referral tracking
7. Commission calculation
8. GDPR data export/deletion

### Code Review Guidelines

**Before committing**:

1. Run linting: `pnpm lint`
2. Fix issues: `pnpm lint:fix`
3. Security audit: `pnpm audit:security`
4. Build check: `pnpm build`
5. Validate environment: `pnpm validate-env`

**Security Checklist**:

- [ ] Input validation and sanitization
- [ ] Authentication and authorization
- [ ] Rate limiting on sensitive endpoints
- [ ] CSRF protection for admin actions
- [ ] No hardcoded secrets
- [ ] Proper error handling (no sensitive data leaks)
- [ ] SQL injection prevention (use Supabase SDK)
- [ ] XSS prevention (sanitize user input)

**Performance Checklist**:

- [ ] Efficient database queries (avoid N+1)
- [ ] Proper indexing on queried columns
- [ ] Rate limiting to prevent abuse
- [ ] Caching where appropriate
- [ ] Optimized images and assets

---

## Security Practices

### Defense in Depth

**Network Level**:
- HTTPS/TLS enforced (HSTS header)
- Content Security Policy (CSP)
- CORS handling via Next.js config

**Application Level**:
- Authentication via Supabase Auth (JWT)
- Authorization via RLS policies
- CSRF tokens for admin actions
- Rate limiting via Upstash Redis

**Database Level**:
- Row-Level Security (RLS) on all tables
- Foreign key constraints
- Input validation via constraints
- Service role for system operations

**Data Level**:
- Password hashing (Supabase Auth)
- No sensitive data in logs
- Stripe PCI compliance
- Email encryption (TLS)

### Specific Attack Mitigations

**XSS Prevention**:
- Input sanitization removes `<script>`, `javascript:`, event handlers
- CSP header blocks inline scripts
- React escapes by default

**SQL Injection Prevention**:
- Parameterized queries via Supabase SDK
- Input validation blocks SQL keywords
- RLS policies scope access

**CSRF Prevention**:
- Double-submit token pattern
- Signed tokens with HMAC-SHA256
- 24-hour expiration
- Applied to all sensitive admin actions

**Account Takeover Prevention**:
- Rate limiting on login (5 per 15 min)
- Password reset via email token
- Admin session timeout (30 min)
- Audit logging

**Payment Security**:
- Stripe webhook signature verification
- Session ID validation
- Fraud detection on coupons
- Idempotent operations

**Data Privacy**:
- GDPR endpoints (export/deletion)
- Access logging
- Audit trails
- Email opt-out

### Security Headers

**Configured in `next.config.mjs`**:

```javascript
{
  'Content-Security-Policy': "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com; ...",
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()'
}
```

---

## Configuration

### Environment Variables

**Critical (all environments)**:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # Production only

# OpenAI
OPENAI_API_KEY=sk-...

# Stripe (use test keys for development)
STRIPE_SECRET_KEY=sk_test_... or sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_test_... or pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Site URL
NEXT_PUBLIC_SITE_URL=https://www.talk-to-my-lawyer.com

# Admin Portal
ADMIN_PORTAL_KEY=your-secret-key-min-32-chars
ADMIN_EMAIL=admin@example.com

# Cron Jobs
CRON_SECRET=your-cron-secret
```

**Email Provider (at least one required)**:

```bash
# Resend (recommended)
RESEND_API_KEY=re_...
EMAIL_FROM=noreply@talk-to-my-lawyer.com

# SendGrid (fallback)
SENDGRID_API_KEY=SG....

# Brevo (fallback)
BREVO_API_KEY=...
```

**Rate Limiting (recommended)**:

```bash
# Upstash Redis
KV_REST_API_URL=https://...upstash.io
KV_REST_API_TOKEN=...
```

**Optional**:

```bash
# Test Mode (NEVER true in production)
ENABLE_TEST_MODE=false

# CSRF Secret (uses ADMIN_PORTAL_KEY if not set)
CSRF_SECRET=your-csrf-secret

# OpenTelemetry
OTEL_EXPORTER_OTLP_ENDPOINT=https://...
```

### Constants & Configuration

**Letter Types** (`lib/constants.ts`):

```typescript
LETTER_TYPES = [
  { value: 'demand_letter', label: 'Demand Letter', price: 299 },
  { value: 'cease_desist', label: 'Cease & Desist', price: 299 },
  { value: 'breach_of_contract', label: 'Breach of Contract', price: 299 },
  { value: 'debt_collection', label: 'Debt Collection', price: 299 },
  { value: 'eviction_notice', label: 'Eviction Notice', price: 299 },
  { value: 'settlement_offer', label: 'Settlement Offer', price: 299 }
]
```

**Subscription Plans** (`lib/constants.ts`):

```typescript
SUBSCRIPTION_PLANS = [
  {
    letters: 1,
    price: 299,
    planType: 'one_time',
    popular: false
  },
  {
    letters: 4,
    price: 299,
    planType: 'standard_4_month',
    popular: true
  },
  {
    letters: 8,
    price: 599,
    planType: 'premium_8_month',
    popular: false
  }
]
```

### Scripts

**Utility Scripts** (`/scripts/`):

```bash
# Validate environment variables
pnpm validate-env

# Health check
pnpm health-check
pnpm health-check:production

# Create admin user
pnpm tsx scripts/create-admin-user.ts

# Update admin password
pnpm tsx scripts/update-admin-password.ts

# Manage admin users
pnpm tsx scripts/manage-admin.ts

# Pre-deployment checks
pnpm predeploy:check

# Security audit
pnpm audit:security

# Database migrations
pnpm db:migrate
```

---

## Quick Reference

### Common File Locations

```
Authentication:
  lib/auth/authenticate-user.ts
  lib/auth/admin-session.ts

Email:
  lib/email/service.ts
  lib/email/templates.ts
  lib/email/queue.ts

Security:
  lib/security/csrf.ts
  lib/security/input-sanitizer.ts

Rate Limiting:
  lib/rate-limit-redis.ts

AI Integration:
  lib/ai/openai-client.ts
  lib/ai/openai-retry.ts

Payment:
  lib/stripe/client.ts

Database:
  lib/supabase/server.ts
  lib/supabase/client.ts

Monitoring:
  lib/monitoring/tracing.ts
  lib/monitoring/health-check.ts

Admin:
  lib/admin/letter-actions.ts
  lib/admin/admin-management.ts

Constants:
  lib/constants.ts

Types:
  lib/types/api.ts
  lib/types/letter.types.ts
  lib/types/database.types.ts
```

### Common Operations

**Create a subscription**:
```typescript
const { data } = await supabase
  .from('subscriptions')
  .insert({
    user_id: userId,
    status: 'active',
    plan_type: 'standard_4_month',
    price: 299,
    remaining_letters: 4,
    credits_remaining: 4
  })
  .select()
  .single()
```

**Deduct letter allowance**:
```typescript
const { data } = await supabase.rpc('deduct_letter_allowance', {
  user_id: userId
})
```

**Send email**:
```typescript
import { EmailService } from '@/lib/email/service'

const emailService = new EmailService()
await emailService.send({
  to: 'user@example.com',
  subject: 'Your Subject',
  html: '<p>Your message</p>',
  text: 'Your message'
})
```

**Create audit log**:
```typescript
await supabase.from('letter_audit_trail').insert({
  letter_id: letterId,
  action: 'submitted',
  performed_by: userId,
  old_status: 'draft',
  new_status: 'pending_review'
})
```

**Check user role**:
```typescript
const { data: profile } = await supabase
  .from('profiles')
  .select('role, is_super_user')
  .eq('id', userId)
  .single()

const isAdmin = profile?.role === 'admin'
const isSuperUser = profile?.is_super_user === true
```

### Debugging Tips

1. **Check logs in Vercel Dashboard** → Logs tab
2. **Use health check**: `/api/health` for service status
3. **Check email queue**: `/api/admin/email-queue` (admin)
4. **Review audit trail**: `/api/letters/[id]/audit`
5. **Test Stripe webhook locally**: Use Stripe CLI
6. **Enable tracing**: Set `OTEL_EXPORTER_OTLP_ENDPOINT`

### Common Pitfalls

1. **ENABLE_TEST_MODE in production** → NEVER do this
2. **Forgetting rate limiting** → Always apply to new endpoints
3. **Missing input validation** → Use schemas and sanitization
4. **No CSRF on admin actions** → Required for sensitive ops
5. **Direct database access in routes** → Use RLS policies
6. **Hardcoded secrets** → Use environment variables
7. **Missing error handling** → Wrap in try-catch
8. **No audit logging** → Log all sensitive actions

---

## Additional Resources

**Documentation**:
- [Main README](./README.md)
- [Setup Guide](./docs/SETUP_AND_CONFIGURATION.md)
- [Architecture Guide](./docs/ARCHITECTURE_AND_DEVELOPMENT.md)
- [API Guide](./docs/API_AND_INTEGRATIONS.md)
- [Deployment Guide](./docs/DEPLOYMENT_GUIDE.md)

**External Documentation**:
- [Next.js Docs](https://nextjs.org/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Stripe API](https://stripe.com/docs/api)
- [OpenAI API](https://platform.openai.com/docs)
- [Resend Docs](https://resend.com/docs)

---

## Changelog

**2026-01-04**: Initial comprehensive documentation created
- Complete API endpoint reference (42 endpoints)
- Full database schema documentation
- Code conventions and patterns
- Security practices
- Configuration guide
- Development guidelines

---

**End of CLAUDE.md**

This document is maintained for AI assistants (Claude, GitHub Copilot, etc.) to understand the complete Talk-To-My-Lawyer codebase architecture, conventions, and implementation details.
