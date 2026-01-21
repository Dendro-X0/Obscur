# Testing Troubleshooting Guide

## Quick Diagnostics

If something isn't working, run these commands first:

```bash
cd apps/desktop

# Check configuration
node validate-build-config.js

# Check security
node test-security.js

# Check performance
node test-performance.js
```

## Common Issues & Solutions

### 1. Build Issues

#### Problem: Build fails with "command not found"
**Symptoms:**
```
Error: pnpm: command not found
```

**Solution:**
```bash
# Install pnpm
npm install -g pnpm

# Or use npm instead
npm run build
```

#### Problem: Build fails with Rust errors
**Symptoms:**
```
error: could not compile `obscur-desktop`
```

**Solution:**
```bash
# Update Rust
rustup update

# Clean and rebuild
cd apps/desktop
rm -rf src-tauri/target
pnpm build
```

#### Problem: Build fails with "frontend not found"
**Symptoms:**
```
Error: Frontend dist directory not found
```

**Solution:**
```bash
# Build PWA first
cd apps/pwa
pnpm build

# Then build desktop
cd ../desktop
pnpm build
```

#### Problem: Build is very slow
**Symptoms:**
- Build takes > 30 minutes
- High CPU usage

**Solution:**
```bash
# Use release profile optimizations (already added)
# Or reduce parallel jobs
export CARGO_BUILD_JOBS=2
pnpm build
```

### 2. Installation Issues

#### Problem: Windows SmartScreen warning
**Symptoms:**
- "Windows protected your PC"
- Can't install

**Solution:**
1. Click "More info"
2. Click "Run anyway"
3. This is expected for unsigned builds

**For Production:**
- Set up code signing (see CODE_SIGNING.md)

#### Problem: macOS Gatekeeper blocking
**Symptoms:**
- "cannot be opened because it is from an unidentified developer"

**Solution:**
1. Right-click the app
2. Select "Open"
3. Click "Open" in dialog
4. Or: System Preferences → Security → "Open Anyway"

**For Production:**
- Set up code signing and notarization

#### Problem: Linux permission denied
**Symptoms:**
```
bash: ./Obscur.AppImage: Permission denied
```

**Solution:**
```bash
chmod +x Obscur_*.AppImage
./Obscur_*.AppImage
```

#### Problem: Installation hangs
**Symptoms:**
- Installer stuck at progress bar
- No error message

**Solution:**
1. Close installer
2. Restart computer
3. Disable antivirus temporarily
4. Try again

### 3. App Launch Issues

#### Problem: App won't start
**Symptoms:**
- Double-click does nothing
- No window appears

**Solution:**

**Windows:**
```bash
# Check if process is running
tasklist | findstr Obscur

# Kill if stuck
taskkill /F /IM obscur-desktop.exe

# Check logs
%APPDATA%\app.obscur.desktop\logs
```

**macOS:**
```bash
# Check if process is running
ps aux | grep Obscur

# Kill if stuck
killall Obscur

# Check logs
~/Library/Logs/app.obscur.desktop/
```

**Linux:**
```bash
# Run from terminal to see errors
./Obscur_*.AppImage

# Check logs
~/.local/share/app.obscur.desktop/logs/
```

#### Problem: App crashes on startup
**Symptoms:**
- App opens then immediately closes
- Error dialog appears

**Solution:**
1. Check system requirements:
   - Windows 10/11
   - macOS 10.13+
   - Linux with GTK 3.0+

2. Check dependencies:
   ```bash
   # Linux only
   ldd Obscur_*.AppImage
   ```

3. Clear app data:
   ```bash
   # Windows
   rmdir /s "%APPDATA%\app.obscur.desktop"
   
   # macOS
   rm -rf ~/Library/Application\ Support/app.obscur.desktop
   
   # Linux
   rm -rf ~/.local/share/app.obscur.desktop
   ```

4. Reinstall the app

#### Problem: White screen on launch
**Symptoms:**
- App window opens
- Shows blank white screen
- No content loads

**Solution:**
1. Wait 30 seconds (might be loading)
2. Check internet connection
3. Check if remote URL is accessible
4. Clear cache and restart
5. Check browser console (Ctrl+Shift+I)

### 4. Messaging Issues

#### Problem: Can't send messages
**Symptoms:**
- Messages stuck in "Sending..."
- Error: "Failed to send"

