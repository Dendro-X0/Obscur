import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
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

vi.mock("../../auth/hooks/use-identity", () => ({
  useIdentity: () => ({
    state: {
      publicKeyHex: identityState.publicKeyHex,
      stored: null,
    },
  }),
}));

vi.mock("@/app/features/profiles/services/profile-scope", () => ({
  getActiveProfileIdSafe: () => profileScopeState.activeProfileId,
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
    useProjectionReads: false,
  }),
}));

vi.mock("@/app/features/account-sync/services/account-projection-selectors", () => ({
  selectProjectionDmConversations: () => [],
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
  },
}));

vi.mock("../services/message-bus", () => ({
  messageBus: {
    emit: vi.fn(),
  },
}));

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
    </div>
  );
};

describe("messaging-provider hydration scope resets", () => {
  beforeEach(() => {
    identityState.publicKeyHex = "a".repeat(64);
    profileScopeState.activeProfileId = "default";
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
      window.dispatchEvent(new CustomEvent("obscur:chat-state-replaced", {
        detail: { publicKeyHex: accountA },
      }));
    });

    await waitFor(() => {
      expect(screen.getByTestId("connections").textContent).toContain("Restored Contact");
    });
  });

  it("falls back to indexed chat-state when scoped cache is empty for the active account", async () => {
    const accountA = "a".repeat(64);
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
      expect(screen.getByTestId("connections").textContent).toContain("Indexed Fallback Contact");
    });
    expect(messagingDbMocks.get).toHaveBeenCalledWith("chatState", accountA);
  });

  it("hydrates the switched-to account from indexed chat-state without retaining prior-account connections", async () => {
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
        return null;
      }
      return null;
    });
    messagingDbMocks.get.mockImplementation(async (_store: string, publicKeyHex: string) => {
      if (publicKeyHex === accountB) {
        return buildPersistedState({
          displayName: "Indexed Account B Contact",
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
      expect(screen.getByTestId("connections").textContent).toContain("Indexed Account B Contact");
      expect(screen.getByTestId("connections").textContent).not.toContain("Account A Contact");
    });
  });
});
