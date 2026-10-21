# Obscur v2.0.0 — presenter demo script

**Status:** Open beta recording prep (2026-08-23) — exe @ **`shell-2026-08-23T17:15:41Z`** · maintainer smoke before Phase 5 EXIT  
**Release notes:** [v2.0.0-beta-release.md](../../../releases/v2.0.0-beta-release.md)  
**Duration:** 15–20 minutes (live desktop) · ~10 min (edited showcase + VO)  
**Audience:** Technical evaluators, B2B trust conversations, community maintainers  
**Prerequisite:** Phase 1 verification complete · release exe @ **`shell-2026-08-23T17:15:41Z`** · [known limitations](../../../program/obscur-v2-known-limitations.md) reviewed

**Agent GIF / docs shelf standard:** [agent-docs-gif-standard.md](../../../program/agent-docs-gif-standard.md) — silent · 20–30 FPS · `docs/assets/gifs/` + this `demo/<version>/` MD shelf.

**Companion docs:**

| Doc | Role |
|-----|------|
| [segment-a-download-install-v1.9.16.md](./segment-a-download-install-v1.9.16.md) | B-roll brief · site · install (~45 s) |
| [segment-b-create-identity-v1.9.16.md](./segment-b-create-identity-v1.9.16.md) | B-roll brief · create · lock/unlock (~52 s) |
| [segment-c-relays-transport-v1.9.16.md](./segment-c-relays-transport-v1.9.16.md) | B-roll brief · relays · E2EE · Tor honesty |
| [segment-d-discovery-add-contact-v1.9.16.md](./segment-d-discovery-add-contact-v1.9.16.md) | B-roll brief · Discovery · npub · friend code |
| [segment-e-multi-profile-v1.9.16.md](./segment-e-multi-profile-v1.9.16.md) | B-roll brief · multi-profile · second window · Tester2 sign-in |
| [segment-f-accept-dm-v1.9.16.md](./segment-f-accept-dm-v1.9.16.md) | B-roll brief · appearance · accept request · DM |
| [segment-h-voice-notes-calls-v1.9.16.md](./segment-h-voice-notes-calls-v1.9.16.md) | B-roll brief · voice notes · voice calls (audio only) |
| [segment-i-community-group-chat-v1.9.16.md](./segment-i-community-group-chat-v1.9.16.md) | B-roll brief · Part 9 · Managed Workspace create · invite · group chat (Docker demo stack) |
| [segment-j-data-portability-v1.9.16.md](./segment-j-data-portability-v1.9.16.md) | B-roll brief · Part 10 (final) · data folder · export/import · close |
| [final-vo-beta-close-v1.9.16.md](./final-vo-beta-close-v1.9.16.md) | Post-edit VO + open-beta end card |
| [v2.0.0-beta-release.md](../../../releases/v2.0.0-beta-release.md) | Open beta release notes + build stamp |
| [presenter-checklist.md](./presenter-checklist.md) | Cold-run setup + exit criteria |
| [gif-inventory.md](./gif-inventory.md) | Visual evidence map + capture gaps |
| [group-chat-gif-shot-list.md](./group-chat-gif-shot-list.md) | Group demo GIF sequence (Docker relay, invite, chat) |
| [obscur-v2-known-limitations.md](../../../program/obscur-v2-known-limitations.md) | Hand to viewers — honest scope |
| [obscur-v2-install-build-guide.md](../../../program/obscur-v2-install-build-guide.md) | Build-from-source fallback |
| [private-trust-local-setup.md](../private-trust-local-setup.md) | Two-tester stack for live group segment |

---

## Opening (2 min)

**Say:**

> Obscur is **sovereign** native desktop software — local keys, end-to-end encryption, infra you control. Production web/PWA is disabled. Pitch **clearnet private-trust**; Tor is optional underlay, not the product. **Open beta** ships NIP-17 DMs, NIP-44 room-key wraps, honest relay-metadata copy. Voice is audio-only today — no video conference. ASE is on-device warnings, not cloud content police. This demo shows verified Phase 1 paths — not a dark-web or gray-market story. Roster display between profiles may disagree; delete-for-me and restore have documented limits. Full sheet: [known limitations](../../../program/obscur-v2-known-limitations.md) · [PB1-D checklist](../../../program/pb1d-positioning-honesty-checklist-2026-10.md).

**Show:** Website `/limitations` (when deployed) or open the limitations doc locally.

