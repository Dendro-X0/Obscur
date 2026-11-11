# Feasibility — User discovery methods catalog (current + candidates)

**ID:** F-discover-methods  
**Status:** draft  
**Date (UTC):** 2026-11-09  
**Charter:** `specs/backend/platform-feasibility-exploration-charter-2026-11-08.md`  
**Parents:** [`16-relationship-discovery-decentralized-sync.md`](./16-relationship-discovery-decentralized-sync.md) · F1 · F-hub · F-alt · F-PSE  
**As-built:** `apps/pwa/app/features/search/` (`DiscoveryEngine`, friend codes, contact cards, pubkey parse, community refs, relay/index sources)  
**Claim language:** **catalogued** ≠ implemented · ≠ Soft L3 Fixed · ≠ “global people search Pass”

## 1. Scope

- **In:** Inventory of **how users can find each other today**; additional methods that fit a **community / shared-interest** product **without** a Facebook-style central graph or Nostr-CRM lookback.
- **Out:** Coding discovery this phase; treating relay profile search as relationship authority.

## 2. Basics

**Discovery ≠ relationship.** Finding an addressable peer or community only produces a **candidate**. TRUSTED / Requests still require the sticky edge + signed intents (F16).

**Community product need:** focused people should meet **through shared context** (topic, space, event, operator community) — not only through already knowing a hex key.

### As-built today (platform)

| Method | Mechanism (as-built) | Notes |
|--------|----------------------|-------|
| **Friend codes** | Friend code v2/v3 (+ alias kind on relays) | Direct resolve → person/invite |
| **Public key search** | `npub` / hex parse; optional relay/index profile enrich | Direct address; poor casual UX |
| **QR / card** | Contact card v1 in query; deep-link flags in privacy settings | Same family as out-of-band invite |
| **Invite codes** | Invite parser path in discovery engine | Overlaps friend-code / group invite surfaces |
| **Community ref search** | NIP-29-style `id'relay` + relay community query + optional index | Finds **spaces**, not CRM edges |
| **Text people/community search** | Relay + cache + optional index | Soft / degraded; must not auto-TRUST |

Privacy settings already sketch **deep links** and **suggestions** flags — suggestions are not a finished decentralized design.

## 3. Capabilities map — additional methods we could implement

Grouped by product job. Each row is a **candidate**, not a commitment.

### A. Strengthen peer-to-peer (know someone already)

| ID | Method | Idea | Feasibility | Privacy | Community fit |
|----|--------|------|-------------|---------|---------------|
| A1 | **Expiring single-use invites** | Extend friend-code v3 single-use/TTL as default share | High | High | Low (1:1) |
| A2 | **Mutual introduction** | Trusted C proposes A↔B; both Accept | Med | High | Medium (warm graph) |
| A3 | **Nearby / LAN / Bluetooth** | Ephemeral codes over local radio; optional | Med | High | Events / co-located focus |
| A4 | **Voice/video call link invite** | Mid-call “add as contact” with confirm | Med | High | Medium |
| A5 | **Contact card file / NFC** | Signed card blob share beyond QR | High | High | Low–Med |

### B. Shared-interest & community (focused people ↔ focused people)

| ID | Method | Idea | Feasibility | Privacy | Community fit |
|----|--------|------|-------------|---------|---------------|
| **B1** | **Interest / topic rooms** | Join a community by topic tag; members visible **inside** that space only; DM still needs invite/Accept | Med | Med (room-scoped) | **High** |
| **B2** | **Community member directory (opt-in)** | Per-community roster of members who marked “discoverable here” | Med | Med | **High** |
| **B3** | **Operator / private DC people index** | Community-run directory (D2 in F16); not Obscur global | Med | Operator-trust | **High** for orgs |
| **B4** | **Interest beacons (opt-in publish)** | Short-lived signed “looking for X” posts on chosen relays/spaces; reply → invite flow | Med | User-controlled | High for focused seekers |
| **B5** | **Event / meetup codes** | Time-boxed community event code → temporary lobby → mutual Accept | High | High | High (IRL + online) |
| **B6** | **Shared vault / project workspace invite** | Discover via collaboration object, not global search | Med | High | High for builders |
| **B7** | **Curated interest packs** | Maintainer/operator publishes pack of communities (not people); user opts in | High | High | Medium–High |
| **B8** | **Introduction circles** | Small closed groups where members can request intros with policy | Low–Med | High | High for trust-heavy niches |

