import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeActiveProtocolId } from "./preferences";
import { writePrivateDcSession, clearPrivateDcSession } from "./private-dc-session";
import { PRIVATE_DC_INVITE_REQUIRES_OBSCUR_NOSTR } from "./private-trust-invite-policy";
import { sendConnectionRequest } from "./layer";

const read = (relativePath: string): string => (
  readFileSync(resolve(process.cwd(), relativePath), "utf8")
);

describe("Cut 2.3 K-INVITE-NOSTR owner-uniqueness", () => {
  it("layer returns SendResult refuse instead of throw for private_dc/matrix", () => {
    const layer = read("app/features/protocol-adaptation/layer.ts");
    expect(layer).toContain("resolveConnectionRequestInvitePolicy");
    expect(layer).toContain("honest refuse");
    expect(layer).not.toMatch(
      /connection requests are Nostr-only/,
    );
  });

  it("SendRequestDialog shows honesty banner and disables send when invite not allowed", () => {
    const dialog = read("app/features/network/components/send-request-dialog.tsx");
    expect(dialog).toContain("resolveConnectionRequestInvitePolicy");
    expect(dialog).toContain("send-request-invite-protocol-honesty");
    expect(dialog).toContain("!invitePolicy.allowed");
  });

  it("migration hints document private_dc invite needs Obscur-Nostr", () => {
    const hints = read("app/features/protocol-adaptation/migration-hints.ts");
    expect(hints).toContain("private-dc-invite-obscur-nostr");
  });
});

describe("Cut 2.3 sendConnectionRequest runtime refuse", () => {
  afterEach(() => {
    clearPrivateDcSession("default");
    window.localStorage.clear();
  });

  it("does not throw when private_dc is active — returns failed SendResult", async () => {
    writePrivateDcSession({ baseUrl: "https://home.example.com" }, "default");
    writeActiveProtocolId("private_dc", "default");

    await expect(sendConnectionRequest({
      pool: {} as never,
      senderPublicKeyHex: "a".repeat(64) as never,
      senderPrivateKeyHex: "b".repeat(64) as never,
      peerPublicKeyHex: "c".repeat(64) as never,
      introMessage: "hi",
    })).resolves.toMatchObject({
      success: false,
      deliveryStatus: "failed",
    });

    const result = await sendConnectionRequest({
      pool: {} as never,
      senderPublicKeyHex: "a".repeat(64) as never,
      senderPrivateKeyHex: "b".repeat(64) as never,
      peerPublicKeyHex: "c".repeat(64) as never,
    });
    expect(result.error).toContain(PRIVATE_DC_INVITE_REQUIRES_OBSCUR_NOSTR);
  });
});
