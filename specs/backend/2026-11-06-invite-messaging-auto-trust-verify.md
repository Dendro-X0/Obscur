# Verify — Invite messaging auto-trust (2026-11-06)

```text
L1: pnpm exec vitest run app/features/network/hooks/use-peer-trust.test.ts
L2: DemoUser send invite only → Tester1 must NOT appear TRUSTED in All People until Accept
L3: After Tester1 Accept → both sides TRUSTED + Message (existing handshake)
```

## Claim language

- **Implemented** — residue hydrate no longer mints trust from invite DMs.
- **Verified on desktop** — claim only after L2 cold-run on installed beta.
