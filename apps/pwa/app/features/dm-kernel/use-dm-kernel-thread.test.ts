import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Message } from "@/app/features/messaging/types";
import { messageBus } from "@/app/features/messaging/services/message-bus";
import { useDmKernelThread } from "./use-dm-kernel-thread";

const loadDmKernelThreadMock = vi.hoisted(() => vi.fn(async () => [] as Message[]));

vi.mock("./dm-kernel-thread-port", () => ({
  DM_KERNEL_PAGE_SIZE: 200,
  loadDmKernelThread: loadDmKernelThreadMock,
}));

vi.mock("./dm-kernel-integrity", () => ({
  logDmKernelOneSidedIfNeeded: vi.fn(),
}));

vi.mock("@/app/features/profiles/services/profile-runtime-scope", () => ({
  getResolvedProfileId: () => "profile-a",
}));

const myPublicKeyHex = "a".repeat(64);
const peerPublicKeyHex = "b".repeat(64);
const canonicalConversationId = [myPublicKeyHex, peerPublicKeyHex].sort().join(":");

const createMessage = (overrides: Partial<Message> = {}): Message => ({
  id: "msg-1",
  kind: "user",
  content: "hello",
  timestamp: new Date(1_717_000_000_000),
  isOutgoing: false,
  status: "delivered",
  senderPubkey: peerPublicKeyHex,
  recipientPubkey: myPublicKeyHex,
  conversationId: canonicalConversationId,
  ...overrides,
});

describe("useDmKernelThread", () => {
  beforeEach(() => {
    loadDmKernelThreadMock.mockReset();
    loadDmKernelThreadMock.mockResolvedValue([]);
  });

  it("appends new_message bus events without reloading sqlite", async () => {
    const { result } = renderHook(() => useDmKernelThread(canonicalConversationId, myPublicKeyHex));

    await waitFor(() => {
      expect(result.current.hasHydrated).toBe(true);
    });

    act(() => {
      messageBus.emitNewMessage(canonicalConversationId, createMessage(), { sourceProfileId: "profile-a" });
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0]?.content).toBe("hello");
    });
  });

  it("accepts incoming events by sender pubkey when conversation ids differ", async () => {
    const legacyConversationId = peerPublicKeyHex;
    const { result } = renderHook(() => useDmKernelThread(legacyConversationId, myPublicKeyHex));

    await waitFor(() => {
      expect(result.current.hasHydrated).toBe(true);
    });

    act(() => {
      messageBus.emitNewMessage(
        "unexpected:conversation:id",
        createMessage(),
        { sourceProfileId: "profile-a" },
      );
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
    });
  });

  it("accepts sibling conversation ids for live events", async () => {
    const legacyConversationId = peerPublicKeyHex;
    const { result } = renderHook(() => useDmKernelThread(legacyConversationId, myPublicKeyHex));

    await waitFor(() => {
      expect(result.current.hasHydrated).toBe(true);
    });

    act(() => {
      messageBus.emitNewMessage(canonicalConversationId, createMessage(), { sourceProfileId: "profile-a" });
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
    });
  });

  it("appends message_updated when the row is not yet in thread state", async () => {
    const { result } = renderHook(() => useDmKernelThread(canonicalConversationId, myPublicKeyHex));

    await waitFor(() => {
      expect(result.current.hasHydrated).toBe(true);
    });

    const outgoing = createMessage({
      id: "550e8400-e29b-41d4-a716-446655440000",
      eventId: "c".repeat(64),
      content: "sent",
      isOutgoing: true,
      status: "accepted",
      senderPubkey: myPublicKeyHex,
      recipientPubkey: peerPublicKeyHex,
    });

    act(() => {
      messageBus.emitMessageUpdated(canonicalConversationId, outgoing, { sourceProfileId: "profile-a" });
    });

    await waitFor(() => {
      expect(result.current.messages).toHaveLength(1);
      expect(result.current.messages[0]?.content).toBe("sent");
    });
  });
});
