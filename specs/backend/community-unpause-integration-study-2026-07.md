# Community un-pause — integration study (2026-07)

**Status:** Study complete · **band remains PAUSED** · 2026-07-31  
**Kind:** Integration study only — **no `groups/**` feature code**, no un-pause without maintainer charter  
**Prior studies:** [membership-graph-integration-study-2026-06.md](../../docs/program/membership-graph-integration-study-2026-06.md) · [community-membership-redesign-charter-2026-07.md](../../docs/program/community-membership-redesign-charter-2026-07.md) · [backend-parallel-path-audit-2026-07.md](./backend-parallel-path-audit-2026-07.md)  
**Contract:** [modular-iteration-contract.md](../../docs/program/modular-iteration-contract.md) § Integration study

---

## Session gate

```text
HANDOFF ATOMIC STEP:  community un-pause integration study
PAUSED / CANCELLED:   community · COM-RUN-01 roster · COM-RUN-02 restore CANCELLED · Dev Lab
CANONICAL OWNER:      study doc — not group-provider / not bare db_*
PROOF BEFORE DONE:    This file + handoff update (PAUSED unchanged)
OUT OF SCOPE:         Implement Slice C · roster patches · GIF soaks · un-pause flip
```

---

## Verdict (one line)

**Do not un-pause the community band yet.** Neighbors (DM / mesh / auth) are unified enough to *receive* a silo redesign, but community still has **no single persist owner**, **no honest L4**, and **cancelled goals** that must not return as patch targets.

---

## 1. Why re-study now (2026-07 delta)

Since the 2026-06 membership graph study:

| Neighbor | 2026-06 | 2026-07 now |
|----------|---------|-------------|
| DM persist | Mixed / thick hydrate | **`@obscur/dm-engine` via `engine_invoke`** (non-PAUSED Done) |
| Product relay publish | Dual pool risk | **Conduit mesh** + transport-kernel policy; Dev Lab bridges **unmounted** |
| Auth cold / F5 | Fragile | Auth-kernel boot + cold hydrate L3 evidence (Tester1-aligned) |
| Dev Lab COM-MEM-2 scenario | Primary soak hope | **Tombstoned** (`verify:com-mem-2:scenario` → exit 1) |
| Group / community SQLite | Bare `db_*` | **U2 + group `db_*` IPC tombstone Done** — list/messages via `@obscur/workspace-engine` / `engine_invoke`; warm Tauri `db_get_groups` / message commands unregistered |

**Implication:** Re-integration risk to working neighbors is lower than in June *if* the first un-pause slice is **subtraction + one owner**, not roster UI. Risk to *community itself* is unchanged until persist + crypto owners unify.

---

## 2. Working neighbors (must not regress)

| Module | Owner | Proof already used |
|--------|-------|-------------------|
| Auth boot / cold restore | `auth-kernel-boot-owner` + Rust session | Cold hydrate L3 · P2 soak |
| DM send / thread read | `@obscur/dm-engine` | Engine lab / Slice 15–21 contracts |
| Product relay pool / publish | `useConduitMeshRelayPool` · transport-kernel | Web L3 docker · publish inject L1 |
| Persistence (vault / call / search / checkpoints) | `persistence.*` / `transport.*` | Slice 11–23 |
| Offline pack / account backup shell | RUST-6 IPC | Offline L3 sneakernet |

**Hard rule on re-wire:** Community must **not** reintroduce:

- bare `dbInsertMessage` on the **product DM** path (invite leftover is already a dual),
- browser-pool publish for sealed community when native mesh owns,
- Dev Lab programmatic unlock as proof.

---

## 3. Community silo — current owners vs residue

### 3.1 Target ownership (post–engine roadmap)

| Lifecycle | Target canonical owner | Today |
|-----------|------------------------|-------|
| Join / leave / create (managed_workspace) | `workspace-kernel-membership-port` | Kernel + legacy `group-provider` still both alive |
| Membership directory | Coordination Path B directory | Present; ACC-02 multi-read still open |
| Group list persist | **`@obscur/workspace-engine`** `listGroups` / `upsertGroup` (**U2** + IPC tombstone) | **Done** — bare group `db_*` unregistered |
| Group message persist | Same engine family | **Done** — same tombstone band |
| Community invite DM persist | `dm-engine` insert | **U1 Done** — invite pipeline → `writeDmKernel*` |
| Sealed group crypto | Slice **C** coordination wraps ([design](./community-coordination-room-key-wrap-slice-c-2026-07.md)) | **U3 Done** (L1+L3); COM-RUN-02 restore still **CANCELLED** |
| Transport publish (community) | Mesh pool / transport-kernel | Activation / invite still call pool or standalone entrypoints |
| Roster UI | Search-first “Find in community” (§2.2 of 2026-06 study) | **U5 Wave B Done** (header metrics honesty); COM-RUN-01 live roster parity still forbidden |

