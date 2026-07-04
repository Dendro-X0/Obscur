# Community relay transport binding specification (2026-06)

**Status:** R4 implementation spec  
**Phase:** R4 — [community-relaunch-master-spec-2026-06.md](./community-relaunch-master-spec-2026-06.md)  
**Resolves:** COM-RUN-03

---

## 1. Problem

Community publish fails with **“No writable relays are connected”** while sidebar relay chrome may show connected/optimized. Join/create can succeed in coordination-only dev mode without establishing relay pool entries for the community URL (COM-RUN-03).

---

## 2. Separation of concerns

| Check | Module | Proves |
|-------|--------|--------|
| URL is Nostr-shaped | `hasWritableCommunityRelayTransport` | Host/port valid for community relay |
| Pool can publish | Relay list enabled + pool connection + activation transport | Runtime send path |
| Sidebar chrome | Relay status indicator | **Not** sufficient for community publish |

---

## 3. Binding contract (full-stack profile)

At **create** and **join** (when not coordination-only dev mode):

| Step | Action |
|------|--------|
| 1 | `addRelay({ url: canonicalUrl })` via relay list |
| 2 | `ensureWorkspaceRelayTransportReady` / `prepareWorkspaceRelayForJoin` with timeout |
| 3 | `runWorkspaceMembershipActivation` publish with evidence |
| 4 | Success only if publish synced **or** explicit `activation_pending` with retry — not empty `publishTargets` with success severity |

Owner paths:

- [`community-workspace-activation.ts`](../../apps/pwa/app/features/groups/services/community-workspace-activation.ts)
- [`workspace-kernel-membership-port.ts`](../../apps/pwa/app/features/workspace-kernel/workspace-kernel-membership-port.ts)

---

## 4. Health linkage

Map to [membership health](./community-membership-health-spec-2026-06.md) blockers:

| Condition | Blocker |
|-----------|---------|
| `!hasWritableCommunityRelayTransport(url)` | `relay_not_writable` |
| Writable URL but pool not connected | `relay_not_connected` |
| Pending activation record | `activation_pending` |

---

## 5. Dev exception

When `isCoordinationOnlyWorkspaceDevMode()`:

- Join/create may skip step 3 publish
- Set `health.chatEnabled = false`
- Show dev badge ([community-dev-profiles-spec-2026-06.md](./community-dev-profiles-spec-2026-06.md))
- **Must not** claim COM-MEM-2 Pass under this profile

---

## 6. Deliverables (R4)

| ID | Deliverable |
|----|-------------|
| T-1 | Join/create port awaits relay ready before `joined` (full-stack) |
| T-2 | Activation summary cannot be `success` with `publishTargets: []` and failed publish |
| T-3 | Health blockers wired to pool state |
| T-4 | Vitest: join blocked when relay URL not in enabled list |

---

## 7. Acceptance

- [ ] COM-MEM-2 step 6: both profiles send sealed message without writable-relay toast
- [ ] Settings → Relays shows community relay enabled after join

---

## 8. Verification

```bash
pnpm -C apps/pwa exec vitest run app/features/groups/services/community-workspace-activation.test.ts
pnpm -C apps/pwa exec vitest run app/features/groups/services/community-relay-transport.test.ts
```

Runtime: COM-MEM-2 step 6.

---

## Revision history

| Date | Change |
|------|--------|
| 2026-06-17 | Initial relay transport binding spec |
