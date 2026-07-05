# Obscur v2.0.0 — presenter demo script

**Status:** Local prep (2026-07-04) — **not Phase 5 EXIT** until maintainer cold-run sign-off  
**Duration:** 15–20 minutes (live desktop) · 12 minutes (GIF-backed walkthrough)  
**Audience:** Technical evaluators, B2B trust conversations, community maintainers  
**Prerequisite:** Phase 1 verification complete · Windows installer @ v1.9.10 · [known limitations](../../../program/obscur-v2-known-limitations.md) reviewed

**Companion docs:**

| Doc | Role |
|-----|------|
| [presenter-checklist.md](./presenter-checklist.md) | Cold-run setup + exit criteria |
| [gif-inventory.md](./gif-inventory.md) | Visual evidence map + capture gaps |
| [obscur-v2-known-limitations.md](../../../program/obscur-v2-known-limitations.md) | Hand to viewers — honest scope |
| [obscur-v2-install-build-guide.md](../../../program/obscur-v2-install-build-guide.md) | Build-from-source fallback |
| [private-trust-local-setup.md](../private-trust-local-setup.md) | Two-tester stack for live group segment |

---

## Opening (2 min)

**Say:**

> Obscur is privacy-first **native desktop** software. Production web/PWA is disabled; what you install is the Tauri shell with local SQLite. This demo shows verified Phase 1 paths — not a marketing story. Roster display between profiles may disagree; delete-for-me and restore have documented limits. Full sheet: [known limitations](../../../program/obscur-v2-known-limitations.md).

**Show:** Website `/limitations` (when deployed) or open the limitations doc locally.

**Do not claim:** Play Store, App Store, signed Windows installer, or “roster always matches between profiles.”

---

## Segment 1 — Install & trust (3 min)

| Step | Action | Pass when |
|------|--------|-----------|
| 1.1 | Open `/download` or local `release-assets/manifest.json` | Windows NSIS @ **v1.9.10** listed |
| 1.2 | Copy SHA-256 `d814ab21…` · verify after download | Checksum matches manifest |
| 1.3 | Run installer · acknowledge SmartScreen (unsigned) | App launches |
| 1.4 | Point to [signing policy](../../../program/obscur-v2-phase3-signing-policy.md) | “Unsigned by policy — verify hash” |

**Evidence (optional):** Screenshot `evidence/P5-01-install-verify-<date>.png` → `evidence/` (create folder on first capture)

**GIF fallback:** None — live install is the proof.

---

## Segment 2 — Unlock & identity (3 min)

| Step | Action | Pass when |
|------|--------|-----------|
| 2.1 | Create or unlock Tester1 profile | Main shell visible — no Import Key loop on warm path |
| 2.2 | Settings → identity / security surfaces | Passphrase path clear |
| 2.3 | Mention cold restart | “After full process kill, password unlock works on verified paths; Import Key may appear on edge restore bands — see limitations.” |

**GIF:** [`obscur_login_1.gif`](../../gifs/obscur_login_1.gif) — **stale UI risk** (2026-04 capture); prefer live unlock when possible.

**Verified (Phase 1):** R2 cold unlock **VERIFIED t4** · O-2 DM cold restart **VERIFIED t4**.

---

## Segment 3 — Direct messaging (3 min)

| Step | Action | Pass when |
|------|--------|-----------|
| 3.1 | Open DM thread · send short text | Message appears in thread |
| 3.2 | Optional: second profile or note dual-tester deferral | Receive path if two clients running |
| 3.3 | Mention SQLite persistence | “Native history survives restart on paths we tested.” |

**GIF:** [`obscur_chat_ui_1.gif`](../../gifs/obscur_chat_ui_1.gif)

**Do not demo:** Delete-for-me as “gone forever” — ACC-01 accepted limitation.

---

## Segment 4 — Relay & settings (2 min)

| Step | Action | Pass when |
|------|--------|-----------|
| 4.1 | Settings → Relays | Local relay or coordination URL visible |
| 4.2 | Community membership sync mode | Coordination preferred when URL set |
| 4.3 | One sentence on transport | “Relay carries ciphertext; coordination directory owns membership deltas on private-trust stacks.” |

**GIF:** [`obscur_settings_panel_1.gif`](../../gifs/obscur_settings_panel_1.gif)

**Live stack (if group segment follows):** See [private-trust-local-setup.md](../private-trust-local-setup.md) — coordination `:8787` · relay `ws://localhost:7000`.

---

## Segment 5 — Multi-profile (2 min)

| Step | Action | Pass when |
|------|--------|-----------|
| 5.1 | Profile switcher or second window | Distinct profile chrome |
| 5.2 | Same machine, isolated state | No ambient “current user” bleed in UI |

**GIF:** [`multi_profile_management_1.gif`](../../gifs/multi_profile_management_1.gif)

---

## Segment 6 — Group community (5 min) — **live preferred**

This segment proves Phase 1C **VERIFIED t4** (dual-profile send/receive). Requires two profiles + coordination (+ relay for chat).

| Step | Actor | Action | Pass when |
|------|-------|--------|-----------|
| 6.1 | Tester1 | Create managed workspace · invite Tester2 | Invite accepted |
| 6.2 | Both | Open group thread | Compose enabled — no “Room key missing” chrome (R1 **VERIFIED t4**) |
| 6.3 | Tester1 | Send `demo-<timestamp>` | Bubble in T1 thread |
| 6.4 | Tester2 | Same thread | Message visible — sidebar preview may lag thread (R3 **VERIFIED t4** post-fix; mention honestly if stale) |
| 6.5 | Both | Participants modal | **Do not** claim roster parity — ACC-02 accepted |

**GIF gap:** No community/group GIF in library — capture target: `community_group_send_receive_1.gif` (see [gif-inventory.md](./gif-inventory.md)).

**Short path (no live stack):** Show Phase 1C chain reference in handoff · skip live send · state limitation.

---

## Segment 7 — Media & voice (optional, 2 min)

| Step | Action | Pass when |
|------|--------|-----------|
| 7.1 | Attach image or file in DM | Upload progress + render |
| 7.2 | Voice note or call surface | UI loads — do not claim full PSTN parity |

**GIFs:** [`multimedia_files_upload_and_transfer_1.gif`](../../gifs/multimedia_files_upload_and_transfer_1.gif) · [`voice_notes_and_calls_1.gif`](../../gifs/voice_notes_and_calls_1.gif)

**Accepted:** MED-001 / MED-002 media relink — not re-run for v2 demo gate.

---

## Close (2 min)

| Step | Action |
|------|--------|
| 8.1 | Hand [limitations sheet](../../../program/obscur-v2-known-limitations.md) |
| 8.2 | Point to `/download` + SHA-256 |
| 8.3 | Build-from-source: [install guide](../../../program/obscur-v2-install-build-guide.md) |
| 8.4 | Q&A — redirect roster/delete/restore questions to ACC rows |

**Phase 5 exit (maintainer):** One cold run of this script · limitations + install link handed to viewer · sign-off recorded in [presenter-checklist.md](./presenter-checklist.md).

---

## Pipeline mapping

| ID | Task | This doc |
|----|------|----------|
| M5-1 | Demo script | **This file** |
| M5-2 | Evidence GIFs/screenshots | [gif-inventory.md](./gif-inventory.md) |
| M5-3 | Website embed | Deferred — Phase 4 deploy PAUSED; site-content already references GIF URLs |
| M5-4 | Limitations linked | § Opening + § Close |

**Charter source:** [v2.0-release-pipeline.md](../../../archive/program/inactive-2026-06/v2.0-release-pipeline.md) § Phase 5
