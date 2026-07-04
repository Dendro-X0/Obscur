# Legacy quarantine — delete list

**ENGINE LAB:** These paths are not product surface. Do not extend. Do not “bridge.” Remove callers until imports are zero, then delete files.

Authority: [obscur-engine-lab-charter.md](../../../docs/program/obscur-engine-lab-charter.md)

---

## Hydrate / DM read (superseded by dm-kernel)

- `features/messaging/services/dm-conversation-hydrate-read-model.ts` → moved to `legacy/dm-conversation-hydrate-read-model-legacy.ts` (opt-in only)
- `features/messaging/services/dm-conversation-hydrate-indexed-scan.ts` → moved to `legacy/dm-conversation-hydrate-indexed-scan-legacy.ts` (opt-in only)
- `features/messaging/services/dm-conversation-hydrate-indexed-map-rows.ts` → moved to `legacy/dm-conversation-hydrate-indexed-map-rows-legacy.ts` (opt-in only)
- `features/messaging/services/dm-conversation-projection-evidence-messages.ts` → **w28 subtracted**; body in `features/messaging/services/thread-history/projection-evidence-messages.ts`
- `features/messaging/services/dm-conversation-projection-live-merge.ts` → **w28 subtracted**; body in `features/messaging/services/thread-history/projection-live-merge.ts`
- `features/messaging/services/native-dm-thread-hydrate.ts` → **w30 subtracted**; body in `thread-history/native-dm-thread-hydrate.ts`
- `features/messaging/services/native-dm-conversation-hydrate-owner.ts` → moved to `legacy/native-dm-conversation-hydrate-owner-legacy.ts` (opt-in only)
- `features/messaging/services/dm-conversation-materialization-load-earlier.ts` → **w29 subtracted**; body in `thread-history/materialization-load-earlier.ts`
- `features/messaging/services/dm-conversation-materialization-realtime.ts` → **w29 subtracted**; body in `thread-history/materialization-realtime.ts`
- `features/messaging/hooks/use-conversation-messages.ts` → moved to `legacy/use-conversation-messages-legacy.ts` (opt-in only)

## Chat state as message authority

- `features/messaging/services/chat-state-store.ts` → w40: `features/messaging/services/chat-state-store-legacy.ts`; types on `chat-state-store-types.ts`

## Groups / sealed community parallel owners

- `features/groups/hooks/use-sealed-community.ts` → moved to `legacy/use-sealed-community-legacy.ts`; types on `use-sealed-community-types.ts`
- `features/groups/providers/group-provider.tsx` → moved to `legacy/group-provider-legacy.tsx`; types on `group-provider-types.ts`

## Relay multi-owner stack (until transport-engine)

- `features/relays/services/relay-recovery-policy.ts` → **w27 subtracted**; body in `features/relays/services/relay-recovery-controller-legacy.ts` (w9 quarantine); types on `relay-recovery-types.ts`
- `features/relays/hooks/enhanced-relay-pool.ts` → moved to `legacy/enhanced-relay-pool-legacy.ts`; types on `enhanced-relay-pool-types.ts`

## Opt into legacy for archaeology only

```bash
NEXT_PUBLIC_OBSCUR_ALLOW_LEGACY=1
```

Default is strict kernel authority — no legacy parallel paths.

---

## Subtracted (B5 — zero production importers)

Deleted — do not restore:

- `features/messaging/services/dm-authority-drift-detector.ts`
- `features/messaging/services/dm-delete-event-log-reconciliation.ts` (+ test)
- `features/messaging/services/realtime-voice-ui-visibility.ts` (+ test)
- `features/messaging/hooks/use-conversation-messages-fixed.ts` (diagnostic wrapper, zero importers)
- **v1 DM controller stack** (superseded by `controllers/v2/dm-controller.ts`):
  - `controllers/legacy/enhanced-dm-controller.ts`, `incoming-dm-event-handler.ts`
  - `controllers/outgoing-dm-{orchestrator,publisher,send-preparer}.ts`
  - `controllers/{relay-ok-message-handler,recipient-discovery-service,dm-queue-orchestrator}.ts`
