# Demo Segment H — Voice notes · voice calls (v1.9.16)

**Status:** Ready to record · follows Segment G (Vault) · **Tor OFF**  
**Continues from:** Trusted DM thread open between **DemoUser** and **Tester2** (from Segment F) · both windows unlocked · relays connected  
**Tone:** Calm · moderate pace · short lines  
**Budget:** **~50–70 s** with VO (voice note ~25–30 s · voice call ~25–35 s) · keep trim under ~75 s  
**Output:** `demo_08_voice_notes_calls_v1.9.16.mp4` → stitch after Segment G

**Window plan:** Film **DemoUser** for record + send · cut to **Tester2** for playback + incoming ring · optional 3–5 s split while connected · end on hang-up.

**Covers:** Composer mic → voice note bubble both sides · DM header **Voice call** → ring / accept → short connected beat · honest “audio only” line (no video).

**Not in this segment:** Video calling (not shipped) · group voice · Vault · Tor · media file upload (done in G).

---

## Story arc

Same two profiles, one machine: DemoUser leaves an asynchronous voice note, then places a live voice call. Tester2 proves receive + answer. Close with a clear future-facing caveat: video conferencing is not available today.

---

## Prereq

| # | Check |
|---|--------|
| 1 | **v1.9.16** packaged build (stamp ≥ Segment G rebuild if you used that exe) |
| 2 | **DemoUser** + **Tester2** unlocked · Tor OFF · footer relays connected |
| 3 | Trusted DM thread already open (post–Segment F accept) |
| 4 | Mic available · Windows mic permission allowed for Obscur · headphones recommended to avoid echo |
| 5 | Off-camera: confirm composer shows mic when text field is empty (no pending attachments) |
| 6 | Off-camera: dry-run one call so consent dialogs do not surprise you on camera |

---

## Known honesty — video not available

Product copy already states it on mic consent: *“Video conferencing is not supported.”*  
CRDT model may carry a `video` call type internally; **UI ships audio-only**. Do not promise a ship date for video.

**VO line (required once):** “Voice calls are audio today — video calling isn’t available yet; it may come later.”

---

## Shot list + voiceover

### 1 — Open DM · set the beat (DemoUser)

**On screen:** DemoUser · DM with Tester2 · composer empty · mic control visible in composer rail.

| VO |
|----|
| Same chat — next, voice. |
| First an asynchronous voice note, then a live call. |

≈ 5–6 s.

---

### 2 — Record voice note

**On screen:** Tap mic · allow mic if prompted (consent copy may mention voice note) · record **3–5 s** of clear speech · stop · preview if shown · send.

| VO |
|----|
| Hold or tap to record — short note, then send. |
| Encrypted like any other attachment on the relay path. |

≈ 12–15 s.

**Hold 1–2 s** on outgoing voice-note bubble (waveform / play control).

---

### 3 — Receive + play (Tester2)

**On screen:** Cut to Tester2 · same thread · voice-note bubble arrived · tap play · hear DemoUser (desktop audio ON for this beat only if you want the note in the recording).

| VO |
|----|
| Tester2 gets the note and can play it in-thread. |

≈ 8–10 s.

**Pass when:** Bubble visible + playback starts (even 1 s is enough).

---

### 4 — Place voice call (DemoUser)

**On screen:** Back to DemoUser · chat header action rail · **Voice call** (phone icon) · tap · sending / ringing chrome · optional consent: “microphone access… Video conferencing is not supported.”

| VO |
|----|
| For a live conversation, Voice call from the chat header. |
| Audio only — video calling isn’t available yet; it may come later. |

≈ 10–12 s.

---

### 5 — Answer · brief connect (Tester2 → both)

**On screen:** Tester2 incoming toast / invite · **Accept** · both windows show connected / dock · speak one short line each · **Hang up**.

| VO |
|----|
| Answer on the other profile — two windows, one machine. |
| Short proof of a connected voice path, then hang up. |

≈ 12–18 s.

**If ring fails / one-sided:** Do not invent “video fallback.” Cut to voice-note success and say: “Live call depends on WebRTC and both clients online — voice notes still work when a call doesn’t.”

---

### 6 — Close

**On screen:** Thread with voice-note bubble + call ended card / dock dismissed.

| VO |
|----|
| Voice notes for async · voice calls for live audio. |
| Video stays on the roadmap — not in this build. |

≈ 5–6 s.

---

## Full read-through

> Same chat — next, voice. First an asynchronous voice note, then a live call.  
> Hold or tap to record — short note, then send. Encrypted like any other attachment on the relay path.  
> Tester2 gets the note and can play it in-thread.  
> For a live conversation, Voice call from the chat header. Audio only — video calling isn’t available yet; it may come later.  
> Answer on the other profile — two windows, one machine. Short proof of a connected voice path, then hang up.  
> Voice notes for async · voice calls for live audio. Video stays on the roadmap — not in this build.

---

## Do not say / show

| Avoid | Why |
|-------|-----|
| “Video calls work” / tap a camera call control | Not shipped |
| PSTN / phone-number calling | Product is in-app WebRTC |
| Group voice rooms | Out of segment |
| Claim 100% call reliability | Invite/connect still hardening |
| Paste nsec / speak passphrase | Security |
| Tor ON | Demo ladder |

---

## Pass when

1. Voice note recorded and sent from DemoUser.  
2. Voice note visible and playable on Tester2.  
3. Voice call invite placed from DM header; Tester2 answers (or honest fallback VO if connect fails).  
4. VO states **audio only** and **video not available yet**.  
5. Hang-up leaves both windows usable (no stuck overlay).

---

## Stitch

| # | File | Topic |
|---|------|--------|
| … | prior segments | A–F |
| G | `demo_07_…` (Vault) | Secure upload · Vault |
| H | `demo_08_voice_notes_calls_v1.9.16.mp4` | Voice notes · voice calls |

---

## Recording order tip

Record **voice note first** (more reliable), then **call**. If the call is flaky on a take, keep the note take and re-roll only the call beat. Prefer headphones; mute system notification sounds.

### Relay delivery toast (public Nostr)

Public relays (`nos.lol`, `damus`, `primal`, …) often **close the WebSocket** after idle or under load. That is **server-side transport**, not a voice-note codec bug.

If you see **"Delivery could not be confirmed…"** after a voice note:

1. Check footer relay count (want **≥1–2 open**).
2. Wait a few seconds for auto-reconnect, or toggle Relays off/on.
3. Resend the note (or a short text first to prove the path).
4. In edit: cut the red toast; keep the bubble once a checkmark / peer receive is visible.

**Do not VO:** “Obscur’s relay system is broken.” Prefer: “Public relays are best-effort transport — we wait for a connected path, then send.”
