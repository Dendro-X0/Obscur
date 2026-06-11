import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildComMsgBidirectionalScenarioSnapshots,
  evaluateComMsgTwoProfileColdRestartGate,
} from "./workspace-kernel-com-msg-gate";
import {
  isWorkspaceKernelThreadPortReady,
  loadWorkspaceKernelGroupThreadPage,
} from "./workspace-kernel-thread-port";
import {
  isWorkspaceKernelWritePortReady,
  sendWorkspaceKernelGroupMessage,
} from "./workspace-kernel-write-port";

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: vi.fn(() => true),
}));

vi.mock("@dweb/db", () => ({
  isTauri: vi.fn(() => true),
  dbGetGroupMessages: vi.fn(async () => []),
}));

vi.mock("@/app/features/groups/services/group-service", () => ({
  GroupService: class MockGroupService {
    sendSealedMessage = vi.fn(async () => ({
      id: "evt-workspace-1",
      created_at: 1_700_000_000,
    }));
  },
}));

vi.mock("@/app/features/groups/services/sealed-group-message-persistence", () => ({
  commitSealedGroupMessages: vi.fn(async () => undefined),
}));

vi.mock("@/app/features/messaging/services/thread-history/group-thread-sqlite-store", () => ({
  loadGroupThreadPageFromSqlite: vi.fn(async () => ({
    messages: [{ id: "evt-1", content: "hello", isOutgoing: true, senderPubkey: "a".repeat(64) }],
    hasEarlier: false,
    didExpandHistory: false,
  })),
  loadGroupThreadEarlierFromSqlite: vi.fn(async () => ({
    messages: [],
    hasEarlier: false,
    didExpandHistory: false,
  })),
}));

describe("workspace-kernel COM-MSG gate", () => {
  it("passes bidirectional cold-restart snapshots for two profiles", () => {
    const self = "aa".repeat(32);
    const peer = "bb".repeat(32);
    const scenario = buildComMsgBidirectionalScenarioSnapshots({
      selfPubkey: self,
      peerPubkey: peer,
      outgoingIds: ["out-1", "out-2"],
      incomingIds: ["in-1", "in-2"],
    });
    const result = evaluateComMsgTwoProfileColdRestartGate({
      profileA: scenario.profileA,
      profileB: scenario.profileB,
      expectedMessageIds: scenario.expectedMessageIds,
    });
    expect(result.passed).toBe(true);
    expect(result.reason).toBe("com_msg_ok");
  });

  it("fails when a profile loses messages after restart", () => {
    const self = "aa".repeat(32);
    const peer = "bb".repeat(32);
    const scenario = buildComMsgBidirectionalScenarioSnapshots({
      selfPubkey: self,
      peerPubkey: peer,
      outgoingIds: ["out-1"],
      incomingIds: ["in-1"],
    });
    const result = evaluateComMsgTwoProfileColdRestartGate({
      profileA: scenario.profileA,
      profileB: scenario.profileA.filter((message) => message.id !== "in-1"),
      expectedMessageIds: scenario.expectedMessageIds,
    });
    expect(result.passed).toBe(false);
  });
});

describe("workspace-kernel thread-port", () => {
  it("is ready on native workspace kernel authority", () => {
    expect(isWorkspaceKernelThreadPortReady()).toBe(true);
  });

  it("loads sqlite page through thread-port", async () => {
    const page = await loadWorkspaceKernelGroupThreadPage({
      conversationId: "community:group-1",
      groupId: "group-1",
      myPublicKeyHex: "a".repeat(64),
    });
    expect(page.messages).toHaveLength(1);
    expect(page.messages[0]?.id).toBe("evt-1");
  });
});

describe("workspace-kernel write-port", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("is ready on native tauri", () => {
    expect(isWorkspaceKernelWritePortReady()).toBe(true);
  });

  it("send persists via commitSealedGroupMessages and returns message", async () => {
    const publishSealedEvent = vi.fn(async () => undefined);
    const result = await sendWorkspaceKernelGroupMessage({
      conversationId: "community:group-1",
      groupId: "group-1",
      relayUrl: "ws://localhost:7000",
      publicKeyHex: "a".repeat(64) as `${string}`,
      privateKeyHex: "c".repeat(64) as `${string}`,
      plaintext: "hello workspace",
      publishSealedEvent,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.message.content).toBe("hello workspace");
      expect(result.message.id).toBe("evt-workspace-1");
    }
    expect(publishSealedEvent).toHaveBeenCalledTimes(1);
    const { commitSealedGroupMessages } = await import("@/app/features/groups/services/sealed-group-message-persistence");
    expect(commitSealedGroupMessages).toHaveBeenCalled();
  });
});
