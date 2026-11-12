# Platform rewrite band — charter (2026-11)

**Status:** Binding design charter under handoff **SUPERSEDE 2026-11** (maintainer confirmed)  
**Parents:** `docs/handoffs/current-session.md` · historical D0–S5 / `protocol-adaptation-layer-design-2026-10.md` (evidence, not ceiling)  
**Not:** Continuity UI impl · Tor Verified claim · Matrix promote · OAuth-as-root

```text
HANDOFF ATOMIC STEP: PLATFORM REWRITE BAND — charter (this doc) → first cut
SUPERSEDE:           strangler-only · no-mega-refactor · process-gate refusals for this band
CANONICAL OWNERS:    Platform kernel (auth · profiles · storage) · ProtocolAdaptationLayer · adapters
PROOF BEFORE DONE:   Named per cut (L1→L3); no “multi-protocol done” without proof
```

## 1. Product law

Obscur is a **platform shell** for private-trust / decentralized communication apps.

| Plane | Owns | Must not own |
|-------|------|----------------|
| **Auth** | Device unlock, recovery, session consent | Protocol wire formats |
| **Profiles** | Local account slots, display, isolation | Relay/server membership rules |
| **Storage** | At-rest PDK, LES/vault, export residue | Protocol event schemas |
| **ProtocolAdaptationLayer** | Ports: identity bind, send/list, sync hints, transport prefs | UI product identity |
| **Adapters** | Nostr (Obscur-Nostr), Matrix (lab), private DC / custom server, later P2P/Tor | Auth daily UX |

**Daily human door** stays passphrase / device-password primary. Cryptographic keys are recovery / adapter material — not the default login theater.

### 1.1 Security law (binding)

| Law | Requirement |
|-----|-------------|
| **Censorship / surveillance resistance** | Architecture favors private-trust / own infra, optional hardened transports, and minimal mandatory metadata leak. Tor/Verified claims only with proof. |
| **Hard profiles** | Technical compromise of one profile must not freely yield another’s keys, DB, or media. At-rest PDK + path isolation. Social engineering is out of band (ASE). |
| **Sandboxed inbound storage** | Files received in DM/group land in a **quarantine** plane — no execute, no write into identity/LES roots, policy before preview, explicit consent before “open externally.” |

Design: [sandboxed-storage-security-design-2026-11.md](./sandboxed-storage-security-design-2026-11.md).

## 2. Target shape

```text
┌─────────────────────────────────────────────────────────┐
│  Shell (Tauri + PWA UI) — product face                  │
├──────────────┬──────────────┬───────────────────────────┤
│ Auth         │ Profiles     │ Storage (+ quarantine)    │
│              │ (hard iso.)  │                           │
├──────────────┴──────────────┴───────────────────────────┤
│ ProtocolAdaptationLayer (ports + canonical DTOs)        │
│ + transport prefs (clearnet / Tor when chartered)       │
├──────────┬──────────┬─────────────┬─────────────────────┤
│ Nostr    │ Matrix   │ Private DC  │ Future P2P / Tor    │
│ adapter  │ (lab)    │ / custom    │ (chartered later)   │
└──────────┴──────────┴─────────────┴─────────────────────┘
```

- **Prefer in-repo evolution** (rename, extract, delete parallel owners).
- **Greenfield slice** only when a cut’s design explicitly says a package/app boundary is cheaper than extraction.
- Stack/language changes allowed **inside a cut’s design** — not as an unscoped “rewrite everything in X” whim.

## 3. What SUPERSEDE allows vs still forbids

| Allow | Forbid |
|-------|--------|
| Mega-refactor / file moves / renames in the band | OAuth as identity root |
| Behavior-changing cuts when design says so | Claiming multi-protocol / Tor / Matrix “done” without proof |
| Ignoring project process gates that block the band | Mass-deleting global skills or all `docs/` / `.agent/` |
| Optional greenfield **slice** if cut design requires | Silent deletion of published beta / desktop shell |
| Protocol and feature renaming | Continuity / Soft L3 / Spaces promote without design+proof |

