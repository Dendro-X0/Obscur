import React from "react";
import { act, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NostrMessenger from "./main-shell";
import { createPendingStartupAuthState } from "@/app/features/auth/services/startup-auth-state-contracts";

const testState = vi.hoisted(() => ({
  identityMode: "unlocked" as "unlocked" | "loading" | "locked",
  pathname: "/" as string,
  projectionProfileId: "default" as string | null,
  projectionAccountPublicKeyHex: "a".repeat(64) as string | null,
  startupStateKind: "restored" as "pending" | "stored_locked" | "restored" | "mismatch" | "no_identity",
}));

const messagingState = vi.hoisted(() => ({
  selectedConversation: null as null
    | Readonly<{ kind: "dm"; id: string; pubkey: string; displayName: string; lastMessage: string; unreadCount: number; lastMessageTime: Date }>
    | Readonly<{ kind: "group"; id: string; communityId?: string; groupId: string; relayUrl: string; displayName: string; memberPubkeys: ReadonlyArray<string>; lastMessage: string; unreadCount: number; lastMessageTime: Date; access: "invite-only" | "open" | "discoverable"; memberCount: number; adminPubkeys: ReadonlyArray<string> }>,
  createdConnections: [] as ReadonlyArray<Readonly<{ kind: "dm"; id: string; pubkey: string; displayName: string; lastMessage: string; unreadCount: number; lastMessageTime: Date }>>,
  createdGroups: [] as ReadonlyArray<unknown>,
}));

const sealedCommunityState = vi.hoisted(() => ({
  state: { admins: [] as string[], leftMembers: [] as string[], expelledMembers: [] as string[] },
  members: [] as string[],
}));

const testFns = vi.hoisted(() => ({
  routerPush: vi.fn(),
  unlockIdentity: vi.fn(),
  unlockWithPrivateKeyHex: vi.fn(),
  forgetIdentity: vi.fn(),
  unlockAutoLock: vi.fn(),
  setSelectedConversation: vi.fn(),
  setUnreadByConversationId: vi.fn(),
  setVisibleMessageCountByConversationId: vi.fn(),
  setReplyTo: vi.fn(),
  setSidebarTab: vi.fn(),
  setMessageInput: vi.fn(),
  setSearchQuery: vi.fn(),
  setIsNewChatOpen: vi.fn(),
  setIsMediaGalleryOpen: vi.fn(),
  setLightboxIndex: vi.fn(),
  setMessageMenu: vi.fn(),
  setReactionPicker: vi.fn(),
  togglePin: vi.fn(),
  hideConversation: vi.fn(),
  deleteConversation: vi.fn(),
  clearHistory: vi.fn(),
  unhideConversation: vi.fn(),
  setCreatedConnections: vi.fn(),
  setIsNewGroupOpen: vi.fn(),
  setIsGroupInfoOpen: vi.fn(),
  updateGroup: vi.fn(),
  markAllRead: vi.fn(),
  clearRequestHistory: vi.fn(),
  removeRequest: vi.fn(),
  acceptPeer: vi.fn(),
  mutePeer: vi.fn(),
  addBlocked: vi.fn(),
  retryFailedMessage: vi.fn(),
  sendDm: vi.fn(async () => ({ success: true, messageId: "m", relayResults: [] })),
  acceptIncomingRequest: vi.fn(async () => ({ status: "ok" as const })),
  declineIncomingRequest: vi.fn(async () => ({ status: "ok" as const })),
  cancelOutgoingRequest: vi.fn(async () => ({ status: "ok" as const })),
  sendRequest: vi.fn(async () => ({ status: "ok" as const })),
  handleSendMessage: vi.fn(),
  deleteMessageForMeAction: vi.fn(),
  deleteMessageForEveryoneAction: vi.fn(),
  toggleReactionAction: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => testState.pathname,
  useRouter: () => ({
    push: testFns.routerPush,
  }),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

vi.mock("@dweb/ui-kit", () => ({
  toast: {
    success: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("@/app/components/app-shell", () => ({
  default: ({ children, sidebarContent }: Readonly<{ children: React.ReactNode; sidebarContent?: React.ReactNode }>) => (
    <div data-testid="app-shell">
      <div data-testid="sidebar-content">{sidebarContent}</div>
      {children}
    </div>
  ),
}));

vi.mock("@/app/components/app-loading-screen", () => ({
  AppLoadingScreen: ({ title }: Readonly<{ title: string }>) => <div data-testid="loading-screen">{title}</div>,
}));

vi.mock("@/app/components/lock-screen", () => ({
  LockScreen: () => <div data-testid="lock-screen">locked</div>,
}));

vi.mock("./components/empty-conversation-view", () => ({
  EmptyConversationView: () => <div data-testid="empty-conversation">empty</div>,
}));

vi.mock("../dev-tools/components/dev-panel", () => ({
  DevPanel: () => <div data-testid="dev-panel">dev</div>,
}));

vi.mock("@/app/features/messaging/components/sidebar", () => ({
  Sidebar: () => <div data-testid="sidebar">sidebar</div>,
}));

vi.mock("@/app/features/messaging/components/chat-view", () => ({
  ChatView: () => <div data-testid="chat-view">chat</div>,
}));

vi.mock("@/app/features/groups/components/group-management-dialog", () => ({
  GroupManagementDialog: () => null,
}));

vi.mock("@/app/features/messaging/providers/runtime-messaging-transport-owner-provider", () => ({
  useRuntimeMessagingTransportOwnerController: () => ({
    state: { messages: [], status: "ready" },
    retryFailedMessage: testFns.retryFailedMessage,
    sendDm: testFns.sendDm,
  }),
}));

vi.mock("@/app/features/network/providers/network-provider", () => ({
  useNetwork: () => ({
    blocklist: { addBlocked: testFns.addBlocked },
    peerTrust: {
      state: { acceptedPeers: [] as string[] },
      isAccepted: () => false,
      acceptPeer: testFns.acceptPeer,
      mutePeer: testFns.mutePeer,
    },
    requestsInbox: {
      state: { items: [] as Array<Readonly<{ unreadCount: number }>> },
      markAllRead: testFns.markAllRead,
      clearHistory: testFns.clearRequestHistory,
      remove: testFns.removeRequest,
      getRequestStatus: () => null,
    },
    presence: {
      isPeerOnline: () => false,
    },
  }),
}));

vi.mock("@/app/features/auth/hooks/use-identity", () => ({
  useIdentity: () => {
    if (testState.identityMode === "loading") {
      return {
        state: {
          status: "loading",
          publicKeyHex: null,
          privateKeyHex: null,
          stored: { publicKeyHex: "a".repeat(64), username: "alice" },
        },
        getIdentityDiagnostics: () => ({
          status: "loading" as const,
          startupState: createPendingStartupAuthState({
            storedPublicKeyHex: "a".repeat(64),
          }),
        }),
        unlockIdentity: testFns.unlockIdentity,
        unlockWithPrivateKeyHex: testFns.unlockWithPrivateKeyHex,
        forgetIdentity: testFns.forgetIdentity,
      };
    }
    if (testState.identityMode === "locked") {
      return {
        state: {
          status: "locked",
          publicKeyHex: "a".repeat(64),
          privateKeyHex: null,
          stored: { publicKeyHex: "a".repeat(64), username: "alice" },
        },
        getIdentityDiagnostics: () => ({
          status: "locked" as const,
          startupState: {
            kind: testState.startupStateKind,
            identityStatus: testState.startupStateKind === "pending" ? "loading" : "locked",
            runtimePhaseHint: testState.startupStateKind === "pending" ? "binding_profile" : "auth_required",
            degradedReasonHint: "none" as const,
            storedPublicKeyHex: testState.startupStateKind === "no_identity" ? undefined : "a".repeat(64),
            mismatchReason: testState.startupStateKind === "mismatch" ? "private_key_mismatch" as const : undefined,
            message: testState.startupStateKind === "mismatch" ? "Private key does not match stored identity." : undefined,
            recoveryActions: [],
          },
        }),
        unlockIdentity: testFns.unlockIdentity,
        unlockWithPrivateKeyHex: testFns.unlockWithPrivateKeyHex,
        forgetIdentity: testFns.forgetIdentity,
      };
    }
    return {
      state: {
        status: "unlocked",
        publicKeyHex: "a".repeat(64),
        privateKeyHex: "b".repeat(64),
        stored: { publicKeyHex: "a".repeat(64), username: "alice" },
      },
      getIdentityDiagnostics: () => ({
        status: "unlocked" as const,
        startupState: {
          kind: "restored" as const,
          identityStatus: "unlocked" as const,
          runtimePhaseHint: "activating_runtime" as const,
          degradedReasonHint: "none" as const,
          storedPublicKeyHex: "a".repeat(64),
          unlockedPublicKeyHex: "a".repeat(64),
          recoveryActions: [],
        },
      }),
      unlockIdentity: testFns.unlockIdentity,
      unlockWithPrivateKeyHex: testFns.unlockWithPrivateKeyHex,
      forgetIdentity: testFns.forgetIdentity,
    };
  },
}));

vi.mock("@/app/features/settings/hooks/use-auto-lock", () => ({
  useAutoLock: () => ({
    isLocked: testState.identityMode === "locked",
    unlock: testFns.unlockAutoLock,
  }),
}));

vi.mock("@/app/features/messaging/providers/messaging-provider", () => ({
  useMessaging: () => ({
    selectedConversation: messagingState.selectedConversation,
    setSelectedConversation: testFns.setSelectedConversation,
    unreadByConversationId: {},
    setUnreadByConversationId: testFns.setUnreadByConversationId,
    lastViewedByConversationId: {},
    connectionOverridesByConnectionId: {},
    visibleMessageCountByConversationId: {},
    setVisibleMessageCountByConversationId: testFns.setVisibleMessageCountByConversationId,
    replyTo: null,
    setReplyTo: testFns.setReplyTo,
    pendingAttachments: [],
    pendingAttachmentPreviewUrls: [],
    isUploadingAttachment: false,
    uploadStage: "idle",
    attachmentError: null,
    hasHydrated: true,
    sidebarTab: "chats" as const,
    setSidebarTab: testFns.setSidebarTab,
    messageInput: "",
    setMessageInput: testFns.setMessageInput,
    isProcessingMedia: false,
    mediaProcessingProgress: 0,
    searchQuery: "",
    setSearchQuery: testFns.setSearchQuery,
    isNewChatOpen: false,
    setIsNewChatOpen: testFns.setIsNewChatOpen,
    isMediaGalleryOpen: false,
    setIsMediaGalleryOpen: testFns.setIsMediaGalleryOpen,
    lightboxIndex: null,
    setLightboxIndex: testFns.setLightboxIndex,
    flashMessageId: null,
    messageMenu: null,
    setMessageMenu: testFns.setMessageMenu,
    reactionPicker: null,
    setReactionPicker: testFns.setReactionPicker,
    pinnedChatIds: [],
    togglePin: testFns.togglePin,
    hiddenChatIds: [],
    hideConversation: testFns.hideConversation,
    deleteConversation: testFns.deleteConversation,
    clearHistory: testFns.clearHistory,
    unhideConversation: testFns.unhideConversation,
    chatsUnreadCount: 0,
    createdConnections: messagingState.createdConnections,
    setCreatedConnections: testFns.setCreatedConnections,
  }),
}));

vi.mock("@/app/features/relays/providers/relay-provider", () => ({
  useRelay: () => ({
    relayPool: {},
    relayStatus: "connected",
  }),
}));

vi.mock("@/app/features/groups/providers/group-provider", () => ({
  useGroups: () => ({
    createdGroups: messagingState.createdGroups,
    communityRosterByConversationId: {},
    isNewGroupOpen: false,
    setIsNewGroupOpen: testFns.setIsNewGroupOpen,
    isGroupInfoOpen: false,
    setIsGroupInfoOpen: testFns.setIsGroupInfoOpen,
    updateGroup: testFns.updateGroup,
  }),
}));

vi.mock("@/app/features/groups/hooks/use-sealed-community", () => ({
  useSealedCommunity: () => ({
    state: sealedCommunityState.state,
    members: sealedCommunityState.members,
  }),
}));

vi.mock("./hooks/use-invite-redemption", () => ({
  useInviteRedemption: () => ({
    handleRedeemInvite: vi.fn(),
  }),
}));

vi.mock("./hooks/use-deep-links", () => ({
  useDeepLinks: () => undefined,
}));

vi.mock("./hooks/use-command-messages", () => ({
  useCommandMessages: () => undefined,
}));

vi.mock("./hooks/use-chat-actions", () => ({
  useChatActions: () => ({
    handleSendMessage: testFns.handleSendMessage,
    deleteMessageForMe: testFns.deleteMessageForMeAction,
    deleteMessageForEveryone: testFns.deleteMessageForEveryoneAction,
    toggleReaction: testFns.toggleReactionAction,
  }),
}));

vi.mock("./hooks/use-filtered-conversations", () => ({
  useFilteredConversations: () => ({
    allConversations: [],
    filteredConversations: [],
  }),
}));

vi.mock("./hooks/use-attachment-handler", () => ({
  useAttachmentHandler: () => ({
    pickAttachments: vi.fn(),
    handleFilesSelected: vi.fn(),
    removePendingAttachment: vi.fn(),
    clearPendingAttachments: vi.fn(),
  }),
}));

vi.mock("./hooks/use-dm-sync", () => ({
  useDmSync: () => undefined,
}));

vi.mock("./hooks/use-chat-view-props", () => ({
  useChatViewProps: () => ({
    handleLoadEarlier: vi.fn(),
    handleCopyMyPubkey: vi.fn(),
    handleCopyChatLink: vi.fn(),
    visibleMessages: [],
    rawMessagesCount: 0,
    hasEarlierMessages: false,
    selectedConversationMediaItems: [],
    pendingEventCount: 0,
  }),
}));

vi.mock("../messaging/dev/chat-performance-dev-tools", () => ({
  installChatPerformanceDevTools: () => undefined,
}));

vi.mock("@/app/features/messaging/hooks/use-request-transport", () => ({
  useRequestTransport: () => ({
    acceptIncomingRequest: testFns.acceptIncomingRequest,
    declineIncomingRequest: testFns.declineIncomingRequest,
    cancelOutgoingRequest: testFns.cancelOutgoingRequest,
    sendRequest: testFns.sendRequest,
  }),
}));

vi.mock("@/app/features/invites/utils/invite-manager", () => ({
  configureInviteRequestStateBridge: vi.fn(),
  configureInviteRequestTransportBridge: vi.fn(),
}));

vi.mock("@/app/features/account-sync/hooks/use-account-sync-snapshot", () => ({
  useAccountSyncSnapshot: () => ({
    status: "idle",
    message: "",
  }),
}));

vi.mock("@/app/features/account-sync/hooks/use-account-projection-snapshot", () => ({
  useAccountProjectionSnapshot: () => ({
    profileId: testState.projectionProfileId,
    accountPublicKeyHex: testState.projectionAccountPublicKeyHex,
    projection: null,
    phase: "ready",
    status: "ready",
    accountProjectionReady: true,
    driftStatus: "clean",
    updatedAtUnixMs: 1,
  }),
}));

vi.mock("@/app/features/account-sync/services/account-sync-ui-policy", () => ({
  resolveAccountSyncUiPolicy: () => ({
    showRestoreProgress: false,
    showMissingSharedDataWarning: false,
    showInitialHistorySyncNotice: false,
  }),
}));

vi.mock("@/app/features/messaging/hooks/use-peer-last-active-by-peer", () => ({
  usePeerLastActiveByPeer: () => ({}),
}));

describe("main-shell hook stability", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testState.identityMode = "unlocked";
    testState.pathname = "/";
    testState.projectionProfileId = "default";
    testState.projectionAccountPublicKeyHex = "a".repeat(64);
    testState.startupStateKind = "restored";
    messagingState.selectedConversation = null;
    messagingState.createdConnections = [];
    messagingState.createdGroups = [];
    sealedCommunityState.state = { admins: [], leftMembers: [], expelledMembers: [] };
    sealedCommunityState.members = [];
    window.localStorage.clear();
  });

  it("keeps hook order stable across identity loading transitions", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    try {
      const { rerender } = render(<NostrMessenger />);
      await act(async () => Promise.resolve());
      expect(screen.getByTestId("app-shell")).toBeInTheDocument();

      testState.identityMode = "loading";
      expect(() => {
        rerender(<NostrMessenger />);
      }).not.toThrow();
      expect(screen.getByTestId("loading-screen")).toBeInTheDocument();

      testState.identityMode = "unlocked";
      expect(() => {
        rerender(<NostrMessenger />);
      }).not.toThrow();
      expect(screen.getByTestId("app-shell")).toBeInTheDocument();
    } finally {
      consoleErrorSpy.mockRestore();
    }
  });

  it("shows the lock screen from startup auth-state when stored identity is locked", async () => {
    testState.identityMode = "locked";
    testState.startupStateKind = "stored_locked";

    render(<NostrMessenger />);
    await act(async () => Promise.resolve());

    expect(screen.getByTestId("lock-screen")).toBeInTheDocument();
  });

  it("does not show the lock screen when startup state reports no stored identity", async () => {
    testState.identityMode = "locked";
    testState.startupStateKind = "no_identity";

    render(<NostrMessenger />);
    await act(async () => Promise.resolve());

    expect(screen.queryByTestId("lock-screen")).not.toBeInTheDocument();
  });

  it("keeps runtime mounted but hides chat shell on non-chat routes", async () => {
    testState.pathname = "/network";
    const { container } = render(<NostrMessenger />);
    await act(async () => Promise.resolve());
    expect(screen.queryByTestId("app-shell")).not.toBeInTheDocument();
    expect(screen.queryByTestId("loading-screen")).not.toBeInTheDocument();
    expect(container.firstChild).toBeNull();
  });

  it("shows profile-scope mismatch guidance when projection scope diverges from this window profile", async () => {
    testState.projectionProfileId = "profile-b";
    render(<NostrMessenger />);
    await act(async () => Promise.resolve());

    expect(screen.getByText(/Profile Scope Notice/)).toBeInTheDocument();
    expect(
      screen.getByText(
        "This window is bound to a different local profile slot than this account's data. Open the saved profile that owns this account, or switch this window's profile before signing in."
      )
    ).toBeInTheDocument();
  });

  it("does not overwrite restored messaging connections from peer-trust on mount", async () => {
    render(<NostrMessenger />);
    await act(async () => Promise.resolve());

    expect(testFns.setCreatedConnections).not.toHaveBeenCalled();
  });

  it("restores the last selected chat only from the active scoped key", async () => {
    const myPublicKeyHex = "a".repeat(64);
    const dmConversation = {
      kind: "dm" as const,
      id: `${myPublicKeyHex}:${"b".repeat(64)}`,
      pubkey: "b".repeat(64),
      displayName: "Scoped Peer",
      lastMessage: "",
      unreadCount: 0,
      lastMessageTime: new Date(0),
    };
    messagingState.createdConnections = [dmConversation];
    window.localStorage.setItem(`obscur-last-chat-${myPublicKeyHex}::default`, dmConversation.id);

    render(<NostrMessenger />);
    await act(async () => Promise.resolve());

    expect(testFns.setSelectedConversation).toHaveBeenCalledWith(dmConversation);
    expect(testFns.unhideConversation).toHaveBeenCalledWith(dmConversation.id);
  });

  it("ignores the legacy unscoped last-chat key", async () => {
    const myPublicKeyHex = "a".repeat(64);
    const dmConversation = {
      kind: "dm" as const,
      id: `${myPublicKeyHex}:${"b".repeat(64)}`,
      pubkey: "b".repeat(64),
      displayName: "Legacy Peer",
      lastMessage: "",
      unreadCount: 0,
      lastMessageTime: new Date(0),
    };
    messagingState.createdConnections = [dmConversation];
    window.localStorage.setItem(`obscur-last-chat-${myPublicKeyHex}`, dmConversation.id);

    render(<NostrMessenger />);
    await act(async () => Promise.resolve());

    expect(testFns.setSelectedConversation).not.toHaveBeenCalled();
    expect(testFns.unhideConversation).not.toHaveBeenCalled();
  });

  it("does not persist selected-group membership from main-shell render effects", async () => {
    const groupConversation = {
      kind: "group" as const,
      id: "community:lambda:wss://relay.lambda",
      communityId: "lambda:wss://relay.lambda",
      groupId: "lambda",
      relayUrl: "wss://relay.lambda",
      displayName: "Lambda",
      memberPubkeys: ["a".repeat(64)],
      lastMessage: "",
      unreadCount: 0,
      lastMessageTime: new Date(0),
      access: "invite-only" as const,
      memberCount: 1,
      adminPubkeys: [] as string[],
    };
    messagingState.selectedConversation = groupConversation;
    messagingState.createdGroups = [groupConversation];
    sealedCommunityState.members = ["a".repeat(64), "b".repeat(64)];

    render(<NostrMessenger />);
    await act(async () => Promise.resolve());

    expect(testFns.updateGroup).not.toHaveBeenCalled();
  });
});
