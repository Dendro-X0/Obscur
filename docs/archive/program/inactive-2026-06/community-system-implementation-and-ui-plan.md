# Community System — Implementation and UI Plan

_Status: approved direction (2026-05-19). Implementation in phases; not a release gate until P0 descriptor + projection convergence land._ **Version-aligned roadmap:** [community-system-overhaul-phased-roadmap.md](./community-system-overhaul-phased-roadmap.md).

**Related contracts (read first):**

| Doc | Role |
|-----|------|
| [25 Community ledger and projection](../protocols/25-community-ledger-and-projection-architecture-spec.md) | Planes, owners, recovery |
| [26 Community projection contract](../protocols/26-community-projection-contract.md) | Single read model |
| [27 Control and governance events](../protocols/27-community-control-and-governance-event-family.md) | Wire semantics |
| [10 Community operating model](../encyclopedia/10-community-and-groups-overhaul.md) | Runtime owners (locked) |
| [33 Community modes and relay guarantees](../archive/rewrite-shelf/33-community-modes-and-relay-guarantees.md) | Sovereign vs managed product framing |
| [community-display-name.ts](../../apps/pwa/app/features/groups/services/community-display-name.ts) | Human name vs hex id (partial) |

**Code anchors today:**

| Area | Path |
|------|------|
| Create UI | `apps/pwa/app/features/groups/components/create-group-dialog.tsx` |
| Community home | `apps/pwa/app/groups/[...id]/group-home-page-client.tsx` |
| Management dialog | `apps/pwa/app/features/groups/components/group-management-dialog.tsx` |
| Mode contract | `apps/pwa/app/features/groups/services/community-mode-contract.ts` |
| Sealed runtime | `apps/pwa/app/features/groups/hooks/use-sealed-community.ts` |
| Lifecycle owner | `apps/pwa/app/features/groups/providers/group-provider.tsx` |

---

## 1. Purpose

Obscur communities must serve **interest groups** (member-governed, public relays) and **work teams** (steward/admin roles, trusted or self-hosted relays) without pretending every relay gives intranet-grade directory truth.

This document defines:

1. **What to build** on the control plane (descriptor, membership, governance, room keys).
2. **How the UI is reorganized** so creation and management expose mode-specific options through tabs.
3. **Phased delivery** so we fix broken basics (rename, roster, name persistence) before full democracy UI.

---

## 2. Product goals

| Audience | Need | Obscur answer |
|----------|------|----------------|
| Interest groups | Fair decisions when several people are active | **Member vote** on sensitive actions (rename, avatar, expel) |
| Solo creator | Full control while alone | **Solo steward** — immediate descriptor changes, no vote |
| Dev / company teams | Administrators, durable directory | **Managed workspace** on **trusted relay** + **designated stewards** |
| Privacy-conscious orgs | No centralized message store | E2EE content + **user-chosen relay**; honesty about relay limits |

**Non-goals for v1 of this plan:**

- Central server as authority for names or bans.
- Exact live global roster on Tier-1 public relays.
- Voting on ordinary chat messages.

---

## 3. Architectural foundations (unchanged owners)

Do **not** add parallel mutation paths. All community truth changes flow:

```text
User intent (UI)
  → signed control event (group-service)
  → ingest (use-sealed-community)
  → reducer (community-ledger-validator)
  → projection + ledger persistence (group-provider)
  → all UI surfaces read projection
```

### Planes

| Plane | Owns | User-visible examples |
|-------|------|------------------------|
| **Identity** | `communityId`, `groupId`, relay scope, descriptor version | Name, avatar, about, policy ref |
| **Membership** | join / leave / expel, active roster | Participants, invite eligibility |
| **Governance** | proposals, votes, resolutions | Rename vote, expel vote |
| **Room key** | epochs, rotation, distribution | Send eligibility after join |
| **Content** | E2EE timeline | Chat messages |

### Recovery precedence (unchanged)

1. Tombstones  
2. Membership ledger  
3. Persisted chat-state fallback  

