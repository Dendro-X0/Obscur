# Demo Segment A — Intro · site · download · install (v1.9.16)

**Status:** VO rethink · **~50 s** trimmed section · site + install only  
**Site:** https://obscur-website.vercel.app/  
**Tone:** Calm · moderate pace · **sparse lines** — let the site and installer carry visuals  
**Output:** Opening of `showcase.mp4` / `demo_01_site_download_install_v1.9.16.mp4`

**Job of this section:** Name what Obscur *is* (purpose + stack) in one breath, then get the viewer to a installed app — **hand off to identity creation** in the next beat.

**Not in this segment:** create identity · DM · relays deep-dive · Tor.

---

## What viewers must leave with

1. **Purpose** — local-first encrypted messaging you install and own  
2. **Stack** — Tauri v2 desktop · SQLite locally · Rust kernel · Nostr transport (public + custom relays)  
3. **Sync model** — relay networks *or* portable profile export (two honest paths)  
4. **Trust** — official site · verify releases · unsigned installer is expected  
5. **Next** — installer done → identity segment

---

## 50-second beat map

| Time | On screen | VO role |
|------|-----------|---------|
| **0:00–0:12** | Home hero · hold on title + **Download v1.9.16** | Name Obscur + one-line purpose |
| **0:12–0:28** | Slow scroll (shipping / desktop primary) *or* hold hero | Stack: Tauri · SQLite · relays · sync paths |
| **0:28–0:40** | `/download` · platform card · checksums · download starts | Verify + Windows pick |
| **0:40–0:50** | Installer launch · SmartScreen · NSIS · cut before welcome | Install + handoff |

**Rule:** One sentence per beat, then **silence** while the mouse moves. Do not narrate every scroll pixel.

---

## Recommended voiceover (~48–52 s spoken)

Read once per beat. Pause **1–2 s** between lines.

### Beat 1 — Hero (0:00)

> **Obscur is a local-first encrypted messenger — a native desktop app you install and control.**

### Beat 2 — Stack (0:12)

> **Built on Tauri v2: small footprint, fully featured — SQLite on your machine, with a Rust kernel underneath.**  
> **It connects through public Nostr relays or your own — and you can sync via the network, or by exporting a portable profile.**

### Beat 3 — Download (0:28)

> **This is the official site — releases you can verify.**  
> **Download your platform, check the SHA-256, and grab the Windows build for this walkthrough.**

### Beat 4 — Install + handoff (0:40)

> **Running the installer now — unsigned builds may show SmartScreen; that’s expected.**  
> **Next, we create a local identity.**

---

## Full read-through (teleprompter)

> Obscur is a local-first encrypted messenger — a native desktop app you install and control.  
>  
> Built on Tauri v2: small footprint, fully featured — SQLite on your machine, with a Rust kernel underneath.  
> It connects through public Nostr relays or your own — and you can sync via the network, or by exporting a portable profile.  
>  
> This is the official site — releases you can verify.  
> Download your platform, check the SHA-256, and grab the Windows build for this walkthrough.  
>  
> Running the installer now — unsigned builds may show SmartScreen; that’s expected.  
> Next, we create a local identity.

**~95 words · ~50 s** at moderate pace with short pauses between stanzas.

---

## Alternate — stack-forward (if hero hold is short)

Use when Beat 2 is only **8 s** on screen — merge stack into one tighter line:

> **Tauri v2 desktop, local SQLite, Nostr — public relays or yours — sync online or with a portable export.**

Drop the long Beat 2 pair; keep Beats 1, 3, 4 unchanged.

---

## Alternate — minimal (if install runs fast in trim)

Cut Beat 3 second line; end at:

> **Download from the official page and verify the hash.**  
> **Installer’s running — next, a local identity.**

---

## Do not say

| Avoid | Why |
|-------|-----|
| “Better than Signal / WhatsApp” | Not our story |
| “Just a Nostr client” | Undersells the stack |
| “Cloud account / our servers” | Local-first truth |
| “Fully anonymous / uncrackable” | Overclaim |
| Play Store · signed Microsoft installer | Not shipped |
| Tor required to install | False |
| “Bug-free” / “production-perfect” | Beta honesty lives in close |

---

## Pass when

Viewer hears **purpose + Tauri/SQLite/relays + two sync paths** before download, and sees **verify + install** without drowning in prose. Cut lands on installer / pre-welcome — identity is explicitly **next**.

---

## Distribution (unchanged)

| Channel | Role |
|---------|------|
| Website `/download` | Primary · checksums |
| GitHub Releases v1.9.16 | Secondary · same assets |
