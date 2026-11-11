# Feasibility — Decentralization spectrum (sovereign · federated · P2P)

**ID:** F7  
**Status:** draft  
**Date (UTC):** 2026-11-09  
**Charter:** `specs/backend/platform-feasibility-exploration-charter-2026-11-08.md`  
**Parents:** F-alt · F-hub · F-groups · F4 · F2 · F3 · F6 · F-sync · F-PSE  
**Claim language:** **spectrum mapped** ≠ “fully decentralized shipped” · ≠ uncensorable · ≠ no servers ever

## 1. Scope

- **In:** Where Obscur sits on the **decentralization spectrum**; which modes fit private-trust launch vs public communities; how to avoid binary “centralized vs P2P” marketing.
- **Out:** Inventing a new DHT this phase; claiming zero infrastructure.

## 2. Basics

Decentralization is **not one dial**. Obscur separates:

| Layer | Can be… |
|-------|---------|
| **Identity / account** | Self-custody workspace (local keys) — already law |
| **Relationship CRM** | Local sticky graph — already law (F1) |
| **Message crypto** | E2EE tiers T0–T4 — F5 |
| **Delivery / home** | User VPS · federated HS · public relays · onion · optional P2P later |
| **Discovery** | Invite-first · community directory · research PSI — F16/F17 |

```text
More sovereign ◄──────────────────────────────────► More networked
  Local-only     Private DC/VPS    Federated HS     Public relays    Global DHT/P2P
  (export USB)   (game server)     (Matrix)         (Nostr pools)    (research)
```

**Maintainer launch face (F-alt):** **private-trust / own infra** as default surface — sovereign *operations*, not “no computers anywhere.”

## 3. Capabilities map

| Mode | What user runs | Censorship resistance | Ops burden | Fit |
|------|----------------|----------------------|------------|-----|
| **S0 Local / sneakernet** | File Continuity only | N/A online | Low | Backup/restore (F-sync M1/M4) |
| **S1 Private home** | Own VPS relay/DC | High vs public platforms | Med | **Primary private-trust** |
| **S2 Community home** | Shared org DC | High within community | Med | Workspaces / interest groups |
| **S3 Federated** | Matrix HS (optional federation) | Med–high | Med–high | Public/moderated communities (F3) |
| **S4 Public relay pools** | Third-party Nostr relays | Variable | Low for user | Optional Balanced/Public profile (F2) |
| **S5 Tor underlay** | Path hardening | Improves S1–S4 paths | Med | Optional (F6) |
| **S6 Pure P2P / DHT** | No always-on home | Research-hard (mobile offline) | High product risk | **Later / lab** — not Cut 0 |

## 4. Fit to planes

| Plane | Decentralization rule |
|-------|----------------------|
| Auth | Always local-root (S0–S5); never IdP-root |
| Profile | Local isolation; sync via sealed Continuity |
| Storage | Prefer S1/S2 for durable private data |
| Relationship | Always local authority; homes only carry intents |
| Message | Pin picks mode per group (F-groups) |
| Transport | S1–S5 underlays; S6 not required for GO |

## 5. Libraries / stacks

N/A as a single library. Mode → prior notes: F4 (S1/S2), F3 (S3), F2 (S4), F6 (S5), F-sync (S0).

## 6. Feasibility verdict

**`fit-with-adapter`** — Obscur should be explicitly **multi-mode**:

| Product face | Default mode |
|--------------|--------------|
| Private-trust / family / workspace | **S1** (+ optional S5 Tor) |
| Public Web3 / large moderated | **S3** and/or discoverable S2 |
| Casual Nostr social | **S4** optional, labeled |
| Offline / new device | **S0** always available |

**`reject-for-core`:** “We are fully P2P / server-free”; “public relays = decentralization done”; forcing S3 matrix.org as the only private-trust path.

**Why this is better than a slogan:** Users get **sovereign homes** without waiting for perfect P2P; public modes stay available without owning CRM or crypto lies.

## 7. Risks / traps

- Marketing S4 as private-trust.  
- Single Obscur-operated S2 that becomes a chokepoint (offer reference; allow self-host).  
- S6 research delaying F9.  
- Confusing federation (S3) with self-custody identity (already true at auth layer).

## 8. Open questions

1. Does GO require a documented **S1 reference compose** (F4 open Q) before NARROW?  
2. Is S3 in the first public release or staged after S1 messaging?  
3. Any hard non-goal list for S6 (BitMessage-class, etc.)?

## 9. References

- `docs/exploration/feasibility/13-architecture-alternatives-hub-critique.md`  
- `docs/exploration/feasibility/04-private-relay-server.md`  
- `docs/exploration/feasibility/02-nostr-carrier.md` · `03-matrix-carrier.md` · `06-tor-underlay.md`  
- `docs/handoffs/current-session.md` — launch face private-trust decision  
