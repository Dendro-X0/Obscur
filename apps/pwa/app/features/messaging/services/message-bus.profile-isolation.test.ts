import { afterEach, describe, expect, it, vi } from "vitest";
import { createProfileMessageBus } from "@dweb/core/profile-message-bus";

import { setProfileRuntimeScope } from "@/app/features/profiles/services/profile-runtime-scope";
import { messageBus } from "./message-bus";
import type { Message } from "../types";

vi.mock("@/app/features/profiles/services/profile-runtime-scope", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/features/profiles/services/profile-runtime-scope")>();
  return {
    ...actual,
    getResolvedProfileId: vi.fn(() => ""),
  };
});

const { getResolvedProfileId } = await import("@/app/features/profiles/services/profile-runtime-scope");

const createMessage = (id: string): Message => ({
  id,
  kind: "user",
  conversationId: "dm:self:peer",
  content: "hello",
  timestamp: new Date(1_000),
  isOutgoing: false,
  status: "delivered",
  senderPubkey: "aa".repeat(32),
});

describe("messageBus profile isolation", () => {
  afterEach(() => {
    setProfileRuntimeScope(null);
    vi.mocked(getResolvedProfileId).mockReturnValue("");
  });

  it("does not deliver profile-scoped deletes to another profile subscriber", () => {
    const profileAHandler = vi.fn();
    const profileBHandler = vi.fn();
    messageBus.subscribe(profileAHandler, { profileId: "profile-a" });
    messageBus.subscribe(profileBHandler, { profileId: "profile-b" });

    messageBus.emitMessageDeleted("dm:self:peer", "msg-1", { sourceProfileId: "profile-a" });

    expect(profileAHandler).toHaveBeenCalledTimes(1);
    expect(profileBHandler).not.toHaveBeenCalled();
  });

  it("tags emits with getResolvedProfileId when sourceProfileId is omitted", () => {
    vi.mocked(getResolvedProfileId).mockReturnValue("profile-a");
    const bus = createProfileMessageBus({ profileId: "profile-a" });
    setProfileRuntimeScope({ profileId: "profile-a", bus });

    const profileAHandler = vi.fn();
    const profileBHandler = vi.fn();
    messageBus.subscribe(profileAHandler, { profileId: "profile-a" });
    messageBus.subscribe(profileBHandler, { profileId: "profile-b" });

    messageBus.emitNewMessage("dm:self:peer", createMessage("live-1"));

    expect(profileAHandler).toHaveBeenCalledTimes(1);
    expect(profileBHandler).not.toHaveBeenCalled();
  });

  it("delivers to unscoped subscribers for backward compatibility", () => {
    const unscopedHandler = vi.fn();
    messageBus.subscribe(unscopedHandler);

    messageBus.emitMessageDeleted("dm:self:peer", "msg-legacy", { sourceProfileId: "profile-a" });

    expect(unscopedHandler).toHaveBeenCalledTimes(1);
  });
});