### 3.2 Conflict scan (parallel writers)

| Conflict | Files / surface | Class |
|----------|-----------------|-------|
| Invite DM dual persist | `community-dm-invite-pipeline.ts` vs dm-engine | **U1 subtracted** — product invite path uses dm-engine; do not reintroduce bare `db_insert_message` |
| Group list dual | `community-group-sqlite-store` + chat-state + workspace metadata cache | **Reduced** — U2 engine owner + IPC tombstone; watch leftover read adapters |
| Group thread dual | `group-thread-append` / `group-thread-sqlite-store` / `sealed-group-message-persistence` | **Reduced** — engine/message tombstone; residue audit still useful |
| Backup evidence widens dual | `native-sqlite-backup-evidence` / `account-group-sqlite-evidence` | Prefer engine list/read; do not warm tombstoned group `db_*` |
| Roster multi-owner | COM-RUN-07 / ACC-02 | **Cancelled live-parity goal** — do not “fix” |
| Crypto | Slice C **landed** (U3); restore band cancelled | Un-pause still needs integration soak, not C re-impl |
| Proof | `verify:com-mem-2` = contracts only; scenario tombstoned | Lab soaks: `verify:u2-l3` / `verify:slice-c-l3` / `verify:u4-l3` / `verify:u6-l3` — not production un-pause |

---

## 4. Interface contract (what “integrated” means)

Before any un-pause charter, community must commit to:

### Inputs

- Explicit `profileId`, member pubkey, `communityId` / `groupId`, `relayUrl`
- Mesh / transport-kernel publish only on native product
- Coordination directory as **membership authority** (join/leave), not UI roster parity

### Outputs

- Join/create/leave evidence in directory + local cache with one write owner
- Group messages durable via **engine_invoke** (not bare `db_*`)
- Invite DM durable via **dm-engine** (subtract `dbInsertMessage` from invite pipeline)
- Crypto: action-time resolve from Slice C wraps (or honest MVP without seal — maintainer must pick)

### Non-outputs (explicitly out)

- Live cross-profile roster parity (COM-RUN-01 cancelled as product goal)
- Dev Lab green as ship gate
- Room-key restore/repair loops (COM-RUN-02 cancelled)

### Proof commands (minimum)

| Layer | Command / surface | Notes |
|-------|-------------------|-------|
| L1 | `pnpm verify:com-mem-2:contracts` (+ new engine contracts when migrate) | Exists today |
| L1 | Invite pipeline uses dm-engine only (new contract after subtract) | Not yet |
| L3 | Release/parity exe · CodaCtrl · two profiles · invite→join→send | Not Dev Lab |
| L4 | Replaces tombstoned `verify:com-mem-2:scenario` with CodaCtrl/playwright **on release shell** | Not chartered |

---

## 5. GO / NO-GO for un-pause

### NO-GO (current — default for *production* un-pause)

| Gate | Status |
|------|--------|
| Single persist owner for group list + group messages | **Pass (lab)** — U2 + IPC tombstone; residue adapters may remain |
| Invite DM on dm-engine | **Pass (lab)** — U1 |
| Crypto recovery path (Slice C) implemented + L3 | **Pass (lab)** — U3; COM-RUN-02 restore still cancelled |
| Honest proof without Dev Lab | **Partial** — U2/U3/U4/U6 L3 scripts exist; L4 COM-MEM-2 scenario dead |
| Maintainer charter naming **one** un-pause slice | **Operational soak charter** (Wave B) ≠ full production un-pause |

### GO only when (maintainer)

1. Charter picks **exactly one** slice from §6, and  
2. Handoff flips that slice from PAUSED → active with named L1–L4, and  
3. Study conflict for that slice is subtracted **before** UI work.

Full-band un-pause (“community open for patches” / production-ready) remains **forbidden** until maintainer explicitly charters it. Wave B = lab/operational soak of landed U-slices only.

---

## 6. Ranked un-pause slices (if maintainer chooses)

Ordered by **neighbor safety** then **unblocks product feedback**. Each slice is its own charter — not a free-for-all.

