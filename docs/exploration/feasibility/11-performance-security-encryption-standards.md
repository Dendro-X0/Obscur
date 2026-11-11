# Feasibility — Performance · security · encryption standards

**ID:** F-PSE  
**Status:** draft  
**Date (UTC):** 2026-11-09  
**Charter:** `specs/backend/platform-feasibility-exploration-charter-2026-11-08.md`  
**Parents:** `00-aggregator-adaptation-law.md` · `09-ideal-stack-thought-experiment.md` · `10-external-e2ee-protocol-sources.md` · `specs/backend/sandboxed-storage-security-design-2026-11.md`  
**Claim language:** **standards draft** ≠ adopted stack ≠ implemented ≠ Pass / Tor Verified / “unbreachable”

## 1. Scope

- **In:** Rigorous **non-functional** standards the rewrite must satisfy across **performance**, **security**, and **encryption** — so F2–F8 / F9 cuts can be judged against measurable laws, not vibes.
- **Out:** Picking Signal vs MLS this week; Soft L3 contact Pass; claiming current PWA/Tauri tree already meets these bars.

## 2. Basics

Three axes, one product law: **Obscur owns the account plane; carriers move bytes.**

| Axis | Question every cut must answer |
|------|--------------------------------|
| **Performance** | Where do CPU, memory, disk, and network costs live — and are we paying a **bridge tax**? |
| **Security** | What is trusted, isolated, quarantined, or refuseable — independent of which carrier is on? |
| **Encryption** | Which confidentiality / integrity / FS / PCS / metadata properties are **promised**, by which plane, with which honest labels? |

**Unifying rule:** better code over more code. Extra layers that re-encode the same DTOs, re-parse the same events in JS *and* Rust, or re-derive contacts from ciphertext are **security and performance bugs**, not features.

## 3. Capabilities map

| Need | Standard | Anti-pattern |
|------|----------|--------------|
| Peak runtime efficiency | Crypto, sync, SQLite, parsing in **one** Rust kernel hop | JS domain logic mirroring kernel; N-hop “adapter of adapters” |
| Extensible carriers | Adapter implements ports; **O(1)** kernel change for new carrier | Hard-coding event kinds into relationship / auth |
| Honest security UX | Labels match crypto tier (see §6) | “E2EE” for NIP-17-only without FS/PCS disclaimer |
| Profile isolation | Per-profile keys + DB paths; no silent cross-read | Shared caches keyed only by pubkey across profiles |
| Inbound hostility | Quarantine sandboxed media/files (existing design) | Auto-trust / auto-open from carrier payloads |
| Rewrite maintainability | One feature ≈ one module; subtract parallel owners | Compatibility bridges that freeze false owners |

## 4. Fit to planes

| Plane | Performance | Security | Encryption |
|-------|-------------|----------|------------|
| Auth | Unlock path bounded; no sync on cold door | Universal door; no OAuth-as-root | Unlock secrets never leave kernel; UI gets session capability only |
| Profile | Switch = path swap, not full reindex of all carriers | Hard isolation | Distinct key material / vaults per profile |
| Storage / DB | Indexed queries; no full-table decrypt scans for CRM | Carrier ciphertext ≠ relationship truth | At-rest: OS + app vault policy (F8); message keys local |
| Relationship | Local graph ops; **never** O(history) relay lookback for TRUSTED | First-class; invite/accept only | Relationship edges are **not** encrypted carrier artifacts |
| Message | Batch decrypt; backpressure; skip poison events | Size / type limits; quarantine attachments | Tiered crypto policy (below) |
| Transport | Multiplex with budgets; redundant delivery optional | Underlay ≠ identity | TLS/Tor separate from E2EE content keys |

## 5. Libraries / stacks (constraints, not picks)

| Constraint | Why |
|------------|-----|
| Prefer **audited** crypto crates / protocols (Signal family, MLS/OpenMLS, vodozemac, NIP-44 as *format* only) | No home-grown ratchets |
| Prefer Rust for hot path | Matches F-stack; reduces secret-in-JS-heap default |
| One IPC schema | Performance + smaller attack surface |
| SQLite stays | Known cost model; profile-scoped files |

Exact library choice remains F5 / F8 / F9.

## 6. Feasibility verdict

`fit-with-adapter` **as engineering law for the rewrite band** — contingent on F9 GO/NARROW adopting these bars as cut acceptance criteria.

Why: Performance, security, and encryption fail together when the product lies about owners (CRM-on-history, bridge towers, “E2EE” without FS). Standards below are the acceptance language; carriers that cannot meet a tier must be **labeled down**, not silently upgraded by marketing.

### 6.1 Encryption tiers (honest product labels)

