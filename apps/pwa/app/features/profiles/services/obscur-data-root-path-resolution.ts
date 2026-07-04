export const DEFAULT_OBSCUR_DATA_SUBFOLDER = "app.obscur.desktop";

export type ObscurDataRootPathApi = Readonly<{
  dirname: (path: string) => Promise<string>;
  basename: (path: string) => Promise<string>;
  join: (parent: string, child: string) => Promise<string>;
}>;

export type ObscurDataRootPickResolution = Readonly<{
  targetPath: string;
  parentPath: string;
  subfolderName: string;
  showSubfolderDialog: boolean;
}>;

export function normalizeParentPath(path: string): string {
  return path.trim().replace(/[\\/]+$/, "");
}

export function isWindowsDriveRoot(path: string): boolean {
  const normalized = normalizeParentPath(path);
  return /^[A-Za-z]:$/.test(normalized);
}

export function validateObscurDataSubfolderName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) {
    return "Folder name is required.";
  }
  if (trimmed === "." || trimmed === "..") {
    return "Invalid folder name.";
  }
  if (/[\\/:*?"<>|]/.test(trimmed)) {
    return "Folder name cannot contain \\ / : * ? \" < > |";
  }
  if (trimmed.endsWith(".") || trimmed.endsWith(" ")) {
    return "Folder name cannot end with a space or period.";
  }
  return null;
}

export async function resolveObscurDataRootAfterPick(
  selectedPath: string,
  intent: "change" | "reconnect",
  options: Readonly<{
    probeHasObscurData: (path: string) => Promise<boolean>;
    pathApi: ObscurDataRootPathApi;
  }>,
): Promise<ObscurDataRootPickResolution> {
  const selected = selectedPath.trim();
  if (!selected) {
    throw new Error("Data folder path is empty.");
  }

  if (await options.probeHasObscurData(selected)) {
    const parentPath = await options.pathApi.dirname(selected);
    const subfolderName = await options.pathApi.basename(selected);
    return {
      targetPath: selected,
      parentPath,
      subfolderName,
      showSubfolderDialog: false,
    };
  }

  const defaultChildPath = await options.pathApi.join(selected, DEFAULT_OBSCUR_DATA_SUBFOLDER);
  if (intent === "reconnect" && await options.probeHasObscurData(defaultChildPath)) {
    return {
      targetPath: defaultChildPath,
      parentPath: selected,
      subfolderName: DEFAULT_OBSCUR_DATA_SUBFOLDER,
      showSubfolderDialog: false,
    };
  }

  const lastSegment = await options.pathApi.basename(selected);
  if (lastSegment === DEFAULT_OBSCUR_DATA_SUBFOLDER) {
    const parentPath = await options.pathApi.dirname(selected);
    return {
      targetPath: selected,
      parentPath,
      subfolderName: DEFAULT_OBSCUR_DATA_SUBFOLDER,
      showSubfolderDialog: intent === "change",
    };
  }

  const targetPath = defaultChildPath;
  return {
    targetPath,
    parentPath: selected,
    subfolderName: DEFAULT_OBSCUR_DATA_SUBFOLDER,
    showSubfolderDialog: intent === "change",
  };
}
