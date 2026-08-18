import { describe, expect, it } from "vitest";
import {
  REQUEST_INBOX_PEER_METADATA_LIVE,
  resolveRequestInboxPeerDisplayName,
} from "./resolve-request-inbox-peer-display-name";

const PUBKEY = "e07f67dcb8a58f53b13fd15ae549c31fb3817a3a6cf0e0123456789abcdef012";

describe("resolveRequestInboxPeerDisplayName", () => {
  it("prefers relay kind-0 display name over pending invitation fallback", () => {
    expect(resolveRequestInboxPeerDisplayName({
      pubkey: PUBKEY,
      metadataDisplayName: "DemoUser",
      pendingInvitationFallback: "New Connection",
      unknownPeerFallback: "Unknown peer",
      isRequest: true,
    })).toBe("DemoUser");
  });

  it("uses pending invitation fallback while metadata is still loading", () => {
    expect(resolveRequestInboxPeerDisplayName({
      pubkey: PUBKEY,
      metadataDisplayName: null,
      pendingInvitationFallback: "New Connection",
      unknownPeerFallback: "Unknown peer",
      isRequest: true,
    })).toBe("New Connection");
  });

  it("uses unknown peer fallback for non-request rows", () => {
    expect(resolveRequestInboxPeerDisplayName({
      pubkey: PUBKEY,
      metadataDisplayName: null,
      pendingInvitationFallback: "New Connection",
      unknownPeerFallback: "Unknown peer",
      isRequest: false,
    })).toBe("Unknown peer");
  });

  it("requests inbox metadata hydration is live by default", () => {
    expect(REQUEST_INBOX_PEER_METADATA_LIVE).toBe(true);
  });
});