**Solution:**
1. Check relay connection status
2. Check internet connection
3. Try different relay:
   - Go to Settings
   - Add relay: wss://relay.damus.io
   - Try sending again

4. Check firewall:
   - Allow WebSocket connections
   - Allow ports 80, 443

5. Restart app

#### Problem: Messages not received
**Symptoms:**
- Friend sent message
- You don't see it

**Solution:**
1. Check if you're connected to same relay
2. Wait 30 seconds (might be syncing)
3. Restart app
4. Check if friend's message actually sent
5. Verify you accepted each other's invites

#### Problem: Messages out of order
**Symptoms:**
- Messages appear in wrong order
- Timestamps incorrect

**Solution:**
1. Check system time is correct
2. Restart app
3. This might be a bug - report it!

#### Problem: Old messages missing
**Symptoms:**
- Messages from yesterday gone
- Only recent messages show

**Solution:**
1. Check if data was cleared
2. Check storage location:
   ```bash
   # Windows
   %APPDATA%\app.obscur.desktop
   
   # macOS
   ~/Library/Application Support/app.obscur.desktop
   
   # Linux
   ~/.local/share/app.obscur.desktop
   ```

3. This might be a bug - report it!

### 5. Connection Issues

#### Problem: "Disconnected" status
**Symptoms:**
- Red indicator
- "Disconnected from relays"

**Solution:**
1. Check internet connection
2. Check relay status:
   - Try: https://nostr.watch
   - See if relays are online

3. Try different relay:
   - wss://relay.damus.io
   - wss://nos.lol
   - wss://relay.nostr.band

4. Check firewall/proxy settings

#### Problem: Frequent disconnections
**Symptoms:**
- Connects then disconnects
- Unstable connection

**Solution:**
1. Check network stability
2. Try wired connection instead of WiFi
3. Disable VPN temporarily
4. Try different relay
5. Check if ISP blocks WebSockets

#### Problem: Can't add custom relay
**Symptoms:**
- Error when adding relay
- Relay doesn't connect

**Solution:**
1. Verify relay URL format:
   - Must start with `wss://`
   - Example: `wss://relay.example.com`

2. Test relay in browser:
   - Open browser console
   - Try: `new WebSocket('wss://relay.example.com')`

3. Check if relay is online

### 6. Performance Issues

#### Problem: High memory usage
**Symptoms:**
- App uses > 500MB RAM
- Computer slows down

**Solution:**
1. Check how many messages in history
2. Restart app
3. Close other apps
4. Check for memory leaks:
   ```bash
   node test-performance.js
   ```

5. This might be a bug - report it!

#### Problem: Slow startup
**Symptoms:**
- Takes > 10 seconds to start
- Loading screen hangs

**Solution:**
1. Check system resources
2. Close other apps
3. Check if antivirus is scanning
4. Try on SSD instead of HDD
5. Check startup time:
   ```bash
   node test-performance.js
   ```

#### Problem: UI freezes
**Symptoms:**
- App becomes unresponsive
- Can't click buttons

**Solution:**
1. Wait 10 seconds
2. Check CPU usage
3. Restart app
4. This is likely a bug - report it!

### 7. Update Issues

#### Problem: Update check fails
**Symptoms:**
- "Failed to check for updates"
- Update notification doesn't appear

**Solution:**
1. Check internet connection
2. Check GitHub is accessible
3. Verify update endpoint in config
4. This is expected if no releases yet

#### Problem: Update download fails
**Symptoms:**
- Update starts downloading
- Fails partway through

**Solution:**
1. Check internet connection
2. Check available disk space
3. Try again later
4. Download manually from GitHub

### 8. Data Issues

#### Problem: Identity lost
**Symptoms:**
- App asks to create new identity
- Previous identity gone

**Solution:**
1. Check if you have backup
2. Check data directory:
   ```bash
   # Windows
   %APPDATA%\app.obscur.desktop
   
   # macOS
   ~/Library/Application Support/app.obscur.desktop
   
   # Linux
   ~/.local/share/app.obscur.desktop
   ```

3. If data exists, might be corruption
4. Restore from backup if available

**Prevention:**
- Always backup identity
- Export private key regularly

#### Problem: Contacts disappeared
**Symptoms:**
- Contact list empty
- Had contacts before

**Solution:**
1. Restart app
2. Check data directory
3. Re-add contacts if needed
4. This is a bug - report it!