Governance outcomes apply only after **`COMMUNITY_GOVERNANCE_RESOLVED`** with `resolution: accepted` (see protocol 27).

---

## 4. Community modes (user-facing)

Modes are chosen at **creation** and stored on the community descriptor (`communityMode`). They define **honest guarantees** and **which configuration tabs appear**.

| Mode | Relay expectation | Directory / roster | Authority default |
|------|-------------------|--------------------|-------------------|
| **Sovereign room** | Tier 1 (public default) OK | Best-effort; active roster with leave applied | `member_vote` when ≥2 active members; `solo_steward` when 1 |
| **Managed workspace** | Tier 2–3 required (trusted / intranet) | Target: relay-backed directory | `designated_stewards` (configurable) |

Relay assessment reuses `assessRelayCapability()` in `community-mode-contract.ts`. **Managed workspace** must be disabled or downgraded when `supportsManagedWorkspace === false`.

---

## 5. Authority policy (implementation model)

Store an immutable **`CommunityPolicy`** block on the descriptor (versioned). UI labels avoid the word “admin” in sovereign mode; use **Steward** / **Member** / **Voter** where needed.

### Authority modes

```ts
type CommunityAuthorityMode =
  | "solo_steward"           // activeMemberCount === 1
  | "member_vote"            // sovereign default for ≥2 members
  | "designated_stewards";   // managed workspace default

type GovernanceActionType =
  | "descriptor.name"
  | "descriptor.avatar"
  | "descriptor.about"
  | "descriptor.access"
  | "member.expel"
  | "member.invite_policy"
  | "relay.migrate"
  | "room_key.rotate";
```

### Rules

| Condition | Behavior |
|-----------|----------|
| **1 active member** | `solo_steward`: publish `COMMUNITY_DESCRIPTOR_UPDATED` immediately (no proposal). |
| **≥2 members**, sovereign + `member_vote` | Publish `COMMUNITY_GOVERNANCE_PROPOSED` → collect `COMMUNITY_GOVERNANCE_VOTE_CAST` → `COMMUNITY_GOVERNANCE_RESOLVED` → apply effects. |
| **Managed** + `designated_stewards` | Stewards (`stewardPubkeys[]`) may publish descriptor updates and expel events directly; optional “member ratify” later (hybrid). |

### Default quorum (sovereign / member_vote)

- Electorate: **active members** at proposal open (not message-author discovery set).
- Threshold: majority of active members who cast approve/reject; minimum 2 participating voters when `activeCount ≥ 2`.
- TTL: 72h → `resolution: expired` if not met.

### Sensitive vs routine

| Routine (no vote) | Sensitive (vote or steward) |
|-------------------|-----------------------------|
| Send message | Rename, avatar, about |
| Accept invite (per access policy) | Expel member |
| Leave self | Room key rotation |
| Local mute/hide | Relay migration |

---

## 6. Control-plane implementation backlog

### P0 — Descriptor truth (blocks “name stuck”)

| Item | Detail |
|------|--------|
| Implement `updateMetadata` | Replace noop in `use-sealed-community.ts`; publish `COMMUNITY_DESCRIPTOR_UPDATED`. |
| Ledger + projection | Monotonic `descriptorVersion`; persist human `displayName` in membership ledger. |
| Read convergence | Network list, community home, management use `resolveCommunityDisplayName()` + projection name field. |
| Solo path | If `activeMemberCount === 1`, skip governance UI; direct descriptor event. |

**Exit:** User can rename community; name survives refresh and new device; Network row shows human name.

### P1 — Governance MVP (sovereign democracy)

| Item | Detail |
|------|--------|
| Reducer | `governanceByCommunityId` per projection contract 26. |
| Events | Propose / vote / resolve per protocol 27 for rename + expel. |
| UI | Proposal cards on management **Governance** tab; pending state on home. |

**Exit:** Two-member room can vote to rename; expel removes member from active roster on all clients after evidence received.

### P2 — Managed workspace

| Item | Detail |
|------|--------|
| Steward list | `stewardPubkeys` on descriptor; capability matrix. |
| Relay gate | Create flow blocks managed mode on Tier 1. |
| Directory | Stronger roster materialization when relay contract satisfied (existing managed_workspace path). |

