# Admin Model Audit - Quick Reference

This document provides a quick reference for the dual-admin model alignment completed on January 13, 2026.

## 📋 Quick Facts

- **Files Changed**: 23
- **Bugs Fixed**: 2 (Critical)
- **Commits**: 4
- **Lines Changed**: +772, -78
- **Terminology Fixes**: 60+

## 🎯 The Dual-Admin Model

### Two Distinct Roles

| Role | Access | Portal |
|------|--------|--------|
| **System Admin** | Full platform access | `/secure-admin-gateway` |
| **Attorney Admin** | Letter review only | `/attorney-portal` |

### How to Identify Each Role

**In the Database:**
\`\`\`sql
-- System Admin
WHERE role = 'admin' AND admin_sub_role = 'super_admin'

-- Attorney Admin  
WHERE role = 'admin' AND admin_sub_role = 'attorney_admin'
\`\`\`

**In TypeScript:**
\`\`\`typescript
// Types
type AdminSubRole = 'super_admin' | 'attorney_admin'

// Checking roles
await requireSuperAdminAuth()      // System Admin only
await requireAttorneyAdminAccess() // Both admin types
await isSuperAdmin()               // Returns boolean
await isAttorneyAdmin()            // Returns boolean
\`\`\`

**In SQL Functions:**
\`\`\`sql
-- Check functions (return boolean)
is_super_admin()      -- System Admin
is_attorney_admin()   -- Attorney Admin

-- Analytics functions (System Admin only)
get_coupon_usage_by_employee()
get_letter_analytics()
get_subscriber_analytics()

-- Review functions (Both admin types)
get_letters_for_review()
update_letter_review(...)
\`\`\`

## 🐛 Critical Bugs Fixed

### Bug #1: Non-existent SQL Function Calls
**Location**: `supabase/migrations/20260103000200_016_analytics_enhancements.sql`  
**Problem**: Called `is_system_admin()` which doesn't exist  
**Solution**: Changed to `is_super_admin()`  
**Severity**: CRITICAL - Would cause runtime errors

### Bug #2: Wrong Role Check in Allowance Service
**Location**: `supabase/migrations/20260107000001_atomic_allowance_deduction.sql`  
**Problem**: Checked `role='super_admin'` instead of `admin_sub_role`  
**Solution**: Now checks both `role='admin'` AND `admin_sub_role='super_admin'`  
**Severity**: CRITICAL - System Admins would never get unlimited letters

## 📚 Naming Convention Rules

### In Human-Readable Text (Docs, UI, Comments)

✅ **Correct:**
- "System Admin" (always capitalized)
- "Attorney Admin" (always capitalized)
- "dual-admin system"

❌ **Incorrect:**
- "Super Admin" 
- "super admin" (lowercase)
- "system admin" (lowercase)
- "multi-admin system"

### In Code (Types, Variables, Database)

✅ **Correct:**
\`\`\`typescript
// TypeScript types
'super_admin'
'attorney_admin'

// Function names
requireSuperAdminAuth()
isSuperAdmin()
isAttorneyAdmin()
validateSuperAdminAction()

// SQL functions
is_super_admin()
is_attorney_admin()
\`\`\`

❌ **Incorrect:**
\`\`\`typescript
// Never use these
'system_admin'
'super-admin'
'SystemAdmin'
is_system_admin()
validateSystemAdminAction()
\`\`\`

## 📂 Where to Find What

### Source of Truth
**File**: `README.md`  
**Section**: "Admin Model (Source of Truth)"  
Contains: Complete role definitions, permissions matrix, access areas, authentication functions

### Detailed Audit Report
**File**: `ADMIN_MODEL_MISMATCH_REPORT.md`  
Contains: All mismatches found during audit, categorized by severity

### Summary Report
**File**: `ADMIN_MODEL_ALIGNMENT_SUMMARY.md`  
Contains: Complete summary of all changes, before/after comparisons, testing recommendations

### Implementation Guide
**File**: `docs/ADMIN_GUIDE.md`  
Contains: How to create admins, manage permissions, troubleshoot issues

### Technical Reference
**File**: `docs/ROLES-AND-OPERATIONS.md`  
Contains: Detailed role permissions, API endpoints, database functions

## 🔑 Key Files by Category

### Critical SQL Files
1. `supabase/migrations/20260103000200_016_analytics_enhancements.sql` - Fixed function calls
2. `supabase/migrations/20260107000001_atomic_allowance_deduction.sql` - Fixed role check
3. `supabase/migrations/20250102000000_013_admin_role_separation.sql` - Defines admin roles

### Core Auth Files
1. `lib/auth/admin-session.ts` - Admin authentication logic
2. `lib/admin/letter-actions.ts` - Admin action validation
3. `app/api/admin-auth/login/route.ts` - Admin login endpoint

### Portal Files
1. `app/secure-admin-gateway/` - System Admin portal
2. `app/attorney-portal/` - Attorney Admin portal

## ✅ Testing Checklist

Before deploying, verify:

- [ ] Run `pnpm build` successfully
- [ ] Test System Admin login → redirects to `/secure-admin-gateway/dashboard`
- [ ] Test Attorney Admin login → redirects to `/attorney-portal/review`
- [ ] System Admin can access all dashboard pages
- [ ] Attorney Admin cannot access `/secure-admin-gateway`
- [ ] System Admin gets unlimited letter generation
- [ ] Analytics functions work for System Admin
- [ ] Review functions work for both admin types

## 🚀 Quick Admin Creation

### Create System Admin
\`\`\`bash
pnpm dlx dotenv-cli -e .env.local -- pnpm tsx scripts/create-additional-admin.ts admin@example.com password123
\`\`\`

### Create Attorney Admin
\`\`\`bash
pnpm dlx dotenv-cli -e .env.local -- pnpm tsx scripts/create-additional-admin.ts attorney@example.com password123 attorney
\`\`\`

## 📊 Permission Matrix (Quick Reference)

| Feature | System | Attorney |
|---------|--------|----------|
| Analytics | ✅ | ❌ |
| Users | ✅ | ❌ |
| Review Letters | ✅ | ✅ |
| Approve Letters | ✅ | ✅ |
| Coupons | ✅ | ❌ |
| Commissions | ✅ | ❌ |
| Email Queue | ✅ | ❌ |

## 🔗 Related Documents

- **Main README**: `/README.md`
- **Admin Guide**: `/docs/ADMIN_GUIDE.md`
- **Roles Reference**: `/docs/ROLES-AND-OPERATIONS.md`
- **Audit Report**: `/ADMIN_MODEL_MISMATCH_REPORT.md`
- **Summary**: `/ADMIN_MODEL_ALIGNMENT_SUMMARY.md`

---

**Last Updated**: January 13, 2026  
**Status**: ✅ Complete  
**Version**: Dual-Admin System v2.0
