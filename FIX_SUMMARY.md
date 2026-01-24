# Fix Summary: Loading Issues & Message Delivery

## Issues Identified

### 1. Flash of Unstyled Content (FOUC)
**Problem**: Both PWA and Desktop app show unstyled content on first load.
- PWA: Blank page with 404 errors
- Desktop: Raw HTML without CSS

**Root Cause**: Static assets (CSS, fonts) not loading before initial render.

**Solution**: Created `Preloader` component that:
- Hides the page until fonts + stylesheets are loaded
- Waits for `document.fonts.ready`
- Ensures CSS rules are accessible
- Shows page only after 100ms grace period

**Files Modified**:
- `apps/pwa/app/components/preloader.tsx` (NEW)
- `apps/pwa/app/layout.tsx` (Added `<Preloader />`)

---

### 2. Messages Not Being Received
**Problem**: PWA sends message → Desktop doesn't receive it.

**Root Cause Analysis**:
The app uses **real-time WebSocket subscriptions** to Nostr relays. Looking at your screenshots:
- **PWA User**: Sent "Test" message showing "Sent" status
- **Desktop User**: Shows "Select a conversation" - no messages

**Potential Causes**:
1. **Desktop not subscribing to incoming DMs**: The app needs to actively listen for `kind: 4` (DM) events
2. **Relay synchronization**: Both users connected to same relays (default: `wss://relay.damus.io`, `wss://nos.lol`, `wss://relay.nostr.band`)
3. **Missing subscription filter**: Desktop might not be requesting DMs addressed to its public key

**Investigation Needed**:
The `page.tsx` file is 2,846 lines and contains all the DM subscription logic. We need to verify:
- Line ~1500-2000: Where relay subscriptions are set up
- DM filter: Should be `{"kinds": [4], "#p": ["<desktop_user_pubkey>"]}`
- Active listening: The desktop app must subscribe on mount

**Recommended Next Steps**:
1. Check if desktop app creates relay subscription on page load
2. Verify the subscription includes the correct public key filter
3. Add debug logging to see if events are arriving but not being processed

---

## Status

✅ **FOUC Fix**: Complete - Preloader added
⚠️ **Message Delivery**: Needs deeper investigation of subscription logic

To verify the message delivery issue, we need to:
1. Add console logging to track relay messages
2. Verify the desktop user's subscription filter
3. Check if messages are arriving but not being added to state

Would you like me to investigate the subscription logic in `page.tsx`?
