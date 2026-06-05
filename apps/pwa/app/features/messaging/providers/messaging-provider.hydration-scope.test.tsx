import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import { setProfileRuntimeScope } from "@/app/features/profiles/services/profile-runtime-scope";
import { MessagingProvider, useMessaging } from "./messaging-provider";
const identityState = vi.hoisted(() => ({
  publicKeyHex: "a".repeat(64) as string | null,
}));

const profileScopeState = vi.hoisted(() => ({
  activeProfileId: "default",
}));

const chatStateStoreMocks = vi.hoisted(() => ({
  load: vi.fn(),
  replace: vi.fn(),
  updateConnections: vi.fn(),
  updateUnreadCounts: vi.fn(),
  updateConnectionOverrides: vi.fn(),
  updatePinnedChats: vi.fn(),
  updateHiddenChats: vi.fn(),
  deleteConversationMessages: vi.fn(),
}));

const messagingDbMocks = vi.hoisted(() => ({
  get: vi.fn(),
}));

const projectionSidebarState = vi.hoisted(() => ({
  useProjectionReads: false,
  projectionConnections: [] as Array<{
    kind: "dm";
    id: string;
    displayName: string;
    pubkey: string;
    lastMessage: string;
    unreadCount: number;
    lastMessageTime: Date;
  }>,
}));

const telemetryMocks = vi.hoisted(() => ({
  logAppEvent: vi.fn(),
}));

const nativeRuntimeMocks = vi.hoisted(() => ({
  isNative: false,
  sqliteConversations: [] as Array<{
    id: string;
    profile_id: string;
    peer_pubkey: string;
    last_event_id: string | null;
    last_message_at: number | null;
    last_plaintext_preview: string | null;
    unread_count: number;
  }>,
}));

vi.mock("@/app/features/runtime/runtime-capabilities", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/features/runtime/runtime-capabilities")>();
  return {
    ...actual,
    hasNativeRuntime: () => nativeRuntimeMocks.isNative,
  };
});

vi.mock("@dweb/db", () => ({
  isTauri: () => nativeRuntimeMocks.isNative,
  dbGetConversations: vi.fn(async () => nativeRuntimeMocks.sqliteConversations),
}));

vi.mock("../../auth/hooks/use-identity", () => ({
  useIdentity: () => ({
    state: {
      publicKeyHex: identityState.publicKeyHex,
      stored: null,
    },
  }),
}));

vi.mock("@/app/features/profiles/services/profile-scope", () => ({
  readRegistryBackedActiveProfileId: () => profileScopeState.activeProfileId,
  getProfileScopeOverride: () => null,
  setProfileScopeOverride: vi.fn(),
  getScopedStorageKey: (baseKey: string, profileId?: string) =>
    `${baseKey}::${profileId ?? profileScopeState.activeProfileId}`,
}));

vi.mock("@/app/features/account-sync/hooks/use-account-projection-snapshot", () => ({
  useAccountProjectionSnapshot: () => ({
    projection: null,
  }),
}));

vi.mock("@/app/features/account-sync/services/account-projection-read-authority", () => ({
  resolveProjectionReadAuthority: () => ({
    useProjectionReads: projectionSidebarState.useProjectionReads,
  }),
}));

vi.mock("@/app/features/account-sync/services/account-projection-selectors", () => ({
  selectProjectionDmConversations: () => projectionSidebarState.projectionConnections,
}));

vi.mock("@/app/shared/log-app-event", () => ({
  logAppEvent: telemetryMocks.logAppEvent,
}));

vi.mock("../services/chat-state-store", () => ({
  CHAT_STATE_REPLACED_EVENT: "obscur:chat-state-replaced",
  chatStateStoreService: chatStateStoreMocks,
}));

vi.mock("@dweb/storage/indexed-db", () => ({
  messagingDB: messagingDbMocks,
}));

vi.mock("../services/message-persistence-service", () => ({
  messagePersistenceService: {
    init: vi.fn(),
    migrateFromLegacy: vi.fn(),
    bindProfileBusChatStateReplaced: vi.fn(),
  },
}));

vi.mock("../services/message-bus", () => ({
  messageBus: {
    emit: vi.fn(),
    subscribe: vi.fn(() => () => undefined),
  },
}));

