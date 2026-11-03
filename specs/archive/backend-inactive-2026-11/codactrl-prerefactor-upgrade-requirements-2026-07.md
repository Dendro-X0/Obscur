# CodaCtrl — Pre-refactor upgrade requirements for Obscur Rust backend

**Date:** 2026-07-29  
**Context:** Obscur backend rewrite in Rust · UI frozen · no dedicated QA team · solo maintainer  
**Audience:** CodaCtrl maintainer (upgrade target) + IDE agents (consumer after upgrade)  
**Related:** [codactrl-obscur-thorn-subjects-2026-07.md](./codactrl-obscur-thorn-subjects-2026-07.md) · [obscur-backend-engine-roadmap.md](../../docs/program/obscur-backend-engine-roadmap.md)

---

## What already works (do not regress)

These proved functional in MCP dogfood rounds 1–2:

| Capability | Tool | Status |
|------------|------|--------|
| Workspace alignment | `client_dev_environment_get` | ✓ |
| Verify boot artifacts | `verify_agent_boot_status` | ✓ |
| Architecture draft (TS packages) | `repo_architecture_draft` | ✓ 28 nodes / 55 edges |
| Repo explore snapshot | `repo_explore_run` | ✓ |
| Stress sandbox catalog | `sandbox_catalog_list` | ✓ 3 Obscur scenarios |
| Security-hygiene catalog | `sandbox_catalog_list` | ✓ 4 hygiene scenarios |
| FLS logic specs | `logic_spec_list` | ✓ community invariants + rule pack |
| FLS templates | `logic_template_list` | ✓ domain-invariants + static-rule-pack |
| False-green scan | `verify_false_green_scan` | ✓ (0 findings — no CI verify script yet) |
| Verify workflow guide | `verify_workflow_guide` | ✓ full trace-desk + interactive round |
| Perf explore + findings | `studio_perf` lane | ✓ |

---

## What fails or is missing (upgrade before refactor)

Grouped by consequence, not tool name.

---

### G1 — Owner conflict graph (CRITICAL for Rust refactor)

**Why it blocks the refactor:**  
The entire rationale for Rust-first is eliminating parallel owners. Without a machine-readable owner map, agents will rebuild the same parallel paths in Rust that failed in TS.

**Current state:** `studio_owner_conflicts_get` and `repo_explore_owner_conflicts` are declared in `studio_help` lane list but return `unknown method: repo.explore.ownerConflicts` at daemon RPC level.

**Needed before refactor starts:**

| Requirement | Detail |
|-------------|--------|
| **Owner conflict RPC** | `studio_owner_conflicts_get` → list of `{lifecycle, writers[], readers[], conflictSeverity}` rows |
| **Forbidden-writer rule** | IDE agent: refuse any Rust change that adds a second writer to an already-owned lifecycle |
| **Rust-aware scope** | Must cover Tauri command handlers (`commands/session.rs`, `commands/auth_boot.rs`) not just TS packages |
| **Output format** | ≤1 page maintainer read; machine JSON for agent consumption |

**Obscur lifecycles to map first:** session hydrate · relay publish · DM SQLite write · profile scope binding · keychain read/write

---

### G2 — Cargo/Rust workspace indexing (CRITICAL)

**Why it blocks the refactor:**  
`repo_profile_get` reports `crateCount: 0`. CodaCtrl's architecture draft covers the 28 TS packages but is blind to:
- `packages/libobscur/` (Rust core: crypto, net, persistence, keystore, protocol)
- `apps/desktop/src-tauri/` (Tauri host: commands, session, auth_boot, native_keychain)

A Rust refactor planned against a TS-only map will produce an architecture that doesn't match the actual codebase.

**Needed:**

| Requirement | Detail |
|-------------|--------|
| **Cargo workspace scan** | Index `Cargo.toml` at workspace root and per-crate level; expose `crateCount`, `crateRoots`, crate dep graph |
| **Cross-boundary edges** | Show where TS packages invoke Rust crates via `engine_invoke` / `#[tauri::command]` |
| **Rust crate in architecture draft** | `repo_architecture_draft` should include a `crates` zone alongside `apps` and `packages` zones |
| **libobscur module map** | `src/{crypto, net, protocol, keystore, les, db}` as addressable units for owner assignment |

---

### G3 — Freeze-set / keep-set RPC (HIGH)

**Why it blocks the refactor:**  
"UI unchanged" is a hard constraint. Without a machine-enforced freeze-set, agents will silently drift into frozen territory. Past history: 10+ rewrites all touched the wrong files.

**Current state:** `verify_freeze_set_propose` and `verify_keep_set_binding` are in the lane list but return `unknown method`.

**Needed:**

| Requirement | Detail |
|-------------|--------|
| **Propose freeze-set** | `verify_freeze_set_propose` → proposes paths/packages to freeze given a "backend-only" refactor intent |
| **Keep-set binding** | `verify_keep_set_binding` → registers the active keep-set; agents check before every diff |
| **UI freeze gate** | Automatically block agent edits to: `apps/pwa/app/components/**`, `packages/ui-kit/**`, any `.tsx` outside adapter/bridge files |
| **Tauri command freeze** | Only `apps/desktop/src-tauri/src/commands/*.rs` and `packages/libobscur/**` are mutable |
| **`.cursorignore` sync** | Freeze-set should be exportable to `.cursorignore` format for Cursor enforcement |

