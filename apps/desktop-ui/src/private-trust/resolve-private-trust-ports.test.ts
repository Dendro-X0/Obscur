import { describe, expect, it, vi } from "vitest";
import type { HostEnginePort } from "@obscur/engine-contracts";
import { createLabPrivateTrustHomePorts } from "./lab-private-trust-ports";
import { createNativePrivateTrustHomePorts } from "./native-private-trust-ports";
import { resolveDesktopUiPrivateTrustHomePorts } from "./resolve-private-trust-ports";
import { createFailClosedHomeEnvelopeDeliver } from "./fail-closed-home-deliver";

const stubHost: HostEnginePort = {
  invoke: async () => ({ ok: false, errorMessage: "unused" }),
  getSnapshot: async (engine, scope) => ({
    engine,
    scope,
    phase: "offline",
    revision: 0,
  }),
  subscribe: () => () => undefined,
};

describe("Cut 4.3 resolveDesktopUiPrivateTrustHomePorts", () => {
  const lab = createLabPrivateTrustHomePorts({ preferPrivateDc: true });
  const native = createNativePrivateTrustHomePorts({
    host: stubHost,
    profileId: "lab",
    deliverHomeEnvelope: createFailClosedHomeEnvelopeDeliver(),
  });

  it("prefers lab when stubs forced", () => {
    const resolved = resolveDesktopUiPrivateTrustHomePorts({
      isNativeRuntime: true,
      forceLabStubs: true,
      labPorts: lab,
      nativePorts: native,
    });
    expect(resolved.source).toBe("lab");
    expect(resolved.ports).toBe(lab);
  });

  it("prefers lab when host absent", () => {
    const resolved = resolveDesktopUiPrivateTrustHomePorts({
      isNativeRuntime: false,
      labPorts: lab,
      nativePorts: native,
    });
    expect(resolved.source).toBe("lab");
  });

  it("prefers native when Tauri present and stubs off", () => {
    const resolved = resolveDesktopUiPrivateTrustHomePorts({
      isNativeRuntime: true,
      forceLabStubs: false,
      labPorts: lab,
      nativePorts: native,
    });
    expect(resolved.source).toBe("native");
    expect(resolved.ports).toBe(native);
  });

  it("fail-closed home deliver rejects send path", async () => {
    const deliver = createFailClosedHomeEnvelopeDeliver();
    await expect(deliver({
      conversationId: "peer",
      envelope: "x",
      clientMessageId: "c1",
    })).rejects.toThrow(/fail-closed/i);
    expect(vi.isMockFunction(deliver)).toBe(false);
  });
});
