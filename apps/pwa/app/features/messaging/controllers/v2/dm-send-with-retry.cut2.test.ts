import { afterEach, describe, expect, it, vi } from "vitest";
import { PRIVATE_DC_SILENT_NOSTR_FALLBACK_REFUSED } from "@/app/features/protocol-adaptation/private-trust-compose-policy";
import { writeActiveProtocolId } from "@/app/features/protocol-adaptation/preferences";
import { writePrivateDcSession, clearPrivateDcSession } from "@/app/features/protocol-adaptation/private-dc-session";
import { sendDmWithRetry } from "./dm-send-with-retry";

vi.mock("@/app/features/runtime/native-persistence-policy", () => ({
  requiresSqlitePersistence: () => true,
}));

const PROFILE = "default";

describe("Cut 2.2 sendDmWithRetry silent Nostr refuse", () => {
  afterEach(() => {
    clearPrivateDcSession(PROFILE);
    window.localStorage.clear();
  });

  it("refuses when private_dc is the active product face", async () => {
    writePrivateDcSession({ baseUrl: "https://home.example.com" }, PROFILE);
    writeActiveProtocolId("private_dc", PROFILE);

    const result = await sendDmWithRetry({
      pool: {
        publishEvent: async () => [],
      } as never,
      senderPublicKeyHex: "a".repeat(64) as never,
      senderPrivateKeyHex: "b".repeat(64) as never,
      recipientPublicKeyHex: "c".repeat(64) as never,
      plaintext: "hi",
      conversationId: "dm:peer",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(PRIVATE_DC_SILENT_NOSTR_FALLBACK_REFUSED);
    expect(result.queued).toBe(false);
  });
});
