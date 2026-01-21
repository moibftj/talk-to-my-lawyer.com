# Admin Model Mismatch Report

## Executive Summary

This report documents all naming, type, and terminology mismatches found during the audit of the dual-admin system implementation. The product uses two admin roles:
- **System Admin** (canonical TypeScript type: `super_admin`)
- **Attorney Admin** (canonical TypeScript type: `attorney_admin`)

## Critical Mismatches Found

### 1. SQL Function Naming Inconsistency

**Location**: `supabase/migrations/20260103000200_016_analytics_enhancements.sql`

**Issue**: Uses `is_system_admin()` instead of canonical `is_super_admin()`

**Lines affected**:
- Line 24: `IF NOT public.is_system_admin() THEN`
- Line 64: `IF NOT public.is_system_admin() THEN`
- Line 98: `IF NOT public.is_system_admin() THEN`
- Line 131: `IF NOT (public.is_system_admin() OR public.is_attorney_admin()) THEN`
- Line 170: `IF NOT (public.is_system_admin() OR public.is_attorney_admin()) THEN`

**Expected**: `is_super_admin()`

**Impact**: CRITICAL - Function calls will fail at runtime. The function `is_system_admin()` does not exist in the database; only `is_super_admin()` exists.

**Evidence**: Migration `20250102000000_013_admin_role_separation.sql` defines:
\`\`\`sql
CREATE OR REPLACE FUNCTION public.is_super_admin()
\`\`\`

Migration `20260103120000_017_rename_system_admin_to_super_admin.sql` explicitly renamed this function.

---

### 2. TypeScript Function Naming Inconsistency

**Location**: `lib/admin/letter-actions.ts`

**Issue**: Function named `validateSystemAdminAction` instead of `validateSuperAdminAction`

**Line**: 45
\`\`\`typescript
export async function validateSystemAdminAction(request: NextRequest): Promise<NextResponse | null>
\`\`\`

**Expected**: `validateSuperAdminAction`

**Impact**: MEDIUM - Code works but creates confusion. The function correctly calls `requireSuperAdminAuth()` internally, but the name suggests "System Admin" terminology.

**Used in**:
- `app/api/admin/email-queue/route.ts` (lines 6, 80, line reference needed)
- `app/api/admin/coupons/create/route.ts` (lines 4, 33, 127)

---

### 3. Database Migration Comment Mismatch

**Location**: `supabase/migrations/20250102000000_013_admin_role_separation.sql`

**Issue**: Line 146 comment says "system admin" instead of "Super Admin"

**Line 146**:
\`\`\`sql
COMMENT ON FUNCTION public.is_super_admin IS 'Returns true if current user is a system admin with full access';
\`\`\`

**Expected**: 
\`\`\`sql
COMMENT ON FUNCTION public.is_super_admin IS 'Returns true if current user is a Super Admin with full access';
\`\`\`

**Impact**: LOW - Documentation only, but creates confusion

---

### 4. Allowance Service Role Check Bug

**Location**: `supabase/migrations/20260107000001_atomic_allowance_deduction.sql`

**Issue**: Line 59 checks for role `'super_admin'` but should check `admin_sub_role`

**Line 59**:
\`\`\`sql
IF user_record.role = 'super_admin' THEN
\`\`\`

**Expected**:
\`\`\`sql
IF user_record.role = 'admin' AND user_record.admin_sub_role = 'super_admin' THEN
\`\`\`

**Impact**: CRITICAL - Super Admins will never be detected because `role` column only contains `'subscriber'`, `'employee'`, or `'admin'`, never `'super_admin'`. The `super_admin` value is stored in the `admin_sub_role` column.

---

### 5. Documentation Terminology Inconsistencies

#### 5a. README.md

**Line 17**: "Multi-admin letter approval system"
**Expected**: "Dual-admin letter approval system" or "Attorney review workflow"

**Line 51**: "Admin user management and multi-admin system"
**Expected**: "Admin user management and dual-admin system"

#### 5b. ADMIN_GUIDE.md

Multiple instances of "Super Admin" where canonical term should be "System Admin":

- **Line 15**: "Sub-Roles: Super Admin (full access) and Attorney Admin (letter review only)"
  - **Expected**: "System Admin (full access) and Attorney Admin (letter review only)"

- **Line 23**: Table header "Super Admin (`super_admin`)"
  - **Expected**: "System Admin (`super_admin`)"

- **Line 28**: `is_super_admin()` - Returns true for `role='admin'` AND `admin_sub_role='super_admin'`
  - **Comment**: Mentions "Super Admin" in documentation context
  - **Expected**: "System Admin"

- **Line 30**: Helper function `get_admin_dashboard_stats()` - Comprehensive stats for Super Admin only
  - **Expected**: "System Admin only"

- **Line 101**: `admin_sub_role = 'super_admin',  -- or 'attorney_admin'`
  - **Comment**: Code examples are correct, but prose should use "System Admin"

- **Line 138-151**: Section "Super Admin Permissions"
  - **Expected**: "System Admin Permissions"

- **Line 206-211**: "Update Admin Sub-Role" section
  - SQL examples correct but comments should say "System Admin"

- **Line 327-334**: "Migration from Single-Admin" section
  - **Expected**: Remove this section entirely or update to reflect the dual-admin model as primary

#### 5c. ROLES-AND-OPERATIONS.md

Multiple references need updating:

- **Line 101**: `### 3a. Super Admin (`admin_sub_role = 'super_admin'`)`
  - **Expected**: `### 3a. System Admin (`admin_sub_role = 'super_admin'`)`