const hydrationBusRuntime = vi.hoisted(() => {
  const { createProfileMessageBus } =
    require("@dweb/core/profile-message-bus") as typeof import("@dweb/core/profile-message-bus");
  const api = {
    bus: createProfileMessageBus({ profileId: "default" }),
    syncRuntime(profileId: string) {
      api.bus = createProfileMessageBus({ profileId });
      setProfileRuntimeScope({ profileId, bus: api.bus });
    },
  };
  return api;
});

vi.mock("@/app/features/profiles/providers/profile-runtime-provider", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/features/profiles/providers/profile-runtime-provider")>();
  return {
    ...actual,
    useOptionalProfileMessageBus: () => hydrationBusRuntime.bus,
  };
});

const buildPersistedState = (params: Readonly<{ displayName: string; peerPublicKeyHex: string }>) => ({
  version: 2,
  createdConnections: [
    {
      id: `dm-${params.displayName.toLowerCase().replaceAll(" ", "-")}`,
      displayName: params.displayName,
      pubkey: params.peerPublicKeyHex,
      lastMessage: "",
      unreadCount: 0,
      lastMessageTimeMs: 1,
    },
  ],
  createdGroups: [],
  unreadByConversationId: {},
  connectionOverridesByConnectionId: {},
  messagesByConversationId: {},
  groupMessages: {},
  connectionRequests: [],
  pinnedChatIds: [],
  hiddenChatIds: [],
});

const Harness = (): React.JSX.Element => {
  const messaging = useMessaging();
  return (
    <div>
      <div data-testid="hydrated">{String(messaging.hasHydrated)}</div>
      <div data-testid="connections">
        {messaging.createdConnections.map((connection) => connection.displayName).join("|")}
      </div>
      <div data-testid="pinned">{messaging.pinnedChatIds.join("|")}</div>
      <div data-testid="hidden">{messaging.hiddenChatIds.join("|")}</div>
    </div>
  );
};

