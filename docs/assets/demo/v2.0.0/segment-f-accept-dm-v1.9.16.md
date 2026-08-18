# Demo Segment F — Appearance · accept request · DM (v1.9.16)

**Status:** Ready to record · follows Segment E · **Tor OFF**  
**Continues from:** **Tester2** unlocked in Profile window 2 · **DemoUser** pending outbound request in window 1 · inbound request visible on Tester2 **Requests (1)**  
**Tone:** Calm · moderate pace · short lines  
**Budget:** **~2–3 min** with VO (appearance ~45 s · accept + DM ~90 s) · full video still **&lt; 10 min**  
**Output:** `demo_06_accept_dm_v1.9.16.mp4` → stitch after Segment E

**Window plan:** Film **Tester2** for appearance + accept + first reply · cut to **DemoUser** for return message · optional 3 s split-screen at end.

**Covers:** Settings → Appearance (Light theme · five languages) · Tester2 accepts DemoUser's invitation · A/B exchange short DM text · clearnet relay path already established.

**Not in this segment:** Tor ON · group chat · voice/media · roster parity claims · profile export/import.

---

## Story arc

Tester2 personalizes the window (light theme, language options), accepts the pending invitation, then both accounts prove end-to-end DM on one machine. Segment D's handshake honesty pays off here: accept is explicit, then messaging unlocks.

---

## Prereq

| # | Check |
|---|--------|
| 1 | **v1.9.16** post-2026-08-18 build (handshake + containment) |
| 2 | **DemoUser** (window 1) — outbound request still pending · Tor OFF · relays connected (footer **3/3** or honest count) |
| 3 | **Tester2** (window 2) — **Requests (1)** shows incoming invitation from Segment D/E wait |
| 4 | Passphrases off-mic · no private keys on screen |
| 5 | Pre-set **Tester2 → Settings → Profile** published (from Segment D off-camera) so post-accept DM header can show a name |
| 6 | Optional pre-warm: on Tester2, Discovery search DemoUser npub once off-camera — only if post-fix build still shows **New Connection** after ~5 s (relay/kind-0 not published) |

---

## Known quirk — request row display name (fixed 2026-08-18)

**Was:** Requests card showed **New Connection** + hex avatar initials when kind-0 metadata was not cached.

**Fix:** Requests inbox rows now hydrate kind-0 metadata live from relays; avatars no longer use raw pubkey hex as initials.

**If name still missing on camera:** DemoUser must have **published profile** (Settings → Profile) so kind-0 is on the relay pool Tester2 uses. Say honestly: "Confirm fingerprint if display name hasn't propagated yet."

---

## Shot list + voiceover

### 1 — Open Appearance (Tester2)

**On screen:** Tester2 window · sidebar **Settings** (gear) · left nav **Appearance** (under General).

| VO |
|----|
| Before we accept the invitation, quick look at appearance. |
| Settings are per profile — Tester2 can look different from DemoUser. |

≈ 6–8 s.

---

### 2 — Light theme

**On screen:** **Theme** section · current **System** · click **Light** · UI switches to light chrome (match your screenshot reference — purple accent on light surfaces).

| VO |
|----|
| Theme is local to this window — System, Light, or Dark. |
| I'll use Light for this profile. |

≈ 8–10 s.

**Hold 2 s** on light shell so viewers see the switch.

---

### 3 — Five languages (brief)

**On screen:** Scroll to **Language** · click **English** button · dropdown opens · show all five: **English · 简体中文 · Español · Français · Deutsch** · select **English** again (or switch to one line of another language if you want a flash of translated chrome — switch back before accept flow).

| VO |
|----|
| Obscur ships five interface languages today. |
| Choice is stored per device profile — no account server involved. |

≈ 10–12 s.

**Optional skip:** Reduced motion / contrast toggles — one sentence only if time allows.

---

### 4 — Return to Requests · open invitation

**On screen:** Sidebar **Chats** · tab **Requests (1)** · single card (**New Connection** or **DemoUser** if pre-warmed) · click row · request detail / profile sheet with **Accept** (and intro note if sent in Segment D).

| VO |
|----|
| DemoUser's invitation arrived on the relay path. |
| Open it — confirm who you're talking to, then accept. |

≈ 10–12 s.

If row still shows **New Connection**, point at fingerprint / npub on detail panel — do not improvise "bug" unless using quirk VO from table above.

---

### 5 — Accept

**On screen:** Tap **Accept** · card moves to Chats / contact established · Network or sidebar shows DemoUser thread eligible.

| VO |
|----|
| Accept is explicit — both sides agreed. |
| Now direct messages are allowed. |

≈ 6–8 s.

---

### 6 — DM exchange (A → B → A)

**On screen:**  
1. Tester2 opens DM thread · type `Hello from Tester2` · send  
2. Cut/window switch to **DemoUser** · open same peer thread · show message received  
3. DemoUser replies `Hello from DemoUser` · send  
4. Cut back to Tester2 · show reply received  

| VO |
|----|
| End-to-end encrypted over the relays we configured — still clearnet, Tor off. |
| Two profiles, one machine — sender and receiver. |

≈ 25–35 s.

**Pass when:** Both bubbles visible on both sides · timestamps reasonable · footer still shows connected relays.

---

### 7 — Close

**On screen:** Both threads visible (split or last frame on Tester2 light theme).

| VO |
|----|
| Invitation, accept, message — the core DM path on desktop. |
| Groups and transport options build on this foundation. |

≈ 6–8 s.

---

## Full read-through

> Before we accept the invitation, quick look at appearance.  
> Settings are per profile — Tester2 can look different from DemoUser.  
> Theme is local to this window — System, Light, or Dark. I'll use Light for this profile.  
> Obscur ships five interface languages today. Choice is stored per device profile.  
> DemoUser's invitation arrived on the relay path. Open it — confirm who you're talking to, then accept.  
> Accept is explicit — both sides agreed. Now direct messages are allowed.  
> End-to-end encrypted over the relays we configured — still clearnet, Tor off. Two profiles, one machine.  
> Invitation, accept, message — the core DM path on desktop.

---

## Do not say / show

| Avoid | Why |
|-------|-----|
| "Username always shows in Requests instantly" | Metadata cache gap — see Known quirk |
| Tor ON | Demo ladder |
| Delete-for-me as global delete | ACC limitation |
| Paste nsec / speak passphrase | Security |
| Claim roster always matches between windows | ACC-02 |

---

## Pass when

1. Tester2 Appearance → **Light** theme applied on camera.  
2. Language dropdown shows **five** locales.  
3. Tester2 **Accept** completes · DemoUser gains trusted/thread path.  
4. At least one message each direction with both windows shown.  
5. VO honest about request label if still **New Connection** / hex avatar.

---

## Stitch

| # | File | Topic |
|---|------|--------|
| A | `demo_01_…` | Install |
| B | `demo_02_…` | Create identity |
| C | `demo_03_…` | Relays · Tor off |
| D | `demo_04_…` | Discovery · pending send |
| E | `demo_05_…` | Multi-profile · Tester2 sign-in |
| F | `demo_06_accept_dm_v1.9.16.mp4` | Appearance · accept · DM |

---

## Recording order tip

Record **appearance first** on a fresh Tester2 take (light theme before accept changes emotional beat). If you already accepted during testing, reset Tester2 request state or re-send from DemoUser before rolling — otherwise Requests (1) will be empty.
