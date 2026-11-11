import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearExclusiveIntentIfEnablingNonLabRelay,
  clearExclusiveTransportPresetIntent,
  readExclusiveTransportPresetIntent,
  reenableExclusivePresetRelays,
  shouldSkipPublicBootMergeForExclusiveIntent,
  syncExclusiveTransportPresetIntentAfterApply,
  writeExclusiveTransportPresetIntent,
} from "./transport-exclusive-intent";
import { getTransportPreset } from "./transport-preset-catalog";

const PROFILE = "tester1";
const STORAGE_KEY = `obscur.transport.exclusive_preset.v1::${PROFILE}`;

describe("transport-exclusive-intent", () => {
  beforeEach(() => {
    vi.stubGlobal("window", {
      localStorage: (() => {
        const map = new Map<string, string>();
        return {
          getItem: (key: string) => map.get(key) ?? null,
          setItem: (key: string, value: string) => {
            map.set(key, value);
          },
          removeItem: (key: string) => {
            map.delete(key);
          },
        };
      })(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("writes and reads exclusive private_mesh intent", () => {
    writeExclusiveTransportPresetIntent("local_dev_mesh", PROFILE);
    expect(readExclusiveTransportPresetIntent(PROFILE)).toBe("local_dev_mesh");
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("local_dev_mesh");
  });

  it("clears intent", () => {
    writeExclusiveTransportPresetIntent("local_dev_mesh", PROFILE);
    clearExclusiveTransportPresetIntent(PROFILE);
    expect(readExclusiveTransportPresetIntent(PROFILE)).toBeNull();
  });

  it("syncAfterApply sets intent for private_mesh and clears for public", () => {
    const privateMesh = getTransportPreset("local_dev_mesh");
    const defaultStable = getTransportPreset("default_stable");
    expect(privateMesh).toBeDefined();
    expect(defaultStable).toBeDefined();
    syncExclusiveTransportPresetIntentAfterApply(privateMesh!, PROFILE);
    expect(readExclusiveTransportPresetIntent(PROFILE)).toBe("local_dev_mesh");
    syncExclusiveTransportPresetIntentAfterApply(defaultStable!, PROFILE);
    expect(readExclusiveTransportPresetIntent(PROFILE)).toBeNull();
  });

  it("skips public-boot merge when exclusive Soft L3 list matches intent", () => {
    expect(
      shouldSkipPublicBootMergeForExclusiveIntent({
        intent: "local_dev_mesh",
        relays: [{ url: "ws://localhost:7000", enabled: true }],
      }),
    ).toBe(true);
  });

  it("does not skip merge when a public remote is enabled alongside intent", () => {
    expect(
      shouldSkipPublicBootMergeForExclusiveIntent({
        intent: "local_dev_mesh",
        relays: [
          { url: "ws://localhost:7000", enabled: true },
          { url: "wss://relay.damus.io", enabled: true },
        ],
      }),
    ).toBe(false);
  });

  it("skips merge when exclusive intent holds and all relays are disabled", () => {
    expect(
      shouldSkipPublicBootMergeForExclusiveIntent({
        intent: "local_dev_mesh",
        relays: [{ url: "ws://localhost:7000", enabled: false }],
      }),
    ).toBe(true);
  });

  it("reenables exclusive preset URLs when all disabled", () => {
    const result = reenableExclusivePresetRelays({
      intent: "local_dev_mesh",
      relays: [{ url: "ws://localhost:7000", enabled: false }],
    });
    expect(result.changed).toBe(true);
    expect(result.relays).toEqual([{ url: "ws://localhost:7000", enabled: true }]);
  });

  it("does not skip merge without exclusive intent (lab leftover)", () => {
    expect(
      shouldSkipPublicBootMergeForExclusiveIntent({
        intent: null,
        relays: [{ url: "ws://localhost:7000", enabled: true }],
      }),
    ).toBe(false);
  });

  it("clears intent when enabling a non-lab remote", () => {
    writeExclusiveTransportPresetIntent("local_dev_mesh", PROFILE);
    clearExclusiveIntentIfEnablingNonLabRelay(
      { url: "wss://relay.damus.io", enabled: true },
      PROFILE,
    );
    expect(readExclusiveTransportPresetIntent(PROFILE)).toBeNull();
  });

  it("keeps intent when enabling a lab assist URL", () => {
    writeExclusiveTransportPresetIntent("local_dev_mesh", PROFILE);
    clearExclusiveIntentIfEnablingNonLabRelay(
      { url: "ws://localhost:7000", enabled: true },
      PROFILE,
    );
    expect(readExclusiveTransportPresetIntent(PROFILE)).toBe("local_dev_mesh");
  });
});
