# Deployment Checklist

## Pre-Deployment Verification

### 1. Build & Test
- [ ] Production build completes without errors (`pnpm build:pwa`)
- [ ] No TypeScript errors (`pnpm typecheck`)
- [ ] All tests pass (if applicable)
- [ ] PWA manifest is correctly configured
- [ ] Service worker is working

### 2. Core Functionality
- [ ] Identity creation works
- [ ] Identity can be locked/unlocked with passphrase
- [ ] Public key can be copied/shared
- [ ] QR code generation works
- [ ] QR code scanning works (requires HTTPS or localhost)
- [ ] Invite links can be created
- [ ] Relay connections work
- [ ] Messages can be sent
- [ ] Messages can be received
- [ ] Notifications work (if enabled)

### 3. Relay Configuration
- [ ] Default relays are configured
- [ ] At least 2-3 public relays are in the default list
- [ ] Relay connection status is visible
- [ ] Users can add/remove relays

### 4. PWA Features
- [ ] App can be installed as PWA
- [ ] Offline functionality works
- [ ] App icons are correct
- [ ] Splash screen displays correctly

### 5. Security
- [ ] Private keys are encrypted with passphrase
- [ ] Private keys never leave the device
- [ ] HTTPS is enforced in production
- [ ] No sensitive data in console logs

## Deployment Steps

### Vercel Deployment
1. Push code to GitHub
2. Connect repository to Vercel
3. Configure build settings:
   - Build Command: `pnpm build:pwa`
   - Output Directory: `apps/pwa/.next`
   - Install Command: `pnpm install`
4. Deploy
5. Test deployed version

### Desktop App Build
1. Ensure Tauri is configured
2. Build for your platform: `pnpm build:desktop`
3. Test the built executable
4. Share with friend (or publish to GitHub Releases)

## Testing with Friend

### Setup
1. **You (Desktop App)**:
   - Install desktop app
   - Create identity
   - Configure relays
   - Generate QR code or invite link

2. **Friend (PWA on Vercel)**:
   - Visit deployed URL
   - Create identity
   - Configure same relays
   - Scan your QR code or use invite link

### Test Scenarios
- [ ] Send message from Desktop → PWA
- [ ] Send message from PWA → Desktop
- [ ] Test with both users online
- [ ] Test with one user offline (message should queue)
- [ ] Test relay failover (disable one relay)
- [ ] Test on different networks
- [ ] Test notification delivery

## Common Issues & Solutions

### QR Scanner Not Working
- **Cause**: Requires HTTPS or localhost
- **Solution**: Use Vercel deployment (has HTTPS) or invite links instead

### Messages Not Delivering
- **Cause**: Different relays or relay connection issues
- **Solution**: Ensure both users have at least one common relay

### Identity Lost
- **Cause**: Browser storage cleared or app reinstalled
- **Solution**: Implement backup/export feature (already in app)

### Can't Connect
- **Cause**: Firewall or relay issues
- **Solution**: Try different relays, check relay status