---

### G4 — Vertical slice evaluator (HIGH)

**Why it blocks the refactor:**  
Past rewrites exploded in scope at "90% done" because there was no slice boundary. The Rust refactor must proceed as: auth → transport → DM → profile. Each slice needs machine proof before the next begins.

**Current state:** `verify_vertical_slice_evaluate` returns `unknown method`.

**Needed:**

| Requirement | Detail |
|-------------|--------|
| **Slice definition** | `sliceId`, `ownedFiles[]`, `proofTier`, `doesNotProve[]`, `exitGate` |
| **Slice evaluator** | Given a slice ID: check if all owned files are Rust-only (no parallel TS), proof tier met, no files outside scope touched |
| **Slice sequencing** | Reject starting slice N+1 if slice N exit gate not passed |
| **Solo-dev default** | One active slice at a time; no parallel slice work |

---

### G5 — Rust-specific proof tiers (HIGH)

**Current verify tiers** (T0–T4) are designed for browser/CDP/Playwright surfaces. Rust backend proof needs different tiers:

| New tier | What it proves | Tool needed |
|----------|----------------|-------------|
| **RC0** | `cargo check` clean — no compile errors | CI script or sandbox step |
| **RC1** | `cargo test` green — unit + integration tests in `libobscur` | `verify_operation_run` mapped to `cargo test` |
| **RC2** | Headless CLI smoke — `libobscur::engine_invoke` roundtrip without Tauri | Existing `engine-lab-headless` binary; needs scenario |
| **RC3** | Tauri desktop attach — `engine_invoke` from live TS shell → Rust handler → response | Existing CDP + `client_runtime_digest_pull` |
| **RC4** | Cold-restart persist — DM survives `taskkill` → relaunch → hydrate | Existing `stress.obscur.cold_restart.dm@1` scenario |

**Needed:** `verify_workflow_guide` section for Rust/Tauri proof tiers; `verify_operation_list` accepting `cargo test` and headless CLI as operation specs.

---

### G6 — verify.operations.yaml for Rust operations (MEDIUM)

**Current state:** `verify_operation_list` returns "no verify.operations.yaml found". The verify scenario list shows only two Dev Lab adapter scenarios (now tombstoned).

**Needed before refactor:**

```yaml
# verify.operations.yaml (seed for Rust refactor)
operations:
  - id: rust.auth_boot_snapshot@1
    title: Rust auth_boot returns valid snapshot for known profile
    proofTier: RC2
    command: cargo test --manifest-path packages/libobscur/Cargo.toml
    symptomIds: [auth-keychain-restore-failed]

  - id: rust.dm_persist_cold_restart@1
    title: DM write survives cold kill and hydrates on restart
    proofTier: RC4
    scenarioRef: stress.obscur.cold_restart.dm@1
    symptomIds: [O-2, hydrate-loss]

  - id: rust.relay_pool_owner@1
    title: Single relay pool owner — no duplicate publish paths
    proofTier: RC1
    command: cargo test relay::pool
    symptomIds: [relay-offline, false-green-runtime]

  - id: rust.session_scope_isolation@1
    title: Session keys scoped to profileId — no cross-profile leak
    proofTier: RC1
    command: cargo test session::scope
    symptomIds: [session-leak]
```

---

### G7 — Logic (FLS) rules for Rust invariants (MEDIUM)

**Current state:** Logic spec covers `obscur-community-membership` and a community rule pack. No rules for the backend modules targeted by the refactor.

**Needed — new FLS invariants:**

| Invariant ID | Rule | Static scan target |
|--------------|------|--------------------|
| `RUST-INV-1` | Every `#[tauri::command]` that reads session must take `profileId` as explicit arg | `rg 'tauri::command' src/commands/` |
| `RUST-INV-2` | No `fn` in `commands/*.rs` may write to keychain without calling `profile_scope_check` | RG rule on `keychain` writes |
| `RUST-INV-3` | `libobscur::engine_invoke` must be the only TS→Rust call path; no direct `invoke('db_*')` | existing — extend to new Rust modules |
| `RUST-INV-4` | All `cargo test` must pass before any TS adapter wires the new Rust command | CI gate |
| `RUST-INV-5` | No private key or passphrase in `tracing::` output | RG on `tracing` format strings |

---

### G8 — Salvage pathway RPC (MEDIUM)

**Current state:** `studio_pathway` and `verify_salvage_pathway` return `unknown method`.

**Why it matters:** Without a machine-readable salvage status, each agent session re-derives the state by reading the handoff — expensive, error-prone, and the source of "vibe-resumed" sessions that ignore PAUSED bands.

**Needed:**

| Requirement | Detail |
|-------------|--------|
| **Salvage state RPC** | Returns: active slice, frozen packages, PAUSED bands, last verified proof tier, next action |
| **Agent pre-flight** | Every agent session starts with `studio_pathway` — no code until pathway says "proceed" |
| **PAUSED/CANCELLED enforcement** | If band is PAUSED in pathway → agent refuses; no override without maintainer sign-off in pathway |

