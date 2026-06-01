import { invokeNativeCommand } from "@/app/features/runtime/native-adapters";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";

export type DataRootExportWriteResult = Readonly<{
  fileName: string;
  absolutePath: string | null;
  downloadTriggered: boolean;
}>;

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
};

const triggerBrowserDownload = (fileName: string, contents: string): void => {
  const blob = new Blob([contents], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = "noopener";
  anchor.click();
  URL.revokeObjectURL(url);
};

export const writeExportToDataRoot = async (
  fileName: string,
  contents: string,
): Promise<DataRootExportWriteResult> => {
  if (hasNativeRuntime()) {
    const result = await invokeNativeCommand<string>("desktop_write_data_root_export", {
      fileName,
      contentsBase64: bytesToBase64(new TextEncoder().encode(contents)),
    });
    if (result.ok) {
      return {
        fileName,
        absolutePath: result.value,
        downloadTriggered: false,
      };
    }
  }

  triggerBrowserDownload(fileName, contents);
  return {
    fileName,
    absolutePath: null,
    downloadTriggered: true,
  };
};

export const revealExportPathInFileManager = async (absolutePath: string): Promise<boolean> => {
  if (!absolutePath.trim()) {
    return false;
  }
  if (hasNativeRuntime()) {
    const result = await invokeNativeCommand<void>("desktop_reveal_path_in_file_manager", {
      path: absolutePath,
    });
    return result.ok;
  }
  return false;
};

export const openExportsFolderInFileManager = async (): Promise<string | null> => {
  if (!hasNativeRuntime()) {
    return null;
  }
  const result = await invokeNativeCommand<string>("desktop_open_exports_folder");
  return result.ok ? result.value : null;
};

export const getWorkspaceExportsFolderPath = async (): Promise<string | null> => {
  if (!hasNativeRuntime()) {
    return null;
  }
  const result = await invokeNativeCommand<string>("desktop_get_exports_folder_path");
  return result.ok && result.value?.trim() ? result.value.trim() : null;
};

export const dirnameFromExportPath = (absolutePath: string): string => {
  const normalized = absolutePath.replace(/\\/g, "/");
  const index = normalized.lastIndexOf("/");
  return index >= 0 ? absolutePath.slice(0, index) : absolutePath;
};
