# Runtime capture E2E (automated L3)

**Status:** Active pilot — replaces slow manual DevTools capture for golden-path checks  
**Parent:** [testing-and-issue-tracking-spec.md](./testing-and-issue-tracking-spec.md)  
**Schema:** `obscur.runtime-capture-report.v1`

---

## What this is

An end-to-end Playwright script that:

1. Unlocks disposable **Tester1** on the desktop dev URL (`http://127.0.0.1:3340`)
2. Runs a **navigation soak** (Network → Settings → Search → Chats)
3. **Reloads** the shell (simulated cold remount of the web layer)
4. Captures `obscurM0Triage.capture(300)` and `getCrossDeviceSyncDigest(400)`
5. **Fails** on `riskLevel: "high"` for DM continuity / UI responsiveness, or recent digest errors
6. Writes JSON artifacts under `test-results/runtime-capture/` (or `--out`)

This is **faster than manual testing** for regression detection on startup, relay warmup digests, navigation, and DM continuity **signals**—not a full replacement for two-user matrix (L4).

---

## Proof layer placement

| Layer | This script |
|-------|-------------|
| L1/L2 | Complement with `pnpm verify:*` — not run automatically |
| **L3-auto** | **This script** — digest + M0 bundle gates |
| L3-manual | DevTools one-copy when automating cannot repro |
| L4 | Unified verification matrix (milestone) |

**Chromium vs Tauri native:**

| Mode | Command | Native SQLite | Speed |
|------|---------|---------------|-------|
| **Fast (default)** | Playwright Chromium → `:3340` | No | ~1–3 min |
| **Native truth** | `--require-native --cdp` → Tauri WebView | Yes | ~2–4 min + Tauri boot |

Tauri dev loads the **same** `:3340` app; only the native bridge differs.

---

## Quick start

### 1. Start desktop stack (terminal A)

```bash
pnpm dev:desktop:online
```

Wait until the app is reachable at `http://127.0.0.1:3340`.

### 2. Run capture (terminal B)

```bash
pnpm capture:runtime
```

Or with artifact copy into incidents:

```bash
pnpm capture:runtime -- --out docs/incidents/e2e
```

### 3. Read results

| File | Content |
|------|---------|
| `test-results/runtime-capture/runtime-capture-latest.json` | Raw capture input |
| `test-results/runtime-capture/runtime-capture-evaluated.json` | Gate evaluation |
| `test-results/runtime-capture/runtime-capture-summary.json` | Pass/fail + failed gate ids |

Exit code **0** = gates passed; **non-zero** = investigate bundle before merging.

---

## Native Tauri WebView (persistence claims)

CDP cannot reliably drive Tauri auth (React + native unlock). **Unlock Tester1 manually** in the desktop window; the capture script polls until the sidebar appears.

**Windows (terminal A):**

```bash
export WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS="--remote-debugging-port=9222"
pnpm dev:desktop:online
```

**Terminal B** — start capture, then unlock in Tauri when prompted (default wait **3 min**):

```bash
pnpm capture:runtime:native
```

Same as `pnpm capture:runtime:cdp` (standalone CDP script, no Playwright test runner).

Optional longer wait:

```bash
OBSCUR_RUNTIME_CAPTURE_STARTUP_TIMEOUT_MS=300000 pnpm capture:runtime:native
```

---

## Alternative capture paths

| Path | When to use | Command |
|------|-------------|---------|
| **L3a fast (default)** | Startup, nav, digest gates; no SQLite truth | `pnpm capture:runtime` |
| **L3-native (recommended)** | Tauri `__TAURI__` + native storage signals | `pnpm capture:runtime:native` after manual unlock |
| **Playwright + CDP** | Legacy; auth wait bug fixed but still prefer CDP script | `node scripts/runtime-capture-e2e.mjs --require-native --cdp http://127.0.0.1:9222` |
| **Manual L3b** | Incident bundle, one-off repro, auth blocked | DevTools snippet below |

### Manual DevTools bundle (no Playwright)

With Tauri unlocked, open DevTools → Console:

