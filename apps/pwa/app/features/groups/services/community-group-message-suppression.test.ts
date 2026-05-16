import { beforeEach, describe, expect, it, vi } from "vitest";
import { isSuppressedCommunityGroupMessageIdentity } from "./community-group-message-suppression";

const suppressMock = vi.hoisted(() => vi.fn(
  (messageId?: string) => false,
));

vi.mock("@/app/features/messaging/services/messaging-client-operations", () => ({
  messagingClientOperations: {
    isDmMessageSuppressed: suppressMock,
  },
}));

vi.mock("@/app/features/profiles/services/profile-runtime-scope", () => ({
  getResolvedProfileId: () => "profile-test",
}));

describe("community-group-message-suppression", () => {
  beforeEach(() => {
    suppressMock.mockReset();
    suppressMock.mockReturnValue(false);
  });

  it("returns true when durable tombstone matches message id", () => {
    suppressMock.mockImplementation((messageId) => messageId === "evt-1");
    expect(isSuppressedCommunityGroupMessageIdentity({ messageId: "evt-1" })).toBe(true);
  });

  it("returns false when no tombstone matches", () => {
    expect(isSuppressedCommunityGroupMessageIdentity({ messageId: "evt-2", eventId: "evt-2" })).toBe(false);
  });
});
