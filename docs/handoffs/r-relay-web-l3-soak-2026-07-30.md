# Optional web L3 soak — TS conduit mesh

- **When:** 2026-07-31T05:13:46.064Z
- **Outcome:** **Pass**
- **Mode:** `docker_7000` · Docker `:7000` up
- **Recipe:** `node scripts/l3-mesh-web-soak.mjs`

## Checks

- [x] **product_relay_7000** — listening (Docker parity)
- [x] **mesh_active_escape_unit** — 2 Pass
- [x] **vitest_web_mesh_pool** — mode=docker_7000 · configure→publish EVENT/OK · damus escape rejected

## Claim

| May say | When |
|---------|------|
| Web/TS local mesh path fixed (L3 lab · Docker `:7000`) | This soak Pass · mode=`docker_7000` |
| Public Nostr / transport “fixed” | **No** |
| Docker parity | **Yes** — this run |

JSON: [`r-relay-web-l3-soak-2026-07-30.json`](./r-relay-web-l3-soak-2026-07-30.json)