```javascript
copy(JSON.stringify({
  m0: window.obscurM0Triage?.capture?.(300),
  digest: window.obscurAppEvents?.getCrossDeviceSyncDigest?.(400),
  at: Date.now(),
}, null, 2))
```

Paste into `docs/incidents/<id>/` per [runtime-investigation-and-capture.md](./runtime-investigation-and-capture.md).

**Future (not implemented):** dev-only `window.obscurTestHarness.unlockTester1()` or Tauri IPC export — would remove manual unlock for CI-native lane.

---

## Commands

| Script | Action |
|--------|--------|
| `pnpm capture:runtime` | Playwright Chromium → `:3340` (automated unlock) |
| `pnpm capture:runtime:cdp` | Standalone CDP → Tauri (manual unlock, 3 min poll) |
| `pnpm capture:runtime:native` | Alias for `capture:runtime:cdp` |
| `pnpm verify:runtime-capture` | Lib unit tests |

### Runner flags

```bash
node scripts/runtime-capture-e2e.mjs [options]
```

| Flag | Purpose |
|------|---------|
| `--start-pwa` | Boot PWA dev only if `:3340` is down |
| `--base-url URL` | Override default `http://127.0.0.1:3340` |
| `--out DIR` | Artifact directory |
| `--cdp URL` | Connect Playwright to Tauri WebView (default `http://127.0.0.1:9222`) |
| `--require-native` | Fail if `__TAURI__` bridge not callable |

---

## Gate catalog (v1)

| Gate ID | Severity | Fail when |
|---------|----------|-----------|
| `shell.unlocked` | error | Auth gate / no messenger chrome |
| `shell.no_fatal_boundary` | error | Root `RootErrorBoundary` active (fatal render loop) |
| `capture.m0_apis` | error | `obscurM0Triage` or relay snapshot APIs missing |
| `runtime.native_required` | error | `--require-native` and no Tauri bridge |
| `dm_continuity.risk` | error | `selfAuthoredDmContinuity.riskLevel === "high"` |
| `ui_responsiveness.risk` | error | `uiResponsiveness.riskLevel === "high"` |
| `account_scope.risk` | error | `accountSwitchScopeConvergence.riskLevel === "high"` |
| `digest.recent_errors` | error | Recent error-level events in digest window |
| `dm_kernel.dev_lab` | error | `--require-native` and Dev Lab bridge missing |
| `dm_kernel.write_probe` | error | Native SQLite write roundtrip failed (`probeNativeDmSqliteWrite`) |
| `dm_kernel.one_sided_sqlite` | error | One-sided DM conversations detected in SQLite scan |

Chromium-only runs skip dm-kernel gates (logged as warnings).

### dm-kernel CDP gate (focused)

After unlocking Tester1 in Tauri with CDP enabled:

```bash
pnpm capture:runtime:dm-kernel
```

Writes `test-results/runtime-capture/dm-kernel-cdp-gate-latest.json`. Full native capture (`pnpm capture:runtime:native`) includes the same gates in `runtime-capture-evaluated.json`.

`watch` risk levels **pass** (logged as warnings in evaluated report).

---

## Extending scenarios

Add steps in `apps/pwa/tests/e2e/runtime-capture-desktop.spec.ts`:

- DM send + digest probe (needs stable peer fixture)
- Two-browser contexts (Tester1 + Tester2) for incoming DM
- Post-quit process restart (true cold start — requires native driver; future)

Keep each scenario pushing to `scenarios[]` in the report for traceability.

---

## CI integration (optional)

Not required for local pilot. When adopting:

1. Job starts `pnpm dev:desktop:stack` or pre-bakes `:3340` service
2. Runs `pnpm capture:runtime`
3. Uploads `runtime-capture-evaluated.json` as artifact
4. Does **not** replace `verify:p5-persistence` — different proof layer

---

## Related

- Manual L3 playbook: [runtime-investigation-and-capture.md](./runtime-investigation-and-capture.md)
- Maintainer probes: [08-maintainer-playbook.md](../encyclopedia/08-maintainer-playbook.md)
- Implementation: `scripts/runtime-capture-e2e.mjs`, `scripts/runtime-capture-cdp.mjs`, `apps/pwa/tests/e2e/runtime-capture-desktop.spec.ts`
