import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NetworkDashboard } from "./network-dashboard";

const networkDashboardMocks = vi.hoisted(() => ({
  push: vi.fn(),
  setIsNewGroupOpen: vi.fn(),
  addToast: vi.fn(),
  useGroups: vi.fn(),
  useMembershipIndex: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? ({
      "network.tabs.groups": "Groups",
      "network.tabs.all": "All",
      "network.noGroupsFound": "No groups",
      "network.noGroupsDesc": "No groups yet",
    }[key] ?? key),
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: networkDashboardMocks.push,
  }),
}));

vi.mock("@dweb/ui-kit", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  Avatar: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  AvatarFallback: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
  useToasts: () => ({
    addToast: networkDashboardMocks.addToast,
  }),
}));

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img alt={props.alt} {...props} />,
}));

vi.mock("qrcode", () => ({
  default: {
    toCanvas: vi.fn(),
    toDataURL: vi.fn(async () => "data:image/png;base64,qr"),
  },
}));

vi.mock("../providers/network-provider", () => ({
  useNetwork: () => ({
    identity: {
      state: {
        publicKeyHex: "a".repeat(64),
        stored: { publicKeyHex: "a".repeat(64) },
        privateKeyHex: "b".repeat(64),
      },
    },
    peerTrust: {
      state: { acceptedPeers: [] },
      hasHydrated: true,
      mutePeer: vi.fn(),
    },
    requestsInbox: {
      state: { items: [] },
      hasHydrated: true,
      markAllRead: vi.fn(),
    },
    blocklist: {
      state: { blockedPublicKeys: [] },
      addBlocked: vi.fn(),
    },
    presence: {
      isPeerOnline: vi.fn(() => false),
    },
  }),
}));

vi.mock("@/app/features/groups/providers/group-provider", () => ({
  useGroups: () => networkDashboardMocks.useGroups(),
}));

vi.mock("@/app/features/groups/hooks/use-community-membership-read-model-index", () => ({
  useCommunityMembershipReadModelIndex: () => networkDashboardMocks.useMembershipIndex(),
}));

vi.mock("@/app/features/messaging/providers/messaging-provider", () => ({
  useMessaging: () => ({
    setIsNewChatOpen: vi.fn(),
    createdConnections: [],
    hasHydrated: true,
  }),
}));

vi.mock("@/app/features/relays/providers/relay-provider", () => ({
  useRelay: () => ({
    relayPool: {},
  }),
}));

vi.mock("@/app/features/profile/hooks/use-resolved-profile-metadata", () => ({
  useResolvedProfileMetadata: () => null,
}));

vi.mock("@/app/features/groups/components/join-group-input-dialog", () => ({
  JoinGroupInputDialog: () => null,
}));

vi.mock("@/app/features/groups/components/group-join-dialog", () => ({
  GroupJoinDialog: () => null,
}));

vi.mock("./add-connection-modal", () => ({
  AddConnectionModal: () => null,
}));

vi.mock("./network-connection-card", () => ({
  ConnectionCard: () => <div>Mock Connection Card</div>,
}));

vi.mock("./group-card", () => ({
  GroupCard: (props: { displayName: string; memberCount: number }) => (
    <div>{`Mock Group Card ${props.displayName} (${props.memberCount})`}</div>
  ),
}));

vi.mock("@/app/features/groups/components/group-discovery", () => ({
  GroupDiscovery: () => <div>Mock Discovery Surface</div>,
}));

vi.mock("@/app/components/qr-scanner", () => ({
  QRScanner: () => null,
}));

vi.mock("@/app/components/invites/connection-import-export", () => ({
  ConnectionImportExport: () => null,
}));

vi.mock("@/app/features/messaging/hooks/use-enhanced-dm-controller", () => ({
  useEnhancedDmController: () => ({}),
}));

vi.mock("@/app/features/messaging/hooks/use-request-transport", () => ({
  useRequestTransport: () => ({
    acceptIncomingRequest: vi.fn(),
    declineIncomingRequest: vi.fn(),
  }),
}));

vi.mock("@/app/features/invites/utils/use-invite-resolver", () => ({
  useInviteResolver: () => ({}),
}));

describe("NetworkDashboard recovery navigation", () => {
  beforeEach(() => {
    networkDashboardMocks.push.mockReset();
    networkDashboardMocks.setIsNewGroupOpen.mockReset();
    networkDashboardMocks.addToast.mockReset();
    networkDashboardMocks.useMembershipIndex.mockReset();
    networkDashboardMocks.useGroups.mockReset();
    networkDashboardMocks.useMembershipIndex.mockReturnValue({});
    networkDashboardMocks.useGroups.mockReturnValue({
      createdGroups: [],
      hasHydratedGroups: true,
      communityKnownParticipantDirectoryByConversationId: {},
      communityRosterByConversationId: {},
      setIsNewGroupOpen: networkDashboardMocks.setIsNewGroupOpen,
    });
  });

  it("routes an empty Groups tab into Discovery instead of opening a new local group flow", async () => {
    render(<NetworkDashboard />);

    fireEvent.click(screen.getByRole("button", { name: /^Groups(?:\s+\d+)?$/i }));
    fireEvent.click(screen.getByRole("button", { name: /Browse Communities/i }));

    await waitFor(() => {
      expect(screen.getByText("Mock Discovery Surface")).toBeInTheDocument();
    });
    expect(networkDashboardMocks.setIsNewGroupOpen).not.toHaveBeenCalled();
  });

  it("uses membership read-model count for group cards", async () => {
    const groupId = "community:g1:ws://localhost:7000";
    networkDashboardMocks.useGroups.mockReturnValue({
      createdGroups: [
        {
          id: groupId,
          groupId: "g1",
          communityId: "g1",
          relayUrl: "ws://localhost:7000",
          displayName: "Group 1",
          memberPubkeys: [],
          avatar: null,
        },
      ],
      hasHydratedGroups: true,
      communityKnownParticipantDirectoryByConversationId: {},
      communityRosterByConversationId: {},
      setIsNewGroupOpen: networkDashboardMocks.setIsNewGroupOpen,
    });
    networkDashboardMocks.useMembershipIndex.mockReturnValue({
      [groupId]: {
        displayPubkeys: [],
        memberCount: 3,
      },
    });

    render(<NetworkDashboard />);
    fireEvent.click(screen.getByRole("button", { name: /^Groups(?:\s+\d+)?$/i }));

    await waitFor(() => {
      expect(screen.getByText("Mock Group Card Group 1 (3)")).toBeInTheDocument();
    });
  });
});
