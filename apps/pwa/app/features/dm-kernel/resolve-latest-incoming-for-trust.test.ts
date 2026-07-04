import { describe, expect, it } from "vitest";
import { resolveLatestIncomingForTrust } from "./resolve-latest-incoming-for-trust";
import type { Message } from "@/app/features/messaging/types";

const incoming = (content: string, ms: number): Message => ({
  id: `m-${ms}`,
  kind: "user",
  content,
  timestamp: new Date(ms),
  isOutgoing: false,
  status: "delivered",
});

describe("resolveLatestIncomingForTrust", () => {
  it("prefers hydrated thread messages over sidebar preview", () => {
    const result = resolveLatestIncomingForTrust(
      [incoming("thread body", 2000)],
      {
        lastMessage: "preview only",
        lastMessageTime: new Date(1000),
      },
    );
    expect(result?.content).toBe("thread body");
    expect(result?.attachmentFileNames).toEqual([]);
    expect(result?.senderPublicKeyHex).toBeNull();
  });

  it("falls back to sidebar preview when thread is empty", () => {
    const result = resolveLatestIncomingForTrust(
      [],
      {
        lastMessage: "send $200 wire transfer",
        lastMessageTime: new Date(5000),
        lastMessageIsOutgoing: false,
      },
    );
    expect(result?.content).toBe("send $200 wire transfer");
    expect(result?.timestampUnixMs).toBe(5000);
  });

  it("ignores outgoing sidebar preview", () => {
    const result = resolveLatestIncomingForTrust(
      [],
      {
        lastMessage: "my outgoing text",
        lastMessageTime: new Date(5000),
        lastMessageIsOutgoing: true,
      },
    );
    expect(result).toBeNull();
  });

  it("includes attachment filenames from latest inbound message", () => {
    const result = resolveLatestIncomingForTrust([
      {
        ...incoming("see attachment", 3000),
        attachments: [{
          kind: "file",
          url: "blob:1",
          contentType: "application/octet-stream",
          fileName: "brief.pdf.exe",
        }],
      },
    ]);
    expect(result?.attachmentFileNames).toEqual(["brief.pdf.exe"]);
    expect(result?.senderPublicKeyHex).toBeNull();
  });

  it("includes sender pubkey for group inbound messages", () => {
    const sender = "cc".repeat(32);
    const result = resolveLatestIncomingForTrust([
      {
        ...incoming("group scam link", 4000),
        senderPubkey: sender as import("@dweb/crypto/public-key-hex").PublicKeyHex,
      },
    ]);
    expect(result?.senderPublicKeyHex).toBe(sender);
  });
});