| Priority | Slice | Work | Proof | Neighbor risk | Status |
|----------|-------|------|-------|---------------|--------|
| **U1** | **Invite DM persist subtract** | Route invite pipeline → `writeDmKernel*` | L1 dm-persist-owner | Low | **Done 2026-07-31** — [design](./community-u1-invite-dm-engine-design-2026-07.md) |
| **U2** | **Group persist engine migrate** | Replace `dbGet/UpsertGroups` + group message IPC with workspace-engine methods; tombstone bare ACL | Engine contracts + L3 create group survives restart | Medium — backup evidence must follow | **A–D Done 2026-07-31** — [design](./community-u2-group-persist-engine-design-2026-07.md); `pnpm verify:u2-l3` Pass (`webview_reload`) |
| **U3** | **Slice C room-key wraps** | Implement [community-coordination-room-key-wrap-slice-c-2026-07.md](./community-coordination-room-key-wrap-slice-c-2026-07.md) | L1 + L3 wipe→materialize→send | Medium — coordination schema | **L1+L3 Done 2026-07-31** — [activation](./community-u3-slice-c-activation-wrap-design-2026-07.md) · [L3](./slice-c-l3-cdp-reproof-design-2026-07.md); `pnpm verify:slice-c-l3` Pass post-U2 |
| **U4** | **Membership write collapse** | Sole join/leave via `workspace-kernel-membership-port`; quarantine legacy provider writes | `verify:workspace-kernel` + L3 | Medium | **Wave A+B L1 + L3 leave Done 2026-07-31** — [design](./community-u4-membership-write-collapse-design-2026-07.md) · [Wave B](./community-u4-wave-b-deletion-design-2026-07.md) · [L3](./community-u4-l3-leave-cdp-design-2026-07.md); NewTest 2 left — rejoin before Slice C |
| **U5** | **Roster UI honesty** | Replace participant modal with “Find in community” (2026-06 §2.2) + header metrics (§2.3) | UI contract + no parity claim | Low backend / high UX | **Wave A+B Done 2026-07-31** — [design](./community-u5-find-in-community-design-2026-07.md); picker honesty + header “online here” / labeled source |
| **U6** | **COM-RUN-11 invite role** | Role ecosystem after U1 | L3 two-profile Accept/Cancel | High fixture cost | **Wave A+B Done 2026-07-31** — [design](./community-u6-invite-role-design-2026-07.md); `pnpm verify:u6-l3` Pass |

**Maintainer queue (2026-07-31):** U1–U6 + R1 Wave 4 + group `db_*` IPC tombstone **Done**. Operational dual-wave charter **closed**: Wave A transport false-offline Done (L1); Wave B lab soak — Slice C / U4 / U6 Pass this session; U2 Fail (message marker; prior Pass stands). Full community band remains **not production-ready**.

---

## 7. Alternatives if un-pause deferred

| Option | Meaning |
|--------|---------|
| **Hold PAUSED** | Keep silo; ship DM/auth/relay only; document groups as out-of-ship |
| **Honest MVP without sealed groups** | Charter option D from redesign charter — managed communities without E2E seal until U3 |
| **Phase 3 Dev Lab delete** | Orthogonal; does not unblock community |

---

## 8. Agent rules (unchanged until charter)

| Allowed | Forbidden |
|---------|-----------|
| This study · register updates · engine migrate **designs** | Feature patches in `groups/**` |
| U1–U3 **design specs** when maintainer picks a slice | COM-RUN-01 roster parity “fixes” |
| CodaCtrl exploration on release exe (read-only evidence) | Claiming community production-ready |
| | Using Dev Lab / tombstoned scenario as Pass |

---

## 9. Handoff recommendation

| Field | Value |
|-------|--------|
| Community band | **Remain PAUSED** (except chartered U-slices) |
| Queue | **U1–U6 Done** (U5 Wave A+B) |
| U1 | **Done** — invite native persist → dm-kernel |
| U2 | **Done** — group persist engine A–D · `verify:u2-l3` Pass |
| U3 | **Done** — Slice C L1 + L3 Pass (post-U2 re-proof) |
| U4 | **Done** — membership write collapse + leave L3 |
| U5 | **Wave A+B Done** — Find in community + header metrics honesty |
| U6 | **Wave A+B Done** — invite role L3 |
| Next atomic | **Dual-wave charter closed** — Wave A Done · Wave B lab soak recorded · not production un-pause |
| Do not | Claim community production-ready · COM-RUN-01 parity patches · invent U7 without study |


---

## 10. References

| Doc / code | Role |
|------------|------|
| `community-dm-invite-pipeline.ts` | Dual invite persist |
| `community-group-sqlite-store.ts` | Bare group list IPC |
| `group-thread-sqlite-store.ts` / `group-thread-append.ts` | Bare group message IPC |
| `workspace-kernel-membership-port.ts` | Target join owner |
| `docs/encyclopedia/12-core-architecture-truth-map.md` | Row 12 PAUSED |
| `pnpm verify:com-mem-2` | Contracts only |
| GIF inventory | Objectives reference only — not proof |
