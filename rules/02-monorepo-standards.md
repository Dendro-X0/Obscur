# 02 — Monorepo Standards

1. **Keep boundaries clear.**
   - `apps/*` should compose behavior.
   - `packages/*` should hold reusable contracts, primitives, and runtime-independent logic.
   - Rust/Tauri code should expose typed native boundaries, not product logic leaks.

2. **Shared logic belongs in typed modules.**
   - Prefer moving repeat logic into focused services/contracts instead of duplicating controller logic across app surfaces.

3. **Avoid cross-feature reach-through.**
   - A feature should not import deep internals from another feature when a contract/service boundary can be introduced.

4. **Keep files single-purpose.**
   - If a file owns more than one lifecycle or more than one domain concern, split it.

**Layout reference:** `docs/encyclopedia/02-repository-map.md`