- `services/dm-conversation-materialization-port.ts` (re-export shim)
- `services/dm-conversation-materialization-owner.ts` (re-export shim)
- `lib/__tests__/*` v1 controller quarantine (8 checkpoint/integration tests)
- `components/message-list-scroll-debug.ts` (unused debug helper)
- **w5 — debug / shim / v1 controller island** (zero production importers):
  - `lib/message-flow-debugger.ts`, `lib/message-logger.ts`, `lib/fetch-link-preview.ts`
  - `search/hooks/use-mobile-discovery-compact-layout.ts` (deprecated re-export)
  - `lib/dms/{use-peer-trust,use-requests-inbox,use-dm-controller}.ts`, `hooks/use-dm-controller.ts`
  - `lib/{relay-connection,nostr-safety-limits}.ts` (v1 controller island; v2 is canonical)
- **w9 — dm-read-authority-contract subtracted from features/**:
  - `services/dm-read-authority-contract.ts` → tombstoned; body in `legacy/dm-read-authority-contract-legacy.ts`
  - Types → `thread-history/hydrate-authority-types.ts`
- **w30 — native thread hydrate subtracted from legacy/**:
  - `legacy/native-dm-thread-hydrate-legacy.ts` → deleted; body in `thread-history/native-dm-thread-hydrate.ts`

Gate: `pnpm verify:legacy-subtraction`

---

## Deletion queue (w26 — port-only importer graph)

**Policy:** delete each legacy file when its port has zero callers and dm-kernel / transport-engine owns the behavior. Until then, feature code imports legacy **only** through the port column.

| Legacy module | Port owner(s) | Delete when |
|---------------|---------------|-------------|
| ~~`chat-state-store-legacy.ts`~~ | chat-state ports | **Subtracted w40** → `features/messaging/services/chat-state-store-legacy.ts` |
| `group-provider-legacy.tsx` | `group-provider-port` | workspace-kernel roster/groups authority |
| `use-sealed-community-legacy.ts` | `sealed-community-port` | community kernel owns sealed scope |
| `use-conversation-messages-legacy.ts` | `conversation-messages-legacy-port` | `useDmKernelThread` is sole hydrate path |
| `dm-conversation-hydrate-pipeline-legacy.ts` | `dm-conversation-hydrate-pipeline-port` | thread-history adapter never calls legacy pipeline |
| `native-dm-conversation-hydrate-owner-legacy.ts` | `native-dm-conversation-hydrate-port` | libobscur native hydrate replaces owner |
| `dm-read-authority-contract-legacy.ts` | `dm-read-authority-port` | dm-engine read authority is canonical |
| `dm-conversation-hydrate-read-model-legacy.ts` | `dm-thread-history-legacy-port` | dm-engine read model assembly |
| `dm-conversation-hydrate-indexed-scan-legacy.ts` | `dm-thread-history-legacy-port` | libobscur indexed scan |
| `dm-conversation-hydrate-indexed-map-rows-legacy.ts` | `dm-thread-history-legacy-port` | libobscur row mapping |
| `enhanced-relay-pool-legacy.ts` | `enhanced-relay-pool-port` | transport-engine pool is canonical |

**Subtracted (w27):** `relay-recovery-policy-legacy.ts` → `features/relays/services/relay-recovery-controller-legacy.ts` (transport-engine-w9 quarantine behind `relay-recovery-port`)

**Subtracted (w28):** projection evidence + live merge legacy → `thread-history/projection-{evidence-messages,live-merge}.ts`

**Subtracted (w29):** materialization load-earlier + realtime legacy → `thread-history/materialization-{load-earlier,realtime}.ts`

**Subtracted (w30):** `native-dm-thread-hydrate-legacy.ts` → `thread-history/native-dm-thread-hydrate.ts`

**Subtracted (w40):** `app/legacy/chat-state-store-legacy.ts` → `features/messaging/services/chat-state-store-legacy.ts` (final `app/legacy/` implementation)

**Legacy-internal edges**

Contract: `app/engine-lab/legacy-subtraction-w26.contract.test.ts`
