# Design — CU-UX-5 Relay freedom

**Date (UTC):** 2026-10-21  
**Status:** Implemented (L1) — 2026-10-21  
**Charter:** [community-dual-tier-ux-charter-2026-08.md](../../docs/program/community-dual-tier-ux-charter-2026-08.md) (already intended to revise public Managed block)

---

## 1. Goals

1. Interest (T0) **or** team (T1) may use **trusted public** or **private** relays.
2. Public Team create is **honesty-gated**, not hard-blocked.
3. Coordination remains required for T1.
4. Persist `hostingTier: "public_quiet"` whenever the create host is Quiet/public.

## 2. Locked policy

| Mode | Public Quiet | Private / intranet / operator |
|------|--------------|-------------------------------|
| T0 Quick | Allowed + ack (existing) | Allowed (existing) |
| T1 Team | Allowed + **mandatory honesty ack** | Allowed (existing) |
| T1 coordination | Required | Required |
| Public T1 claims | No delete-for-all / no enterprise directory | Full team path when private + coordination |

## 3. Code changes

| Area | Change |
|------|--------|
| `resolveManagedWorkspaceRelayGate` | `public_default` → `allowed: true`, reason `public_default_honest`, `requiresHonestyAck: true` |
| `isManagedWorkspaceRelayGateBlocking` | Do **not** block honesty-required public |
| `assessWorkspaceCommunityTrust` | Replace `public_relay_blocked` hard fail with allowed + `public_relay_honest` |
| `resolveCommunityCreateRelayOptions` | Public hosts selectable for managed (honesty detail, not disabled) |
| `create-group-dialog.tsx` | Team+public honesty panel + ack; no rose wall for public managed |
| i18n | `groups.create.tier.team.public.*` honesty keys |
| Charter / SF-A status | Mark hard-block superseded by CU-UX-5 |

## 4. Proof (L1)

- Managed Quiet create: selectable → ack → submit enabled
- Managed private: unchanged
- Trust: public + healthy coordination → allowed / `public_relay_honest`
- Gate unit: public managed not blocking
- Update `path-b-b0-*` / create-dialog tests that expected hard block

## 5. Out of scope

- Team room / Spaces switching (SF-B)
- Softening T1 coordination requirement
- Claiming delete-for-all on public Team
- Steward dual-profile L3

## 6. Flow

```text
Pick T0 or T1 → choose host
  public Quiet → honesty panel + ack → Create
  private → existing writable (+ T1 coordination) → Create
→ metadata: communityMode + hostingTier
```
