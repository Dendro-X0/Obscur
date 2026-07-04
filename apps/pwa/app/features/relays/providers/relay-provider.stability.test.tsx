import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { EnhancedRelayPoolResult } from "@/app/features/relays/hooks/enhanced-relay-pool-types";
import { createRelayRuntimeSupervisor } from "@/app/features/relays/services/relay-runtime-supervisor";
import { relayTransportJournal } from "@/app/features/relays/services/relay-transport-journal";
import { relayResilienceObservability } from "@/app/features/relays/services/relay-resilience-observability";
import {
  windowRuntimeSupervisor,
  windowRuntimeSupervisorInternals,
} from "@/app/features/runtime/services/window-runtime-supervisor";

const providersDir = dirname(fileURLToPath(import.meta.url));

const readProviderSource = (filename: string): string => (
  readFileSync(join(providersDir, filename), "utf8")
);

const createPool = (): EnhancedRelayPoolResult => ({
  connections: [{ url: "wss://relay.one", status: "open", updatedAtUnixMs: 1_000 }],
  healthMetrics: [],
  sendToOpen: vi.fn(),
  publishToUrl: vi.fn(),
  publishToUrls: vi.fn(),
  publishToRelay: vi.fn(),
  publishToAll: vi.fn(),
  broadcastEvent: vi.fn(),
  subscribeToMessages: vi.fn(() => () => {}),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  getRelayHealth: vi.fn(),
  getRelayCircuitState: vi.fn(() => "healthy" as const),
  canConnectToRelay: vi.fn(() => true),
  addTransientRelay: vi.fn(),
  removeTransientRelay: vi.fn(),
  reconnectRelay: vi.fn(),
  reconnectAll: vi.fn(),
  resubscribeAll: vi.fn(),
  recycle: vi.fn(async () => {}),
  isConnected: vi.fn(() => true),
  waitForConnection: vi.fn(async () => true),
  waitForScopedConnection: vi.fn(async () => true),
  getWritableRelaySnapshot: vi.fn(() => ({
    atUnixMs: 1_000,
    configuredRelayUrls: ["wss://relay.one"],
    writableRelayUrls: ["wss://relay.one"],
    totalRelayCount: 1,
    openRelayCount: 1,
    relayCircuitStates: { "wss://relay.one": "healthy" as const },
  })),
  getTransportActivitySnapshot: vi.fn(() => ({
    writableRelayCount: 1,
    subscribableRelayCount: 1,
    writeBlockedRelayCount: 0,
    coolingDownRelayCount: 0,
    fallbackRelayUrls: [],
    fallbackWritableRelayCount: 0,
  })),
  getActiveSubscriptionCount: vi.fn(() => 0),
  dispose: vi.fn(),
});

describe("STAB-R1 relay/window decoupling", () => {
  beforeEach(() => {
    windowRuntimeSupervisorInternals.resetForTests();
    relayTransportJournal.resetForTests();
    relayResilienceObservability.resetForTests(0);
  });

  it("relay runtime refresh does not emit window runtime subscribers", () => {
    let windowListenerCalls = 0;
    const unsubscribe = windowRuntimeSupervisor.subscribe(() => {
      windowListenerCalls += 1;
    });

    const relaySupervisor = createRelayRuntimeSupervisor();
    relaySupervisor.configure({
      pool: createPool(),
      enabledRelayUrls: ["wss://relay.one"],
      allEnabledRelayUrls: ["wss://relay.one", "wss://relay.two"],
      userEnabledRelayUrls: ["wss://relay.one", "wss://relay.two"],
      engineConfiguredRelayUrls: [],
      engineCheckpointRelayUrls: [],
      engineRelayCheckpointCount: 0,
      scope: {
        windowLabel: "main",
        profileId: "default",
        publicKeyHex: "a".repeat(64),
      },
    });

    const callsAfterSubscribe = windowListenerCalls;
    for (let index = 0; index < 40; index += 1) {
      relayTransportJournal.setPendingOutbound(`tick:${index}`, index);
      relaySupervisor.refresh();
    }

    expect(windowListenerCalls).toBe(callsAfterSubscribe);
    unsubscribe();
  });

  it("relay providers do not call syncRelayRuntime (source gate)", () => {
    expect(readProviderSource("relay-provider.tsx"))
      .not.toMatch(/syncRelayRuntime\s*\(/);
    expect(readProviderSource("experiment-relay-shell.tsx"))
      .not.toMatch(/syncRelayRuntime\s*\(/);
  });
});
