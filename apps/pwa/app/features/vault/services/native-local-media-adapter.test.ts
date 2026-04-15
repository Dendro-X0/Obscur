import { beforeEach, describe, expect, it, vi } from "vitest";

const runtimeMocks = vi.hoisted(() => ({
  hasNativeRuntime: vi.fn(),
}));

const pathMocks = vi.hoisted(() => ({
  join: vi.fn(),
  appDataDir: vi.fn(),
  BaseDirectory: { AppData: "AppData" },
}));

const fsMocks = vi.hoisted(() => ({
  mkdir: vi.fn(),
  exists: vi.fn(),
  writeFile: vi.fn(),
  remove: vi.fn(),
}));

const shellMocks = vi.hoisted(() => ({
  open: vi.fn(),
}));

const coreMocks = vi.hoisted(() => ({
  convertFileSrc: vi.fn(),
  invoke: vi.fn(),
}));

const dialogMocks = vi.hoisted(() => ({
  open: vi.fn(),
  save: vi.fn(),
}));

vi.mock("@/app/features/runtime/runtime-capabilities", () => ({
  hasNativeRuntime: runtimeMocks.hasNativeRuntime,
}));

vi.mock("@tauri-apps/api/path", () => ({
  join: pathMocks.join,
  appDataDir: pathMocks.appDataDir,
  BaseDirectory: pathMocks.BaseDirectory,
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  mkdir: fsMocks.mkdir,
  exists: fsMocks.exists,
  writeFile: fsMocks.writeFile,
  remove: fsMocks.remove,
}));

vi.mock("@tauri-apps/plugin-shell", () => ({
  open: shellMocks.open,
}));

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: coreMocks.convertFileSrc,
  invoke: coreMocks.invoke,
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: dialogMocks.open,
  save: dialogMocks.save,
}));

import { nativeLocalMediaAdapter } from "./native-local-media-adapter";

describe("native-local-media-adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns unsupported fallbacks in web runtime", async () => {
    runtimeMocks.hasNativeRuntime.mockReturnValue(false);

    await expect(nativeLocalMediaAdapter.getAppDataDirPath()).resolves.toBeNull();
    await expect(nativeLocalMediaAdapter.ensureDirectory({ path: "vault-media", appDataRelative: true })).resolves.toBe(false);
    await expect(nativeLocalMediaAdapter.pickDirectory()).resolves.toBeNull();
  });

  it("uses native modules when runtime is supported", async () => {
    runtimeMocks.hasNativeRuntime.mockReturnValue(true);
    pathMocks.join.mockResolvedValue("C:/data/vault-media");
    pathMocks.appDataDir.mockResolvedValue("C:/data");
    fsMocks.mkdir.mockResolvedValue(undefined);
    fsMocks.exists.mockResolvedValue(true);
    fsMocks.writeFile.mockResolvedValue(undefined);
    fsMocks.remove.mockResolvedValue(undefined);
    shellMocks.open.mockResolvedValue(undefined);
    coreMocks.invoke.mockResolvedValue(undefined);
    coreMocks.convertFileSrc.mockReturnValue("asset://vault-media/file.png");
    dialogMocks.open.mockResolvedValue("C:/picked");
    dialogMocks.save.mockResolvedValue("C:/picked/file.png");

    await expect(nativeLocalMediaAdapter.joinPaths("C:/data", "vault-media")).resolves.toBe("C:/data/vault-media");
    await expect(nativeLocalMediaAdapter.getAppDataDirPath()).resolves.toBe("C:/data");
    await expect(nativeLocalMediaAdapter.ensureDirectory({ path: "vault-media", appDataRelative: true })).resolves.toBe(true);
    await expect(nativeLocalMediaAdapter.fileExists({ path: "vault-media/file.png", appDataRelative: true })).resolves.toBe(true);
    await expect(
      nativeLocalMediaAdapter.writeBytes({ path: "vault-media/file.png", appDataRelative: true, bytes: new Uint8Array([1, 2, 3]) })
    ).resolves.toBe(true);
    await expect(nativeLocalMediaAdapter.removePath({ path: "vault-media", appDataRelative: true, recursive: true })).resolves.toBe(true);
    await expect(nativeLocalMediaAdapter.openPath("C:/data/vault-media")).resolves.toBe(true);
    expect(coreMocks.invoke).not.toHaveBeenCalled();
    await expect(nativeLocalMediaAdapter.convertAbsolutePathToFileSrc("C:/data/vault-media/file.png")).resolves.toBe("asset://vault-media/file.png");
    await expect(nativeLocalMediaAdapter.pickDirectory()).resolves.toBe("C:/picked");
    await expect(nativeLocalMediaAdapter.pickSavePath({ defaultPath: "C:/picked/file.png" })).resolves.toBe("C:/picked/file.png");
  });

  it("falls back to native command when plugin-shell open fails", async () => {
    runtimeMocks.hasNativeRuntime.mockReturnValue(true);
    shellMocks.open.mockRejectedValue(new Error("open failed"));
    coreMocks.invoke.mockResolvedValue(undefined);

    await expect(nativeLocalMediaAdapter.openPath("D:/ObscurData/vault-media")).resolves.toBe(true);
    expect(coreMocks.invoke).toHaveBeenCalledWith("desktop_open_storage_path", { path: "D:/ObscurData/vault-media" });
  });
});
