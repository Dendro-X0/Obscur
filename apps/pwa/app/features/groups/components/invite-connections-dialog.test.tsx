import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { InviteConnectionsDialog } from "./invite-connections-dialog";

vi.mock("../../network/providers/network-provider", () => ({
  useNetwork: () => ({ peerTrust: { state: { acceptedPeers: [] } } }),
}));

vi.mock("../../messaging/providers/messaging-provider", () => ({
  useMessaging: () => ({
    createdConnections: [],
    setCreatedConnections: vi.fn(),
  }),
}));

vi.mock("../../relays/providers/relay-provider", () => ({
  useRelay: () => ({ relayPool: {}, enabledRelayUrls: [] }),
}));

vi.mock("../../auth/hooks/use-identity", () => ({
  useIdentity: () => ({
    state: { publicKeyHex: "a".repeat(64), privateKeyHex: "b".repeat(64) },
  }),
}));

describe("InviteConnectionsDialog membership refresh", () => {
  it("calls onRefreshMembership once per open, not on every render", () => {
    const onRefreshMembership = vi.fn();
    const props = {
      isOpen: true,
      onClose: vi.fn(),
      groupId: "group-1",
      relayUrl: "wss://localhost:7000",
      roomKeyHex: "abc",
      metadata: { id: "group-1", name: "Test", about: "", picture: "", access: "invite-only" as const },
      onRefreshMembership,
    };

    const { rerender } = render(<InviteConnectionsDialog {...props} />);
    expect(onRefreshMembership).toHaveBeenCalledTimes(1);

    rerender(<InviteConnectionsDialog {...props} />);
    rerender(<InviteConnectionsDialog {...props} />);
    expect(onRefreshMembership).toHaveBeenCalledTimes(1);

    rerender(<InviteConnectionsDialog {...props} isOpen={false} />);
    rerender(<InviteConnectionsDialog {...props} isOpen />);
    expect(onRefreshMembership).toHaveBeenCalledTimes(2);
  });
});
