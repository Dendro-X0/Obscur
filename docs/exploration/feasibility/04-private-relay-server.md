# Feasibility — Private relay / custom server (trusted DC · VPS “game server”)

**ID:** F4  
**Status:** draft  
**Date (UTC):** 2026-11-09  
**Charter:** `specs/backend/platform-feasibility-exploration-charter-2026-11-08.md`  
**Parents:** F2 · F-groups · F-netconfig · F-sync · F-hub · F-alt · F-PSE  
**As-built lean:** local `:7000` / HTTP mesh presets · community vs DM relay scope · sealed communities on scoped relays  
**Claim language:** **explored** ≠ Obscur operates everyone’s DC · ≠ Tor Verified · ≠ private relay = E2EE

## 1. Scope

- **In:** Operator-owned / user-owned **homes** for delivery and durable group/media state — private Nostr relays, mesh gateways, custom DC APIs — as the **private-trust** backbone (game-server model).
- **Out:** Implementing a hosted Obscur cloud this phase; Soft L3 Pass; treating any private socket as “secure messaging done.”

## 2. Basics

Public relays are **hostile or indifferent** stores: anyone who can read may scrape; write policies vary; retention is not a product contract.

A **private home** is infrastructure the user or community **chooses to trust for availability and access control**, not for reading E2EE plaintext:

```text
Workspace
  └── named Home (F-netconfig)
        · wss://relay.family.example     (Nostr relay, whitelist)
        · https://dc.org.example/api     (custom Obscur DC)
        · https://matrix.example         (homeserver — detail in F3)
        · http://192.168.x.x:8788        (LAN mesh)
```

| Private home provides | Does **not** provide by itself |
|----------------------|--------------------------------|
| Reachability among members | Relationship CRM authority (F1) |
| Preferential history / file CAS retention | Content confidentiality (needs F-PSE tier / F5) |
| Write ACL / invite-gated join at transport | “Unbreachable” / Tor Verified |
| Continuity blob parking (F-sync M2) | Unlock / auth door |

**Game-server law (F-groups):** each group **pins** one home (+ protocol). Members dial that home for that room’s consistency.

### Home kinds ( Obscur-facing )

| Kind | Wire | Typical use |
|------|------|-------------|
| **H-relay** | Nostr WebSocket (strfry, nostr-rs-relay, …) | Private-trust Nostr pin; family/community |
| **H-mesh** | HTTP/WS team/mesh dialect (as-built Conduit-style) | Lab / LAN / custom private DC |
| **H-dc** | Obscur-defined DC API (CAS + membership + backup blobs) | Full game-server product path |
| **H-hs** | Matrix homeserver | Federated public/private rooms — F3 |
| **H-tor** | Any of above over onion / Tor underlay | Hardened path — F6 |

**Important honesty:** Whitelisting pubkeys on a Nostr relay restricts **writes**; it does **not** encrypt events at rest for the operator. Ciphertext policy remains F-PSE/F5.

## 3. Capabilities map

| Need for Obscur | Private home? | Notes |
|-----------------|---------------|-------|
| Private-trust launch face | **Yes — primary** | Prefer H-relay/H-dc over public pools (F-alt) |
| Group consistency + files | **Yes** | Pin + CAS on home (F-groups) |
| Sealed Continuity backups | **Yes (M2)** | Better than public-relay M3 (F-sync) |
| 1:1 delivery without public metadata fan-out | **Partial** | Fewer observers; still need T2+ crypto |
| CRM / Accept sticky | **No** | Sticky graph local; home only carries intents |
| Replace E2EE | **No** | Operator can still be honest-but-curious on clear/T1 |
| Scale public Web3 megaserver | **Partial** | Possible; moderation/ops burden rises — may prefer H-hs (F3) |
| Soft L3 dual public lookback CRM | **No** | Still reject |

## 4. Fit to planes

