import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Slice S3 — shell-facing canonical types stay free of Nostr wire fields.
 * Existing rich `Message` is left in place.
 */
describe("decoupling S3 canonical boundary", () => {
  const featureRoot = path.resolve(__dirname, "..");
  const typesSource = readFileSync(path.join(__dirname, "types.ts"), "utf8");
  const indexSource = readFileSync(path.join(__dirname, "index.ts"), "utf8");
  const messageTypes = readFileSync(
    path.join(featureRoot, "messaging/types/index.ts"),
    "utf8",
  );

  const block = (name: string): string => {
    const match = typesSource.match(
      new RegExp(`export type ${name} = Readonly<\\{([\\s\\S]*?)\\}>;`),
    );
    expect(match, name).toBeTruthy();
    return match?.[1] ?? "";
  };

  const forbidden = ["eventId", "senderPubkey", "recipientPubkey", "nip", "relayUrl", "relayPublishedEventId"];

  it("keeps CanonicalMessage and CanonicalConversation free of Nostr wire fields", () => {
    const message = block("CanonicalMessage");
    const conversation = block("CanonicalConversation");
    expect(message).toContain("body: string");
    expect(message).toContain("direction:");
    expect(conversation).toContain("title: string");
    for (const field of forbidden) {
      expect(message).not.toContain(field);
      expect(conversation).not.toContain(field);
    }
  });

  it("keeps canonical send params to conversationId and body", () => {
    const send = typesSource.slice(typesSource.indexOf("sendMessage:"));
    const params = send.slice(0, send.indexOf("}>"));
    expect(params).toContain("conversationId: string");
    expect(params).toContain("body: string");
    for (const field of forbidden) {
      expect(params).not.toContain(field);
    }
  });

  it("does not export the rich Message type from the protocol-adaptation public index", () => {
    expect(indexSource).not.toMatch(/export type \{[^}]*\bMessage\b/);
    expect(indexSource).not.toMatch(/export type \{[^}]*\bDmConversation\b/);
    expect(indexSource).toContain("CanonicalMessage");
  });

  it("leaves the existing rich Message type in the messaging module", () => {
    expect(messageTypes).toContain("export type Message = Readonly<{");
    expect(messageTypes).toContain("eventId?:");
    expect(messageTypes).toContain("senderPubkey?:");
  });
});
