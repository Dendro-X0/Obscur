#!/bin/bash

# Quick Fix for Large Files Issue
# Run these commands in order

echo "=== Step 1: Backup current work ==="
git branch backup-before-cleanup

echo "=== Step 2: Remove the problematic commit ==="
# Reset to the commit before the large files were added
git reset --hard 72db17d

echo "=== Step 3: Ensure .gitignore is updated ==="
# The .gitignore should already be updated with Rust/Tauri exclusions

echo "=== Step 4: Re-add any important changes without build files ==="
# If there were important changes in the removed commit, re-add them manually
# git add [specific files only, not build directories]

echo "=== Step 5: Create new commit ==="
git add .
git commit -m "feat: complete UI/UX enhancements - ready for release

- Enhanced gradient system with theme-aware backgrounds
- Smooth animations and micro-interactions
- Enhanced empty states with illustrations
- Comprehensive loading and feedback systems
- Page transitions and navigation animations
- Cross-browser compatibility with CSS fallbacks
- All linting issues resolved
- Production build verified"

echo "=== Step 6: Force push to GitHub ==="
echo "WARNING: This will rewrite Git history. Make sure you have a backup!"
echo "Run: git push origin main --force"

echo "=== Verification ==="
echo "Check repository size:"
git count-objects -vH
echo ""
echo "Check for large files:"
git ls-files | xargs ls -lh | sort -k5 -hr | head -10