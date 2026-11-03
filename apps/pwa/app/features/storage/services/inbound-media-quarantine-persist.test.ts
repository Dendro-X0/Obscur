import { beforeEach, describe, expect, it, vi } from "vitest";
import { planInboundMediaWrite } from "./inbound-media-quarantine";
import {
  persistInboundMediaQuarantineBytes,
  readInboundMediaQuarantineBytes,
} from "./inbound-media-quarantine-persist";

const adapterMocks = vi.hoisted(() => ({
  isSupported: vi.fn(),
  ensureDirectory: vi.fn(),
  writeBytes: vi.fn(),
  readBytes: vi.fn(),
  openPath: vi.fn(),
}));

vi.mock("@/app/features/vault/services/native-local-media-adapter", () => ({
  nativeLocalMediaAdapter: {
    isSupported: (...args: unknown[]) => adapterMocks.isSupported(...args),
    ensureDirectory: (...args: unknown[]) => adapterMocks.ensureDirectory(...args),
    writeBytes: (...args: unknown[]) => adapterMocks.writeBytes(...args),
    readBytes: (...args: unknown[]) => adapterMocks.readBytes(...args),
    openPath: (...args: unknown[]) => adapterMocks.openPath(...args),
  },
}));

const SHA = "b".repeat(64);
const BYTES = new Uint8Array([1, 2, 3, 4]);

describe("persistInboundMediaQuarantineBytes (P2-S S2b)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adapterMocks.isSupported.mockReturnValue(true);
    adapterMocks.ensureDirectory.mockResolvedValue(true);
    adapterMocks.writeBytes.mockResolvedValue(true);
    adapterMocks.readBytes.mockResolvedValue(BYTES);
  });

  it("writes under the planned profile quarantine path and never shell-opens", async () => {
    const plan = planInboundMediaWrite({
      profileId: "default",
      sha256: SHA,
      mimeType: "image/png",
      fileName: "a.png",
      byteLength: BYTES.byteLength,
    });

    const result = await persistInboundMediaQuarantineBytes({
      profileId: "default",
      plan,
      bytes: BYTES,
    });

    expect(result).toEqual({
      status: "written",
      relativePath: `profiles/default/quarantine/${SHA}`,
    });
    expect(adapterMocks.ensureDirectory).toHaveBeenCalledWith({
      path: "profiles/default/quarantine",
      appDataRelative: true,
    });
    expect(adapterMocks.writeBytes).toHaveBeenCalledWith({
      path: `profiles/default/quarantine/${SHA}`,
      appDataRelative: true,
      bytes: BYTES,
    });
    expect(adapterMocks.openPath).not.toHaveBeenCalled();
  });

  it("skips when native runtime is unavailable", async () => {
    adapterMocks.isSupported.mockReturnValue(false);
    const plan = planInboundMediaWrite({
      profileId: "default",
      sha256: SHA,
      mimeType: "image/png",
      fileName: "a.png",
      byteLength: 4,
    });
    await expect(persistInboundMediaQuarantineBytes({
      profileId: "default",
      plan,
      bytes: BYTES,
    })).resolves.toEqual({ status: "skipped_non_native" });
    expect(adapterMocks.writeBytes).not.toHaveBeenCalled();
  });

  it("rejects writes when plan path is missing or foreign", async () => {
    const badPlan = {
      ...planInboundMediaWrite({
        profileId: "default",
        sha256: SHA,
        mimeType: "image/png",
        fileName: "a.png",
        byteLength: 4,
      }),
      quarantineRelativePath: `profiles/other/quarantine/${SHA}`,
    };
    await expect(persistInboundMediaQuarantineBytes({
      profileId: "default",
      plan: badPlan,
      bytes: BYTES,
    })).resolves.toEqual({
      status: "rejected_path",
      reason: "path_not_in_profile_quarantine",
    });
    expect(adapterMocks.writeBytes).not.toHaveBeenCalled();
  });
});

describe("readInboundMediaQuarantineBytes (P2-S S2b / S5 L1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    adapterMocks.isSupported.mockReturnValue(true);
    adapterMocks.readBytes.mockResolvedValue(BYTES);
  });

  it("reads when requesting profile owns the quarantine path", async () => {
    const path = `profiles/alice/quarantine/${SHA}`;
    await expect(readInboundMediaQuarantineBytes({
      requestingProfileId: "alice",
      relativePath: path,
    })).resolves.toEqual(BYTES);
    expect(adapterMocks.readBytes).toHaveBeenCalledWith({
      path,
      appDataRelative: true,
    });
  });

  it("fail-closes cross-profile quarantine reads", async () => {
    await expect(readInboundMediaQuarantineBytes({
      requestingProfileId: "bob",
      relativePath: `profiles/alice/quarantine/${SHA}`,
    })).resolves.toBeNull();
    expect(adapterMocks.readBytes).not.toHaveBeenCalled();
  });
});
