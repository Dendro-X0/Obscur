import { beforeEach, describe, expect, it, vi } from "vitest";

const runtimeMocks = vi.hoisted(() => ({
  hasNativeRuntime: vi.fn(),
}));

const shellMocks = vi.hoisted(() => ({
  open: vi.fn(),
}));

const dialogMocks = vi.hoisted(() => ({
  open: vi.fn(),
}));

const fsMocks = vi.hoisted(() => ({
  readFile: vi.fn(),
}));

vi.mock("./runtime-capabilities", () => ({
  hasNativeRuntime: runtimeMocks.hasNativeRuntime,
}));

vi.mock("@tauri-apps/plugin-shell", () => ({
  open: shellMocks.open,
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: dialogMocks.open,
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  readFile: fsMocks.readFile,
}));

import * as nativeHostAdapter from "./native-host-adapter";
import {
  openNativeExternal,
  pickNativeFiles,
  readNativeFileBytes,
  registerNativeBackgroundService,
} from "./native-host-adapter";

describe("native-host-adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns unsupported fallbacks outside native runtime", async () => {
    runtimeMocks.hasNativeRuntime.mockReturnValue(false);

    await expect(openNativeExternal("https://example.com")).resolves.toBe(false);
    await expect(pickNativeFiles()).resolves.toBeNull();
    await expect(readNativeFileBytes("C:/tmp/file.txt")).resolves.toBeNull();
    await expect(registerNativeBackgroundService()).resolves.toBe(false);
  });

  it("uses native host integrations in supported runtime", async () => {
    const backgroundMocks = {
      isRegistered: vi.fn().mockResolvedValue(false),
      register: vi.fn().mockResolvedValue(undefined),
    };
    runtimeMocks.hasNativeRuntime.mockReturnValue(true);
    shellMocks.open.mockResolvedValue(undefined);
    dialogMocks.open.mockResolvedValue(["C:/a.png", "C:/b.png"]);
    fsMocks.readFile.mockResolvedValue(new Uint8Array([1, 2, 3]));
    vi.spyOn(nativeHostAdapter.nativeHostAdapterInternals, "loadBackgroundPlugin").mockResolvedValue(backgroundMocks);

    await expect(openNativeExternal("https://example.com")).resolves.toBe(true);
    await expect(pickNativeFiles({ multiple: true, extensions: ["png"] })).resolves.toEqual(["C:/a.png", "C:/b.png"]);
    await expect(readNativeFileBytes("C:/a.png")).resolves.toEqual(new Uint8Array([1, 2, 3]));
    await expect(registerNativeBackgroundService()).resolves.toBe(true);
    expect(backgroundMocks.register).toHaveBeenCalledWith({ matches: ["*"] });
  });

  it("does not re-register background service when already registered", async () => {
    const backgroundMocks = {
      isRegistered: vi.fn().mockResolvedValue(true),
      register: vi.fn().mockResolvedValue(undefined),
    };
    runtimeMocks.hasNativeRuntime.mockReturnValue(true);
    vi.spyOn(nativeHostAdapter.nativeHostAdapterInternals, "loadBackgroundPlugin").mockResolvedValue(backgroundMocks);

    await expect(registerNativeBackgroundService()).resolves.toBe(true);
    expect(backgroundMocks.register).not.toHaveBeenCalled();
  });
});
