import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PersistedChatState } from "@/app/features/messaging/types";

vi.mock("@dweb/db", () => ({
  isTauri: vi.fn(() => false),
}));

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: vi.fn(() => false),
}));

vi.mock("./dm-kernel-policy", () => ({
  isDmKernelAuthority: vi.fn(() => false),
}));

import { isTauri } from "@dweb/db";
import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";
import { isDmKernelAuthority } from "./dm-kernel-policy";
import {
  isChatStateCrmIoSuppressed,
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
    "dm:peer": [{ id: "m1", content: "hello", timestampMs: 1, isOutgoing: true, status: "delivered", pubkey: "aa" }],
  },
  groupMessages: {
    "group:1": [{ id: "g1", content: "group", created_at: 2, pubkey: "bb" }],
  },
  connectionRequests: [{
    id: "peer",
    status: "accepted",
    isOutgoing: false,
    timestampMs: 1,
  }],
  pinnedChatIds: [],
  hiddenChatIds: [],
});

describe("dm-kernel-chat-state-io-policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isDmKernelAuthority).mockReturnValue(false);
    vi.mocked(requiresSqlitePersistence).mockReturnValue(false);
    vi.mocked(isTauri).mockReturnValue(false);
  });

  it("suppresses chat-state DM message I/O only on native dm-kernel authority", () => {
    expect(isDmKernelChatStateMessageIoSuppressed()).toBe(false);

    vi.mocked(isDmKernelAuthority).mockReturnValue(true);
    expect(isDmKernelChatStateMessageIoSuppressed()).toBe(false);

    vi.mocked(requiresSqlitePersistence).mockReturnValue(true);
    expect(isDmKernelChatStateMessageIoSuppressed()).toBe(true);
  });

  it("suppresses chat-state CRM I/O on native SQLite + Tauri (Cut 1.5)", () => {
    expect(isChatStateCrmIoSuppressed()).toBe(false);

    vi.mocked(requiresSqlitePersistence).mockReturnValue(true);
    expect(isChatStateCrmIoSuppressed()).toBe(false);

    vi.mocked(isTauri).mockReturnValue(true);
    expect(isChatStateCrmIoSuppressed()).toBe(true);
  });

  it("strips message bodies and CRM requests from native mirror writes and reads", () => {
    vi.mocked(isDmKernelAuthority).mockReturnValue(true);
    vi.mocked(requiresSqlitePersistence).mockReturnValue(true);
    vi.mocked(isTauri).mockReturnValue(true);

    const sanitized = sanitizeChatStateForNativeDmKernelMirror(sampleState());
    expect(sanitized.messagesByConversationId).toEqual({});
    expect(sanitized.groupMessages).toEqual({});
    expect(sanitized.connectionRequests).toEqual([]);
    expect(sanitized.pinnedChatIds).toEqual([]);

    expect(projectChatStateReadForDmKernelAuthority(sampleState())?.messagesByConversationId).toEqual({});
    expect(projectChatStateReadForDmKernelAuthority(sampleState())?.connectionRequests).toEqual([]);
    expect(projectChatStateReadForDmKernelAuthority(null)).toBeNull();
  });

  it("strips only messages when CRM surface is off (web sqlite mock without Tauri)", () => {
    vi.mocked(isDmKernelAuthority).mockReturnValue(true);
    vi.mocked(requiresSqlitePersistence).mockReturnValue(true);
    vi.mocked(isTauri).mockReturnValue(false);

    const sanitized = sanitizeChatStateForNativeDmKernelMirror(sampleState());
    expect(sanitized.messagesByConversationId).toEqual({});
    expect(sanitized.connectionRequests).toHaveLength(1);
  });

  it("passes chat-state through unchanged on web", () => {
    const state = sampleState();
    expect(sanitizeChatStateForNativeDmKernelMirror(state)).toBe(state);
    expect(projectChatStateReadForDmKernelAuthority(state)).toBe(state);
  });
});
