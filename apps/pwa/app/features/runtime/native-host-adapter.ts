import { hasNativeRuntime } from "./runtime-capabilities";

export type PickFilesOptions = Readonly<{
  multiple?: boolean;
  extensions?: ReadonlyArray<string>;
}>;

type BackgroundPluginModule = Readonly<{
  isRegistered: () => Promise<boolean>;
  register: (params: { matches: string[] }) => Promise<void>;
}>;

const loadBackgroundPlugin = async (): Promise<BackgroundPluginModule> => {
  const importer = new Function('return import("@tauri-apps/plugin-background")') as () => Promise<BackgroundPluginModule>;
  return importer();
};

export const openNativeExternal = async (target: string): Promise<boolean> => {
  if (!hasNativeRuntime()) {
    return false;
  }

  try {
    const { open } = await import("@tauri-apps/plugin-shell");
    await open(target);
    return true;
  } catch {
    return false;
  }
};

export const pickNativeFiles = async (options?: PickFilesOptions): Promise<ReadonlyArray<string> | null> => {
  if (!hasNativeRuntime()) {
    return null;
  }

  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const selected = await open({
      multiple: options?.multiple ?? true,
      filters: options?.extensions && options.extensions.length > 0
        ? [{ name: "Selected files", extensions: [...options.extensions] }]
        : undefined,
    });
    if (!selected) {
      return null;
    }
    return Array.isArray(selected) ? selected : [selected];
  } catch {
    return null;
  }
};

export const readNativeFileBytes = async (path: string): Promise<Uint8Array | null> => {
  if (!hasNativeRuntime()) {
    return null;
  }

  try {
    const { readFile } = await import("@tauri-apps/plugin-fs");
    return await readFile(path);
  } catch {
    return null;
  }
};

export const registerNativeBackgroundService = async (): Promise<boolean> => {
  if (!hasNativeRuntime()) {
    return false;
  }

  try {
    const { isRegistered, register } = await nativeHostAdapterInternals.loadBackgroundPlugin();
    if (await isRegistered()) {
      return true;
    }
    await register({ matches: ["*"] });
    return true;
  } catch {
    return false;
  }
};

export const nativeHostAdapterInternals = {
  loadBackgroundPlugin,
};
