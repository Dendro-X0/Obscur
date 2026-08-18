# Demo Segment C — Transport · relays · E2EE · Tor (v1.9.16)

**Status:** Segment C recorded · 2026-08-17 · **Tor OFF**  
**Next:** [segment-d-discovery-add-contact-v1.9.16.md](./segment-d-discovery-add-contact-v1.9.16.md)  
**Continues from:** Unlocked profile shell (post create / lock-unlock)  
**Tone:** Calm · moderate pace · short lines (leave air between sentences)  
**Budget:** Target **~60–90 s** silent B-roll · **~90–120 s** with VO · full video still **&lt; 10 min**  
**Output:** `demo_03_relays_transport_v1.9.16.mp4` → stitch after Segment B

**Covers:** End-to-end encryption honesty · default public Nostr relay pool · user control (enable/disable · add) · Tor as **optional** transport (off by default).

**Not in this segment:** DM send/receive · group chat · enabling Tor on camera · operator/coordination wizard · private-trust / `wss://` team stack · roster parity claims.

**Canonical limits:** [obscur-v2-known-limitations.md](../../../program/obscur-v2-known-limitations.md) — keep Tor **OFF** for clearnet demo; do **not** claim “Tor Verified.”

**Maintainer 2026-08-17:** This LAN stalls Tor at **Bootstrapped 10% (`conn_done`)** — environment / path class, not a demo beat. Leave the toggle **OFF** before rolling. Warming copy (“clearnet relays still in use”) is honest; do **not** film STARTING 10% / PENDING as the product story.

---

## Story arc (one sentence)

Messages are encrypted on your device first; public Nostr relays only carry ciphertext — and you choose which relays (or optional Tor routing) the app uses.

---

## Prereq

| # | Check |
|---|--------|
| 1 | **Release exe** just built — stamp **`shell-2026-08-17T16:37:20Z`** · path `apps/desktop/src-tauri/target/release/obscur_desktop_app.exe` · **do not** run `pnpm dev:desktop:online` at the same time |
| 2 | Profile **unlocked** after Segment B (same Tester profile is fine) |
| 3 | **Tor OFF** — Security → **Tor Network (Onion)** disabled · no Warming / 10% / PENDING on screen |
| 4 | Clearnet online · Relays tab shows **≥1 open socket** (2/3 or 3/3 ideal; 1/3 OK) |
| 5 | Window capture on **Obscur** only · mic per your VO plan |
| 6 | Know paths: **Settings → Relays** · **Settings → Security** (Tor block, toggle stays OFF) |

**Before first take (off camera):**

1. Turn Tor **OFF** and wait until Relays recover (primal / damus / nos.lol badges, not all red).  
2. Open **Settings → Relays** once so status chips settle — then go back to the shell and roll.  
3. Do **not** expand Tor logs on camera.

---

## Product truth (stay accurate)

| Topic | Say / show | Do **not** say |
|-------|------------|----------------|
| **E2EE** | Encryption happens in the client before anything leaves the device | “Relays encrypt for you” · “Server-side encryption” |
| **Relays** | Default **public Nostr** pool (`nos.lol`, `relay.primal.net`, `relay.damus.io`) in **Multi-node / redundancy** mode; relays see ciphertext + routing metadata | “Obscur hosts your messages” · “Inbox on our servers” |
| **Customization** | Toggle relays off/on · add `wss://…` · preset packs in Relays (show **Default Stable** label — avoid re-applying if it resets your list mid-demo) | “Locked to one relay forever” |
| **Tor** | **Optional** · **Security → Tor Network (Onion)** · off by default; when enabled, dials prefer Tor-viable paths (clearnet pool until Tor is Ready) | “Tor on by default” · “Tor fully verified in this build” · live enable + soak on camera |
| **Nostr** | One transport adapter — not the whole product story | “Just another Nostr client” (undersells stack — save for intro tier A if needed) |

Design alignment: [design-goals-and-constraints.md](../../../program/design-goals-and-constraints.md) · transport presets: `apps/pwa/app/features/transport-kernel/transport-preset-catalog.ts`

---

## Shot list + voiceover

Read each VO block once, then pause. Match Segment A/B pacing.

### 1 — Hold on unlocked shell (context)

**On screen:** Main messenger shell (empty chat list or Profile tab — no deep navigation).

| VO |
|----|
| Your keys stay on this device. |
| What leaves the machine is encrypted first. |

≈ 6–8 s + 1–2 s hold.

---

### 2 — Open Settings → Relays

**On screen:** Settings (gear) → sidebar **Relays** tab.

| VO |
|----|
| Relays are how Obscur reaches the network. |
| They move ciphertext — not your passphrase or private key. |

≈ 8–10 s.

**Frame must show:** Relays heading · relay list with hostnames · connection/status chips (connected / degraded OK).

---

### 3 — Default public pool

