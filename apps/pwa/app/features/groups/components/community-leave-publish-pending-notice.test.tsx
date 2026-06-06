import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  CommunityLeaveOutboxSummaryBanner,
  CommunityLeavePublishPendingNotice,
} from "./community-leave-publish-pending-notice";

const outboxMocks = vi.hoisted(() => ({
  items: [] as Array<{
    id: string;
    publicKeyHex: string;
    groupId: string;
    relayUrl: string;
    intentUnixMs: number;
    status: "pending" | "rejected";
    attemptCount: number;
  }>,
}));

const restoreMocks = vi.hoisted(() => ({
  restoreRejected: vi.fn(async () => ({ restoredCount: 1, skippedNoPersistedEvidence: 0 })),
  isRestoring: false,
}));

vi.mock("../hooks/use-community-leave-outbox-index", () => ({
  useCommunityLeaveOutboxIndex: () => ({
    items: outboxMocks.items,
    byScopeId: new Map(outboxMocks.items.map((item) => [item.id, item])),
    refresh: vi.fn(),
  }),
  resolveLeaveOutboxScopeId: (groupId: string, relayUrl: string) => `${groupId}@@${relayUrl}`,
}));

vi.mock("../hooks/use-restore-rejected-community-leaves", () => ({
  useRestoreRejectedCommunityLeaves: () => ({
    rejectedCount: outboxMocks.items.filter((item) => item.status === "rejected").length,
    canRestore: outboxMocks.items.some((item) => item.status === "rejected"),
    isRestoring: restoreMocks.isRestoring,
    restoreRejected: restoreMocks.restoreRejected,
  }),
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

  it("shows restore action when relay declined leave confirmations exist", () => {
    outboxMocks.items = [{
      id: "g1@@wss://relay.example",
      publicKeyHex: "aa".repeat(32),
      groupId: "g1",
      relayUrl: "wss://relay.example",
      intentUnixMs: Date.now(),
      status: "rejected",
      attemptCount: 3,
    } as (typeof outboxMocks.items)[number]];
    render(<CommunityLeaveOutboxSummaryBanner />);
    expect(screen.getByTestId("community-leave-outbox-summary-banner")).toBeInTheDocument();
    expect(screen.getByText(/relay declined/i)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("community-leave-restore-rejected-button"));
    expect(restoreMocks.restoreRejected).toHaveBeenCalledTimes(1);
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
