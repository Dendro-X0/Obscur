import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useConversationMessages } from "./use-conversation-messages";
import * as dmConversationHydrateIndexedScan from "../services/dm-conversation-hydrate-indexed-scan";
import type { Message } from "../types";
import { PrivacySettingsService, defaultPrivacySettings } from "../../settings/services/privacy-settings-service";
import { performanceMonitor } from "../lib/performance-monitor";
import { dbGetMessages } from "@dweb/db";
import { messagingDB } from "@dweb/storage/indexed-db";
import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";
import { clearMessageDeleteTombstones } from "../services/message-delete-tombstone-store";
import { resetDmRedactionDisplayGateForTests } from "../services/dm-redaction-display-gate";
import { resetDmThreadDisplayCacheForTests } from "../services/dm-thread-display-cache";
import { setProfileRuntimeScope } from "@/app/features/profiles/services/profile-runtime-scope";
import { buildAppClientGateway } from "@/app/features/runtime/services/client-gateway-adapter";
import { getResolvedStoragePorts } from "@/app/features/profiles/services/default-storage-ports";

const myPublicKeyHex = "a".repeat(64);
const peerPublicKeyHex = "b".repeat(64);
const conversationId = [myPublicKeyHex, peerPublicKeyHex].sort().join(":");

const conversationMessagesTestBus = vi.hoisted(() => {
  const { createProfileMessageBus } =
    require("@dweb/core/profile-message-bus") as typeof import("@dweb/core/profile-message-bus");
  return createProfileMessageBus({ profileId: "default" });
});

vi.mock("@dweb/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@dweb/db")>();
  return {
    ...actual,
    dbGetMessages: vi.fn(async () => []),
  };
});

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: vi.fn(() => true),
}));

vi.mock("@dweb/storage/indexed-db", () => ({
  messagingDB: {
    getAllByIndex: vi.fn(async () => []),
  },
}));

vi.mock("@/app/features/account-sync/hooks/use-account-projection-snapshot", () => ({
  useAccountProjectionSnapshot: () => ({
    profileId: "default",
    accountPublicKeyHex: myPublicKeyHex,
    projection: null,
    phase: "ready",
    status: "ready",
    accountProjectionReady: true,
    driftStatus: "clean",
    updatedAtUnixMs: Date.now(),
  }),
}));

vi.mock("@/app/features/account-sync/services/account-sync-migration-policy", () => ({
  getAccountSyncMigrationPolicy: () => ({
    phase: "shadow",
    rollbackEnabled: true,
    updatedAtUnixMs: Date.now(),
  }),
}));

vi.mock("../services/chat-state-store", () => ({
  CHAT_STATE_REPLACED_EVENT: "obscur:chat-state-replaced",
  chatStateStoreService: { load: vi.fn(() => null) },
}));

vi.mock("@/app/features/profiles/providers/profile-runtime-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/features/profiles/providers/profile-runtime-provider")>();
  const { getResolvedStoragePorts } = await import("@/app/features/profiles/services/default-storage-ports");
  const { getResolvedClientGateway } = await import("@/app/features/profiles/services/resolve-client-gateway");
  return {
    ...actual,
    useOptionalProfileMessageBus: () => conversationMessagesTestBus,
    useOptionalProfileRuntime: () => ({
      profileId: "default",
      bus: conversationMessagesTestBus,
      storagePorts: getResolvedStoragePorts(),
      clientGateway: getResolvedClientGateway(),
    }),
  };
});

vi.mock("@/app/shared/log-app-event", () => ({
  logAppEvent: vi.fn(),
}));

const indexedRowToSqliteRecord = (
  row: Readonly<Record<string, unknown>>,
): Record<string, unknown> => ({
  event_id: typeof row.eventId === "string" ? row.eventId : (typeof row.id === "string" ? row.id : ""),
  conversation_id: typeof row.conversationId === "string" ? row.conversationId : conversationId,
  plaintext: typeof row.content === "string" ? row.content : "",
  sender_pubkey: typeof row.senderPubkey === "string" ? row.senderPubkey : peerPublicKeyHex,
  recipient_pubkey: typeof row.recipientPubkey === "string" ? row.recipientPubkey : myPublicKeyHex,
  is_outgoing: row.isOutgoing === true,
  kind: typeof row.kind === "string" ? row.kind : "user",
  received_at: Number(row.timestampMs ?? 0),
});

const toMessage = (index: number): Message => ({
  id: `msg-${index}`,
  kind: "user",
  content: `body-${index}`,
  timestamp: new Date(index * 1_000),
  isOutgoing: index % 2 === 0,
  status: "delivered",
  conversationId,
  senderPubkey: index % 2 === 0 ? myPublicKeyHex : peerPublicKeyHex,
  recipientPubkey: index % 2 === 0 ? peerPublicKeyHex : myPublicKeyHex,
});

