import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InviteToGroupDialog } from "./invite-to-group-dialog";

const mocks = vi.hoisted(() => ({
  onInvite: vi.fn(),
  onClose: vi.fn(),
  useGroups: vi.fn(),
  useMembershipIndex: vi.fn(),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
  }),
}));

vi.mock("@dweb/ui-kit", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock("@/app/features/auth/hooks/use-identity", () => ({
  useIdentity: () => ({
    state: {
      publicKeyHex: "a".repeat(64),
      stored: { publicKeyHex: "a".repeat(64) },
    },
  }),
}));

vi.mock("@/app/features/groups/providers/group-provider", () => ({
  useGroups: () => mocks.useGroups(),
}));

vi.mock("@/app/features/groups/hooks/use-community-membership-read-model-index", () => ({
  useCommunityMembershipReadModelIndex: () => mocks.useMembershipIndex(),
}));

describe("InviteToGroupDialog membership gating", () => {
  beforeEach(() => {
    mocks.onInvite.mockReset();
    mocks.onClose.mockReset();
    mocks.useGroups.mockReturnValue({
      createdGroups: [
        {
          id: "community:g1:ws://localhost:7000",
          groupId: "g1",
          relayUrl: "ws://localhost:7000",
          displayName: "Group 1",
          memberPubkeys: [],
        },
      ],
      communityKnownParticipantDirectoryByConversationId: {},
      communityRosterByConversationId: {},
    });
  });

  it("disables invite button when target is already in read-model roster", () => {
    const targetPubkey = "b".repeat(64);
    mocks.useMembershipIndex.mockReturnValue({
      "community:g1:ws://localhost:7000": {
        displayPubkeys: [targetPubkey],
        memberCount: 1,
      },
    });

    render(
      <InviteToGroupDialog
        isOpen
        onClose={mocks.onClose}
        onInvite={mocks.onInvite}
        targetPubkey={targetPubkey}
      />,
    );

    expect(screen.getByText("Already a member")).toBeInTheDocument();
    const groupButton = screen.getByRole("button", { name: /Group 1/i });
    expect(groupButton).toBeDisabled();
  });

  it("treats roster membership lookup as case-insensitive", () => {
    const targetPubkey = "b".repeat(64).toUpperCase();
    mocks.useMembershipIndex.mockReturnValue({
      "community:g1:ws://localhost:7000": {
        displayPubkeys: ["b".repeat(64)],
        memberCount: 2,
      },
    });

    render(
      <InviteToGroupDialog
        isOpen
        onClose={mocks.onClose}
        onInvite={mocks.onInvite}
        targetPubkey={targetPubkey}
      />,
    );

    const groupButton = screen.getByRole("button", { name: /Group 1/i });
    expect(groupButton).toBeDisabled();
  });

  it("invokes onInvite when target is not in read-model roster", () => {
    const targetPubkey = "b".repeat(64);
    mocks.useMembershipIndex.mockReturnValue({
      "community:g1:ws://localhost:7000": {
        displayPubkeys: [],
        memberCount: 1,
      },
    });

    render(
      <InviteToGroupDialog
        isOpen
        onClose={mocks.onClose}
        onInvite={mocks.onInvite}
        targetPubkey={targetPubkey}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Group 1/i }));
    expect(mocks.onInvite).toHaveBeenCalledTimes(1);
    expect(mocks.onInvite).toHaveBeenCalledWith({
      group: expect.objectContaining({ id: "community:g1:ws://localhost:7000" }),
      memberCount: 1,
    });
  });

  it("falls back to memberCount=1 when read-model entry is missing", () => {
    const targetPubkey = "c".repeat(64);
    mocks.useMembershipIndex.mockReturnValue({});

    render(
      <InviteToGroupDialog
        isOpen
        onClose={mocks.onClose}
        onInvite={mocks.onInvite}
        targetPubkey={targetPubkey}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Group 1/i }));
    expect(mocks.onInvite).toHaveBeenCalledWith({
      group: expect.objectContaining({ id: "community:g1:ws://localhost:7000" }),
      memberCount: 1,
    });
  });
});

