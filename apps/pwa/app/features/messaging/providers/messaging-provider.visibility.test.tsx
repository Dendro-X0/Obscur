import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { DmConversation } from "../types";
import { MessagingProvider, useMessaging } from "./messaging-provider";

const { updateHiddenChatsMock, updatePinnedChatsMock } = vi.hoisted(() => ({
  updateHiddenChatsMock: vi.fn(),
  updatePinnedChatsMock: vi.fn(),
}));

vi.mock("../../auth/hooks/use-identity", () => ({
  useIdentity: () => ({
    state: {
      publicKeyHex: "a".repeat(64),
      stored: null,
    },
  }),
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

vi.mock("../services/chat-state-store", () => ({
  CHAT_STATE_REPLACED_EVENT: "obscur:chat-state-replaced",
  chatStateStoreService: {
    load: vi.fn(() => null),
    updateConnections: vi.fn(),
    updateUnreadCounts: vi.fn(),
    updateConnectionOverrides: vi.fn(),
    updatePinnedChats: updatePinnedChatsMock,
    updateHiddenChats: updateHiddenChatsMock,
    deleteConversationMessages: vi.fn(),
  },
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

const dmConversation: DmConversation = {
  kind: "dm",
  id: "dm-visibility-test",
  displayName: "Test Peer",
  pubkey: "b".repeat(64),
  lastMessage: "",
  unreadCount: 0,
  lastMessageTime: new Date(0),
};

const Harness = (): React.JSX.Element => {
  const messaging = useMessaging();
  return (
    <div>
      <button type="button" onClick={() => messaging.hideConversation(dmConversation.id)}>
        hide
      </button>
      <button type="button" onClick={() => messaging.setSelectedConversation(dmConversation)}>
        select
      </button>
      <div data-testid="hidden-chat-ids">{messaging.hiddenChatIds.join("|")}</div>
    </div>
  );
};

describe("messaging-provider hidden visibility", () => {
  beforeEach(() => {
    updateHiddenChatsMock.mockClear();
    updatePinnedChatsMock.mockClear();
    window.localStorage.clear();
  });

  it("removes a hidden dm from hiddenChatIds when that dm is selected", async () => {
    render(
      <MessagingProvider>
        <Harness />
      </MessagingProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "hide" }));
    await waitFor(() => {
      expect(screen.getByTestId("hidden-chat-ids").textContent).toContain(dmConversation.id);
    });

    fireEvent.click(screen.getByRole("button", { name: "select" }));
    await waitFor(() => {
      expect(screen.getByTestId("hidden-chat-ids").textContent).toBe("");
    });

    expect(updateHiddenChatsMock).toHaveBeenCalled();
  });
});
