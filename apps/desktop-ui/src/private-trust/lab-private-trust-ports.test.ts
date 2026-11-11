import { describe, expect, it } from "vitest";
import { PRIVATE_DC_SILENT_NOSTR_FALLBACK_REFUSED } from "@obscur/private-trust-engine";
import { createLabPrivateTrustHomePorts } from "./lab-private-trust-ports";

describe("Cut 3.3 lab private-trust ports", () => {
  it("defaults to private_dc when H-dc preference is on", () => {
    const ports = createLabPrivateTrustHomePorts({ preferPrivateDc: true });
    expect(ports.resolveProtocolId()).toBe("private_dc");
  });

  it("lists conversations and accepts T3-face send without chat-state", async () => {
    const ports = createLabPrivateTrustHomePorts({ preferPrivateDc: true });
    const conversations = await ports.listConversations();
    expect(conversations.length).toBeGreaterThan(0);
    const conversationId = conversations[0]!.id;

    const sent = await ports.sendDm({
      conversationId,
      body: "hello private-trust",
      carrier: "private_dc",
    });
    expect(sent.ok).toBe(true);
    expect(sent.deliveryStatus).toBe("accepted");

    const thread = await ports.listMessages(conversationId);
    expect(thread.some((row) => row.body === "hello private-trust")).toBe(true);
  });

  it("refuses silent Nostr fallback while private_dc is active", async () => {
    const ports = createLabPrivateTrustHomePorts({ preferPrivateDc: true });
    const conversationId = (await ports.listConversations())[0]!.id;
    const refused = await ports.sendDm({
      conversationId,
      body: "should not fall back",
      carrier: "nostr",
    });
    expect(refused.ok).toBe(false);
    expect(refused.reasonCode).toBe(PRIVATE_DC_SILENT_NOSTR_FALLBACK_REFUSED);
  });
});
