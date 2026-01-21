# Quick Start - Test with Your Friend in 30 Minutes

## 🚀 Fastest Path to Testing

### 1️⃣ Build (5 minutes)
```bash
cd apps/desktop
pnpm build
```
Wait for "Build completed successfully!"

### 2️⃣ Find Installer (1 minute)
```bash
# Your installer is here:
cd src-tauri/target/release/bundle

# Windows: Look in msi/ or nsis/ folder
# macOS: Look in dmg/ folder  
# Linux: Look in appimage/ folder
```

### 3️⃣ Share (2 minutes)
1. Upload installer to Google Drive, Dropbox, or WeTransfer
2. Copy this message and send to your friend:

```
Hey! Want to test Obscur with me?

Download: [YOUR LINK HERE]

Installation:
- Windows: Download .msi, double-click, click "Run anyway" if warned
- macOS: Download .dmg, drag to Applications, right-click → Open
- Linux: Download .AppImage, chmod +x it, then run

Let me know when you're ready!
```

### 4️⃣ Test Together (20 minutes)

#### Test 1: Connect (5 min)
1. Both: Open app, create identity
2. You: Go to Invites → Create invite link → Send to friend
3. Friend: Paste link → Accept invite
4. Both: Go to Messages → Send messages back and forth

✅ **Success:** You can see each other's messages

#### Test 2: Offline (5 min)
1. You: Disconnect internet
2. Friend: Send you 3 messages
3. You: Reconnect internet
4. You: Check if messages appear

✅ **Success:** All messages sync when reconnected

#### Test 3: Restart (5 min)
1. Both: Close app completely
2. Both: Reopen app
3. Both: Check messages are still there
4. Both: Send new messages

✅ **Success:** Everything persists and still works

#### Test 4: Various Content (5 min)
Send these messages:
- "Hi!" (short)
- [Paste a paragraph] (long)
- "Hello! 👋 🎉" (emojis)
- "https://example.com" (link)

✅ **Success:** All display correctly

### 5️⃣ Quick Feedback (2 minutes)

Ask your friend:
- ✅ Did it work?
- ⚠️ Any issues?
- 💡 Any suggestions?

## 🎯 Decision Time

### ✅ All Tests Passed?
**You're ready to release!**

Next steps:
1. Update version number
2. Create GitHub release
3. Share with more people

### ❌ Found Issues?
**That's okay! That's why we test.**

Next steps:
1. Write down the issues
2. Fix critical bugs
3. Rebuild and test again

## 🆘 Quick Troubleshooting

### App won't install
- Windows: Click "More info" → "Run anyway"
- macOS: Right-click → Open → Confirm
- Linux: `chmod +x Obscur*.AppImage`

### Can't connect
- Check internet connection
- Check firewall settings
- Try different relay in Settings

### Messages not sending
- Wait 10 seconds
- Check relay connection status
- Restart app

### App crashes
- Check system requirements
- Clear app data and reinstall
- Report the bug

## 📚 Need More Help?

- **Quick testing:** QUICK_TEST_GUIDE.md
- **Thorough testing:** PRE_RELEASE_CHECKLIST.md
- **Troubleshooting:** TESTING_TROUBLESHOOTING.md
- **Overview:** RELEASE_READY_SUMMARY.md

## ⏱️ Time Breakdown

- Build: 5 min
- Share: 2 min
- Test: 20 min
- Feedback: 2 min
- **Total: 30 minutes**

## 💡 Pro Tips

1. **Use video call** - Test together on Zoom/Discord
2. **Screen share** - See issues in real-time
3. **Take notes** - Document what you find
4. **Be patient** - First test always finds issues
5. **Have fun** - You're building something cool!

## ✨ That's It!

You now have everything you need to test with your friend. Just follow the 5 steps above and you'll know if your app is ready to release.

**Good luck! 🚀**

---

**Questions?** Check RELEASE_READY_SUMMARY.md for detailed guidance.