### 9. UI Issues

#### Problem: Text too small/large
**Symptoms:**
- Can't read text
- UI elements wrong size

**Solution:**
1. Check system display scaling
2. Adjust window size
3. Check if theme affects it
4. Report as accessibility issue

#### Problem: Dark mode not working
**Symptoms:**
- Stuck in light mode
- Theme toggle doesn't work

**Solution:**
1. Check system theme settings
2. Try manual toggle in app
3. Restart app
4. Check theme persistence

#### Problem: Layout broken
**Symptoms:**
- Elements overlapping
- Scrollbars missing
- Content cut off

**Solution:**
1. Resize window
2. Restart app
3. Check window size limits
4. Report with screenshot

### 10. Testing-Specific Issues

#### Problem: Can't connect with friend
**Symptoms:**
- Both online
- Can't see each other's messages

**Solution:**
1. Verify both using same relay
2. Check both accepted invites
3. Check both have internet
4. Try creating new invite
5. Check relay connection status

#### Problem: Different behavior on different platforms
**Symptoms:**
- Works on Windows, not macOS
- Features missing on Linux

**Solution:**
1. This is expected during testing
2. Document platform differences
3. Test on all target platforms
4. Report platform-specific bugs

## Debugging Tools

### Enable Debug Mode

**Windows:**
```bash
# Set environment variable
set RUST_LOG=debug
obscur-desktop.exe
```

**macOS/Linux:**
```bash
# Set environment variable
RUST_LOG=debug ./Obscur
```

### Check Logs

**Windows:**
```bash
# View logs
type "%APPDATA%\app.obscur.desktop\logs\app.log"
```

**macOS:**
```bash
# View logs
cat ~/Library/Logs/app.obscur.desktop/app.log
```

**Linux:**
```bash
# View logs
cat ~/.local/share/app.obscur.desktop/logs/app.log
```

### Browser DevTools

Press `Ctrl+Shift+I` (or `Cmd+Option+I` on macOS) to open DevTools:
- **Console:** See JavaScript errors
- **Network:** See relay connections
- **Application:** See stored data
- **Performance:** Profile performance

### Network Debugging

Test relay connection:
```bash
# Install websocat
# Then test relay
websocat wss://relay.damus.io

# Should connect and stay open
# Press Ctrl+C to exit
```

## Getting Help

### Before Asking for Help

1. Check this troubleshooting guide
2. Check logs for errors
3. Try basic solutions (restart, reinstall)
4. Document the issue clearly

### When Reporting Issues

Include:
1. **Platform:** Windows/macOS/Linux version
2. **App Version:** Check in About section
3. **Steps to Reproduce:** Exact steps
4. **Expected Behavior:** What should happen
5. **Actual Behavior:** What actually happens
6. **Logs:** Relevant log entries
7. **Screenshots:** If applicable

### Where to Get Help

1. **GitHub Issues:** For bugs and feature requests
2. **Documentation:** Check all .md files in apps/desktop
3. **Community:** If you have a community channel
4. **Direct Contact:** For private/security issues

## Prevention Tips

### Before Testing
- [ ] Backup your data
- [ ] Test on clean system if possible
- [ ] Document your test plan
- [ ] Have rollback plan

### During Testing
- [ ] Take notes of issues
- [ ] Screenshot errors
- [ ] Test one thing at a time
- [ ] Don't skip steps

### After Testing
- [ ] Document all findings
- [ ] Prioritize issues
- [ ] Plan fixes
- [ ] Retest after fixes

## Emergency Procedures

### If App is Completely Broken

1. **Stop using it immediately**
2. **Backup any data you can access**
3. **Document what happened**
4. **Uninstall the app**
5. **Report the issue**
6. **Wait for fix before retesting**

### If Data is Lost

1. **Don't panic**
2. **Check backups**
3. **Check data directory**
4. **Don't reinstall yet** (might overwrite)
5. **Contact for help**

### If Security Issue Found

1. **Stop using immediately**
2. **Document privately**
3. **Report privately** (not public GitHub)
4. **Don't share details publicly**
5. **Wait for fix**

---

**Remember:** Finding issues during testing is GOOD! That's the whole point. Every issue you find and fix now is one less issue your users will experience.

**Still stuck?** Create a detailed issue report and we'll help you debug it!