### P3 — UI overhaul (this document §7–9)

Tabbed create + management shells; deprecate scattered one-off dialogs where replaced.

### P4 — Optional

Hybrid steward+vote, encrypted public descriptors, P2P gossip of control events (relay remains durable source).

---

## 7. UI product model

### 7.1 Surface map (after overhaul)

| Surface | Route / entry | Role |
|---------|---------------|------|
| **Network → Groups** | `/network` | List communities from projection; human names; mode badge |
| **Create community** | Modal or `/groups/create` | Mode pick + mode-specific tabs + guarantees summary |
| **Community home** | `/groups/[id]` | Entry, chat, participants, policy summary (current bento evolves) |
| **Community manage** | `/groups/[id]/manage` or full-screen drawer | **Primary** settings hub — tabbed by mode |
| **Leave / block** | Dedicated routes (keep) | Irreversible actions isolated |

**Principle:** Community **home** = daily use; **manage** = configuration and governance. Avoid duplicating edit forms in home + dialog + management.

### 7.2 Creation experience (replace / extend create-group-dialog)

**Step A — Basics (all modes)**  
- Avatar, name, description  
- Relay host (with assessment banner)  
- Access: open / discoverable / invite-only (maps to `GroupAccessMode`)

**Step B — Mode selection (required)**  
- Cards: **Sovereign room** | **Managed workspace** (disabled + tooltip if relay tier insufficient)  
- Show **Selected guarantees** chips (already partially implemented)  
- Link: “Advanced relay settings” → Settings → Relays

**Step C — Mode configuration tabs** (see §8)  
- Tab strip switches panel content; state stored in `GroupCreateInfo` + `CommunityPolicy` draft  
- Footer: Cancel | **Create community** (enabled when basics + mode valid)

**Persist on create:**  
- `communityMode`, `authorityMode`, `stewardPubkeys` (if any), `relayCapabilityTier`, initial descriptor version `1`.

### 7.3 Management experience (new hub)

Replace `group-management-dialog.tsx` as the long-term **full management shell** (dialog on desktop narrow width, full page on mobile).

**Top bar:** Community name (from projection), mode badge, relay host, sync indicator.

**Tab strip (mode-dependent):**

| Tab | Sovereign room | Managed workspace |
|-----|----------------|-------------------|
| **General** | ✓ | ✓ |
| **Members** | ✓ | ✓ |
| **Governance** | ✓ (vote UI) | ✓ (steward actions + optional audit) |
| **Privacy & access** | ✓ | ✓ |
| **Relay & storage** | ✓ (read-mostly on Tier 1) | ✓ (migrate, policies) |
| **Stewards** | — | ✓ |
| **Advanced** | ✓ (export, room key) | ✓ |

Switching tabs does not change `communityMode` without explicit **“Change mode”** flow (P2+; warns about guarantee changes).

---

## 8. Mode-specific configuration (creation + manage)

### 8.1 Sovereign room — General tab

- Edit name / avatar / about (solo: save immediately; multi: **Propose change**).  
- Privacy: open | discoverable | invite-only (secret / stealth copy for invite-only + no registry listing).  
- Show **active authority**: “You are the only member — changes apply immediately” vs “Changes require member vote”.

### 8.2 Sovereign room — Governance tab

- Open proposals list (rename, expel, …).  
- **New proposal** dropdown (sensitive actions only).  
- Vote controls (approve / reject / abstain).  
- Resolution history (read-only audit).

### 8.3 Sovereign room — Members tab

- **Active members** list (projection); search.  
- Invite connections (uses **active** roster for “already in community”).  
- Leave community (self).  
- **Propose expel** (not instant button unless solo).

### 8.4 Managed workspace — Stewards tab

- Add/remove steward pubkeys (stewards-only).  
- Toggle: “Require member vote for descriptor changes” (hybrid, P4).  
- Invite policy: stewards-only vs all members.

### 8.5 Managed workspace — Relay & storage tab

