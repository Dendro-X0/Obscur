import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PersistedChatState } from "@/app/features/messaging/types";

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: vi.fn(() => false),
}));

vi.mock("./dm-kernel-policy", () => ({
  isDmKernelAuthority: vi.fn(() => false),
}));

import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";
import { isDmKernelAuthority } from "./dm-kernel-policy";
import {
  isDmKernelChatStateMessageIoSuppressed,
  projectChatStateReadForDmKernelAuthority,
  sanitizeChatStateForNativeDmKernelMirror,
} from "./dm-kernel-chat-state-io-policy";

const sampleState = (): PersistedChatState => ({
  version: 2,
  createdConnections: [],
  createdGroups: [],
  unreadByConversationId: {},
  connectionOverridesByConnectionId: {},
  messagesByConversationId: {
    "dm:peer": [{ id: "m1", content: "hello", timestampMs: 1, senderPubkey: "aa" }],
  },
  groupMessages: {
    "group:1": [{ id: "g1", content: "group", timestampMs: 2, senderPubkey: "bb" }],
  },
  connectionRequests: [],
  pinnedChatIds: [],
  hiddenChatIds: [],
});

describe("dm-kernel-chat-state-io-policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isDmKernelAuthority).mockReturnValue(false);
    vi.mocked(requiresSqlitePersistence).mockReturnValue(false);
  });

  it("suppresses chat-state DM message I/O only on native dm-kernel authority", () => {
    expect(isDmKernelChatStateMessageIoSuppressed()).toBe(false);

    vi.mocked(isDmKernelAuthority).mockReturnValue(true);
    expect(isDmKernelChatStateMessageIoSuppressed()).toBe(false);

    vi.mocked(requiresSqlitePersistence).mockReturnValue(true);
    expect(isDmKernelChatStateMessageIoSuppressed()).toBe(true);
  });

  it("strips message bodies from native mirror writes and reads", () => {
    vi.mocked(isDmKernelAuthority).mockReturnValue(true);
    vi.mocked(requiresSqlitePersistence).mockReturnValue(true);

    const sanitized = sanitizeChatStateForNativeDmKernelMirror(sampleState());
    expect(sanitized.messagesByConversationId).toEqual({});
    expect(sanitized.groupMessages).toEqual({});
    expect(sanitized.pinnedChatIds).toEqual([]);

    expect(projectChatStateReadForDmKernelAuthority(sampleState())?.messagesByConversationId).toEqual({});
    expect(projectChatStateReadForDmKernelAuthority(null)).toBeNull();
  });

  it("passes chat-state through unchanged on web", () => {
    const state = sampleState();
    expect(sanitizeChatStateForNativeDmKernelMirror(state)).toBe(state);
    expect(projectChatStateReadForDmKernelAuthority(state)).toBe(state);
  });
});
