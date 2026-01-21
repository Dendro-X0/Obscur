# Migrating from PWA to Desktop App

This guide helps you transition from using Obscur as a Progressive Web App (PWA) in your browser to using the native desktop application.

## Table of Contents

- [Why Migrate to Desktop?](#why-migrate-to-desktop)
- [Feature Comparison](#feature-comparison)
- [Migration Process](#migration-process)
- [Data Synchronization](#data-synchronization)
- [Using Both Versions](#using-both-versions)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)

## Why Migrate to Desktop?

### Benefits of the Desktop App

The desktop application offers several advantages over the PWA:

**Performance**
- Faster startup and response times
- Better memory management
- Optimized for desktop hardware
- Native rendering engine

**Native Features**
- System notifications (even when app is closed)
- Better offline support
- Native window controls
- System tray integration
- Keyboard shortcuts
- Deep link handling

**User Experience**
- Dedicated app window (not a browser tab)
- Persistent state across restarts
- Better integration with your operating system
- Automatic updates
- No browser overhead

**Privacy and Security**
- Isolated from browser cookies and tracking
- Dedicated storage separate from browser
- Better control over permissions
- Code-signed and verified

### When to Use Each Version

**Use the Desktop App when**:
- You use Obscur frequently
- You want the best performance
- You need system notifications
- You prefer a dedicated app window
- You want automatic updates

**Use the PWA when**:
- You're on a shared or public computer
- You can't install applications
- You want to try Obscur without installing
- You're on an unsupported platform
- You prefer browser-based apps

## Feature Comparison

### Feature Parity Matrix

| Feature | PWA | Desktop | Notes |
|---------|-----|---------|-------|
| **Core Messaging** |
| Send/receive messages | ✅ | ✅ | Identical functionality |
| Direct messages | ✅ | ✅ | Identical functionality |
| Group chats | ✅ | ✅ | Identical functionality |
| Message encryption | ✅ | ✅ | Same encryption (NIP-04) |
| Message history | ✅ | ✅ | Synced via relays |
| **Identity & Contacts** |
| Create identity | ✅ | ✅ | Identical functionality |
| Import/export keys | ✅ | ✅ | Identical functionality |
| Contact management | ✅ | ✅ | Identical functionality |
| Profile settings | ✅ | ✅ | Identical functionality |
| **Invites & Discovery** |
| Create invite links | ✅ | ✅ | Identical functionality |
| QR code generation | ✅ | ✅ | Identical functionality |
| QR code scanning | ✅ | ✅ | Identical functionality |
| Contact requests | ✅ | ✅ | Identical functionality |
| **Relay Management** |
| Add/remove relays | ✅ | ✅ | Identical functionality |
| Relay health monitoring | ✅ | ✅ | Identical functionality |
| Custom relay configuration | ✅ | ✅ | Identical functionality |
| **Notifications** |
| In-app notifications | ✅ | ✅ | Identical functionality |
| System notifications | ⚠️ | ✅ | Desktop: Works when app closed |
| Notification preferences | ✅ | ✅ | Identical functionality |
| **Offline Support** |
| Offline message queue | ✅ | ✅ | Identical functionality |
| Service worker caching | ✅ | ✅ | Desktop: Better persistence |
| Background sync | ⚠️ | ✅ | Desktop: More reliable |
| **User Interface** |
| Responsive design | ✅ | ✅ | Identical UI |
| Dark/light theme | ✅ | ✅ | Desktop: System theme sync |
| Keyboard shortcuts | ⚠️ | ✅ | Desktop: More shortcuts |
| Window controls | ❌ | ✅ | Desktop: Native controls |
| **Updates** |
| Manual updates | ✅ | ❌ | PWA: Refresh browser |
| Automatic updates | ⚠️ | ✅ | Desktop: Built-in updater |
| Update notifications | ❌ | ✅ | Desktop only |
| **Platform Integration** |
| Deep links | ⚠️ | ✅ | Desktop: Better support |
| System tray | ❌ | 🔜 | Coming to desktop |
| File system access | ⚠️ | ✅ | Desktop: Better access |
| Clipboard integration | ✅ | ✅ | Identical functionality |

**Legend**:
- ✅ Fully supported
- ⚠️ Limited support
- ❌ Not supported
- 🔜 Coming soon

### What's the Same?

The following features work identically in both versions:

1. **All messaging functionality** - Send, receive, encrypt, decrypt
2. **Identity management** - Create, import, export keys
3. **Contact management** - Add, remove, organize contacts
4. **Relay connections** - Connect to same relays, same protocol
5. **User interface** - Same design, same layout, same features
6. **Data format** - Same encryption, same storage format

### What's Different?

The desktop app adds these enhancements:

1. **System Notifications**
   - PWA: Only when browser tab is open
   - Desktop: Even when app is closed or minimized

2. **Offline Support**
   - PWA: Limited by browser storage policies
   - Desktop: More reliable, persistent storage

3. **Performance**
   - PWA: Browser overhead, shared resources
   - Desktop: Dedicated process, optimized performance

4. **Updates**
   - PWA: Manual refresh required
   - Desktop: Automatic update system

5. **Window Management**
   - PWA: Browser tab, limited control
   - Desktop: Native window, full control

## Migration Process

### Overview

Migrating from PWA to desktop is simple because both versions use the same underlying data format and Nostr protocol. Your identity and messages are stored on Nostr relays, so they automatically sync between versions.

### Step-by-Step Migration

#### Option 1: Automatic Sync (Recommended)

This is the easiest method - your data syncs automatically through Nostr relays.

1. **Install the Desktop App**
   - Download from [GitHub Releases](https://github.com/obscur-app/obscur/releases)
   - Follow the [installation guide](./INSTALLATION.md)

2. **Import Your Identity**
   - Open the desktop app
   - Click "Import Identity"
   - Enter your private key or passphrase
   - Your identity is now available in the desktop app

3. **Wait for Sync**
   - The app will automatically connect to your relays
   - Message history will sync from relays
   - Contacts will sync from relays
   - This may take a few minutes depending on history size

4. **Verify Everything Works**
   - Check that your contacts appear
   - Verify message history is present
   - Send a test message
   - Check notifications work

5. **Continue Using PWA or Switch**
   - You can use both versions simultaneously
   - Or stop using the PWA and use desktop only
   - Your choice!

#### Option 2: Manual Export/Import

If you want to manually transfer your identity:

1. **Export from PWA**
   - Open Obscur PWA in your browser
   - Go to Settings → Identity
   - Click "Export Keys"
   - Save your private key securely (password manager recommended)
   - **⚠️ Warning**: Keep this key secret and secure!

2. **Install Desktop App**
   - Download and install the desktop app
   - Follow the [installation guide](./INSTALLATION.md)

3. **Import to Desktop**
   - Open the desktop app
   - Click "Import Identity"
   - Paste your private key
   - Enter a passphrase to encrypt it locally
   - Click "Import"

4. **Verify Import**
   - Check that your public key matches
   - Verify your profile information appears
   - Confirm relay connections are established

5. **Sync Data**
   - Wait for message history to sync from relays
   - Contacts will sync automatically
   - Verify everything is present

### Migration Checklist

Before migrating:

- [ ] **Backup your identity**
  - Export private key from PWA
  - Store in password manager
  - Write down recovery phrase (if using)

- [ ] **Note your relay configuration**
  - List of relays you're using
  - Any custom relay settings
  - Relay preferences

- [ ] **Document your settings**
  - Notification preferences
  - Theme preferences
  - Any custom configurations

After migrating:

- [ ] **Verify identity imported correctly**
  - Public key matches
  - Profile information correct
  - Can send/receive messages

- [ ] **Check relay connections**
  - All relays connected
  - Relay health is good
  - Messages syncing

- [ ] **Test core features**
  - Send a message
  - Receive a message
  - Create an invite link
  - Check notifications

- [ ] **Configure desktop-specific settings**
  - System notifications
  - Auto-start preferences
  - Keyboard shortcuts

## Data Synchronization

### How Sync Works

Obscur uses the Nostr protocol for data synchronization:

```
Your Data → Nostr Relays → All Your Devices
```

**What Gets Synced**:
- Message history (encrypted)
- Contact list
- Profile information
- Relay configuration
- Group memberships

**What Doesn't Sync**:
- Local app settings (theme, notifications)
- Local cache
- Temporary data

### Sync Process

1. **Identity-Based Sync**
   - Your identity (private key) is the source of truth
   - Same identity = same data across devices
   - Data is fetched from relays when you log in

2. **Real-Time Sync**
   - New messages sync immediately
   - Contact changes sync in real-time
   - Profile updates propagate to all devices

3. **Historical Sync**
   - When you first log in, app fetches history from relays
   - May take a few minutes for large histories
   - Progress indicator shows sync status

### Ensuring Successful Sync

**Before Migration**:
1. Ensure PWA is connected to relays
2. Wait for any pending messages to send
3. Verify all data is backed up to relays

**During Migration**:
1. Keep PWA open while desktop syncs (optional)
2. Ensure good internet connection
3. Wait for sync to complete before closing PWA

**After Migration**:
1. Verify all messages are present
2. Check that contacts are complete
3. Send a test message to confirm everything works

### Sync Troubleshooting

**Messages not appearing**:
- Check relay connections (Settings → Relays)
- Verify relays are online and responding
- Try adding additional relays
- Wait a few minutes for sync to complete

**Contacts missing**:
- Contacts are stored on relays
- May take time to sync from relays
- Check relay connections
- Verify you're using the same identity

**Old messages not syncing**:
- Relays may have retention limits
- Some relays only keep recent messages
- Consider using relays with longer retention
- Export important conversations for backup

## Using Both Versions

### Can I Use Both?

Yes! You can use both the PWA and desktop app simultaneously or interchangeably.

### Benefits of Using Both

1. **Flexibility**
   - Desktop at home/work
   - PWA on shared computers
   - Access from anywhere

2. **Redundancy**
   - Backup access if one fails
   - Test features in both versions
   - Compare performance

3. **Different Use Cases**
   - Desktop for primary use
   - PWA for quick access
   - Mobile PWA for on-the-go

### How to Use Both

**Same Identity**:
- Import the same private key in both versions
- Messages sync automatically via relays
- Contacts and profile stay in sync

**Different Identities**:
- Use different identities for different purposes
- Personal vs. work accounts
- Testing vs. production

### Best Practices

1. **Primary Device**
   - Choose one as your primary (usually desktop)
   - Use others as secondary access

2. **Sync Awareness**
   - Changes sync through relays
   - May take a few seconds to propagate
   - Don't make conflicting changes simultaneously

3. **Security**
   - Use strong passphrases on all devices
   - Log out of PWA on shared computers
   - Keep desktop app locked when away

4. **Updates**
   - Desktop updates automatically
   - PWA updates when you refresh browser
   - Keep both versions updated

## Troubleshooting

### Common Migration Issues

#### "Can't import my identity"

**Symptoms**:
- Import fails with error
- Private key not recognized
- Can't decrypt key

**Solutions**:
1. **Verify key format**:
   - Should be 64-character hex string
   - Or nsec1... format (Nostr format)
   - Check for extra spaces or characters

2. **Check passphrase**:
   - Ensure passphrase is correct
   - Try copying/pasting to avoid typos
   - Check for autocorrect issues

3. **Try different format**:
   - Export in different format from PWA
   - Try hex vs. nsec format
   - Use QR code if available

#### "Messages not syncing"

**Symptoms**:
- Desktop app shows no messages
- Message history incomplete
- New messages not appearing

**Solutions**:
1. **Check relay connections**:
   - Settings → Relays
   - Ensure at least one relay is connected
   - Try adding more relays

2. **Wait for sync**:
   - Initial sync can take several minutes
   - Check sync progress indicator
   - Don't close app during sync

3. **Verify identity**:
   - Ensure you imported correct private key
   - Check public key matches PWA
   - Verify profile information

4. **Check relay retention**:
   - Some relays delete old messages
   - Try relays with longer retention
   - Consider paid relays for better retention

#### "Contacts missing"

**Symptoms**:
- Contact list is empty
- Some contacts missing
- Contact information incomplete

**Solutions**:
1. **Wait for sync**:
   - Contacts sync from relays
   - May take a few minutes
   - Check relay connections

2. **Verify relay configuration**:
   - Ensure same relays as PWA
   - Check relay health
   - Try adding more relays

3. **Re-add contacts**:
   - If sync fails, manually re-add
   - Use invite links to reconnect
   - Contacts will sync going forward

#### "Desktop app slower than PWA"

**Symptoms**:
- Desktop app feels sluggish
- Longer startup time
- UI lag or delays

**Solutions**:
1. **Check system resources**:
   - Close other applications
   - Check available RAM
   - Monitor CPU usage

2. **Clear cache**:
   - Settings → Advanced → Clear Cache
   - Restart the app
   - Let it rebuild cache

3. **Update the app**:
   - Check for updates
   - Install latest version
   - Restart after update

4. **Check relay performance**:
   - Slow relays affect performance
   - Try different relays
   - Remove unresponsive relays

### Getting Help

If you encounter issues during migration:

1. **Check Documentation**:
   - [Installation Guide](./INSTALLATION.md)
   - [User Guide](https://docs.obscur.app)
   - [FAQ](https://obscur.app/faq)

2. **Search Issues**:
   - [GitHub Issues](https://github.com/obscur-app/obscur/issues)
   - Search for similar problems
   - Check closed issues for solutions

3. **Ask for Help**:
   - [GitHub Discussions](https://github.com/obscur-app/obscur/discussions)
   - Community chat (via the app)
   - Email support: support@obscur.app

4. **Report Bugs**:
   - Open a GitHub issue
   - Include error messages
   - Describe steps to reproduce
   - Mention OS and version

## FAQ

### General Questions

**Q: Will I lose my messages when migrating?**
A: No! Your messages are stored on Nostr relays and will sync to the desktop app automatically.

**Q: Do I need to uninstall the PWA?**
A: No, you can keep using both. The PWA and desktop app work together seamlessly.

**Q: Can I migrate back to PWA if I don't like desktop?**
A: Yes! Your identity works in both versions. Just import your key back into the PWA.

**Q: Will my contacts know I switched to desktop?**
A: No, it's transparent to them. You're using the same identity, so nothing changes from their perspective.

**Q: How long does migration take?**
A: Usually 5-10 minutes, depending on your message history size and internet speed.

### Technical Questions

**Q: Are the PWA and desktop app the same code?**
A: The desktop app uses the same PWA frontend but wraps it in a native application using Tauri.

**Q: Why is the desktop app larger than the PWA?**
A: The desktop app includes the entire runtime (Chromium-based webview) and native components, while the PWA uses your browser.

**Q: Can I use different identities in PWA and desktop?**
A: Yes! You can use different identities for different purposes or accounts.

**Q: Will desktop app work offline?**
A: Yes, both versions support offline mode. Messages queue and send when you're back online.

**Q: How do updates work differently?**
A: Desktop app has automatic updates with notifications. PWA updates when you refresh your browser.

### Data and Privacy

**Q: Where is my data stored in the desktop app?**
A: Locally on your computer in an encrypted database, separate from your browser data.

**Q: Is my data more secure in the desktop app?**
A: Both are secure, but desktop app is isolated from browser cookies and tracking.

**Q: Can I export my data from the desktop app?**
A: Yes, you can export your identity keys anytime from Settings → Identity.

**Q: What happens to my PWA data after migrating?**
A: It stays in your browser. You can clear it if you want, or keep using both versions.

**Q: Are my messages encrypted the same way?**
A: Yes, both versions use the same encryption (NIP-04) for messages.

### Features and Functionality

**Q: Does desktop app have features PWA doesn't?**
A: Yes, better system notifications, automatic updates, native window controls, and better offline support.

**Q: Will PWA get the same features as desktop?**
A: Some features are desktop-only due to platform limitations, but core messaging features are identical.

**Q: Can I use keyboard shortcuts in desktop app?**
A: Yes, desktop app has more keyboard shortcuts than PWA.

**Q: Does desktop app support all platforms?**
A: Yes, Windows, macOS, and Linux are all supported.

**Q: Can I customize the desktop app more than PWA?**
A: Both have the same customization options, but desktop has additional system integration settings.

## Next Steps

After successfully migrating:

1. **Explore Desktop Features**
   - Try keyboard shortcuts
   - Configure system notifications
   - Explore window management
   - Test offline functionality

2. **Optimize Your Setup**
   - Configure auto-start (if desired)
   - Set up notification preferences
   - Customize keyboard shortcuts
   - Configure relay preferences

3. **Share Feedback**
   - Report any issues you encounter
   - Suggest improvements
   - Help other users migrate
   - Contribute to documentation

4. **Stay Updated**
   - Enable automatic updates
   - Follow release announcements
   - Join community discussions
   - Read release notes

## Additional Resources

- **Installation Guide**: [INSTALLATION.md](./INSTALLATION.md)
- **User Documentation**: https://docs.obscur.app
- **GitHub Repository**: https://github.com/obscur-app/obscur
- **Community Chat**: Join via the app
- **Support Email**: support@obscur.app

---

**Welcome to Obscur Desktop!** We hope this guide helps you migrate smoothly. If you have questions or feedback, please reach out through our support channels.
