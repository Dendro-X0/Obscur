import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";

export type PortabilityImportKind = "portable_account" | "workspace_bundle" | "unified_account";

const PORTABLE_ACCOUNT_FILTERS = [{
  name: "Obscur portable account",
  extensions: ["json"],
}];

const UNIFIED_ACCOUNT_FILTERS = [{
  name: "Obscur unified account export",
  extensions: ["obscur-account-export", "json"],
}];

const WORKSPACE_BUNDLE_FILTERS = [{
  name: "Obscur encrypted workspace",
  extensions: ["obscur-bundle", "json"],
}];

export const pickPortabilityImportFile = async (
  kind: PortabilityImportKind,
  options?: Readonly<{ defaultPath?: string | null }>,
): Promise<File | null> => {
  if (!hasNativeRuntime()) {
    return null;
  }
  try {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const { readTextFile } = await import("@tauri-apps/plugin-fs");
    const defaultPath = options?.defaultPath?.trim();
    const selected = await open({
      multiple: false,
      ...(defaultPath ? { defaultPath } : {}),
      filters: kind === "workspace_bundle"
        ? WORKSPACE_BUNDLE_FILTERS
        : kind === "unified_account"
          ? UNIFIED_ACCOUNT_FILTERS
          : PORTABLE_ACCOUNT_FILTERS,
    });
    if (typeof selected !== "string" || selected.trim().length === 0) {
      return null;
    }
    const contents = await readTextFile(selected);
    const fileName = selected.replace(/\\/g, "/").split("/").pop() ?? "import.json";
    return new File([contents], fileName, { type: "application/json" });
  } catch {
    return null;
  }
};
