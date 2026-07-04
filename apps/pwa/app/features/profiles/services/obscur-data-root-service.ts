import { invokeNativeCommand } from "@/app/features/runtime/native-adapters";
import { listenToNativeEvent } from "@/app/features/runtime/native-event-adapter";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import { nativeLocalMediaAdapter } from "@/app/features/vault/services/native-local-media-adapter";
import {
  DEFAULT_OBSCUR_DATA_SUBFOLDER,
  resolveObscurDataRootAfterPick,
  validateObscurDataSubfolderName,
  type ObscurDataRootPickResolution,
} from "./obscur-data-root-path-resolution";

export const DATA_ROOT_MIGRATION_PROGRESS_EVENT = "obscur-data-root-migration-progress";

export { DEFAULT_OBSCUR_DATA_SUBFOLDER, validateObscurDataSubfolderName } from "./obscur-data-root-path-resolution";
export type { ObscurDataRootPickResolution } from "./obscur-data-root-path-resolution";

export type DataRootMigrationProgress = Readonly<{
  phase: string;
  itemsCopied: number;
  itemsTotal: number;
  bytesCopied: number;
  bytesTotal: number;
  currentItem: string | null;
}>;

export type ObscurDataRootConfig = Readonly<{
  version: number;
  defaultPath: string;
  customPath: string | null;
  effectivePath: string;
  requiresRestart: boolean;
  exportsPath: string;
  profileArchivesPath: string;
  vaultMediaPath: string;
  migrationSourcePath?: string;
  migrationDestinationPath?: string;
  migrationCopiedCount?: number;
  canImportFromDefault: boolean;
  recoverableCustomPath?: string;
  authoritySource: string;
  pointerHealed: boolean;
  appDataPath: string;
  storageMode: string;
  physicalPathAvailable?: boolean;
  physicalPathIssue?: string;
  physicalPathSlow?: boolean;
  migrationSkippedCount?: number;
}>;

export type ObscurDataRootChangePlan = Readonly<{
  targetPath: string;
  sourcePath: string;
  anchorPath: string;
  targetHasObscurData: boolean;
  anchorHasObscurData: boolean;
  anchorWouldBeReplaced: boolean;
  pathsEquivalent: boolean;
  recommendedAction: "reconnect" | "migrate" | "already_bound" | string;
}>;

const EMPTY_CONFIG: ObscurDataRootConfig = {
  version: 1,
  defaultPath: "",
  customPath: null,
  effectivePath: "",
  requiresRestart: false,
  exportsPath: "",
  profileArchivesPath: "",
  vaultMediaPath: "",
  canImportFromDefault: false,
  authoritySource: "default_appdata",
  pointerHealed: false,
  appDataPath: "",
  storageMode: "appdata",
  physicalPathAvailable: true,
  physicalPathSlow: false,
};

export const getObscurDataRootConfig = async (): Promise<ObscurDataRootConfig> => {
  if (!hasNativeRuntime()) {
    return EMPTY_CONFIG;
  }
  const result = await invokeNativeCommand<ObscurDataRootConfig>("desktop_get_obscur_data_root_config");
  return result.ok ? result.value : EMPTY_CONFIG;
};

export const prepareObscurDataRootChange = async (
  options?: Readonly<{ tolerateUnavailableSource?: boolean }>,
): Promise<void> => {
  if (!hasNativeRuntime()) {
    return;
  }
  const skipDataWrites = options?.tolerateUnavailableSource
    && (await getObscurDataRootConfig()).physicalPathAvailable === false;
  if (!skipDataWrites) {
    const { messagingChatStateDurabilityPort } = await import("@/app/features/messaging/services/messaging-chat-state-durability-port");
    const { flushPendingSealedGroupSqliteWrites } = await import("@/app/features/groups/services/sealed-group-message-persistence");
    messagingChatStateDurabilityPort.flushAllPending();
    await flushPendingSealedGroupSqliteWrites();
  }
  const result = await invokeNativeCommand<null>("desktop_prepare_data_root_change");
  if (!result.ok) {
    throw new Error(result.message || "Failed to prepare local data for folder change.");
  }
};

export const listenDataRootMigrationProgress = async (
  handler: (progress: DataRootMigrationProgress) => void,
): Promise<() => void> => {
  if (!hasNativeRuntime()) {
    return () => undefined;
  }
  return listenToNativeEvent<DataRootMigrationProgress>(DATA_ROOT_MIGRATION_PROGRESS_EVENT, (event) => {
    if (!event.payload) {
      return;
    }
    handler(event.payload);
  });
};

export const setObscurDataRootPath = async (
  customPath: string | null,
  options?: Readonly<{
    migrateExisting?: boolean;
    overwriteDestination?: boolean;
    onMigrationProgress?: (progress: DataRootMigrationProgress) => void;
    skipPrepare?: boolean;
    tolerateUnavailableSource?: boolean;
  }>,
): Promise<ObscurDataRootConfig> => {
  if (!hasNativeRuntime()) {
    throw new Error("Custom data root is only available in the desktop app.");
  }
  if (!options?.skipPrepare) {
    await prepareObscurDataRootChange({
      tolerateUnavailableSource: options?.tolerateUnavailableSource,
    });
  }
  if (options?.migrateExisting && customPath) {
    await preflightObscurDataRootMigration(customPath, options?.overwriteDestination ?? false);
  }
  const shouldTrackProgress = Boolean(options?.migrateExisting && options?.onMigrationProgress);
  const unlisten = shouldTrackProgress
    ? await listenDataRootMigrationProgress(options!.onMigrationProgress!)
    : null;
  try {
    const result = await invokeNativeCommand<ObscurDataRootConfig>("desktop_set_obscur_data_root", {
      customPath,
      migrateExisting: options?.migrateExisting ?? false,
      overwriteDestination: options?.overwriteDestination ?? false,
    });
    if (!result.ok) {
      throw new Error(result.message || "Failed to update Obscur data root.");
    }
    return result.value;
  } finally {
    unlisten?.();
  }
};

