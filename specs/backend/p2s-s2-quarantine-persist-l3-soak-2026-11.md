# Soak — P2-S S2 quarantine persist L3 (2026-11)

**Status:** **L3 Pass** — `docs/handoffs/p2s-s2-quarantine-persist-l3-soak-latest.{json,md}`  
**Parent:** [sandboxed-storage-security-design-2026-11.md](./sandboxed-storage-security-design-2026-11.md)

```text
HANDOFF ATOMIC STEP: P2-S S2 quarantine persist L3 soak — closed (Pass)
PAUSED / CANCELLED: Soft L3 · Tor Verified · Matrix promote · Continuity promote
CANONICAL OWNER:     Storage · inbound-media-quarantine-persist
PROOF:               Desktop CDP plan+persist+read · allowSystemOpen false · no shell open
```

## 1. Goal

Prove live desktop that inbound bytes land only under `profiles/{id}/quarantine/{sha256}` via product persist, with `allowSystemOpen: false`, and no OS shell open in the persist module.

## 2. Matrix

| Check | Pass when |
|-------|-----------|
| `planNeverSystemOpen` | `plan.allowSystemOpen === false` |
| `planPathBelongs` | planned path belongs to profile quarantine |
| `persistWritten` | `persistInboundMediaQuarantineBytes` → `written` |
| `productReadOk` | same-profile read returns bytes |
| `persistModuleNoShellOpen` | persist `.ts` has no `openPath` / `shell.open` |

## 3. Non-claims

- Soft L3 / Tor Verified / OS ACL isolation (see S5 for cross-profile)
