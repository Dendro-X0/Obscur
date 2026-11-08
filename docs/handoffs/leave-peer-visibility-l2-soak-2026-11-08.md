# L2 soak — Leave peer visibility Slice 2 (2026-11-08)

- **Verdict:** **Blocked** (cannot drive A leave → B roster exclude)
- **Shell:** `pnpm dev:desktop:online -- --rebuild` · stamp `shell-2026-11-07T16:07:24Z` (post-`bea87116`)
- **CDP:** `:9230` Tester1 unlocked · `:9231` not opened (no shared live group to prove against)
- **JSON:** [`leave-peer-visibility-l2-soak-2026-11-08.json`](./leave-peer-visibility-l2-soak-2026-11-08.json)

## Blockers

| Check | Result |
|-------|--------|
| Fresh shell with leave sticky | Pass — rebuild landed stamp `shell-2026-11-07T16:07:24Z` |
| Tester1 unlock | Pass — Import Key path |
| Joined shared community | **Fail** — ledger only `left` residue (`df737fb3…` @ `wss://nos.lol`); no `joined` rows |
| App relay pool active | **Fail** — UI `0/3 active relays` despite Settings Default Stable (3 public enabled) |
| Browser `WebSocket` to nos.lol / damus / primal | Pass — page-level probe opened all three |
| Docker local relay `:7000` | Unavailable — Docker Desktop not running |
| Dual CDP A leave → B excludes A | **Not run** — blocked on pool + missing joined group |

## Claim language

- May say: leave Slice 2 L1 still Pass; L2 dual CDP **Blocked** this session (relay pool 0/3 + no joined fixture)
- Must not say: leave Fixed · Soft L3 · packaged NSIS leave sticky verified

## Resume

1. Restore app relay pool to ≥1 active (or start Docker `pnpm dev:relay:docker`).
2. Create/join shared community Tester1↔Tester2.
3. A leave → assert B terminal/`leftMemberPubkeys` + roster exclude A.
