# Workspace kernel — manifest

**Status:** Active strategy (2026-06-10)  
**Supersedes for community delivery:** patching `features/groups/` parallel paths, re-enabling sovereign rooms, growing `use-sealed-community` as authority  
**Aligns with:** [community-fork-decision-2026-05.md](./community-fork-decision-2026-05.md) Path B · [back-online-modular-roadmap-2026-06.md](./back-online-modular-roadmap-2026-06.md) · [obscur-v2-slim-kernel-manifest.md](./obscur-v2-slim-kernel-manifest.md)  
**Evidence base:** [exploration module 01](../exploration/modules/01-community-groups.md) · [as-built synthesis](../exploration/synthesis/as-built-architecture-and-fork-options.md)

---

## Problem (why Path B bands alone are insufficient)

Community behavior is split across **four lifecycles**, each with multiple production owners (~36k LOC in `features/groups/`):

| Lifecycle | Parallel paths today |
|-----------|----------------------|
| Membership | ledger, coordinator, `use-sealed-community`, CRDT, coordination ingress, chat-state |
| Thread messages | `use-chat-actions`, `use-sealed-community`, chat-state, SQLite, hook memory |
| Room list | `group-provider`, chat-state `createdGroups`, SQLite list store |
| Network publish | relay pool helpers, team-relay stubs, duplicate publish stacks |

Patching one path does not fix Test-10-class drift (list survives, thread empty; leave blocked; ghost members). **Binding surface is wrong** — same lesson as dm-kernel vs hydrate.

---

## Principle (mirror dm-kernel)

> **Managed workspace on native = one port per lifecycle. No hybrid relay roster truth. No second hook instance. Legacy `features/groups/` is not authority when kernel is on.**

**dm-kernel** and **workspace-kernel** share **shell only** (`profileId`, auth, chrome) — not message stores, not hydrate, not `use-sealed-community`.

---

## Kernel ports (target module: `apps/pwa/app/features/workspace-kernel/`)

| Port | Owns | Must not read/write |
|------|------|---------------------|
| `membership-port` | Join / leave / expel / roster projection | Relay gossip widen, chat-state membership, optimistic ledger without coordination evidence |
| `thread-port` | Room message read (SQLite native) | chat-state `groupMessages`, hook `messages[]` as authority |
| `write-port` | Send sealed message → transport → persist | Duplicate send in `use-chat-actions` + `use-sealed-community` |
| `leave-port` | Relay/coordination-confirmed leave → local commit | Local-first leave, ledger before network proof |
| `list-port` | Sidebar room rows (derived) | `group-provider` hydrate as sole source |
| `transport-port` | Scoped publish to workspace relay | `publishToAll` for community events |

**Policy:** `isWorkspaceKernelAuthority()` — `managed_workspace` + native persistence + opt-out `NEXT_PUBLIC_OBSCUR_WORKSPACE_KERNEL=0`.

When **true**: UI uses `WorkspaceKernelProvider` + kernel hooks only.  
When **false**: legacy paths may remain for web/dev; **sovereign / public-relay create is not a supported product path**.

---

## Truth model (one source per question)

| Question | Authority |
|----------|-----------|
| Am I a member? | Coordination directory (+ leave evidence on relay when required) |
| Who is in the room? | Coordination projection — not relay roster merge |
| What messages exist? | SQLite `group_messages` on native |
| Can I send? | `membership-port` + room-key evidence |
| Did leave succeed? | Network confirmation **then** `leave-port` local commit |

Relay-authoritative leave is **encoded in the kernel**, not optional UI policy.

---

## Phased execution (W0–W4)

| Phase | Deliver | Gate before next phase |
|-------|---------|------------------------|
| **W0** | Subtraction manifest; `workspace-kernel` scaffold; forbidden-import + forbidden-caller contract tests; hide sovereign create in default UX | `pnpm verify:workspace-kernel-w0` (contracts only) |
| **W1** | `membership-port` — create/join/leave/list via coordination only | COM-MEM: two-profile managed workspace join/leave | **Landed** |
| **W2** | `thread-port` + `write-port` — send/read; SQLite cold restart | COM-MSG: two-profile send; quit; relaunch; both see thread | **Landed** |
| **W3** | Roster UI reads `membership-port` only; single `WorkspaceKernelProvider` (no second `useSealedCommunity` on routes) | COM-ROSTER: roster matches coordination after join/leave | **Landed** |
| **W4** | Backup/restore scope for workspace **or** explicit defer with copy | Documented in scope register | **Landed** |

**Do not open W2 until COM-MEM passes.** Do not claim community ship until COM-MSG passes.

---

## Subtraction manifest (W0 — canonical)

Legacy paths **must not run** when `isWorkspaceKernelAuthority()`:

| Lifecycle | Cease as authority |
|-----------|-------------------|
| Send | `use-sealed-community.sendMessage` for main composer; duplicate group branch in `use-chat-actions` |
| Read thread | Relay merge in hook memory; chat-state `groupMessages` on native |
| Leave | Local-first leave; ledger write without `relayConfirmed` |
| Roster | `mergeHybridMembershipTruthFallback`; relay roster widen in `use-sealed-community` |
| List | `group-provider` hydrate from chat-state alone |
| Instances | Second `useSealedCommunity` on `group-home-page-client` when shell already owns controller |

**Do not grow** `features/groups/` for new behavior — new code under `workspace-kernel/`; shrink legacy callers until deletion is possible.

**Remove long-term:** `dm-kernel-group-thread-port` bridge (re-couples kernels) — after W2 `thread-port` lands.

---

## Contract tests (anti-loop)

Mirror `features/dm-kernel/*.contract.test.ts`:

- Kernel files must not import `use-sealed-community`, `group-provider` hydrate, coordinator merge helpers
- `main-shell`, `groups/[...id]/` must not call forbidden symbols when kernel authority on
- `leave-port` must not call `persistExplicitCommunityMembershipLeave` without `relayConfirmed`
- `COM-*` integration gates (native two-profile) — not `readSource()` alone

Target script: `pnpm verify:workspace-kernel` (chains W0→Wn as phases land).

---

## Relationship to Path B (B0–B5)

Path B landed **programmatic bands** (coordination gates, membership subtraction policy, extension hooks). **Workspace kernel** is the **delivery geometry** for community UX — same as dm-kernel relative to Lane K / hydrate.

| Layer | Status |
|-------|--------|
| Path B B0–B5 | **Landed** (verify scripts) |
| Workspace kernel W0 | **Landed** — `pnpm verify:workspace-kernel-w0` |
| Workspace kernel W1–W4 | **Complete** — `pnpm verify:workspace-kernel-w4` |

---

## Public release strategy (aligned)

- **DM-only debut** may ship before W4 completes — dm-kernel proof is separate.
- **v2.0.0 full platform** must not bundle unproven community UX; managed workspace requires COM-* gates.
- Anti-fraud / trust bundles attach to **dm-kernel first** (recipient-local); not a blocker for W1.

---

## Diagnostics

Log at port boundaries only (dev throw / prod metric):

- `workspace.membership.load`
- `workspace.leave.rejected` (no ledger write)
- `workspace.thread.hydrate`
- `workspace.path_conflict` (legacy hook fired while kernel on)

---

## References

- DM playbook: [obscur-v2-slim-kernel-manifest.md](./obscur-v2-slim-kernel-manifest.md)
- Fork: [community-fork-decision-2026-05.md](./community-fork-decision-2026-05.md)
- Handoff: [current-session.md](../handoffs/current-session.md)
