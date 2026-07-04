# R1 — Workspace community consolidation (Path B)

**Status:** Implemented (2026-05-22)  
**Parent:** [community-fork-decision-2026-05.md](./community-fork-decision-2026-05.md) · [platform-pivot-private-trust-2026-05.md](./platform-pivot-private-trust-2026-05.md)

---

## Policy

| Rule | Enforcement |
|------|-------------|
| New communities = `managed_workspace` only | Create UI fixed mode; `global-dialog-manager` create path |
| Coordination required | `assessWorkspaceCommunityTrust` + create dialog health probe |
| Public relays blocked | `public_relay_blocked` in trust policy; `resolveManagedWorkspaceRelayGate` |
| Membership sync = coordination | `readMembershipSyncMode` when R1 on (`NEXT_PUBLIC_WORKSPACE_R1_MEMBERSHIP` not `false`) |
| Invite/send roster | `resolveWorkspaceActionMemberPubkeys` uses `communityRosterByConversationId` projection |

**Escape hatch:** `NEXT_PUBLIC_WORKSPACE_R1_MEMBERSHIP=false` restores nostr_only setting (sovereign debugging only).

**Dev without Docker:** `NEXT_PUBLIC_DEV_COORDINATION_ONLY_WORKSPACE=true` + `pnpm -C apps/coordination dev`

---

## Manual pass matrix (two desktop profiles)

| ID | Steps | Pass |
|----|--------|------|
| R1-C1 | Coordination running; create workspace | Blocked if `/health` fails |
| R1-C2 | Create with `localhost` or private relay | Succeeds; coordination join published |
| R1-C3 | Create with `nos.lol` host | Blocked (public relay) |
| R1-M1 | Alice leaves; Bob syncs / opens group | Bob roster shrinks (coordination projection) |
| R1-M2 | Re-invite after leave | Allowed when not in active coordination set |

---

## Code map

| Module | Role |
|--------|------|
| `community-workspace-r1-policy.ts` | R1 flags + action member pubkeys |
| `community-trust-policy.ts` | Create/join trust gate |
| `community-membership-sync.ts` | Coordination delta polling |
| `community-workspace-membership.ts` | Join publish + `ensureWorkspaceMembershipSyncMode` |
| `create-group-dialog.tsx` | UI gate + health |

---

## Not in R1

- Sovereign room create on public relays (legacy read-only)
- Delete-for-everyone (needs TeamTransportPort)
- Full SQLite projection mirror (P3c)
