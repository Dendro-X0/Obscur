import { beforeEach, describe, expect, it, vi } from "vitest";
import { syncMissedMessages } from "./dm-sync-orchestrator";
import {
  getTimelineCheckpoint,
  resetTimelineCheckpointsForTests,
} from "../lib/sync-checkpoints";
import { logAppEvent } from "@/app/shared/log-app-event";

vi.mock("../lib/ui-performance", () => ({
  loadingStateManager: {
    setLoading: vi.fn(),
    complete: vi.fn(),
    updateProgress: vi.fn(),
  },
}));

vi.mock("@/app/features/settings/services/privacy-settings-service", () => ({
  PrivacySettingsService: {
    getSettings: vi.fn(() => ({
      reliabilityCoreV087: true,
    })),
  },
}));

vi.mock("@/app/shared/reliability-observability", () => ({
  incrementReliabilityMetric: vi.fn(),
  markReliabilitySyncCompleted: vi.fn(),
}));

vi.mock("@/app/shared/log-app-event", () => ({
  logAppEvent: vi.fn(),
}));

describe("dm-sync-orchestrator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-10T12:00:00Z"));
    resetTimelineCheckpointsForTests();
    vi.mocked(logAppEvent).mockClear();
  });

  const createPool = (openRelayCount = 1, totalRelayCount = openRelayCount) => {
    let handler: ((params: Readonly<{ url: string; message: string }>) => void) | undefined;
    const normalizedTotalRelayCount = Math.max(1, totalRelayCount);
    const normalizedOpenRelayCount = Math.min(Math.max(0, openRelayCount), normalizedTotalRelayCount);
    const connections = Array.from({ length: normalizedTotalRelayCount }, (_, index) => ({
      url: `wss://relay-${index + 1}.example`,
      status: index < normalizedOpenRelayCount ? "open" : "closed",
    }));
    return {
      pool: {
        connections,
        sendToOpen: vi.fn(),
        subscribeToMessages: vi.fn((nextHandler) => {
          handler = nextHandler;
          return () => {
            handler = undefined;
          };
        }),
      },
      emit(params: Readonly<{ url: string; message: string }>) {
        handler?.(params);
      },
    };
  };

  const getRequestCalls = (sendToOpen: ReturnType<typeof vi.fn>) =>
    vi.mocked(sendToOpen).mock.calls
      .map((call) => JSON.parse(call[0] as string))
      .filter((payload) => payload[0] === "REQ");

  it("requests inbound and self-authored DM filters during sync", async () => {
    const { pool } = createPool();
    const syncStateRef = {
      current: {
        isSyncing: false,
        lastSyncAt: undefined as Date | undefined,
        conversationTimestamps: new Map<string, Date>(),
      },
    };

    await syncMissedMessages({
      myPublicKeyHex: "receiver-pubkey" as never,
      messageQueue: {} as never,
      pool,
      syncStateRef,
      setState: vi.fn(),
    });

    const reqPayload = vi.mocked(pool.sendToOpen).mock.calls[0]?.[0] as string;
    const parsedReq = JSON.parse(reqPayload);
    const filters = parsedReq.slice(2) as ReadonlyArray<Record<string, unknown>>;
    expect(filters).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kinds: [4, 1059],
        "#p": ["receiver-pubkey"],
      }),
      expect.objectContaining({
        kinds: [4],
        authors: ["receiver-pubkey"],
      }),
    ]));
  });

  it("updates the checkpoint only after sync reaches EOSE", async () => {
    const { pool, emit } = createPool();
    const syncStateRef = {
      current: {
        isSyncing: false,
        lastSyncAt: undefined as Date | undefined,
        conversationTimestamps: new Map<string, Date>(),
      },
    };

    await syncMissedMessages({
      myPublicKeyHex: "receiver-pubkey" as never,
      messageQueue: {} as never,
      pool,
      syncStateRef,
      setState: vi.fn(),
    });

    const reqPayload = vi.mocked(pool.sendToOpen).mock.calls[0]?.[0] as string;
    const subId = JSON.parse(reqPayload)[1];

    emit({
      url: "wss://relay-1.example",
      message: JSON.stringify(["EVENT", subId, {
        id: "evt-1",
        created_at: 1_777_000_123,
      }]),
    });
    emit({
      url: "wss://relay-1.example",
      message: JSON.stringify(["EOSE", subId]),
    });

    const checkpoint = getTimelineCheckpoint("dm:all");
    expect(checkpoint?.lastProcessedAtUnixSeconds).toBe(1_777_000_123);
    expect(syncStateRef.current.isSyncing).toBe(false);
  });

  it("does not advance the checkpoint when sync times out", async () => {
    const { pool } = createPool();
    const syncStateRef = {
      current: {
        isSyncing: false,
        lastSyncAt: undefined as Date | undefined,
        conversationTimestamps: new Map<string, Date>(),
      },
    };

    await syncMissedMessages({
      myPublicKeyHex: "receiver-pubkey" as never,
      messageQueue: {} as never,
      pool,
      syncStateRef,
      setState: vi.fn(),
    });

    await vi.advanceTimersByTimeAsync(10_100);

    expect(getTimelineCheckpoint("dm:all")).toBeNull();
    expect(syncStateRef.current.isSyncing).toBe(false);
  });

  it("advances checkpoint from seen-event evidence when sync times out", async () => {
    const { pool, emit } = createPool();
    const syncStateRef = {
      current: {
        isSyncing: false,
        lastSyncAt: undefined as Date | undefined,
        conversationTimestamps: new Map<string, Date>(),
      },
    };

    await syncMissedMessages({
      myPublicKeyHex: "receiver-pubkey" as never,
      messageQueue: {} as never,
      pool,
      syncStateRef,
      setState: vi.fn(),
    });

    const reqPayload = vi.mocked(pool.sendToOpen).mock.calls[0]?.[0] as string;
    const subId = JSON.parse(reqPayload)[1];

    emit({
      url: "wss://relay-1.example",
      message: JSON.stringify(["EVENT", subId, {
        id: "evt-1",
        created_at: 1_777_000_100,
      }]),
    });
    emit({
      url: "wss://relay-1.example",
      message: JSON.stringify(["EVENT", subId, {
        id: "evt-2",
        created_at: 1_777_000_250,
      }]),
    });

    await vi.advanceTimersByTimeAsync(10_100);

    const checkpoint = getTimelineCheckpoint("dm:all");
    expect(checkpoint?.lastProcessedAtUnixSeconds).toBe(1_777_000_250);
    expect(syncStateRef.current.isSyncing).toBe(false);
  });

  it("holds the checkpoint at the requested frontier when EOSE arrives without events", async () => {
    const { pool, emit } = createPool();
    const frontier = new Date("2026-03-10T11:50:00Z");
    const syncStateRef = {
      current: {
        isSyncing: false,
        lastSyncAt: undefined as Date | undefined,
        conversationTimestamps: new Map<string, Date>([["dm:peer-a", frontier]]),
      },
    };

    await syncMissedMessages({
      myPublicKeyHex: "receiver-pubkey" as never,
      messageQueue: {} as never,
      pool,
      syncStateRef,
      setState: vi.fn(),
    });

    const reqPayload = vi.mocked(pool.sendToOpen).mock.calls[0]?.[0] as string;
    const subId = JSON.parse(reqPayload)[1];

    emit({
      url: "wss://relay-1.example",
      message: JSON.stringify(["EOSE", subId]),
    });

    const checkpoint = getTimelineCheckpoint("dm:all");
    expect(checkpoint?.lastProcessedAtUnixSeconds).toBe(Math.floor(frontier.getTime() / 1000));
  });

  it("uses a replay overlap for automatic sync without regressing checkpoint frontier", async () => {
    const { pool, emit } = createPool();
    const frontier = new Date("2026-03-10T11:59:30Z");
    const syncStateRef = {
      current: {
        isSyncing: false,
        lastSyncAt: undefined as Date | undefined,
        conversationTimestamps: new Map<string, Date>([["dm:peer-a", frontier]]),
      },
    };

    await syncMissedMessages({
      myPublicKeyHex: "receiver-pubkey" as never,
      messageQueue: {} as never,
      pool,
      syncStateRef,
      setState: vi.fn(),
    });

    const reqPayload = vi.mocked(pool.sendToOpen).mock.calls[0]?.[0] as string;
    const parsedReq = JSON.parse(reqPayload);
    expect(parsedReq[2].since).toBe(Math.floor(frontier.getTime() / 1000) - 120);
    const subId = parsedReq[1];

    emit({
      url: "wss://relay-1.example",
      message: JSON.stringify(["EOSE", subId]),
    });

    const checkpoint = getTimelineCheckpoint("dm:all");
    expect(checkpoint?.lastProcessedAtUnixSeconds).toBe(Math.floor(frontier.getTime() / 1000));
  });

  it("keeps manual sync requests exact without replay overlap", async () => {
    const { pool } = createPool();
    const syncStateRef = {
      current: {
        isSyncing: false,
        lastSyncAt: undefined as Date | undefined,
        conversationTimestamps: new Map<string, Date>(),
      },
    };
    const manualSince = new Date("2026-03-10T11:00:00Z");

    await syncMissedMessages({
      myPublicKeyHex: "receiver-pubkey" as never,
      messageQueue: {} as never,
      pool,
      syncStateRef,
      setState: vi.fn(),
    }, manualSince);

    const reqPayload = vi.mocked(pool.sendToOpen).mock.calls[0]?.[0] as string;
    const parsedReq = JSON.parse(reqPayload);
    expect(parsedReq[2].since).toBe(Math.floor(manualSince.getTime() / 1000));
  });

  it("uses full-history defaults for cold-start automatic sync", async () => {
    const { pool } = createPool();
    const syncStateRef = {
      current: {
        isSyncing: false,
        lastSyncAt: undefined as Date | undefined,
        conversationTimestamps: new Map<string, Date>(),
      },
    };

    await syncMissedMessages({
      myPublicKeyHex: "receiver-pubkey" as never,
      messageQueue: {} as never,
      pool,
      syncStateRef,
      setState: vi.fn(),
    });

    const reqPayload = vi.mocked(pool.sendToOpen).mock.calls[0]?.[0] as string;
    const parsedReq = JSON.parse(reqPayload);
    expect(parsedReq[2].since).toBe(0);
    expect(parsedReq[2].limit).toBe(1000);
  });

  it("marks partial cold-start relay coverage so churn recovery can request full-history backfill later", async () => {
    const { pool, emit } = createPool(1, 3);
    const syncStateRef = {
      current: {
        isSyncing: false,
        lastSyncAt: undefined as Date | undefined,
        conversationTimestamps: new Map<string, Date>(),
        coldStartPartialCoverageDetected: false,
        coldStartHistoricalBackfillRelayCount: null as number | null,
      },
    };

    await syncMissedMessages({
      myPublicKeyHex: "receiver-pubkey" as never,
      messageQueue: {} as never,
      pool,
      syncStateRef,
      setState: vi.fn(),
    });

    const reqPayload = vi.mocked(pool.sendToOpen).mock.calls[0]?.[0] as string;
    const subId = JSON.parse(reqPayload)[1];

    emit({
      url: "wss://relay-1.example",
      message: JSON.stringify(["EOSE", subId]),
    });

    expect(syncStateRef.current.coldStartPartialCoverageDetected).toBe(true);
    expect(syncStateRef.current.coldStartHistoricalBackfillRelayCount).toBe(1);
  });

  it("routes matched sync events through the incoming event handler", async () => {
    const { pool, emit } = createPool();
    const onIncomingEvent = vi.fn();
    const syncStateRef = {
      current: {
        isSyncing: false,
        lastSyncAt: undefined as Date | undefined,
        conversationTimestamps: new Map<string, Date>(),
      },
    };

    await syncMissedMessages({
      myPublicKeyHex: "receiver-pubkey" as never,
      messageQueue: {} as never,
      pool,
      syncStateRef,
      setState: vi.fn(),
      onIncomingEvent,
    });

    const reqPayload = vi.mocked(pool.sendToOpen).mock.calls[0]?.[0] as string;
    const subId = JSON.parse(reqPayload)[1];

    emit({
      url: "wss://relay-1.example",
      message: JSON.stringify(["EVENT", "other-sub", { id: "ignored", created_at: 123 }]),
    });
    emit({
      url: "wss://relay-1.example",
      message: JSON.stringify(["EVENT", subId, { id: "evt-2", created_at: 456 }]),
    });

    expect(onIncomingEvent).toHaveBeenCalledTimes(1);
    expect(onIncomingEvent).toHaveBeenCalledWith(
      expect.objectContaining({ id: "evt-2", created_at: 456 }),
      "wss://relay-1.example",
      "relay_sync",
    );
  });

  it("allows separate runtime instances to sync concurrently", async () => {
    const runtimeA = createPool();
    const runtimeB = createPool();
    const syncStateRefA = {
      current: {
        isSyncing: false,
        lastSyncAt: undefined as Date | undefined,
        conversationTimestamps: new Map<string, Date>(),
      },
    };
    const syncStateRefB = {
      current: {
        isSyncing: false,
        lastSyncAt: undefined as Date | undefined,
        conversationTimestamps: new Map<string, Date>(),
      },
    };

    await Promise.all([
      syncMissedMessages({
        myPublicKeyHex: "receiver-a" as never,
        messageQueue: {} as never,
        pool: runtimeA.pool,
        syncStateRef: syncStateRefA,
        setState: vi.fn(),
      }),
      syncMissedMessages({
        myPublicKeyHex: "receiver-b" as never,
        messageQueue: {} as never,
        pool: runtimeB.pool,
        syncStateRef: syncStateRefB,
        setState: vi.fn(),
      }),
    ]);

    expect(vi.mocked(runtimeA.pool.sendToOpen)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(runtimeB.pool.sendToOpen)).toHaveBeenCalledTimes(1);
    expect(syncStateRefA.current.isSyncing).toBe(true);
    expect(syncStateRefB.current.isSyncing).toBe(true);
  });

  it("completes sync when EOSE quorum is reached without waiting for all start-open relays", async () => {
    const { pool, emit } = createPool(2);
    const syncStateRef = {
      current: {
        isSyncing: false,
        lastSyncAt: undefined as Date | undefined,
        conversationTimestamps: new Map<string, Date>(),
      },
    };

    await syncMissedMessages({
      myPublicKeyHex: "receiver-pubkey" as never,
      messageQueue: {} as never,
      pool,
      syncStateRef,
      setState: vi.fn(),
    });

    const reqPayload = vi.mocked(pool.sendToOpen).mock.calls[0]?.[0] as string;
    const subId = JSON.parse(reqPayload)[1];

    emit({
      url: "wss://relay-1.example",
      message: JSON.stringify(["EOSE", subId]),
    });

    expect(syncStateRef.current.isSyncing).toBe(false);
    expect(vi.mocked(logAppEvent)).toHaveBeenCalledWith(expect.objectContaining({
      name: "messaging.transport.sync_timing",
      context: expect.objectContaining({
        status: "completed",
        eoseRelayCount: 1,
        eoseQuorumRequired: 1,
        reason: "eose_quorum_reached",
      }),
    }));
    expect(vi.mocked(pool.sendToOpen)).toHaveBeenCalledWith(
      JSON.stringify(["CLOSE", subId])
    );
  });

  it("emits sync timing diagnostics for timeout runs that still saw events", async () => {
    const { pool, emit } = createPool();
    const syncStateRef = {
      current: {
        isSyncing: false,
        lastSyncAt: undefined as Date | undefined,
        conversationTimestamps: new Map<string, Date>(),
      },
    };

    await syncMissedMessages({
      myPublicKeyHex: "receiver-pubkey" as never,
      messageQueue: {} as never,
      pool,
      syncStateRef,
      setState: vi.fn(),
    });

    const reqPayload = vi.mocked(pool.sendToOpen).mock.calls[0]?.[0] as string;
    const subId = JSON.parse(reqPayload)[1];

    emit({
      url: "wss://relay-1.example",
      message: JSON.stringify(["EVENT", subId, {
        id: "evt-timeout-1",
        created_at: 1_777_000_333,
      }]),
    });

    await vi.advanceTimersByTimeAsync(10_100);

    expect(vi.mocked(logAppEvent)).toHaveBeenCalledWith(expect.objectContaining({
      name: "messaging.transport.sync_timing",
      context: expect.objectContaining({
        status: "timed_out",
        timedOutWithEvents: true,
        syncedCount: 1,
      }),
    }));
  });

  it("paginates cold-start replay when first pass saturates the sync limit", async () => {
    const { pool, emit } = createPool();
    const syncStateRef = {
      current: {
        isSyncing: false,
        lastSyncAt: undefined as Date | undefined,
        conversationTimestamps: new Map<string, Date>(),
      },
    };

    await syncMissedMessages({
      myPublicKeyHex: "receiver-pubkey" as never,
      messageQueue: {} as never,
      pool,
      syncStateRef,
      setState: vi.fn(),
    });

    const firstReqPayload = vi.mocked(pool.sendToOpen).mock.calls[0]?.[0] as string;
    const firstReq = JSON.parse(firstReqPayload);
    const firstSubId = firstReq[1];

    for (let index = 0; index < 1000; index += 1) {
      emit({
        url: "wss://relay-1.example",
        message: JSON.stringify(["EVENT", firstSubId, {
          id: `evt-page-1-${index}`,
          created_at: 2_000 - index,
        }]),
      });
    }
    emit({
      url: "wss://relay-1.example",
      message: JSON.stringify(["EOSE", firstSubId]),
    });

    expect(syncStateRef.current.isSyncing).toBe(true);
    const secondReqPayload = vi.mocked(pool.sendToOpen).mock.calls[2]?.[0] as string;
    const secondReq = JSON.parse(secondReqPayload);
    expect(secondReq[0]).toBe("REQ");
    expect(secondReq[2].until).toBe(1000);

    const secondSubId = secondReq[1];
    emit({
      url: "wss://relay-1.example",
      message: JSON.stringify(["EOSE", secondSubId]),
    });

    expect(syncStateRef.current.isSyncing).toBe(false);
    expect(vi.mocked(logAppEvent)).toHaveBeenCalledWith(expect.objectContaining({
      name: "messaging.transport.sync_pagination_pass",
      context: expect.objectContaining({
        passNumber: 2,
      }),
    }));
  });

  it("keeps paginating with a stable cursor when relay returns duplicate windows", async () => {
    const { pool, emit } = createPool();
    const syncStateRef = {
      current: {
        isSyncing: false,
        lastSyncAt: undefined as Date | undefined,
        conversationTimestamps: new Map<string, Date>(),
      },
    };

    await syncMissedMessages({
      myPublicKeyHex: "receiver-pubkey" as never,
      messageQueue: {} as never,
      pool,
      syncStateRef,
      setState: vi.fn(),
    });

    const firstReqPayload = vi.mocked(pool.sendToOpen).mock.calls[0]?.[0] as string;
    const firstSubId = JSON.parse(firstReqPayload)[1];
    for (let index = 0; index < 1000; index += 1) {
      emit({
        url: "wss://relay-1.example",
        message: JSON.stringify(["EVENT", firstSubId, {
          id: `evt-stalled-1-${index}`,
          created_at: 2_000,
        }]),
      });
    }
    emit({
      url: "wss://relay-1.example",
      message: JSON.stringify(["EOSE", firstSubId]),
    });

    const secondReq = getRequestCalls(pool.sendToOpen)[1];
    const secondSubId = secondReq[1];
    expect(secondReq[2].until).toBe(1_999);

    for (let index = 0; index < 1000; index += 1) {
      emit({
        url: "wss://relay-1.example",
        message: JSON.stringify(["EVENT", secondSubId, {
          id: `evt-stalled-2-${index}`,
          created_at: 2_000,
        }]),
      });
    }
    emit({
      url: "wss://relay-1.example",
      message: JSON.stringify(["EOSE", secondSubId]),
    });

    const thirdReq = getRequestCalls(pool.sendToOpen)[2];
    expect(thirdReq[2].until).toBe(secondReq[2].until);

    emit({
      url: "wss://relay-1.example",
      message: JSON.stringify(["EOSE", thirdReq[1]]),
    });

    expect(syncStateRef.current.isSyncing).toBe(false);
  });

  it("stops cold-start pagination at max pass count even if each pass saturates the limit", async () => {
    const { pool, emit } = createPool();
    const syncStateRef = {
      current: {
        isSyncing: false,
        lastSyncAt: undefined as Date | undefined,
        conversationTimestamps: new Map<string, Date>(),
      },
    };

    await syncMissedMessages({
      myPublicKeyHex: "receiver-pubkey" as never,
      messageQueue: {} as never,
      pool,
      syncStateRef,
      setState: vi.fn(),
    });

    for (let pass = 1; pass <= 5; pass += 1) {
      const requestCall = getRequestCalls(pool.sendToOpen)[pass - 1];
      const subId = requestCall[1];
      const createdAtBase = 10_000 - ((pass - 1) * 1_000);
      for (let index = 0; index < 1000; index += 1) {
        emit({
          url: "wss://relay-1.example",
          message: JSON.stringify(["EVENT", subId, {
            id: `evt-max-pass-${pass}-${index}`,
            created_at: createdAtBase - index,
          }]),
        });
      }
      emit({
        url: "wss://relay-1.example",
        message: JSON.stringify(["EOSE", subId]),
      });
    }

    const requestCalls = getRequestCalls(pool.sendToOpen);
    expect(requestCalls).toHaveLength(5);
    expect(syncStateRef.current.isSyncing).toBe(false);
    expect(vi.mocked(logAppEvent)).toHaveBeenCalledWith(expect.objectContaining({
      name: "messaging.transport.sync_timing",
      context: expect.objectContaining({
        status: "completed",
        paginationPassCount: 5,
      }),
    }));
  });

  it("emits timed-out diagnostics when a paginated pass times out", async () => {
    const { pool, emit } = createPool();
    const syncStateRef = {
      current: {
        isSyncing: false,
        lastSyncAt: undefined as Date | undefined,
        conversationTimestamps: new Map<string, Date>(),
      },
    };

    await syncMissedMessages({
      myPublicKeyHex: "receiver-pubkey" as never,
      messageQueue: {} as never,
      pool,
      syncStateRef,
      setState: vi.fn(),
    });

    const firstReqPayload = vi.mocked(pool.sendToOpen).mock.calls[0]?.[0] as string;
    const firstSubId = JSON.parse(firstReqPayload)[1];
    for (let index = 0; index < 1000; index += 1) {
      emit({
        url: "wss://relay-1.example",
        message: JSON.stringify(["EVENT", firstSubId, {
          id: `evt-timeout-pass1-${index}`,
          created_at: 2_000 - index,
        }]),
      });
    }
    emit({
      url: "wss://relay-1.example",
      message: JSON.stringify(["EOSE", firstSubId]),
    });

    const secondReq = getRequestCalls(pool.sendToOpen)[1];
    const secondSubId = secondReq[1];
    emit({
      url: "wss://relay-1.example",
      message: JSON.stringify(["EVENT", secondSubId, {
        id: "evt-timeout-pass2",
        created_at: 900,
      }]),
    });

    await vi.advanceTimersByTimeAsync(10_100);

    expect(syncStateRef.current.isSyncing).toBe(false);
    expect(getTimelineCheckpoint("dm:all")?.lastProcessedAtUnixSeconds).toBe(2_000);
    expect(vi.mocked(logAppEvent)).toHaveBeenCalledWith(expect.objectContaining({
      name: "messaging.transport.sync_timing",
      context: expect.objectContaining({
        status: "timed_out",
        timedOutWithEvents: true,
        paginationPassCount: 2,
      }),
    }));
  });
});