- **Line 105**: `**Auth Guard**: \`requireSuperAdminAuth()\` from \`lib/auth/admin-session.ts\``
  - **Comment**: Code reference is correct, but section title should be "System Admin"

- **Line 146**: Comment in function description "Returns true if current user is a system admin with full access"
  - **Expected**: "System Admin" (capitalized)

#### 5d. docs/ADMIN_SYSTEM_VERIFICATION.md

Extensive use of "Super Admin" terminology throughout - all instances should be "System Admin":

- Line 5: `**System Admin**: Super Admin (\`super_admin\`)`
  - **Expected**: `**System Admin**: System Admin (\`super_admin\`)`

- Lines 43, 45, 61, and many more use "Super Admin" in headers and text
  - **Expected**: Replace all with "System Admin"

#### 5e. PR_DESCRIPTION.md

- Line 21: "Enforced super_admin only access to System Admin portal"
  - **Expected**: Terminology is mixed but acceptable in this context since it's historical

- Line 25: "Updated UI labels: 'Super Administrator' → 'System Admin'"
  - **Expected**: This is actually documenting the correct change

- Line 37: Table headers use "Super Admin"
  - **Expected**: "System Admin"

---

### 6. Code Comment Mismatches

#### 6a. lib/auth/admin-session.ts

**Line 9**: 
\`\`\`typescript
export type AdminSubRole = 'super_admin' | 'attorney_admin'
\`\`\`
**Comment**: Type definition is correct

**Line 184-185**: Comments say "super_admin" (correct) but prose documentation should standardize on "System Admin" when describing the role in human-readable form

**Functions named correctly**:
- `requireSuperAdminAuth()` - Correct (uses TypeScript naming convention)
- `isSuperAdmin()` - Correct
- `isAttorneyAdmin()` - Correct

#### 6b. scripts/create-additional-admin.ts

**Line 26**: Variable naming is correct: `let adminSubRole: 'super_admin' | 'attorney_admin' = 'super_admin'`

**Line 56**: Output message uses "Super Admin (full access)"
- **Expected**: "System Admin (full access)"

**Line 69**: Output uses `'super_admin'` (correct technical value)

**Line 106, 153**: Login URL logic is correct

**Line 155**: Check `adminSubRole === 'super_admin'` (correct)

---

### 7. UI Label Inconsistencies

Need to audit all frontend components for:
- Navigation labels
- Page titles
- Button text
- Help text
- Error messages

**Files to check**:
- `app/secure-admin-gateway/**/*.tsx`
- `app/attorney-portal/**/*.tsx`
- `components/admin/**/*.tsx`

---

## Terminology Standardization Matrix

| Context | Canonical Term | TypeScript Type | Database Column Value | SQL Function Name |
|---------|---------------|-----------------|----------------------|-------------------|
| Human-readable (docs) | System Admin | - | - | - |
| Human-readable (docs) | Attorney Admin | - | - | - |
| TypeScript type | - | `'super_admin'` | - | - |
| TypeScript type | - | `'attorney_admin'` | - | - |
| Database enum value | - | - | `'super_admin'` | - |
| Database enum value | - | - | `'attorney_admin'` | - |
| SQL function | - | - | - | `is_super_admin()` |
| SQL function | - | - | - | `is_attorney_admin()` |
| TypeScript function | - | `requireSuperAdminAuth()` | - | - |
| TypeScript function | - | `requireAttorneyAdminAccess()` | - | - |

**Key Principle**: 
- **In documentation/UI**: Use "System Admin" and "Attorney Admin"
- **In code (types/enums)**: Use `'super_admin'` and `'attorney_admin'`
- **Function names**: Use camelCase with "SuperAdmin" or "AttorneyAdmin"

---

## Outdated Terminology to Remove

### "Multi-Admin System"
**Replace with**: "Dual-Admin System" or just describe the two specific roles

**Found in**:
- README.md line 17, 51
- docs/ADMIN_GUIDE.md line 3, 7, 97, 327, 350
- docs/ADMIN_SYSTEM_VERIFICATION.md line 425
- docs/README.md line 17, 57, 59, 97, 98
- docs/CONSOLIDATION_SUMMARY.md line 77, 97
- docs/DEVELOPMENT.md line 184

### "Single-Admin" / "Migration from Single-Admin"
**Action**: Remove these historical references entirely

**Found in**:
- docs/ADMIN_GUIDE.md lines 327-334
- docs/DATABASE.md line 213-214

### Inconsistent Capitalization
**Issue**: "system admin" vs "System Admin"
**Standard**: Always capitalize as "System Admin" in prose

---

## Summary Statistics

- **Critical Issues**: 2 (SQL function calls, role check bug)
- **Medium Issues**: 1 (TypeScript function naming)
- **Low Issues (Documentation)**: 50+ instances across multiple files
- **Files requiring changes**: ~25 files
- **Total mismatches found**: 60+

---

## Recommended Actions

1. **IMMEDIATE** (Critical fixes):
   - Fix SQL function calls in migration 016
   - Fix role check logic in allowance deduction migration
   
2. **HIGH PRIORITY** (Code consistency):
   - Rename `validateSystemAdminAction` → `validateSuperAdminAction`
   - Update all callers
   
3. **MEDIUM PRIORITY** (Documentation):
   - Update all docs to use "System Admin" not "Super Admin"
   - Remove "multi-admin" terminology, replace with "dual-admin"
   - Remove "single-admin" historical references
   
4. **LOW PRIORITY** (Polish):
   - Update UI labels for consistency
   - Update script output messages
   - Standardize all comments

---

**Report Generated**: January 2026
**Audit Scope**: Complete repository
**Methodology**: Comprehensive grep search + manual file review