describe("useConversationMessages monotonic hydrate (Phase A)", () => {
  beforeEach(() => {
    vi.spyOn(PrivacySettingsService, "getSettings").mockReturnValue({
      ...defaultPrivacySettings,
      chatPerformanceV2: true,
    });
    vi.spyOn(performanceMonitor, "isEnabled").mockReturnValue(false);
    clearMessageDeleteTombstones();
    resetDmRedactionDisplayGateForTests();
    resetDmThreadDisplayCacheForTests();
    window.localStorage.clear();
    setProfileRuntimeScope({
      profileId: "default",
      bus: conversationMessagesTestBus,
      clientGateway: buildAppClientGateway({
        profileId: "default",
        storagePorts: getResolvedStoragePorts(),
      }),
    });
    vi.mocked(requiresSqlitePersistence).mockReturnValue(true);
    vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback): number => (
      setTimeout(() => cb(performance.now()), 0) as unknown as number
    ));
    vi.stubGlobal("cancelAnimationFrame", (id: number): void => {
      clearTimeout(id as unknown as ReturnType<typeof setTimeout>);
    });
    vi.stubGlobal("IDBKeyRange", {
      bound: (lower: ReadonlyArray<unknown>, upper: ReadonlyArray<unknown>) => ({ lower, upper }),
    });

    const allRows = Array.from({ length: 400 }, (_, index) => ({
      id: `msg-${index + 1}`,
      conversationId,
      senderPubkey: index % 2 === 0 ? myPublicKeyHex : peerPublicKeyHex,
      recipientPubkey: index % 2 === 0 ? peerPublicKeyHex : myPublicKeyHex,
      content: `body-${index + 1}`,
      timestampMs: (index + 1) * 1_000,
      isOutgoing: index % 2 === 0,
      status: "delivered",
      kind: "user",
    }));

    vi.mocked(messagingDB.getAllByIndex).mockImplementation(async (_store, _index, range: any) => {
      const upperTimestampMs = Number(range?.upper?.[1] ?? Number.NaN);
      const filtered = allRows.filter((row) => row.timestampMs <= upperTimestampMs);
      const sorted = [...filtered].sort((left, right) => right.timestampMs - left.timestampMs);
      return sorted.slice(0, 200) as any;
    });

    vi.mocked(dbGetMessages).mockImplementation(async (
      _profileId,
      _conversationId,
      limit,
      beforeTimestampMs,
    ) => {
      const upperTimestampMs = typeof beforeTimestampMs === "number"
        ? Math.max(0, beforeTimestampMs - 1)
        : Number.MAX_SAFE_INTEGER;
      const filtered = allRows.filter((row) => row.timestampMs <= upperTimestampMs);
      const sorted = [...filtered].sort((left, right) => right.timestampMs - left.timestampMs);
      return sorted
        .slice(0, Math.max(1, limit ?? 200))
        .map((row) => indexedRowToSqliteRecord(row)) as Awaited<ReturnType<typeof dbGetMessages>>;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keeps expanded thread depth after messages-index-rebuilt re-hydrate", async () => {
    const cappedHydrated = Array.from({ length: 200 }, (_, index) => toMessage(201 + index));
    const hydrateSpy = vi.spyOn(dmConversationHydrateIndexedScan, "loadInitialDmHydrationIndexedWindow");

    const { result, unmount } = renderHook(() => useConversationMessages(conversationId, myPublicKeyHex));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() => expect(result.current.messages.length).toBe(200), { timeout: 3_000 });

    await act(async () => {
      await result.current.loadEarlier();
    });
    await waitFor(() => expect(result.current.messages.length).toBe(400), { timeout: 3_000 });

    hydrateSpy.mockResolvedValueOnce({
      retentionFilteredMapped: cappedHydrated,
      cappedHydratedMessages: cappedHydrated,
      hasEarlier: true,
      shouldCapHydratedHistoryWindow: true,
    });

    act(() => {
      conversationMessagesTestBus.publish({
        type: "messages-index-rebuilt",
        detail: {
          publicKeyHex: myPublicKeyHex,
          profileId: "default",
          messageCount: 400,
        },
      });
    });

    await waitFor(() => expect(result.current.messages.length).toBe(400), { timeout: 3_000 });
    expect(result.current.messages[0]?.id).toBe("msg-1");
    expect(result.current.messages[399]?.id).toBe("msg-400");
    unmount();
  });
});
