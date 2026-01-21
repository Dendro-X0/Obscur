# Obscur Desktop Installation Guide

Welcome to Obscur Desktop! This guide will help you install and set up the Obscur desktop application on your computer.

## System Requirements

### Windows
- **Operating System**: Windows 10 or later (64-bit)
- **RAM**: 4 GB minimum, 8 GB recommended
- **Disk Space**: 200 MB for installation
- **Display**: 1024x768 minimum resolution
- **Internet**: Required for initial setup and messaging

### macOS
- **Operating System**: macOS 10.13 (High Sierra) or later
- **RAM**: 4 GB minimum, 8 GB recommended
- **Disk Space**: 200 MB for installation
- **Display**: 1024x768 minimum resolution
- **Internet**: Required for initial setup and messaging
- **Architecture**: Supports both Intel and Apple Silicon (M1/M2/M3)

### Linux
- **Operating System**: Ubuntu 20.04+ or equivalent (Debian, Fedora, Arch)
- **RAM**: 4 GB minimum, 8 GB recommended
- **Disk Space**: 200 MB for installation
- **Display**: 1024x768 minimum resolution
- **Internet**: Required for initial setup and messaging
- **Dependencies**: webkit2gtk, gtk3 (usually pre-installed)

## Downloading Obscur Desktop

### Official Download Sources

1. **GitHub Releases** (Recommended)
   - Visit: https://github.com/obscur-app/obscur/releases
   - Download the latest version for your platform
   - All releases are digitally signed for security

2. **Official Website**
   - Visit: https://obscur.app/download
   - Automatic platform detection
   - Direct download links

### Choosing the Right Installer

#### Windows
- **MSI Installer** (`Obscur_x.x.x_x64_en-US.msi`)
  - Recommended for enterprise/corporate environments
  - Supports silent installation
  - Integrates with Windows Installer
  
- **NSIS Installer** (`Obscur_x.x.x_x64-setup.exe`)
  - Recommended for individual users
  - Smaller download size
  - Customizable installation options

#### macOS
- **DMG Bundle** (`Obscur_x.x.x_x64.dmg`)
  - Universal installer for all macOS versions
  - Supports both Intel and Apple Silicon
  - Drag-and-drop installation

#### Linux
- **AppImage** (`Obscur_x.x.x_amd64.AppImage`)
  - Recommended for most users
  - Works on all distributions
  - No installation required (portable)
  
- **DEB Package** (`Obscur_x.x.x_amd64.deb`)
  - For Debian/Ubuntu-based systems
  - Integrates with system package manager
  - Automatic updates through apt

## Installation Instructions

### Windows Installation

#### Using MSI Installer

1. **Download** the MSI installer from the releases page
2. **Double-click** the downloaded `.msi` file
3. **Security Warning**: If you see a SmartScreen warning:
   - Click "More info"
   - Click "Run anyway"
   - This is normal for new applications
4. **Follow the installer wizard**:
   - Accept the license agreement
   - Choose installation location (default recommended)
   - Select "Install for all users" or "Install for current user"
5. **Click "Install"** and wait for completion
6. **Launch Obscur** from the Start Menu or desktop shortcut

#### Using NSIS Installer

1. **Download** the NSIS installer from the releases page
2. **Double-click** the downloaded `.exe` file
3. **Security Warning**: If you see a SmartScreen warning:
   - Click "More info"
   - Click "Run anyway"
4. **Follow the installation wizard**:
   - Choose installation directory
   - Select components (default recommended)
   - Choose Start Menu folder
   - Select desktop shortcut option
5. **Click "Install"** and wait for completion
6. **Launch Obscur** from the Start Menu or desktop shortcut

#### Silent Installation (MSI)

For automated deployment:

```cmd
msiexec /i Obscur_x.x.x_x64_en-US.msi /quiet /qn /norestart
```

### macOS Installation

1. **Download** the DMG file from the releases page
2. **Open** the downloaded `.dmg` file
3. **Security Check**: If you see "cannot be opened because it is from an unidentified developer":
   - Right-click (or Control-click) the DMG file
   - Select "Open" from the menu
   - Click "Open" in the dialog
   - This is only needed the first time
4. **Drag** the Obscur app icon to the Applications folder
5. **Eject** the DMG by dragging it to the Trash
6. **Launch Obscur** from Applications folder or Spotlight

#### First Launch on macOS

When launching for the first time:
1. Open **Applications** folder
2. **Right-click** Obscur and select "Open"
3. Click "Open" in the security dialog
4. Subsequent launches can be done normally

#### Gatekeeper Issues

If macOS blocks the app:
1. Open **System Preferences** → **Security & Privacy**
2. Click the **General** tab
3. Click **"Open Anyway"** next to the Obscur message
4. Enter your password if prompted

### Linux Installation

#### Using AppImage (Recommended)

1. **Download** the AppImage file from the releases page
2. **Make it executable**:
   ```bash
   chmod +x Obscur_x.x.x_amd64.AppImage
   ```
