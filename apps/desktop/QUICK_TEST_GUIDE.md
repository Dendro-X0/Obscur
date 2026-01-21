# Quick Test Guide - Testing with a Friend

## TL;DR - Fastest Path to Testing

**Time Required:** ~30 minutes

### Step 1: Build (5 minutes)
```bash
cd apps/desktop
pnpm build
```

### Step 2: Find Your Installer (1 minute)
```bash
# Windows: Look for .msi or .exe in:
src-tauri/target/release/bundle/msi/ or bundle/nsis/

# macOS: Look for .dmg in:
src-tauri/target/release/bundle/dmg/

# Linux: Look for .AppImage in:
src-tauri/target/release/bundle/appimage/
```

### Step 3: Share with Friend (2 minutes)
- Upload installer to file sharing service (Google Drive, Dropbox, etc.)
- Send link to friend with installation instructions below

### Step 4: Both Install and Test (20 minutes)
1. Install the app
2. Create identities
3. Exchange invite links
4. Send messages back and forth
5. Test basic features

## Installation Instructions for Your Friend

### Windows
1. Download the `.msi` file
2. Double-click to install
3. If you see "Windows protected your PC":
   - Click "More info"
   - Click "Run anyway"
4. Follow installation wizard
5. Launch Obscur from Start Menu

### macOS
1. Download the `.dmg` file
2. Open the DMG file
3. Drag Obscur to Applications folder
4. If you see "cannot be opened because it is from an unidentified developer":
   - Right-click the app
   - Select "Open"
   - Click "Open" in the dialog
5. Launch Obscur from Applications

### Linux
1. Download the `.AppImage` file
2. Make it executable:
   ```bash
   chmod +x Obscur_*.AppImage
   ```
3. Run it:
   ```bash
   ./Obscur_*.AppImage
   ```

## Quick Test Scenarios

### Test 1: Basic Connection (5 minutes)
**Goal:** Verify you can connect and message each other

1. **Both:** Launch app and create identity
2. **Person A:** 
   - Go to Invites page
   - Create an invite link
   - Copy and send to Person B
3. **Person B:**
   - Paste invite link in browser or app
   - Accept the invite
4. **Both:**
   - Go to Messages
   - Find each other in contacts
   - Send messages back and forth

**Success Criteria:**
- ✅ Both can see each other's messages
- ✅ Messages appear in real-time
- ✅ No errors or crashes

### Test 2: Offline/Online (5 minutes)
**Goal:** Verify messages work when going offline

1. **Person A:** Disconnect from internet
2. **Person B:** Send 3 messages to Person A
3. **Person A:** Reconnect to internet
4. **Person A:** Check if messages appear

**Success Criteria:**
- ✅ Messages sync when reconnected
- ✅ No messages lost
- ✅ Correct order maintained

### Test 3: App Restart (3 minutes)
**Goal:** Verify data persists

1. **Both:** Close the app completely
2. **Both:** Reopen the app
3. **Both:** Check messages and contacts

**Success Criteria:**
- ✅ All messages still there
- ✅ Contacts still there
- ✅ Can send new messages

### Test 4: Multiple Messages (5 minutes)
**Goal:** Verify app handles various content

**Send these types of messages:**
- Short message: "Hi!"
- Long message: (paste a paragraph)
- Special characters: "Hello! 👋 How are you? 🎉"
- Numbers: "123456789"
- Links: "Check this out: https://example.com"

**Success Criteria:**
- ✅ All messages display correctly
- ✅ No formatting issues
- ✅ Emojis work

## What to Look For

### Good Signs ✅
- App launches quickly (< 5 seconds)
- Messages send instantly
- UI is responsive
- No error messages
- Memory usage stays reasonable
- App feels smooth

### Warning Signs ⚠️
- Slow startup (> 10 seconds)
- Messages delayed (> 5 seconds)
- UI freezes or lags
- High memory usage (> 500MB)
- Frequent disconnections

### Critical Issues ❌
- App crashes
- Messages don't send at all
- Can't create identity
- Data loss after restart
- Security errors

## Quick Feedback Form

After testing, answer these questions:

### Installation
- Was it easy to install? (Yes/No)
- Any confusing steps?
- Any errors during installation?

### First Impression
- How long did it take to start? (seconds)
- Was it clear what to do first?
- Any confusing UI elements?

### Messaging
- Did messages send reliably? (Yes/No)
- How fast were messages? (Instant/Slow/Very Slow)
- Any messages lost?

### Overall
- Would you use this app? (Yes/No/Maybe)
- What did you like?
- What needs improvement?
- Any bugs or crashes?

## Reporting Issues

If you find a bug, note:
1. **What you did:** Step-by-step actions
2. **What happened:** The actual result
3. **What you expected:** What should have happened
4. **Screenshots:** If applicable
5. **Platform:** Windows/macOS/Linux version

**Example:**
```
Bug: Messages not sending

Steps:
1. Opened app
2. Went to Messages
3. Typed "Hello"
4. Clicked Send

Expected: Message should send
Actual: Message stuck in "Sending..." state

Platform: Windows 11
```

## Alternative: GitHub Release Method

If you want a more official release:

### 1. Create Release
```bash
# Commit changes
git add .
git commit -m "Release v0.3.0-test"

# Create tag
git tag v0.3.0-test
git push origin v0.3.0-test
```

### 2. Wait for Build
- Go to GitHub Actions
- Wait for build to complete (~20 minutes)
- Check Releases page

### 3. Share Release Link
- Send GitHub release URL to friend
- They download directly from GitHub
- More professional and easier to track

## Tips for Smooth Testing

1. **Use Video Call:** Test together on a call so you can see issues in real-time
2. **Screen Share:** Share screens to debug issues together
3. **Take Notes:** Keep a shared document of findings
4. **Be Patient:** First test always finds issues - that's good!
5. **Have Fun:** You're building something cool together!

## Common First-Time Issues

### "App won't open"
**Try:**
- Right-click → Open (macOS)
- Run as Administrator (Windows)
- Check antivirus isn't blocking it

### "Can't connect to relays"
**Try:**
- Check internet connection
- Check firewall settings
- Try different relay in settings

### "Messages not appearing"
**Try:**
- Wait 10 seconds (might be syncing)
- Check relay connection status
- Restart app

### "App is slow"
**Try:**
- Close other apps
- Restart computer
- Check available RAM

## After Testing

### If Everything Works ✅
Great! You're ready to:
- Share with more people
- Create official release
- Announce to community

### If Issues Found ⚠️
That's okay! You should:
- Document all issues
- Prioritize critical bugs
- Fix and test again
- Don't release until stable

### Next Steps
1. Review feedback together
2. Decide what to fix now vs later
3. Plan next test session
4. Iterate until ready

---

**Remember:** The goal is to find issues BEFORE releasing to more people. Every bug you find now is one less bug your users will experience!

**Questions?** Check the full PRE_RELEASE_CHECKLIST.md for detailed guidance.
