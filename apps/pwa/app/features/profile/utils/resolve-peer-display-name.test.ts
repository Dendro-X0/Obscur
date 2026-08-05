import { describe, expect, it } from "vitest";
import {
  formatPeerPubkeyPreview,
  isPeerPubkeyPlaceholderName,
  resolvePeerDisplayName,
} from "./resolve-peer-display-name";

const PUBKEY = "e07f67dcb8a58f53b13fd15ae549c31fb3817a3a6cf0e0123456789abcdef012";

describe("resolvePeerDisplayName", () => {
  it("prefers meaningful metadata over fallback and hex", () => {
    expect(resolvePeerDisplayName({
      pubkey: PUBKEY,
      metadataDisplayName: "Tester1",
      fallbackDisplayName: PUBKEY,
    })).toBe("Tester1");
  });

  it("uses meaningful conversation fallback when metadata missing", () => {
    expect(resolvePeerDisplayName({
      pubkey: PUBKEY,
      metadataDisplayName: null,
      fallbackDisplayName: "Alice",
    })).toBe("Alice");
  });

  it("rejects full-hex and truncated-hex fallbacks", () => {
    expect(isPeerPubkeyPlaceholderName(PUBKEY, PUBKEY)).toBe(true);
    expect(isPeerPubkeyPlaceholderName(`${PUBKEY.slice(0, 8)}...${PUBKEY.slice(-8)}`, PUBKEY)).toBe(true);
    expect(resolvePeerDisplayName({
      pubkey: PUBKEY,
      metadataDisplayName: null,
      fallbackDisplayName: PUBKEY,
    })).toBe(formatPeerPubkeyPreview(PUBKEY));
  });

  it("returns short pubkey preview when nothing else is meaningful", () => {
    expect(formatPeerPubkeyPreview(PUBKEY)).toBe(`${PUBKEY.slice(0, 8)}…${PUBKEY.slice(-8)}`);
    expect(resolvePeerDisplayName({
      pubkey: PUBKEY,
    })).toBe(`${PUBKEY.slice(0, 8)}…${PUBKEY.slice(-8)}`);
  });
});
