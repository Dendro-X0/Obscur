import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { shouldUseHostTransportPublishShim } from "@/app/features/transport-kernel/transport-kernel-publish-port";

const PWA_ROOT = join(__dirname, "../../../../apps/pwa");

const readFromPwa = (relFromPwa: string): string => (
  readFileSync(join(PWA_ROOT, relFromPwa), "utf8")
);

describe("transport-engine w34 — host publish shim policy gate", () => {
  it("exposes shouldUseHostTransportPublishShim defaulting to false", () => {
    expect(shouldUseHostTransportPublishShim()).toBe(false);
  });

  it("pins shim gate in publish port policy with engine-lab gating", () => {
    const policy = readFromPwa("app/features/transport-kernel/transport-kernel-publish-port.ts");
    expect(policy).toContain("shouldUseHostTransportPublishShim");
    expect(policy).toContain("isEngineLabStrictMode");
  });
});
