# Obscur v2 — known limitations (presenter sheet)

**Status:** Active (2026-08-23) · **Beta:** [v2.0.0-beta-release.md](../releases/v2.0.0-beta-release.md)  
**Audience:** Maintainers, demo hosts, support — honest product truth after Phase 1 verification  
**Register:** [unified-verification-issues-register.md](../archive/program/inactive-2026-08/unified-verification-issues-register.md) · **Scope:** [version-roadmap-scope.md](./version-roadmap-scope.md)

---

## What Phase 1 verified (summary)

| Area | Status | Evidence |
|------|--------|----------|
| Native DM + group SQLite (P3) | **Verified** | Phase 1D cold-restart soak · `verify:phase2` · `verify:p5-persistence` |
| Dual-profile group send/receive (O-4 / COM-RUN-11) | **Verified t4** | Phase 1C chain `chain-com-run-11-phase1c-2026-07-04` |
| Group room-key health chrome (R1) | **Verified t4** | Round `2026-07-04-r1-room-key-health-t4` · health hook = send owner |
| DM cold restart (O-2) | **Verified t4** | Phase 1C + Phase 1D digest |
| SEC V1–V3, V5 | **Pass** | Maintainer checklist §1–§5 @ `4d000257` |
| Coordination leave / re-invite (K3) | **Partial** | Coordination OK · excluded UI band on leave |

---

## Accepted limitations (do not claim fixed)

### ACC-01 — Delete-for-me vs restore / web parity

**User-visible:** “Delete for me” may not survive **account restore** or **web/desktop parity** paths the same way as native SQLite cold restart.

**Detail:** [deletion-roster-limitations.md](../messaging/deletion-roster-limitations.md) §1  
**Native desktop (P3b):** cold-restart soak **passed** on Tester1 — do not over-generalize to restore/import.  
**Policy:** Prefer honest copy (“hide on this device”) where restore convergence is untested.

### ACC-02 — Community roster / membership display (COM-RUN-01)

**User-visible:** Creator and joiner can show **different member lists** or participant chrome after invite/join on the same community.

**Status:** **Accepted** @ Phase 1D row 1 — integration study band; **no patch** until study completes.  
**Spec:** [community-roster-read-owner-spec-2026-06.md](../archive/program/inactive-2026-06/community-roster-read-owner-spec-2026-06.md)

### SEC-V4 — AB-15 restore leak boundary

**Status:** **Accepted** @ REL-002 — 3× contract drift in `community-ab-restore-historical.test.ts`.  
**Gate:** `pnpm verify:sec-v1.9.5` fails on SEC-V4 only.

### COM-RUN-07 — Multi-owner membership graph

**Status:** Open P1 — parallel read/write owners for roster projection vs coordination directory.  
**Do not:** patch roster display as “low priority” while band is PAUSED.

### Display-only / repair rows (Phase 1 status)

| Symptom | Layer | Status |
|---------|--------|--------|
| Sidebar preview “No messages yet” while thread shows full history | UI preview vs SQLite hydrate | **R3 VERIFIED t4** — `3cf79dbe` · do not demo as open |
| Post cold-restart password unlock / Import Key loop | Auth / keychain band | **R2 VERIFIED t4** — `1ab19204` · edge restore bands may still show Import Key — say so honestly; do not claim R2 broken |
| ~~Sidebar “Room key missing” while send works~~ | Health hook vs send owner | **R1 VERIFIED t4** — do not demo as broken |
| Tor preference / onion path | Gateway TI landed · Verified **INFEASIBLE** here (blocked net · no testers) | Keep Tor **OFF** for clearnet; do not demo Tor Ready |
| Video calling / conference | **Not shipped.** 1:1 **voice call** + voice notes already shipped; missing = **usable video** (M1-L3) and **group / conference** (M2–M3). **M1-A/B/C** L1: callType · dock panes · camera fail → voice + honesty banner · optional **lab canvas** (dev only, not Gift). Do **not** claim video usable until L3 AV. | Demo voice + Gift GIFs for prior features; roadmap [pre-b2b-capability-and-media-roadmap-2026-10.md](./pre-b2b-capability-and-media-roadmap-2026-10.md) · camera-less eng [m1-video-camera-less-engineering-design-2026-10.md](../../specs/backend/m1-video-camera-less-engineering-design-2026-10.md) |
| Interest ↔ Team / host convert | CU-UX-2b…6 **L1** shipped; dual-profile L3 optional. Host change does **not** migrate history. Quiet Team = honesty, not enterprise directory / delete-for-all. | Demo create + Manage Mode & hosting; [cut plan](./v2.0.0-beta-cut-plan-2026-10.md) |
| Chat → Save to Vault | LES / Vault | Packaged soak **Pass** (2026-08-09) |

