# IMMEDIATE ACTIONS - Fix Vercel & Desktop Issues

## 🔴 URGENT: Fix Vercel Deployment

### Issue
Vercel is showing old "Nostr Messenger" UI instead of new "Obscur" UI with latest features.

### Quick Fix Steps

1. **Check Vercel Dashboard**
   - Go to https://vercel.com/dashboard
   - Find your project
   - Check "Deployments" tab
   - Verify latest deployment is from `main` branch commit `d6acc8f`

2. **Force Redeploy**
   ```bash
   # Option A: Push empty commit to trigger rebuild
   git commit --allow-empty -m "chore: trigger Vercel redeploy"
   git push origin main
   
   # Option B: Use Vercel CLI
   vercel --prod
   ```

3. **Clear Vercel Cache**
   - In Vercel Dashboard → Settings → General
   - Scroll to "Build & Development Settings"
   - Click "Clear Cache"
   - Redeploy

4. **Verify Build Command**
   - Vercel Settings → Build & Development Settings
   - Build Command should be: `pnpm build:pwa`
   - Output Directory should be: `apps/pwa/.next`
   - Install Command should be: `pnpm install`

---

## 🔧 Fix Desktop App Installer Icon

### Current Issue
Installer uses default Tauri icon instead of Obscur logo.

### Solution

1. **Check if icons exist**
   ```bash
   ls apps/desktop/src-tauri/icons/
   ```

2. **If icons are missing, we need to create them**
   - Do you have an Obscur logo file (SVG, PNG, or AI)?
   - If yes, I can help convert it to required formats
   - If no, we can use a placeholder or create one

3. **Required icon formats**:
   - `icon.ico` - Windows (256x256, 128x128, 64x64, 32x32, 16x16)
   - `icon.icns` - macOS (512x512, 256x256, 128x128, 64x64, 32x32, 16x16)
   - `icon.png` - Linux/base (1024x1024)
   - Plus various sizes for different contexts

---

## 📝 Add Installation Guide to README

### Create user-friendly installation instructions

```markdown
## Installation

### Windows
1. Download `Obscur_0.2.4_x64-setup.exe` from [Releases](https://github.com/Dendro-X0/Obscur/releases)
2. **Important**: Windows may show "Unknown publisher" warning
   - This is normal for new apps without expensive code signing certificates
   - Click "More info" → "Run anyway"
   - Your data is safe - the app is open source and auditable
3. Follow installation wizard
4. Launch Obscur from Start Menu

### macOS
1. Download `Obscur_0.2.4_x64.dmg` from [Releases](https://github.com/Dendro-X0/Obscur/releases)
2. Open the DMG file
3. Drag Obscur to Applications folder
4. **First launch**: Right-click → Open (to bypass Gatekeeper)
5. Future launches: Double-click normally

### Linux
**AppImage** (Universal):
1. Download `obscur_0.2.4_amd64.AppImage`
2. Make executable: `chmod +x obscur_0.2.4_amd64.AppImage`
3. Run: `./obscur_0.2.4_amd64.AppImage`

**Debian/Ubuntu** (.deb):
1. Download `obscur_0.2.4_amd64.deb`
2. Install: `sudo dpkg -i obscur_0.2.4_amd64.deb`
3. Run: `obscur` or find in app menu

### Web App (No Installation)
Visit https://obscur-lovat.vercel.app in any modern browser.
Works on desktop and mobile!
```

---

## 🎯 Next Steps (Priority Order)

1. **TODAY**: Fix Vercel deployment
2. **TODAY**: Add installation guide to README
3. **THIS WEEK**: Create/add proper icons
4. **THIS WEEK**: Plan UX improvements (username search, invite codes)
5. **NEXT WEEK**: Implement simplified onboarding
6. **FUTURE**: Get code signing certificate (when budget allows)

---

## 💡 Quick Wins for Better UX

### 1. Simplify First-Time Experience
Add a "Quick Start" modal on first launch:
```
Welcome to Obscur! 🎉

Step 1: Your identity is being created... ✓
Step 2: Choose a username (optional)
Step 3: You're ready to chat!

[Add Your First Contact]
```

### 2. Better Contact Adding
Replace complex invite flow with:
```
Add Contact:
[ Search by username: @alice ]
    OR
[ Enter invite code: OBSCUR-ABC123 ]
    OR
[ Scan QR Code ]
```

### 3. In-App Help
Add "?" icons with tooltips:
- "What's a passphrase?" → Explains encryption
- "What are relays?" → Explains Nostr network
- "Is my data safe?" → Explains local-first architecture

---

## 🔍 Debugging Vercel Issue

If Vercel still shows old version after redeploy, check:

1. **Browser cache**: Hard refresh (Ctrl+Shift+R)
2. **Service worker**: Check DevTools → Application → Service Workers → Unregister
3. **Vercel logs**: Check build logs for errors
4. **Environment variables**: Ensure no old env vars pointing to wrong code
5. **Build output**: Download production build and inspect files

---

## 📞 Need Help?

If you encounter issues:
1. Share Vercel deployment logs
2. Share browser console errors
3. Share screenshots of Vercel dashboard settings
4. I'll help debug!
