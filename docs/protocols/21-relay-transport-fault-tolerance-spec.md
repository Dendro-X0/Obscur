# 21 Relay Transport Fault-Tolerance Spec

_Last reviewed: 2026-04-18 (baseline commit a3f16b10)._

Status: Active planning
Scope: unstable-network tolerance for DM publish and NIP-96 media upload across web/PWA and desktop runtimes

## Goal

Increase transport tolerance for slow, jittery, or partially disconnected
networks without creating a second owner for message delivery or upload
lifecycles.

This spec exists because current local hardening reduced some crash/timeout
classes, but runtime truth is still open under:

1. mobile tethering and weak Wi-Fi,
2. virtualized networks,
3. desktop Tor/proxy routing,
4. slow provider response with long-lived uploads,
5. partial relay reachability where some recipient relays are healthy and
   others are not.

## Problem Statement

Current behavior is stronger than before, but it still has a gap:

1. DM publish has evidence-backed relay gating, but retry strategy is still
   optimized around short-lived failures rather than prolonged degraded links.
2. NIP-96 upload rotates providers and scales timeouts by file size, but it
   still treats each foreground attempt as an isolated action instead of a
   durable transport session with explicit retry/cooldown state.
3. Slow or proxied networks can produce apparent "infinite upload" behavior:
   repeated provider attempts with little diagnostic clarity, no persisted
   attempt ledger, and no canonical queued continuation path after the user
   action leaves the foreground.
4. Runtime claims are still too coarse for future triage. We can tell that an
   upload timed out or a provider failed, but not which stage consumed the
   budget, whether the failure was provider-specific or path-wide, or whether
   retrying the same provider is rational.

## Locked Owner Boundaries

Do not add new parallel owners.

Canonical owners for this lane:

1. DM publish durability:
   - `apps/pwa/app/features/messaging/controllers/outgoing-dm-publisher.ts`
2. Attachment upload transport:
   - `apps/pwa/app/features/messaging/lib/nip96-upload-service.ts`
3. Relay recovery/watchdog policy:
   - `apps/pwa/app/features/relays/services/relay-recovery-policy.ts`
4. Relay runtime truth/diagnostics:
   - `apps/pwa/app/features/relays/services/relay-runtime-supervisor.ts`
   - `apps/pwa/app/features/relays/services/relay-transport-journal.ts`
5. Native network/proxy boundary:
   - `apps/desktop/src-tauri/src/net.rs`
   - `apps/desktop/src-tauri/src/relay.rs`

Non-owners:

1. UI components must not invent their own retry loops.
2. Attachment picker/composer surfaces must not claim send success from local
   upload completion alone.
3. Settings/Tor toggles must not become hidden transport owners.

## Contract Decisions

### 1. One user action, two explicit durability stages

For media messages, durability is split into:

1. payload upload durability,
2. message relay publish durability.

Upload success is not message delivery success.
Relay publish success is not recipient receipt success.

UI states and diagnostics must keep those stages separate.

### 2. Foreground attempts must converge into one canonical background path

If upload or publish cannot finish in the active foreground budget, the action
must converge into one persisted retry owner rather than foreground recursion or
indefinite spinner behavior.

Required property:

1. foreground attempt,
2. bounded retry/cooldown decision,
3. persisted queued continuation or deterministic failure.

No "keep trying forever while the same modal stays open" path.

### 3. Retry policy must reason about failure family, not just failure count

Fault tolerance should distinguish:

1. transient path failures:
   - timeout,
   - reset connection,
   - temporary DNS or proxy failure,
   - relay temporarily unwritable;
2. provider-local failures:
   - structured 4xx/5xx from a single provider,
   - malformed provider response,
   - unsupported multipart/field expectation;
3. deterministic/fatal failures:
   - missing auth/session key,
   - file exceeds runtime policy,
   - unsupported runtime path.

Only transient/provider-local failures may enter retry/cooldown sequencing.

### 4. Slow networks need adaptive budgets, not static optimism

Timeouts must derive from:

1. file size,
2. observed attempt history for the current action,
3. runtime path:
   - browser,
   - native,
   - native with browser fallback,
4. privacy-routing mode when available:
   - direct,
   - proxy,
   - Tor.

The contract is not "wait forever".
The contract is "budget explicitly, then queue or fail explicitly".

### 5. Transport diagnostics must be stage-specific

Every upload/publish attempt should be diagnosable by:

1. owner,
2. action id,
3. stage,
4. provider or relay scope,
5. timeout budget,
6. retry family,
7. final outcome.

