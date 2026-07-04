import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const PWA_ROOT = join(__dirname, "../../../");

const read = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

describe("dm-kernel chat-state I/O authority on native", () => {
  it("defines native dm-kernel chat-state message I/O suppression policy", () => {
    const policy = read("app/features/dm-kernel/dm-kernel-chat-state-io-policy.ts");
    expect(policy).toContain("isDmKernelChatStateMessageIoSuppressed");
    expect(policy).toContain("sanitizeChatStateForNativeDmKernelMirror");
    expect(policy).toContain("projectChatStateReadForDmKernelAuthority");
    expect(policy).toContain("isDmKernelAuthority");
    expect(policy).toContain("requiresSqlitePersistence");
  });

  it("message port gates DM message mutations through dm-kernel chat-state policy", () => {
    const port = read("app/features/messaging/services/messaging-chat-state-message-port.ts");
    expect(port).toContain("dm-kernel-chat-state-io-policy");
    expect(port).toContain("isDmKernelChatStateMessageIoSuppressed");
    expect(port).toContain("sanitizeChatStateForNativeDmKernelMirror");
  });

  it("read port projects chat-state loads for dm-kernel authority", () => {
    const port = read("app/features/messaging/services/messaging-chat-state-read-port.ts");
    expect(port).toContain("projectChatStateReadForDmKernelAuthority");
    expect(port).not.toMatch(/@\/app\/legacy\//);
  });

  it("account-sync chat-state port sanitizes native replace payloads", () => {
    const port = read("app/features/account-sync/services/account-sync-chat-state-port.ts");
    expect(port).toContain("sanitizeChatStateForNativeDmKernelMirror");
    expect(port).toContain("isDmKernelChatStateMessageIoSuppressed");
  });

  it("ui mirror port suppresses native conversation message deletes", () => {
    const mirror = read("app/features/messaging/services/messaging-chat-state-ui-mirror.ts");
    expect(mirror).toContain("isDmKernelChatStateMessageIoSuppressed");
    expect(mirror).toContain("deleteConversationMessages");
  });

  it("message persistence mirrors through dm-kernel chat-state policy", () => {
    const persistence = read("app/features/messaging/services/message-persistence-service.ts");
    expect(persistence).toContain("isDmKernelChatStateMessageIoSuppressed");
    expect(persistence).toContain("mirrorMessageToChatState");
  });
});
