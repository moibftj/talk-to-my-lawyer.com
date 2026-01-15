# GitHub Copilot Agents for Talk-to-My-Lawyer

This directory contains specialized GitHub Copilot agents tailored for the Talk-to-My-Lawyer legal SaaS platform.

## Available Agents

### 1. **Next.js Expert** (`nextjs-expert.agent.md`)
**Purpose:** Next.js 14+ development with App Router, Server Components, and API routes

**Use when:**
- Building new API endpoints
- Creating pages and components
- Implementing server actions
- Integrating with Supabase/OpenAI/Stripe

**Key Features:**
- Enforces security-first API route pattern (rate limiting → auth → validation)
- Knows the complete letter lifecycle and multi-role architecture
- Provides working code following project patterns

---

### 2. **TypeScript Expert** (`typescript-expert.agent.md`)
**Purpose:** Type-safe development with TypeScript, Zod validation, and Supabase types

**Use when:**
- Creating new types or interfaces
- Validating API input
- Working with Supabase database types
- Implementing type-safe error handling

**Key Features:**
- Zod schema patterns for all external data
- Type-safe Supabase query patterns
- Runtime validation best practices
- Security through type safety

---

### 3. **API Architect** (`api-architect.agent.md`)
**Purpose:** RESTful API design, endpoint architecture, and third-party integrations

**Use when:**
- Designing new API endpoints
- Integrating external services (OpenAI, Stripe, Resend)
- Implementing webhooks
- Structuring request/response contracts

**Key Features:**
- Standard API route security pattern
- Integration patterns for all services
- Rate limiting strategies
- Consistent error responses

---

### 4. **Supabase DBA** (`supabase-dba.agent.md`)
**Purpose:** Database design, RLS policies, migrations, and stored procedures

**Use when:**
- Creating database migrations
- Writing RLS policies
- Implementing stored procedures
- Optimizing queries and indexes

**Key Features:**
- RLS policy templates for all roles
- Atomic operation patterns (FOR UPDATE locks)
- Migration best practices
- Audit trail implementation

---

### 5. **Security Reviewer** (`security-reviewer.agent.md`)
**Purpose:** Security audits, OWASP compliance, and vulnerability detection

**Use when:**
- Reviewing new code for security issues
- Before deploying to production
- After significant changes to auth/authorization
- When handling sensitive legal/payment data

**Key Features:**
- Enforces non-negotiable security requirements
- Checks OWASP Top 10 vulnerabilities
- Validates RLS policies and access control
- Creates detailed security review reports

---

## How to Use These Agents

### In GitHub Copilot Chat

1. **Select an agent** based on your task (see "Use when" sections above)
2. **Reference the agent** in your Copilot chat:
   ```
   @nextjs-expert Create a new API endpoint for letter submission
   ```
3. **Provide context** about what you're building
4. **Review the generated code** carefully before implementing

### In VS Code

1. Open GitHub Copilot Chat (`Ctrl/Cmd + I`)
2. Type `@` to see available agents
3. Select the appropriate agent
4. Ask your question or describe your task

### Best Practices

- **Use the right agent** - Each agent specializes in different areas
- **Combine agents** - Use security-reviewer after nextjs-expert creates new code
- **Reference existing code** - Agents know your codebase patterns
- **Validate output** - Always review and test generated code

---

## Agent Selection Guide

| Task | Primary Agent | Secondary Agent |
|------|---------------|-----------------|
| New API endpoint | `api-architect` | `nextjs-expert` |
| Database migration | `supabase-dba` | `security-reviewer` |
| Type definitions | `typescript-expert` | - |
| UI component | `nextjs-expert` | - |
| Security audit | `security-reviewer` | `supabase-dba` |
| OpenAI integration | `api-architect` | `nextjs-expert` |
| Stripe webhook | `api-architect` | `security-reviewer` |
| RLS policy | `supabase-dba` | `security-reviewer` |

---

## Project-Specific Knowledge

All agents understand:

- **Non-negotiable security rules** from `CLAUDE.md`
- **Multi-role architecture** (subscriber, employee, admin + sub-roles)
- **Letter lifecycle** (draft → review → approved → sent)
- **Current tech stack** (Next.js, Supabase, OpenAI, Stripe, Resend)
- **Existing patterns** (API routes, error handling, rate limiting)
- **Database schema** (28+ migrations, RLS policies, stored procedures)

---

## Examples

### Example 1: Creating a New API Endpoint

```
@api-architect Create a new endpoint at /api/letters/[id]/download
that allows subscribers to download their approved letters as PDF.
It should:
- Check authentication and ownership
- Verify letter status is "approved"
- Rate limit to 10 downloads per minute
- Return PDF file with proper headers
```

### Example 2: Database Migration

```
@supabase-dba Create a migration to add a "priority" field to the letters table.
It should:
- Add priority ENUM ('low', 'normal', 'high', 'urgent')
- Default to 'normal'
- Update RLS policies to include new field
- Create an index on (user_id, priority, status)
```

### Example 3: Type-Safe Validation

```
@typescript-expert Create a Zod schema for letter creation that validates:
- title (1-200 chars)
- letterType (enum from database)
- recipientInfo (name required, email optional, address optional)
- intakeData (JSONB object with unknown structure)
Include TypeScript types inferred from the schema.
```

### Example 4: Security Review

```
@security-reviewer Review the new letter submission endpoint at
app/api/letters/submit/route.ts for security vulnerabilities.
Check for:
- Proper authentication and authorization
- Input validation
- Rate limiting
- Audit logging
- OWASP Top 10 compliance
```

---

## Updating Agents

If you need to update an agent:

1. Edit the agent file in `.github/copilot/agents/`
2. Update the relevant sections (context, patterns, examples)
3. Test with Copilot to ensure it uses the new information
4. Commit changes with descriptive message

---

## Agent Source

These agents are based on patterns from:
- [GitHub Copilot Agents Repository](https://github.com/github/awesome-copilot/tree/main/agents)
- Customized for Talk-to-My-Lawyer legal SaaS platform
- Enhanced with project-specific security requirements and patterns

---

## Need Help?

- **General questions**: Use `@nextjs-expert` or `@api-architect`
- **Security concerns**: Always consult `@security-reviewer`
- **Database questions**: Use `@supabase-dba`
- **Type issues**: Use `@typescript-expert`

Remember: These agents are assistants, not replacements for human judgment.
Always review, test, and validate generated code before deployment.
