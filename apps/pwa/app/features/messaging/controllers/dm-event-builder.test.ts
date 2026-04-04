import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import { cryptoService } from "@/app/features/crypto/crypto-service";
import { buildDmEvent, dmEventBuilderInternals } from "./dm-event-builder";

vi.mock("@/app/features/crypto/crypto-service", () => ({
  cryptoService: {
    encryptGiftWrap: vi.fn(),
    encryptDM: vi.fn(),
    signEvent: vi.fn(),
  },
}));

const SENDER_PUBKEY = "a".repeat(64) as PublicKeyHex;
const RECIPIENT_PUBKEY = "b".repeat(64) as PublicKeyHex;
const SENDER_PRIVKEY = "1".repeat(64) as PrivateKeyHex;

describe("dm-event-builder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a deterministic canonical rumor id for nip17", async () => {
    const createdAtUnixSeconds = 1_700_000_321;
    const tags = [["p", RECIPIENT_PUBKEY], ["e", "reply-id-1", "", "reply"]];
    const rumorTemplate = {
      kind: 14,
      created_at: createdAtUnixSeconds,
      tags,
      content: "hello rumor",
      pubkey: SENDER_PUBKEY,
    } as const;
    const wrapperEvent = {
      id: "giftwrap-event-1",
      pubkey: "c".repeat(64),
      created_at: createdAtUnixSeconds + 1,
      kind: 1059,
      tags: [["p", RECIPIENT_PUBKEY]],
      content: "encrypted-gift-wrap",
      sig: "d".repeat(128),
    } as NostrEvent;
    vi.mocked(cryptoService.encryptGiftWrap).mockResolvedValueOnce(wrapperEvent);

    const result = await buildDmEvent({
      format: "nip17",
      plaintext: rumorTemplate.content,
      recipientPubkey: RECIPIENT_PUBKEY,
      senderPubkey: SENDER_PUBKEY,
      senderPrivateKeyHex: SENDER_PRIVKEY,
      createdAtUnixSeconds,
      tags,
    });

    const expectedCanonicalEventId = await dmEventBuilderInternals.deriveUnsignedEventId(rumorTemplate);
    expect(result.format).toBe("nip17");
    expect(result.signedEvent.id).toBe("giftwrap-event-1");
    expect(result.canonicalEventId).toBe(expectedCanonicalEventId);
    expect(cryptoService.encryptGiftWrap).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 14,
        created_at: createdAtUnixSeconds,
        tags,
        content: rumorTemplate.content,
        pubkey: SENDER_PUBKEY,
      }),
      SENDER_PRIVKEY,
      RECIPIENT_PUBKEY,
    );
  });

  it("uses signed event id as canonical id for nip04", async () => {
    const createdAtUnixSeconds = 1_700_000_999;
    const tags = [["p", RECIPIENT_PUBKEY]];
    const signedEvent = {
      id: "nip04-event-1",
      pubkey: SENDER_PUBKEY,
      created_at: createdAtUnixSeconds,
      kind: 4,
      tags,
      content: "ciphertext",
      sig: "e".repeat(128),
    } as NostrEvent;

    vi.mocked(cryptoService.encryptDM).mockResolvedValueOnce("ciphertext");
    vi.mocked(cryptoService.signEvent).mockResolvedValueOnce(signedEvent);

    const result = await buildDmEvent({
      format: "nip04",
      plaintext: "hello nip04",
      recipientPubkey: RECIPIENT_PUBKEY,
      senderPubkey: SENDER_PUBKEY,
      senderPrivateKeyHex: SENDER_PRIVKEY,
      createdAtUnixSeconds,
      tags,
    });

    expect(result.format).toBe("nip04");
    expect(result.canonicalEventId).toBe("nip04-event-1");
    expect(cryptoService.signEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        created_at: createdAtUnixSeconds,
      }),
      SENDER_PRIVKEY,
    );
  });
});
