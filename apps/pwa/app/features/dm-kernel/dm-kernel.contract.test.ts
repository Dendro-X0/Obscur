import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { countDmKernelDirections, isDmKernelOneSided } from "./dm-kernel-integrity";
import { isDmKernelAuthority, isDmKernelRelaySyncSuppressed } from "./dm-kernel-policy";

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: vi.fn(() => true),
}));

vi.mock("@dweb/db", () => ({
  dbGetMessages: vi.fn(async () => []),
}));

describe("dm-kernel policy", () => {
  it("is active on native runtime by default", () => {
    expect(isDmKernelAuthority()).toBe(true);
  });

  it("suppresses automatic relay history sync on native", () => {
    expect(isDmKernelRelaySyncSuppressed()).toBe(true);
  });
});

describe("dm-kernel integrity", () => {
  it("detects one-sided threads", () => {
    const messages = [
      { id: "1", senderPubkey: "aa".repeat(32), isOutgoing: true },
      { id: "2", senderPubkey: "aa".repeat(32), isOutgoing: true },
    ] as never;

    expect(isDmKernelOneSided(messages, "aa".repeat(32))).toBe(true);
    expect(countDmKernelDirections(messages, "aa".repeat(32))).toEqual({
      outgoing: 2,
      incoming: 0,
      total: 2,
    });
  });

  it("accepts bidirectional threads", () => {
    const self = "aa".repeat(32);
    const peer = "bb".repeat(32);
    const messages = [
      { id: "1", senderPubkey: self },
      { id: "2", senderPubkey: peer },
    ] as never;

    expect(isDmKernelOneSided(messages, self)).toBe(false);
  });
});

describe("dm-kernel quarantine", () => {
  const pwaRoot = path.resolve(__dirname, "../../..");
  const kernelDir = path.join(pwaRoot, "app/features/dm-kernel");
  const forbidden = [
    "dm-conversation-hydrate-pipeline",
    "assembleDmHydrateThreadReadModel",
    "dm-read-authority-contract",
    "use-conversation-messages",
  ];

  const kernelFiles = [
    "dm-kernel-policy.ts",
    "dm-kernel-thread-port.ts",
    "dm-kernel-integrity.ts",
    "dm-kernel-conversation-list.ts",
    "use-dm-kernel-thread.ts",
  ];

  it("does not import hydrate pipeline modules", () => {
    const combined = kernelFiles
      .map((file) => readFileSync(path.join(kernelDir, file), "utf8"))
      .join("\n");
    for (const token of forbidden) {
      expect(combined).not.toContain(token);
    }
  });

  it("routes native DM through use-thread-messages kernel branch", () => {
    const source = readFileSync(
      path.join(pwaRoot, "app/features/messaging/hooks/use-thread-messages.ts"),
      "utf8",
    );
    expect(source).toContain("isDmKernelAuthority");
    expect(source).toContain("useDmKernelThread");
  });

  it("dm-controller suppresses automatic relay sync when dm-kernel is active", () => {
    const source = readFileSync(
      path.join(pwaRoot, "app/features/messaging/controllers/v2/dm-controller.ts"),
      "utf8",
    );
    expect(source).toContain("isDmKernelRelaySyncSuppressed");
    expect(source).toMatch(/isDmKernelRelaySyncSuppressed\(\)\s*&&\s*since\s*===\s*undefined/);
  });

  it("dm-controller emits new_message on optimistic send for dm-kernel live thread", () => {
    const source = readFileSync(
      path.join(pwaRoot, "app/features/messaging/controllers/v2/dm-controller.ts"),
      "utf8",
    );
    expect(source).toContain("onNewMessageRef.current?.(optimisticMessage)");
  });

  it("dm-kernel thread matches sibling conversation ids on message bus", () => {
    const source = readFileSync(
      path.join(kernelDir, "use-dm-kernel-thread.ts"),
      "utf8",
    );
    expect(source).toContain("buildDmSiblingConversationIds");
    expect(source).toContain("doesLiveDmBusEventBelongToThread");
  });
});
