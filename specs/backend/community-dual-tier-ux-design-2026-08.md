# Design — Dual-tier community create & simplified Relays

**Date (UTC):** 2026-08-21  
**Charter:** [community-dual-tier-ux-charter-2026-08.md](../../docs/program/community-dual-tier-ux-charter-2026-08.md)  
**Investigation:** [community-dual-tier-ux-investigation-2026-08.md](./community-dual-tier-ux-investigation-2026-08.md)

---

## 1. Goals

1. **Quick start** — create a group in &lt;1 minute on relays the user already has (Quiet public).  
2. **Honest limits** — T0 never claims full delete, enterprise directory, or operator control.  
3. **Long-term / business** — T1 one clear path: save team relay (+ coordination) → create → invite → chat with stronger controls.  
4. **Simpler Relays** — two jobs visible; lab flags Advanced-only.  
5. **v2.0.0 beta bar** — T0 reliable enough for demo + casual use; T1 reliable enough for small business teams (not full Slack).

## 2. Information architecture

### Relays settings (CU-UX-1)

```text
┌ Relays ─────────────────────────────────────────┐
│ DM & Quick groups (pool)                         │
│   [nodes…]  Add wss://   Health: plain language  │
│                                                   │
│ Team workspace (optional)                        │
│   Coordination URL  [              ]               │
│   Workspace relay   [              ]               │
│   [ Save & use for new teams ]                     │
│                                                   │
│ ▸ Advanced (developer)                           │
│   trust-local · coordination-only · clear overrides│
└───────────────────────────────────────────────────┘
```

**Save & use for new teams** must:

- Persist operator bundle  
- Ensure workspace relay URL is **enabled** in the relay list (or marked as create-only host)  
- Set create default mode = T1 and prefill host  
- Surface success: “New teams will use &lt;host&gt;”

### Create Group (CU-UX-2)

```text
Name: [____________]

Where should this group run?
  ( ) Public relays — fastest setup
        ⚠ Less control: no guaranteed delete-for-all;
          limited admin/directory vs a team-hosted relay.
        [Learn what you give up]
  ( ) My team relay — recommended for business
        Uses your saved workspace relay / operator setup.

[ Cancel ]  [ Create ]
```

Privacy (Open/Public/Secret) stays secondary; default Secret OK.

## 3. Policy changes (gates)

| Gate today | After CU-UX-2 |
|------------|----------------|
| Managed create blocked on `isPublicDefaultRelayHost` | **T0** allowed on public defaults with honesty ack stored on community descriptor (`hostingTier: "public_quiet"`) |
| Empty host → create invalid | T0: host = primary Quiet writable URL or explicit multi-publish policy from design note below |
| Operator bundle ignored if catalog empty | T1: prefer bundle host; if missing → deep-link Relays Team card |

**T0 publish policy (v1):** publish sealed community events to the user’s **enabled Quiet writable set** (same pool as DM), scoped tags as today; do **not** require a private host. Document ACC-02 + no delete-for-all in descriptor + UI badge “Public relays”.

**T1 publish policy:** unchanged scoped workspace relay (+ coordination membership when configured).

## 4. Descriptor / mode mapping

| UI choice | Stored `communityMode` / hosting | Membership authority |
|-----------|----------------------------------|----------------------|
| T0 Public | `hostingTier: public_quiet` · mode label “Quick group” | Best-effort local + invite graph; coordination **optional** |
| T1 Team | `managed_workspace` · `hostingTier: operator` | Coordination when URL set; else honest degraded |

Do **not** store T0 as `managed_workspace` without `hostingTier` — that caused false guarantees.

## 5. Copy keys (en)

| Key | Intent |
|-----|--------|
| `groups.create.tier.public.title` | Start on public relays |
| `groups.create.tier.public.warning` | Less control; no full delete; limited enterprise admin |
| `groups.create.tier.team.title` | My team relay |
| `groups.create.tier.team.hint` | Best for business teams; deletion & directory when you host |
| `relays.teamWorkspace.saveCta` | Save & use for new teams |

## 6. Enterprise feature matrix (beta)

| Feature | T0 | T1 |
|---------|----|----|
| Create + invite + E2EE chat | ✓ | ✓ |
| Participants list (honest) | ✓ | ✓ |
| Steward roles / expel | Limited | ✓ |
| Delete-for-all / operator hide | ✗ (explained) | ✓ when relay supports |
| Coordination directory | ✗ / optional later | ✓ when configured |
| Custom emoji / threads / huddles | Out | Out (post-beta) |

## 7. Subtraction

- Remove default-path dependence on “Test without local Nostr relay” for create.  
- Do not add a second create engine.  
- Do not reopen COM-RUN-02.

## 8. Proof

| Slice | L1 | L3 |
|-------|----|----|
| CU-UX-1 | Relays model / operator prefill unit tests | Packaged: Save team card → Create opens with host |
| CU-UX-2 | Gate allows public T0 with ack; i18n keys | Two profiles: T0 create → invite → send on Quiet |
| Regression | Managed T1 still blocked on mis-set public-as-T1 without notice | T1 Docker/VPS path still works |

## 9. Demo

Segment I: prefer T0 live after CU-UX-2; until then GIF stitch + dual-tier honesty VO.
