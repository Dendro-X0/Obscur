import { describe, expect, it } from "vitest";
import {
  assessQuickGroupCreate,
  pickDefaultQuickGroupRelayHost,
  resolveHostingTierForCreate,
} from "./community-quick-group-create";

describe("community-quick-group-create", () => {
  it("allows create on Quiet public relays", () => {
    const assessment = assessQuickGroupCreate({
      communityRelayUrl: "wss://relay.primal.net",
      enabledRelayUrls: ["wss://relay.primal.net", "wss://nos.lol"],
    });
    expect(assessment.allowed).toBe(true);
    expect(assessment.isPublicQuietHost).toBe(true);
    expect(assessment.reasonCode).toBe("allowed");
  });

  it("rejects empty host", () => {
    const assessment = assessQuickGroupCreate({
      communityRelayUrl: "",
      enabledRelayUrls: ["wss://relay.primal.net"],
    });
    expect(assessment.allowed).toBe(false);
    expect(assessment.reasonCode).toBe("relay_unconfigured");
  });

  it("picks a public Quiet host by default", () => {
    const host = pickDefaultQuickGroupRelayHost([
      { url: "wss://relay.primal.net", enabled: true },
      { url: "ws://localhost:7000", enabled: true },
    ]);
    expect(host).toBe("relay.primal.net");
  });

  it("resolves hostingTier for T0 Quiet, T0 custom, and T1", () => {
    expect(resolveHostingTierForCreate({
      communityMode: "sovereign_room",
      isPublicQuietHost: true,
    })).toBe("public_quiet");
    expect(resolveHostingTierForCreate({
      communityMode: "sovereign_room",
      isPublicQuietHost: false,
    })).toBe("custom");
    expect(resolveHostingTierForCreate({
      communityMode: "managed_workspace",
      isPublicQuietHost: false,
    })).toBe("operator");
  });
});
