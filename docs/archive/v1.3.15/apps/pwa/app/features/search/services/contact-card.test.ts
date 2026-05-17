import { describe, expect, it } from "vitest";
import { buildContactCardDeepLink, contactCardInternals, decodeContactCard, encodeContactCard, extractContactCardFromQuery } from "./contact-card";
import type { ContactCardV1 } from "@/app/features/search/types/discovery";

describe("contact-card", () => {
  const sampleCard: ContactCardV1 = {
    version: 1,
    pubkey: "a".repeat(64),
    relays: ["wss://relay.damus.io"],
    label: "Alice",
    inviteCode: "OBSCUR-RW8NXD",
    issuedAt: Date.now(),
    expiresAt: Date.now() + 60_000,
  };

  it("round-trips contact card encode/decode", () => {
    const encoded = encodeContactCard(sampleCard);
    const decoded = decodeContactCard(encoded);
    expect(decoded).toMatchObject({
      version: 1,
      pubkey: "a".repeat(64),
      inviteCode: "OBSCUR-RW8NXD",
    });
  });

  it("extracts card payload from deep link", () => {
    const deepLink = buildContactCardDeepLink(sampleCard);
    const parsed = extractContactCardFromQuery(deepLink);
    expect(parsed?.pubkey).toBe(sampleCard.pubkey);
  });

  it("normalizes invite codes to uppercase", () => {
    expect(contactCardInternals.normalizeInviteCode("obscur-rw8nxd")).toBe("OBSCUR-RW8NXD");
  });
});