3. **Run the application**:
   ```bash
   ./Obscur_x.x.x_amd64.AppImage
   ```
4. **Optional**: Integrate with system menu:
   - Right-click the AppImage
   - Select "Integrate and run"
   - Or use AppImageLauncher for automatic integration

#### Using DEB Package (Debian/Ubuntu)

1. **Download** the DEB package from the releases page
2. **Install using dpkg**:
   ```bash
   sudo dpkg -i Obscur_x.x.x_amd64.deb
   ```
3. **Fix dependencies** (if needed):
   ```bash
   sudo apt-get install -f
   ```
4. **Launch from application menu** or run:
   ```bash
   obscur
   ```

#### Installing Dependencies (if needed)

If you encounter missing dependencies:

**Ubuntu/Debian**:
```bash
sudo apt-get update
sudo apt-get install -y libwebkit2gtk-4.0-37 libgtk-3-0 libappindicator3-1
```

**Fedora**:
```bash
sudo dnf install webkit2gtk3 gtk3
```

**Arch Linux**:
```bash
sudo pacman -S webkit2gtk gtk3
```

## First-Time Setup

After installation, follow these steps to set up Obscur:

1. **Launch the application**
2. **Create or Import Identity**:
   - Create a new identity with a passphrase
   - Or import an existing Nostr key
3. **Configure Relays**:
   - Default relays are pre-configured
   - Add custom relays if needed
4. **Set Up Profile**:
   - Add display name and avatar (optional)
   - Configure notification preferences
5. **Start Messaging**:
   - Create or join invite-only communities
   - Send direct messages to contacts

## Verification and Security

### Verifying Downloads

#### Windows
Check the digital signature:
1. Right-click the installer file
2. Select "Properties"
3. Go to "Digital Signatures" tab
4. Verify the signature is from "Obscur" or the official publisher

#### macOS
Check code signature:
```bash
codesign -dv --verbose=4 /Applications/Obscur.app
```

Look for "Developer ID Application" in the output.

#### Linux
Verify checksums (SHA256):
```bash
sha256sum Obscur_x.x.x_amd64.AppImage
```

Compare with the checksum provided in the release notes.

### Security Best Practices

1. **Download from official sources only**
   - GitHub Releases: https://github.com/obscur-app/obscur/releases
   - Official website: https://obscur.app

2. **Verify digital signatures**
   - All official releases are signed
   - Check signatures before installation

3. **Keep your passphrase secure**
   - Use a strong, unique passphrase
   - Store it in a password manager
   - Never share it with anyone

4. **Enable automatic updates**
   - Keep the app updated for security patches
   - Updates are verified with cryptographic signatures

## Updating Obscur Desktop

### Automatic Updates (Recommended)

Obscur Desktop includes an automatic update system:

1. **Update notifications** appear when new versions are available
2. **Click "Install Update"** to download and install
3. **App restarts** automatically with the new version
4. **No data loss** - all your messages and settings are preserved

### Manual Updates

If automatic updates are disabled:

1. **Download** the latest version from GitHub Releases
2. **Install** over the existing installation
3. **No need to uninstall** the old version first
4. **Your data is preserved** during the update

### Checking for Updates

To manually check for updates:
1. Open **Settings** in the app
2. Navigate to **Desktop Updates** section
3. Click **"Check for Updates"**
4. Follow prompts if an update is available

## Uninstalling Obscur Desktop

### Windows

#### Using Control Panel
1. Open **Control Panel** → **Programs** → **Programs and Features**
2. Find **Obscur** in the list
3. Click **Uninstall** and follow the prompts

#### Using Settings
1. Open **Settings** → **Apps** → **Apps & features**
2. Find **Obscur** in the list
3. Click **Uninstall** and confirm

### macOS

1. Open **Applications** folder
2. **Drag Obscur** to the Trash
3. **Empty Trash** to complete removal

To remove all data:
```bash
rm -rf ~/Library/Application\ Support/app.obscur.desktop
```

### Linux

#### AppImage
Simply delete the AppImage file:
```bash
rm Obscur_x.x.x_amd64.AppImage
```

#### DEB Package
```bash
sudo apt-get remove obscur
```

To remove all data:
```bash
rm -rf ~/.config/app.obscur.desktop
```

## Troubleshooting

### Installation Issues

#### Windows: "Windows protected your PC" warning
**Solution**: This is SmartScreen protection for new apps
1. Click "More info"
2. Click "Run anyway"
3. The app is safe - this warning appears for new publishers

#### Windows: "The app can't run on your PC"
**Solution**: You may have downloaded the wrong architecture
- Ensure you downloaded the 64-bit version
- Windows 10/11 64-bit is required

#### macOS: "Obscur is damaged and can't be opened"
**Solution**: This is a Gatekeeper security feature
1. Open Terminal
2. Run: `xattr -cr /Applications/Obscur.app`
3. Try launching again