## Required New Diagnostics

Add a canonical transport attempt journal for attachment upload that mirrors
relay publish diagnostics.

Minimum event surface:

1. `messaging.transport.upload_owner`
2. `messaging.transport.upload_attempt_started`
3. `messaging.transport.upload_attempt_result`
4. `messaging.transport.upload_retry_scheduled`
5. `messaging.transport.upload_queue_resumed`
6. `messaging.transport.upload_terminal_failure`

Each event should capture at least:

1. `messageId` or provisional action id,
2. `conversationId`,
3. `fileName`,
4. `fileSizeBytes`,
5. `attachmentKind`,
6. `providerUrl`,
7. `transportPath`
   - `browser`
   - `tauri`
   - `tauri_browser_fallback`
   - `local_api_fallback`
8. `attemptIndex`,
9. `timeoutBudgetMs`,
10. `reasonCode`,
11. `retryable`,
12. `queued`,
13. `torEnabled` or proxy capability signal when available.

## Phase Plan

## Phase 1: Diagnostics and Owner Lock

Objective:
turn the current fuzzy large-upload failure class into diagnosable transport
stages without changing the external UX contract yet.

Required outputs:

1. add upload-attempt journal events in `nip96-upload-service.ts`,
2. add a typed upload transport outcome contract shared by upload path tests,
3. record whether the failing path was native, browser, or fallback,
4. record timeout budget and provider rotation order per action,
5. document the new diagnostics in the handoff and release notes if landed.

Exit criteria:

1. slow-network failures can be grouped by stage and path,
2. a future runtime replay can answer "where did the budget go?" without log
   archaeology,
3. no second owner path is introduced.

## Phase 2: Bounded Retry and Cooldown Ledger

Objective:
replace repeated ad hoc provider attempts with one explicit retry family
contract.

Required outputs:

1. persist upload retry metadata per action:
   - provider attempts,
   - last reason code,
   - next retry time,
   - completed provider set,
2. introduce provider cooldown windows for transient provider-local failures,
3. distinguish "retry same provider with larger budget" from
   "rotate provider now",
4. cap foreground attempts and hand off to queued continuation.

Locked behavior:

1. do not rotate providers immediately on the first slow timeout if the path is
   globally slow and the same provider has not produced a deterministic failure,
2. do not keep retrying the same provider forever,
3. do not restart from attempt zero after every modal reopen.

## Phase 3: Queued Attachment Continuation

Objective:
make unstable-network continuation deterministic after the user leaves the
foreground send action.

Required outputs:

1. add a canonical queued-upload owner or extend the existing outgoing queue so
   attachment upload can resume before relay publish,
2. keep upload stage state separate from relay publish state,
3. preserve scoped relay targets and successful upload evidence for the follow-on
   publish step,
4. expose explicit queued vs terminal UI status.

Non-goal:
true multipart resumable upload across third-party providers. That is not
required for this phase.

## Phase 4: Privacy-Routed Runtime Calibration

Objective:
make Tor/proxy/virtualized-network behavior first-class in budgeting and triage.

Required outputs:

1. detect privacy-routed runtime mode where available from native boundary,
2. widen timeout baselines and reduce premature provider rotation when that mode
   is active,
3. attach routing capability evidence to diagnostics,
4. verify runtime truth on at least one proxy/Tor replay lane.

## Small-Slice Implementation Order

Implement in this order:

1. Phase 1 diagnostics only,
2. Phase 2 retry-family ledger for upload only,
3. queued upload continuation,
4. Tor/proxy calibration,
5. only then consider UX copy refinements.

## Validation Gate Per Slice

```bash
pnpm.cmd -C apps/pwa exec vitest run app/features/messaging/lib/nip96-upload-service.test.ts app/features/messaging/lib/media-upload-policy.test.ts app/features/messaging/lib/upload-service.test.ts
pnpm.cmd -C apps/pwa exec tsc --noEmit --pretty false
pnpm.cmd docs:check
```

Runtime replay target after Phase 1 or Phase 2:

1. one small file on nominal network,
2. one medium file on slow/flappy network,
3. one file over Tor/proxy on desktop if available,
4. verify journal events and queued-vs-terminal outcomes.

## Explicit Non-Goals

This spec does not:

1. claim that large uploads are fixed today,
2. replace recipient-evidence contracts for DM/request delivery,
3. treat local upload completion as proof of remote message durability,
4. add a second transport owner in UI hooks or settings panels.
