# Version Management

This project uses a centralized version management system to keep the PWA and desktop app versions synchronized.

## Single Source of Truth

The version is stored in [`version.json`](file:///e:/Web%20Project/experimental-workspace/newstart/version.json) at the repository root:

```json
{
  "version": "0.2.7"
}
```

## Automated Sync

The version is automatically synced to:
- `apps/pwa/package.json`
- `apps/desktop/package.json`
- `apps/desktop/src-tauri/tauri.conf.json`

## Scripts

### Sync Version

Manually sync the version from `version.json` to all files:

```bash
pnpm version:sync
```

This is automatically run during the Tauri build workflow.

### Bump Version

Increment the version and sync to all files:

```bash
# Bump patch version (0.2.7 → 0.2.8)
pnpm version:bump patch

# Bump minor version (0.2.7 → 0.3.0)
pnpm version:bump minor

# Bump major version (0.2.7 → 1.0.0)
pnpm version:bump major
```

The bump script will:
1. Update `version.json`
2. Run `version:sync` to update all files
3. Display next steps for committing and tagging

## Release Workflow

1. **Bump the version:**
   ```bash
   pnpm version:bump patch  # or minor/major
   ```

2. **Review changes:**
   ```bash
   git diff
   ```

3. **Commit and tag:**
   ```bash
   git add .
   git commit -m "v0.2.8 release"
   git tag v0.2.8
   ```

4. **Push to trigger builds:**
   ```bash
   git push origin main
   git push origin v0.2.8
   ```

5. The GitHub Actions workflow will:
   - Sync versions automatically
   - Build the desktop app
   - Create a GitHub release with installers

## Why This Approach?

Previously, versions were manually updated in three separate files, leading to:
- Desktop app stuck at v0.2.5 while PWA was at v0.2.7
- GitHub releases showing wrong version numbers
- Manual sync errors

The centralized system ensures versions never drift out of sync.
