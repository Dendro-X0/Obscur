# Design — Nostr-first lab silo (localhost demotion)

**Date (UTC):** 2026-08-04  
**Status:** Pass (L1) · Nostr-first always-demote · 2026-08-04  
**Evidence:** Maintainer Relays — localhost QUIET/ACTIVE ~596ms while publics STANDBY “Not in the active transport pool”; Open sockets 1 of 4. Latency demote (≥1500ms) failed product goal.

---

```text
NEXT ATOMIC STEP:     Nostr-first: always exclude localhost from active pool when remotes enabled
PAUSED / CANCELLED:   COM-RUN-* · O-2/O-4 · RIW-8 · Dev Lab · AUTH-SESSION · groups/**
CANONICAL OWNER:      resolveActivePoolRelayUrls · reconcilePrimarySelection · relay-local-lab-adapt
PROOF BEFORE DONE:    L1 adapt + selector tests · desktop Relays: publics ACTIVE when remotes enabled
OUT OF SCOPE:         Soft L3 Docker ship · public Nostr SLA · AUTH-SESSION
```

---

## Product rule

`ws://localhost:7000` is Soft L3 / harness only. Users do not run Docker for DMs or communities.

**When any public/VPS (non-local) relay is enabled, always demote localhost from the active dial pool and from primary reconcile candidates** — regardless of open socket, RTT, or cold-start hints.

| Situation | Active pool |
|-----------|-------------|
| Public remotes enabled (+ optional localhost listed) | Remotes only |
| Only Local Dev Mesh enabled (Soft L3) | Localhost allowed |
| Soft L3 Docker running *with* remotes | Lab stays **out** of ACTIVE; remotes own transport |

Latency heuristics cannot distinguish useful Soft L3 from a useless listener on `:7000`.

---

## Contract

`shouldDemoteLocalLabFromActivePool({ localUrl, remotesEnabled })`:

| Condition | Demote |
|-----------|--------|
| `remotesEnabled === false` | No |
| URL is not local lab | No |
| Local lab + remotes enabled | **Yes** (always) |

`hint` is unused for the product gate (kept on the type for call-site stability).

When demoted: active pool = **remote URLs only**; primary reconcile never re-promotes local over remotes.

---

## Files

- `relay-local-lab-adapt.ts` — pure policy  
- `relay-primary-selector.ts` — wire into pool + reconcile  
- `workspace-dev-relay-bootstrap` — must not re-enable local when remotes already present (mixed trap)  
- tests + operator notes
