# Investigation — Backend parallel-path audit (unify owners · no UI edits)

**Status:** Investigation complete · Priority 1–2 slice Done · 2026-07-31  
**Charter intent:** Product decentralization ≠ codebase decentralization. Unify backend; subtract redundant paths; UI is **functional reference only** (no UI feature churn).  
**Related:** [obscur-backend-engine-roadmap](../../docs/program/obscur-backend-engine-roadmap.md) · [rust-module-refactor-queue](./rust-module-refactor-queue-2026-07.md) · [production-rewrite-and-devlab-tombstone](./production-rewrite-and-devlab-tombstone-2026-07.md) · [gif-inventory](../../docs/assets/demo/v2.0.0/gif-inventory.md) (objectives only) · [truth map](../../docs/encyclopedia/12-core-architecture-truth-map.md) · [design](./backend-truth-map-and-publish-inject-design-2026-07.md)

---

## Session gate

```text
HANDOFF ATOMIC STEP:  Backend parallel-path audit (maintainer redirect)
PAUSED / CANCELLED:   community · AUTH-SESSION-1 · Dev Lab · GIF/client re-validation as primary
CANONICAL OWNER:      One owner per lifecycle — engine_invoke / Rust mesh / auth-kernel
PROOF BEFORE DONE:    This register + ranked subtract list (no UI diffs)
OUT OF SCOPE:         Frontend UI edits · Dev Lab revival · claiming features fixed from soaks alone
```

---

## Method

1. Take **UI/GIF stems** as *objectives* (what the product must eventually do).  
2. For each lifecycle, name **canonical backend owner** vs **parallel / leftover writers**.  
3. Rank by: blocks production feedback loop · still dual on release path · PAUSED but still in ACL · docs lie.

No product UI code in this slice.

---

## A. Functional objectives (UI reference → backend)

| Objective (GIF / product) | Canonical backend today | Parallel / residue |
|---------------------------|-------------------------|-------------------|
| Auth unlock / create / cold restore | `auth-kernel-boot-owner` + Rust `auth_boot_snapshot` / session | Dead Dev Lab unlock paths (tombstoned scripts) |
| DM send / thread / search | `dm-engine` via `engine_invoke` | Legacy hydrate assemblers still thick in messaging (truth-map R1 interim) |
| Relays connect / publish | Rust conduit mesh + `engine_invoke_transport_*` | `relay-browser-pool-runtime` / standalone publish port still importable; types named `enhanced-relay-pool*` |
| Settings / transport presets | Mesh presets + transport-engine | Soft UI only — OK if publish owner is mesh |
| Profile export/import | Offline pack IPC (RUST-6) + account-sync | Multiple backup evidence collectors still call **group** bare `db_*` |
| Vault / media | LES + `persistence.*` vault | Legacy vault `db_*` tombstoned |
| Contacts | Network / account projection | Not dual-IPC primary in Slice 24 |
| Voice / call records | `persistence.*` call | Call UI adapters — backend insert path Done |
| **Groups / community** | **None unified** — PAUSED bare `db_*` | `community-group-sqlite-store`, `group-thread-*`, invite pipeline, backup evidence |

---

## B. Dual / parallel path register (code evidence)

### B1 — Persistence IPC (highest clarity)

| Lifecycle | Canonical | Parallel still present | Gate |
|-----------|-----------|------------------------|------|
| DM insert/read/delete | `engine_invoke` `dm.*` | — (non-PAUSED Done) | Closed |
| Checkpoints | `transport.*` | — | Closed |
| Vault media | `persistence.*` | — | Closed |
| Call | `persistence.*` | — | Closed |
| Search / wipe | `persistence.*` | — | Closed |
| **Group messages / groups** | *Should be* workspace/dm engine | `dbGetGroupMessages`, `dbInsertGroupMessage`, `dbUpsertGroup`, `dbGetGroups`, `dbInsertGroupTombstone` | **PAUSED** |
| **Community invite DM** | `dm.insertMessage` via `writeDmKernel*` | — (U1 Done 2026-07-31) | Closed |
| Backup group evidence | Should not widen dual owner | `native-sqlite-backup-evidence` → `dbGetGroups` / `dbGetGroupMessages` | PAUSED band |

