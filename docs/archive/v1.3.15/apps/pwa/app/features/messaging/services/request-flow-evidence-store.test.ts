import { beforeEach, describe, expect, it } from "vitest";
import { ProfileRegistryService } from "@/app/features/profiles/services/profile-registry-service";
import { requestFlowEvidenceStore, requestFlowEvidenceStoreInternals } from "./request-flow-evidence-store";

const PEER_A = "a".repeat(64);
const PEER_B = "b".repeat(64);

describe("requestFlowEvidenceStore", () => {
  beforeEach(() => {
    localStorage.clear();
    ProfileRegistryService.switchProfile("default");
  });

  it("persists evidence across restart-style reads within the same profile", () => {
    requestFlowEvidenceStore.markRequestPublished({
      peerPublicKeyHex: PEER_A,
      requestEventId: "req-1",
    });
    requestFlowEvidenceStore.markReceiptAck({
      peerPublicKeyHex: PEER_A,
      requestEventId: "req-1",
    });

    const reloaded = requestFlowEvidenceStoreInternals.readState();
    expect(reloaded.byPeer[PEER_A]?.requestEventId).toBe("req-1");
    expect(reloaded.byPeer[PEER_A]?.receiptAckSeen).toBe(true);
  });

  it("isolates evidence by active profile storage key", () => {
    requestFlowEvidenceStore.markAccept({
      peerPublicKeyHex: PEER_A,
      requestEventId: "accept-default",
    });
    const defaultKey = requestFlowEvidenceStoreInternals.getStorageKey();

    const created = ProfileRegistryService.createProfile("Work");
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    const workId = created.value.profiles.find((profile) => profile.label === "Work")?.profileId;
    expect(workId).toBeTruthy();
    if (!workId) return;

    ProfileRegistryService.switchProfile(workId);
    const workKey = requestFlowEvidenceStoreInternals.getStorageKey();
    requestFlowEvidenceStore.markRequestPublished({
      peerPublicKeyHex: PEER_B,
      requestEventId: "req-work",
    });

    expect(workKey).not.toBe(defaultKey);
    expect(requestFlowEvidenceStore.get(PEER_A).acceptSeen).toBe(false);
    expect(requestFlowEvidenceStore.get(PEER_B).requestEventId).toBe("req-work");

    ProfileRegistryService.switchProfile("default");
    expect(requestFlowEvidenceStore.get(PEER_A).acceptSeen).toBe(true);
    expect(requestFlowEvidenceStore.get(PEER_B).requestEventId).toBeUndefined();
  });
});
