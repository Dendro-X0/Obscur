import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildTransportSnapshot,
  classifyTransportReadiness,
  createTransportEngine,
} from "@obscur/transport-engine";

const REPO_ROOT = join(__dirname, "../../../../");

describe("transport-engine w0 — snapshot owner", () => {
  it("classifies readiness without relay pool types", () => {
    expect(classifyTransportReadiness({
      writableRelayCount: 1,
      fallbackWritableRelayCount: 0,
      subscribableRelayCount: 1,
      recoveryAttemptCount: 0,
    })).toBe("healthy");
  });

  it("builds phase from adapter metrics only", () => {
    const snapshot = buildTransportSnapshot({
      scope: { profileId: "default" },
      revision: 1,
      enabledRelayUrls: ["wss://relay.one"],
      metrics: {
        enabledRelayCount: 1,
        writableRelayCount: 0,
        fallbackWritableRelayCount: 0,
        subscribableRelayCount: 0,
        writeBlockedRelayCount: 0,
        coolingDownRelayCount: 0,
        fallbackRelayUrls: [],
      },
    });
    expect(snapshot.phase).toBe("connecting");
    expect(snapshot.recovery.readiness).toBe("offline");
  });

  it("headless engine updates revision on apply", () => {
    const engine = createTransportEngine({ profileId: "default" });
    const updated = engine.applyAdapterMetrics({
      enabledRelayCount: 1,
      writableRelayCount: 1,
      fallbackWritableRelayCount: 0,
      subscribableRelayCount: 1,
      writeBlockedRelayCount: 0,
      coolingDownRelayCount: 0,
      fallbackRelayUrls: [],
    });
    expect(updated.revision).toBeGreaterThan(0);
    expect(updated.phase).toBe("healthy");
  });
});

describe("transport-engine w0 — relay recovery delegates to package", () => {
  it("relay recovery types delegate classifier to transport-engine", () => {
    const typesSource = readFileSync(
      join(REPO_ROOT, "apps/pwa/app/features/relays/services/relay-recovery-types.ts"),
      "utf8",
    );
    expect(typesSource).toContain("@obscur/transport-engine");
    expect(typesSource).toContain("classifyTransportReadiness");
  });

  it("legacy relay recovery controller imports transport-engine snapshot builder", () => {
    const source = readFileSync(
      join(REPO_ROOT, "apps/pwa/app/features/relays/services/relay-recovery-controller-legacy.ts"),
      "utf8",
    );
    expect(source).toContain("@obscur/transport-engine");
    expect(source).toContain("buildTransportRecoverySnapshot");
    expect(source).not.toContain("relay-recovery-policy-legacy");
  });

  it("w27 subtracted relay-recovery-policy-legacy stays deleted", () => {
    expect(existsSync(
      join(REPO_ROOT, "apps/pwa/app/legacy/relay-recovery-policy-legacy.ts"),
    )).toBe(false);
  });

  it("enhanced relay pool types live in features; runtime in features legacy module", () => {
    const typesSource = readFileSync(
      join(REPO_ROOT, "apps/pwa/app/features/relays/hooks/enhanced-relay-pool-types.ts"),
      "utf8",
    );
    const poolSource = readFileSync(
      join(REPO_ROOT, "apps/pwa/app/features/relays/hooks/enhanced-relay-pool-legacy.ts"),
      "utf8",
    );
    expect(typesSource).toContain("EnhancedRelayPoolResult");
    expect(typesSource).not.toMatch(/from\s+["']react["']/);
    expect(poolSource).toContain("useLegacyEnhancedRelayPool");
    expect(poolSource).toContain("enhanced-relay-pool-types");
    expect(poolSource).not.toMatch(/@\/app\/legacy\//);
  });

  it("transport-kernel policy is native authority by default", () => {
    const source = readFileSync(
      join(REPO_ROOT, "apps/pwa/app/features/transport-kernel/transport-kernel-policy.ts"),
      "utf8",
    );
    expect(source).toContain("isEngineLabStrictMode");
    expect(source).toContain("requiresSqlitePersistence");
    expect(source).toContain("isTransportKernelAuthority");
  });

  it("transport-engine package has no apps/pwa imports", () => {
    const source = readFileSync(
      join(REPO_ROOT, "packages/obscur-transport-engine/src/transport-engine.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/apps\/pwa/);
    expect(source).not.toMatch(/WebSocket/);
    expect(source).not.toMatch(/from\s+["']react/);
  });
});
