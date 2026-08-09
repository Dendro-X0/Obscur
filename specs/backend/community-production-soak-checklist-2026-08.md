# Checklist — Community production soak CU-P1 (2026-08)

**Date (UTC):** 2026-08-09  
**Status:** **Pass / Verified** (maintainer packaged L3 · production relays · Tor OFF)  
**Charter:** [community-production-unpause-charter-2026-08.md](../../docs/program/community-production-unpause-charter-2026-08.md)

```text
BAND:     Community CHARTERED / SOAK-ACTIVE
SURFACE:  Packaged desktop preferred (Tor OFF)
RELAYS:   Production path only — public Nostr / user-configured relays
OUT:      Docker local relay as Pass · COM-RUN-01 parity · COM-RUN-02 · Dev Lab · Tor
```

## Preconditions

| Item | Expected |
|------|----------|
| Tor | **OFF** on this host |
| Desktop | Packaged `Obscur_*_x64-setup.exe` (preferred) |
| Profiles | Two distinct profiles (e.g. A + B) |
| Relays | **Production transport** — public Nostr (e.g. nos.lol / damus / primal) and/or relays the user added in Settings. Same class of path as DM L3 Pass |
| Coordination | Whatever the **packaged app** uses by default — not a maintainer-only Docker stack |
| Must **not** | `pnpm dev:relay:docker` · `localhost:7000` as the community/DM bus · `dev:desktop:online` Docker lab as sole proof |

**Why:** Dev soaks often used Docker as a local relay. Normal users never run that container. CU-P1 Pass only counts if community works on the same production relay path end users get.

## Matrix (maintainer)

| # | Action | Pass |
|---|--------|------|
| C1 | Unlock two profiles | Both shells usable |
| C2 | Create or open shared community | Both see stable community |
| C3 | Fresh invite → Accept | Invitee joins; inviter sees Cancel (not dual Cancel) |
| C4 | Group text A→B and B→A | Delivered with evidence |
| C5 | Soft refresh + lock/unlock | Thread still readable |
| C6 | One profile Leave | Honest leave on both sides |
| C7 | Profile isolation | No cross-profile community bleed |

## Claim language

| May say | When |
|---------|------|
| CU-P1 **Pass** | C1–C5 + C7 Pass (C6 if leave exercised) |
| Community **Verified** | CU-P1 Pass + handoff stamp + no open P0 from Fail notes |
| Not required | Tor ON · roster live parity · room-key restore |

## Evidence paste

```text
Community CU-P1 soak:
  C1–C7: Pass (maintainer summary 2026-08-09)
  Notes: Community functions normal when relay signal/connection present; production relays (not Docker)
  Surface: packaged
  Relays: production path (public / Settings) — requires live relay connection
  Stamp: Obscur 1.9.15 packaged band
  Honest limit: no relay connection ⇒ community cannot deliver (expected; local ≠ network)
```

## Optional (not Pass)

| Item | Role |
|------|------|
| `pnpm verify:com-mem-2:contracts` | L1 contracts only |
| Docker / `localhost:7000` | Lab debug only — **never** CU-P1 Pass evidence |