export const importObscurDataFromDefault = async (): Promise<ObscurDataRootConfig> => {
  if (!hasNativeRuntime()) {
    throw new Error("Import from default app-data is only available in the desktop app.");
  }
  await prepareObscurDataRootChange();
  const result = await invokeNativeCommand<ObscurDataRootConfig>("desktop_import_obscur_data_from_default");
  if (!result.ok) {
    throw new Error(result.message || "Failed to import Obscur data from default app-data folder.");
  }
  return result.value;
};

export const preflightObscurDataRootMigration = async (
  targetPath: string,
  overwriteDestination = false,
): Promise<void> => {
  if (!hasNativeRuntime() || !targetPath.trim()) {
    throw new Error("Migration preflight is only available in the desktop app.");
  }
  const result = await invokeNativeCommand<null>("desktop_preflight_obscur_data_root_migration", {
    targetPath,
    overwriteDestination,
  });
  if (!result.ok) {
    throw new Error(result.message || "Data folder is not ready for migration.");
  }
};

export const planObscurDataRootChange = async (targetPath: string): Promise<ObscurDataRootChangePlan> => {
  if (!hasNativeRuntime() || !targetPath.trim()) {
    throw new Error("Data folder planning is only available in the desktop app.");
  }
  const result = await invokeNativeCommand<ObscurDataRootChangePlan>("desktop_plan_obscur_data_root_change", {
    targetPath,
  });
  if (!result.ok) {
    throw new Error(result.message || "Failed to plan Obscur data folder change.");
  }
  return result.value;
};

export const probeObscurDataRootPath = async (path: string): Promise<boolean> => {
  if (!hasNativeRuntime() || !path.trim()) {
    return false;
  }
  const result = await invokeNativeCommand<boolean>("desktop_probe_obscur_data_root", { path });
  return result.ok ? Boolean(result.value) : false;
};

const createObscurDataRootPathApi = async () => {
  const { basename, dirname, join } = await import("@tauri-apps/api/path");
  return {
    dirname,
    basename,
    join,
  };
};

export const buildObscurDataRootTargetPath = async (
  parentPath: string,
  subfolderName: string,
): Promise<string> => {
  const validationError = validateObscurDataSubfolderName(subfolderName);
  if (validationError) {
    throw new Error(validationError);
  }
  if (!hasNativeRuntime()) {
    throw new Error("Custom data root is only available in the desktop app.");
  }
  const pathApi = await createObscurDataRootPathApi();
  return pathApi.join(parentPath.trim(), subfolderName.trim());
};

export const resolveObscurDataRootPick = async (
  selectedPath: string,
  intent: "change" | "reconnect",
): Promise<ObscurDataRootPickResolution> => {
  if (!hasNativeRuntime()) {
    throw new Error("Custom data root is only available in the desktop app.");
  }
  const pathApi = await createObscurDataRootPathApi();
  return resolveObscurDataRootAfterPick(selectedPath, intent, {
    probeHasObscurData: probeObscurDataRootPath,
    pathApi,
  });
};

export const reconnectObscurDataRootPath = async (
  customPath: string,
  options?: Readonly<{ skipPrepare?: boolean; tolerateUnavailableSource?: boolean }>,
): Promise<ObscurDataRootConfig> => {
  if (!hasNativeRuntime()) {
    throw new Error("Reconnect is only available in the desktop app.");
  }
  if (!options?.skipPrepare) {
    await prepareObscurDataRootChange({
      tolerateUnavailableSource: options?.tolerateUnavailableSource,
    });
  }
  const result = await invokeNativeCommand<ObscurDataRootConfig>("desktop_reconnect_obscur_data_root", {
    customPath,
  });
  if (!result.ok) {
    throw new Error(result.message || "Failed to reconnect Obscur data folder.");
  }
  return result.value;
};

export const bindObscurDataRootForRecovery = async (
  targetPath: string,
  targetHasObscurData: boolean,
): Promise<ObscurDataRootConfig> => {
  const prepareOptions = { tolerateUnavailableSource: true as const };
  await prepareObscurDataRootChange(prepareOptions);
  const bindOptions = { skipPrepare: true as const, tolerateUnavailableSource: true as const, migrateExisting: false as const };
  if (targetHasObscurData) {
    try {
      return await reconnectObscurDataRootPath(targetPath, { skipPrepare: true, tolerateUnavailableSource: true });
    } catch (reconnectError) {
      try {
        return await setObscurDataRootPath(targetPath, bindOptions);
      } catch {
        throw reconnectError instanceof Error ? reconnectError : new Error("Failed to bind data folder.");
      }
    }
  }
  return setObscurDataRootPath(targetPath, bindOptions);
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