#### macOS: "Obscur cannot be opened because the developer cannot be verified"
**Solution**: 
1. Right-click the app and select "Open"
2. Click "Open" in the dialog
3. Or go to System Preferences → Security & Privacy → Click "Open Anyway"

#### Linux: "Permission denied" when running AppImage
**Solution**: Make the file executable
```bash
chmod +x Obscur_x.x.x_amd64.AppImage
```

#### Linux: Missing dependencies error
**Solution**: Install required libraries
```bash
# Ubuntu/Debian
sudo apt-get install -y libwebkit2gtk-4.0-37 libgtk-3-0

# Fedora
sudo dnf install webkit2gtk3 gtk3

# Arch
sudo pacman -S webkit2gtk gtk3
```

### Runtime Issues

#### App won't start or crashes on launch
**Solutions**:
1. **Check system requirements** - ensure your OS version is supported
2. **Restart your computer** - clears temporary issues
3. **Reinstall the app** - fixes corrupted installations
4. **Check antivirus** - temporarily disable to test
5. **Review logs** - see "Getting Help" section below

#### App is slow or unresponsive
**Solutions**:
1. **Close other applications** - free up system resources
2. **Check internet connection** - required for messaging
3. **Clear app cache** - Settings → Advanced → Clear Cache
4. **Restart the app** - resolves temporary issues

#### Can't connect to relays
**Solutions**:
1. **Check internet connection** - ensure you're online
2. **Check firewall** - allow Obscur through firewall
3. **Try different relays** - Settings → Relays → Add Relay
4. **Check relay status** - some relays may be temporarily down

#### Messages not sending
**Solutions**:
1. **Check connection status** - look for connection indicator
2. **Wait for sync** - messages send when connection is restored
3. **Check relay configuration** - ensure at least one relay is connected
4. **Restart the app** - re-establishes connections

### Update Issues

#### Update check fails
**Solutions**:
1. **Check internet connection** - updates require network access
2. **Check firewall** - allow GitHub access
3. **Manual update** - download from GitHub Releases
4. **Check for proxy issues** - configure proxy if needed

#### Update download fails
**Solutions**:
1. **Check disk space** - ensure sufficient space for download
2. **Retry the update** - temporary network issues
3. **Manual update** - download and install manually
4. **Check antivirus** - may block downloads

#### Update installation fails
**Solutions**:
1. **Close the app completely** - ensure no processes running
2. **Run as administrator** (Windows) - may need elevated permissions
3. **Check disk space** - ensure sufficient space
4. **Manual update** - download and install manually

## Data and Privacy

### Where is my data stored?

#### Windows
```
C:\Users\<YourUsername>\AppData\Roaming\app.obscur.desktop
```

#### macOS
```
~/Library/Application Support/app.obscur.desktop
```

#### Linux
```
~/.config/app.obscur.desktop
```

### What data is stored locally?

- **Identity keys** (encrypted with your passphrase)
- **Message history** (encrypted)
- **Contact list** (encrypted)
- **App preferences and settings**
- **Relay configuration**

### Is my data backed up?

- **Local storage only** - data is not automatically backed up
- **Export your identity** - Settings → Identity → Export Keys
- **Store passphrase securely** - use a password manager
- **Manual backups** - copy the data directory if needed

### Can I use Obscur on multiple devices?

Yes! You can:
1. **Export your identity** from one device
2. **Import it** on another device
3. **Use the same identity** across devices
4. **Messages sync** through Nostr relays

## Getting Help

### Documentation

- **User Guide**: https://docs.obscur.app
- **FAQ**: https://obscur.app/faq
- **GitHub Issues**: https://github.com/obscur-app/obscur/issues

### Support Channels

- **GitHub Discussions**: https://github.com/obscur-app/obscur/discussions
- **Community Chat**: Join via the app
- **Email Support**: support@obscur.app

### Reporting Issues

When reporting issues, please include:

1. **Operating System** and version
2. **Obscur version** (Help → About)
3. **Steps to reproduce** the issue
4. **Error messages** or screenshots
5. **Log files** (see below)

### Finding Log Files

#### Windows
```
C:\Users\<YourUsername>\AppData\Roaming\app.obscur.desktop\logs
```

#### macOS
```
~/Library/Logs/app.obscur.desktop
```

#### Linux
```
~/.config/app.obscur.desktop/logs
```

## Additional Resources

- **Official Website**: https://obscur.app
- **GitHub Repository**: https://github.com/obscur-app/obscur
- **Documentation**: https://docs.obscur.app
- **Release Notes**: https://github.com/obscur-app/obscur/releases
- **Community**: https://github.com/obscur-app/obscur/discussions

## License

Obscur Desktop is open-source software. See the LICENSE file in the repository for details.

---

**Welcome to Obscur!** We hope you enjoy using the desktop application. If you have any questions or feedback, please don't hesitate to reach out through our support channels.
