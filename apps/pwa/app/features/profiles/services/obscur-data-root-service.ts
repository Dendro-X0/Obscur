import { invokeNativeCommand } from "@/app/features/runtime/native-adapters";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { nativeLocalMediaAdapter } from "@/app/features/vault/services/native-local-media-adapter";

export type ObscurDataRootConfig = Readonly<{
  version: number;
  defaultPath: string;
  customPath: string | null;
  effectivePath: string;
  requiresRestart: boolean;
}>;

const EMPTY_CONFIG: ObscurDataRootConfig = {
  version: 1,
  defaultPath: "",
  customPath: null,
  effectivePath: "",
  requiresRestart: false,
};

export const getObscurDataRootConfig = async (): Promise<ObscurDataRootConfig> => {
  if (!hasNativeRuntime()) {
    return EMPTY_CONFIG;
  }
  const result = await invokeNativeCommand<ObscurDataRootConfig>("desktop_get_obscur_data_root_config");
  return result.ok ? result.value : EMPTY_CONFIG;
};

export const setObscurDataRootPath = async (customPath: string | null): Promise<ObscurDataRootConfig> => {
  if (!hasNativeRuntime()) {
    throw new Error("Custom data root is only available in the desktop app.");
  }
  const result = await invokeNativeCommand<ObscurDataRootConfig>("desktop_set_obscur_data_root", {
    customPath,
  });
  if (!result.ok) {
    throw new Error(result.message || "Failed to update Obscur data root.");
  }
  return result.value;
};

export const pickObscurDataRootPath = async (): Promise<string | null> => {
  if (!hasNativeRuntime()) {
    return null;
  }
  return nativeLocalMediaAdapter.pickDirectory();
};

export const openObscurDataRootPath = async (path: string): Promise<boolean> => {
  if (!path.trim()) {
    return false;
  }
  return nativeLocalMediaAdapter.openPath(path);
};
