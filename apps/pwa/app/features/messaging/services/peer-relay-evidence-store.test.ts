import { beforeEach, describe, expect, it } from "vitest";
import { ProfileRegistryService } from "@/app/features/profiles/services/profile-registry-service";
import { peerRelayEvidenceStore, peerRelayEvidenceStoreInternals } from "./peer-relay-evidence-store";

const PEER_A = "a".repeat(64);
const PEER_B = "b".repeat(64);

describe("peerRelayEvidenceStore", () => {
  beforeEach(() => {
    localStorage.clear();
    ProfileRegistryService.switchProfile("default");
    peerRelayEvidenceStore.clear();
  });

  it("records trusted inbound relay URLs for a peer", () => {
    peerRelayEvidenceStore.recordInboundRelay({
      peerPublicKeyHex: PEER_A,
      relayUrl: "wss://relay-a.example",
    });
    peerRelayEvidenceStore.recordInboundRelay({
      peerPublicKeyHex: PEER_A,
      relayUrl: "wss://relay-b.example/",
    });

    expect(peerRelayEvidenceStore.getRelayUrls(PEER_A)).toEqual([
      "wss://relay-b.example",
      "wss://relay-a.example",
    ]);
  });

  it("ignores untrusted relay URL schemes", () => {
    peerRelayEvidenceStore.recordInboundRelay({
      peerPublicKeyHex: PEER_A,
      relayUrl: "http://relay-a.example",
    });
    peerRelayEvidenceStore.recordInboundRelay({
      peerPublicKeyHex: PEER_A,
      relayUrl: "ws://127.0.0.1:7001",
    });

    expect(peerRelayEvidenceStore.getRelayUrls(PEER_A)).toEqual([]);
  });

  it("isolates relay evidence by active profile scope", () => {
    peerRelayEvidenceStore.recordInboundRelay({
      peerPublicKeyHex: PEER_A,
      relayUrl: "wss://default-relay.example",
    });
    const defaultStorageKey = peerRelayEvidenceStoreInternals.getStorageKey();

    const created = ProfileRegistryService.createProfile("Work");
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const workProfileId = created.value.profiles.find((profile) => profile.label === "Work")?.profileId;
    expect(workProfileId).toBeTruthy();
    if (!workProfileId) return;

    ProfileRegistryService.switchProfile(workProfileId);
    const workStorageKey = peerRelayEvidenceStoreInternals.getStorageKey();
    peerRelayEvidenceStore.recordInboundRelay({
      peerPublicKeyHex: PEER_B,
      relayUrl: "wss://work-relay.example",
    });

    expect(workStorageKey).not.toBe(defaultStorageKey);
    expect(peerRelayEvidenceStore.getRelayUrls(PEER_A)).toEqual([]);
    expect(peerRelayEvidenceStore.getRelayUrls(PEER_B)).toEqual(["wss://work-relay.example"]);

    ProfileRegistryService.switchProfile("default");
    expect(peerRelayEvidenceStore.getRelayUrls(PEER_A)).toEqual(["wss://default-relay.example"]);
    expect(peerRelayEvidenceStore.getRelayUrls(PEER_B)).toEqual([]);
  });

  it("drops stale relay evidence during reads", () => {
    const nowUnixMs = Date.now();
    peerRelayEvidenceStore.recordInboundRelay({
      peerPublicKeyHex: PEER_A,
      relayUrl: "wss://stale-relay.example",
      observedAtUnixMs: nowUnixMs - (peerRelayEvidenceStoreInternals.RELAY_EVIDENCE_TTL_MS + 1),
    });

    expect(peerRelayEvidenceStore.getRelayUrls(PEER_A)).toEqual([]);
    expect(peerRelayEvidenceStoreInternals.readState().byPeer[PEER_A]).toBeUndefined();
  });
});