### C. Convenience (use carefully)

| ID | Method | Idea | Risk |
|----|--------|------|------|
| C1 | **Username on private index** | `alice@community.example` via operator DNS/index | Fine if **opt-in operator**; bad if global Obscur username enumeration |
| C2 | **Phone/email PSI** | Find who else has the app | Needs directory operator; conflicts with default no-central stance — **lab / enterprise only** |
| C3 | **Global relay name search** | Free-text across public relays | Enumeration, spam, Soft L3-class false friends — **keep degraded / never auto-trust** |
| C4 | **Follow-graph / WoT suggestions** | “People you may know” from Nostr follows | **Reject as relationship authority** (may show *public* follows as non-CRM hints only with harsh labeling) |

### D. Research (later)

| ID | Method | Notes |
|----|--------|-------|
| D1 | PSI / UDM / Arke / DNS dead-drops | From F16 bibliography — not Cut 0 |

## 4. Fit to planes

| Plane | Rule for new methods |
|-------|----------------------|
| Auth | Discovery never unlocks foreign profiles |
| Profile | “Discoverable in community X” is a **per-workspace preference**, not a global broadcast by default |
| Storage | Candidate cache ≠ graph edge |
| Relationship | Every successful discovery ends in **invite intent**, not silent TRUSTED |
| Message | Community chat ≠ 1:1 trust |
| Transport | Community directories may live on private relays; public relays are hostile |

## 5. Libraries / stacks

Reuse discovery engine intents (`add_friend`, `search_people`, `search_communities`, `resolve_invite`, `resolve_card`) and extend with **community-scoped** sources — do not invent a second CRM.

Prefer: local SQLite graph · community roster as **space-scoped** tables · signed beacons · operator index adapters (hub apps).

## 6. Feasibility verdict

`fit-with-adapter` — Expand discovery along **two lanes**:

1. **Keep/improve D0** — friend codes, QR/cards, pubkey (as-built).  
2. **Add community-native discovery (B1–B5 first)** — shared spaces, opt-in member lists, event codes, interest beacons — so focused users meet **in context**.

`reject-for-core` — Global people recommendations from public follow graphs; phonebook upload as default; discovery that writes TRUSTED without Accept.

### Suggested priority (exploration → later cuts)

| Priority | Implement when designing cuts | Why |
|----------|-------------------------------|-----|
| **P0** | A1 expiring invites · B5 event codes · B2 opt-in community directory | High community value, no central graph |
| **P1** | A2 mutual intro · B1 topic rooms as discovery surface · B3 operator index adapter | Matches hub + private-trust |
| **P2** | A3 nearby · B4 interest beacons · B6 project invites | Enrichment |
| **P3** | C2 PSI · D1 research | Only with explicit operator charter |

## 7. Risks / traps

- Community directory that is secretly a global people search.  
- Interest beacons without rate limits → spam/honeypots.  
- Showing relay “profiles” as verified friends.  
- Suggestions flag (`discoverySuggestionsV1`) implemented as Nostr WoT.  
- Forcing every community member to be publicly discoverable.

## 8. Open questions

1. Default for new community members: **hidden** until “discoverable here”?  
2. Can interest beacons be **anonymous** until Accept (show topic only)?  
3. Cross-community discovery: allowed with dual opt-in, or never?  
4. Should username (C1) be workspace-scoped (`name@space`) only?  
5. How do Matrix rooms vs Nostr groups share one “community discovery” UX under the hub?

## 9. References

- `apps/pwa/app/features/search/types/discovery.ts`  
- `apps/pwa/app/features/search/services/discovery-engine.ts`  
- `apps/pwa/app/features/settings/services/privacy-settings-service.ts` (invite / deep-link / suggestions flags)  
- `docs/exploration/feasibility/16-relationship-discovery-decentralized-sync.md`  
- `docs/exploration/feasibility/01-relationship-authority.md`  
