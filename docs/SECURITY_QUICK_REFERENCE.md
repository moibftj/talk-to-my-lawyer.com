# Security Scanner Quick Reference

## Quick Commands

```bash
# Run security scan
pnpm security:scan

# Run before every commit (recommended)
pnpm precommit
```

## Common Issues & Fixes

### ❌ "Hardcoded API key detected"

**Problem:** Found pattern like `API_KEY = "sk-xxxxx"`

**Fix:** Use environment variables:
```typescript
// Bad
const apiKey = "sk-1234567890"

// Good
const apiKey = process.env.OPENAI_API_KEY
```

### ❌ "Environment variable logging detected"

**Problem:** `console.log(process.env.SECRET_KEY)`

**Fix:** Log safely without exposing values:
```typescript
// Bad
console.log('Key:', process.env.SECRET_KEY)

// Good
console.log('Key configured:', !!process.env.SECRET_KEY)
```

### ❌ "Missing pattern in .gitignore"

**Problem:** Required patterns missing from .gitignore

**Fix:** Add to `.gitignore`:
```gitignore
.env
.env.local
.env*.local
*.key
*.pem
*_SECRETS*
*_CREDENTIALS*
```

### ❌ "Sensitive file committed to git"

**Problem:** `.env` or similar file is in git history

**Fix:** 
1. Add to `.gitignore`
2. Remove from git:
   ```bash
   git rm --cached .env
   git commit -m "Remove .env from git"
   ```
3. If already pushed, rotate the secrets immediately!

## Severity Levels

- 🔴 **CRITICAL** - Must fix before merge (private keys, AWS keys)
- 🟠 **HIGH** - Should fix before merge (API keys, passwords, DB strings)
- 🟡 **MEDIUM** - Review and fix if real (env logging, missing .gitignore patterns)
- 🟢 **LOW** - Optional improvements

## Pre-Commit Checklist

- [ ] No hardcoded secrets or API keys
- [ ] Environment variables used for sensitive data
- [ ] No console.log of environment variables
- [ ] .env.local used for local secrets (not committed)
- [ ] .env.example updated with new variables (no actual values)
- [ ] Security scan passes: `pnpm security:scan`

## Emergency: I Committed a Secret!

1. **Immediately** rotate/revoke the secret in the service
2. Run: `git rm --cached <file>` or use BFG Repo-Cleaner
3. Commit and push
4. If already public, consider the secret compromised

## Need Help?

- 📖 Full docs: `docs/SECURITY_SCANNER.md`
- 🔍 Scanner code: `scripts/security-scan.js`
- 🔧 Workflow: `.github/workflows/security-scan.yml`