describe("messaging-provider hydration scope resets", () => {
  beforeEach(() => {
    identityState.publicKeyHex = "a".repeat(64);
    profileScopeState.activeProfileId = "default";
    hydrationBusRuntime.syncRuntime("default");
    chatStateStoreMocks.load.mockReset();
    chatStateStoreMocks.replace.mockReset();
    chatStateStoreMocks.updateConnections.mockReset();
    chatStateStoreMocks.updateUnreadCounts.mockReset();
    chatStateStoreMocks.updateConnectionOverrides.mockReset();
    chatStateStoreMocks.updatePinnedChats.mockReset();
    chatStateStoreMocks.updateHiddenChats.mockReset();
    chatStateStoreMocks.deleteConversationMessages.mockReset();
    messagingDbMocks.get.mockReset();
    messagingDbMocks.get.mockResolvedValue(null);
    telemetryMocks.logAppEvent.mockReset();
    projectionSidebarState.useProjectionReads = false;
    projectionSidebarState.projectionConnections = [];
    nativeRuntimeMocks.isNative = false;
    nativeRuntimeMocks.sqliteConversations = [];

    const accountA = "a".repeat(64);
    const accountB = "b".repeat(64);
    chatStateStoreMocks.load.mockImplementation((publicKeyHex: string, options?: { profileId?: string }) => {
      const scope = `${options?.profileId ?? "default"}::${publicKeyHex}`;
      if (scope === `default::${accountA}`) {
        return buildPersistedState({
          displayName: "Account A Contact",
          peerPublicKeyHex: "1".repeat(64),
        });
      }
      if (scope === `default::${accountB}`) {
        return buildPersistedState({
          displayName: "Account B Contact",
          peerPublicKeyHex: "2".repeat(64),
        });
      }
      if (scope === `work::${accountA}`) {
        return buildPersistedState({
          displayName: "Work Scope Contact",
          peerPublicKeyHex: "3".repeat(64),
        });
      }
      return null;
    });
  });

  it("rehydrates when switching accounts after sign-out", async () => {
    const view = render(
      <MessagingProvider>
        <Harness />
      </MessagingProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("hydrated").textContent).toBe("true");
      expect(screen.getByTestId("connections").textContent).toContain("Account A Contact");
    });

    identityState.publicKeyHex = null;
    view.rerender(
      <MessagingProvider>
        <Harness />
      </MessagingProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("hydrated").textContent).toBe("false");
      expect(screen.getByTestId("connections").textContent).toBe("");
    });

    identityState.publicKeyHex = "b".repeat(64);
    view.rerender(
      <MessagingProvider>
        <Harness />
      </MessagingProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("hydrated").textContent).toBe("true");
      expect(screen.getByTestId("connections").textContent).toContain("Account B Contact");
      expect(screen.getByTestId("connections").textContent).not.toContain("Account A Contact");
    });
  });

  it("rehydrates when profile scope changes for the same account", async () => {
    const view = render(
      <MessagingProvider>
        <Harness />
      </MessagingProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("connections").textContent).toContain("Account A Contact");
    });

    profileScopeState.activeProfileId = "work";
    hydrationBusRuntime.syncRuntime("work");
    view.rerender(
      <MessagingProvider>
        <Harness />
      </MessagingProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("hydrated").textContent).toBe("true");
      expect(screen.getByTestId("connections").textContent).toContain("Work Scope Contact");
      expect(screen.getByTestId("connections").textContent).not.toContain("Account A Contact");
    });
  });

  it("refreshes hydrated connections when chat state is replaced after initial empty mount", async () => {
    const accountA = "a".repeat(64);
    chatStateStoreMocks.load.mockImplementation((publicKeyHex: string, options?: { profileId?: string }) => {
      const scope = `${options?.profileId ?? "default"}::${publicKeyHex}`;
      if (scope === `default::${accountA}`) {
        return null;
      }
      return null;
    });

    render(
      <MessagingProvider>
        <Harness />
      </MessagingProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("hydrated").textContent).toBe("true");
      expect(screen.getByTestId("connections").textContent).toBe("");
    });

    chatStateStoreMocks.load.mockImplementation((publicKeyHex: string, options?: { profileId?: string }) => {
      const scope = `${options?.profileId ?? "default"}::${publicKeyHex}`;
      if (scope === `default::${accountA}`) {
        return buildPersistedState({
          displayName: "Restored Contact",
          peerPublicKeyHex: "4".repeat(64),
        });
      }
      return null;
    });

    act(() => {
      hydrationBusRuntime.bus.publish({
        type: "chat-state-replaced",
        profileId: "default",
        publicKeyHex: accountA,
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId("connections").textContent).toContain("Restored Contact");
    });
  });

  it("hydrates empty connections when scoped localStorage chat-state is missing (no IndexedDB fallback)", async () => {
    chatStateStoreMocks.load.mockReturnValue(null);
    messagingDbMocks.get.mockResolvedValue(buildPersistedState({
      displayName: "Indexed Fallback Contact",
      peerPublicKeyHex: "5".repeat(64),
    }));

    render(
      <MessagingProvider>
        <Harness />
      </MessagingProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("hydrated").textContent).toBe("true");
      expect(screen.getByTestId("connections").textContent).toBe("");
    });
    expect(messagingDbMocks.get).not.toHaveBeenCalled();
  });

  it("hydrates the switched-to account from localStorage chat-state without retaining prior-account connections", async () => {
    const accountA = "a".repeat(64);
    const accountB = "b".repeat(64);
    chatStateStoreMocks.load.mockImplementation((publicKeyHex: string, options?: { profileId?: string }) => {
      const scope = `${options?.profileId ?? "default"}::${publicKeyHex}`;
      if (scope === `default::${accountA}`) {
        return buildPersistedState({
          displayName: "Account A Contact",
          peerPublicKeyHex: "1".repeat(64),
        });
      }
      if (scope === `default::${accountB}`) {
        return buildPersistedState({
          displayName: "Account B Contact",
          peerPublicKeyHex: "6".repeat(64),
        });
      }
      return null;
    });

    const view = render(
      <MessagingProvider>
        <Harness />
      </MessagingProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("connections").textContent).toContain("Account A Contact");
    });

    identityState.publicKeyHex = accountB;
    view.rerender(
      <MessagingProvider>
        <Harness />
      </MessagingProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("hydrated").textContent).toBe("true");
      expect(screen.getByTestId("connections").textContent).toContain("Account B Contact");
      expect(screen.getByTestId("connections").textContent).not.toContain("Account A Contact");
    });
    expect(messagingDbMocks.get).not.toHaveBeenCalled();
  });

  it("ignores chat-state replaced events from another profile scope", async () => {
    const accountA = "a".repeat(64);
    chatStateStoreMocks.load.mockReturnValue(buildPersistedState({
      displayName: "Account A Contact",
      peerPublicKeyHex: "1".repeat(64),
    }));

    render(
      <MessagingProvider>
        <Harness />
      </MessagingProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("connections").textContent).toContain("Account A Contact");
    });

    chatStateStoreMocks.load.mockClear();

    await act(async () => {
      hydrationBusRuntime.bus.publish({
        type: "chat-state-replaced",
        profileId: "work",
        publicKeyHex: accountA,
      });
    });

    expect(chatStateStoreMocks.load).not.toHaveBeenCalled();
  });

  it("merges persisted-only DM threads into projection sidebar authority", async () => {
    projectionSidebarState.useProjectionReads = true;
    projectionSidebarState.projectionConnections = [{
      kind: "dm",
      id: "dm-projection-alpha",
      displayName: "Projection Contact",
      pubkey: "9".repeat(64),
      lastMessage: "projection",
      unreadCount: 3,
      lastMessageTime: new Date(2_000),
    }];

    render(
      <MessagingProvider>
        <Harness />
      </MessagingProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("hydrated").textContent).toBe("true");
      expect(screen.getByTestId("connections").textContent).toContain("Projection Contact");
      expect(screen.getByTestId("connections").textContent).toContain("Account A Contact");
    });
    expect(telemetryMocks.logAppEvent).toHaveBeenCalledWith(expect.objectContaining({
      name: "messaging.conversation_list_authority_selected",
      context: expect.objectContaining({
        selectedAuthority: "projection",
        selectedAuthorityReason: "projection_read_cutover",
        projectionConversationCount: 1,
        persistedDmThreadCount: 1,
      }),
    }));
  });

  it("sanitizes stale dm hidden and pinned ids when projection authority is active", async () => {
    chatStateStoreMocks.load.mockReturnValue({
      ...buildPersistedState({
        displayName: "Legacy Contact",
        peerPublicKeyHex: "1".repeat(64),
      }),
      pinnedChatIds: ["dm-stale", "dm-projection-alpha"],
      hiddenChatIds: ["dm-stale", "dm-projection-alpha"],
    });
    projectionSidebarState.useProjectionReads = true;
    projectionSidebarState.projectionConnections = [{
      kind: "dm",
      id: "dm-projection-alpha",
      displayName: "Projection Contact",
      pubkey: "9".repeat(64),
      lastMessage: "projection",
      unreadCount: 3,
      lastMessageTime: new Date(2_000),
    }];

    render(
      <MessagingProvider>
        <Harness />
      </MessagingProvider>
    );

    await waitFor(() => {
      expect(screen.getByTestId("pinned").textContent).toBe("dm-projection-alpha");
      expect(screen.getByTestId("hidden").textContent).toBe("dm-projection-alpha");
    });
  });

  it("does not resurrect chat-state message threads when native sqlite is list authority", async () => {
    nativeRuntimeMocks.isNative = true;
    const accountA = "a".repeat(64);
    const sqlitePeer = "7".repeat(64);
    const ghostPeer = "8".repeat(64);
    const sqliteConversationId = [accountA, sqlitePeer].sort().join(":");
    const ghostConversationId = [accountA, ghostPeer].sort().join(":");
    nativeRuntimeMocks.sqliteConversations = [{
      id: sqliteConversationId,
      profile_id: "default",
      peer_pubkey: sqlitePeer,
      last_event_id: "evt-sqlite",
      last_message_at: 5_000,
      last_plaintext_preview: "sqlite preview",
      unread_count: 0,
    }];
    chatStateStoreMocks.load.mockImplementation((publicKeyHex: string) => {
      if (publicKeyHex !== accountA) {
        return null;
      }
      return {
        ...buildPersistedState({
          displayName: "Metadata Contact",
          peerPublicKeyHex: "3".repeat(64),
        }),
        messagesByConversationId: {
          [ghostConversationId]: [{
            id: "ghost-msg",
            content: "deleted ghost",
            timestampMs: 9_000,
            isOutgoing: false,
            senderPubkey: ghostPeer,
          }],
        },
      };
    });

    render(
      <MessagingProvider>
        <Harness />
      </MessagingProvider>
    );

    await waitFor(() => {
      const connections = screen.getByTestId("connections").textContent ?? "";
      expect(connections).toContain(sqlitePeer);
      expect(connections).toContain("Metadata Contact");
      expect(connections).not.toContain("8".repeat(64));
    });
    expect(telemetryMocks.logAppEvent).toHaveBeenCalledWith(expect.objectContaining({
      context: expect.objectContaining({
        selectedAuthority: "sqlite",
        selectedAuthorityReason: "sqlite_native",
      }),
    }));
  });
});