**Evidence:** [obscur-runtime-issue-tracker-2026-07](../archive/program/inactive-2026-08/obscur-runtime-issue-tracker-2026-07.md) (R1–R3 VERIFIED t4) · [demo README](../assets/demo/v2.0.0/README.md) Segment 2/6. Reopen only with a **new** fail repro.

### Crypto defaults (v2 beta)

| Path | Default | Notes |
|------|---------|-------|
| Outbound DM | **NIP-17 gift wrap (NIP-44)** | NIP-04 receive-only for legacy interop |
| Community room-key wrap | **NIP-44 (`obscur.nip44_room_key_wrap.v2`)** | V1 NIP-04 wraps still decrypt on import |
| Portable profile export | **NIP-44 self-encrypt** | Legacy bundles without `encryptionScheme` import as NIP-04 |
| Relay-published account backup | NIP-04 (unchanged) | Existing relay backups remain readable |

**Do not claim:** full metadata invisibility, traffic-analysis resistance by default, or independent crypto audit.

---

## Paused / cancelled bands (no agent patches)

| Band | Policy |
|------|--------|
| COM-RUN-01 roster | **PAUSED** — integration study |
| COM-RUN-02 room-key repair | **Cancelled** |
| Community feature patches | **CHARTERED** — CU-P1 Verified; no free `groups/**` without CU-P* |
| Tor Verified soak | **CANCELLED (infeasible)** — [tor-verified-infeasible-2026-08.md](../../specs/backend/tor-verified-infeasible-2026-08.md) · resume only with capable net/tester |
| Vault chat→save flag flip | Historical — Vault LES packaged Pass 2026-08-09 |

---

## Optional / deferred (not blocking v2 Phase 2–3)

| ID | Topic |
|----|--------|
| MED-001 / MED-002 | Media relink / ghost voice — not re-run Phase 1C |
| P1 Android Tier 1 | Pending or blocked_env — Phase 3 packaging |
| P-sign minisign | Deferred to Phase 3 |

---

## Suggested demo language

- “Obscur is **sovereign** desktop software — your keys, E2EE, operator infra you choose; production web is **disabled**.”
- “Pitch **clearnet private-trust** (cell VPS · group live). Tor is **optional underlay**, not identity — leave Tor **OFF** for clearnet demos.”
- “Do **not** say dark-web messenger / gray-market hub / onion-first GTM.”
- “ASE warnings are **on-device** — not cloud content police.”
- “**Open beta** ships NIP-17 DMs and NIP-44 room-key wraps — message bodies encrypt on your device; relays still see routing metadata.”
- “Voice notes + 1:1 **audio** only — **no usable video** / conferencing in this beta.”
- “Groups: **Interest** or **Team** — Quiet hosts need honesty ack; private VPS/DC for stronger team claims. Switching host does not migrate chat history.”
- “Group messaging works on **managed workspace + relay** stacks we verify in dev — roster display between profiles may disagree (known, accepted).”
- “Native message history **survives restart** on desktop SQLite paths we tested; cold unlock is **Verified** on those paths — account **restore** and **delete-for-me** still have documented limits (ACC-01).”

**PB1-D checklist:** [pb1d-positioning-honesty-checklist-2026-10.md](./pb1d-positioning-honesty-checklist-2026-10.md)

---

## Links

| Doc | Role |
|-----|------|
| [obscur-native-sqlite-policy.md](./obscur-native-sqlite-policy.md) | Native persistence owners |
| [obscur-v2-roadmap-2026-07.md](./obscur-v2-roadmap-2026-07.md) | Phase queue (runtime repair band) |
| [v2.0.0-beta-release.md](../releases/v2.0.0-beta-release.md) | Open beta release notes |
| [obscur-v2-phase2-docs-charter.md](../archive/program/inactive-2026-08/obscur-v2-phase2-docs-charter.md) | Phase 2 doc tasks (**EXIT**) |
| [obscur-v2-install-build-guide.md](./obscur-v2-install-build-guide.md) | Build / install |
