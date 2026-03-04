# Performance and Load Testing

_Last reviewed: 2026-03-03 (baseline commit 7f57b32)._


## Objective

Validate smoothness under high message volume without relying on manual message spam.

## Performance Feature Flag

- Setting key: `chatPerformanceV2`
- Default: `false` (safe rollout)
- Toggle location: Settings -> Storage

## Synthetic Load Tools (Dev Only)

In development mode, use browser console:

```js
await window.obscurChatPerf.clearConversationMessages("demo:perf");
await window.obscurChatPerf.seedConversationMessages({ conversationId: "demo:perf", count: 10000 });
window.obscurChatPerf.emitBurstEvents({ conversationId: "demo:perf", count: 200 });
```

Provided by:

- `apps/pwa/app/features/messaging/dev/chat-performance-dev-tools.ts`

## Production-Mode Verification

Always compare against production server behavior:

```bash
pnpm -C apps/pwa build
pnpm -C apps/pwa start
```

`next dev` can exaggerate lag due to development overhead.

## Performance Metrics

Performance monitor includes:

- message-bus events/sec,
- average batch size,
- average batch flush latency,
- merged/dropped event counts,
- UI update latency and p95.

File: `apps/pwa/app/features/messaging/lib/performance-monitor.ts`
