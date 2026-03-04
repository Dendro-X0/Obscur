# On-Call Quickstart (15-Minute Triage)

_Last reviewed: 2026-03-03 (baseline commit 7f57b32)._


Use this when production-like behavior regresses and you need fast, structured triage.

## 0) Identify Runtime and Scope (1 minute)

Capture:

- Runtime: `pwa dev`, `pwa production`, `desktop`, `mobile`.
- Feature area: DM, group, media, auth, settings, relays.
- Flag state: `chatPerformanceV2` on/off.
- Recent version/commit.

## 1) Run Fast Local Verification (3 minutes)

From repo root:

```bash
pnpm -C apps/pwa exec tsc --noEmit
pnpm -C apps/pwa test:run -- --runInBand
```

If issue is in desktop path:

```bash
pnpm -C apps/desktop build
```

## 2) Reproduce with Minimal Inputs (3 minutes)

For chat performance regressions in dev mode, use synthetic generator:

```js
await window.obscurChatPerf.clearConversationMessages("demo:perf");
await window.obscurChatPerf.seedConversationMessages({ conversationId: "demo:perf", count: 10000 });
window.obscurChatPerf.emitBurstEvents({ conversationId: "demo:perf", count: 200 });
```

Then compare with production-mode PWA:

```bash
pnpm -C apps/pwa build
pnpm -C apps/pwa start
```

## 3) Triage by Symptom (5 minutes)

### Chat jank / scroll lag

- `apps/pwa/app/features/messaging/components/message-list.tsx`
- `apps/pwa/app/features/messaging/hooks/use-conversation-messages.ts`
- `apps/pwa/app/features/messaging/lib/performance-monitor.ts`

### Missing / duplicated / out-of-order messages

- `apps/pwa/app/features/messaging/services/message-bus.ts`
- `apps/pwa/app/features/messaging/hooks/use-conversation-messages.ts`
- `apps/pwa/app/features/messaging/services/message-persistence-service.ts`

### Group event rejection / scope mismatch

- `apps/pwa/app/features/groups/hooks/use-sealed-community.ts`
- `apps/pwa/app/features/relays/providers/relay-provider.tsx`

### Upload/playback failures

- `apps/pwa/app/features/messaging/lib/nip96-upload-service.ts`
- `apps/pwa/app/features/messaging/lib/upload-service.ts`
- `apps/pwa/app/features/messaging/components/audio-player.tsx`
- `apps/pwa/app/features/messaging/components/video-player.tsx`

## 4) Required Incident Notes (3 minutes)

Record:

1. exact repro steps,
2. expected vs actual,
3. logs/stack traces,
4. relevant file paths,
5. flag state and runtime,
6. proposed rollback switch (if available).

## Related

- [Feature Change Maps](./10-feature-change-maps.md)
- [Runtime Contracts and Invariants](./11-runtime-contracts-and-invariants.md)
- [Regression Playbooks](./14-regression-playbooks.md)
