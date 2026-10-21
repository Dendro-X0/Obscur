# Demo Segment E — Multi-profile · second account on one device (v1.9.16)

**Status:** Ready to record · follows Segment D · **Tor OFF**  
**Continues from:** **DemoUser** unlocked in Profile window 1 · outbound contact request still **pending** (Network empty)  
**Tone:** Calm · moderate pace · short lines  
**Budget:** **~90–120 s** with VO · full video still **&lt; 10 min**  
**Output:** `demo_05_multi_profile_v1.9.16.mp4` → stitch after Segment D

**Nav:** Title bar profile chip → **Manage Profiles** (`/profiles`) · **Add profile** · new window → **Log In with Key** (Tester2).  
**Chrome analogy (VO):** One device · multiple accounts · data stays in that profile window — not a shared cloud login.

**Covers:** Why multi-profile exists · open a second isolated window · sign into **Tester2** on the same machine · prove DemoUser and Tester2 do not share contacts or chrome.

**Not in this segment:** Accepting the contact request · DM send/receive (Segment F) · Tor ON · group chat · export/import backup tour.

**Honesty:** Each window is one profile slot. Switching accounts in the **same** window may wipe that slot's local data — the demo path is **new window + sign in**, not "swap account in place" unless you deliberately show Advanced Profile Settings (skip for this take).

---

## Story arc

Segment D left DemoUser waiting on an invitation. Real testers use two people — or two accounts on one laptop. Obscur keeps each account in its own desktop window, like Chrome profiles: same app, separate data.

---

## Prereq

| # | Check |
|---|--------|
| 1 | **v1.9.16** build @ `release-assets/windows/Obscur_1.9.16_x64-setup.exe` (post-2026-08-18 handshake/containment) |
| 2 | **Window 1 — DemoUser** still unlocked · Tor OFF · pending request from Segment D (Network empty is OK) |
| 3 | **Tester2** identity exists (created off camera for Segment D npub/friend-code copy) · passphrase ready off camera |
| 4 | Know Tester2 username + that its npub matches Segment D paste |
| 5 | Window capture: prefer **one window at a time**; optional 3 s split-screen at end |
| 6 | Close unrelated Obscur windows before take — picker should show only intended slots |

---

## Shot list + voiceover

### 1 — Same device, one account so far

**On screen:** DemoUser main shell · title bar shows DemoUser name · Network still empty / request pending.

| VO |
|----|
| So far this is one account on this machine. |
| To test with a second person, you don't need a second computer. |

≈ 6–8 s.

---

### 2 — Open profile management

**On screen:** Click title bar **profile chip** (avatar + name) → dropdown → **Manage Profiles**.  
Land on **Who's using Obscur?** picker · subtitle about isolated windows.

| VO |
|----|
| Obscur can run multiple accounts on one device — similar to Chrome profiles. |
| Each profile is its own window; data stays inside that window. |

≈ 10–12 s.

---

### 3 — Add a second profile window

**On screen:** Click dashed **Add profile** / **New profile** card · optional rename label **Tester2** if advanced row visible · new Obscur window opens (or focus empty slot).  
If picker launches window: show fresh auth welcome — **Create New Identity** / **Log In with Key**.

| VO |
|----|
| Add a profile — that opens another window. |
| Same app, separate storage — contacts and chats don't leak across. |

≈ 10–12 s.

---

### 4 — Sign in as Tester2

**On screen:** In the **new window only** · **Log In with Key** (or unlock if Tester2 already bound to this slot) · enter passphrase off-mic · Tester2 shell loads.  
Show title bar: **Tester2** name · different pubkey subtitle from DemoUser.

| VO |
|----|
| Sign in with the second account here. |
| This window only sees Tester2's data — not DemoUser's. |

≈ 12–15 s.

**Do not film** private key paste · nsec · or passphrase spoken aloud.

---

### 5 — Isolation proof (quick)

**On screen (pick two):**  
- Tester2 **Network** / Chats — roster differs from DemoUser (may include inbound request later — OK to stay empty if not accepted yet).  
- Flip back to DemoUser window — still empty Network · pending send unchanged.  
- Optional side-by-side 3 s: two title bars, two names.

| VO |
|----|
| DemoUser still has the outgoing request. |
| Tester2 lives in the other window — that's how we exercise send and receive on one PC. |

≈ 10–12 s.

---

### 6 — Close / handoff to DM

**On screen:** Hold on both windows or return to Tester2 shell.

| VO |
|----|
| Two profiles, one device — isolated by design. |
| Next we'll accept the request and walk through direct messages. |

≈ 6–8 s.

---

## Full read-through

> So far this is one account on this machine.  
> To test with a second person, you don't need a second computer.  
> Obscur can run multiple accounts on one device — similar to Chrome profiles.  
> Each profile is its own window; data stays inside that window.  
> Add a profile — that opens another window.  
> Same app, separate storage — contacts and chats don't leak across.  
> Sign in with the second account here.  
> This window only sees Tester2's data — not DemoUser's.  
> DemoUser still has the outgoing request.  
> Tester2 lives in the other window — that's how we exercise send and receive on one PC.  
> Two profiles, one device — isolated by design.  
> Next we'll accept the request and walk through direct messages.

---

## Do not say / show

| Avoid | Why |
|-------|-----|
| "One login for the whole app" | Violates isolation story |
| Swap account in same window without explaining wipe | Misleading unless Advanced Settings demo |
| Accept contact request on Tester2 | Segment F |
| Send DM | Segment F |
| Claim roster always matches between windows | ACC-02 — honest if previews lag |
| Enable Tor | Clearnet demo ladder |

---

## Pass when

1. Picker explains isolated windows (on-screen copy or VO).  
2. Second profile window opens from **Add profile**.  
3. Tester2 unlocks in that window — distinct title bar identity.  
4. DemoUser window unchanged — still pending / empty Network from Segment D.  
5. VO hands off to DM segment without showing message send.

---

## Stitch

| # | File | Topic |
|---|------|--------|
| A | `demo_01_…` | Site · install |
| B | `demo_02_…` | Create · lock |
| C | `demo_03_…` | Relays · E2EE · Tor off |
| D | `demo_04_discovery_add_contact_v1.9.16.mp4` | Discovery · pending request |
| E | `demo_05_multi_profile_v1.9.16.mp4` | Second profile window · Tester2 sign-in |
| F | `demo_06_accept_dm_v1.9.16.mp4` | Appearance · accept · DM |

---

## Editor note (Shotcut / missing media)

If the project references `G:\Videos\2026-08-17 17-43-22.mp4` and shows **Missing Files**:

1. **Search in Folder** on your recorder output directory (OBS · Xbox Game Bar · etc.) — the drive letter may have changed.  
2. Double-click the missing row and relink to the actual `.mp4` (same date/time in filename).  
3. If the take is lost, re-record this segment only — E does not depend on re-stitching A–D rushes.  
4. Keep segment exports named `demo_05_…` even if the editor project is `clip_5.mlt`.
