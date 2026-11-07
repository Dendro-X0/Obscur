# Verify — Reconnect Requests pending card (2026-11-07)

```text
PROOF PLAN: L1 unit Pass · L2 optional re-soak · do NOT claim Soft L3
```

## L1 (executed 2026-11-07)

```bash
pnpm -C apps/pwa exec vitest run \
  app/features/messaging/state-machines/connection-handshake-machine.test.ts \
  app/features/messaging/hooks/use-requests-inbox.test.ts \
  app/features/messaging/services/contact-request-incoming-lifecycle.test.ts
```

Result: **20 passed** (3 files).

Covers: accepted→CANCEL · projection pending beats legacy accepted/canceled · cancel lifecycle prefers `remove`.

## L2 (executed 2026-11-07)

Shell `shell-2026-11-07T11:29:25Z` · Tester1→Tester2 fresh invite after prior remove residue.

Evidence: `docs/handoffs/contact-reconnect-requests-tab-l2-soak-2026-11-07.{md,json}`

- Invitation delivered (`cap-eb3e48fb9cd6` / assert Pass)
- Tester2 **Requests (1)** pending card (`cap-ffa9a0d34cb3` / assert Pass)
- Accept/Decline chrome + Hello Just now

## Claim language

- May say: L1+L2 Pass — reconnect invitation surfaces Requests pending card on rebuilt static-dev
- Must not say: Soft L3 / Tor Verified / packaged NSIS L2
