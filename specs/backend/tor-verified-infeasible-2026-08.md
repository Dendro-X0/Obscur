# Feasibility — Tor Verified soak (option C)

**Date (UTC):** 2026-08-09  
**Status:** **INFEASIBLE (current constraints)** · band **CANCELLED as active queue** · code remains landed  
**Parents:** [tor-verified-soak-charter-2026-08.md](./tor-verified-soak-charter-2026-08.md) · [tor-warming-stuck-network-vs-logic-investigation-2026-08.md](./tor-warming-stuck-network-vs-logic-investigation-2026-08.md) · [rules/11](../../rules/11-feasibility-and-modular-safety.md)

```text
DECISION:  Tor-only Verified cannot be stamped under solo + blocked-network constraints
KEEP:      Tor TI-1…4 Implemented (L1) landed — preference OFF restores clearnet
STOP:      Tor Verified as Next Atomic Step · patch loops · fake Ready · invent testers
RESUME IF: Tor-capable network and/or external tester can run A+B+C
```

## Evidence

| Constraint | Evidence |
|------------|----------|
| Maintainer network | Tor bootstrap stalls ~10–14% · mass TLS_ERROR (env/DPI class) |
| No external testers | Maintainer: solo · no team · no one available to run A+B+C elsewhere |
| Product honesty | Local state ≠ network truth · Verified requires Ready + sticky open on capable path |

This is **not** an app-logic “failure” of TI land. It is a **proof-surface** failure: the required L3/L4 environment does not exist for this maintainer.

## Outcomes (rules/11)

| Outcome | Choice |
|---------|--------|
| New approach | **Not now** — bridges/Arti/T5-3 do not remove the need for *some* capable path or tester |
| Infeasible decision | **Selected** — cancel Tor Verified as active queue goal |

## What stays shipped / honest

| May say | Must not say |
|---------|----------------|
| Tor lifecycle **Implemented (L1)** · gateway co-start landed | Tor **Verified** · production Tor-ready |
| Tor OFF → clearnet works (proven) | Users on blocked nets will get Tor Ready |
| Tor ON may Warming forever on censored nets | Fake Connected / Ready |

## Agent rules

| Allowed | Forbidden |
|---------|-----------|
| Docs / handoff silo · known-limitations copy | Further Tor Verified soak as atomic step |
| Resume only when prerequisite met + handoff flip | Patch-debug Tor bootstrap on this LAN |
| | Invent onions · UI SOCKS · claim Verified |

## Prerequisite to reopen

1. Access to a network (or bridges) where Tor reaches bootstrap **100%**, **or**  
2. An external tester who can run [tor-t5-l3-soak-checklist-2026-08.md](./tor-t5-l3-soak-checklist-2026-08.md) A+B+C and paste evidence.  

Then flip handoff Next Atomic back to Tor Verified soak — do not reopen from chat alone.
