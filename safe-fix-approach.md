# Safe Approach to Fix Large Files

## Current Situation
- Your latest commit (f68ee03) has the .gitignore fix
- The problematic commit (bce5190) contains large Rust build files
- You need to remove those files from Git history

## Recommended Safe Approach

### Step 1: Backup Everything
```bash
git branch backup-main
git tag backup-tag-$(date +%Y%m%d)
```

### Step 2: Interactive Rebase (Safest)
```bash
# Start interactive rebase from before the problematic commit
git rebase -i 72db17d

# In the editor that opens:
# - Change 'pick' to 'drop' for commit bce5190 (publish desktop app)
# - Keep other commits as 'pick'
# - Save and exit
```

### Step 3: Verify the Fix
```bash
# Check that large files are gone
git ls-files | grep -E '\.(rlib|pdb|meta)$'
git ls-files | grep -E '(target/|\.cargo-target/)'

# Check repository size
git count-objects -vH
```

### Step 4: Test Build
```bash
# Make sure everything still works
pnpm -C apps/pwa build
```

### Step 5: Push to GitHub
```bash
git push origin main --force-with-lease
```

## Alternative: Clean Slate Approach
If the above doesn't work, create a fresh repository:

```bash
# Create new orphan branch
git checkout --orphan clean-main

# Add only the files we want (excluding build artifacts)
git add .gitignore
git add apps/pwa/
git add packages/
git add dcos/
git add .kiro/
git add *.md *.json *.yaml

# Commit the clean state
git commit -m "feat: complete UI/UX enhancements - clean repository

- Enhanced gradient system with theme-aware backgrounds  
- Smooth animations and micro-interactions
- Enhanced empty states with illustrations
- Comprehensive loading and feedback systems
- Page transitions and navigation animations
- Cross-browser compatibility with CSS fallbacks
- All linting issues resolved
- Production build verified"

# Replace main branch
git branch -D main
git branch -m main

# Force push
git push origin main --force
```

## What NOT to Include
- `apps/desktop/src-tauri/target/` (Rust build artifacts)
- `.cargo-target/` (Cargo build cache)
- `**/*.rlib` (Rust library files)
- `**/*.pdb` (Debug symbols)
- `**/*.meta` (Metadata files)
- `node_modules/` (Node dependencies)
- `.next/` (Next.js build)

## Verification Commands
```bash
# Check repository size (should be much smaller)
git count-objects -vH

# List largest files
git ls-files | xargs ls -lh 2>/dev/null | sort -k5 -hr | head -20

# Verify no build artifacts
find . -name "*.rlib" -o -name "*.pdb" -o -name "*.meta" | head -10
```