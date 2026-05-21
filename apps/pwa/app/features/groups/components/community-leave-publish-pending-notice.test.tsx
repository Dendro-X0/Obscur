import React from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { CommunityLeavePublishPendingNotice } from "./community-leave-publish-pending-notice";

const outboxMocks = vi.hoisted(() => ({
  items: [] as Array<{
    id: string;
    publicKeyHex: string;
    groupId: string;
    relayUrl: string;
    intentUnixMs: number;
    status: "pending";
    attemptCount: number;
  }>,
}));

vi.mock("../hooks/use-community-leave-outbox-index", () => ({
  useCommunityLeaveOutboxIndex: () => ({
    items: outboxMocks.items,
    byScopeId: new Map(outboxMocks.items.map((item) => [item.id, item])),
    refresh: vi.fn(),
  }),
  resolveLeaveOutboxScopeId: (groupId: string, relayUrl: string) => `${groupId}@@${relayUrl}`,
}));

describe("CommunityLeavePublishPendingNotice", () => {
  beforeEach(() => {
    outboxMocks.items = [];
  });

  it("renders nothing when no outbox item exists for the scope", () => {
    const { container } = render(
      <CommunityLeavePublishPendingNotice groupId="g1" relayUrl="wss://relay.example" />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows honest pending copy when relay confirmation is queued", () => {
    outboxMocks.items = [{
      id: "g1@@wss://relay.example",
      publicKeyHex: "aa".repeat(32),
      groupId: "g1",
      relayUrl: "wss://relay.example",
      intentUnixMs: Date.now(),
      status: "pending",
      attemptCount: 0,
    }];
    render(<CommunityLeavePublishPendingNotice groupId="g1" relayUrl="wss://relay.example" />);
    expect(screen.getByTestId("community-leave-publish-pending-notice")).toBeInTheDocument();
    expect(screen.getByText(/Leave saved locally/i)).toBeInTheDocument();
    expect(screen.getByText(/not joined/i)).toBeInTheDocument();
  });
});