## 4. As-built leverage (do not romanticize or ignore)

- D0–S5 strangler + `@obscur/protocol-nostr` + `protocol-adaptation/*` — **starting seams**, not the finished OS.
- Single-door A+B+C + unlock-loop FM1 — daily door direction; L3 soak still owed.
- Matrix access-token — **lab only** until Olm-class design+proof.
- Private-trust / own infra positioning — desired face for “company DC” carrier.

## 5. Cuts (ordered)

| Cut | Intent | Exit |
|-----|--------|------|
| **P0** | This charter accepted; handoff points here | Doc only |
| **P1** | **Boundary map** — list canonical owners vs parallel writers for Auth / Profiles / Storage / PAL; subtraction list | Spec + inventory |
| **P2** | **Auth plane freeze** — daily password door stable (L3 soak); key = Advanced/recovery only in shell copy | L3 desktop |
| **P2-S** | **Sandboxed storage S1–S2** — inbound MIME policy + per-profile quarantine dir (after P1 names Storage owner) | L1/L2 + desktop L3 self-send file |
| **P3** | **PAL port freeze** — one send/list/identity port surface; Nostr adapter behind it; kill bypass imports | L1/L2 contracts |
| **P4** | **Second carrier spike** — private DC / custom server **or** Matrix lab promotion path (pick one in cut design) | Design + L1 spike |
| **P5** | Naming pass (modules/packages) once P3 stable | L1 |

Do not start P4 before P1–P3 have an accepted design for that cut. P2-S may run after P1 in parallel with P2 if Storage owner is clear.

## 6. First atomic cut (next impl session)

**P1 — Boundary map (spec only, then smallest deletions):**

1. Inventory import graphs: who calls Nostr types from Auth/Profiles/Storage UI.
2. Name one owner per plane; list parallel writers to subtract.
3. Draft `specs/backend/platform-boundary-map-2026-11.md` with kill list (files/modules), not a new framework layer.

## 7. Non-claims

- Obscur is **not** yet a multi-protocol framework shipping Nostr+Matrix+P2P+Tor.
- Decoupling is **in progress under rewrite band**, not complete.
- Uniqueness = private-trust platform + human door + adapters — not “another Nostr client” marketing, and not vapor multi-protocol.
- Security law is **direction + design**, not “uncensorable / unhackable” or Tor Verified / AV replacement.

## 8. Status

