# Talk-To-My-Lawyer 🚀

**Status**: ✅ **LIVE PRODUCTION** - Real payment processing active

AI-powered legal letter generation platform with mandatory attorney review.

🌐 **Live Site**: <https://www.talk-to-my-lawyer.com>
⚖️ **Admin Portal**: <https://www.talk-to-my-lawyer.com/secure-admin-gateway>  
📊 **System Status**: <https://www.talk-to-my-lawyer.com/api/health>  

---

## 🎯 Production Features (LIVE)

- ✅ **Real Payment Processing** - Stripe Live Mode with actual transactions
- ✅ **AI Letter Generation** - OpenAI GPT-4 Turbo integration
- ✅ **Attorney Review Workflow** - Dual-admin letter approval system
- ✅ **Subscription Management** - Monthly/Yearly plans with credit system
- ✅ **Employee Referrals** - 5% commission system with payout requests
- ✅ **Production Email System** - Professional templates via Resend
- ✅ **Security & Rate Limiting** - Upstash Redis protection
- ✅ **Admin Analytics** - Revenue, user, and performance dashboards

---

## 💳 Payment Plans (Live Production)

- **Single Letter**: $299 (1 letter, one-time payment)
- **Monthly Plan**: $299/month (4 letters per month)
- **Yearly Plan**: $599/year (52 letters per year)
- **Free Trial**: First letter free for new users

---

## 📚 Documentation

Complete documentation is available in the `/docs` directory. See **[docs/README.md](./docs/README.md)** for a comprehensive documentation index.

### Comprehensive Guides (Recommended Starting Point)

- **[Setup & Configuration Guide](docs/SETUP_AND_CONFIGURATION.md)** - Environment setup, database, admin users, test mode
- **[Architecture & Development Guide](docs/ARCHITECTURE_AND_DEVELOPMENT.md)** - System architecture, workflows, development guidelines
- **[API & Integrations Guide](docs/API_AND_INTEGRATIONS.md)** - Stripe, email, GitHub secrets, payment testing
- **[Deployment Guide](docs/DEPLOYMENT_GUIDE.md)** - Production deployment, CI/CD, monitoring, runbooks

### Topic-Specific Guides

| Guide | Description |
| ------- | ------------- |
| [**Setup Guide**](./docs/SETUP.md) | Complete installation and configuration |
| [**Admin Guide**](./docs/ADMIN_GUIDE.md) | Admin user management and dual-admin system |
| [**Development**](./docs/DEVELOPMENT.md) | Architecture, patterns, and development guide |
| [**Deployment**](./docs/DEPLOYMENT.md) | CI/CD pipeline and Vercel deployment |
| [**Operations**](./docs/OPERATIONS.md) | Production operations and monitoring |
| [**Payments**](./docs/PAYMENTS.md) | Stripe integration and payment testing |
| [**Testing**](./docs/TESTING.md) | Test mode, manual testing, and tracing |
| [**Database**](./docs/DATABASE.md) | Database schema, migrations, and operations |
| [**Security**](./docs/SECURITY.md) | Security audit, fixes, and best practices |
| [**Security Scanner**](./docs/SECURITY_SCANNER.md) | Automated security scanning and secret detection |
| [**Tracing**](./docs/TRACING.md) | OpenTelemetry distributed tracing setup |

---

## Quick Start

### Prerequisites

- Node.js 18+
- pnpm
- Supabase account
- Stripe account
- OpenAI API key

### Installation

```bash
# Clone the repository
git clone https://github.com/moizjmj-pk/talk-to-my-lawyer.git
cd talk-to-my-lawyer

# Install dependencies
pnpm install

# Copy environment file
cp .env.example .env.local

# Fill in your environment variables
# See docs/SETUP_AND_CONFIGURATION.md for details

# Run database migrations
pnpm db:migrate

# Start development server
pnpm dev
```

---

## 👥 Admin Model (Source of Truth)

The platform uses a **dual-admin system** with two distinct administrative roles:

### Admin Roles

| Role | TypeScript Type | Database Value | Access Level |
|------|----------------|----------------|--------------|
| **System Admin** | `'super_admin'` | `admin_sub_role = 'super_admin'` | Full platform access |
| **Attorney Admin** | `'attorney_admin'` | `admin_sub_role = 'attorney_admin'` | Letter review only |

### Canonical Role Strings

**In Code (TypeScript/SQL)**:
- `'super_admin'` - System Admin role identifier
- `'attorney_admin'` - Attorney Admin role identifier

**In Documentation/UI**:
- "System Admin" - Full access administrator
- "Attorney Admin" - Legal review administrator

### Permission Matrix

| Feature | System Admin | Attorney Admin | Subscriber | Employee |
|---------|--------------|----------------|------------|----------|
| Platform Analytics | ✅ | ❌ | ❌ | ❌ |
| User Management | ✅ | ❌ | ❌ | ❌ |
| Review Letters | ✅ | ✅ | ❌ | ❌ |
| Approve/Reject Letters | ✅ | ✅ | ❌ | ❌ |
| Coupon Management | ✅ | ❌ | ❌ | ❌ |
| Commission Management | ✅ | ❌ | ❌ | ❌ |
| Email Queue Management | ✅ | ❌ | ❌ | ❌ |
| Generate Letters | ❌ | ❌ | ✅ | ❌ |
| View Referrals | ❌ | ❌ | ❌ | ✅ |

### Access Areas

**System Admin** (`/secure-admin-gateway`):
- Dashboard with analytics
- User management
- All letters view
- Review center
- Coupon management
- Commission management
- Email queue management

**Attorney Admin** (`/attorney-portal`):
- Review center only
- Letter approval/rejection
- Profile settings

### Authentication Functions

**TypeScript** (`lib/auth/admin-session.ts`):
```typescript
requireSuperAdminAuth()      // System Admin only
requireAttorneyAdminAccess() // Both admin types
isSuperAdmin()              // Check if System Admin
isAttorneyAdmin()           // Check if Attorney Admin
```

**SQL** (Database functions):
```sql
is_super_admin()      -- Returns true for System Admin
is_attorney_admin()   -- Returns true for Attorney Admin
```

### Creating Admin Users

See [Admin Guide](./docs/ADMIN_GUIDE.md) for detailed instructions.

```bash
# Create System Admin
pnpm dlx dotenv-cli -e .env.local -- pnpm tsx scripts/create-additional-admin.ts admin@example.com password123

# Create Attorney Admin
pnpm dlx dotenv-cli -e .env.local -- pnpm tsx scripts/create-additional-admin.ts attorney@example.com password123 attorney
```
