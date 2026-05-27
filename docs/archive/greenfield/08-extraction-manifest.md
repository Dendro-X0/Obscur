# Extraction manifest — Obscur → greenfield repo

**Status:** Draft  
**Last updated:** 2026-05-19  
**Use with:** [07-repository-strategy.md](./07-repository-strategy.md), [09-phase0-bootstrap-checklist.md](./09-phase0-bootstrap-checklist.md)

Record at extraction time:

```text
SOURCE_REPO=https://github.com/.../newstart   # or local path
SOURCE_SHA=<git rev-parse HEAD>
EXTRACTED_UTC=<ISO date>
```

---

## Tier 1 — Copy early (low coupling)

### `packages/ui-kit/` → `packages/ui/`

| Path | Notes |
|------|--------|
| `packages/ui-kit/src/**` | Full tree |
| `packages/ui-kit/package.json` | Rename package `@scope/ui`; keep peer deps React 19 |
| `packages/ui-kit` exports | `.` and `./cn` |

**Post-copy:** `pnpm install`; render Button, Dialog, Toast in stub app.

**Do not copy:** `docs/archive/**/ui-kit` duplicates.

---

### `packages/dweb-crypto/` → `packages/crypto/`

| Path | Notes |
|------|--------|
| `src/private-key-hex.ts` | |
| `src/public-key-hex.ts` | |
| `src/generate-private-key-hex.ts` | |
| `src/derive-public-key-hex.ts` | |
| `src/derive-aes-gcm-key.ts` | |
| `src/encrypt-private-key-hex.ts` | |
| `src/decrypt-private-key-hex.ts` | |
| `src/encrypted-private-key.ts` | |
| `src/passphrase.ts` | |
| `src/base64.ts`, `from-base64.ts`, `to-base64.ts`, `to-array-buffer.ts` | |
| `package.json` | Audit deps; rename `@scope/crypto` |

**Defer / evaluate later:** `mine-pow.ts`, `pow.worker.ts` (Phase 3 anti-abuse).

**Do not copy:** archive copies under `docs/archive/`.

---

## Tier 2 — Copy selectively (UI only, strip hooks)

### Messaging presentation (from `apps/pwa`)

Copy **after** creating `apps/client` shell. For each file: remove imports from `@dweb/nostr`, `features/groups`, `use-sealed-community`, `ClientGateway`.

| Candidate | Source (inspect before copy) |
|-----------|------------------------------|
| Message list item / bubble styling | `app/features/messaging/components/` — pick presentational only |
| Empty states | `@dweb/ui-kit` `empty-state.tsx` already in Tier 1 |
| Dialog patterns | `ui-kit` `confirm-dialog`, `dialog` |

**Rule:** If file imports `relay`, `community`, `nostr`, or `coordination` → **do not copy**; reimplement against new ports.

---

## Tier 3 — Reference only (no import in Phase 1–2)

| Path | Use |
|------|-----|
| `apps/coordination/` | Signed membership delta pattern → slim `apps/courier` |
| `packages/dweb-coordination-contracts/` | Contract shapes — rewrite minimal |
| `packages/dweb-transport-contracts/` | TransportPort ideas — rewrite per [04-architecture-sketch.md](./04-architecture-sketch.md) |
| `apps/pwa/.../community-trust-policy.ts` | Inform rule packs, not copy |
| `apps/pwa/.../community-relay-transport.ts` | Phase 4 adapter guards only |

---

## Tier 4 — Do not extract

| Path | Reason |
|------|--------|
| `apps/pwa/app/features/groups/**` | Wrong membership model |
| `packages/dweb-nostr/**` | Phase 4 optional |
| `packages/dweb-transport-nostr/**` | Phase 4 optional |
| `packages/dweb-crdt/**` (community membership) | Wrong authority |
| `apps/pwa` hooks: `use-sealed-community`, group providers | Recurrence risk |
| `docs/program/v1.9*` | Obscur schedule, not greenfield |
| `.env.local` Obscur dev flags | Not applicable |

---

## Tier 5 — Docs (copy entire folder)

```text
docs/greenfield/  →  docs/   # in new repo
```

Optional: `ARCHIVE.md` from Obscur root → link back as `LEGACY-OBSCUR.md`.

---

## Verification after extract

| Check | Command / action |
|-------|------------------|
| No `@dweb/nostr` in new repo | `rg "@dweb/nostr" --glob '!LEGACY*'` → empty |
| No `sealed-community` | `rg "sealed-community"` → empty |
| UI builds | `pnpm -C apps/client build` (stub) |
| Crypto unit smoke | vitest on key generate/derive |
| Specs present | `docs/00-charter*.md` or greenfield index |

---

## Rename map (suggested)

| Obscur | Greenfield |
|--------|------------|
| `@dweb/ui-kit` | `@<scope>/ui` |
| `@dweb/crypto` | `@<scope>/crypto` |
| `apps/pwa` | `apps/client` |
| `apps/coordination` | `apps/courier` (new, smaller) |

Replace `<scope>` with npm scope or plain package names in new repo.
