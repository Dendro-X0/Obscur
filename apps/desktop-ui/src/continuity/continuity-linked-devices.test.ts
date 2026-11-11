import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  enrollContinuityLinkedDevice,
  listActiveContinuityLinkedDevices,
  readContinuityLinkedDevices,
  revokeContinuityLinkedDevice,
} from "./continuity-linked-devices";

describe("continuity-linked-devices (Cut 12.1)", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
      },
    });
    vi.stubGlobal("crypto", {
      randomUUID: () => "11111111-2222-3333-4444-555555555555",
    });
  });

  it("enrolls and revokes a linked device", () => {
    const enrolled = enrollContinuityLinkedDevice({
      profileId: "default",
      label: "Laptop",
      nowUnixMs: 100,
    });
    expect(enrolled.deviceId).toBe("11111111-2222-3333-4444-555555555555");
    expect(readContinuityLinkedDevices("default")).toHaveLength(1);
    expect(listActiveContinuityLinkedDevices(readContinuityLinkedDevices("default"))).toHaveLength(1);

    const revoked = revokeContinuityLinkedDevice({
      profileId: "default",
      deviceId: enrolled.deviceId,
      nowUnixMs: 200,
    });
    expect(revoked?.revokedAtUnixMs).toBe(200);
    expect(listActiveContinuityLinkedDevices(readContinuityLinkedDevices("default"))).toHaveLength(0);
  });
});