| Plane | Fit | Notes |
|-------|-----|-------|
| Auth | Adjacent | Home may auth clients (NIP-42, tokens); never replaces workspace door |
| Profile | Linked | Homes stored as named packs per workspace |
| Storage | **Strong** | Durable message/media/backup blobs live here by policy |
| Relationship | Transport of intents | ACL ≠ TRUSTED |
| Message | Delivery + retention | Pin defines where stream lives |
| Transport | **This note’s core** | Clearnet / Tor / SSH bastion underlays (F-netconfig) |

## 5. Libraries / stacks

| Candidate | Lang | Role | Maturity | Notes |
|-----------|------|------|----------|-------|
| [nostr-rs-relay](https://sr.ht/~gheartsfield/nostr-rs-relay/) | Rust | Personal/small VPS relay · SQLite | Mature | Whitelist, rate limits, Docker-friendly |
| [strfry](https://usenostr.org/relay.html) | C++ | Higher-throughput relay | Mature | Common VPS deploy + Caddy |
| As-built `:7000` / HTTP `:8788` presets | — | Lab mesh | In tree | Must stay **badged lab**, not silent prod default |
| Custom **H-dc** (future) | Rust preferred | CAS + membership + backup API | Design | Aligns F-stack; not required to use Nostr wire internally |
| Matrix Synapse/Conduit | — | H-hs | Mature | F3 |

## 6. Feasibility verdict

**`fit-with-adapter`** — Private relays / custom DCs / trusted VPS are **feasible and preferred** for Obscur’s private-trust face: they supply the **home** abstraction F-groups and F-netconfig need, without making Obscur a central social graph.

**`lab-only`** — Localhost-only mesh as the *only* documented home (OK for soak; not the product story).  
**`reject-for-core`** — “Private relay ⇒ E2EE done”; mandatory Obscur-hosted DC as sole Continuity path; public relays as the only storage for family files.

### Reference architecture (product)

```text
Operator VPS
  ├── TLS terminator (Caddy/nginx)
  ├── Nostr relay OR Obscur DC service
  ├── object store / disk for CAS + backups
  └── optional Tor onion twin
Client workspace
  └── Home pack "Family VPS" → pin on groups + M2 Continuity
```

**UX:** Settings → Homes → “Add trusted server” wizard (URL, auth, test dial, save pack) — F-netconfig Simple/Advanced split.

**Performance:** One pinned home per active group beats dialing N public relays; pool caps still apply for optional public apps.

**Scalability:** Many small homes > one megapool for private communities; public megacommunities may graduate to H-hs (F3).

## 7. Risks / traps

- Equating write-whitelist with confidentiality.  
- Shipping hybrid public+loopback as unmarked default.  
- Using private relay lookback to rebuild CRM (same Soft L3 physics).  
- Single VPS as silent SPOF without backup/export (F-sync M1 still required).  
- Building a full Discord-scale DC before H-relay MVP works.

## 8. Open questions

1. MVP home: document **H-relay (nostr-rs-relay/strfry)** only, or also specify minimal **H-dc** API in F8/F9?  
2. Does Obscur ship a **reference compose** (relay+Caddy+CAS) as “Obscur Home” appliance?  
3. Auth to private relay: NIP-42 vs shared token vs mTLS?  
4. Multi-home failover for one group pin — in-scope or explicit non-goal for v1?  
5. Billing/ops for any Obscur-operated reference realm — product, not this note.

## 9. References

- `docs/exploration/feasibility/02-nostr-carrier.md`  
- `docs/exploration/feasibility/18-community-group-systems.md`  
- `docs/exploration/feasibility/19-network-protocol-configuration-ux.md`  
- `docs/exploration/feasibility/20-cross-device-profile-sync-e2ee.md`  
- `apps/pwa/app/features/transport-kernel/transport-preset-catalog.ts`  
- nostr-rs-relay · strfry deploy guides (external)  
