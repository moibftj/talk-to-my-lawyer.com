# Security Scanner

This directory contains the security scanning infrastructure for the Talk-To-My-Lawyer application.

## Overview

The security scanner is a comprehensive tool that checks the codebase for:

1. **Hardcoded Secrets** - API keys, tokens, passwords, and other sensitive credentials
2. **Environment Variable Leaks** - Logging or exposing environment variables
3. **Committed Sensitive Files** - Files that should be in .gitignore but were accidentally committed
4. **Insecure Patterns** - Database connection strings with passwords, URLs with embedded credentials, etc.
5. **.gitignore Effectiveness** - Ensures critical patterns are present to prevent accidental commits

## Usage

### Local Scanning

Run the security scanner locally before committing:

```bash
# Run the security scanner
pnpm security:scan

# Or directly
node scripts/security-scan.js
```

### GitHub Actions

The security scanner runs automatically on:
- **Every push** to the `main` branch
- **Every pull request** to the `main` branch
- **Daily at 2 AM UTC** (scheduled scan)
- **Manual trigger** via GitHub Actions UI

The GitHub Action workflow includes multiple security checks:

1. **Custom Security Scanner** - Runs our comprehensive JavaScript-based scanner
2. **Gitleaks** - Industry-standard secret scanning
3. **Dependency Scanning** - Checks for vulnerable dependencies using `pnpm audit`
4. **CodeQL Analysis** - GitHub's semantic code analysis for security vulnerabilities
5. **Environment Validation** - Ensures proper .gitignore patterns and no committed secrets

## What It Detects

### Critical Severity
- AWS Access Keys (`AKIA...`)
- Private SSH/RSA keys (`-----BEGIN PRIVATE KEY-----`)
- Committed sensitive files in git history

### High Severity
- API keys (OpenAI, Stripe, Supabase, etc.)
- Hardcoded passwords and secrets
- Database connection strings with passwords
- URLs with embedded credentials
- JWT tokens (possible Supabase service keys)

### Medium Severity
- Environment variable logging (`console.log(process.env.*)`)
- Environment variables exposed in template strings
- Missing .gitignore patterns

## Security Patterns Detected

The scanner uses regex patterns to detect:

```javascript
// API Keys
/api[_-]?key|apikey|api[_-]?secret/

// Stripe Keys
/sk_live_[0-9a-zA-Z]{24,}/

// OpenAI Keys
/sk-[a-zA-Z0-9]{48}/

// AWS Keys
/AKIA[0-9A-Z]{16}/

// And many more...
```

## False Positive Prevention

The scanner intelligently skips:

- **Comments** - Lines starting with `//`, `*`, or `#`
- **Placeholder values** - Patterns like `YOUR_API_KEY`, `REPLACE_ME`, `EXAMPLE_`, `<placeholder>`
- **Example files** - `.env.example`, documentation in `docs/`, `README.md`
- **Development logging** - `console.log` for `NODE_ENV` checks
- **Build artifacts** - `node_modules`, `.next`, `dist`, etc.

## Configuration

### Excluded Files/Directories

Edit `EXCLUDE_PATTERNS` in `scripts/security-scan.js`:

```javascript
const EXCLUDE_PATTERNS = [
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'out',
  // Add more patterns...
];
```

### Safe Files

Edit `SAFE_FILES` to mark files that can contain example patterns:

```javascript
const SAFE_FILES = [
  '.env.example',
  'README.md',
  'docs/',
  // Add more files...
];
```

### Security Patterns

Add new patterns in `SECURITY_PATTERNS`:

```javascript
const SECURITY_PATTERNS = {
  myPattern: {
    pattern: /your-regex-here/gi,
    severity: 'high', // critical, high, medium, low
    description: 'Description of what this detects'
  }
};
```

## Best Practices

### Before Committing

1. **Always run the scanner** before committing code:
   ```bash
   pnpm security:scan
   ```

2. **Review findings** - Not all findings are real issues, use judgment

3. **Fix high/critical issues** - These should always be addressed

### Handling Secrets

1. **Never commit secrets** - Use environment variables instead
2. **Use .env.local** - This file is in .gitignore
3. **Use .env.example** - Document required variables without actual values
4. **Rotate compromised secrets** - If you accidentally commit a secret:
   - Rotate the secret immediately
   - Remove from git history (`git filter-branch` or BFG Repo-Cleaner)
   - Force push (requires admin rights)

### Environment Variables

```typescript
// ❌ BAD - Logging environment variables
console.log('API Key:', process.env.OPENAI_API_KEY);

// ❌ BAD - Hardcoded secrets
const apiKey = 'sk-1234567890abcdef';

// ✅ GOOD - Use environment variables
const apiKey = process.env.OPENAI_API_KEY;

// ✅ GOOD - Safe logging (log name, not value)
console.log('Using API key:', process.env.OPENAI_API_KEY ? 'configured' : 'missing');
```

### .gitignore Patterns

Ensure these patterns are in `.gitignore`:

```gitignore
# Environment variables
.env
.env.local
.env*.local
.env.production
.env.staging

# Sensitive files
*.key
*.pem
*_SECRETS*
*_CREDENTIALS*
secrets.json
credentials.json
```

## GitHub Actions Workflow

The workflow file is located at `.github/workflows/security-scan.yml`.

### Workflow Jobs

1. **security-scan** - Runs the custom JavaScript scanner
2. **secret-scanning** - Runs Gitleaks for comprehensive secret detection
3. **dependency-scan** - Checks for vulnerable dependencies
4. **codeql-analysis** - Performs semantic code analysis
5. **env-validation** - Validates environment configuration
6. **security-summary** - Summarizes all security check results

### Artifacts

Failed scans upload reports as artifacts:
- `security-scan-report` - Custom scanner findings
- `dependency-audit-report` - NPM audit results

Access these from the Actions tab in GitHub.

## Troubleshooting

### Scanner reports false positives

1. Check if the pattern matches placeholder/example values
2. Add the file to `SAFE_FILES` if it's documentation
3. Adjust the regex pattern to be more specific
4. Use comments to document why it's safe

### Scanner misses actual secrets

1. The secret might match an excluded pattern
2. Add a new pattern to `SECURITY_PATTERNS`
3. Report the issue to improve detection

### Workflow fails on pull request

1. Review the security report artifact
2. Fix any high/critical issues
3. For medium issues, assess if they're real concerns
4. Update the PR once fixes are committed

## Emergency: Secret Leaked

If a secret was committed to git:

1. **Immediately rotate the secret** in the service (Stripe, OpenAI, etc.)
2. **Remove from git history**:
   ```bash
   # Using BFG Repo-Cleaner (recommended)
   bfg --replace-text passwords.txt
   git reflog expire --expire=now --all
   git gc --prune=now --aggressive
   
   # Or using git filter-branch
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch path/to/file" \
     --prune-empty --tag-name-filter cat -- --all
   ```
3. **Force push** (requires admin rights):
   ```bash
   git push --force --all origin
   ```
4. **Notify team** that they need to re-clone the repository

## Additional Resources

- [GitHub Secret Scanning](https://docs.github.com/en/code-security/secret-scanning)
- [OWASP Secrets Management](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html)
- [Gitleaks Documentation](https://github.com/gitleaks/gitleaks)
- [CodeQL Documentation](https://codeql.github.com/docs/)

## Support

For issues or questions about the security scanner:
1. Check this documentation
2. Review the scanner source code at `scripts/security-scan.js`
3. Open an issue in the repository
