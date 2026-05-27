# PRODUCT_NAME (greenfield)

**Status:** Phase 0 — specification and bootstrap  
**Legacy:** Extracted UI/crypto from [Obscur](OBSCUR_REPO_URL) @ commit `SOURCE_SHA`

---

## What this is

Privacy-first, E2EE communication client per `docs/` specifications:

- Recipient-only behavioral warnings (no sender punishment, no content removal)
- No mandatory real-world identity
- Pragmatic encryption — local search, courier holds ciphertext + bounded metadata only
- Limited product responsibility — see [docs/06-scope-of-responsibility.md](docs/06-scope-of-responsibility.md)

**Not** a fork of Obscur runtime. Obscur paths (Nostr membership, sealed community) are intentionally excluded.

---

## Documentation

| Doc | Topic |
|-----|--------|
| [docs/README.md](docs/README.md) | Index |
| [docs/01-phase-roadmap.md](docs/01-phase-roadmap.md) | Phases 0–5 |
| [docs/07-repository-strategy.md](docs/07-repository-strategy.md) | Why this repo exists |

---

## Development (stub)

```bash
pnpm install
pnpm dev          # apps/client when wired
pnpm test:phase0  # scaffold tests
```

---

## Phase status

| Phase | Status |
|-------|--------|
| 0 Charter + tests | In progress |
| 1 DM E2EE | Not started |
| 2 Groups | Not started |

---

## Extraction record

```text
SOURCE_REPO=<obscur-url>
SOURCE_SHA=<git sha>
EXTRACTED=<date>
```

Packages copied: `ui-kit` → `packages/ui`, `dweb-crypto` → `packages/crypto` (see extraction manifest).
