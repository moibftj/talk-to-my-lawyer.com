# Admin User Management Guide

This guide explains how to create and manage admin users in the Talk-To-My-Lawyer platform.

## Overview

The platform uses a **multi-admin system** that allows multiple administrators to share the same admin dashboard for reviewing and approving letters.

### Key Features

- **Multiple Admins**: Unlimited admin users can be created
- **Shared Dashboard**: All admins access `/secure-admin-gateway`
- **Individual Credentials**: Each admin has their own email/password
- **Portal Key**: Shared secret for additional security layer

---

## Authentication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     ADMIN AUTHENTICATION FLOW                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│   [Admin User]                                                  │
│      │                                                          │
│      ▼                                                          │
│   /secure-admin-gateway/login                                  │
│      │                                                          │
│      │ 1. Enter email & password (Supabase Auth)               │
│      │ 2. Enter Admin Portal Key (shared secret)                │
│      ▼                                                          │
│   ┌───────────────────────────────────────────┐                 │
│   │  Verify Credentials                       │                 │
│   │  - Authenticate with Supabase Auth        │                 │
│   │  - Verify ADMIN_PORTAL_KEY                │                 │
│   │  - Check role = 'admin' in profiles       │                 │
│   └───────────────────────────────────────────┘                 │
│      │                                                          │
│      ▼                                                          │
│   Create Admin Session (30 min timeout)                         │
│      │                                                          │
│      ▼                                                          │
│   /secure-admin-gateway/dashboard                               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## Creating Admin Users

### Method 1: Using the Script (Recommended)

```bash
npx dotenv-cli -e .env.local -- npx tsx scripts/create-additional-admin.ts <email> <password>
```

**Example:**
```bash
npx dotenv-cli -e .env.local -- npx tsx scripts/create-additional-admin.ts john@company.com SecurePass123!
```

**What the script does:**
1. Creates a Supabase Auth user (or updates if exists)
2. Sets `role = 'admin'` in the profiles table
3. Auto-confirms email (no verification required)

### Method 2: Manual Database Update

```sql
-- Step 1: Create user in Supabase Auth (via dashboard or API)
-- Step 2: Update role to admin
UPDATE profiles
SET role = 'admin',
    updated_at = NOW()
WHERE email = 'admin@example.com';
```

---

## Environment Variables

### Required for Multi-Admin System

```env
# Admin Portal Key (shared secret for all admins)
ADMIN_PORTAL_KEY=your-secure-random-key-here

# Optional: These are deprecated but may still be referenced
# ADMIN_EMAIL=admin@company.com  # Deprecated - not used
# ADMIN_PASSWORD=password        # Deprecated - not used
```

### Generating a Secure Portal Key

```bash
# Generate a random 64-character key
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Admin User Roles & Permissions

### Role: `admin`

Admin users have the following permissions:

| Permission | Description |
|------------|-------------|
| **View Letters** | Access all letters across all users |
| **Review Letters** | Start review on pending letters |
| **Approve Letters** | Approve letters with final content |
| **Reject Letters** | Reject letters with reason |
| **Improve Content** | Request AI-improved versions |
| **View Audit Trail** | See all letter history |
| **Access Analytics** | View platform statistics |
| **Manage Coupons** | Create and manage employee coupons |
| **Email Queue** | View and manage email queue |

### Dashboard Access

All admins access the same dashboard at:
- **Login**: `/secure-admin-gateway/login`
- **Dashboard**: `/secure-admin-gateway/dashboard`

---

## Database Schema

### Profiles Table

```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email TEXT NOT NULL,
  full_name TEXT,
  role user_role DEFAULT 'subscriber',  -- 'subscriber' | 'employee' | 'admin'
  phone TEXT,
  company_name TEXT,
  stripe_customer_id TEXT,
  total_letters_generated INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Query Admin Users

```sql
-- List all admin users
SELECT id, email, full_name, created_at
FROM profiles
WHERE role = 'admin'
ORDER BY created_at ASC;

-- Count admin users
SELECT COUNT(*) as admin_count
FROM profiles
WHERE role = 'admin';
```

---

## Managing Admin Users

### Add New Admin

```bash
npx dotenv-cli -e .env.local -- npx tsx scripts/create-additional-admin.ts new@admin.com SecurePassword123!
```

### Remove Admin Access

```sql
-- Demote admin to subscriber
UPDATE profiles
SET role = 'subscriber',
    updated_at = NOW()
WHERE email = 'former-admin@example.com';
```

### Change Admin Password

Since passwords are managed by Supabase Auth, use one of these methods:

**Option 1: Via Supabase Dashboard**
1. Go to Authentication → Users
2. Find the user
3. Click "Reset Password"

**Option 2: Let User Reset**
1. User goes to `/auth/reset-password`
2. Enters their email
3. Receives reset link

---

## Security Best Practices

### 1. Use Strong Portal Keys

```bash
# Generate a secure 64-character key
openssl rand -hex 32
```

### 2. Limit Admin Access

Only grant admin access to trusted personnel who need it for:
- Letter review
- Customer support
- Platform management

### 3. Monitor Admin Activity

All admin actions are logged in the audit trail:
```sql
SELECT * FROM letter_audit_trail
WHERE performed_by IN (
  SELECT id FROM profiles WHERE role = 'admin'
)
ORDER BY created_at DESC
LIMIT 50;
```

### 4. Regular Access Review

Periodically review admin users and remove access for:
- Former employees
- Changed roles
- No longer needing admin access

---

## Troubleshooting

### Admin Cannot Login

**Check 1: Verify Role**
```sql
SELECT email, role FROM profiles WHERE email = 'admin@example.com';
-- Should return: role = 'admin'
```

**Check 2: Verify Portal Key**
```env
# Check .env.local has correct ADMIN_PORTAL_KEY
ADMIN_PORTAL_KEY=correct-key-here
```

**Check 3: Supabase Auth User Exists**
- Go to Supabase Dashboard → Authentication → Users
- Search for the email
- Verify user is confirmed

### Admin Session Expires Quickly

Admin sessions expire after **30 minutes** of inactivity. This is intentional for security.

To change this, edit `lib/auth/admin-session.ts`:
```typescript
const ADMIN_SESSION_TIMEOUT = 30 * 60 * 1000 // 30 minutes
```

### Multiple Admins Seeing Same Data

This is **intentional**. All admins share the same dashboard and see the same letters. They can collaborate on reviews, but only one admin should approve/reject each letter.

---

## Migration Notes

### From Single-Admin to Multi-Admin

If you're upgrading from the old single-admin system:

1. **Run migrations**: The migrations `20251224100000_011` and `20251224110000_012` automatically:
   - Remove `is_superuser` column
   - Remove single-admin constraint
   - Update allowance checking functions

2. **Update environment variables**: Remove deprecated `ADMIN_EMAIL` and `ADMIN_PASSWORD`

3. **Create additional admins**: Use the script to add more admins

---

## Summary

| Feature | Description |
|---------|-------------|
| **Admin Creation** | `scripts/create-additional-admin.ts` |
| **Auth Method** | Supabase Auth + Portal Key |
| **Session Timeout** | 30 minutes |
| **Dashboard Location** | `/secure-admin-gateway` |
| **Max Admins** | Unlimited |
| **Role Field** | `profiles.role = 'admin'` |
