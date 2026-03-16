import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";

type NativeMediaPathRef = Readonly<{
  path: string;
  appDataRelative?: boolean;
}>;

const isSupported = (): boolean => hasNativeRuntime();

const joinPaths = async (...parts: string[]): Promise<string> => {
  const { join } = await import("@tauri-apps/api/path");
  return join(...parts);
};

const ensureDirectory = async (params: NativeMediaPathRef): Promise<boolean> => {
  if (!isSupported()) return false;
  const { mkdir } = await import("@tauri-apps/plugin-fs");
  if (params.appDataRelative) {
    const { BaseDirectory } = await import("@tauri-apps/api/path");
    await mkdir(params.path, { baseDir: BaseDirectory.AppData, recursive: true });
    return true;
  }
  await mkdir(params.path, { recursive: true });
  return true;
};

const fileExists = async (params: NativeMediaPathRef): Promise<boolean> => {
  if (!isSupported()) return false;
  const { exists } = await import("@tauri-apps/plugin-fs");
  if (params.appDataRelative) {
    const { BaseDirectory } = await import("@tauri-apps/api/path");
    return exists(params.path, { baseDir: BaseDirectory.AppData });
  }
  return exists(params.path);
};

const writeBytes = async (params: NativeMediaPathRef & Readonly<{ bytes: Uint8Array }>): Promise<boolean> => {
  if (!isSupported()) return false;
  const { writeFile } = await import("@tauri-apps/plugin-fs");
  if (params.appDataRelative) {
    const { BaseDirectory } = await import("@tauri-apps/api/path");
    await writeFile(params.path, params.bytes, { baseDir: BaseDirectory.AppData, create: true });
    return true;
  }
  await writeFile(params.path, params.bytes);
  return true;
};

const removePath = async (params: NativeMediaPathRef & Readonly<{ recursive?: boolean }>): Promise<boolean> => {
  if (!isSupported()) return false;
  const { remove } = await import("@tauri-apps/plugin-fs");
  if (params.appDataRelative) {
    const { BaseDirectory } = await import("@tauri-apps/api/path");
    await remove(params.path, { baseDir: BaseDirectory.AppData, recursive: params.recursive });
    return true;
  }
  await remove(params.path, { recursive: params.recursive });
  return true;
};

const getAppDataDirPath = async (): Promise<string | null> => {
  if (!isSupported()) return null;
  const { appDataDir } = await import("@tauri-apps/api/path");
  return appDataDir();
};

const openPath = async (path: string): Promise<boolean> => {
  if (!isSupported()) return false;
  const { open } = await import("@tauri-apps/plugin-shell");
  await open(path);
  return true;
};

const convertAbsolutePathToFileSrc = async (absolutePath: string): Promise<string | null> => {
  if (!isSupported()) return null;
  const { convertFileSrc } = await import("@tauri-apps/api/core");
  return convertFileSrc(absolutePath);
};

const pickDirectory = async (): Promise<string | null> => {
  if (!isSupported()) return null;
  const { open } = await import("@tauri-apps/plugin-dialog");
  const selected = await open({ directory: true, multiple: false });
  return typeof selected === "string" && selected.trim().length > 0 ? selected : null;
};

export const nativeLocalMediaAdapter = {
  isSupported,
  joinPaths,
  ensureDirectory,
  fileExists,
  writeBytes,
  removePath,
  getAppDataDirPath,
  openPath,
  convertAbsolutePathToFileSrc,
  pickDirectory,
};
