# v1.8.9 — Demo / manual verification matrix

**Release:** [v1.8.9-release.md](../../../releases/v1.8.9-release.md)  
**Gate:** [v1.8.9-gate.md](../../../releases/v1.8.9-gate.md)  
**Scope:** [v1.8.9-scope.md](../../../program/v1.8.9-scope.md)

---

## Verification record (2026-05-28)

Maintainer manual pass on `main` @ `016971e3` — **no errors observed**.

| Test | run_id | outcome |
|------|--------|---------|
| M9-1 Test 8 | `test8-v1.8.9-2026-05-28` | **pass** — Test 8 sealed group (create → invite → accept → chat) |
| M9-2 Test D1 | `test-d1-v1.8.9-2026-05-28` | **pass** — `suppress_ok` (remove from workspace; peer does not receive hidden message live) |
| M9-3 Test D3 | `test-d3-v1.8.9-2026-05-28` | **pass** — “Remove from this workspace” copy; no false global delete |
| M9-4 hydration / roster | (included in Test 8) | **pass** |

---

## Policy

- **Test 8** must be **re-run** on current `main` before tag (void v1.8.8 evidence is historical only).
- **Test D1** and **Test D3** are **required** for v1.8.9 — not optional post-release work.
- v1.8.8 `run_id=test8-2026-05-29` may be cited only if no relay/activation/D1 code changed since that run; otherwise re-run.

---

## Environment

| Service | URL / command |
|---------|----------------|
| Coordination | `http://127.0.0.1:8787` — `pnpm dev:coordination` |
| Operator relay | `ws://localhost:7000` — `pnpm dev:relay:docker` (nostr-rs-relay) |
| D1 gateway (optional) | `pnpm -C apps/relay-gateway dev` on port **7001** — filters hide suppress in front of upstream |
| PWA env | Copy `apps/pwa/.env.example` to local gitignored env file with relay + coordination URLs |

---

## Test 8 — Managed workspace A/B (M9-1)

| Step | Client A | Client B | Pass criteria |
|------|----------|----------|---------------|
| 1 | Create sealed community workspace | — | Genesis on relay |
| 2 | Invite B | — | Invite delivered |
| 3 | — | Accept + relay join | Sealed group chat active |
| 4 | Both | Exchange messages | Bidirectional |
| 5 | B | Close/reopen chat | Hydrated history |
| 6 | Either | Leave member | Header count updates |

**Record:** `run_id`, `outcome`, date, commit short SHA.

---

## Test D1 — Hide suppress on operator relay (M9-2) — **new for v1.8.9**

| Step | Actor | Pass criteria |
|------|-------|---------------|
| 1 | A | Send group message |
| 2 | A | Hide/delete for workspace (signed hide to relay scope) |
| 3 | B | REQ/subscribe — **must not** receive hidden event as live message |
| 4 | B | Local tombstone / UI still consistent if event was seen before hide |

**Record:** `run_id`, `outcome=suppress_ok|failed`, relay config note.

---

## Test D3 — Strict workspace UX (M9-3) — **new for v1.8.9**

| Step | Check |
|------|--------|
| 1 | Operator-trusted relay URL configured |
| 2 | After hide/remove, UI says removed from **workspace** / operator boundary |
| 3 | No “deleted everywhere” or open-Nostr parity claim |

---

## Blocker taxonomy

| Code | Meaning |
|------|---------|
| `relay-genesis` | Publish blocked at relay |
| `relay-suppress` | D1 — hide still served to peer |
| `coordination` | Worker / activation |
| `hydration` | History missing after reopen |
| `roster` | Stale member count |
| `ux-copy` | D3 — misleading delete messaging |
