# Community fork decision (2026-05)

**Status:** **Signed — Path B** (2026-06-02) · Platform pivot: [platform-pivot-private-trust-2026-05.md](./platform-pivot-private-trust-2026-05.md)  
**Execution roadmap:** [back-online-modular-roadmap-2026-06.md](../archive/program/inactive-2026-06/back-online-modular-roadmap-2026-06.md)  
**Context:** Public-relay community membership is **infeasible**. **Path B** is the chosen product fork; Path A remains documented as the interim alternative if ops cannot be sustained.

---

## The two real choices

| Path | What ships | What you give up |
|------|------------|------------------|
| **A — DM-only** | Encrypted 1:1 (and existing DM-adjacent flows). **No** community create/invite/roster product surface. | Team group chat, community home, participant directory, governance UI. |
| **B — Internal network communities** | Team rooms with **live membership** and permissions backed by **operator-controlled infrastructure**, not the public Nostr graph. | Sovereign rooms on `nos.lol` / `groups.fiatjaf.com` as a **supported** community mode. Interop with random Nostr clients for **membership truth** is not a goal. |

**Not on the table:** More patches that treat public relays as the community membership owner. That path is closed.

---

## Recommendation: **Path B** (with a hard gate), keep **DM on Nostr adapter**

This matches your stated goal: encrypted private messaging **plus** a secure internal-network-style group experience.

Important nuance: Path B does **not** require deleting all Nostr code tomorrow. It requires **re-owning truth**:

1. **DM** — Keep current transport (NIP-17 / gift-wrap, profile-scoped gateway). “Decent Nostr client” remains valid ([strategic-direction.md](../archive/program/inactive-2026-06/strategic-direction.md)).
2. **Community membership** — **Coordination directory is mandatory** when creating or joining a workspace community. Poll/apply deltas are the owner; relay lines are optional hints for chat delivery only.
3. **Community relay** — **Trusted or private** relay URL only (`trusted_private` / `managed_intranet` tier in `community-mode-contract`). Refuse create/join when the only enabled relays are `public_default` hosts.
4. **UI** — Remove or demote **Sovereign Room on public relays** from the default create flow; show Path A honesty only for legacy threads, not new workspaces.

Path A is the right cut if you need **any** shippable client in weeks with zero backend ops. Path B is the right cut if the product **is** team chat and you can run one small service.

---

## What “don’t use Nostr for communities” means in this repo

| Layer | Path B policy |
|-------|----------------|
| Membership roster (join/leave/expel, who is in the room) | **Obscur coordination API** (`apps/coordination`) — signed head/deltas, not relay roster |
| Community chat ciphertext | Existing sealed / room-key model can remain; **publish** targets **configured trusted relay(s)** only |
| Public relay graph | **Out of scope** for workspace communities — no `nos.lol`-as-directory |
| Other Nostr clients | Best-effort read of open kinds only; **not** a supported team-admin workflow |

Future transport enum already allows `obscur_coordination` / `team_relay` ([v1.9.0-kernel-backend-spec.md](./v1.9.0-kernel-backend-spec.md)); Path B is implementing the **policy** side of that spec, not inventing a new stack.

---

## Path A — DM-only (if chosen)

**Implementation shape (high level):**

- Hide or feature-flag: Network → Group create, community home, invite-connections, participant modal, group management.
- Keep: DM threads, profiles, relays for **DM**, blocklist, security, backup.
- Docs: Mark Lane K community matrix **cancelled**; v1.9.x band exit redefined as gateway + DM-only evidence.

**Pros:** Honest, shippable, stops recurring community bugs.  
**Cons:** No team room product.

---

## Path B — Internal network (if chosen)

**Implementation shape (high level):**

1. **Hard gate at create:** `isCoordinationConfigured()` **and** coordination `/health` OK **and** relay tier ≠ `public_default`.
2. **Default mode:** `managed_workspace` only for new communities; sovereign room legacy read-only.
3. **Membership sync:** `coordination_preferred` only (remove “Nostr only” for new workspaces, or keep for legacy with frozen UI).
4. **Tests:** K-M1/K-M2 matrix on **local coordination** + two profiles — not on public relays.
5. **Later:** Optional dedicated `team_relay` transport when a private `wss://` is available.

**Pros:** Matches “internal network” requirement; uses code already written (B1/B2).  
**Cons:** Requires always-on coordination (Cloudflare Worker or self-hosted); still need **some** relay for sealed gossip unless you add a non-Nostr transport later.

---

## Testing without your own private server

You can still validate Path B **before** buying/standing up infrastructure:

| Piece | Local substitute |
|-------|------------------|
| Coordination directory | `pnpm -C apps/coordination dev` → `http://127.0.0.1:8787` |
| PWA / desktop build | `apps/pwa/.env.example`: `NEXT_PUBLIC_COORDINATION_URL=http://127.0.0.1:8787` |
| Two users | Two profiles (Tester1 / Tester2) in two desktop windows or browsers |
| Relay | Minimum: enable one relay both clients share. For **membership** proof, coordination alone satisfies K-M1/K-M2; chat publish may still need a writable `wss://` (can be a small local relay later). |

This is **not** production “private server,” but it is enough to prove **leave propagates** and roster **shrinks** when coordination owns the ledger — the failure you never saw on public Nostr.

Production Path B eventually needs: deployed coordination Worker (you already have a workers.dev URL in screenshots) + **one** trusted relay under your control (VPN, VPS, or on-prem). That is ops, not more UI patches.

---

## Decision record (fill when signed)

| Field | Value |
|-------|--------|
| **Chosen path** | ☑ **B — Internal network** · ☐ A — DM-only |
| **Signed by** | Maintainer (product decision via session 2026-06-02) |
| **Date (UTC)** | 2026-06-02 |
| **Immediate next step** | **Band B0:** confirm coordination + relay-tier gates on create; then **Band B1** membership truth subtraction ([back-online-modular-roadmap-2026-06.md](../archive/program/inactive-2026-06/back-online-modular-roadmap-2026-06.md)) |
| **Evidence base** | [exploration synthesis](../exploration/synthesis/as-built-architecture-and-fork-options.md) — modules 1–8 complete |

---

## References

- [v1.9.0-kernel-backend-spec.md](./v1.9.0-kernel-backend-spec.md) §4.7 coordination API
- [v1.9.2-scope.md](../archive/program/inactive-2026-06/v1.9.2-scope.md) — B2 exit criteria
- [apps/coordination/README.md](../../apps/coordination/README.md) — local dev
- [v1.9.0 demo matrix](../assets/demo/v1.9.0/README.md) — K-M1–K-M6
