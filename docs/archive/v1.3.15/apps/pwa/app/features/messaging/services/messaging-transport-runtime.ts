"use client";

import { logAppEvent } from "@/app/shared/log-app-event";
import { windowRuntimeSupervisor } from "@/app/features/runtime/services/window-runtime-supervisor";
import type { MessagingTransportRuntimeSnapshot } from "@/app/features/runtime/services/window-runtime-contracts";

type ControllerRegistration = Readonly<{
  controllerInstanceId: string;
  transportOwnerId: string | null;
}>;

const activeIncomingOwners = new Map<string, ControllerRegistration>();
const activeQueueProcessors = new Map<string, ControllerRegistration>();

const buildSnapshot = (): MessagingTransportRuntimeSnapshot => ({
  activeIncomingOwnerCount: activeIncomingOwners.size,
  activeQueueProcessorCount: activeQueueProcessors.size,
  updatedAtUnixMs: Date.now(),
});

const syncSnapshot = (): void => {
  const nextSnapshot = buildSnapshot();
  windowRuntimeSupervisor.syncMessagingTransportRuntime(nextSnapshot);
  const shouldWarnInvariant =
    nextSnapshot.activeIncomingOwnerCount > 1
    || nextSnapshot.activeQueueProcessorCount > 1
    || (nextSnapshot.activeIncomingOwnerCount === 0 && nextSnapshot.activeQueueProcessorCount > 0);
  logAppEvent({
    name: "messaging.transport.runtime_invariant",
    level: shouldWarnInvariant ? "warn" : "info",
    scope: { feature: "messaging", action: "transport_runtime" },
    context: {
      activeIncomingOwnerCount: nextSnapshot.activeIncomingOwnerCount,
      activeQueueProcessorCount: nextSnapshot.activeQueueProcessorCount,
    },
  });
};

export const messagingTransportRuntime = {
  registerIncomingOwner(params: Readonly<{
    controllerInstanceId: string;
    transportOwnerId: string | null;
  }>): void {
    activeIncomingOwners.set(params.controllerInstanceId, {
      controllerInstanceId: params.controllerInstanceId,
      transportOwnerId: params.transportOwnerId,
    });
    logAppEvent({
      name: "messaging.transport.incoming_owner_registered",
      level: "info",
      scope: { feature: "messaging", action: "transport_runtime" },
      context: {
        controllerInstanceId: params.controllerInstanceId,
        transportOwnerId: params.transportOwnerId ?? "none",
      },
    });
    syncSnapshot();
  },
  unregisterIncomingOwner(controllerInstanceId: string): void {
    if (!activeIncomingOwners.delete(controllerInstanceId)) {
      return;
    }
    logAppEvent({
      name: "messaging.transport.incoming_owner_unregistered",
      level: "info",
      scope: { feature: "messaging", action: "transport_runtime" },
      context: {
        controllerInstanceId,
      },
    });
    syncSnapshot();
  },
  registerQueueProcessor(params: Readonly<{
    controllerInstanceId: string;
    transportOwnerId: string | null;
  }>): void {
    activeQueueProcessors.set(params.controllerInstanceId, {
      controllerInstanceId: params.controllerInstanceId,
      transportOwnerId: params.transportOwnerId,
    });
    logAppEvent({
      name: "messaging.transport.queue_processor_registered",
      level: "info",
      scope: { feature: "messaging", action: "transport_runtime" },
      context: {
        controllerInstanceId: params.controllerInstanceId,
        transportOwnerId: params.transportOwnerId ?? "none",
      },
    });
    syncSnapshot();
  },
  unregisterQueueProcessor(controllerInstanceId: string): void {
    if (!activeQueueProcessors.delete(controllerInstanceId)) {
      return;
    }
    logAppEvent({
      name: "messaging.transport.queue_processor_unregistered",
      level: "info",
      scope: { feature: "messaging", action: "transport_runtime" },
      context: {
        controllerInstanceId,
      },
    });
    syncSnapshot();
  },
  getSnapshot(): MessagingTransportRuntimeSnapshot {
    return buildSnapshot();
  },
  resetForTests(): void {
    activeIncomingOwners.clear();
    activeQueueProcessors.clear();
    syncSnapshot();
  },
};
