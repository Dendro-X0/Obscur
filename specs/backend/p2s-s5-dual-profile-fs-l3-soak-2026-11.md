# Soak — P2-S S5 dual-profile quarantine FS L3 (2026-11)

**Parent:** [sandboxed-storage-security-design-2026-11.md](./sandboxed-storage-security-design-2026-11.md)  
**Prior:** S5 L1/L2 — `readInboundMediaQuarantineBytes` fail-closed · CAS store isolation (vitest)

```text
HANDOFF ATOMIC STEP: S5 dual-profile FS L3
PAUSED / CANCELLED: Soft L3 · Tor Verified · Matrix promote
CANONICAL OWNER:     Storage (inbound quarantine)
PROOF:               scripts/p2s-s5-dual-profile-fs-l3-soak-cdp.mjs → docs/handoffs/p2s-s5-l3-soak-latest.*
SURFACE:             Tauri desktop CDP :9230
```

## Goal

On **real AppData** (not mocked adapter): profile Alice’s quarantine object is readable when requested as Alice and **null** when requested as Bob — same gate as `readInboundMediaQuarantineBytes`.

## Matrix

| Check | Pass means |
|-------|------------|
| `aliceWrite` | Bytes written under `profiles/profile-alice/quarantine/{sha}` |
| `aliceRead` | Gate + FS read returns same bytes for Alice |
| `bobCrossRead` | Gate returns null for Bob (no product cross-read) |
| `bobRawFsStillPresent` | Optional honesty: raw FS read of Alice path still finds bytes (isolation is **API gate**, not OS ACL) |

## Non-claims

- Soft L3 Fixed · Tor Verified · Matrix promote · antivirus · OS-enforced multi-user ACLs

## How to run

```bash
# Desktop with CDP already up (rebuild if shell stale)
OBSCUR_ALLOW_STALE_SHELL=1 pnpm dev:desktop -- --skip-build
node scripts/p2s-s5-dual-profile-fs-l3-soak-cdp.mjs
```

## Status

- Procedure: **written**
- Soak: **Pass** 2026-11-02 — `docs/handoffs/p2s-s5-l3-soak-latest.{md,json}`