| Tier | Properties (minimum) | Typical mapping (examples — not adoption) | User-facing honesty |
|------|----------------------|---------------------------------------------|---------------------|
| **T0 Clear / transport-only** | Server/relay may read | Public notes, unencrypted rooms | Never call E2EE |
| **T1 Payload confidentiality** | Content ciphertext; **no** FS/PCS guarantee on long-term key compromise | NIP-44 static conversation key; sealed content without ratchet | “Encrypted content” — **not** “Signal-grade” |
| **T2 Envelope-aware** | T1 + gift-wrap / sealed-sender style metadata reduction | NIP-17 + NIP-59 | “Private DMs (limited recovery if key leaks)” |
| **T3 Session E2EE** | Per-message (or fine-grained) keys; **FS**; preferably **PCS** | Signal Double Ratchet / Olm; PQ handshake optional | “End-to-end encrypted (forward secrecy)” |
| **T4 Group E2EE** | Group AKE or honest Megolm trade-offs documented | MLS (RFC 9420) preferred for PCS at scale; Megolm if Matrix-native with known limits | Name the model; document PCS limits |

**Law:** Kernel policy selects the **tier promised** for a conversation; adapter may only **downgrade with UI consent**, never silently claim a higher tier.

### 6.2 Security invariants (non-negotiable)

1. **Relationship authority** — TRUSTED / Requests / Remove live in kernel DB; never inferred from decrypt success (F1).
2. **Hard profiles** — technical isolation of keys, DB, caches, carrier sessions.
3. **Least privilege UI** — TS shell does not hold long-term identity or ratchet secrets by default.
4. **Inbound quarantine** — files/media from carriers enter sandbox until explicit user action (`sandboxed-storage-security-design`).
5. **No marketing supersede** — Tor Verified / multi-protocol done / unbreachable stay forbidden until named proof.
6. **Adapter blast radius** — compromise or bug in one carrier crate must not grant write access to other carriers’ sessions or foreign profiles.

### 6.3 Performance invariants (non-negotiable)

1. **One-hop IPC** — UI ↔ kernel contract; no duplicate business pipelines.
2. **No CRM-by-scan** — contact/state queries are local indexes; forbidden: decrypt N events to discover relationships.
3. **Hot path in kernel** — encrypt/decrypt, verify, SQLite, sync scheduling.
4. **Bounded work** — per-conversation and global decrypt/sync budgets; poison-pill events isolated.
5. **Lazy carriers** — disabled adapters cost ~zero CPU/network; enabling one must not wake all others.
6. **Measurable gates** — each rewrite cut names L1 (unit/bench) and at least one runtime proof for the hot path it claims to fix (F9 cut designs).

### 6.4 Combined failure modes (design against these)

| Failure | Performance symptom | Security / crypto symptom |
|---------|---------------------|---------------------------|
| Bridge tower | Double parse, GC pressure, UI jank | Secrets or policy duplicated incorrectly |
| History-as-CRM | Relay fan-out + mass decrypt | False TRUSTED / vanished pending |
| Wrong tier label | User over-trusts; support load | Key leak decrypts “all past/future” while UI said “secure” |
| Always-on all carriers | Battery / relay bans / CPU | Larger attack surface; correlation across protocols |
| Crypto in UI | Main-thread stalls | Secret material in webview dumps |

## 7. Risks / traps

- Optimizing UI frames while leaving **O(history)** relationship recovery on relays.
- “We’ll add E2EE later” while shipping T1 labeled as T3.
- Copying Marmot/Signal/Matrix **wholesale** (product coupling) instead of **ports + tier policy**.
- PQ fashion (Kyber everywhere) before T3 basics and multi-device are specified.
- Tor underlay treated as encryption tier (it is **transport anonymity**, not content E2EE).

## 8. Open questions

1. Launch face default tier: **T2** (Nostr private DM adapter) vs **T3** (Obscur-owned ratchet, carrier as delivery only)?
2. Group path: MLS-first (T4) vs defer groups until 1:1 T3 is solid?
3. At-rest encryption of SQLite: OS file protection only vs app-level SQLCipher-class (F8)?
4. Multi-device session model (Sesame-like vs Matrix devices vs Marmot) under hard profiles?
5. Perf SLOs for desktop soak: p95 decrypt latency / sync CPU % — set numeric targets at F9 cut design, not here.

## 9. References

- `docs/exploration/feasibility/10-external-e2ee-protocol-sources.md` (NIP-44/17/59, Signal, MLS, Matrix, Marmot, SimpleX)
- `docs/exploration/feasibility/09-ideal-stack-thought-experiment.md`
- `docs/exploration/feasibility/01-relationship-authority.md`
- `specs/backend/sandboxed-storage-security-design-2026-11.md`
- NIP-44 limitations (FS/PCS/deniability) — linked from F-sources
- RFC 9420 / Signal Double Ratchet — linked from F-sources
