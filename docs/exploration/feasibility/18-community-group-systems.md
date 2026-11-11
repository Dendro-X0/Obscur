# Feasibility — Community / group systems (public · private · DC-backed)

**ID:** F-groups  
**Status:** draft  
**Date (UTC):** 2026-11-09  
**Charter:** `specs/backend/platform-feasibility-exploration-charter-2026-11-08.md`  
**Parents:** F-hub · F-alt · F-PSE · F-discover-methods · F-rel-discover · vault/sandbox design  
**As-built lean:** sealed communities (`access: open | invite-only | discoverable`), join approve/deny, scoped relays, group thread SQLite, content timeline hooks  
**Claim language:** **explored** ≠ Discord/Telegram parity · ≠ multi-protocol groups Pass · ≠ Obscur hosts everyone’s DC

## 1. Scope

- **In:** Product shape for **public** communities (Web3/Discord/Telegram-like discussion) and **private** groups (family, invite-only interests, workspaces); **shared content/files**; **one protocol pin per group**; **operator data centers / trusted VPS** (“game server” model); how this fits the hub without a central Obscur social graph.
- **Out:** Implementing group rewrite this phase; Soft L3 1:1 contact Pass; claiming Tor Verified for group infra.

## 2. Basics

### What a “group” is on Obscur (target)

A **Group** is a first-class hub object with:

| Field | Meaning |
|-------|---------|
| **Access policy** | Public / discoverable / invite-only / approval-gated (see §3) |
| **Membership** | Roles (owner, mod, member, …) — local sticky + sync intents (same law as F16, group-scoped) |
| **Pinned carrier stack** | **One primary protocol + transport binding** all members use for *this* group’s chat (consistency) |
| **Home DC / relay set** | Where history, media pointers, and membership truth prefer to live (“game server”) |
| **Content plane** | Messages, posts, files — inbound still sandboxed; durable blobs on DC and/or encrypted vault mirrors |

**Key law — protocol pin:** Inside one group, members share the **same** configured stack so history and crypto stay coherent. The **workspace** may still speak many protocols across *different* groups/apps. Users do **not** freestyle “I’m on Matrix while you’re on Nostr” inside the same room.

```text
Workspace (multi-protocol capable)
   ├── Group A  → pinned: Private-mesh @ dc.alice.example   (family)
   ├── Group B  → pinned: Matrix @ homeserver.community     (public Web3)
   └── Group C  → pinned: Nostr NIP-29 @ relay.operator     (topic public)
```

### Game-server / DC analogy

| Game world | Obscur group |
|------------|--------------|
| Players join one server | Members join one group home |
| Server holds world state | DC holds membership, history, file CAS (per policy) |
| Client can add mods | Operator can choose carrier + retention |
| You can host your own | User/org brings **trusted VPS / private DC** |
| Official realms optional | Obscur may ship **reference** DCs — not the only CRM |

Obscur the company **need not** be Facebook’s graph. It **may** offer default public realms; power users point groups at **their** VPS like a dedicated game server.

## 3. Capabilities map — access classes

| Class | Who can find / join | Examples | Discovery (F17) |
|-------|---------------------|----------|-----------------|
| **G-public open** | Listed; join free or light gate | Public Web3 discussion, Telegram-style channels | Community packs, topic search, operator index |
| **G-discoverable gated** | Listed; join needs approve | Interest communities with moderation | Directory + join request |
| **G-private invite** | Not listed; invite/QR/code only | Family, close friends | D0 invites / event codes |
| **G-workspace** | Org directory / SSO-attestation later | Company / DAO working groups | Operator DC roster (B3) |

As-built already names `open | invite-only | discoverable` plus join request approve/deny — keep that vocabulary in the hub model.

### Content & files

| Path | Rule |
|------|------|
| Message / post | Group pin’s crypto tier (F-PSE); public groups may be T0–T2; private should aim T3/T4 where feasible |
| File upload | Land in **sandbox** for recipients; operator DC stores CAS; optional promote to personal vault |
| Consistency | DC (or pinned relay set) is **source of stream**; clients cache in profile SQLite |
| Multi-device | Continuity of membership + entitled history via DC + local durable store — not random public lookback |

