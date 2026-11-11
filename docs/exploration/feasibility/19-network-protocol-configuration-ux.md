# Feasibility — Relays · networking · protocols configuration (better design)

**ID:** F-netconfig  
**Status:** draft  
**Date (UTC):** 2026-11-09  
**Charter:** `specs/backend/platform-feasibility-exploration-charter-2026-11-08.md`  
**Parents:** F-hub · F-alt · F-groups · F-PSE · F-stack · transport preset catalog (as-built)  
**As-built:** `transport-preset-catalog.ts` · `relay-transport-scope` (DM vs community) · basic/redundancy mode · Protocols settings stub · relay runtime supervisor  
**Claim language:** **designed on paper** ≠ settings rewrite shipped · ≠ Tor Verified · ≠ multi-protocol Pass

## 1. Scope

- **In:** A better **Settings → Network / Protocols** information architecture for UX, functionality, performance, and scalability — aligned with hub, group pins, and staged private-trust.
- **Out:** Implementing the settings UI this phase; Soft L3 contact Pass.

## 2. Basics — what is wrong with a flat “relay list”

Today’s power is real (presets, DM/community partition, redundancy, Tor/SSH templates) but the **mental model** is still “a bag of URLs + modes,” which:

| Pain | Effect |
|------|--------|
| Mixes **protocol apps**, **underlays**, and **endpoint lists** | Users cannot tell Nostr relay from Matrix HS from Tor path |
| Global pool fights **group pins** (F-groups) | One toggle breaks family DC and public discovery together |
| Hybrid defaults dial everything | Performance tax; Soft L3 / lab URLs leak into product mental model |
| Advanced controls surface too early | Casual users bounce; operators still lack a clear “game server” story |

### Target vocabulary (three layers)

```text
1. Protocol apps     — which carriers are enabled on this workspace (Nostr, Matrix, Private mesh, …)
2. Underlays         — how bytes leave the device (Clearnet, Tor, SSH bastion, LAN)
3. Homes / endpoints — concrete servers: relays, homeservers, VPS DCs, mesh gateways
```

Settings must show these as **separate cards**, not one undifferentiated URL table.

## 3. Capabilities map

| Need | Better config answer |
|------|----------------------|
| UX simplicity | **Profiles of connectivity**: Private-trust · Public social · Custom — not raw wss lists first |
| Functionality | Enable/disable **protocol apps**; per-app endpoint lists; group pin override (F-groups) |
| Performance | Lazy dial; pool caps; health-based ranking; no always-on hybrid of all presets |
| Scalability | Named **homes** (reusable DC/relay sets) referenced by many groups; not N copies of URL strings |
| Honesty | Status = connected / degraded / offline per home — never “Tor Verified” from a green badge |

## 4. Fit to planes / IA

### Recommended Settings IA

| Screen | Audience | Contents |
|--------|----------|----------|
| **Network (Simple)** | Everyone | Connectivity profile picker · one-line health · “Manage homes…” deep link |
| **Protocol apps** | Everyone | Toggle Nostr / Matrix / Private mesh / … · each opens its own endpoint page |
| **Homes** | Power + operators | Named packs: `Family VPS`, `Public Nostr pool`, `Org Matrix` — URLs, auth, retention hints |
| **Underlay** | Advanced | Tor on/off · SSH bastion · force clearnet — applies across homes that opt in |
| **Diagnostics** | Advanced | RTT, fail reasons, last publish — as-built metrics, gated behind Advanced |

**Simple connectivity profiles (examples):**

| Profile | Meaning | Default dial set |
|---------|---------|------------------|
| **Private-trust** | Own/community DC first | Private mesh + optional user VPS; public Nostr **off** or discover-only |
| **Balanced** | Private primary + limited public | 1 private home + ≤N public relays (redundancy cap) |
| **Public social** | Nostr/Matrix-forward | Public pools / HS; private optional |
| **Custom** | Full Advanced | Current power-user surface |

Changing profile **does not** rewrite every group pin; it sets **workspace defaults** for new chats/groups and for 1:1 carriers without an override.

### Scope model (fix as-built partition)