- Relay host (migration = governance or steward per policy).  
- Guarantees checklist (what this deployment claims).  
- Export community package (existing export flow).

### 8.6 Shared — Privacy & access tab

- Access mode, notification prefs, block community.  
- Copy: local mute vs global expel (local does not change membership truth).

---

## 9. Community home UI (evolution, not greenfield)

Keep the current **community home** bento layout; align copy and actions with the new model:

| Card | Update |
|------|--------|
| Header | Name from projection; **Manage** opens management hub |
| Community access | “Active members” + link to Participants; **Invite** |
| Registry & privacy | Access mode + mode badge (Sovereign / Managed) |
| Infrastructure | Relay + sync; link to Relay tab in manage |

Remove misleading “projection-backed discovery roster” as the **membership** label; use **active membership** (implemented in read path).

---

## 10. Migration from current UI

| Current | Target |
|---------|--------|
| `CreateGroupDialog` two-column | Creation wizard with mode tabs (§7.2) |
| `GroupManagementDialog` tabs (general/members/…) | Management hub §7.3; add Governance + mode-specific tabs |
| `InviteConnectionsDialog` | Keep; fed by `activeMembers` |
| `group-home-page-client` inline edit | Defer to manage → General |
| `updateMetadata` noop | P0 implementation |
| Encyclopedia “adminless” copy | Amend in 10 when P2 ships: “sovereign = member-governed; managed = stewards” |

---

## 11. Module layout (target)

```text
apps/pwa/app/features/groups/
  components/
    create-community/          # new: wizard shell + mode tabs
    manage-community/          # new: tabbed management shell
    community-home/            # optional split from group-home-page-client
  services/
    community-display-name.ts  # exists
    community-policy.ts        # new: policy types + defaults
    community-governance.ts    # new: propose/vote/resolve helpers
    community-mode-contract.ts # exists — extend with policy defaults
  hooks/
    use-community-projection.ts  # new: read descriptor + governance + active roster
```

**Gateway:** Extend `@dweb/client-gateway` community roster port only for shared read helpers; do not fork governance in desktop-only code.

---

## 12. Testing and verification

| Phase | Automated | Manual |
|-------|-----------|--------|
| P0 | `community-display-name.test.ts`; descriptor reducer tests | Rename solo room; refresh; Network list |
| P1 | Governance reducer replay tests | A+B rename vote; B leave → A roster |
| P2 | Relay tier + mode gate tests | Managed on private relay; stewards rename |
| P3 | Component tests for tab visibility per mode | Create each mode; tab switch |

Manual matrix extension: `docs/assets/demo/v1.5.6/README.md` → add “Community governance” section when P1 lands.

---

## 13. Documentation maintenance

When P0 lands:

1. Update [10 Community operating model](../encyclopedia/10-community-and-groups-overhaul.md) governance bullet (member-governed vs stewards).  
2. Add CHANGELOG entry under unreleased.  
3. Point `docs/handoffs/current-session.md` Next Atomic Step to P0 or P1.

When UI overhaul lands:

1. Add screenshots to `docs/assets/demo/` per version.  
2. Update [04 Messaging and groups](../encyclopedia/04-messaging-and-groups.md) navigation paths.

---

## 14. Open decisions (track in PRs)

1. **Full page vs modal** for manage on desktop — recommend route `/groups/[id]/manage` with modal fallback.  
2. **Mode switch after create** — disallow in P0–P1; explicit migration flow later.  
3. **NIP-29 vs sealed-only** descriptor publish — prefer sealed control events as canonical; NIP-29 as adapter where required.  
4. **Encrypted descriptor on public relays** — P4; default public metadata on private relay only.

---

## 15. Summary

- **One control plane**, **two product modes**, **three authority behaviors** (solo, vote, stewards).  
- **Fix writes first** (P0), then **governance** (P1), then **managed stewards** (P2), then **tabbed UI** (P3).  
- Creation and management become **mode-aware tabbed** experiences; community home stays the daily entry point.

This plan is the implementation source of truth for community work until superseded by a tagged release scope doc (e.g. v1.6.0).
