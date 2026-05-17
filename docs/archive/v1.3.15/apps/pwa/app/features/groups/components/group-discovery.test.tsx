import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GroupDiscovery } from "./group-discovery";
import { getPublicGroupHref } from "@/app/features/navigation/public-routes";
import { toGroupConversationId } from "../utils/group-conversation-id";

const DEFAULT_DISCOVERY_RELAY = "wss://relay.nostr.band";

const groupDiscoveryMocks = vi.hoisted(() => ({
  createdGroups: [] as Array<{ groupId: string; relayUrl: string }>,
  push: vi.fn(),
  toastInfo: vi.fn(),
  toastError: vi.fn(),
  subscriptionHandler: null as ((payload: { message: string }) => void) | null,
  sendToOpen: vi.fn(),
  addTransientRelay: vi.fn(),
  waitForConnection: vi.fn(async () => undefined),
}));

const stableRelayPool = {
  addTransientRelay: (...args: Parameters<typeof groupDiscoveryMocks.addTransientRelay>) => (
    groupDiscoveryMocks.addTransientRelay(...args)
  ),
  waitForConnection: (...args: Parameters<typeof groupDiscoveryMocks.waitForConnection>) => (
    groupDiscoveryMocks.waitForConnection(...args)
  ),
  subscribeToMessages: (handler: (payload: { message: string }) => void) => {
    groupDiscoveryMocks.subscriptionHandler = handler;
    return () => {
      groupDiscoveryMocks.subscriptionHandler = null;
    };
  },
  sendToOpen: (...args: Parameters<typeof groupDiscoveryMocks.sendToOpen>) => (
    groupDiscoveryMocks.sendToOpen(...args)
  ),
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: groupDiscoveryMocks.push,
  }),
}));

vi.mock("next/image", () => ({
  default: (props: React.ImgHTMLAttributes<HTMLImageElement>) => <img alt={props.alt} {...props} />,
}));

vi.mock("@dweb/ui-kit", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  Pagination: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PaginationContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PaginationItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PaginationEllipsis: () => <span>...</span>,
  PaginationLink: ({
    children,
    isActive,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { isActive?: boolean }) => (
    <a data-active={isActive ? "true" : "false"} {...props}>{children}</a>
  ),
  PaginationNext: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} />,
  PaginationPrevious: (props: React.ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props} />,
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  cn: (...classes: Array<string | false | null | undefined>) => classes.filter(Boolean).join(" "),
  toast: {
    info: groupDiscoveryMocks.toastInfo,
    error: groupDiscoveryMocks.toastError,
  },
}));

vi.mock("@/app/features/relays/providers/relay-provider", () => ({
  useRelay: () => ({
    relayPool: stableRelayPool,
  }),
}));

vi.mock("../providers/group-provider", () => ({
  useGroups: () => ({
    createdGroups: groupDiscoveryMocks.createdGroups,
  }),
}));

const emitDiscoveredGroup = async (params: Readonly<{
  groupId: string;
  relayUrl: string;
  name?: string;
  accessTag?: "private" | "closed";
}>): Promise<void> => {
  const reqCall = groupDiscoveryMocks.sendToOpen.mock.calls.find(([message]) => {
    try {
      return JSON.parse(message as string)?.[0] === "REQ";
    } catch {
      return false;
    }
  });
  expect(reqCall).toBeTruthy();
  const subId = JSON.parse(reqCall?.[0] as string)[1] as string;
  const tags = [
    ["d", params.groupId],
    ["name", params.name ?? params.groupId],
  ];
  if (params.accessTag) {
    tags.push([params.accessTag]);
  }
  await act(async () => {
    groupDiscoveryMocks.subscriptionHandler?.({
      message: JSON.stringify([
        "EVENT",
        subId,
        {
          kind: 39000,
          tags,
        },
      ]),
    });
  });
};

describe("GroupDiscovery", () => {
  beforeEach(() => {
    groupDiscoveryMocks.createdGroups = [];
    groupDiscoveryMocks.push.mockReset();
    groupDiscoveryMocks.toastInfo.mockReset();
    groupDiscoveryMocks.toastError.mockReset();
    groupDiscoveryMocks.subscriptionHandler = null;
    groupDiscoveryMocks.sendToOpen.mockReset();
    groupDiscoveryMocks.addTransientRelay.mockReset();
    groupDiscoveryMocks.waitForConnection.mockReset();
  });

  it("routes joined communities through the canonical public preview flow", async () => {
    const relayUrl = DEFAULT_DISCOVERY_RELAY;
    const groupId = "testclub1";
    groupDiscoveryMocks.createdGroups = [{ groupId, relayUrl }];

    render(<GroupDiscovery />);

    await waitFor(() => {
      expect(groupDiscoveryMocks.subscriptionHandler).toBeTruthy();
      expect(groupDiscoveryMocks.sendToOpen).toHaveBeenCalled();
    });
    await emitDiscoveredGroup({ groupId, relayUrl, name: "TestClub1" });
    await screen.findByText("TestClub1");

    const openCommunityButton = await screen.findByRole("button", { name: /Open Community/i });
    fireEvent.click(openCommunityButton);

    expect(groupDiscoveryMocks.push).toHaveBeenCalledWith(
      getPublicGroupHref(
        toGroupConversationId({ groupId, relayUrl }),
        relayUrl,
      ),
    );
    expect(groupDiscoveryMocks.toastInfo).toHaveBeenCalledWith(
      "Open the community preview to join through the canonical community flow.",
    );
  });

  it("sends invite-only discovery results to preview instead of creating a local shell", async () => {
    const relayUrl = DEFAULT_DISCOVERY_RELAY;
    const groupId = "sealed-room";

    render(<GroupDiscovery />);

    await waitFor(() => {
      expect(groupDiscoveryMocks.subscriptionHandler).toBeTruthy();
      expect(groupDiscoveryMocks.sendToOpen).toHaveBeenCalled();
    });
    await emitDiscoveredGroup({ groupId, relayUrl, name: "Sealed Room", accessTag: "private" });
    await screen.findByText("Sealed Room");

    const requestAccessButton = await screen.findByRole("button", { name: /Request Access/i });
    fireEvent.click(requestAccessButton);

    expect(groupDiscoveryMocks.push).toHaveBeenCalledWith(
      getPublicGroupHref(
        toGroupConversationId({ groupId, relayUrl }),
        relayUrl,
      ),
    );
    expect(groupDiscoveryMocks.toastInfo).toHaveBeenCalledTimes(1);
  });
});
