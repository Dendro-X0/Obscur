import { beforeEach, describe, expect, it, vi } from "vitest";
import { assessCommunityModeHostingConvert } from "./community-mode-convert-policy";

vi.mock("./community-membership-sync-mode", () => ({
  isCoordinationConfigured: () => true,
}));

describe("assessCommunityModeHostingConvert (CU-UX-6)", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_COORDINATION_URL", "http://127.0.0.1:8787");
    vi.stubEnv("NEXT_PUBLIC_DEV_COORDINATION_ONLY_WORKSPACE", "");
  });

  const actor = "a".repeat(64);

  it("allows no-op when mode and host unchanged", () => {
    const result = assessCommunityModeHostingConvert({
      currentMode: "sovereign_room",
      currentRelayUrl: "wss://nos.lol",
      nextMode: "sovereign_room",
      nextRelayHostOrUrl: "nos.lol",
      actorPublicKeyHex: actor,
      actorCanConvertDirect: true,
      honestyAcked: false,
    });
    expect(result.allowed).toBe(true);
    expect(result.reasonCode).toBe("no_change");
    expect(result.modeChanged).toBe(false);
    expect(result.hostChanged).toBe(false);
  });

  it("blocks non-authorized actors", () => {
    const result = assessCommunityModeHostingConvert({
      currentMode: "sovereign_room",
      currentRelayUrl: "wss://nos.lol",
      nextMode: "managed_workspace",
      nextRelayHostOrUrl: "ws://localhost:7000",
      actorPublicKeyHex: actor,
      actorCanConvertDirect: false,
      honestyAcked: true,
      coordinationHealthy: true,
    });
    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe("not_authorized");
  });

  it("allows T0→T1 on private host when coordination healthy and seeds steward", () => {
    const result = assessCommunityModeHostingConvert({
      currentMode: "sovereign_room",
      currentRelayUrl: "wss://nos.lol",
      nextMode: "managed_workspace",
      nextRelayHostOrUrl: "ws://127.0.0.1:7000",
      actorPublicKeyHex: actor,
      actorCanConvertDirect: true,
      honestyAcked: false,
      coordinationHealthy: true,
      currentStewardPubkeys: [],
    });
    expect(result.allowed).toBe(true);
    expect(result.modeChanged).toBe(true);
    expect(result.nextCommunityMode).toBe("managed_workspace");
    expect(result.nextHostingTier).toBe("operator");
    expect(result.seedStewardPubkeys).toEqual([actor]);
  });

  it("requires honesty ack for T0→T1 on public Quiet", () => {
    const blocked = assessCommunityModeHostingConvert({
      currentMode: "sovereign_room",
      currentRelayUrl: "wss://nos.lol",
      nextMode: "managed_workspace",
      nextRelayHostOrUrl: "wss://nos.lol",
      actorPublicKeyHex: actor,
      actorCanConvertDirect: true,
      honestyAcked: false,
      coordinationHealthy: true,
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.reasonCode).toBe("public_honesty_required");
    expect(blocked.requiresHonestyAck).toBe(true);

    const allowed = assessCommunityModeHostingConvert({
      currentMode: "sovereign_room",
      currentRelayUrl: "wss://nos.lol",
      nextMode: "managed_workspace",
      nextRelayHostOrUrl: "wss://nos.lol",
      actorPublicKeyHex: actor,
      actorCanConvertDirect: true,
      honestyAcked: true,
      coordinationHealthy: true,
    });
    expect(allowed.allowed).toBe(true);
    expect(allowed.nextHostingTier).toBe("public_quiet");
  });

  it("requires demote honesty for T1→T0", () => {
    const blocked = assessCommunityModeHostingConvert({
      currentMode: "managed_workspace",
      currentRelayUrl: "ws://127.0.0.1:7000",
      nextMode: "sovereign_room",
      nextRelayHostOrUrl: "ws://127.0.0.1:7000",
      actorPublicKeyHex: actor,
      actorCanConvertDirect: true,
      honestyAcked: false,
      coordinationHealthy: true,
      currentStewardPubkeys: [actor],
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.reasonCode).toBe("demote_honesty_required");

    const allowed = assessCommunityModeHostingConvert({
      currentMode: "managed_workspace",
      currentRelayUrl: "ws://127.0.0.1:7000",
      nextMode: "sovereign_room",
      nextRelayHostOrUrl: "ws://127.0.0.1:7000",
      actorPublicKeyHex: actor,
      actorCanConvertDirect: true,
      honestyAcked: true,
      coordinationHealthy: true,
      currentStewardPubkeys: [actor],
    });
    expect(allowed.allowed).toBe(true);
    expect(allowed.nextCommunityMode).toBe("sovereign_room");
    expect(allowed.seedStewardPubkeys).toEqual([actor]);
  });

  it("blocks T0→T1 when coordination unreachable", () => {
    const result = assessCommunityModeHostingConvert({
      currentMode: "sovereign_room",
      currentRelayUrl: "ws://127.0.0.1:7000",
      nextMode: "managed_workspace",
      nextRelayHostOrUrl: "ws://127.0.0.1:7000",
      actorPublicKeyHex: actor,
      actorCanConvertDirect: true,
      honestyAcked: true,
      coordinationHealthy: false,
    });
    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe("coordination_required");
  });

  it("updates hostingTier when host changes Quiet→private on T1", () => {
    const result = assessCommunityModeHostingConvert({
      currentMode: "managed_workspace",
      currentRelayUrl: "wss://nos.lol",
      nextMode: "managed_workspace",
      nextRelayHostOrUrl: "ws://127.0.0.1:7000",
      actorPublicKeyHex: actor,
      actorCanConvertDirect: true,
      honestyAcked: true,
      coordinationHealthy: true,
      currentStewardPubkeys: [actor],
    });
    expect(result.allowed).toBe(true);
    expect(result.hostChanged).toBe(true);
    expect(result.nextHostingTier).toBe("operator");
  });
});