**Do not claim:** Play Store, App Store, signed Windows installer, “roster always matches between profiles,” dark-web messenger branding, Tor Verified, or video conferencing.

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

**GIF:** [`auth_unlock_1.gif`](../../gifs/auth_unlock_1.gif) · optional create: [`auth_create_1.gif`](../../gifs/auth_create_1.gif)

**Verified (Phase 1):** R2 cold unlock **VERIFIED t4** · O-2 DM cold restart **VERIFIED t4**.

---

## Segment 3 — Direct messaging (3 min)

| Step | Action | Pass when |
|------|--------|-----------|
| 3.1 | Open DM thread · send short text | Message appears in thread |
| 3.2 | Optional: second profile or note dual-tester deferral | Receive path if two clients running |
| 3.3 | Mention SQLite persistence | “Native history survives restart on paths we tested.” |

**GIF:** [`e2e-dm-base_1.gif`](../../gifs/e2e-dm-base_1.gif) · polish: [`search_message_history_1.gif`](../../gifs/search_message_history_1.gif)

**Do not demo:** Delete-for-me as “gone forever” — ACC-01 accepted limitation.

---

## Segment 4 — Relay & settings (2 min)

| Step | Action | Pass when |
|------|--------|-----------|
| 4.1 | Settings → Relays | Local relay or coordination URL visible |
| 4.2 | Community membership sync mode | Coordination preferred when URL set |
| 4.3 | One sentence on transport | “Relay carries ciphertext; coordination directory owns membership deltas on private-trust stacks.” |

**GIF:** [`relay_overview_1.gif`](../../gifs/relay_overview_1.gif) · [`relay_enable_disable_1.gif`](../../gifs/relay_enable_disable_1.gif) · [`settings_panel_1.gif`](../../gifs/settings_panel_1.gif)

**Live stack (if group segment follows):** See [private-trust-local-setup.md](../private-trust-local-setup.md) — coordination `:8787` · relay `ws://localhost:7000`.

---

## Segment 5 — Multi-profile (2 min)

| Step | Action | Pass when |
|------|--------|-----------|
| 5.1 | Profile switcher or second window | Distinct profile chrome |
| 5.2 | Same machine, isolated state | No ambient “current user” bleed in UI |

**GIF:** [`export_local_profile_1.gif`](../../gifs/export_local_profile_1.gif) · import · isolation GIFs in [inventory](./gif-inventory.md)

---

## Segment 6 — Group community (5 min) — **live preferred** · **Part 9 / Segment I**

This segment proves Phase 1C **VERIFIED t4** (dual-profile send/receive). Requires two profiles + coordination (+ relay for chat).

**Recording brief:** [segment-i-community-group-chat-v1.9.16.md](./segment-i-community-group-chat-v1.9.16.md) — packaged exe + **Docker** relay for the take; VO must say Docker is demo/dev infrastructure and recommend a **VPS / dedicated pool** for production.

| Step | Actor | Action | Pass when |
|------|-------|--------|-----------|
| 6.1 | Tester1 | Create managed workspace · invite Tester2 | Invite accepted |
| 6.2 | Both | Open group thread | Compose enabled — no “Room key missing” chrome (R1 **VERIFIED t4**) |
| 6.3 | Tester1 | Send `demo-<timestamp>` | Bubble in T1 thread |
| 6.4 | Tester2 | Same thread | Message visible — sidebar preview may lag thread (R3 **VERIFIED t4** post-fix; mention honestly if stale) |
| 6.5 | Both | Participants modal | **Do not** claim roster parity — ACC-02 accepted |

**GIFs:** [`community_group_send_receive_1.gif`](../../gifs/community_group_send_receive_1.gif) · full suite in [group-chat-gif-shot-list.md](./group-chat-gif-shot-list.md)

**Short path (no live stack):** Show Phase 1C chain reference in handoff · skip live send · state limitation.

---

## Segment 7 — Media & voice (optional, 2 min)

| Step | Action | Pass when |
|------|--------|-----------|
| 7.1 | Attach image or file in DM | Upload progress + render |
| 7.2 | Voice note or call surface | UI loads — do not claim full PSTN parity |

**GIFs:** [`multimedia_files_upload_and_transfer_1.gif`](../../gifs/multimedia_files_upload_and_transfer_1.gif) · [`send_voice_note_1.gif`](../../gifs/send_voice_note_1.gif) · [`start_a_voice_call_1.gif`](../../gifs/start_a_voice_call_1.gif) — [inventory](./gif-inventory.md)

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
