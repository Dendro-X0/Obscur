# Fix Large Files in Git Repository

## Problem
Large Rust/Tauri build files (60-108 MB) are in Git history, preventing push to GitHub.

## Files Causing Issues
- `.cargo-target/desktop/debug/deps/libwindows-*.rlib` (60-108 MB)
- `apps/desktop/src-tauri/target/debug/deps/` files (60-98 MB)
- Various `.pdb`, `.rlib`, `.meta` files

## Solution Options

### Option 1: Remove Files from Git History (Recommended)
```bash
# Remove large files from entire Git history
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch .cargo-target/**/* apps/desktop/src-tauri/target/**/* **/*.rlib **/*.pdb **/*.meta' \
  --prune-empty --tag-name-filter cat -- --all

# Alternative using git-filter-repo (if available)
git filter-repo --path .cargo-target --invert-paths
git filter-repo --path apps/desktop/src-tauri/target --invert-paths
git filter-repo --glob '*.rlib' --invert-paths
git filter-repo --glob '*.pdb' --invert-paths
git filter-repo --glob '*.meta' --invert-paths
```

### Option 2: Use BFG Repo-Cleaner (Faster)
```bash
# Download BFG (if not installed)
# java -jar bfg.jar --delete-folders .cargo-target --delete-folders target
# java -jar bfg.jar --delete-files '*.{rlib,pdb,meta}'
```

### Option 3: Reset to Clean State (Nuclear Option)
```bash
# Create a new branch without the large files
git checkout --orphan clean-main
git add -A
git commit -m "Clean repository without build artifacts"
git branch -D main
git branch -m main
```

## Steps to Execute

1. **Backup your work first:**
```bash
git branch backup-before-cleanup
```

2. **Update .gitignore (already done):**
```
# Rust/Tauri
**/target/
.cargo-target/
**/*.pdb
**/*.rlib
**/*.meta
```

3. **Choose and execute one of the solutions above**

4. **Force push the cleaned repository:**
```bash
git push origin main --force
```

## Prevention
- Always add build directories to .gitignore before first commit
- Use `git add .` carefully, prefer specific file additions
- Regular cleanup of build artifacts

## Verification
After cleanup, verify with:
```bash
git log --oneline --graph
git ls-files | grep -E '\.(rlib|pdb|meta)$'  # Should return nothing
```