**On screen:** Scroll the configured relay list — default hosts visible (`nos.lol`, `relay.primal.net`, `relay.damus.io` or subset). Optional: **Refresh** status once so badges update.

| VO |
|----|
| Out of the box you get a small public Nostr pool — redundancy, not a single point of failure. |
| If one host is slow, others can still carry traffic. |

≈ 10–12 s.

**Honesty:** If one relay shows disconnected, **keep it** — partial pool is real; do not apologize on camera unless VO adds: “You can disable flaky hosts.”

---

### 4 — Customize: disable · enable · add

**On screen:**  
1. Toggle **one** relay off (brief pause on status change).  
2. Toggle it back **on**.  
3. Scroll to **add custom endpoint** · type a placeholder `wss://` URL · **do not** save a nonsense host unless you will remove it — prefer show field + cancel, or add a relay you control.

| VO |
|----|
| The list is yours — disable a relay, add your own, or run a private host later. |
| No account on our servers — just endpoints you configure. |

≈ 12–18 s.

**GIF reference (optional trim source):** [relay_enable_disable_1.gif](../../gifs/relay_enable_disable_1.gif) · [relay_overview_1.gif](../../gifs/relay_overview_1.gif)

---

### 5 — Preset packs (optional 5–8 s)

**On screen:** **Transport preset** / preset catalog area — highlight **Default Stable** card (three public relays · Multi-node). **Do not** click Apply if it would wipe a live demo list unless intentional.

| VO |
|----|
| Preset packs are shortcuts — same idea, different redundancy or latency tradeoffs. |

≈ 5–8 s · skip if time is tight.

---

### 6 — Tor: optional, off by default

**On screen:** Settings → **Security** · scroll to **Tor Network (Onion)** · toggle **OFF** · hold on description copy (“Prefer Tor for privacy… clearnet relays stay in use until Tor is Ready”).

| VO |
|----|
| Tor is optional — off by default on clearnet. |
| Turn it on when you want onion routing; the app keeps clearnet relays until Tor is actually ready. |
| We’re not demoing Tor live here — this build is clearnet-first. |

≈ 12–15 s.

**Do not:** Flip Tor **on** · expand connection logs · claim verified onion soak.

---

### 7 — Close hold

**On screen:** Return to Relays tab **or** shell with relay/globe indicator visible (if present).

| VO |
|----|
| Encryption on the client. |
| Transport you control. |

≈ 4–6 s hold.

---

## Full read-through (copy card)

> Your keys stay on this device.  
> What leaves the machine is encrypted first.  
>  
> Relays are how Obscur reaches the network.  
> They move ciphertext — not your passphrase or private key.  
>  
> Out of the box you get a small public Nostr pool — redundancy, not a single point of failure.  
> If one host is slow, others can still carry traffic.  
>  
> The list is yours — disable a relay, add your own, or run a private host later.  
> No account on our servers — just endpoints you configure.  
>  
> Tor is optional — off by default on clearnet.  
> Turn it on when you want onion routing; clearnet relays stay in use until Tor is ready.  
> We’re not demoing Tor live here — this build is clearnet-first.  
>  
> Encryption on the client.  
> Transport you control.

**Speech:** ~120 words · ~50–65 s spoken · with UI ≈ **90–120 s** trimmed.

---

## Do not say / do not show

| Avoid | Why |
|-------|-----|
| Enabling Tor mid-recording | Limitations: Tor Verified **infeasible** · clearnet demo path |
| “Messages are anonymous / untraceable” | Overclaim |
| “Relays can read your DMs” | False — ciphertext on standard path |
| “Default is best for everyone forever” | Operator / private-trust path exists |
| Coordination URL / managed workspace wizard | Segment C is transport literacy, not ops onboarding |
| DM send · typing indicator · delivery proof | **Segment D** (messaging) |
| Filming relay URLs with credentials | Security |

---

## Pass when

Viewer understands:

1. **E2EE is client-side** before network egress.  
2. **Default public Nostr pool** ships with the app (redundancy).  
3. **Relays are user-configurable** (toggle · add · presets).  
4. **Tor exists but is optional and off by default** — not the demo path today.

---

## After recording

1. Shotcut trim · target **~60–90 s** silent or **~90–120 s** with VO  
2. Note duration next to Segment B (~52 s)  
3. Optional next: **Segment D — Discovery / add contact** — [segment-d-discovery-add-contact-v1.9.16.md](./segment-d-discovery-add-contact-v1.9.16.md)

---

## Stitch order (v2.0.0 reel)

| # | File | Topic |
|---|------|--------|
| A | `demo_01_site_download_install_v1.9.16.mp4` | Site · download · install (~45 s) |
| B | `demo_02_create_identity_lock_v1.9.16.mp4` | Create · profile · lock/unlock (~52 s) |
| C | `demo_03_relays_transport_v1.9.16.mp4` | Relays · E2EE · Tor honesty |
| D | `demo_04_discovery_add_contact_v1.9.16.mp4` | Discovery · add contact |