---

### G9 — Subject ranking fix (LOW — quality of life)

`perf_target_resolve` scores `apps/website` 140 vs `apps/desktop` 105. For a Rust-backend / Tauri-desktop project, the primary surface is `apps/desktop`. This misleads agents picking explore targets.

**Fix:** add a `primarySurface` hint to `client.cdp.yaml` or workspace config; perf target resolve should prefer `tauri` stack over `next` when `primaryStack: tauri` is set.

---

## Priority order for upgrade

| Priority | Gap | Blocks |
|----------|-----|--------|
| **P0** | **G0 workspace bind to Obscur repo** (not home) | All Studio truth |
| **P0** | G1 owner conflict RPC | Refactor planning |
| **P0** | G2 Cargo/Rust workspace indexing | All Rust-side tools |
| **P0** | Descriptor↔daemon RPC wiring (advertised ≠ implemented) | Salvage lane |
| **P1** | G3 freeze-set RPC | UI integrity during refactor |
| **P1** | G4 vertical slice evaluator | Scope discipline |
| **P1** | G5 Rust proof tiers | Proof surface for backend |
| **P2** | G6 verify.operations.yaml | Operation-level proof contracts |
| **P2** | G7 FLS rules for Rust | Automated invariant enforcement |
| **P3** | G8 salvage pathway RPC | Agent session discipline |
| **P3** | G9 subject ranking | Quality of life |
| **P3** | Raise explore RPC timeout / async jobs (>15s) | Monorepo explore |

---

## What CodaCtrl already covers (no change needed)

- Stress sandbox: cold-restart DM · relay disconnect · notification burst (SB2)
- Security hygiene: session boundary · crash recovery · secrets-not-in-logs (SB3)
- Verify workflow: interactive observe round, trace desk, false-green scan
- Logic templates: domain-invariants, static-rule-pack
- Architecture survey: TS package boundary, 28-node graph
- CDP client: `client_session_connect` ready when desktop running on `:9230`

These cover debugging and verification once the **Rust proof tiers** (G5) and **operations.yaml** (G6) are wired in.

---

## Refactor will not start until

- [x] **G0** Studio workspace bound to Obscur repo root (not home directory)
- [x] G1 owner conflict RPC responds for `libobscur` + `src-tauri` modules *(path heuristic; Rust crates indexed in profile — owner scan still TS-path heavy)*
- [x] G2 `crateCount > 0` in `repo_profile_get` → **2** (`libobscur`, `obscur_desktop_lib`)
- [x] G3 `verify_freeze_set_propose` returns a freeze-set for "backend-Rust-only" intent
- [x] G4 `verify_vertical_slice_evaluate` R-AUTH pass
- [x] G5 `verify.operations.yaml` present with rc1 ops (`auth-boot-snapshot`, …)
- [ ] G5 live prove: `verify_operation_run` auth-boot-snapshot at **rc1+** with CDP `:9230` (desktop not running this round)

---

## MCP dogfood round 4 — after MCP update (2026-07-29)

**Result: salvage rails usable.** Compared to round 3 (`unknown method` + home-dir bind):

| Gate | Round 3 | Round 4 |
|------|---------|---------|
| G0 workspace | `C:\Users\Administrator` | `E:\Web Projects\experimental-workspace\obscur` ✓ |
| Pathway | unknown method | ✓ currentStep=`slice`, frozenPackages + pausedBands |
| Owner conflicts | unknown method | ✓ 3 dual-owner / 4 scanned; `session-hydrate` single owner |
| Freeze set | unknown method | ✓ keep=13 / freeze=17 |
| Vertical slice | unknown method | ✓ R-AUTH pass |
| Crate index | N/A | ✓ crateCount=2 |
| Operations | missing yaml | ✓ 4 ops @ rc1 |
| Sandbox catalog | unknown method | ✓ Obscur SB2 |
| CodeGraph status | unknown method | ✓ detected / optional |
| CDP | closed | still closed (expected — app not launched) |

**Pathway next tool:** `verify_vertical_slice_evaluate` (done this round) → then freeze already present → salvage rollup → prove on parity-desktop.

**Owner conflict highlights (act on):**
- `session-hydrate` — OK (1 writer: `auth-kernel-boot-owner.ts`) — Slice 1 target
- `profile-scope` — dual (7 writers) — clarify before auth edits
- `dm-persist` — dual (3) — PAUSED for this slice
- `relay-publish` — dual (22 writers) — stop-writing; PAUSED

**Minor gap:** `verify_slice_proof_checklist` returned `missing field schema` — fix schema arg or daemon default.

**Interim:** Start R-AUTH with CodeGraph blast-radius + CodaCtrl keep/freeze; do not claim ship until CDP prove on parity-desktop.

---

## Archive — MCP dogfood round 3 (superseded by round 4)

Round 3 found home-dir misbind + `unknown method` on salvage RPCs. **Fixed in round 4.** Historical detail retained only for regression awareness: prefer CodeGraph when Studio bind/RPC regresses.