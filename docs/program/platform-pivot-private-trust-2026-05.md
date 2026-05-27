# Platform pivot — private trust infrastructure (2026-05)

**Status:** Strategic direction (maintainer draft)  
**Supersedes:** “Obscur is a Nostr client with communities” as the **primary** product story  
**Aligns with:** [00-charter-vision.md](../future/00-charter-vision.md), [product-layers-and-nostr.md](../architecture/product-layers-and-nostr.md), [community-fork-decision-2026-05.md](./community-fork-decision-2026-05.md)

---

## One-sentence position

**Obscur is a transport-agnostic, E2E-first communication platform** that teams deploy on **infrastructure they trust** (private relays, coordination service, optional homeserver). **Nostr is an optional adapter** for open-network scenarios—not the product definition and not the membership authority for workspace communities.

---

## Why public relays failed the product (not the team)

| Factor | Under team control? | Effect on communities |
|--------|---------------------|------------------------|
| Relay retention / dedup / rate limits | **No** | Join/leave events missing or delayed |
| Roster = gossip on `nos.lol`-class hosts | **No** | Frozen or monotonic-wrong participant lists |
| Other Nostr clients | **No** | No Obscur delete/membership semantics |
| User disables `groups.fiatjaf.com` in Settings | **Partial** | Publish fails while UI still targets that relay |

Patching UI around these constraints was **futile** for workspace-grade behavior. The correct move is to **change the default deployment model**, not to chase another public-relay edge case.

---

## Target platform model

```text
┌─────────────────────────────────────────────────────────────┐
│ Obscur client (desktop / PWA)                                │
│  E2EE · profiles · DM · team rooms · security modes          │
└────────────────────────────┬────────────────────────────────┘
                             │ ClientGateway + kernel semantics
┌────────────────────────────▼────────────────────────────────┐
│ Kernel (visibility, membership, recall, projections)         │
└────────────────────────────┬────────────────────────────────┘
                             │ TransportPort (pluggable)
        ┌────────────────────┼────────────────────┐
        ▼                    ▼                    ▼
  Team transport      Coordination service    Nostr adapter
  (private wss/API)   (membership directory)   (optional, public)
```

### What users get on **trusted private servers**

| Capability | Public Nostr today | Private trust stack |
|------------|-------------------|---------------------|
| Live roster join/leave | Unreliable hints | Coordination head/deltas + team transport fanout |
| “Delete for everyone” (cooperative) | Best-effort command on immutable relay | Command channel on **operator transport** + kernel tombstones |
| Real-time presence / delivery | Polling / relay latency | Server-assisted signals (WebSocket/SSE) **without** plaintext |
| Predictable group admin | No | Steward-signed membership deltas |
| Policy: no plaintext at rest on server | Relay stores events | **Design requirement** for team/coordination layers |

### What we still claim (honestly)

| Claim | Meaning |
|-------|---------|
| **E2E encryption** | Plaintext only on client; server sees ciphertext + unavoidable metadata unless minimized |
| **No single official server** | Federation of **deployments** (your org’s relay + coordination, another org’s)—not one global Obscur HQ |
| **Censorship resistance** | Optional Nostr path + ability to run your own stack; not “immune to nation-state on one VPS” |
| **Decentralization** | **Operator choice** and multi-deployment—not blockchain, not “no server anywhere” |

We **do not** claim: a compromised server learns nothing **at all** (timing, sizes, IP, ciphertext volume remain); magic “delete from the universe”; or that Nostr public relays become reliable for HR-style rosters.

---

## “No-logs” mode (security posture, not marketing)

**Goal:** If an adversary gains **disk or DB access** to the operator server, they cannot recover **message content** or **room keys**.

**Requires (architecture, to be enforced in team transport):**

1. **No plaintext persistence** — store only ciphertext blobs + minimal routing metadata; keys only in client vault.
2. **Short-lived server caches** — optional RAM-only fanout; configurable retention caps for encrypted envelopes.
3. **Signed membership deltas** — coordination already avoids chat plaintext; extend policy to **reject** endpoints that accept content fields.
4. **Client-enforced modes** — “no-logs” UI = refuse sends to servers that fail attestation / policy handshake (future TransportPort capability flags).
5. **Audit transparency** — open schema: what fields **can** exist on server; operators publish what they enable.

**Still visible to a compromised server (be explicit in docs):** connection times, pubkeys, group ids, message sizes, rate patterns. Mitigations later: padding, blind routing—out of v1 scope unless specified.

---

## Nostr: gradual replacement, not a day-one rip-out

| Phase | Transport | Product surface |
|-------|-----------|-----------------|
| **Now (freeze)** | Stop expanding **public-relay community truth** | Path B gate or Path A DM-only ([fork doc](./community-fork-decision-2026-05.md)) |
| **v1.9.x complete** | `TransportPort` + coordination membership (B2) | Workspace create requires coordination + trusted relay tier |
| **v2.x** | **Primary:** `team_relay` / private API adapter | DM + groups default to configured private base URL |
| **Long-term** | Nostr adapter **optional** | “Open network” profile for users who want public relays |

Code already points here: `TransportKind` includes `team_relay`; `apps/coordination` is the membership directory prototype; Lane K separated transport from features.

---

## Relation to Path A / Path B

| Fork | Under this pivot |
|------|------------------|
| **A — DM-only** | Valid **interim** release while team transport is built; Nostr DM adapter remains |
| **B — Internal network** | **First slice** of this pivot—coordination + trusted relay only |

**Recommended sequence:** Sign **B** now → implement hard gates → implement **team transport** as default for new workspaces → demote Nostr to optional adapter in copy and settings.

---

## Implementation priorities (when coding resumes)

1. **Policy gates** — refuse community create on `public_default` relays; require coordination `/health`.
2. **Single membership owner** — coordination deltas → B1 kernel port (no parallel relay roster truth).
3. **Team TransportPort v0** — private `wss://` or HTTPS envelope API; fanout recall + membership commands.
4. **Real-time channel** — presence/delivery on same trust domain (subordinate to E2EE).
5. **No-logs attestation** — server capability document + client refusal path.
6. **Docs / marketing** — remove “Nostr client” primary framing; [encyclopedia](../encyclopedia/12-core-architecture-truth-map.md) updated to match.

**Out of scope until v2:** Full homeserver federation spec, blockchain, replacing Nostr for **open** DMs in one release.

---

## Local dev without a production private server

| Role | Local stand-in |
|------|----------------|
| Coordination directory | `pnpm -C apps/coordination dev` → `http://127.0.0.1:8787` |
| Client | `NEXT_PUBLIC_COORDINATION_URL=http://127.0.0.1:8787` in `apps/pwa/.env.example` |
| Team relay | Later: dockerized `strfry` or minimal Obscur relay; until then, one shared writable `wss://` both clients enable |

Enough to prove roster shrink and leave propagation **before** production VPS.

---

## Decision checklist (sign-off)

- [ ] Primary product story = **private trust platform**, Nostr = optional adapter  
- [ ] Public-relay **workspace communities** = unsupported for new creates  
- [ ] “No-logs” defined as **ciphertext-only server policy**, not absolute adversary blindness  
- [ ] Next engineering band = **B + team transport sketch**, not public-relay patches  

---

## References

- [v1.9.0-kernel-backend-spec.md](./v1.9.0-kernel-backend-spec.md) — TransportPort, coordination API  
- [v1.9.2-scope.md](./v1.9.2-scope.md) — membership deltas  
- [apps/coordination/README.md](../../apps/coordination/README.md)  
- [01-kernel-transport-sketch.md](../future/01-kernel-transport-sketch.md)
