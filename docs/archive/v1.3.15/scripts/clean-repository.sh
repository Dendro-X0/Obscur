#!/bin/bash

echo "=== Cleaning Repository of Large Files ==="

# Backup current branch
git branch backup-current-state

echo "=== Removing large files from Git history ==="
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch \
    .cargo-target/**/* \
    apps/desktop/src-tauri/target/**/* \
    **/*.rlib \
    **/*.pdb \
    **/*.meta' \
  --prune-empty --tag-name-filter cat -- --all

echo "=== Cleaning up filter-branch refs ==="
git for-each-ref --format="%(refname)" refs/original/ | xargs -n 1 git update-ref -d

echo "=== Expiring reflog ==="
git reflog expire --expire=now --all

echo "=== Garbage collection ==="
git gc --prune=now --aggressive

echo "=== Repository size after cleanup ==="
git count-objects -vH

echo "=== Verification - checking for large files ==="
git ls-files | xargs ls -lh 2>/dev/null | sort -k5 -hr | head -10

echo "=== Done! Repository should now be clean ==="