| Scope | Configures | Must not |
|-------|------------|----------|
| **Workspace default DM/transport** | 1:1 + profile publish pool | Silently become every community’s home |
| **Community / group pin** | Per-group home (F-groups) | Inherit broken public-only pool for private family |
| **Discovery-only relays** | Search/index (F17) | Join the send pool automatically |

As-built `dm` vs `community_candidate` classification is the right *seed*; the better UX **names** these scopes in the UI.

## 5. Libraries / stacks (runtime constraints)

| Concern | Design rule |
|---------|-------------|
| Pool size | Keep redundancy max (as-built ~3) as **default cap**; raise only in Custom |
| Presets | Keep catalog; map each preset into a **Home** or **Underlay** template, not a flat replace-all footgun without confirm |
| Dial scheduling | Kernel owns connect/backoff (F-stack); UI only edits desired state |
| Matrix / private DC | Appear as protocol-app pages with HS/DC fields — not fake `wss://` rows |
| Tor | Underlay flag + onion homes; never equate with content E2EE (F-PSE) |

## 6. Feasibility verdict

`fit-with-adapter` — A layered **Network / Protocol apps / Homes / Underlay** settings design is the better version: it preserves as-built power (presets, scope split, redundancy) while fixing UX and performance for the hub + game-server group model.

### Target UX flow

```text
Settings → Network
  [ Private-trust | Balanced | Public social | Custom ]
  Status: Private home ●  Public pool ○  Tor ○
  → Protocol apps
       Nostr     [On]  → Homes: Public pool, …
       Matrix    [Off]
       Private   [On]  → Homes: Family VPS (game server)
  → Underlay (Advanced): Tor / SSH
  → Diagnostics
```

### Performance & scalability rules

1. **Lazy apps** — disabled protocol apps hold zero sockets (F-PSE).  
2. **Home reuse** — groups reference `homeId`, not pasted URL lists.  
3. **Health-ranked dial** — prefer as-built probe/rank; shed dead endpoints from the active pool.  
4. **Budgeted fan-out** — publish quorum ≠ “dial every URL in Custom forever.”  
5. **Profile switch** — tear down foreign homes with the workspace (hard profiles).  
6. **No lab bleed** — localhost:7000 / 8788 only in Dev/Custom with explicit badge (Soft L3 honesty).

### Functionality checklist (better than today)

| Feature | Simple | Advanced |
|---------|--------|----------|
| Pick connectivity profile | ✓ | ✓ |
| Enable protocol app | ✓ | ✓ |
| Add trusted VPS / DC as named home | Guided | Full URL/SSH/Tor |
| Per-group override home | From group settings | Same |
| Redundancy / basic mode | Hidden under profile | Explicit |
| Import/export homes pack | — | ✓ |
| Live RTT / error panel | Summary | Full diagnostics |

## 7. Risks / traps

- One “Apply preset” that wipes group pins.  
- Showing Matrix as another Nostr relay row.  
- Green “connected” implying secure or Tor Verified.  
- Hybrid public+loopback as silent product default without labeling lab assist.  
- Settings pages that re-implement pool logic in React (bridge tax).

## 8. Open questions

1. Should **Private-trust** be the shipped default (align F-alt) vs current hybrid boot preset?  
2. Are discovery relays a separate Home type or a flag on public homes?  
3. Multi-window desktop: one network config per profile (yes) — share read-only status to title bar how?  
4. Operator “game server” wizard: generate home pack + group pin in one flow?  
5. How much of Protocols tab stays empty until Matrix/private apps are Cut-enabled?

## 9. References

- `apps/pwa/app/features/transport-kernel/transport-preset-catalog.ts`  
- `apps/pwa/app/features/relays/services/relay-transport-scope.ts`  
- `apps/pwa/app/features/relays/services/relay-transport-mode.ts`  
- `docs/exploration/feasibility/18-community-group-systems.md`  
- `docs/exploration/feasibility/13-architecture-alternatives-hub-critique.md`  
- `docs/exploration/feasibility/11-performance-security-encryption-standards.md`  
- Prior relay UX specs under `specs/backend/relay-*-2026-*.md`  
