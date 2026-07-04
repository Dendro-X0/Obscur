# Runtime investigation and capture (without CodaCtrl)

**Status:** Active — L3 runtime layer (see parent spec)  
**Last updated:** 2026-06-01  
**Parent spec:** [testing-and-issue-tracking-spec.md](./testing-and-issue-tracking-spec.md)  
**Automated alternative (faster):** [runtime-capture-e2e.md](./runtime-capture-e2e.md) — `pnpm capture:runtime`  
**Related:** [08-maintainer-playbook.md](../encyclopedia/08-maintainer-playbook.md) · [p5-persistence-survival-contract.md](./p5-persistence-survival-contract.md) · [manual-verification-environment.md](./manual-verification-environment.md) · CodaCtrl [Obscur case study](file:///E:/Experimental%20projects/codactrl/docs/case-studies/obscur-green-ci-red-runtime.md)

---

## Why this doc exists

Obscur already has substantial runtime instrumentation. What is missing is not more logging—it is a **repeatable capture discipline** that:

1. Separates **what CI proved** from **what the running app proved**
2. Produces **one portable JSON bundle** per incident before the next code change
3. Stores incidents where agents and future-you can find them (`docs/incidents/`)
4. Feeds CodaCtrl later **without re-explaining bugs in chat** (export format is forward-compatible)

CodaCtrl is the long-term evidence layer. Until it is ready, use Obscur’s built-in capture APIs and this playbook.

---

## Current limitations (honest)

| Limitation | Effect on investigation |
|------------|-------------------------|
| **Green `pnpm verify:*` ≠ desktop truth** | Contract tests use mocks; native SQLite, cold restart, and OS notifications need runtime capture |
| **`obscurDevRuntimeIssues` dev-only** | `NODE_ENV === "production"` builds omit `window.obscurDevRuntimeIssues` and `obscurDeliveryTroubleshooting` |
| **DevTools required for one-copy capture** | Tauri desktop: open inspector (see § Accessing DevTools) |
| **Event buffer is in-memory** | Restart clears `obscurAppEvents` unless you captured **before** quit |
| **No automatic incident file write** | Operator must paste/save bundle manually (or use dev panel copy buttons in dev builds) |
| **Group backend subtracted** | Group send is stubbed; DM-focused investigation is the reliable lane today |

**Rule:** Treat every capture as **point-in-time**. Note build version, surface (Tauri vs browser), and repro step immediately before capture.

---

## What is already available (use this first)

Installed at boot via `providers.tsx`:

| API | Always on desktop? | Purpose |
|-----|-------------------|---------|
| `window.obscurAppEvents` | **Yes** | Ring buffer, digests, `findByName` |
| `window.obscurM0Triage` | **Yes** | One-shot bundle: runtime snapshots + focused events |
| `window.obscurM4Stabilization` | **Yes** | Search-jump / UI responsiveness slice |
| `window.obscurRelayRuntime` | **Yes** | Relay readiness snapshot |
| `window.obscurWindowRuntime` | **Yes** | Window/supervisor snapshot |
| `window.obscurDevRuntimeIssues` | **Dev / non-production only** | Deduped fault list |
| `window.obscurDeliveryTroubleshooting` | **Dev / non-production only** | Sender delivery failures |
| Dev panel (copy buttons) | **Dev mode or `NODE_ENV=development`** | UI for runtime issues, relay probe, audits |

### Primary capture (preferred)

In DevTools console **immediately after repro, before restart**:

```js
copy(window.obscurM0Triage?.captureJson(300))
```

Paste into `docs/incidents/<date>-<short-slug>.json` or a scratch file.

### Fallback bundle (when M0 partial)

```js
copy(JSON.stringify({
  capturedAt: new Date().toISOString(),
  version: "obscur.manual.capture.v1",
  build: document.querySelector("[data-client-surface-revision]")?.textContent ?? null,
  runtime: window.obscurWindowRuntime?.getSnapshot?.() ?? null,
  relayRuntime: window.obscurRelayRuntime?.getSnapshot?.() ?? null,
  relayJournal: window.obscurRelayTransportJournal?.getSnapshot?.() ?? null,
  digest: window.obscurAppEvents?.getDigest?.(300) ?? null,
  crossDevice: window.obscurAppEvents?.getCrossDeviceSyncDigest?.(400) ?? null,
  devIssues: window.obscurDevRuntimeIssues?.getRecentIssues?.() ?? null,
  deliveryIssues: window.obscurDeliveryTroubleshooting?.getRecentSenderDeliveryIssues?.() ?? null,
}, null, 2));
```

---

## Accessing DevTools (Tauri desktop)

1. Run `pnpm dev:desktop:online` for fastest iteration (same app as packaged webview).
2. Open WebView inspector:
   - **Windows:** often `Ctrl+Shift+I` or right-click → Inspect (depends on Tauri dev config).
   - If inspector is disabled in a **release** build, reproduce on `dev:desktop:online` or a debug build with inspector enabled.
3. Enable **dev mode** in-app (dev panel) only when using mock pool—otherwise stay on live relay for fidelity.

For persistence bugs, **prefer Tauri** over browser at `:3340` (browser has no native SQLite authority).

---

## Investigation workflow (every incident)

```text
1. Name the symptom (user-visible, one sentence)
2. Record surface + build (Tauri debug / release / browser)
3. Reproduce once without changing code
4. Run targeted probes (§ Playbooks) in console
5. One-copy capture (M0 or fallback) — BEFORE restart
6. Save incident record (§ Incident record template)
7. Run narrow verify slice — label result "contract only"
8. Only then change code
```

### Incident record template

Save as `docs/incidents/YYYY-MM-DD-<slug>.md` alongside optional `<slug>.json` bundle:

```markdown
# Incident: <title>

- **Date (UTC):**
- **Symptom ID:** (O-1…O-5 from case study, or new)
- **Surface:** Tauri desktop | browser :3340
- **Build / git:** (SHA or app version badge)
- **Repro steps:** (numbered, minimal)

## What CI would claim
- `pnpm verify:...` — pass/fail, which slice

## What runtime showed
- `crossDevice.summary.selfAuthoredDmContinuity.riskLevel`: ...
- Key events: `findByName("...", 20)` → paste summary

## Capture
- Bundle: `docs/incidents/<file>.json`
- Captured before restart: yes | no

## Hypothesis / owner
- Canonical owner module:
- Mocked boundary (what tests do NOT cover):

## Outcome
- (fill after fix attempt)
```

---

## Symptom playbooks

### O-2 — Outgoing DM missing after cold restart

**Repro:** Send DM → confirm visible → quit app fully → reopen → thread empty or outgoing gone.

**Probes (before restart, after send):**

```js
window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.selfAuthoredDmContinuity
window.obscurAppEvents.findByName("messaging.conversation_history_authority_selected", 20)
window.obscurAppEvents.getRecent(80).filter(e => e.name.startsWith("messaging.dm.send"))
```

Look for:

| Signal | Meaning |
|--------|---------|
| `riskLevel: "high"` + `idSplitDetectedCount > 0` | UUID vs nostr id split — persistence bridge likely failed |
| `sparseOutgoingEvidence: true` | Outgoing not in indexed/persisted authority |
| `persistedRecoveryIndexedMissingOutgoingCount > 0` | Recovery path sees gap |
| `latestHistoryAuthorityReason` contains `missing_outgoing` | Hydrate authority chose recovery because outgoing not indexed |
| `latestHydratedOutgoingCount === 0` after send | In-memory or hydrate path never saw outgoing row |

Note: `message_updated` is a **message-bus** event (persistence listener), not an `obscurAppEvents` name—use the digest slice above, not `findByName("message_updated")`.

**After restart (new session):** capture again; compare `latestHydratedOutgoingCount` vs before.

**Contract complement (not substitute):**

```bash
pnpm verify:p5-persistence
pnpm verify:thread-history
```

State explicitly: passes prove **service logic with mocks**, not **Tauri cold restart**.

---

### O-3 — Relay offline flash on refresh

**Repro:** Refresh or cold start → brief “offline” banner → may recover.

**Probes:**

```js
window.obscurRelayRuntime?.getSnapshot?.()
window.obscurAppEvents.findByName("warmup.phase_transition", 20)
window.obscurAppEvents.findByName("runtime.activation.relay_runtime_gate", 20)
window.obscurAppEvents.getDigest(200).warmUpSummary
```

Look for `startup_warmup` vs hard offline classification in warmup events.

---

### O-1 — Notification storm (rapid DMs)

**Repro:** Receive several DMs quickly while app in background.

**Probes:**

```js
window.obscurAppEvents.findByName("notifications.", 30)  // if named events exist
window.obscurAppEvents.getDigest(100).topNames
```

Note: OS notification policy may differ from in-app event counts—record **OS behavior** in incident markdown, not only JSON.

---

### O-4 — Group thread (currently limited)

Group **send** is stubbed; **read/ingest** may be partial. For group issues, record:

- Whether symptom is **UI shell only** vs **backend expected**
- `groups.membership_recovery_hydrate`, `groups.membership_ledger_load` via `findByName`
- `crossDevice.summary.membershipSendability`

Do not spend long group backend investigation until handoff says ingest/send is re-enabled.

---

### Startup / navigation freeze

See maintainer playbook § A. Probes:

```js
window.obscurAppEvents.findByName("navigation.route_stall_hard_fallback", 30)
window.obscurUiResponsiveness?.getSnapshot?.()
window.obscurM4Stabilization?.captureJson(400)
```

---

## What automated gates are for (and not for)

| Gate | Proves | Does not prove |
|------|--------|----------------|
| `pnpm verify:p5-persistence` | Persistence **module contracts** (mocked native) | Packaged app cold restart |
| `pnpm verify:thread-history` | Thread history kernel wiring | Full UI render after remount |
| `pnpm verify:path-b-b3` | Path B contract strings / reducer | Live relay round-trip |
| `readSource()` / grep gates | Intent in source | Behavioral replay |

In every incident record, fill **both** columns. This prevents false “fixed” claims.

---

## Storing captures in-repo

```
docs/incidents/
  README.md
  2026-06-01-dm-outgoing-lost-after-restart.md
  2026-06-01-dm-outgoing-lost-after-restart.json
```

- **Markdown** = human narrative + repro + owner hypothesis  
- **JSON** = raw `obscurM0Triage` or manual bundle (may be large; acceptable)  
- Do **not** commit secrets (nsec, backup blobs). Bundles should be diagnostic metadata only.

When CodaCtrl is ready, these JSON files are the **first import candidates** for a fault adapter (`runtime_digest`, `verification_run` records).

---

## Escalation (when to stop patching)

Pause feature work and switch to recovery mode when ([maintainer playbook](../encyclopedia/08-maintainer-playbook.md)):

1. Same symptom class **twice** with capture showing same `riskLevel` / reason code
2. `selfAuthoredDmContinuity.riskLevel === "high"` after restore
3. Capture shows green verify slice but runtime digest still reports faults in same subsystem

Then: map to canonical owner, subtract parallel paths, add diagnostics at boundary **before** next behavior change.

---

## Quick reference card

```js
// DM continuity
window.obscurAppEvents.getCrossDeviceSyncDigest(400).summary.selfAuthoredDmContinuity

// Full bundle
copy(window.obscurM0Triage?.captureJson(300))

// Event search
window.obscurAppEvents.findByName("messaging.", 40)

// Relay
window.obscurRelayRuntime?.getSnapshot?.()
```

**Before restart. One capture. Save to `docs/incidents/`. Then code.**
