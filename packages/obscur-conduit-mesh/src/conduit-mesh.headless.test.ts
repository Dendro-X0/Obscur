import { describe, expect, it, beforeEach } from "vitest";

import type { ConduitDescriptor, MeshEnvelope } from "@obscur/conduit-mesh-contracts";

import { createConduitMesh } from "./create-conduit-mesh";
import { createMockConduitDriver, resetMockConduitDriverCounters } from "./mock-conduit-driver";

const FIXED_NOW = 1_700_000_000_000;

const teamDescriptor = (): ConduitDescriptor => ({
  conduitId: "team-primary",
  dialect: "team_relay",
  endpoints: ["wss://relay.internal.example"],
  capabilities: ["publish", "subscribe"],
  networkPolicy: "clearnet",
  trustTier: "operator_attested",
  enabled: true,
  priority: 0,
});

const customDescriptor = (): ConduitDescriptor => ({
  conduitId: "custom-home",
  dialect: "custom",
  endpoints: ["https://mesh.example.internal"],
  capabilities: ["publish", "pull"],
  networkPolicy: "clearnet",
  trustTier: "user_configured",
  enabled: true,
  priority: 1,
});

const sampleEnvelope = (): MeshEnvelope => ({
  envelopeId: "env-dm-1",
  scope: { profileId: "profile-a" },
  messageScope: "dm",
  audience: { kind: "dm", recipientPublicKeyHex: "deadbeef" },
  ciphertext: new Uint8Array([9, 9, 9]),
  evidenceClass: "at_least_one_conduit_accept",
  createdAtUnixMs: FIXED_NOW,
});

describe("conduit-mesh headless — C2", () => {
  beforeEach(() => {
    resetMockConduitDriverCounters();
  });

  it("configures conduits and reports healthy snapshot without Nostr", async () => {
    const mesh = createConduitMesh({
      scope: { profileId: "profile-a" },
      now: () => FIXED_NOW,
    });

    await mesh.configureConduits([teamDescriptor(), customDescriptor()]);
    const snapshot = await mesh.getSnapshot({ profileId: "profile-a" });

    expect(snapshot.configuredConduitCount).toBe(2);
    expect(snapshot.deploymentTier).toBe("private_trust");
    expect(snapshot.readiness).toBe("healthy");
    expect(snapshot.activeConduits.every((c) => c.descriptor.dialect !== "nostr_ws")).toBe(true);
  });

  it("promotes to fallback conduit when primary publish fails", async () => {
    const mesh = createConduitMesh({
      scope: { profileId: "profile-a" },
      now: () => FIXED_NOW,
      createDriver: (descriptor) => {
        if (descriptor.conduitId === "team-primary") {
          return createMockConduitDriver({
            descriptor,
            publishBehavior: "fail",
            failureReason: "team_circuit_open",
            now: () => FIXED_NOW,
          });
        }
        return createMockConduitDriver({
          descriptor,
          now: () => FIXED_NOW,
        });
      },
    });

    await mesh.configureConduits([teamDescriptor(), customDescriptor()]);

    const evidenceKinds: string[] = [];
    mesh.subscribeEvidence((record) => {
      evidenceKinds.push(record.kind);
    });

    const outcome = await mesh.publishEnvelope(sampleEnvelope());

    expect(outcome.accepted).toBe(true);
    expect(outcome.evidence.some((e) => e.conduitId === "team-primary" && e.kind === "publish_failed")).toBe(true);
    expect(outcome.evidence.some((e) => e.conduitId === "custom-home" && e.kind === "accepted_by_operator")).toBe(true);
    expect(evidenceKinds).toContain("evidence_class_satisfied");
  });

  it("fails closed when all conduits reject publish", async () => {
    const mesh = createConduitMesh({
      scope: { profileId: "profile-a" },
      now: () => FIXED_NOW,
      createDriver: (descriptor) => createMockConduitDriver({
        descriptor,
        publishBehavior: "fail",
        failureReason: "all_down",
        now: () => FIXED_NOW,
      }),
    });

    await mesh.configureConduits([teamDescriptor(), customDescriptor()]);
    const outcome = await mesh.publishEnvelope(sampleEnvelope());
    const snapshot = await mesh.getSnapshot({ profileId: "profile-a" });

    expect(outcome.accepted).toBe(false);
    expect(outcome.errorMessage).toBe("all_down");
    expect(snapshot.recoveryReasonCode).toBe("publish_timeouts");
    expect(mesh.evidenceLedger.listForEnvelope("env-dm-1").length).toBeGreaterThan(0);
  });

  it("records evidence in ledger and notifies subscribers", async () => {
    const mesh = createConduitMesh({
      scope: { profileId: "profile-a" },
      now: () => FIXED_NOW,
    });

    await mesh.configureConduits([customDescriptor()]);

    let notifyCount = 0;
    const unsubscribe = mesh.subscribeEvidence(() => {
      notifyCount += 1;
    });

    await mesh.publishEnvelope(sampleEnvelope());
    unsubscribe();
    await mesh.publishEnvelope({ ...sampleEnvelope(), envelopeId: "env-dm-2" });

    expect(notifyCount).toBeGreaterThan(0);
    expect(mesh.evidenceLedger.listForEnvelope("env-dm-1").length).toBeGreaterThan(0);
  });
});
