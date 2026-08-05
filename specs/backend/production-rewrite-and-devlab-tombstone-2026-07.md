# Design — Production rewrite charter · Dev Lab tombstone · feedback loop

**Status:** Active charter · 2026-07-28  
**Maintainer decision:** Dev Lab is **obsolete**. It must not define “done.” CodaCtrl Studio (release/parity desktop) is the exploration and capture surface.  
**Related:** [`production-dev-parity-recovery-2026-07.md`](./production-dev-parity-recovery-2026-07.md) · [`auth-kern-1-f5-session-loss-investigation-2026-07.md`](./auth-kern-1-f5-session-loss-investigation-2026-07.md) · [`codactrl-obscur-agent-runbook-2026-07.md`](../../docs/program/codactrl-obscur-agent-runbook-2026-07.md)

---

## Session gate

```text
NEXT ATOMIC STEP:     Tombstone Dev Lab as validation · charter production rewrite · fix feedback loop
PAUSED / CANCELLED:   community roster · v2.0.0 tag · demo recording · AUTH-SESSION-1 scatter
CANONICAL OWNER:      validation = release/parity desktop + CodaCtrl; not apps/pwa/app/features/dev-lab
PROOF BEFORE DONE:    isDevLabEnabled() === false · pnpm dev:lab:smoke exits 1 · P2–P4 only on release exe
OUT OF SCOPE:         Big-bang rewrite of all features in this slice · community · silent AUTH-SESSION-1
```

---

## Why Dev Lab dies

| Claim that burned trust | Reality |
|-------------------------|---------|
| `dev:lab:smoke` / L5 green = product works | Lab used programmatic unlock, synthetic DMs, often DEV_LAB shells |
| “Validated in Dev Lab” | Packaged desktop failed account / relays / F5 |
| Dev Lab as ongoing harness | Predates CodaCtrl; duplicates capture without package parity |

**Policy:** Dev Lab is not an experiment lane for ship decisions. It is **tombstoned**. Remaining source under `app/features/dev-lab/**` is dead code until a deletion pass — not a product module.

**Replacement truth surface:**

| Layer | Tool |
|-------|------|
| Explore / digest / chain | CodaCtrl Studio (CDP `:9230` / `:9231`) on **parity or release** exe |
| Day-to-day | `pnpm dev:desktop` (production parity, no DEV_LAB) |
| Ship smoke | `pnpm desktop:demo-preflight` → `desktop:build:exe` → P1–P4 on exe |
| Unit/contract | Targeted vitest — never alone for runtime “fixed” |

---

## Feedback loop failure (why changes feel invisible)

Root cause is **static shell bake**, not “React broken”:

1. Desktop product UI is `apps/pwa/out` inside Tauri WebView.
2. Edit TSX → **no** HMR on default `dev:desktop` until rebuild.
3. `--skip-build` / stale shell → same pixels → “meaningless tweaks.”
4. Next live (`dev:desktop:live`) updates fast but is **not** package truth — using it to validate reintroduces the Dev Lab lie.

**Contract (non-negotiable):**

| Intent | Command |
|--------|---------|
| See code in product shell | `pnpm dev:desktop -- --rebuild` (or allow auto-rebuild when stale) |
| UI iteration only | `pnpm dev:desktop:live` — label claims “not package parity” |
| Release truth | rebuild shell in `desktop:build:exe`; refuse offline/DEV_LAB/`--skip-shell` stale |

Visible stamp: shell revision / stamp-mismatch banners must stay honest. Agents must not claim UI fixed without rebuild + surface match.

---

## Rewrite plan (not big-bang)

**Principle:** Rewrite **owners that fail on release exe**, one band at a time, with CodaCtrl evidence first. Do not rewrite UI-kit aesthetics or pause bands.

### Phase 0 — Truth cut (this slice)

1. Hard-disable `isDevLabEnabled()` (always false).
2. Tombstone `pnpm dev:lab:*` / `verify:tier3` entrypoints (exit 1 + pointer to CodaCtrl).
3. Stop baking DEV_LAB from `dev:desktop -- --online`.
4. Remove Dev Lab install / bridges from app providers boot — **Done 2026-07-31** ([quarantine design](./dev-lab-product-quarantine-design-2026-07.md)): `AuthGateway` + `UnlockedAppRuntimeShell` no longer mount Dev Lab bridges.
5. Handoff: next atomic = production P2–P4 + rewrite band queue (not lab smoke).

### Phase 1 — CodaCtrl production exploration matrix

Capture on **parity/release** exe only. For each row: digest chain + one owner.

| Band | Fail class (from maintainer) | Owner to redesign if broken |
|------|------------------------------|-----------------------------|
| R-AUTH | F5 → Welcome Back despite OS storage copy | `auth-kernel-boot-owner` + keychain persist |
| R-RELAY | ACTIVE TRANSPORT disconnected; pool idle | transport mode + NativeRelay / mesh |
| R-ACCOUNT | Create/unlock fails only in package | identity bootstrap / data root |
| R-FEEDBACK | Edit ≠ visible | static shell stale gates (process, not feature) |

If CodaCtrl cannot capture a band → file **CodaCtrl gap** (below); maintainer rewrites Studio — do not invent Dev Lab replacements.

### Phase 2 — Owner redesign (only after Phase 1 evidence)

Per band: investigation → design → subtract parallel path → implement → L3 on release exe. Cap 3 failed iterations → feasibility (`rules/11`), not month-long silent rewrite.

### Phase 3 — Deletion pass

Delete `app/features/dev-lab/**` + `scripts/dev-lab-*.mjs` when no package.json script references them and no test imports remain. Until then: tombstone + dead tree.

**Schedule honesty:** Demo / v2.0.0 / marketing stay frozen until Phase 0 + at least R-RELAY or R-AUTH L3 green on release exe. “One more month” is allowed as **calendar delay**, not as permission to rewrite without Phase 1 captures.

---

## CodaCtrl deficiency register (seed)

Fill when Studio cannot support a needed prove step. Maintainer rewrites CodaCtrl; agents do not rebuild Dev Lab.

| Gap ID | Need | Current shortfall | Owner |
|--------|------|-------------------|-------|
| CD-1 | Unlock → F5 → digest `auth.kernel_boot_restore_*` | MCP may be misaligned / missing in agent session | Studio + runbook |
| CD-2 | Assert ≥1 relay ACTIVE with events after Mixed apply | Need stable selectors + digest keys for pool roles | Studio + Obscur probes |
| CD-3 | Prove shell stamp / revision after rebuild | Need stamp in digest or probe hook | Obscur shell manifest + Studio |
| CD-4 | Packaged exe attach without lab unlock | Must never require `__OBSCUR_DEV_LAB__` | Studio |
| CD-5–10 | Owner graph · truth surfaces · stale shell · vertical slice · freeze-set · salvage preset | See [codactrl-obscur-thorn-subjects-2026-07.md](./codactrl-obscur-thorn-subjects-2026-07.md) | CodaCtrl Studio |

---

## Claim language

| May say | When |
|---------|------|
| Dev Lab tombstoned | Policy always off + scripts exit 1 |
| Feedback loop fixed | Maintainer sees TSX change after documented rebuild path (L3) |
| Band redesigned | Spec + L3 on release exe |
| Release ready | P1–P4 + package smoke — **never** `dev:lab:*` |

---

## Explicit non-goals

- Using Dev Lab smoke to greenlight any release train
- Rewriting community while PAUSED
- AUTH-SESSION-1 scatter revive
- Treating `dev:desktop:live` Next HMR as production proof
