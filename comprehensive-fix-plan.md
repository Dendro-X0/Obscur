# Comprehensive Repository Fix Plan

## Current Problem Analysis

### Issues Identified:
1. **Lost Recent Work**: Reset to old commit, losing logo and UI/UX enhancements
2. **Large Files**: Rust build artifacts (60-108 MB) in Git history
3. **Poor Repository Design**: Committing build artifacts and generated files
4. **Untracked Files**: Desktop app files not properly managed

### Root Causes:
1. **Missing .gitignore entries** for build artifacts
2. **Committing generated files** (target/, .cargo-target/, *.rlib, *.pdb)
3. **No build artifact management strategy**
4. **Inconsistent file tracking**

## Recovery Strategy

### Step 1: Recover Latest Work
```bash
# Stash current changes
git stash push -m "temp changes during recovery"

# Switch to latest work
git checkout backup-before-fix

# Create new working branch
git checkout -b recovery-main
```

### Step 2: Clean Repository Design
```bash
# Remove large files from Git history using filter-branch
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch \
    .cargo-target/**/* \
    apps/desktop/src-tauri/target/**/* \
    **/*.rlib \
    **/*.pdb \
    **/*.meta \
    **/*.lock' \
  --prune-empty --tag-name-filter cat -- --all
```

### Step 3: Comprehensive .gitignore
```gitignore
# Dependencies
node_modules/
**/node_modules/

# Build outputs
**/dist/
**/build/
.next/
out/

# Rust/Tauri build artifacts
**/target/
.cargo-target/
**/*.rlib
**/*.pdb
**/*.meta
**/Cargo.lock

# Generated files
**/gen/
**/generated/

# IDE and OS
.vscode/
.idea/
.DS_Store
Thumbs.db

# Logs
*.log
npm-debug.log*
yarn-debug.log*
pnpm-debug.log*

# Environment
.env*
!.env.example

# Testing
**/test-results/
**/playwright-report/
**/coverage/

# Temporary files
*.tmp
*.temp
.cache/
```

## Prevention Strategy

### 1. Repository Structure
```
obscur/
├── apps/
│   ├── pwa/           # Next.js PWA (source only)
│   ├── api/           # API server (source only)
│   └── desktop/       # Tauri wrapper (source only, no target/)
├── packages/          # Shared libraries (source only)
├── docs/             # Documentation
├── scripts/          # Build and deployment scripts
└── .github/          # CI/CD workflows
```

### 2. Build Management
- **Never commit build artifacts**
- **Use CI/CD for builds**
- **Separate source from generated files**
- **Regular cleanup scripts**

### 3. File Size Monitoring
```bash
# Add to pre-commit hook
git ls-files | xargs ls -lh | awk '$5 > 10485760 {print $9 " is " $5}' # Files > 10MB
```

## Implementation Steps

### Immediate Actions:
1. Recover latest work from backup-before-fix
2. Clean Git history of large files
3. Update .gitignore comprehensively
4. Test build process
5. Push clean repository

### Long-term Improvements:
1. Set up pre-commit hooks
2. Add file size monitoring
3. Implement CI/CD for builds
4. Regular repository maintenance