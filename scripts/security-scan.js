#!/usr/bin/env node

/**
 * Security Scanner Script
 * 
 * Scans the codebase for:
 * 1. Hardcoded secrets (API keys, tokens, passwords)
 * 2. Environment variable leaks in logs
 * 3. Exposed credentials in committed files
 * 4. Insecure patterns
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

// Security patterns to detect
const SECURITY_PATTERNS = {
  // API Keys and Tokens
  apiKeys: {
    pattern: /(?:api[_-]?key|apikey|api[_-]?secret)\s*[:=]\s*['"]([a-zA-Z0-9_\-]{20,})['"]|['"](?:sk|pk)[_-][a-zA-Z0-9]{20,}['"]/gi,
    severity: 'high',
    description: 'Hardcoded API key detected'
  },
  
  // Generic secrets
  secrets: {
    pattern: /(?:secret|password|passwd|pwd|token|auth)[_-]?(?:key)?\s*[:=]\s*['"](?!YOUR_|REPLACE_|EXAMPLE_|TEST_|<|{|\$)[a-zA-Z0-9_\-!@#$%^&*()+=]{8,}['"]/gi,
    severity: 'high',
    description: 'Hardcoded secret or password detected'
  },
  
  // AWS Keys
  awsKeys: {
    pattern: /AKIA[0-9A-Z]{16}/g,
    severity: 'critical',
    description: 'AWS Access Key ID detected'
  },
  
  // Private Keys
  privateKeys: {
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
    severity: 'critical',
    description: 'Private key detected'
  },
  
  // Stripe Keys
  stripeKeys: {
    pattern: /(?:sk|pk|rk)_(?:live|test)_[0-9a-zA-Z]{24,}/g,
    severity: 'high',
    description: 'Stripe API key detected'
  },
  
  // OpenAI Keys
  openaiKeys: {
    pattern: /sk-[a-zA-Z0-9]{48}/g,
    severity: 'high',
    description: 'OpenAI API key detected'
  },
  
  // Supabase Keys (service role)
  supabaseServiceKeys: {
    pattern: /eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*/g,
    severity: 'high',
    description: 'JWT token detected (possible Supabase service key)'
  },
  
  // Environment variable logging
  envLogging: {
    pattern: /console\.log\s*\([^)]*process\.env\.[A-Z_]+[^)]*\)/gi,
    severity: 'medium',
    description: 'Environment variable logging detected'
  },
  
  // Direct env var exposure in strings
  envExposure: {
    pattern: /['"`]\$\{process\.env\.[A-Z_]+\}['"`]|`.*\$\{process\.env\.[A-Z_]+\}.*`/gi,
    severity: 'medium',
    description: 'Environment variable exposed in template string'
  },
  
  // Hardcoded URLs with credentials
  urlCredentials: {
    pattern: /(?:https?|ftp):\/\/[a-zA-Z0-9]+:[a-zA-Z0-9]+@[^\s'"]+/gi,
    severity: 'high',
    description: 'URL with embedded credentials detected'
  },
  
  // Database connection strings with passwords
  dbConnections: {
    pattern: /(?:mongodb|mysql|postgres|postgresql):\/\/[^:]+:[^@]+@[^\s'"]+/gi,
    severity: 'high',
    description: 'Database connection string with password detected'
  }
};

// Files and directories to exclude from scanning
const EXCLUDE_PATTERNS = [
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'out',
  'coverage',
  '.pnpm-store',
  '.env.example',
  '.env.tracing.example',
  'pnpm-lock.yaml',
  'package-lock.json',
  'yarn.lock',
  '*.min.js',
  '*.map',
  'scripts/security-scan.js', // Exclude this script itself
  // Note: Old migration scripts with hardcoded credentials should be cleaned up
  // They are included in scan to ensure they get flagged
];

// Files that are allowed to have example patterns
const SAFE_FILES = [
  '.env.example',
  '.env.tracing.example',
  'README.md',
  'docs/',
  '.gitignore'
];

class SecurityScanner {
  constructor() {
    this.findings = [];
    this.scannedFiles = 0;
    this.errors = [];
  }

  /**
   * Check if a file should be excluded from scanning
   */
  shouldExclude(filePath) {
    return EXCLUDE_PATTERNS.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp(pattern.replace(/\*/g, '.*'));
        return regex.test(filePath);
      }
      return filePath.includes(pattern);
    });
  }

  /**
   * Check if a file is in the safe list (examples, docs)
   */
  isSafeFile(filePath) {
    return SAFE_FILES.some(safe => filePath.includes(safe));
  }

  /**
   * Scan a single file for security issues
   */
  scanFile(filePath) {
    if (this.shouldExclude(filePath)) {
      return;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const isSafe = this.isSafeFile(filePath);
      
      this.scannedFiles++;

      // Check each security pattern
      for (const [key, config] of Object.entries(SECURITY_PATTERNS)) {
        const matches = content.matchAll(config.pattern);
        
        for (const match of matches) {
          // Skip if it's a safe file and the pattern is not critical
          if (isSafe && config.severity !== 'critical') {
            continue;
          }

          // Get line number
          const beforeMatch = content.substring(0, match.index);
          const lineNumber = beforeMatch.split('\n').length;
          
          // Get context (the line containing the match)
          const lines = content.split('\n');
          const contextLine = lines[lineNumber - 1];
          
          // Skip obvious false positives
          if (this.isFalsePositive(contextLine, key)) {
            continue;
          }

          this.findings.push({
            file: filePath,
            line: lineNumber,
            severity: config.severity,
            description: config.description,
            pattern: key,
            context: contextLine.trim().substring(0, 100)
          });
        }
      }
    } catch (error) {
      this.errors.push({
        file: filePath,
        error: error.message
      });
    }
  }

  /**
   * Check for false positives based on context
   */
  isFalsePositive(line, patternKey) {
    const trimmedLine = line.trim();
    
    // Skip comments
    if (trimmedLine.startsWith('//') || trimmedLine.startsWith('*') || trimmedLine.startsWith('#')) {
      return true;
    }
    
    // Skip markdown code blocks and inline code
    if (trimmedLine.includes('```') || trimmedLine.includes('`')) {
      // If it's inside backticks, it's likely documentation
      if (trimmedLine.match(/`[^`]*-----BEGIN[^`]*`/)) {
        return true;
      }
    }
    
    // Skip example/placeholder values
    const placeholderPatterns = [
      /YOUR_[A-Z_]+/i,
      /REPLACE_[A-Z_]+/i,
      /EXAMPLE_[A-Z_]+/i,
      /TEST_[A-Z_]+/i,
      /xxx+/i,
      /<[^>]+>/,
      /\{[^}]+\}/,
      /your-[a-z-]+-here/i,
      /sk-your-/i,
      /pk_test_your/i
    ];
    
    if (placeholderPatterns.some(pattern => pattern.test(line))) {
      return true;
    }
    
    // Skip env var logging in development/debugging contexts
    if (patternKey === 'envLogging') {
      if (line.includes('NODE_ENV') || line.includes('development')) {
        return true;
      }
    }
    
    return false;
  }

  /**
   * Recursively scan directory
   */
  scanDirectory(dir) {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (this.shouldExclude(fullPath)) {
          continue;
        }
        
        if (entry.isDirectory()) {
          this.scanDirectory(fullPath);
        } else if (entry.isFile()) {
          // Only scan text files
          const ext = path.extname(entry.name);
          const textExtensions = [
            '.js', '.ts', '.tsx', '.jsx', '.json', '.env', '.yaml', '.yml',
            '.md', '.txt', '.sh', '.bash', '.zsh', '.config', '.conf'
          ];
          
          if (textExtensions.includes(ext) || entry.name.startsWith('.env')) {
            this.scanFile(fullPath);
          }
        }
      }
    } catch (error) {
      this.errors.push({
        directory: dir,
        error: error.message
      });
    }
  }

  /**
   * Check .gitignore effectiveness
   */
  checkGitignore() {
    const gitignorePath = path.join(process.cwd(), '.gitignore');
    
    if (!fs.existsSync(gitignorePath)) {
      this.findings.push({
        file: '.gitignore',
        line: 0,
        severity: 'high',
        description: '.gitignore file not found',
        pattern: 'gitignore',
        context: 'Missing .gitignore file'
      });
      return;
    }

    const gitignore = fs.readFileSync(gitignorePath, 'utf8');
    const requiredPatterns = [
      '.env',
      '.env.local',
      '.env*.local',
      'node_modules',
      '*.key',
      '*.pem',
      '*_SECRETS*',
      '*_CREDENTIALS*'
    ];

    for (const pattern of requiredPatterns) {
      if (!gitignore.includes(pattern)) {
        this.findings.push({
          file: '.gitignore',
          line: 0,
          severity: 'medium',
          description: `Missing important pattern in .gitignore: ${pattern}`,
          pattern: 'gitignore',
          context: `Add "${pattern}" to .gitignore`
        });
      }
    }
  }

  /**
   * Check for committed sensitive files using git
   */
  checkCommittedFiles() {
    try {
      const gitFiles = execSync('git ls-files', { encoding: 'utf8' });
      const files = gitFiles.split('\n').filter(f => f.trim());
      
      const sensitivePatternsInGit = [
        /\.env$/,
        /\.env\.local$/,
        /\.env\.production$/,
        /\.env\.staging$/,
        /\.key$/,
        /\.pem$/,
        /_SECRETS/i,
        /_CREDENTIALS/i,
        /secrets\.json$/i,
        /credentials\.json$/i
      ];

      for (const file of files) {
        for (const pattern of sensitivePatternsInGit) {
          if (pattern.test(file)) {
            this.findings.push({
              file: file,
              line: 0,
              severity: 'critical',
              description: 'Sensitive file committed to git',
              pattern: 'committed-secrets',
              context: `File should be in .gitignore: ${file}`
            });
          }
        }
      }
    } catch (error) {
      // Git might not be available or not a git repo
      console.log(`${colors.yellow}⚠ Warning: Could not check git committed files${colors.reset}`);
    }
  }

  /**
   * Generate report
   */
  generateReport() {
    console.log(`\n${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}`);
    console.log(`${colors.cyan}  SECURITY SCAN REPORT${colors.reset}`);
    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);
    
    console.log(`Files scanned: ${this.scannedFiles}`);
    console.log(`Total findings: ${this.findings.length}\n`);

    if (this.findings.length === 0) {
      console.log(`${colors.green}✓ No security issues found!${colors.reset}\n`);
      return true;
    }

    // Group findings by severity
    const critical = this.findings.filter(f => f.severity === 'critical');
    const high = this.findings.filter(f => f.severity === 'high');
    const medium = this.findings.filter(f => f.severity === 'medium');
    const low = this.findings.filter(f => f.severity === 'low');

    const printFindings = (findings, title, color) => {
      if (findings.length > 0) {
        console.log(`${color}${title} (${findings.length})${colors.reset}`);
        console.log(`${color}${'─'.repeat(60)}${colors.reset}`);
        
        findings.forEach((finding, index) => {
          console.log(`\n${index + 1}. ${finding.description}`);
          console.log(`   File: ${finding.file}:${finding.line}`);
          console.log(`   Context: ${finding.context}`);
        });
        console.log('');
      }
    };

    printFindings(critical, '🔴 CRITICAL ISSUES', colors.red);
    printFindings(high, '🟠 HIGH SEVERITY ISSUES', colors.red);
    printFindings(medium, '🟡 MEDIUM SEVERITY ISSUES', colors.yellow);
    printFindings(low, '🟢 LOW SEVERITY ISSUES', colors.green);

    if (this.errors.length > 0) {
      console.log(`${colors.yellow}⚠ SCAN ERRORS (${this.errors.length})${colors.reset}`);
      this.errors.forEach(err => {
        console.log(`   ${err.file || err.directory}: ${err.error}`);
      });
      console.log('');
    }

    console.log(`${colors.cyan}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${colors.reset}\n`);

    // Return false if critical or high severity issues found
    return critical.length === 0 && high.length === 0;
  }

  /**
   * Run complete security scan
   */
  run() {
    console.log(`${colors.blue}🔍 Starting security scan...${colors.reset}\n`);
    
    const startTime = Date.now();
    
    // Run all checks
    this.checkGitignore();
    this.checkCommittedFiles();
    this.scanDirectory(process.cwd());
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`${colors.blue}Scan completed in ${duration}s${colors.reset}`);
    
    // Generate and return report
    const passed = this.generateReport();
    
    if (!passed) {
      console.log(`${colors.red}❌ Security scan failed! Please fix the issues above.${colors.reset}\n`);
      process.exit(1);
    } else {
      console.log(`${colors.green}✅ Security scan passed!${colors.reset}\n`);
      process.exit(0);
    }
  }
}

// Run the scanner
const scanner = new SecurityScanner();
scanner.run();
