# Obscur v2 — known limitations (presenter sheet)

**Status:** Active (2026-07-04)  
**Audience:** Maintainers, demo hosts, support — honest product truth after Phase 1 verification  
**Register:** [unified-verification-issues-register.md](./unified-verification-issues-register.md) · **Scope:** [version-roadmap-scope.md](./version-roadmap-scope.md)

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

### Display-only / open repair rows

| Symptom | Layer | Status |
|---------|--------|--------|
| Sidebar preview “No messages yet” while thread shows full history | UI preview vs SQLite hydrate | **R3** — open |
| Post cold-restart password unlock may require Import Key | Auth / keychain band | **R2** — next repair row |
| ~~Sidebar “Room key missing” while send works~~ | Health hook vs send owner | **R1 VERIFIED t4** — do not demo as broken |
| Tor HTTP mesh / onion DM on this host | Conduit Mesh C13 L3 | **BLOCKED** — Tor bootstrap TLS ~10% |
| Chat → Save to Vault hidden | Vault Phase 6b | **OFF** until [v1.9.13](./v1.9.13-scope.md) |

---

## Paused / cancelled bands (no agent patches)

| Band | Policy |
|------|--------|
| COM-RUN-01 roster | **PAUSED** — integration study |
| COM-RUN-02 room-key repair | **Cancelled** |
| Community feature patches | **PAUSED** unless handoff charter |
| Vault chat→save flag flip | **PAUSED** — [v1.9.13-scope](./v1.9.13-scope.md) |

---

## Optional / deferred (not blocking v2 Phase 2–3)

| ID | Topic |
|----|--------|
| MED-001 / MED-002 | Media relink / ghost voice — not re-run Phase 1C |
| P1 Android Tier 1 | Pending or blocked_env — Phase 3 packaging |
| P-sign minisign | Deferred to Phase 3 |

---

## Suggested demo language

- “Obscur is **privacy-first** desktop software; production web is **disabled**.”
- “Group messaging works on **managed workspace + relay** stacks we verify in dev — roster display between profiles may disagree (known, accepted).”
- “Native message history **survives restart** on desktop SQLite paths we tested; account **restore** and **delete-for-me** have documented limits.”

---

## Links

| Doc | Role |
|-----|------|
| [obscur-native-sqlite-policy.md](./obscur-native-sqlite-policy.md) | Native persistence owners |
| [obscur-v2-roadmap-2026-07.md](./obscur-v2-roadmap-2026-07.md) | Phase queue (runtime repair band) |
| [obscur-v2-phase2-docs-charter.md](./obscur-v2-phase2-docs-charter.md) | Phase 2 doc tasks (**EXIT**) |
| [obscur-v2-install-build-guide.md](./obscur-v2-install-build-guide.md) | Build / install |