- Charter: **written** (P0) · security law + sandbox design linked
- P1: **written** — [platform-boundary-map-2026-11.md](./platform-boundary-map-2026-11.md)
- K1–K4 + P2-S S1–S4/S2b + P3 L1 + P2 L1 door fence + S5 L2: **landed**
- P4: **private_dc L1 + P4b HTTP wire landed** (Matrix promote still PAUSED) — [platform-p4-second-carrier-design-2026-11.md](./platform-p4-second-carrier-design-2026-11.md) · [platform-p4b-private-dc-http-wire-design-2026-11.md](./platform-p4b-private-dc-http-wire-design-2026-11.md)
- S5: **L3 Pass** — [p2s-s5-dual-profile-fs-l3-soak-2026-11.md](./p2s-s5-dual-profile-fs-l3-soak-2026-11.md)
- P5: **naming L1 landed** — [platform-p5-naming-design-2026-11.md](./platform-p5-naming-design-2026-11.md) (glossary · Settings · no mass path rename)
- P2: **daily-door L3 Pass** — [platform-p2-daily-door-l3-soak-2026-11.md](./platform-p2-daily-door-l3-soak-2026-11.md)
- P4c: **private_dc L2 lab Pass** — [platform-p4c-private-dc-l2-lab-soak-2026-11.md](./platform-p4c-private-dc-l2-lab-soak-2026-11.md)
- P6: **plane README fences L1** — [platform-p6-plane-readme-fences-design-2026-11.md](./platform-p6-plane-readme-fences-design-2026-11.md)
- K6: **SendConfirmation PAL export L1** — [platform-k6-send-confirmation-pal-design-2026-11.md](./platform-k6-send-confirmation-pal-design-2026-11.md)
- P4d: **private_dc adapter CDP Pass** — [platform-p4d-private-dc-adapter-cdp-soak-2026-11.md](./platform-p4d-private-dc-adapter-cdp-soak-2026-11.md)
- P4e: **private_dc send profile scope L1** — [platform-p4e-private-dc-send-profile-scope-2026-11.md](./platform-p4e-private-dc-send-profile-scope-2026-11.md)
- P4f: **private_dc connect + listMessages scope L1** — [platform-p4f-private-dc-connect-list-scope-2026-11.md](./platform-p4f-private-dc-connect-list-scope-2026-11.md)
- P4g: **private_dc rich listDm* shim L1** — [platform-p4g-private-dc-rich-list-shim-2026-11.md](./platform-p4g-private-dc-rich-list-shim-2026-11.md)
- S4: **inbound export L3 Pass** — [p2s-s4-inbound-export-l3-soak-2026-11.md](./p2s-s4-inbound-export-l3-soak-2026-11.md)
- S2: **quarantine persist L3 Pass** — [p2s-s2-quarantine-persist-l3-soak-2026-11.md](./p2s-s2-quarantine-persist-l3-soak-2026-11.md)
- S3: **inbound preview L3 Pass** — [p2s-s3-inbound-preview-l3-soak-2026-11.md](./p2s-s3-inbound-preview-l3-soak-2026-11.md)
- K7: **CanonicalSendConfirmation L1** — [platform-k7-canonical-send-confirmation-design-2026-11.md](./platform-k7-canonical-send-confirmation-design-2026-11.md)
- K8: **onConfirmed Canonical-only L1** — [platform-k8-onconfirmed-canonical-design-2026-11.md](./platform-k8-onconfirmed-canonical-design-2026-11.md)
- Milestone: [platform-rewrite-band-milestone-closeout-2026-11.md](./platform-rewrite-band-milestone-closeout-2026-11.md)
- P7: **first Obscur-Nostr body leaf L1** — [platform-p7-obscur-nostr-body-extract-2026-11.md](./platform-p7-obscur-nostr-body-extract-2026-11.md)
- P7b: **capabilities leaf L1** — [platform-p7b-obscur-nostr-capabilities-extract-2026-11.md](./platform-p7b-obscur-nostr-capabilities-extract-2026-11.md)
- P7c: **display + migration hints L1** — [platform-p7c-obscur-nostr-hints-display-2026-11.md](./platform-p7c-obscur-nostr-hints-display-2026-11.md)
- P4h: **private_dc capabilities + rich map L1** — [platform-p4h-private-dc-capabilities-rich-map-2026-11.md](./platform-p4h-private-dc-capabilities-rich-map-2026-11.md)
- C3: **Matrix lab caps + rich map L1 (not promote)** — [platform-c3-matrix-capabilities-rich-map-2026-11.md](./platform-c3-matrix-capabilities-rich-map-2026-11.md)
- Feedback readiness: [platform-public-feedback-release-readiness-2026-11.md](./platform-public-feedback-release-readiness-2026-11.md)
- Official Beta: **v2.0.0-beta.11 Published** · Full Release Pass [43147384440](https://github.com/Dendro-X0/Obscur/actions/runs/43147384440) · Continuity Pass / Soft L3 Fixed **not** claimed
- Next: maintainer-directed cut (P7d pure leaf · or P7 send/list design · or private_dc operator soak) · Soft L3 / Tor / Matrix promote still PAUSED
- Impl under rewrite band: **in progress** (not map-only)
