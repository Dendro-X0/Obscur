import { invokeNativeCommand } from "@/app/features/runtime/native-adapters";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { revealExportPathInFileManager } from "./data-root-export-service";

export const getProfileArchivesFolderPath = async (): Promise<string | null> => {
  if (!hasNativeRuntime()) {
    return null;
  }
  const result = await invokeNativeCommand<string>("desktop_get_profile_archives_folder_path");
  return result.ok ? result.value : null;
};

export const openProfileArchivesFolderInFileManager = async (): Promise<string | null> => {
  if (!hasNativeRuntime()) {
    return null;
  }
  const result = await invokeNativeCommand<string>("desktop_open_profile_archives_folder");
  return result.ok ? result.value : null;
};

export const revealProfileArchivePathInFileManager = async (absolutePath: string): Promise<boolean> => (
  revealExportPathInFileManager(absolutePath)
);
