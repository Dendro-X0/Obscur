# Release v0.2.4 - UI/UX Improvements

## Changes in This Release

### UI/UX Enhancements
- ✅ **Hidden Scrollbar**: Horizontal scrollbars on Invites and Settings tabs are now completely hidden while maintaining scroll functionality
- ✅ **Vertical Sidebar Navigation**: Mobile and desktop expanded sidebars now display navigation items vertically (one per line) for better readability
- ✅ **Solid Sidebar Backgrounds**: Fixed transparency issues - sidebars now have solid white/black backgrounds
- ✅ **Symmetrical Top Bar Layout**: Navigation tabs grouped with page title on the left for better visual balance
- ✅ **Fixed Avatar Menu Z-Index**: User avatar dropdown menu now appears above all other UI elements
- ✅ **Removed Redundant Menu**: Eliminated duplicate hamburger menu on Settings page for cleaner UX
- ✅ **Scrollbar Spacing**: Added padding to prevent scrollbar from overlapping with tab buttons

### Technical Improvements
- Updated scrollbar utility class to use `scrollbar-width: none` and `display: none`
- Improved mobile sidebar layout with flex-col instead of grid
- Enhanced PageShell component for better header organization
- Added Search button to home page header

## Files Changed
- `apps/pwa/app/components/app-shell.tsx`
- `apps/pwa/app/components/page-shell.tsx`
- `apps/pwa/app/components/user-avatar-menu.tsx`
- `apps/pwa/app/page.tsx`
- `apps/pwa/app/settings/page.tsx`
- `apps/pwa/app/globals.css`

## Breaking Changes
None

## Migration Guide
No migration needed - all changes are visual/UX improvements

## Testing Checklist
- [ ] PWA builds successfully
- [ ] Desktop app builds successfully
- [ ] Scrollbar is hidden on Invites/Settings tabs
- [ ] Sidebar navigation is vertical on mobile
- [ ] Sidebar backgrounds are solid (not transparent)
- [ ] Avatar menu appears correctly
- [ ] No duplicate hamburger menus
- [ ] All navigation works correctly

## Deployment Steps

### 1. Update Version Numbers
```bash
# Update desktop app version
# Edit apps/desktop/src-tauri/tauri.conf.json - change version to "0.2.4"

# Update PWA version (optional)
# Edit apps/pwa/package.json - change version to "0.2.4"
```

### 2. Commit Version Bump
```bash
git add .
git commit -m "chore: bump version to 0.2.4"
git push origin main
```

### 3. Create Git Tag
```bash
git tag -a v0.2.4 -m "Release v0.2.4 - UI/UX improvements"
git push origin v0.2.4
```

### 4. Build Desktop App
```bash
pnpm build:desktop
```

### 5. Create GitHub Release
- Go to GitHub Releases
- Click "Draft a new release"
- Choose tag: v0.2.4
- Title: "v0.2.4 - UI/UX Improvements"
- Description: Copy from this file
- Upload built executables from `apps/desktop/src-tauri/target/release/bundle/`
- Publish release

### 6. Verify Vercel Deployment
- Vercel should auto-deploy from main branch
- Visit your Vercel URL to confirm new UI is live
- Test all features

## Post-Release
- [ ] Test PWA on Vercel
- [ ] Test desktop app installation
- [ ] Verify auto-updater works (for existing v0.2.3 users)
- [ ] Update documentation if needed