**Files (examples):**  
`community-dm-invite-pipeline.ts` · `community-group-sqlite-store.ts` · `group-thread-append.ts` · `group-thread-suppress.ts` · `group-thread-sqlite-store.ts` · `account-group-sqlite-evidence.ts` · `native-sqlite-backup-evidence.ts`

### B2 — Transport publish (feedback-loop risk)

| Lifecycle | Canonical | Parallel still present | Risk |
|-----------|-----------|------------------------|------|
| Product publish | Rust mesh / `engine_invoke_transport_publish_*` | `relay-browser-pool-runtime.publishToUrls` · `publishToUrlsStandalone` · subtracted port that still calls browser runtime | Edit mesh → UI may still publish via browser pool if host injects legacy pool |
| Community activation publish | Should use mesh pool | `community-workspace-activation` calls `pool.publishToUrls` | Whatever pool is injected wins |
| Invite publish | — | `invite-manager` → `publishToUrlsStandalone` | Second publish entry |

**Symptom class:** “Changed relay code, production UI unchanged” when the live inject is still browser/standalone.

### B3 — Auth / session

| Lifecycle | Canonical | Parallel | Risk |
|-----------|-----------|----------|------|
| Boot restore | `auth-kernel-boot-owner` | Dev Lab programmatic unlock (tombstoned) | Low if lab off |
| Cold hydrate | Same + matching keychain | Fixture mismatch (DemoUser≠Tester1) looked like dual path | Align fixture; not a second owner |

### B4 — Documentation / “owner map” drift (meta dual-truth)

| Doc | Problem |
|-----|---------|
| `docs/encyclopedia/12-core-architecture-truth-map.md` | **Refreshed 2026-07-31** — owners = auth-kernel · dm-engine · conduit mesh · transport-kernel · persistence; groups PAUSED |
| `docs/encyclopedia/14-module-owner-index.md` | Relay transport row updated away from `enhanced-relay-pool.ts` |
| Queue Slice 4/5 “next” | May still lag handoff — prefer handoff atomic step |

**L1 pin:** `product-publish-inject.contract.test.ts` + `relay-publish-owner.contract.test.ts` (10 Pass).

---

## C. Ranked subtract / unify queue (backend only)

| Priority | Action | Why |
|----------|--------|-----|
| **1** | **Refresh truth map** (docs only) — canonical owners = auth-kernel · dm-engine · transport/mesh · persistence · workspace (PAUSED noted) | Stops wrong-path patches |
| **2** | **Transport inject audit** — prove release shell’s DM/group publish uses mesh/`engine_invoke_transport_*` only; quarantine `publishToUrlsStandalone` / browser pool from product inject | Fixes “edit invisible” for relays |
| **3** | **Delete or quarantine Dev Lab tree** | **Product quarantine Done 2026-07-31** — bridges unmounted; tree deletion = Phase 3 later |
| **4** | **Community un-pause integration study** *or* mark group objectives out-of-ship | **Study Done 2026-07-31** — [community-unpause-integration-study-2026-07.md](./community-unpause-integration-study-2026-07.md); **band remains PAUSED**; first charter candidates U1 invite→dm-engine or U3 Slice C |
| **5** | Shrink DM hydrate interim assemblers (R1) toward dm-engine sole read | **Done 2026-07-31** — shrink + UI delete + Wave 2/3 · [Wave 3](./r1-wave3-helpers-deletion-design-2026-07.md) |

**Do not:** GIF re-soak / UI polish as primary queue while 1–2 open.

---

## D. Claim language

| May say | When |
|---------|------|
| Audit complete | This file + handoff checkpoint |
| Backend unified for domain X | Single owner on release path + parallel deleted/quarantined + L1/L3 agree |
| Feature production-ready | Unified backend **and** release L3 — never Dev Lab |

---

## Next atomic step

**Done (2026-07-31):** Truth-map refresh + product publish inject L1 pin — [design](./backend-truth-map-and-publish-inject-design-2026-07.md).

1. Optional: quarantine/delete Dev Lab tree residue (scripts already exit 1).  
2. Community un-pause integration study *or* mark group objectives out-of-ship.  
3. Shrink DM hydrate interim assemblers (R1) toward dm-engine sole read.

**Do not:** GIF re-soak / UI polish as primary while community PAUSED dual leftover remains.