## 4. Fit to planes

| Plane | Group rule |
|-------|------------|
| Auth | Workspace unlock; group join is separate capability |
| Profile | Membership rows per workspace; hard isolation |
| Storage | Group home DC + local cache; vault for personal keeps |
| Relationship | 1:1 CRM ≠ group membership (linked but distinct) |
| Message | Group threads under pin |
| Transport | **Pinned** underlay for that group; user may configure **which** pin at create/migrate time |

### Multi-protocol configuration (honest)

| Allowed | Forbidden |
|---------|-----------|
| User/operator picks protocol+DC when **creating** or **migrating** a group | Mixed protocols in one live room |
| Workspace enables many carrier apps globally | Silently “bridge” Matrix↔Nostr inside one group without a declared bridge product |
| Read-only export/import between stacks (migration cut) | Pretending Discord parity on pure public Nostr alone |

## 5. Libraries / stacks

| Need | Candidates / notes |
|------|-------------------|
| Public federated rooms | Matrix (as-built lab) — strong for Discord-like |
| Relay groups | NIP-29 / sealed community path (as-built) |
| Private mesh / DC | Custom server + SQLite/CAS — F4 private relay note |
| Group E2EE | MLS / Megolm / sealed room keys — F5 + F-PSE tiers |
| File CAS | Profile/DC content-addressed store + sandbox policy |

Exact picks remain F3/F4/F5/F9.

## 6. Feasibility verdict

`fit-with-adapter` — Community/group systems are feasible under the **staged hub** if:

1. **Access classes** (public / discoverable-gated / invite / workspace) are first-class.  
2. Each group has a **pinned protocol + home DC/relay set** (game-server model).  
3. **Trusted VPS/DC** is a supported operator mode — consistency and file hosting live there.  
4. Content/files obey **sandbox → DC/vault** laws.  
5. Multi-protocol means **many groups / many pins**, not polyglot chaos in one room.

`lab-only` — Full Discord/Telegram feature parity on day one.  
`reject-for-core` — “Public Nostr is enough storage for all group files/history” as the sole architecture; unpinned multi-protocol rooms.

### Recommended product shape

```text
Create Group
  → choose access class
  → choose home: Obscur reference DC | my VPS | Matrix HS | private relay set
  → pin protocol stack
  → optional: discoverable listing / interest tags
Members
  → same pin; join via open / approve / invite
Content
  → messages + files on home DC; clients sync; inbound sandbox
```

**Public Web3-style:** discoverable + operator or reference DC + moderated join or open.  
**Family/private:** invite-only + user VPS or sealed private relay + higher crypto tier.  
**Workspace:** org DC + roster + optional attestation bridge (never OAuth-as-root for personal workspace).

## 7. Risks / traps

- Using public relays as the only “DC” for private family files.  
- Bridging protocols inside one group without saying so (split history, crypto lies).  
- Equating group membership with 1:1 TRUSTED.  
- Global people search disguised as “community discovery.”  
- Obscur operating a mandatory central DC that becomes the product choke point (offer defaults; allow self-host).  
- File sharing without sandbox (hostile GIFs/docs in public groups).

## 8. Open questions

1. Default home for new public groups: Obscur reference DC vs user-picked relay?  
2. Migration story when a group changes pin (Nostr → Matrix or VPS move)?  
3. MLS/sealed keys required for G-private, optional for G-public?  
4. Cross-group “spaces” (Discord-like categories) as hub objects or UI only?  
5. Billing/ops for reference DCs — out of engineering feasibility, but product-relevant.

## 9. References

- As-built: `use-sealed-community-types` access/join/content timeline; group thread SQLite  
- `docs/exploration/feasibility/12-hub-workspace-vault-adapters.md`  
- `docs/exploration/feasibility/13-architecture-alternatives-hub-critique.md`  
- `docs/exploration/feasibility/16-relationship-discovery-decentralized-sync.md`  
- `docs/exploration/feasibility/17-discovery-methods-catalog.md`  
- `specs/backend/sandboxed-storage-security-design-2026-11.md`  
- Charter F4 private relay / F3 Matrix (owed carrier notes)  
